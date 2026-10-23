// Hall of Shame roasts: one label per entry, from how it ended and how long it lasted.
export const ROASTS = ['ad', 'intro', 'minute', 'tried', 'long', 'veto', 'reported'] as const;
export type Roast = (typeof ROASTS)[number];

export function roastOf(reason: string | undefined, lastedS: number): Roast {
  if (reason === 'reported') return 'reported';
  if (reason === 'vetoed') return 'veto';
  if (lastedS < 5) return 'ad';
  if (lastedS < 20) return 'intro';
  if (lastedS < 60) return 'minute';
  if (lastedS < 180) return 'tried';
  return 'long';
}

/** "4s", "2m 05s". */
export const formatLasted = (s: number) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`);
