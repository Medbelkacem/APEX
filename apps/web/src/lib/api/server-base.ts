/**
 * Absolute API origin for server-side fetches (middleware, Server Components).
 *
 * Unlike the browser, a server-side `fetch` has no "current page" to resolve
 * a relative `/api/...` path against, so it always needs an absolute URL.
 * Prefers `NEXT_PUBLIC_API_URL` when set; otherwise derives the origin from
 * the inbound request itself, since the reverse proxy mounts the API on the
 * same origin the request arrived on — so the derived URL is always correct
 * without hardcoding a domain, and can never fall back to localhost in
 * production.
 */
export function serverApiBase(getHeader: (name: string) => string | null): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured;

  const host = getHeader('x-forwarded-host') ?? getHeader('host');
  if (host) {
    const proto =
      getHeader('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    return `${proto}://${host}`;
  }

  // No Host header at all is not a real HTTP request; fall back to dev's API port.
  return 'http://localhost:4000';
}
