import 'server-only';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { RoomId } from '@/config/rooms';
import { db, schema } from './db/client';
import { K } from './keys';
import { redis } from './redis';

export const HALL_TABS = ['watched', 'picked', 'landslide', 'peak', 'shame'] as const;
export type HallTab = (typeof HALL_TABS)[number];

export type HallRow = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  /** Hidden for mass-reported videos so the Hall of Shame doesn't re-broadcast them. */
  hidden: boolean;
  value: number;
  at?: string;
  reason?: string;
};

const CACHE_S = 300;
const LIMIT = 20;
const p = schema.plays;
const v = schema.videos;

const videoCols = {
  videoId: v.id,
  title: v.title,
  channelTitle: v.channelTitle,
  thumbnailUrl: v.thumbnailUrl,
  flagged: v.flagged,
};

async function query(room: RoomId, tab: HallTab): Promise<HallRow[]> {
  const inRoom = eq(p.room, room);
  const clean = and(inRoom, eq(v.banned, false), eq(v.flagged, false));
  const base = () => db().select().from(p).innerJoin(v, eq(v.id, p.videoId));
  switch (tab) {
    case 'watched': {
      const value = sql<number>`sum(${p.viewerSeconds})::int`;
      const rows = await db()
        .select({ ...videoCols, value })
        .from(p)
        .innerJoin(v, eq(v.id, p.videoId))
        .where(clean)
        .groupBy(v.id)
        .orderBy(desc(value))
        .limit(LIMIT);
      return rows.filter((r) => r.value > 0).map((r) => ({ ...r, hidden: false, value: Math.round(r.value / 60) }));
    }
    case 'picked': {
      const value = sql<number>`count(*)::int`;
      return (
        await db()
          .select({ ...videoCols, value })
          .from(p)
          .innerJoin(v, eq(v.id, p.videoId))
          .where(and(clean, eq(p.source, 'pool')))
          .groupBy(v.id)
          .orderBy(desc(value))
          .limit(LIMIT)
      ).map((r) => ({ ...r, hidden: false }));
    }
    case 'landslide':
    case 'peak': {
      const col = tab === 'landslide' ? p.votesAtPick : p.peakViewers;
      const rows = await base().where(and(clean, sql`${col} > 0`)).orderBy(desc(col)).limit(LIMIT);
      return rows.map(({ plays, videos }) => ({
        videoId: videos.id,
        title: videos.title,
        channelTitle: videos.channelTitle,
        thumbnailUrl: videos.thumbnailUrl,
        hidden: false,
        value: tab === 'landslide' ? plays.votesAtPick : plays.peakViewers,
        at: plays.startedAt.toISOString(),
      }));
    }
    case 'shame': {
      const lasted = sql<number>`extract(epoch from (${p.endedAt} - ${p.startedAt}))::int`;
      const rows = await db()
        .select({ ...videoCols, value: lasted, reason: p.endReason, at: p.startedAt })
        .from(p)
        .innerJoin(v, eq(v.id, p.videoId))
        .where(and(inRoom, eq(v.banned, false), inArray(p.endReason, ['skipped', 'reported'])))
        .orderBy(lasted)
        .limit(LIMIT);
      return rows.map((r) => ({
        ...r,
        hidden: r.flagged || r.reason === 'reported',
        value: Math.max(0, r.value),
        at: r.at.toISOString(),
        reason: r.reason ?? undefined,
      }));
    }
  }
}

export async function hall(room: RoomId, tab: HallTab): Promise<HallRow[]> {
  const key = K.hallCache(room, tab);
  const hit = await redis().get(key);
  if (hit) return JSON.parse(hit);
  const rows = await query(room, tab);
  await redis().set(key, JSON.stringify(rows), 'EX', CACHE_S);
  return rows;
}
