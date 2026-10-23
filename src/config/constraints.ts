import type { VideoMeta } from '@/lib/types';

export type Constraint = {
  id: string;
  label: string;
  emoji: string;
  weight: number;
  check: (v: VideoMeta) => boolean;
};

const DAY_MS = 864e5;

// Every check uses only fields returned by one videos.list call.
export const CONSTRAINTS: Constraint[] = [
  { id: 'short', emoji: '⏱️', label: 'Under 2 minutes', weight: 1, check: (v) => v.durationS <= 120 },
  { id: 'tiny', emoji: '🐜', label: 'Under 30 seconds', weight: 1, check: (v) => v.durationS <= 30 },
  { id: 'hidden-gem', emoji: '💎', label: 'Fewer than 10,000 views', weight: 1, check: (v) => v.viewCount < 10_000 },
  { id: 'mega-hit', emoji: '🚀', label: 'Over 100M views', weight: 1, check: (v) => v.viewCount > 100_000_000 },
  { id: 'vintage', emoji: '📼', label: 'Uploaded before 2012', weight: 1, check: (v) => v.publishedAt < Date.UTC(2012, 0, 1) },
  { id: 'fresh', emoji: '🥖', label: 'Uploaded this week', weight: 1, check: (v) => Date.now() - v.publishedAt < 7 * DAY_MS },
  { id: 'music', emoji: '🎸', label: 'Music only', weight: 1, check: (v) => v.categoryId === '10' },
  { id: 'gaming', emoji: '🎮', label: 'Gaming only', weight: 1, check: (v) => v.categoryId === '20' },
  { id: 'comedy', emoji: '🤡', label: 'Comedy only', weight: 1, check: (v) => v.categoryId === '23' },
  { id: 'one-word', emoji: '☝️', label: 'One-word title', weight: 1, check: (v) => v.title.trim().split(/\s+/).length === 1 },
  {
    id: 'caps',
    emoji: '📢',
    label: 'TITLE IN ALL CAPS',
    weight: 1,
    check: (v) => /[A-Z]/.test(v.title) && v.title === v.title.toUpperCase(),
  },
  { id: 'number', emoji: '🔢', label: 'Title contains a number', weight: 1, check: (v) => /\d/.test(v.title) },
];

export const constraintById = (id: string | null | undefined) => CONSTRAINTS.find((c) => c.id === id);

/** Weighted draw: `null` (no theme) with probability pNone, else one constraint by weight. */
export function drawConstraint(
  pNone: number,
  weights: Record<string, number> = {},
  rand: () => number = Math.random,
): Constraint | null {
  if (rand() < pNone) return null;
  const pool = CONSTRAINTS.map((c) => ({ c, w: weights[c.id] ?? c.weight })).filter((x) => x.w > 0);
  const total = pool.reduce((s, x) => s + x.w, 0);
  if (total <= 0) return null;
  let r = rand() * total;
  for (const x of pool) {
    r -= x.w;
    if (r < 0) return x.c;
  }
  return pool[pool.length - 1].c;
}
