import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/config/app';
import { ROOM_INFO, ROOMS } from '@/config/rooms';

// Public rooms and their pages. Private rooms (p-xxxxxx) and the admin are out on purpose.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const youtubeRooms = ROOMS.filter((r) => ROOM_INFO[r].kind === 'youtube');
  const languages = Object.fromEntries(youtubeRooms.map((r) => [ROOM_INFO[r].lang ?? 'x-default', `${SITE_URL}/${r}`]));
  const entries: MetadataRoute.Sitemap = [];
  for (const room of ROOMS) {
    const pages = ROOM_INFO[room].kind === 'youtube' ? ['', '/vote', '/hall', '/hall?tab=shame'] : [''];
    for (const page of pages) {
      entries.push({
        url: `${SITE_URL}/${room}${page}`,
        lastModified: now,
        changeFrequency: page === '' ? 'always' : page.startsWith('/hall') ? 'hourly' : 'daily',
        priority: page === '' ? 1 : page === '/vote' ? 0.8 : 0.6,
        // Language rooms are translations of each other; the Jungle and Twitch stand alone.
        ...(page === '' && ROOM_INFO[room].lang ? { alternates: { languages } } : {}),
      });
    }
  }
  entries.push(
    { url: `${SITE_URL}/private`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/legal`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  );
  return entries;
}
