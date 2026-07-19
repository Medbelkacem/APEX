import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, apiFetch } from './client';

/** Builds a Response-alike; the client only uses `ok`, `status` and `text()`. */
function reply(status: number, body: unknown = null): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `status ${status}`,
    text: () => Promise.resolve(body === null ? '' : JSON.stringify(body)),
  } as Response;
}

const fetchMock = vi.fn();

/** Paths of every call made, in order. */
const calledPaths = (): string[] => fetchMock.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('returns the parsed body on success', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { id: 'abc' }));

    await expect(apiFetch('/cases')).resolves.toEqual({ id: 'abc' });
  });

  it('sends cookies, so the HttpOnly session travels with the request', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, {}));

    await apiFetch('/cases');

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
  });

  it('returns null for an empty body', async () => {
    fetchMock.mockResolvedValueOnce(reply(200));

    await expect(apiFetch('/cases')).resolves.toBeNull();
  });

  it('throws ApiError carrying the status and the API message', async () => {
    fetchMock.mockResolvedValueOnce(reply(400, { message: 'Invoice already issued' }));

    await expect(apiFetch('/invoices')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Invoice already issued',
    });
  });

  it('joins the array form of a validation message', async () => {
    fetchMock.mockResolvedValueOnce(reply(400, { message: ['email invalid', 'name required'] }));

    await expect(apiFetch('/users')).rejects.toThrow('email invalid, name required');
  });
});

describe('CSRF token', () => {
  afterEach(() => {
    document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  it('echoes the cookie back in a header', async () => {
    document.cookie = 'csrf_token=tok-123; path=/';
    fetchMock.mockResolvedValueOnce(reply(200, {}));

    await apiFetch('/cases', { method: 'POST' });

    // A forged cross-site request gets the cookie attached for it but cannot
    // read it to build this header — that asymmetry is the whole protection.
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: expect.objectContaining({ 'X-CSRF-Token': 'tok-123' }),
    });
  });

  it('sends the token on the refresh call too', async () => {
    document.cookie = 'csrf_token=tok-123; path=/';
    fetchMock
      .mockResolvedValueOnce(reply(401))
      .mockResolvedValueOnce(reply(200))
      .mockResolvedValueOnce(reply(200, {}));

    await apiFetch('/cases');

    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      headers: { 'X-CSRF-Token': 'tok-123' },
    });
  });

  it('picks the token out from among other cookies', async () => {
    document.cookie = 'other=first; path=/';
    document.cookie = 'csrf_token=tok-456; path=/';
    fetchMock.mockResolvedValueOnce(reply(200, {}));

    await apiFetch('/cases', { method: 'POST' });

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: expect.objectContaining({ 'X-CSRF-Token': 'tok-456' }),
    });
    document.cookie = 'other=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  it('omits the header when no token has been issued', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, {}));

    await apiFetch('/cases', { method: 'POST' });

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['X-CSRF-Token']).toBeUndefined();
  });
});

describe('refresh on 401', () => {
  it('refreshes and retries once', async () => {
    fetchMock
      .mockResolvedValueOnce(reply(401))
      .mockResolvedValueOnce(reply(200)) // the refresh
      .mockResolvedValueOnce(reply(200, { id: 'abc' }));

    await expect(apiFetch('/cases')).resolves.toEqual({ id: 'abc' });
    expect(calledPaths()).toEqual([
      expect.stringContaining('/api/cases'),
      expect.stringContaining('/api/auth/refresh'),
      expect.stringContaining('/api/cases'),
    ]);
  });

  it('surfaces the 401 when the refresh also fails', async () => {
    fetchMock.mockResolvedValueOnce(reply(401)).mockResolvedValueOnce(reply(401));

    await expect(apiFetch('/cases')).rejects.toBeInstanceOf(ApiError);
    // Retrying a request whose session is genuinely over would just loop.
    expect(calledPaths()).toHaveLength(2);
  });

  it('does not retry more than once', async () => {
    fetchMock
      .mockResolvedValueOnce(reply(401))
      .mockResolvedValueOnce(reply(200)) // refresh succeeds
      .mockResolvedValueOnce(reply(401)); // but the retry is still refused

    await expect(apiFetch('/cases')).rejects.toMatchObject({ status: 401 });
    expect(calledPaths()).toHaveLength(3);
  });

  it('never tries to refresh the refresh endpoint itself', async () => {
    fetchMock.mockResolvedValueOnce(reply(401));

    await expect(apiFetch('/auth/refresh', { method: 'POST' })).rejects.toMatchObject({
      status: 401,
    });
    expect(calledPaths()).toHaveLength(1);
  });

  it('does not refresh a rejected login', async () => {
    fetchMock.mockResolvedValueOnce(reply(401, { message: 'Invalid email or password' }));

    await expect(api.post('/auth/login', { email: 'a@b.test' })).rejects.toThrow(
      'Invalid email or password',
    );
    expect(calledPaths()).toHaveLength(1);
  });

  it('coalesces concurrent refreshes into a single call', async () => {
    // Rotation makes refresh tokens single-use and treats a replay as theft, so
    // three parallel 401s must not produce three refreshes — that would revoke
    // the session outright rather than renewing it.
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('/auth/refresh')) return Promise.resolve(reply(200));
      const seen = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/cases')).length;
      return Promise.resolve(seen <= 3 ? reply(401) : reply(200, { ok: true }));
    });

    await Promise.all([apiFetch('/cases'), apiFetch('/cases'), apiFetch('/cases')]);

    const refreshes = calledPaths().filter((p) => p.includes('/auth/refresh'));
    expect(refreshes).toHaveLength(1);
  });

  it('refreshes again on a later 401, once the first flight has settled', async () => {
    fetchMock
      .mockResolvedValueOnce(reply(401))
      .mockResolvedValueOnce(reply(200))
      .mockResolvedValueOnce(reply(200, { first: true }))
      .mockResolvedValueOnce(reply(401))
      .mockResolvedValueOnce(reply(200))
      .mockResolvedValueOnce(reply(200, { second: true }));

    await expect(apiFetch('/cases')).resolves.toEqual({ first: true });
    await expect(apiFetch('/cases')).resolves.toEqual({ second: true });

    // The single-flight latch must reset, or the session could never renew twice.
    expect(calledPaths().filter((p) => p.includes('/auth/refresh'))).toHaveLength(2);
  });
});
