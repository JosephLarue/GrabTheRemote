import { FIGHT_MAX_GAP, FIGHT_MIN_VOTES } from '@/config/app';
import type { PoolEntry } from './types';

/** The top two of the queue when they're neck and neck, else null. The pool comes sorted, leader first. */
export function remoteFight(pool: PoolEntry[]): [PoolEntry, PoolEntry] | null {
  const [a, b] = pool;
  if (!a || !b || b.votes < FIGHT_MIN_VOTES || a.votes - b.votes > FIGHT_MAX_GAP) return null;
  return [a, b];
}
