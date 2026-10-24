import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { FALLBACK_VIDEOS, STATIC_TRANSITION_MS } from '@/config/app';
import { ROOMS, type RoomId, isTwitchRoom } from '@/config/rooms';
import type { NowPlaying, RoomRules, VideoMeta } from '@/lib/types';
import { db, schema } from './db/client';
import { K } from './keys';
import { assertAllowed, assertFitsRoom } from './moderation';
import { popBest, poolIds, sweepPool } from './pool';
import { delIfEquals, redis } from './redis';
import {
  getNowPlaying,
  poolForClients,
  publish,
  reportState,
  setNowPlaying,
  skipState,
  viewerCount,
} from './state';
import { maybeStealRemote } from './steal';
import { forgetPrivateRoom, privateRoomIds, touchPrivateRoom } from './private-rooms';
import { roomSettings, themeFor } from './room-settings';
import { slotEndsAt, slotId, toTheme } from './themes';
import { tickTwitch, twitchLive } from './twitch';
import { getMeta, refreshStale, toCard } from './youtube';

type EndReason = 'finished' | 'skipped' | 'reported' | 'admin' | 'vetoed';

/** Serializes a room's playback changes across requests, the ticker and multiple instances. */
export async function withLock<T>(room: RoomId, fn: () => Promise<T>, { wait = true } = {}): Promise<T | undefined> {
  const token = randomUUID();
  const key = K.lockAdvance(room);
  for (let i = 0; i < (wait ? 40 : 1); i++) {
    if (await redis().set(key, token, 'PX', 10_000, 'NX')) {
      try {
        return await fn();
      } finally {
        await delIfEquals(key, token);
      }
    }
    if (wait) await new Promise((r) => setTimeout(r, 50));
  }
  return undefined;
}

const isPlayable = (rules: RoomRules) => async (m: VideoMeta) => {
  try {
    await assertAllowed(m, rules);
    assertFitsRoom(rules, m);
    return true;
  } catch {
    return false;
  }
};

/** Writes the end of a play. Called inside the lock. */
export async function closePlay(np: NowPlaying, reason: EndReason) {
  const [skips, reports] = await Promise.all([
    redis().scard(K.skipVotes(np.playId)),
    redis().scard(K.reportVotes(np.playId)),
  ]);
  await db()
    .update(schema.plays)
    .set({ endedAt: new Date(), endReason: reason, skipVotes: skips, reportVotes: reports })
    .where(and(eq(schema.plays.id, np.playId), sql`${schema.plays.endedAt} is null`));
}

/** Random pick among the room's 50 most-watched clean videos, else the config fallbacks. */
async function fallbackPick(room: RoomId, rules: RoomRules, excludeId?: string): Promise<VideoMeta | null> {
  const hall = await db()
    .select({ id: schema.plays.videoId })
    .from(schema.plays)
    .innerJoin(schema.videos, eq(schema.videos.id, schema.plays.videoId))
    .where(
      and(
        eq(schema.plays.room, room),
        eq(schema.videos.banned, false),
        eq(schema.videos.flagged, false),
        ne(schema.plays.endReason, 'reported'),
        excludeId ? ne(schema.plays.videoId, excludeId) : undefined,
      ),
    )
    .groupBy(schema.plays.videoId)
    .orderBy(desc(sql`sum(${schema.plays.viewerSeconds})`))
    .limit(50);
  const ids = hall.length ? hall.map((h) => h.id) : FALLBACK_VIDEOS.filter((id) => id !== excludeId);
  for (const id of [...ids].sort(() => Math.random() - 0.5)) {
    const meta = await getMeta(id, { allowFetch: true }).catch(() => null);
    if (meta && (await isPlayable(rules)(meta))) return meta;
  }
  return null;
}

/**
 * Ends the current play (if `reason` is given) and starts the next one: pool #1, else fallback.
 * Must run inside withLock.
 */
export async function advance(room: RoomId, reason: EndReason | null) {
  const prev = await getNowPlaying(room);
  if (prev && reason) await closePlay(prev, reason);
  if (prev) await redis().del(K.skipVotes(prev.playId), K.reportVotes(prev.playId));

  const settings = await roomSettings(room);
  if (!settings) return null;
  const picked = await popBest(room, isPlayable(settings.rules));
  const meta = picked?.meta ?? (await fallbackPick(room, settings.rules, prev?.video.id));
  if (!meta) {
    await redis().del(K.nowPlaying(room));
    await publish(room, { type: 'nowplaying', data: null });
    return null;
  }

  const theme = await themeFor(room, settings);
  const startedAt = Date.now() + STATIC_TRANSITION_MS;
  const [row] = await db()
    .insert(schema.plays)
    .values({
      room,
      videoId: meta.id,
      votesAtPick: picked?.votes ?? 0,
      source: picked ? 'pool' : 'fallback',
      themeId: theme?.id ?? null,
      startedAt: new Date(startedAt),
    })
    .returning({ id: schema.plays.id });

  const np: NowPlaying = {
    playId: row.id,
    video: toCard(meta),
    startedAt,
    endsAt: startedAt + meta.durationS * 1000,
    state: 'playing',
    pausedAt: null,
  };
  await setNowPlaying(room, np);
  const viewers = await viewerCount(room);
  await publish(room, { type: 'nowplaying', data: np });
  await publish(room, { type: 'pool', data: await poolForClients(room) });
  await publish(room, { type: 'skip', data: await skipState(room, np.playId, viewers) });
  await publish(room, { type: 'report', data: await reportState(np.playId, viewers) });
  return np;
}

