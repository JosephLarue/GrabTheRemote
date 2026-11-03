import { SITE_URL } from '@/config/app';
import { DEFAULT_ROOM, ROOM_INFO, ROOMS, type RoomId, isPublicRoom } from '@/config/rooms';

/** The public rooms that speak one language: the hreflang set. */
export const LANGUAGE_ROOMS = ROOMS.filter((r) => ROOM_INFO[r].lang);

/**
 * hreflang map for a page every language room has: `/<room><path>` per language, x-default on the English room.
 * Used by the room layout, the Hall and the sitemap, so the three agree.
 */
export function hreflang(path = ''): Record<string, string> {
  return {
    ...Object.fromEntries(LANGUAGE_ROOMS.map((r) => [ROOM_INFO[r].lang as string, `${SITE_URL}/${r}${path}`])),
    'x-default': `${SITE_URL}/${DEFAULT_ROOM}${path}`,
  };
}

/**
 * `alternates` for a page under a room: its own canonical (query string dropped) and, in a language room, the
 * hreflang set for the same page. Next merges a page's `alternates` over the layout's, so every page that is not
 * the room's root has to return its own, else it claims the root's canonical.
 */
export function roomAlternates(room: RoomId, path = '') {
  const canonical = `${SITE_URL}/${room}${path}`;
  return { canonical, ...(isPublicRoom(room) && ROOM_INFO[room].lang ? { languages: hreflang(path) } : {}) };
}
