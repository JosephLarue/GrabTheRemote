'use server';

import { timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { DEFAULT_ROOM, ROOMS, isRoom, isTwitchRoom, type RoomId } from '@/config/rooms';
import { parseTwitchLogin } from '@/lib/twitch';
import { db, schema } from '@/server/db/client';
import { advance, withLock } from '@/server/engine';
import { env } from '@/server/env';
import { K } from '@/server/keys';
import { invalidateBlocklists, twitchBanId } from '@/server/moderation';
import { removeCandidate } from '@/server/pool';
import { redis } from '@/server/redis';
import { getNowPlaying, markPoolDirty, publish } from '@/server/state';
import { forceChange, startChannel, twitchLive } from '@/server/twitch';
import { checkLive } from '@/server/twitch-api';
import { invalidateMeta } from '@/server/youtube';

// The proxy guards /admin with basic auth, but server actions are plain POSTs with an action id:
// each one checks the same credentials itself, so a guessed id is worth nothing without the password.

/** Throws unless the request carries the admin's Basic auth. */
async function assertAdmin() {
  const header = (await headers()).get('authorization') ?? '';
  const [scheme, encoded] = header.split(' ');
  let decoded = '';
  try {
    if (scheme === 'Basic' && encoded) decoded = Buffer.from(encoded, 'base64').toString('utf8');
  } catch {}
  const given = Buffer.from(decoded.slice(decoded.indexOf(':') + 1));
  const expected = Buffer.from(env().ADMIN_PASSWORD);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new Error('Admins only');
}

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const roomOf = (f: FormData): RoomId => {
  const r = str(f, 'room');
  return isRoom(r) ? r : DEFAULT_ROOM;
};
const done = () => revalidatePath('/admin');

export async function forceSkip(f: FormData) {
  await assertAdmin();
  const room = roomOf(f);
  await withLock(room, async () => {
    if (await getNowPlaying(room)) await advance(room, 'admin');
  });
  done();
}

export async function dropCandidate(f: FormData) {
  await assertAdmin();
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
  await assertAdmin();
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
  await assertAdmin();
  await setVideoFlags(str(f, 'id'), { banned: false, flagged: false });
  done();
}

export async function clearFlag(f: FormData) {
  await assertAdmin();
  await setVideoFlags(str(f, 'id'), { flagged: false });
  done();
}

export async function banChannel(f: FormData) {
  await assertAdmin();
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
  await assertAdmin();
  await db().delete(schema.bannedChannels).where(eq(schema.bannedChannels.channelId, str(f, 'channelId')));
  invalidateBlocklists();
  done();
}

export async function addKeyword(f: FormData) {
  await assertAdmin();
  const keyword = str(f, 'keyword').toLowerCase();
  if (!keyword) return;
  await db().insert(schema.blockedKeywords).values({ keyword }).onConflictDoNothing();
  invalidateBlocklists();
  done();
}

export async function removeKeyword(f: FormData) {
  await assertAdmin();
  await db().delete(schema.blockedKeywords).where(eq(schema.blockedKeywords.keyword, str(f, 'keyword')));
  invalidateBlocklists();
  done();
}

export async function setThemeWeights(f: FormData) {
  await assertAdmin();
  const entries = [...f.entries()]
    .filter(([k]) => k.startsWith('w:'))
    .map(([k, v]) => [k.slice(2), String(Math.max(0, Number(v) || 0))] as const);
  if (entries.length) await redis().hset(K.themeWeights, Object.fromEntries(entries));
  done();
}

// ---------------------------------------------------------------- Twitch rooms

const publishTwitch = async (room: RoomId) => publish(room, { type: 'twitch', data: await twitchLive(room) });

/** Puts a channel on screen for a fresh slot, live or not: an offline pin opens a pick window at the next check. */
export async function pinTwitchChannel(f: FormData) {
  await assertAdmin();
  const room = roomOf(f);
  const login = parseTwitchLogin(str(f, 'channel'));
  if (!isTwitchRoom(room) || !login) return;
  const check = (await checkLive([login]).catch(() => null))?.get(login);
  const channel = check?.status === 'live' ? check.channel : { login, name: login, title: '', game: '', viewers: null };
  await withLock(room, () => startChannel(room, channel));
  await publishTwitch(room);
  done();
}

export async function forceTwitchChange(f: FormData) {
  await assertAdmin();
  const room = roomOf(f);
  if (!isTwitchRoom(room)) return;
  await withLock(room, () => forceChange(room));
  await publishTwitch(room);
  done();
}

/** Bans a channel from every Twitch room, and votes it off wherever it is on screen. */
export async function banTwitchChannel(f: FormData) {
  await assertAdmin();
  const login = parseTwitchLogin(str(f, 'channel'));
  if (!login) return;
  await db()
    .insert(schema.bannedChannels)
    .values({ channelId: twitchBanId(login), reason: str(f, 'reason') || null })
    .onConflictDoNothing();
  invalidateBlocklists();
  for (const room of ROOMS.filter(isTwitchRoom)) {
    if ((await twitchLive(room)).channel?.login !== login) continue;
    await withLock(room, () => forceChange(room));
    await publishTwitch(room);
  }
  done();
}
