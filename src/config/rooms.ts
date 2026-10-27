// Every room is its own screen: own queue, playback, skip/report, viewers, vote cooldown and Hall of Fame.
// Themes are shared by all rooms. `lang` is the room's language (ISO 639-1); null means anything goes
// (The Jungle). `language` is its English name, for messages. `wall` and `tv` are its wallpaper and TV
// colours (browser theme-color, share card); the rest of its look lives in globals.css under [data-room].
// `kind` is what the room plays: YouTube videos the crowd queues up, or a Twitch stream the crowd keeps or changes.
// Private rooms (`p-xxxxxx`) are created by streamers at runtime: their settings live in Redis (server/private-rooms).
export const ROOMS = ['en', 'fr', 'es', 'it', 'jungle', 'twitch'] as const;
export type PublicRoomId = (typeof ROOMS)[number];
export type PrivateRoomId = `p-${string}`;
export type RoomId = PublicRoomId | PrivateRoomId;

type RoomInfo = {
  kind: 'youtube' | 'twitch';
  name: string;
  emoji: string;
  lang: string | null;
  language: string | null;
  wall: string;
  tv: string;
};

export const ROOM_INFO: Record<PublicRoomId, RoomInfo> = {
  en: { kind: 'youtube', name: 'English', emoji: '🇬🇧', lang: 'en', language: 'English', wall: '#33404f', tv: '#e03a3e' },
  fr: { kind: 'youtube', name: 'Français', emoji: '🇫🇷', lang: 'fr', language: 'French', wall: '#6e1f3f', tv: '#ff9bb3' },
  es: { kind: 'youtube', name: 'Español', emoji: '🇪🇸', lang: 'es', language: 'Spanish', wall: '#1f4fb5', tv: '#ff8a3d' },
  it: { kind: 'youtube', name: 'Italiano', emoji: '🇮🇹', lang: 'it', language: 'Italian', wall: '#b3343c', tv: '#ffe45c' },
  jungle: { kind: 'youtube', name: 'The Jungle', emoji: '🌴', lang: null, language: null, wall: '#14532d', tv: '#ff7a1a' },
  twitch: { kind: 'twitch', name: 'Twitch', emoji: '🟣', lang: null, language: null, wall: '#1f1240', tv: '#9146ff' },
};

export const DEFAULT_ROOM: PublicRoomId = 'en';
/** Remembers the last room visited, so /, /vote and /hall send people back to it. */
export const ROOM_COOKIE = 'gtr_room';
/** Set by the middleware on every request: the URL's room, else the last room, else the browser's language. */
export const ROOM_HEADER = 'x-gtr-room';

export const isPublicRoom = (s: unknown): s is PublicRoomId => (ROOMS as readonly unknown[]).includes(s);

/** Shape only: whether a private room exists (and who may enter) is the server's call. */
export const isPrivateRoom = (s: unknown): s is PrivateRoomId => typeof s === 'string' && /^p-[a-z0-9]{6}$/.test(s);

export const isRoom = (s: unknown): s is RoomId => isPublicRoom(s) || isPrivateRoom(s);

/** Private rooms always play YouTube. */
export const isTwitchRoom = (room: RoomId) => isPublicRoom(room) && ROOM_INFO[room].kind === 'twitch';

/** Public rooms a private room can borrow its look from. */
export const DECORS = ROOMS.filter((r) => ROOM_INFO[r].kind === 'youtube');

/**
 * Language rule: a language room only refuses videos YouTube says are in another language.
 * Unknown language passes (many videos don't declare one), and The Jungle takes anything.
 */
export function fitsLanguage(lang: string | null, videoLanguage: string | null | undefined): boolean {
  return !lang || !videoLanguage || videoLanguage === lang;
}

export const fitsRoomLanguage = (room: PublicRoomId, videoLanguage: string | null | undefined) =>
  fitsLanguage(ROOM_INFO[room].lang, videoLanguage);

/** Best language room for an Accept-Language header ("fr-FR,fr;q=0.9,en;q=0.8"), else DEFAULT_ROOM. */
export function roomFromAcceptLanguage(header: string | null): PublicRoomId {
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
