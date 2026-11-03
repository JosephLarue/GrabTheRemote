import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { FALLBACK_VIDEOS, STATIC_TRANSITION_MS } from '@/config/app';
import { ROOMS, type RoomId, isTwitchRoom } from '@/config/rooms';
import type { NowPlaying, RoomRules, VideoMeta } from '@/lib/types';
import { db, schema } from './db/client';
import { ApiError } from './http';
import { K } from './keys';
import { assertAllowed, assertFitsRoom } from './moderation';
import { popBest, poolIds, sweepPool } from './pool';
import { delIfEquals, pexpireIfEquals, redis } from './redis';
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

const LOCK_TTL_MS = 10_000;
const LOCK_RENEW_MS = 3000;

/**
 * Serializes a room's playback changes across requests, the ticker and multiple instances. The lock is
 * renewed while `fn` runs (a slow YouTube call must not let another instance advance the same room), but
 * only while it still holds our token: once the TTL has lapsed and someone else took it, we leave it alone.
 */
export async function withLock<T>(room: RoomId, fn: () => Promise<T>, { wait = true } = {}): Promise<T | undefined> {
  const token = randomUUID();
  const key = K.lockAdvance(room);
  for (let i = 0; i < (wait ? 40 : 1); i++) {
    if (await redis().set(key, token, 'PX', LOCK_TTL_MS, 'NX')) {
      const renew = setInterval(() => void pexpireIfEquals(key, token, LOCK_TTL_MS).catch(() => {}), LOCK_RENEW_MS);
      try {
        return await fn();
      } finally {
        clearInterval(renew);
        await delIfEquals(key, token);
      }
    }
    if (wait) await new Promise((r) => setTimeout(r, 50));
  }
  return undefined;
}

/**
 * False when the room's rules refuse the video (an ApiError from moderation). Anything else (Postgres down,
 * blocklist unreadable) propagates: a candidate must not be thrown away because we couldn't judge it.
 */
const isPlayable = (rules: RoomRules) => async (m: VideoMeta) => {
  try {
    await assertAllowed(m, rules);
    assertFitsRoom(rules, m);
    return true;
  } catch (e) {
    if (e instanceof ApiError) return false;
    throw e;
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
  // Viewer-seconds for the new play count from its start, not from the previous play's last credit.
  await redis().set(K.acct(room), String(startedAt));
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
  await redis().set(K.acct(room), String(now)); // the pause earned nobody any viewer-seconds
  await publish(room, { type: 'nowplaying', data: resumed });
  return resumed;
}

/**
 * Closes a private room: ends whatever is on screen (so no `plays` row stays open forever), drops its
 * state and tells the viewers. Takes the room's lock itself.
 */
export async function closePrivateRoom(room: RoomId) {
  await withLock(room, async () => {
    const np = await getNowPlaying(room);
    if (np && np.state === 'playing') await closePlay(np, 'admin');
    await forgetPrivateRoom(room);
  });
  await publish(room, { type: 'closed', data: null });
}

// ---------------------------------------------------------------- ticker

const g = globalThis as unknown as { __ticker?: NodeJS.Timeout; __lastTickAt?: number };
let tickN = 0;
const lastSlot = new Map<RoomId, number>();
const nextAdvanceTry = new Map<RoomId, number>();
const lastAdvanceError = new Map<RoomId, number>();
/** Rooms whose previous tick is still running: each room skips its own late ticks, without blocking the others. */
const ticking = new Set<RoomId>();
const ADVANCE_RETRY_MS = 10_000;
const ADVANCE_ERROR_LOG_EVERY_MS = 60_000;
/** Viewer-seconds credit per tick is capped: a missing or ancient timestamp must not credit hours at once. */
const ACCT_MAX_ELAPSED_MS = 30_000;

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
        let next: NowPlaying | null = null;
        try {
          next = await advance(room, reason);
        } catch (e) {
          // Postgres/Redis/YouTube trouble: the pool is intact (popBest judges before removing), so retry
          // later rather than hammering a sick dependency every second. Logged once a minute per room.
          if (now - (lastAdvanceError.get(room) ?? 0) >= ADVANCE_ERROR_LOG_EVERY_MS) {
            lastAdvanceError.set(room, now);
            console.error(`[ticker:${room}] advance failed`, e);
          }
        }
        if (!next) nextAdvanceTry.set(room, now + ADVANCE_RETRY_MS);
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
          // Elapsed time comes from a shared Redis timestamp, so N instances credit the wall clock once,
          // not N times. GETSET is atomic: two instances can't both read the same previous value.
          const prev = Number(await redis().getset(K.acct(room), String(now)));
          const elapsedMs = Math.min(ACCT_MAX_ELAPSED_MS, Math.max(0, now - (prev || now)));
          const credit = Math.round((viewers * elapsedMs) / 1000);
          if (viewers > 0) {
            await db()
              .update(schema.plays)
              .set({
                viewerSeconds: sql`${schema.plays.viewerSeconds} + ${credit}`,
                peakViewers: sql`greatest(${schema.plays.peakViewers}, ${viewers})`,
              })
              .where(eq(schema.plays.id, cur.playId));
          }
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
      await closePrivateRoom(room);
      continue;
    }
    if ((await viewerCount(room)) > 0) await touchPrivateRoom(room);
    alive.push(room);
  }
  return alive;
}

/** One room's tick, unless its previous one is still running: a stuck room never freezes the others. */
async function tickRoomOnce(room: RoomId, now: number) {
  if (ticking.has(room)) return;
  ticking.add(room);
  try {
    await tickRoom(room, now);
  } catch (e) {
    console.error(`[ticker:${room}]`, e);
  } finally {
    ticking.delete(room);
  }
}

async function tick() {
  const now = Date.now();
  g.__lastTickAt = now;
  try {
    tickN++;
    const rooms: RoomId[] = [...ROOMS, ...(await livePrivateRooms())];
    await Promise.all(rooms.map((room) => tickRoomOnce(room, now)));
    if (tickN % 600 === 0) await refreshStale((await Promise.all(rooms.map(poolIds))).flat());
  } catch (e) {
    console.error('[ticker]', e);
  }
}

export function startTicker() {
  if (g.__ticker) return;
  g.__lastTickAt = Date.now();
  g.__ticker = setInterval(tick, 1000);
  console.log('[ticker] started');
}

/** For the health check: whether this process ticks, and when it last did. */
export function tickerStatus() {
  return { started: Boolean(g.__ticker), lastTickAt: g.__lastTickAt ?? 0 };
}

/** Stops scheduling ticks and waits (up to `maxWaitMs`) for the rooms still mid-tick to finish. */
export async function stopTicker(maxWaitMs = 5000) {
  if (!g.__ticker) return;
  clearInterval(g.__ticker);
  delete g.__ticker;
  const deadline = Date.now() + maxWaitMs;
  while (ticking.size > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
  if (ticking.size > 0) console.error(`[ticker] stopped with ${ticking.size} room tick(s) still running`);
  else console.log('[ticker] stopped');
}
