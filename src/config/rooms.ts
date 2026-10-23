// Every room is its own screen: own queue, playback, skip/report, viewers, vote cooldown and Hall of Fame.
// Themes are shared by all rooms. `lang` is the room's language (ISO 639-1); null means anything goes
// (The Jungle). `language` is its English name, for messages. `wall` is the room's wallpaper colour
// (browser theme-color); the rest of its look lives in globals.css under [data-room].
export const ROOMS = ['en', 'fr', 'es', 'it', 'jungle'] as const;
export type RoomId = (typeof ROOMS)[number];

type RoomInfo = { name: string; emoji: string; lang: string | null; language: string | null; wall: string };

export const ROOM_INFO: Record<RoomId, RoomInfo> = {
  en: { name: 'English', emoji: '🇬🇧', lang: 'en', language: 'English', wall: '#33404f' },
  fr: { name: 'Français', emoji: '🇫🇷', lang: 'fr', language: 'French', wall: '#6e1f3f' },
  es: { name: 'Español', emoji: '🇪🇸', lang: 'es', language: 'Spanish', wall: '#1f4fb5' },
  it: { name: 'Italiano', emoji: '🇮🇹', lang: 'it', language: 'Italian', wall: '#b3343c' },
  jungle: { name: 'The Jungle', emoji: '🌴', lang: null, language: null, wall: '#14532d' },
};

export const DEFAULT_ROOM: RoomId = 'en';
/** Remembers the last room visited, so /, /vote and /hall send people back to it. */
export const ROOM_COOKIE = 'gtr_room';

export const isRoom = (s: unknown): s is RoomId => (ROOMS as readonly unknown[]).includes(s);

/**
 * Language rule: a language room only refuses videos YouTube says are in another language.
 * Unknown language passes (many videos don't declare one), and The Jungle takes anything.
 */
export function fitsRoomLanguage(room: RoomId, videoLanguage: string | null | undefined): boolean {
  const lang = ROOM_INFO[room].lang;
  return !lang || !videoLanguage || videoLanguage === lang;
}

/** Best language room for an Accept-Language header ("fr-FR,fr;q=0.9,en;q=0.8"), else DEFAULT_ROOM. */
export function roomFromAcceptLanguage(header: string | null): RoomId {
  const langs = (header ?? '')
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return { lang: tag.split('-')[0].toLowerCase(), q: q ? Number(q.slice(2)) || 0 : 1 };
    })
    .filter((l) => l.lang && l.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { lang } of langs) {
    const room = ROOMS.find((r) => ROOM_INFO[r].lang === lang);
    if (room) return room;
  }
  return DEFAULT_ROOM;
}
