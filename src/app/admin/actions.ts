'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { DEFAULT_ROOM, ROOMS, isRoom, type RoomId } from '@/config/rooms';
import { db, schema } from '@/server/db/client';
import { advance, withLock } from '@/server/engine';
import { K } from '@/server/keys';
import { invalidateBlocklists } from '@/server/moderation';
import { removeCandidate } from '@/server/pool';
import { redis } from '@/server/redis';
import { getNowPlaying, markPoolDirty } from '@/server/state';
import { invalidateMeta } from '@/server/youtube';

// Every action here is reachable only through /admin, which middleware guards with basic auth.

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const roomOf = (f: FormData): RoomId => {
  const r = str(f, 'room');
  return isRoom(r) ? r : DEFAULT_ROOM;
};
const done = () => revalidatePath('/admin');

export async function forceSkip(f: FormData) {
  const room = roomOf(f);
  await withLock(room, async () => {
    if (await getNowPlaying(room)) await advance(room, 'admin');
  });
  done();
}

export async function dropCandidate(f: FormData) {
  const room = roomOf(f);
  await removeCandidate(room, str(f, 'id'));
  await markPoolDirty(room);
  done();
}

async function setVideoFlags(id: string, set: { banned?: boolean; flagged?: boolean }) {
  await db().update(schema.videos).set(set).where(eq(schema.videos.id, id));
  await invalidateMeta(id);
}

/** Bans everywhere: drops it from every room's queue and skips it wherever it is playing. */
export async function banVideo(f: FormData) {
  const id = str(f, 'id');
  await setVideoFlags(id, { banned: true });
  for (const room of ROOMS) {
    await removeCandidate(room, id);
    await markPoolDirty(room);
    await withLock(room, async () => {
      const np = await getNowPlaying(room);
      if (np?.video.id === id && np.state === 'playing') await advance(room, 'admin');
    });
  }
  done();
}

export async function unbanVideo(f: FormData) {
  await setVideoFlags(str(f, 'id'), { banned: false, flagged: false });
  done();
}

export async function clearFlag(f: FormData) {
  await setVideoFlags(str(f, 'id'), { flagged: false });
  done();
}

export async function banChannel(f: FormData) {
  const channelId = str(f, 'channelId');
  if (!channelId) return;
  await db()
    .insert(schema.bannedChannels)
    .values({ channelId, reason: str(f, 'reason') || null })
    .onConflictDoNothing();
  invalidateBlocklists();
  done();
}

export async function unbanChannel(f: FormData) {
  await db().delete(schema.bannedChannels).where(eq(schema.bannedChannels.channelId, str(f, 'channelId')));
  invalidateBlocklists();
  done();
}

export async function addKeyword(f: FormData) {
  const keyword = str(f, 'keyword').toLowerCase();
  if (!keyword) return;
  await db().insert(schema.blockedKeywords).values({ keyword }).onConflictDoNothing();
  invalidateBlocklists();
  done();
}

export async function removeKeyword(f: FormData) {
  await db().delete(schema.blockedKeywords).where(eq(schema.blockedKeywords.keyword, str(f, 'keyword')));
  invalidateBlocklists();
  done();
}

export async function setThemeWeights(f: FormData) {
  const entries = [...f.entries()]
    .filter(([k]) => k.startsWith('w:'))
    .map(([k, v]) => [k.slice(2), String(Math.max(0, Number(v) || 0))] as const);
  if (entries.length) await redis().hset(K.themeWeights, Object.fromEntries(entries));
  done();
}
