/**
 * Absolute API origin for server-side fetches (middleware, Server Components).
 *
 * Unlike the browser, a server-side `fetch` has no "current page" to resolve
 * a relative `/api/...` path against, so it always needs an absolute URL.
 *
 * Prefers `API_ORIGIN` — the API's real address (e.g. a Render URL) behind
 * the `next.config.mjs` rewrite proxy. Going straight there instead of back
 * through this app's own public origin (which would just get rewritten to
 * the same place) saves a hop; it's a server-only var so it's never bundled
 * to the client, unlike `NEXT_PUBLIC_API_URL`, which is checked next for the
 * Docker/Caddy/Hostinger alternative where the API had its own public origin.
 * With neither set, the origin is derived from the inbound request itself,
 * since a same-origin reverse proxy (Caddy, or this Next app's own rewrite)
 * mounts the API on whatever origin the request arrived on — so the derived
 * URL is always correct without hardcoding a domain, and can never fall back
 * to localhost in production.
 */
export function serverApiBase(getHeader: (name: string) => string | null): string {
  const configured = process.env.API_ORIGIN ?? process.env.NEXT_PUBLIC_API_URL;
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
