import { NextRequest, NextResponse } from 'next/server';

/**
 * Presence-gate for authenticated route groups. The session cookie is HttpOnly,
 * so middleware can only check that it exists — the API enforces real authz on
 * every request. Unauthenticated users are bounced to /login with a return path.
 */
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has('access_token');
  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
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
