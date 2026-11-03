import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/config/app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // The API, the admin, private rooms and the per-card PNGs have nothing to index.
        disallow: ['/api/', '/admin', '/p-', '/*/shame/*/card'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
