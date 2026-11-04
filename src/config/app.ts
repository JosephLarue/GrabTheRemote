export const APP_NAME = 'Grab The Remote';
export const APP_TAGLINE = 'One screen. The whole internet. Only one remote.';
/** Tips page, linked from the footer. */
export const COFFEE_URL = 'https://buymeacoffee.com/jozyjozy';
/** Public URL, no trailing slash. Read at build time (NEXT_PUBLIC_*); sitemap, robots and canonical links use it. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
/** The room's search snippet carries the live couch count from this many viewers: "1 on the couch" invites nobody. */
export const SEO_COUCH_MIN = 3;
/** Rows per Hall of Fame tab. */
export const HALL_TOP = 10;

// Legal notice (/legal, required in France by the LCEN) and contact for /privacy. Public.
export const LEGAL = {
  publisher: 'Joseph Larue',
  publisherAddress: 'Paris, France',
  publicationDirector: 'Joseph Larue',
  contactEmail: 'joseph.larue@edhec.com',
  // From memory: check against railway.com's legal pages before launch.
  host: 'Railway Corporation',
  hostAddress: '548 Market St PMB 68956, San Francisco, CA 94104, USA',
  hostWebsite: 'https://railway.com',
};

// Queue + voting. Public rooms accept videos of any length; private rooms pick theirs (PRIVATE_MAX_DURATIONS_MIN).
export const VOTE_COOLDOWN_S = 900;
export const CANDIDATE_TTL_MIN = 60;

// Themes. Kill switch: false means no draw, no banner, no theme settings, every video is accepted (private rooms too).
export const THEMES_ENABLED = false;
export const THEME_SLOT_S = 900;
export const P_NO_CONSTRAINT = 0.5;

// Skip (cooldown applies to the whole room)
export const SKIP_MIN = 3;
export const SKIP_RATIO = 0.5;
export const SKIP_COOLDOWN_S = 1800;

// Mass report
export const REPORT_MIN = 5;
export const REPORT_RATIO = 0.1;
export const REPORT_CARD_S = 8;
/** Skip/report vote sets outlive a play only when its room vanished under it; they're swept after this. */
export const VOTE_SETS_TTL_S = 24 * 3600;

// YouTube Data API quota (10k units/day)
export const YT_QUOTA_SOFT = 8000;
export const YT_QUOTA_HARD = 9500;
export const META_STALE_H = 24;
/** Upstream calls (YouTube, Turnstile) give up after this long, so a slow provider can't pin requests. */
export const UPSTREAM_TIMEOUT_MS = 5000;

// Live state
export const PRESENCE_WINDOW_S = 30;
export const STATIC_TRANSITION_MS = 1200;
/** Open SSE streams one IP may hold at once (a few tabs, not a bot farm). */
export const MAX_STREAMS_PER_IP = 6;
/** Health reports the ticker stale when no tick ran for this long. */
export const TICKER_STALE_MS = 10_000;
/** From this many viewers, "on the couch" becomes "the couch is collapsing". */
export const COUCH_COLLAPSE_AT = 1000;

// Remote fight: the top two of the queue are this close, each with at least FIGHT_MIN_VOTES.
export const FIGHT_MAX_GAP = 1;
export const FIGHT_MIN_VOTES = 2;

// Stolen remote: once per STEAL_EVERY_S, at a random moment, one voter who is watching gets a veto.
export const STEAL_EVERY_S = 3600;
export const STEAL_HOLD_S = 60;
/** Only people who voted this recently can be picked. */
export const STEAL_VOTER_WINDOW_S = 3600;

// Twitch room: a stream plays for a slot, then the couch votes to keep it or change it. If "change" wins, a
// short pick window opens (random length, so nobody can time it) and the most-voted live channel takes over.
export const TWITCH_SLOT_S = 600;
export const TWITCH_DECIDE_S = 30;
export const TWITCH_PICK_MIN_S = 5;
export const TWITCH_PICK_MAX_S = 20;
/** Keep vs change this close (each side counted) and the deciding panel starts sweating. */
export const TWITCH_CLOSE_GAP = 1;
/** How often the current stream is checked: offline means a pick window opens right away. */
export const TWITCH_LIVE_CHECK_S = 60;
/** Twitch content classification labels that keep a channel out of the room. */
export const TWITCH_BLOCKED_LABELS = ['SexualThemes', 'Gambling', 'DrugsIntoxication', 'ViolentGraphic'];

// Private rooms: made by streamers, entered with an ID and a password, gone after a day with nobody watching.
export const PRIVATE_IDLE_TTL_S = 24 * 3600;
/** What a streamer can pick from. */
export const PRIVATE_MAX_DURATIONS_MIN = [1, 3, 5, 10, 15, 30, 60];
export const PRIVATE_VOTE_COOLDOWNS_S = [30, 60, 120, 300, 900];
export const PRIVATE_LOCALES = ['en', 'fr', 'es', 'it'];
export const PRIVATE_LANGS = ['en', 'fr', 'es', 'it'];

// Invite a friend: bring INVITE_FRIENDS new viewers to a room within INVITE_WINDOW_S and vote every
// INVITE_BOOST_COOLDOWN_S instead of the room's cooldown for INVITE_BOOST_S. A newcomer counts once they have
// watched for INVITE_CLAIM_AFTER_S, and each connection can be somebody's friend once per INVITE_CLAIMED_TTL_S.
export const INVITE_FRIENDS = 3;
export const INVITE_WINDOW_S = 24 * 3600;
export const INVITE_BOOST_COOLDOWN_S = 300;
export const INVITE_BOOST_S = 3600;
export const INVITE_CLAIM_AFTER_S = 45;
export const INVITE_CLAIMED_TTL_S = 30 * 86400;

// Next video preload: when the leader of the queue has this share of the top-two votes (and the video ends
// within PRELOAD_WINDOW_S), everyone's player cues it up so the switch is instant.
export const PRELOAD_SHARE = 0.6;
export const PRELOAD_WINDOW_S = 60;

// Easter eggs: each one fires at most once per EGG_COOLDOWN_S per browser, and lasts EGG_DURATION_MS.
export const EGG_COOLDOWN_S = 3600;
export const EGG_DURATION_MS = 10_000;

// Couch reactions: a fixed set (nothing to moderate), batched before going out to every viewer.
export const REACTIONS = ['😂', '💀', '🔥', '😍', '🤮', '👏'] as const;
export const REACTION_BATCH_MS = 300;
// Each viewer gets this many reactions per window: enough to cheer, not enough to paper the screen.
export const REACTION_MAX_PER_WINDOW = 5;
export const REACTION_WINDOW_S = 60;

// Couch chat: no accounts, a random nickname per tab. Only the last few messages are kept, and not for long.
export const CHAT_MAX_LENGTH = 200;
export const CHAT_HISTORY = 50;
export const CHAT_TTL_S = 3600;

// Played when the pool is empty and the Hall of Fame has nothing yet.
export const FALLBACK_VIDEOS = [
  'dQw4w9WgXcQ',
  'jNQXAC9IVRw',
  'ZZ5LpwO-An4',
  'kffacxfA7G4',
  '9bZkp7q19f0',
];

export const skipThreshold = (viewers: number) => Math.max(SKIP_MIN, Math.ceil(SKIP_RATIO * viewers));
export const reportThreshold = (viewers: number) => Math.max(REPORT_MIN, Math.ceil(REPORT_RATIO * viewers));
