export const APP_NAME = 'Grab The Remote';
export const APP_TAGLINE = 'One screen. The whole internet. Only one remote.';

// Legal notice (/legal, required in France by the LCEN) and contact for /privacy. Public: fill in before launch.
export const LEGAL = {
  publisher: '[publisher name or company to fill in before launch]',
  publisherAddress: '[publisher address to fill in before launch]',
  publicationDirector: '[publication director to fill in before launch]',
  contactEmail: '[contact email to fill in before launch]',
  host: '[host name to fill in before launch, e.g. Railway Corporation]',
  hostAddress: '[host address to fill in before launch]',
  hostWebsite: '[host website to fill in before launch]',
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
