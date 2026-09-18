import { securityHeaders } from './security-headers.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Compile the workspace type/enum package directly from source.
  transpilePackages: ['@dental/shared-types'],
  eslint: {
    // Lint is run as a separate CI step; don't fail production builds on it.
    ignoreDuringBuilds: true,
  },
  /**
   * Vercel + Render deploy: the API is a separate service (API_ORIGIN, e.g.
   * https://apex-dm9i.onrender.com) with no reverse proxy of its own in front
   * of it, so this app supplies one — Next rewrites every /api/* request to
   * that origin, evaluated per-request server-side (never inlined into the
   * client bundle, unlike a NEXT_PUBLIC_* var). The browser only ever talks
   * to its own origin; lib/api/client.ts's relative '/api/...' base and this
   * rewrite are two halves of the same same-origin design.
   *
   * Unset (the Docker/Caddy/Hostinger alternative, and local dev) means no
   * rewrite is registered — Caddy already does this same job at the infra
   * layer there, and dev talks to the API directly via NEXT_PUBLIC_API_URL.
   */
  async rewrites() {
    const apiOrigin = process.env.API_ORIGIN;
    if (!apiOrigin) return [];
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
  },
  async headers() {
    return [
      {
        // Every route, pages and static assets alike — see security-headers.mjs.
        source: '/:path*',
        headers: securityHeaders({
          production: process.env.NODE_ENV === 'production',
          // Same-origin default in production, matching `lib/api/client.ts` —
          // 'self' already covers connect-src for a relative API base, so an
          // unset var here is not a missing origin, it is the same one.
          apiUrl:
            process.env.NEXT_PUBLIC_API_URL ??
            (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000'),
        }),
      },
      {
        /*
         * The worker decides what every other request does, so a cached copy of
         * it pins the whole cache policy to whatever shipped last. Browsers
         * already revalidate worker scripts, but a CDN in front of this app
         * does not know that.
         */
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
