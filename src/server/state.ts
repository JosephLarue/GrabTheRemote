import 'server-only';
import { EventEmitter } from 'node:events';
import { PRESENCE_WINDOW_S, reportThreshold, skipThreshold } from '@/config/app';
import type { LiveEvent, LiveSnapshot, NowPlaying } from '@/lib/types';
import { K } from './keys';
import { topPool } from './pool';
import { redis, redisSub } from './redis';
import { currentTheme, slotEndsAt, slotId, toTheme } from './themes';

export const POOL_SIZE = 10;

export async function getNowPlaying(): Promise<NowPlaying | null> {
  const raw = await redis().get(K.nowPlaying);
  return raw ? (JSON.parse(raw) as NowPlaying) : null;
}

export async function setNowPlaying(np: NowPlaying) {
  await redis().set(K.nowPlaying, JSON.stringify(np));
}

export async function touchPresence(clientId: string) {
  await redis().zadd(K.presence, Date.now(), clientId);
}

export async function dropPresence(clientId: string) {
  await redis().zrem(K.presence, clientId);
}

export async function viewerCount() {
  const since = Date.now() - PRESENCE_WINDOW_S * 1000;
  await redis().zremrangebyscore(K.presence, '-inf', since);
  return redis().zcard(K.presence);
}

export async function skipState(playId: number | undefined, viewers: number): Promise<LiveSnapshot['skip']> {
  const [votes, pttl] = await Promise.all([
    playId ? redis().scard(K.skipVotes(playId)) : 0,
    redis().pttl(K.skipGlobalCd),
  ]);
  return { votes, needed: skipThreshold(viewers), cooldownEndsAt: pttl > 0 ? Date.now() + pttl : null };
}

export async function reportState(playId: number | undefined, viewers: number): Promise<LiveSnapshot['report']> {
  const votes = playId ? await redis().scard(K.reportVotes(playId)) : 0;
  return { votes, needed: reportThreshold(viewers) };
}

export async function poolForClients() {
  return topPool(POOL_SIZE, await currentTheme());
}

export async function snapshot(): Promise<LiveSnapshot> {
  const [nowPlaying, theme, viewers] = await Promise.all([getNowPlaying(), currentTheme(), viewerCount()]);
  const [pool, skip, report] = await Promise.all([
    topPool(POOL_SIZE, theme),
    skipState(nowPlaying?.playId, viewers),
    reportState(nowPlaying?.playId, viewers),
  ]);
  return {
    serverNow: Date.now(),
    nowPlaying,
    pool,
    theme: toTheme(theme),
    themeEndsAt: slotEndsAt(slotId()),
    viewers,
    skip,
    report,
  };
}

export async function publish(event: LiveEvent) {
  await redis().publish(K.events, JSON.stringify(event));
}

/** Pool changes are coalesced: routes mark dirty, the ticker publishes at most once per second. */
export async function markPoolDirty() {
  await redis().set(K.poolDirty, '1');
}

// One Redis subscription per process, fanned out to every open SSE stream.
const g = globalThis as unknown as { __bus?: EventEmitter };

export function bus() {
  if (!g.__bus) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    const sub = redisSub();
    sub.subscribe(K.events).catch((e) => console.error('[bus] subscribe failed', e));
    sub.on('message', (_ch, msg) => emitter.emit('event', msg));
    g.__bus = emitter;
  }
  return g.__bus;
}
