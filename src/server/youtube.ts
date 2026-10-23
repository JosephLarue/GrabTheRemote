import 'server-only';
import { eq, inArray } from 'drizzle-orm';
import { META_STALE_H, YT_QUOTA_HARD, YT_QUOTA_SOFT } from '@/config/app';
import type { VideoCard, VideoMeta } from '@/lib/types';
import { parseIsoDuration } from '@/lib/youtube-id';
import { db, schema } from './db/client';
import { env } from './env';
import { K } from './keys';
import { redis } from './redis';

const CACHE_TTL_S = 86400;
const STALE_MS = META_STALE_H * 3600_000;
const DEV_FAKE_DURATION_S = 180;

export class QuotaExhaustedError extends Error {}

// Google resets the quota at midnight Pacific time.
function quotaDay() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
}

export async function quotaUsed(): Promise<number> {
  return Number((await redis().get(K.ytQuota(quotaDay()))) ?? 0);
}

async function spendQuota() {
  const key = K.ytQuota(quotaDay());
  const used = await redis().incr(key);
  if (used === 1) await redis().expire(key, 2 * 86400);
  return used;
}

type ApiItem = {
  id: string;
  snippet: {
    title: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    categoryId: string;
    liveBroadcastContent?: string;
    thumbnails: Record<string, { url: string }>;
  };
  contentDetails: { duration: string; contentRating?: { ytRating?: string } };
  statistics: { viewCount?: string };
  status: { embeddable: boolean; privacyStatus: string };
};

/** One API call for up to 50 ids (always 1 quota unit). */
async function fetchFromApi(ids: string[]): Promise<Map<string, Omit<VideoMeta, 'flagged' | 'banned'>>> {
  const out = new Map<string, Omit<VideoMeta, 'flagged' | 'banned'>>();
  if (ids.length === 0) return out;
  await spendQuota();
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'snippet,contentDetails,statistics,status');
  url.searchParams.set('id', ids.join(','));
  url.searchParams.set('key', env().YT_API_KEY);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`YouTube API ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { items: ApiItem[] };
  for (const it of body.items) {
    const t = it.snippet.thumbnails;
    out.set(it.id, {
      id: it.id,
      title: it.snippet.title,
      channelId: it.snippet.channelId,
      channelTitle: it.snippet.channelTitle,
      // Live streams report P0D; durationS 0 is rejected by moderation.
      durationS: it.snippet.liveBroadcastContent === 'none' ? parseIsoDuration(it.contentDetails.duration) : 0,
      publishedAt: Date.parse(it.snippet.publishedAt),
      viewCount: Number(it.statistics.viewCount ?? 0),
      categoryId: it.snippet.categoryId,
      thumbnailUrl: (t.medium ?? t.high ?? t.default).url,
      embeddable: it.status.embeddable && it.status.privacyStatus !== 'private',
      ageRestricted: it.contentDetails.contentRating?.ytRating === 'ytAgeRestricted',
    });
  }
  return out;
}

type OEmbed = { title: string; author_name: string; thumbnail_url: string };

/** Free (no quota). 401/403 means embedding is disabled; 400/404 means no such video. */
async function fetchOEmbed(id: string): Promise<{ status: 'ok'; data: OEmbed } | { status: 'blocked' | 'missing' }> {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 401 || res.status === 403) return { status: 'blocked' };
  if (!res.ok) return { status: 'missing' };
  return { status: 'ok', data: (await res.json()) as OEmbed };
}

function rowToMeta(r: schema.VideoRow): VideoMeta & { statsFetchedAt: number } {
  return {
    id: r.id,
    title: r.title,
    channelId: r.channelId,
    channelTitle: r.channelTitle,
    durationS: r.durationS,
    publishedAt: r.publishedAt.getTime(),
    viewCount: r.viewCount,
    categoryId: r.categoryId,
    thumbnailUrl: r.thumbnailUrl,
    embeddable: r.embeddable,
    ageRestricted: r.ageRestricted,
    flagged: r.flagged,
    banned: r.banned,
    statsFetchedAt: r.statsFetchedAt.getTime(),
  };
}

async function upsert(m: Omit<VideoMeta, 'flagged' | 'banned'>) {
  const now = new Date();
  const values = { ...m, publishedAt: new Date(m.publishedAt), fetchedAt: now, statsFetchedAt: now };
  const [row] = await db()
    .insert(schema.videos)
    .values(values)
    .onConflictDoUpdate({
      target: schema.videos.id,
      set: {
        title: values.title,
        viewCount: values.viewCount,
        embeddable: values.embeddable,
        ageRestricted: values.ageRestricted,
        thumbnailUrl: values.thumbnailUrl,
        statsFetchedAt: now,
      },
    })
    .returning();
  return rowToMeta(row);
}

async function cacheSet(m: VideoMeta & { statsFetchedAt: number }) {
  await redis().set(K.ytCache(m.id), JSON.stringify(m), 'EX', CACHE_TTL_S);
}

export async function invalidateMeta(id: string) {
  await redis().del(K.ytCache(id));
}

/** Dev only (no API key): oEmbed + a fake duration, so the app is usable without Google credentials. */
async function devFallback(id: string) {
  const o = await fetchOEmbed(id);
  if (o.status === 'missing') return null;
  return upsert({
    id,
    title: o.status === 'ok' ? o.data.title : '(embedding disabled)',
    channelId: o.status === 'ok' ? `dev:${o.data.author_name}` : 'dev:unknown',
    channelTitle: o.status === 'ok' ? o.data.author_name : 'unknown',
    durationS: DEV_FAKE_DURATION_S,
    publishedAt: Date.now(),
    viewCount: 0,
    categoryId: '0',
    thumbnailUrl: o.status === 'ok' ? o.data.thumbnail_url : `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    embeddable: o.status === 'ok',
    ageRestricted: false,
  });
}

