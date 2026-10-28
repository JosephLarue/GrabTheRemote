import { PRELOAD_SHARE, PRELOAD_WINDOW_S } from '@/config/app';
import type { NowPlaying, PoolEntry } from './types';

/**
 * The video to cue up on the standby player: the queue's leader when it is all but certain to play next
 * (PRELOAD_SHARE of the top-two votes, or alone with a vote) and the current video ends within PRELOAD_WINDOW_S.
 */
export function preloadCandidate(pool: PoolEntry[], np: NowPlaying | null, now: number): string | null {
  if (!np || np.state !== 'playing' || np.pausedAt || np.endsAt - now > PRELOAD_WINDOW_S * 1000) return null;
  const [a, b] = pool;
  if (!a || a.votes < 1 || !a.matchesTheme) return null;
  if (b && a.votes / (a.votes + b.votes) < PRELOAD_SHARE) return null;
  return a.id === np.video.id ? null : a.id;
}
