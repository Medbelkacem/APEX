/**
 * Base URL every browser-side API call is built from.
 *
 * Same-origin by default in production (an empty string, so
 * `${API_BASE}/api/...` resolves as the relative path `/api/...`): the
 * reverse proxy in front of production (see `docker/Caddyfile`) mounts the
 * API under `/api` on the same origin as the site, so a relative path always
 * reaches it — and can never resolve to a loopback/private address, which is
 * what happens if a build ships without `NEXT_PUBLIC_API_URL` set. Local dev
 * runs the API on its own port, so it keeps an absolute localhost fallback.
 * Set `NEXT_PUBLIC_API_URL` to override either default (e.g. the API on its
 * own subdomain).
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Extract a human-friendly message from the API's error envelope. */
function messageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const m = (body as { message: unknown }).message;
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string') return m;
  }
  return fallback;
}

/** Endpoints that must never trigger a refresh — refreshing them is circular. */
const NO_REFRESH = ['/auth/refresh', '/auth/login', '/auth/logout'];

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Renew the session, coalescing concurrent callers into one request.
 *
 * The single flight is not an optimisation. Refresh tokens rotate and are
 * single-use, and presenting a spent one is treated as theft — so a page that
 * fired several requests at once and let each refresh on its own would replay
 * the same token and get the whole session revoked. Everyone awaits one call.
 */
function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    const token = csrfToken();
    refreshInFlight = fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { 'X-CSRF-Token': token } : undefined,
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/**
 * The CSRF token the API issued, read back out of its (script-readable) cookie.
 *
 * Echoing it in a header is what a forged cross-site request cannot do: the
 * browser would attach the cookie for the attacker, but same-origin policy
 * stops their page from reading it to build the header.
 */
export function csrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

function request(path: string, options: RequestInit): Promise<Response> {
  const token = csrfToken();
  return fetch(`${API_BASE}/api${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-CSRF-Token': token } : {}),
      ...(options.headers ?? {}),
    },
  });
}

/** Gateway statuses a sleeping Render free-tier instance produces while waking. */
const RETRYABLE_STATUSES = new Set([502, 503, 504]);
const RETRY_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function wakingUpError(status: number): ApiError {
  return new ApiError(status, 'Server is waking up, please retry in a moment.');
}

function networkError(cause: unknown): ApiError {
  return new ApiError(0, 'Could not reach the server. Check your connection and try again.', cause);
}

type Settled = { retry: false; response: Response } | { retry: true; error: ApiError };

async function settle(path: string, options: RequestInit): Promise<Settled> {
  let response: Response;
  try {
    response = await request(path, options);
  } catch (err) {
    return { retry: true, error: networkError(err) };
  }
  if (RETRYABLE_STATUSES.has(response.status)) {
    return { retry: true, error: wakingUpError(response.status) };
  }
  return { retry: false, response };
}

/**
 * One fetch, then — only for a network failure or a 502/503/504, the shapes a
 * sleeping Render instance produces — exactly one retry after a short delay.
 * Every other outcome (including a normal 4xx/5xx from the API) returns
 * immediately for the caller to interpret.
 */
async function fetchWithRetry(path: string, options: RequestInit): Promise<Response> {
  const first = await settle(path, options);
  if (!first.retry) return first.response;

  await sleep(RETRY_DELAY_MS);
  const second = await settle(path, options);
  if (!second.retry) return second.response;
  throw second.error;
}

/**
 * Thin fetch wrapper around the REST API. Always sends cookies (credentials:
 * 'include') so the HttpOnly session cookies flow on same-site requests, and
 * always rejects with an `ApiError` — never a raw `TypeError` or
 * `SyntaxError` — so every caller can do `err instanceof ApiError` and get a
 * message fit to show a user.
 *
 * Access tokens are short-lived by design, so a 401 is an expected part of a
 * normal session rather than an error: it is retried once behind a refresh. If
 * the refresh also fails the session is genuinely over and the 401 surfaces.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await fetchWithRetry(path, options);

  if (res.status === 401 && !NO_REFRESH.some((p) => path.startsWith(p))) {
    if (await refreshSession()) {
      res = await fetchWithRetry(path, options);
    }
  }

  const raw = await res.text();
  let data: unknown = null;
  if (raw) {
    try {
      data = JSON.parse(raw) as unknown;
    } catch {
      // A proxy/error page (e.g. a 404 or 502 from in front of the API)
      // instead of the API's own JSON — surface the status, not a parse crash.
      throw new ApiError(res.status, `Unexpected response from the server (status ${res.status}).`, raw);
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, messageFrom(data, res.statusText), data);
  }
  return data as T;
}

/**
 * Fire-and-forget ping to nudge a sleeping Render instance awake as soon as a
 * login/register page renders, instead of only on submit — shaves the cold
 * start off the time a user is staring at a spinner.
 */
export function warmUpApi(): void {
  void fetch(`${API_BASE}/api/health`, { credentials: 'omit', cache: 'no-store' }).catch(() => {});
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
