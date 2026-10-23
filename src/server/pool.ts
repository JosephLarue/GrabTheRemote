import 'server-only';
import { CANDIDATE_TTL_MIN } from '@/config/app';
import type { Constraint } from '@/config/constraints';
import type { RoomId } from '@/config/rooms';
import type { PoolEntry, VideoMeta } from '@/lib/types';
import { K } from './keys';
import { redis } from './redis';
import { getMeta, toCard } from './youtube';

type Ranked = { id: string; votes: number; first: number };

/** All candidates, best first. Ties: earliest first vote wins. */
async function ranked(room: RoomId): Promise<Ranked[]> {
  const r = redis();
  const flat = await r.zrevrange(K.pool(room), 0, -1, 'WITHSCORES');
  if (flat.length === 0) return [];
  const ids = flat.filter((_, i) => i % 2 === 0);
  const firsts = await r.hmget(K.poolFirst(room), ...ids);
  return ids
    .map((id, i) => ({ id, votes: Number(flat[i * 2 + 1]), first: Number(firsts[i] ?? Date.now()) }))
    .sort((a, b) => b.votes - a.votes || a.first - b.first);
}

export async function addVote(room: RoomId, id: string) {
  const now = Date.now();
  await redis()
    .multi()
    .zincrby(K.pool(room), 1, id)
    .hsetnx(K.poolFirst(room), id, now)
    .zadd(K.poolLast(room), now, id)
    .exec();
}

export async function removeCandidate(room: RoomId, id: string) {
  await redis().multi().zrem(K.pool(room), id).hdel(K.poolFirst(room), id).zrem(K.poolLast(room), id).exec();
}

export async function poolHas(room: RoomId, id: string) {
  return (await redis().zscore(K.pool(room), id)) !== null;
}

/** Drops candidates with no vote for CANDIDATE_TTL_MIN. Returns how many were removed. */
export async function sweepPool(room: RoomId, now = Date.now()) {
  const stale = await redis().zrangebyscore(K.poolLast(room), '-inf', now - CANDIDATE_TTL_MIN * 60_000);
  for (const id of stale) await removeCandidate(room, id);
  return stale.length;
}

export async function poolIds(room: RoomId) {
  return (await ranked(room)).map((r) => r.id);
}

/** Top `n` candidates as client cards, flagged with whether they match the current theme. */
export async function topPool(room: RoomId, n: number, theme: Constraint | null): Promise<PoolEntry[]> {
  const out: PoolEntry[] = [];
  for (const r of await ranked(room)) {
    if (out.length >= n) break;
    const meta = await getMeta(r.id, { allowFetch: false });
    if (!meta || meta.banned || meta.flagged) continue;
    out.push({ ...toCard(meta), votes: r.votes, matchesTheme: theme ? theme.check(meta) : true });
  }
  return out;
}

/** Removes and returns the best playable candidate (its votes are consumed). */
export async function popBest(
  room: RoomId,
  isPlayable: (m: VideoMeta) => Promise<boolean>,
): Promise<{ meta: VideoMeta; votes: number } | null> {
  for (const r of await ranked(room)) {
    await removeCandidate(room, r.id);
    const meta = await getMeta(r.id, { allowFetch: true }).catch(() => null);
    if (meta && (await isPlayable(meta))) return { meta, votes: r.votes };
  }
  return null;
}
