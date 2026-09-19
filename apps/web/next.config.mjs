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
   * that origin. The browser only ever talks to its own origin;
   * lib/api/client.ts's relative '/api/...' base and this rewrite are two
   * halves of the same same-origin design. Unlike a NEXT_PUBLIC_* var,
   * API_ORIGIN is never inlined into the client bundle — but it is still
   * resolved once, when this config is loaded to build the routing table
   * (Vercel does this at build time, same as everything else `rewrites()`
   * returns), not freshly per incoming request. Adding or changing it in the
   * Vercel dashboard needs a new deployment to take effect, exactly like a
   * NEXT_PUBLIC_* var would.
   *
   * Unset (the Docker/Caddy/Hostinger alternative, and local dev) means no
   * rewrite is registered — Caddy already does this same job at the infra
   * layer there, and dev talks to the API directly via NEXT_PUBLIC_API_URL.
   */
  async rewrites() {
    const apiOrigin = process.env.API_ORIGIN;
    if (!apiOrigin) {
      // A Vercel production build with no API_ORIGIN silently ships zero
      // rewrites — every /api/* request then 404s on Next's own router
      // instead of reaching the API, and the failure only ever surfaces
      // later as a vague "please try again" in the UI. Fail the build
      // instead, where it is immediately actionable.
      if (process.env.VERCEL_ENV === 'production') {
        throw new Error(
          'API_ORIGIN is not set for this Vercel Production build. Set it in the ' +
            'Vercel dashboard (Project Settings → Environment Variables → Production) ' +
            'to the API origin (e.g. https://apex-dm9i.onrender.com) and redeploy.',
        );
      }
      return [];
    }
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
  },
  /**
   * The Nest app (imported by src/pages/api/[...path].ts) pulls in
   * @nestjs/core, which does its own optional, try/caught `require()` of
   * transports this app never installs or uses (@nestjs/websockets,
   * @nestjs/microservices) so it can support them if present. Webpack's
   * static bundling doesn't know those requires are meant to fail softly and
   * hard-fails the build the moment one resolves to a missing package.
   * Marking @dental/api external sidesteps the whole problem: webpack leaves
   * every `require('@dental/api/...')` as a real runtime require instead of
   * trying to bundle it, so Node's own (successful, try/caught) module
   * resolution handles it exactly as it does for the Docker/Render process.
   */
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push(({ request }, callback) => {
        if (request === '@dental/api' || request.startsWith('@dental/api/')) {
          return callback(null, `commonjs ${request}`);
        }
        callback();
      });
    }
    return config;
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
