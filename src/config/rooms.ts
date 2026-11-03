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

/**
 * Looks a room can wear: CSS variables under `[data-room="<decor>"]` in globals.css. `wall` and `tv` are the
 * wallpaper and TV colours, for the share cards and the browser's theme colour. The first ones are the public
 * rooms' own; `alliance` and `horde` are the two faces of The Jungle. All but `twitch` are open to private rooms.
 */
export const DECORS = ['en', 'fr', 'es', 'it', 'jungle', 'alliance', 'horde'] as const;
export type Decor = (typeof DECORS)[number] | 'twitch';
/** The Jungle's two looks, drawn at random on each visit. */
export const FACTIONS = ['alliance', 'horde'] as const satisfies readonly Decor[];

/** A look a private room may pick (every decor but the Twitch room's). */
export type DecorPick = (typeof DECORS)[number];
export const isDecorPick = (d: Decor): d is DecorPick => (DECORS as readonly Decor[]).includes(d);

export const DECOR_INFO: Record<Decor, { name: string; emoji: string; wall: string; tv: string }> = {
  en: { name: 'London', emoji: '🇬🇧', wall: '#33404f', tv: '#e03a3e' },
  fr: { name: 'Bistro', emoji: '🇫🇷', wall: '#6e1f3f', tv: '#ff9bb3' },
  es: { name: 'Azulejos', emoji: '🇪🇸', wall: '#1f4fb5', tv: '#ff8a3d' },
  it: { name: 'Trattoria', emoji: '🇮🇹', wall: '#b3343c', tv: '#ffe45c' },
  jungle: { name: 'Jungle', emoji: '🌴', wall: '#14532d', tv: '#ff7a1a' },
  alliance: { name: 'Alliance', emoji: '🦁', wall: '#4a5468', tv: '#1f4fa8' },
  horde: { name: 'Horde', emoji: '🪓', wall: '#2b1410', tv: '#8a1612' },
  twitch: { name: 'Twitch', emoji: '🟣', wall: '#1f1240', tv: '#9146ff' },
};

type RoomInfo = {
  kind: 'youtube' | 'twitch';
  name: string;
  emoji: string;
  lang: string | null;
  language: string | null;
  /** The room's look; `faction` draws Alliance or Horde on each visit (see `decorOf`). */
  decor: Decor | 'faction';
};

export const ROOM_INFO: Record<PublicRoomId, RoomInfo> = {
  en: { kind: 'youtube', name: 'English', emoji: '🇬🇧', lang: 'en', language: 'English', decor: 'en' },
  fr: { kind: 'youtube', name: 'Français', emoji: '🇫🇷', lang: 'fr', language: 'French', decor: 'fr' },
  es: { kind: 'youtube', name: 'Español', emoji: '🇪🇸', lang: 'es', language: 'Spanish', decor: 'es' },
  it: { kind: 'youtube', name: 'Italiano', emoji: '🇮🇹', lang: 'it', language: 'Italian', decor: 'it' },
  jungle: { kind: 'youtube', name: 'The Jungle', emoji: '🌴', lang: null, language: null, decor: 'faction' },
  twitch: { kind: 'twitch', name: 'Twitch', emoji: '🟣', lang: null, language: null, decor: 'twitch' },
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
