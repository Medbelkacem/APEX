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
   * The API is served natively by this app on Vercel now — src/pages/api/
   * [...path].ts boots the same Nest app in a serverless function on this
   * project's own origin, so /api/* needs no rewrite by default.
   *
   * API_ORIGIN survives purely as an escape hatch: if it's set, /api/* is
   * proxied to that origin instead (e.g. back to the old Render service),
   * which is only worth doing to roll back the serverless API without a code
   * revert. Unlike a NEXT_PUBLIC_* var it is never inlined into the client
   * bundle, but it is still resolved once at build time (same as everything
   * else `rewrites()` returns) — changing it in the Vercel dashboard needs a
   * new deployment to take effect. Also doubles as the Docker/Caddy/Hostinger
   * path's own setting, where Caddy fronts the API directly and dev talks to
   * it via NEXT_PUBLIC_API_URL instead.
   */
  async rewrites() {
    const apiOrigin = process.env.API_ORIGIN;
    if (!apiOrigin) return [];
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
