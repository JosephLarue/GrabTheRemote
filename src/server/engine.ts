import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { FALLBACK_VIDEOS, STATIC_TRANSITION_MS } from '@/config/app';
import type { NowPlaying, VideoMeta } from '@/lib/types';
import { db, schema } from './db/client';
import { K } from './keys';
import { assertAllowed } from './moderation';
import { popBest, poolIds, sweepPool } from './pool';
import { redis } from './redis';
import {
  getNowPlaying,
  poolForClients,
  publish,
  reportState,
  setNowPlaying,
  skipState,
  viewerCount,
} from './state';
import { currentTheme, slotEndsAt, slotId, toTheme } from './themes';
import { getMeta, refreshStale, toCard } from './youtube';

type EndReason = 'finished' | 'skipped' | 'reported' | 'admin';

const RELEASE_LUA = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;

/** Serializes playback changes across requests, the ticker and multiple instances. */
export async function withLock<T>(fn: () => Promise<T>, { wait = true } = {}): Promise<T | undefined> {
  const token = randomUUID();
  for (let i = 0; i < (wait ? 40 : 1); i++) {
    if (await redis().set(K.lockAdvance, token, 'PX', 10_000, 'NX')) {
      try {
        return await fn();
      } finally {
        await redis().eval(RELEASE_LUA, 1, K.lockAdvance, token);
      }
    }
    if (wait) await new Promise((r) => setTimeout(r, 50));
  }
  return undefined;
}

const isPlayable = async (m: VideoMeta) => {
  try {
    await assertAllowed(m);
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

/** Random pick among the 50 most-watched clean videos, else the config fallbacks. */
async function fallbackPick(excludeId?: string): Promise<VideoMeta | null> {
  const hall = await db()
    .select({ id: schema.plays.videoId })
    .from(schema.plays)
    .innerJoin(schema.videos, eq(schema.videos.id, schema.plays.videoId))
    .where(
      and(
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
    if (meta && (await isPlayable(meta))) return meta;
  }
  return null;
}

/**
 * Ends the current play (if `reason` is given) and starts the next one: pool #1, else fallback.
 * Must run inside withLock.
 */
export async function advance(reason: EndReason | null) {
  const prev = await getNowPlaying();
  if (prev && reason) await closePlay(prev, reason);
  if (prev) await redis().del(K.skipVotes(prev.playId), K.reportVotes(prev.playId));

  const picked = await popBest(isPlayable);
  const meta = picked?.meta ?? (await fallbackPick(prev?.video.id));
  if (!meta) {
    await redis().del(K.nowPlaying);
    await publish({ type: 'nowplaying', data: null });
    return null;
  }

  const theme = await currentTheme();
  const startedAt = Date.now() + STATIC_TRANSITION_MS;
  const [row] = await db()
    .insert(schema.plays)
    .values({
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
  };
  await setNowPlaying(np);
  const viewers = await viewerCount();
  await publish({ type: 'nowplaying', data: np });
  await publish({ type: 'pool', data: await poolForClients() });
  await publish({ type: 'skip', data: await skipState(np.playId, viewers) });
  await publish({ type: 'report', data: await reportState(np.playId, viewers) });
  return np;
}

// ---------------------------------------------------------------- ticker

const g = globalThis as unknown as { __ticker?: NodeJS.Timeout };
let tickN = 0;
let lastSlot = -1;
let nextAdvanceTry = 0;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    await withLock(
      async () => {
        const now = Date.now();
        tickN++;

        const np = await getNowPlaying();
        if ((!np || now >= np.endsAt) && now >= nextAdvanceTry) {
          // A reported card was already closed as 'reported' when the threshold was hit.
          const reason = np && np.state === 'playing' ? 'finished' : null;
          const next = await advance(reason);
          if (!next) nextAdvanceTry = now + 10_000;
        }

        const slot = slotId(now);
        if (slot !== lastSlot) {
          lastSlot = slot;
          const theme = await currentTheme();
          await publish({
            type: 'theme',
            data: { theme: toTheme(theme), themeEndsAt: slotEndsAt(slot), pool: await poolForClients() },
          });
        }

        if (tickN % 30 === 0 && (await sweepPool(now)) > 0) await redis().set(K.poolDirty, '1');
        if (await redis().getdel(K.poolDirty)) await publish({ type: 'pool', data: await poolForClients() });

        if (tickN % 2 === 0) {
          const viewers = await viewerCount();
          await publish({ type: 'viewers', data: viewers });
          const cur = await getNowPlaying();
          if (cur && tickN % 4 === 0) {
            await publish({ type: 'skip', data: await skipState(cur.playId, viewers) });
            await publish({ type: 'report', data: await reportState(cur.playId, viewers) });
          }
          if (cur && cur.state === 'playing' && tickN % 6 === 0 && now >= cur.startedAt) {
            await db()
              .update(schema.plays)
              .set({
                viewerSeconds: sql`${schema.plays.viewerSeconds} + ${viewers * 6}`,
                peakViewers: sql`greatest(${schema.plays.peakViewers}, ${viewers})`,
              })
              .where(eq(schema.plays.id, cur.playId));
          }
        }

        if (tickN % 600 === 0) await refreshStale(await poolIds());
      },
      { wait: false },
    );
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
