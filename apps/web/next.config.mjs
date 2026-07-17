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
};

export default nextConfig;
