import 'server-only';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { PRIVATE_IDLE_TTL_S } from '@/config/app';
import type { PrivateRoomId, RoomId } from '@/config/rooms';
import type { RoomSettings } from '@/lib/types';
import { env } from './env';
import { K } from './keys';
import { redis } from './redis';

// Private rooms: a streamer creates one, shows its ID and password to their chat, and the chat votes like in
// any other room. The password is a code meant to be read out on stream, so it is stored as is (the streamer
// can show it again); the owner key is a real secret and only its hash is kept.

type Stored = {
  settings: RoomSettings;
  password: string;
  ownerHash: string;
  createdAt: number;
};

const ID_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const COOKIE_MAX_AGE_S = 7 * 86400;

const pick = (chars: string, n: number) => Array.from({ length: n }, () => chars[randomInt(chars.length)]).join('');
const sha256 = (s: string) => createHash('sha256').update(s).digest('base64url');

function sameText(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function getPrivateRoom(room: RoomId): Promise<Stored | null> {
  const raw = await redis().get(K.privateRoom(room));
  return raw ? (JSON.parse(raw) as Stored) : null;
}

async function put(room: RoomId, s: Stored) {
  await redis().set(K.privateRoom(room), JSON.stringify(s), 'EX', PRIVATE_IDLE_TTL_S);
}

export async function createPrivateRoom(settings: RoomSettings, password?: string) {
  const s: Omit<Stored, 'ownerHash'> = { settings, password: password || pick(PASSWORD_CHARS, 6), createdAt: Date.now() };
  const ownerKey = randomBytes(18).toString('base64url');
  for (;;) {
    const id = `p-${pick(ID_CHARS, 6)}` as PrivateRoomId;
    const stored: Stored = { ...s, ownerHash: sha256(ownerKey) };
    if (await redis().set(K.privateRoom(id), JSON.stringify(stored), 'EX', PRIVATE_IDLE_TTL_S, 'NX')) {
      await redis().sadd(K.privateRooms, id);
      return { id, password: stored.password, ownerKey };
    }
  }
}

export async function updatePrivateRoom(room: RoomId, settings: RoomSettings, password?: string) {
  const s = await getPrivateRoom(room);
  if (!s) return null;
  const next = { ...s, settings, password: password || s.password };
  await put(room, next);
  return next;
}

/** Keeps a room alive another day; the ticker calls it while people are watching. */
export const touchPrivateRoom = (room: RoomId) => redis().expire(K.privateRoom(room), PRIVATE_IDLE_TTL_S);

export const privateRoomIds = async () => (await redis().smembers(K.privateRooms)) as PrivateRoomId[];

/** Drops a room's id and live state. Its plays stay in Postgres (they're just rows with its id). */
export async function forgetPrivateRoom(room: RoomId) {
  await redis().del(
    K.privateRoom(room),
    K.nowPlaying(room),
    K.pool(room),
    K.poolFirst(room),
    K.poolLast(room),
    K.presence(room),
    K.online(room),
    K.voters(room),
  );
  await redis().srem(K.privateRooms, room);
}

// ---------------------------------------------------------------- cookies

/** Proof of the password, scoped to the room: changing the password locks everyone out. */
const accessToken = (room: RoomId, password: string) =>
  createHmac('sha256', env().IP_HASH_SECRET).update(`${room}:${password}`).digest('base64url').slice(0, 32);

export const accessCookie = (room: RoomId) => `gtr_in_${room}`;
export const ownerCookie = (room: RoomId) => `gtr_own_${room}`;

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: COOKIE_MAX_AGE_S,
};

/** Cookies to set once someone has the password (or the owner key). */
export const accessCookieValue = (room: RoomId, s: Stored) => accessToken(room, s.password);

export function passwordMatches(s: Stored, password: string) {
  return sameText(s.password.toUpperCase(), password.trim().toUpperCase());
}

export function ownerKeyMatches(s: Stored, key: string) {
  return sameText(s.ownerHash, sha256(key));
}

export type Access = { exists: boolean; enter: boolean; owner: boolean };

/** Who this is for a room, from their cookies. Public rooms let everyone in. */
export async function accessOf(room: RoomId, cookie: (name: string) => string | undefined): Promise<Access> {
  if (!room.startsWith('p-')) return { exists: true, enter: true, owner: false };
  const s = await getPrivateRoom(room);
  if (!s) return { exists: false, enter: false, owner: false };
  const ownerKey = cookie(ownerCookie(room));
  const owner = Boolean(ownerKey && ownerKeyMatches(s, ownerKey));
  const pass = cookie(accessCookie(room));
  return { exists: true, owner, enter: owner || Boolean(pass && sameText(pass, accessToken(room, s.password))) };
}

/** Reads one cookie from a request's Cookie header. */
export function requestCookie(req: Request) {
  const header = req.headers.get('cookie') ?? '';
  return (name: string) => {
    for (const part of header.split(';')) {
      const i = part.indexOf('=');
      if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
    }
    return undefined;
  };
}
