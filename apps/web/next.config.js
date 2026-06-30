/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: ['lucide-react'],
  images: {
    domains: [
      'localhost',
      'rah-midland.com',
      'images.unsplash.com',
      'lh3.googleusercontent.com',
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['twilio'],
  },
  async redirects() {
    return [
      // Legacy address-based slugs → SEO-friendly slugs (permanent)
      { source: '/properties/Lanham-1426', destination: '/properties/posh-private-1426', permanent: true },
      { source: '/properties/Humble-3106', destination: '/properties/outdoor-dream-3106', permanent: true },
      { source: '/properties/Daventry-1311', destination: '/properties/santiago-dreams-1311', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), payment=(self)',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com https://*.firebaseio.com https://*.googleapis.com https://js.stripe.com https://www.paypal.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https://images.unsplash.com https://lh3.googleusercontent.com https://*.rah-midland.com",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://*.firebase.google.com https://api.stripe.com https://api.paypal.com wss://*.firebaseio.com https://sdk1.echo-op.com https://api.rah-midland.com https://*.echo-op.com https://*.rah-midland.com",
              "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com https://js.stripe.com https://www.paypal.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
