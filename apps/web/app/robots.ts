import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/dev-login', '/settings'],
      },
    ],
    sitemap: 'https://rah-midland.com/sitemap.xml',
  };
}
