import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Seconds of remaining life below which a token is treated as already gone. */
const EXPIRY_SKEW = 30;

/**
 * Read `exp` out of a JWT without verifying it.
 *
 * Middleware is not authorising anything here — the API verifies every request
 * — it is only deciding whether to spend a round trip on a refresh. A forged
 * token buys nothing but a refresh attempt that fails on its own merits.
 */
function isExpired(token: string): boolean {
  try {
    const [, payload] = token.split('.');
    const { exp } = JSON.parse(Buffer.from(payload, 'base64').toString()) as { exp?: number };
    if (typeof exp !== 'number') return true;
    return exp - EXPIRY_SKEW <= Math.floor(Date.now() / 1000);
  } catch {
    // Unreadable is as good as expired: let the refresh decide.
    return true;
  }
}

function loginRedirect(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', request.nextUrl.pathname);
  const response = NextResponse.redirect(loginUrl);
  // Drop the dead cookies so the next navigation does not retry the same
  // refresh and land back here.
  response.cookies.delete('access_token');
  response.cookies.delete('refresh_token');
  return response;
}

/**
 * Session gate for authenticated route groups.
 *
 * Access tokens are short-lived, and a server component cannot set cookies, so
 * this is the only place a navigation's session can actually be renewed. If the
 * access token is missing or expired but a refresh token is present, the
 * refresh runs here and the API's `Set-Cookie` headers are passed through — the
 * alternative is bouncing a signed-in user to /login every fifteen minutes.
 *
 * The API still authorises every request; this remains a UX layer.
 */
export async function middleware(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value;
  if (accessToken && !isExpired(accessToken)) {
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get('refresh_token')?.value;
  if (!refreshToken) return loginRedirect(request);

  let refreshed: Response;
  try {
    refreshed = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `refresh_token=${refreshToken}` },
      cache: 'no-store',
    });
  } catch {
    // The API is unreachable. Sending the user to /login would present this as
    // a session problem, which it is not, but there is nothing else to render.
    return loginRedirect(request);
  }

  if (!refreshed.ok) return loginRedirect(request);

  // Carry the rotated cookies back to the browser *and* forward them on this
  // request, so the page being rendered right now sees the new access token
  // rather than the expired one it arrived with.
  const setCookie = refreshed.headers.getSetCookie();
  const renewed = parseCookiePairs(setCookie);

  const headers = new Headers(request.headers);
  if (renewed.size > 0) {
    headers.set(
      'cookie',
      mergeCookieHeader(request.headers.get('cookie') ?? '', renewed),
    );
  }

  const response = NextResponse.next({ request: { headers } });
  for (const cookie of setCookie) {
    response.headers.append('set-cookie', cookie);
  }
  return response;
}

/** `name=value` from each Set-Cookie line, ignoring the attributes. */
function parseCookiePairs(setCookie: string[]): Map<string, string> {
  const pairs = new Map<string, string>();
  for (const line of setCookie) {
    const [pair] = line.split(';');
    const index = pair.indexOf('=');
    if (index > 0) pairs.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
  return pairs;
}

/** Replace renewed cookies in an existing Cookie header, keeping the rest. */
function mergeCookieHeader(existing: string, renewed: Map<string, string>): string {
  const kept = existing
    .split(';')
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && !renewed.has(c.slice(0, c.indexOf('=')).trim()));

  for (const [name, value] of renewed) {
    if (value) kept.push(`${name}=${value}`);
  }
  return kept.join('; ');
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/cases/:path*',
    '/invoices/:path*',
    '/statements/:path*',
    '/profile/:path*',
    '/admin/:path*',
  ],
};
