import 'server-only';
import { EventEmitter } from 'node:events';
import { PRESENCE_WINDOW_S, reportThreshold, skipThreshold } from '@/config/app';
import type { RoomId } from '@/config/rooms';
import type { LiveEvent, LiveSnapshot, NowPlaying } from '@/lib/types';
import { K } from './keys';
import { topPool } from './pool';
import { redis, redisSub } from './redis';
import { currentTheme, slotEndsAt, slotId, toTheme } from './themes';

export const POOL_SIZE = 10;

export async function getNowPlaying(room: RoomId): Promise<NowPlaying | null> {
  const raw = await redis().get(K.nowPlaying(room));
  return raw ? (JSON.parse(raw) as NowPlaying) : null;
}

export async function setNowPlaying(room: RoomId, np: NowPlaying) {
  await redis().set(K.nowPlaying(room), JSON.stringify(np));
}

export async function touchPresence(room: RoomId, clientId: string) {
  await redis().zadd(K.presence(room), Date.now(), clientId);
}

export async function dropPresence(room: RoomId, clientId: string) {
  await redis().zrem(K.presence(room), clientId);
}

export async function viewerCount(room: RoomId) {
  const since = Date.now() - PRESENCE_WINDOW_S * 1000;
  await redis().zremrangebyscore(K.presence(room), '-inf', since);
  return redis().zcard(K.presence(room));
}

export async function skipState(
  room: RoomId,
  playId: number | undefined,
  viewers: number,
): Promise<LiveSnapshot['skip']> {
  const [votes, pttl] = await Promise.all([
    playId ? redis().scard(K.skipVotes(playId)) : 0,
    redis().pttl(K.skipCd(room)),
  ]);
  return { votes, needed: skipThreshold(viewers), cooldownEndsAt: pttl > 0 ? Date.now() + pttl : null };
}

export async function reportState(playId: number | undefined, viewers: number): Promise<LiveSnapshot['report']> {
  const votes = playId ? await redis().scard(K.reportVotes(playId)) : 0;
  return { votes, needed: reportThreshold(viewers) };
}

export async function poolForClients(room: RoomId) {
  return topPool(room, POOL_SIZE, await currentTheme());
}

export async function snapshot(room: RoomId): Promise<LiveSnapshot> {
  const [nowPlaying, theme, viewers] = await Promise.all([getNowPlaying(room), currentTheme(), viewerCount(room)]);
  const [pool, skip, report] = await Promise.all([
    topPool(room, POOL_SIZE, theme),
    skipState(room, nowPlaying?.playId, viewers),
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

export async function publish(room: RoomId, event: LiveEvent) {
  await redis().publish(K.events, `${room}|${JSON.stringify(event)}`);
}

/** Pool changes are coalesced: routes mark dirty, the ticker publishes at most once per second. */
export async function markPoolDirty(room: RoomId) {
  await redis().set(K.poolDirty(room), '1');
}

// One Redis subscription per process, fanned out to every open SSE stream. The emitter's event name
// is the room id, so each stream only listens to its own room.
const g = globalThis as unknown as { __bus?: EventEmitter };

export function bus() {
  if (!g.__bus) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    const sub = redisSub();
    sub.subscribe(K.events).catch((e) => console.error('[bus] subscribe failed', e));
    sub.on('message', (_ch, msg: string) => {
      const sep = msg.indexOf('|');
      emitter.emit(msg.slice(0, sep), msg.slice(sep + 1));
    });
    g.__bus = emitter;
  }
  return g.__bus;
}
