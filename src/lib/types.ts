export type VideoMeta = {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  durationS: number;
  publishedAt: number; // epoch ms
  viewCount: number;
  categoryId: string;
  thumbnailUrl: string;
  embeddable: boolean;
  ageRestricted: boolean;
  /** ISO 639-1 code from YouTube (audio language, else metadata language). null when YouTube doesn't say. */
  audioLanguage: string | null;
  flagged: boolean;
  banned: boolean;
};

/** What the client needs to render a video anywhere. */
export type VideoCard = Pick<VideoMeta, 'id' | 'title' | 'channelTitle' | 'durationS' | 'thumbnailUrl'>;

export type PoolEntry = VideoCard & { votes: number; matchesTheme: boolean };

export type NowPlaying = {
  playId: number;
  video: VideoCard;
  startedAt: number;
  endsAt: number;
  state: 'playing' | 'reported_card';
};

export type Theme = { id: string; label: string; emoji: string } | null;

export type LiveSnapshot = {
  serverNow: number;
  nowPlaying: NowPlaying | null;
  pool: PoolEntry[];
  theme: Theme;
  themeEndsAt: number;
  viewers: number;
  skip: { votes: number; needed: number; cooldownEndsAt: number | null };
  report: { votes: number; needed: number };
  /** Someone stole the remote: they can veto what's playing until `endsAt`. */
  steal: { endsAt: number } | null;
  /** Twitch rooms only. */
  twitch: TwitchLive | null;
};

export type TwitchChannel = {
  login: string;
  name: string;
  title: string;
  game: string;
  /** Null when we can't ask Twitch (no API credentials). */
  viewers: number | null;
};

/** watching → (slot over) deciding → keep: watching again; change: picking → watching the winner. */
export type TwitchPhase = 'watching' | 'deciding' | 'picking';

export type TwitchLive = {
  channel: TwitchChannel | null;
  phase: TwitchPhase;
  phaseEndsAt: number;
  round: number;
  tally: { keep: number; change: number };
  /** Channels voted for in this pick window, most votes first. */
  candidates: (TwitchChannel & { votes: number })[];
  /** Recent channels that are live, offered as one-tap picks. */
  suggestions: TwitchChannel[];
};

/** Reactions sent since the last batch: emoji → count. */
export type ReactionBatch = Record<string, number>;

export type LiveEvent =
  | { type: 'snapshot'; data: LiveSnapshot }
  | { type: 'nowplaying'; data: NowPlaying | null }
  | { type: 'pool'; data: PoolEntry[] }
  | { type: 'theme'; data: { theme: Theme; themeEndsAt: number; pool: PoolEntry[] } }
  | { type: 'viewers'; data: number }
  | { type: 'skip'; data: LiveSnapshot['skip'] }
  | { type: 'report'; data: LiveSnapshot['report'] }
  | { type: 'steal'; data: LiveSnapshot['steal'] }
  | { type: 'react'; data: ReactionBatch }
  | { type: 'twitch'; data: TwitchLive };
