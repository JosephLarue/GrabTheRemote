export const APP_NAME = 'Grab The Remote';
export const APP_TAGLINE = 'One screen. The whole internet. Only one remote.';

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

// Queue + voting
export const MAX_DURATION_S = 900;
export const VOTE_COOLDOWN_S = 900;
export const CANDIDATE_TTL_MIN = 60;

// Themes. Kill switch: false means no draw, no banner, every video is accepted.
export const THEMES_ENABLED = true;
export const THEME_SLOT_S = 900;
export const P_NO_CONSTRAINT = 0.5;

// Skip (cooldown applies to the whole room)
export const SKIP_MIN = 3;
export const SKIP_RATIO = 0.5;
export const SKIP_COOLDOWN_S = 1800;

// Mass report
export const REPORT_MIN = 3;
export const REPORT_RATIO = 0.1;
export const REPORT_CARD_S = 8;

// YouTube Data API quota (10k units/day)
export const YT_QUOTA_SOFT = 8000;
export const YT_QUOTA_HARD = 9500;
export const META_STALE_H = 24;

// Live state
export const PRESENCE_WINDOW_S = 30;
export const STATIC_TRANSITION_MS = 1200;
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

// Couch reactions: a fixed set (nothing to moderate), batched before going out to every viewer.
export const REACTIONS = ['😂', '💀', '🔥', '😍', '🤮', '👏'] as const;
export const REACTION_BATCH_MS = 300;

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
