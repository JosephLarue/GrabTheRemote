// Every room is its own screen: own queue, playback, skip/report, viewers, vote cooldown and Hall of Fame.
// Themes are shared by all rooms. `lang` is the room's language; null means anything goes (The Jungle).
export const ROOMS = ['en', 'fr', 'es', 'it', 'jungle'] as const;
export type RoomId = (typeof ROOMS)[number];

export const ROOM_INFO: Record<RoomId, { name: string; emoji: string; lang: string | null }> = {
  en: { name: 'English', emoji: '🇬🇧', lang: 'en' },
  fr: { name: 'Français', emoji: '🇫🇷', lang: 'fr' },
  es: { name: 'Español', emoji: '🇪🇸', lang: 'es' },
  it: { name: 'Italiano', emoji: '🇮🇹', lang: 'it' },
  jungle: { name: 'The Jungle', emoji: '🌴', lang: null },
};

export const DEFAULT_ROOM: RoomId = 'en';
/** Remembers the last room visited, so /, /vote and /hall send people back to it. */
export const ROOM_COOKIE = 'gtr_room';

export const isRoom = (s: unknown): s is RoomId => (ROOMS as readonly unknown[]).includes(s);

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
