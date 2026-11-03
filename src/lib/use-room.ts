'use client';

import { usePathname } from 'next/navigation';
import { ROOM_COOKIE, type RoomId, isPublicRoom, isRoom } from '@/config/rooms';
import { useClientValue } from './use-client-value';

const COOKIE_RE = new RegExp(`(?:^|; )${ROOM_COOKIE}=([^;]*)`);
const readCookie = () => document.cookie.match(COOKIE_RE)?.[1] ?? null;

/**
 * `room`: the room in the URL, null outside one (/privacy, /legal…). `ui`: the public room whose language to speak,
 * which outside a room is the last one visited. `initial` comes from the server render (lastRoom()); the root
 * layout doesn't re-render on client navigation, so the cookie is re-read whenever the path changes.
 */
export function useRoom(initial: RoomId): { room: RoomId | null; ui: RoomId } {
  const path = usePathname();
  const first = path.split('/')[1];
  const room = isRoom(first) ? first : null;
  // Re-read on every render, so a navigation (new `path`) picks up the cookie the proxy just set.
  const cookie = useClientValue(readCookie, null);
  const saved = isRoom(cookie) ? cookie : initial;
  // A private room's language is in its settings, which only its own pages know: elsewhere, the last public room's.
  return { room, ui: room && isPublicRoom(room) ? room : saved };
}
