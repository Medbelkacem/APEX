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
  async headers() {
    return [
      {
        // Every route, pages and static assets alike — see security-headers.mjs.
        source: '/:path*',
        headers: securityHeaders({
          production: process.env.NODE_ENV === 'production',
          apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
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