/**
 * Metadata lookup: Redis → Postgres → YouTube API.
 * `allowFetch: false` never spends quota (previews). Throws QuotaExhaustedError past the hard limit.
 */
export async function getMeta(id: string, { allowFetch }: { allowFetch: boolean }): Promise<VideoMeta | null> {
  const hit = await redis().get(K.ytCache(id));
  let meta: (VideoMeta & { statsFetchedAt: number }) | null = hit ? JSON.parse(hit) : null;

  if (!meta) {
    const [row] = await db().select().from(schema.videos).where(eq(schema.videos.id, id));
    meta = row ? rowToMeta(row) : null;
  }

  const stale = meta && Date.now() - meta.statsFetchedAt > STALE_MS;
  if (meta && !(stale && allowFetch)) {
    await cacheSet(meta);
    return meta;
  }
  if (!allowFetch) return null;

  if (!env().YT_API_KEY) {
    if (meta) return meta;
    const m = await devFallback(id);
    if (m) await cacheSet(m);
    return m;
  }

  const used = await quotaUsed();
  if (meta && used >= YT_QUOTA_SOFT) return meta; // stale is fine when quota is tight
  if (!meta && used >= YT_QUOTA_HARD) throw new QuotaExhaustedError();

  const fetched = (await fetchFromApi([id])).get(id);
  if (!fetched) return null;
  const fresh = await upsert(fetched);
  await cacheSet(fresh);
  return fresh;
}

/** Batch-refreshes stale ids (≤50 per quota unit). Used by the ticker for pool candidates. */
export async function refreshStale(ids: string[]) {
  if (!env().YT_API_KEY || ids.length === 0 || (await quotaUsed()) >= YT_QUOTA_SOFT) return;
  const rows = await db().select().from(schema.videos).where(inArray(schema.videos.id, ids));
  const stale = rows.filter((r) => Date.now() - r.statsFetchedAt.getTime() > STALE_MS).map((r) => r.id);
  for (let i = 0; i < stale.length; i += 50) {
    const fetched = await fetchFromApi(stale.slice(i, i + 50));
    for (const m of fetched.values()) await cacheSet(await upsert(m));
  }
}

export type Preview =
  | { status: 'ok'; video: VideoCard; meta: VideoMeta | null }
  | { status: 'blocked' | 'missing' };

/** Preview for the vote form. Never spends quota: cached meta, else oEmbed. */
export async function preview(id: string): Promise<Preview> {
  const meta = await getMeta(id, { allowFetch: false });
  if (meta) {
    return { status: 'ok', video: toCard(meta), meta };
  }
  const o = await fetchOEmbed(id);
  if (o.status !== 'ok') return o;
  return {
    status: 'ok',
    video: { id, title: o.data.title, channelTitle: o.data.author_name, durationS: 0, thumbnailUrl: o.data.thumbnail_url },
    meta: null,
  };
}

export function toCard(m: VideoMeta): VideoCard {
  return { id: m.id, title: m.title, channelTitle: m.channelTitle, durationS: m.durationS, thumbnailUrl: m.thumbnailUrl };
}