/** Private rooms: the streamer freezes everyone's screen. Must run inside withLock. */
export async function pausePlayback(room: RoomId, now = Date.now()) {
  const np = await getNowPlaying(room);
  if (!np || np.state !== 'playing' || np.pausedAt) return null;
  const paused = { ...np, pausedAt: Math.max(now, np.startedAt) };
  await setNowPlaying(room, paused);
  await publish(room, { type: 'nowplaying', data: paused });
  return paused;
}

/** Picks up where the pause left off: the video's timeline shifts by however long it was paused. */
export async function resumePlayback(room: RoomId, now = Date.now()) {
  const np = await getNowPlaying(room);
  if (!np?.pausedAt) return null;
  // Paused during the channel-change static (pausedAt = startedAt, still ahead): resuming early shifts nothing.
  const d = Math.max(0, now - np.pausedAt);
  const resumed = { ...np, startedAt: np.startedAt + d, endsAt: np.endsAt + d, pausedAt: null };
  await setNowPlaying(room, resumed);
  await publish(room, { type: 'nowplaying', data: resumed });
  return resumed;
}

// ---------------------------------------------------------------- ticker

const g = globalThis as unknown as { __ticker?: NodeJS.Timeout };
let tickN = 0;
const lastSlot = new Map<RoomId, number>();
const nextAdvanceTry = new Map<RoomId, number>();
let running = false;

/** Twitch rooms: the keep/change/pick state machine, plus the viewer count. No queue, no themes. */
async function tickTwitchRoom(room: RoomId, now: number) {
  await withLock(
    room,
    async () => {
      const changed = await tickTwitch(room, now);
      // Votes are coalesced like the pool: routes mark dirty, at most one event per second goes out.
      if ((await redis().getdel(K.twitchDirty(room))) || changed) {
        await publish(room, { type: 'twitch', data: await twitchLive(room) });
      }
      if (tickN % 2 === 0) await publish(room, { type: 'viewers', data: await viewerCount(room) });
    },
    { wait: false },
  );
}

async function tickRoom(room: RoomId, now: number) {
  if (isTwitchRoom(room)) return tickTwitchRoom(room, now);
  await withLock(
    room,
    async () => {
      const np = await getNowPlaying(room);
      if (np?.pausedAt) {
        // Paused by the streamer: nothing ends, nothing gets stolen, no watch time counts.
      } else if ((!np || now >= np.endsAt) && now >= (nextAdvanceTry.get(room) ?? 0)) {
        // A reported card was already closed as 'reported' when the threshold was hit.
        const reason = np && np.state === 'playing' ? 'finished' : null;
        const next = await advance(room, reason);
        if (!next) nextAdvanceTry.set(room, now + 10_000);
      } else if (np?.state === 'playing') {
        await maybeStealRemote(room, now);
      }

      const slot = slotId(now);
      if (slot !== lastSlot.get(room)) {
        lastSlot.set(room, slot);
        const theme = await themeFor(room);
        await publish(room, {
          type: 'theme',
          data: { theme: toTheme(theme), themeEndsAt: slotEndsAt(slot), pool: await poolForClients(room) },
        });
      }

      if (tickN % 30 === 0 && (await sweepPool(room, now)) > 0) await redis().set(K.poolDirty(room), '1');
      if (await redis().getdel(K.poolDirty(room))) {
        await publish(room, { type: 'pool', data: await poolForClients(room) });
      }

      if (tickN % 2 === 0) {
        const viewers = await viewerCount(room);
        await publish(room, { type: 'viewers', data: viewers });
        const cur = await getNowPlaying(room);
        if (cur && tickN % 4 === 0) {
          await publish(room, { type: 'skip', data: await skipState(room, cur.playId, viewers) });
          await publish(room, { type: 'report', data: await reportState(cur.playId, viewers) });
        }
        if (cur && cur.state === 'playing' && !cur.pausedAt && tickN % 6 === 0 && now >= cur.startedAt) {
          await db()
            .update(schema.plays)
            .set({
              viewerSeconds: sql`${schema.plays.viewerSeconds} + ${viewers * 6}`,
              peakViewers: sql`greatest(${schema.plays.peakViewers}, ${viewers})`,
            })
            .where(eq(schema.plays.id, cur.playId));
        }
      }
    },
    { wait: false },
  );
}

/**
 * Private rooms that still exist. Once a minute, rooms with viewers get another day, and rooms that expired
 * (a day with nobody watching) are cleaned up and told they're closed.
 */
async function livePrivateRooms(): Promise<RoomId[]> {
  const ids = await privateRoomIds();
  if (tickN % 60 !== 0) return ids;
  const alive: RoomId[] = [];
  for (const room of ids) {
    if (!(await roomSettings(room))) {
      await forgetPrivateRoom(room);
      await publish(room, { type: 'closed', data: null });
      continue;
    }
    if ((await viewerCount(room)) > 0) await touchPrivateRoom(room);
    alive.push(room);
  }
  return alive;
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const now = Date.now();
    tickN++;
    const rooms: RoomId[] = [...ROOMS, ...(await livePrivateRooms())];
    // One room failing must not freeze the others.
    const results = await Promise.allSettled(rooms.map((room) => tickRoom(room, now)));
    results.forEach((r, i) => r.status === 'rejected' && console.error(`[ticker:${rooms[i]}]`, r.reason));
    if (tickN % 600 === 0) await refreshStale((await Promise.all(rooms.map(poolIds))).flat());
  } catch (e) {
    console.error('[ticker]', e);
  } finally {
    running = false;
  }
}

export function startTicker() {
  if (g.__ticker) return;
  g.__ticker = setInterval(tick, 1000);
  console.log('[ticker] started');
}
