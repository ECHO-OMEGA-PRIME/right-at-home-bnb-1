/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost', 'rightathomebnb.com', 'rah-midland.com'],
  },
  // Mark twilio as server-only external - it's only used in API routes
  serverExternalPackages: ['twilio'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
