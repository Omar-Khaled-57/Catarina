import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/archive/'],
      },
    ],
    sitemap: 'https://catarina-devora.vercel.app/sitemap.xml',
    host: 'https://catarina-devora.vercel.app',
  };
}
