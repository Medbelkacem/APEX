import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { middleware } from './middleware';

/** Minimal unsigned JWT — middleware reads `exp` without verifying it. */
function jwt(expiresInSeconds: number): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expiresInSeconds }),
  ).toString('base64url');
  return `header.${payload}.signature`;
}

function requestWith(cookies: Record<string, string>): NextRequest {
  const request = new NextRequest('http://localhost:3000/dashboard');
  for (const [name, value] of Object.entries(cookies)) {
    request.cookies.set(name, value);
  }
  return request;
}

/** A successful refresh, returning rotated cookies the way the API does. */
function refreshOk(): Response {
  return new Response(JSON.stringify({ user: { id: 'u1' } }), {
    status: 200,
    headers: [
      ['set-cookie', 'access_token=fresh-access; Path=/; HttpOnly'],
      ['set-cookie', 'refresh_token=fresh-refresh; Path=/; HttpOnly'],
    ],
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('middleware', () => {
  it('passes a live session straight through', async () => {
    const res = await middleware(requestWith({ access_token: jwt(600) }));

    expect(res.headers.get('location')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('redirects to login when there are no cookies at all', async () => {
    const res = await middleware(requestWith({}));

    expect(res.headers.get('location')).toContain('/login');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the attempted path so login can return the user to it', async () => {
    const res = await middleware(requestWith({}));

    expect(res.headers.get('location')).toContain('next=%2Fdashboard');
  });

  describe('when the access token has expired', () => {
    it('refreshes rather than bouncing the user to login', async () => {
      fetchMock.mockResolvedValueOnce(refreshOk());

      const res = await middleware(
        requestWith({ access_token: jwt(-60), refresh_token: 'valid-refresh' }),
      );

      // A server component cannot set cookies, so this is the only place a
      // navigation's session can be renewed.
      expect(res.headers.get('location')).toBeNull();
      expect(String(fetchMock.mock.calls[0][0])).toContain('/api/auth/refresh');
    });

    it('sends the refresh cookie as the credential', async () => {
      fetchMock.mockResolvedValueOnce(refreshOk());

      await middleware(requestWith({ access_token: jwt(-60), refresh_token: 'valid-refresh' }));

      expect(fetchMock.mock.calls[0][1]).toMatchObject({
        method: 'POST',
        headers: { Cookie: 'refresh_token=valid-refresh' },
      });
    });

    it('passes the rotated cookies back to the browser', async () => {
      fetchMock.mockResolvedValueOnce(refreshOk());

      const res = await middleware(
        requestWith({ access_token: jwt(-60), refresh_token: 'valid-refresh' }),
      );

      const setCookie = res.headers.getSetCookie().join('\n');
      expect(setCookie).toContain('access_token=fresh-access');
      expect(setCookie).toContain('refresh_token=fresh-refresh');
    });

    it('refreshes a token that is merely about to expire', async () => {
      fetchMock.mockResolvedValueOnce(refreshOk());

      // Renewing 10s before expiry avoids handing the page a token that dies
      // mid-render.
      await middleware(requestWith({ access_token: jwt(10), refresh_token: 'valid-refresh' }));

      expect(fetchMock).toHaveBeenCalled();
    });

    it('redirects to login when the refresh is refused', async () => {
      fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }));

      const res = await middleware(
        requestWith({ access_token: jwt(-60), refresh_token: 'spent-refresh' }),
      );

      expect(res.headers.get('location')).toContain('/login');
    });

    it('clears the dead cookies on that redirect', async () => {
      fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }));

      const res = await middleware(
        requestWith({ access_token: jwt(-60), refresh_token: 'spent-refresh' }),
      );

      // Otherwise the next navigation replays the same spent token, which the
      // API treats as theft.
      const setCookie = res.headers.getSetCookie().join('\n');
      expect(setCookie).toContain('access_token=;');
      expect(setCookie).toContain('refresh_token=;');
    });

    it('redirects to login when the API cannot be reached', async () => {
      fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const res = await middleware(
        requestWith({ access_token: jwt(-60), refresh_token: 'valid-refresh' }),
      );

      expect(res.headers.get('location')).toContain('/login');
    });

    it('treats an unreadable token as expired rather than trusting it', async () => {
      fetchMock.mockResolvedValueOnce(refreshOk());

      await middleware(requestWith({ access_token: 'not-a-jwt', refresh_token: 'valid-refresh' }));

      expect(fetchMock).toHaveBeenCalled();
    });
  });
});
