export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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

/**
 * Thin fetch wrapper around the REST API. Always sends cookies (credentials:
 * 'include') so the HttpOnly session cookies flow on same-site requests.
 *
 * Access tokens are short-lived by design, so a 401 is an expected part of a
 * normal session rather than an error: it is retried once behind a refresh. If
 * the refresh also fails the session is genuinely over and the 401 surfaces.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await request(path, options);

  if (res.status === 401 && !NO_REFRESH.some((p) => path.startsWith(p))) {
    if (await refreshSession()) {
      res = await request(path, options);
    }
  }

  const raw = await res.text();
  const data = raw ? (JSON.parse(raw) as unknown) : null;

  if (!res.ok) {
    throw new ApiError(res.status, messageFrom(data, res.statusText), data);
  }
  return data as T;
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
