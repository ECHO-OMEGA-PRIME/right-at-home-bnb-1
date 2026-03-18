/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['lucide-react'],
  images: {
    domains: [
      'localhost',
      'rightathomebnb.com',
      'rah-midland.com',
      'images.unsplash.com',
      'lh3.googleusercontent.com',
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['twilio'],
  },
};

module.exports = nextConfig;
