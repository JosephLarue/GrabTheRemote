import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/config/app';
import { ROOM_INFO, ROOMS } from '@/config/rooms';
import { hreflang } from '@/lib/seo';

/**
 * Every public room and its Hall of Fame. /vote is a redirect and the Hall's tabs share /hall's canonical, so
 * neither is listed. No lastModified: a date that is always "now" says nothing to a crawler.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  for (const room of ROOMS) {
    const info = ROOM_INFO[room];
    const pages = info.kind === 'youtube' ? ['', '/hall'] : [''];
    for (const page of pages) {
      entries.push({
        url: `${SITE_URL}/${room}${page}`,
        changeFrequency: page === '' ? 'always' : 'hourly',
        priority: page === '' ? 1 : 0.6,
        ...(info.lang ? { alternates: { languages: hreflang(page) } } : {}),
      });
    }
  }
  entries.push(
    { url: `${SITE_URL}/private`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/legal`, changeFrequency: 'yearly', priority: 0.2 },
  );
  return entries;
}
