import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://rah-midland.com';

  const staticPages = [
    '',
    '/properties',
    '/login',
    '/register',
    '/privacy-policy',
    '/terms-of-service',
  ];

  return staticPages.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: (path === '' ? 'weekly' : 'monthly') as 'weekly' | 'monthly',
    priority: path === '' ? 1 : 0.8,
  }));
}
