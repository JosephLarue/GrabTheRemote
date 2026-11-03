import { eq } from 'drizzle-orm';
import { GET as getChat, POST as postChat } from '@/app/api/chat/route';
import { GET as getMe } from '@/app/api/me/route';
import { GET as getPreview } from '@/app/api/preview/route';
import { POST as postReact } from '@/app/api/react/route';
import { POST as postClaimRoom } from '@/app/api/rooms/claim/route';
import { POST as postControl } from '@/app/api/rooms/control/route';
import { POST as postJoinRoom } from '@/app/api/rooms/join/route';
import { POST as postCreateRoom } from '@/app/api/rooms/route';
import { POST as postRoomSettings } from '@/app/api/rooms/settings/route';
import { POST as postDecide } from '@/app/api/twitch/decide/route';
import { POST as postPick } from '@/app/api/twitch/pick/route';
import { POST as postClaimInvite } from '@/app/api/invite/claim/route';
import { POST as postReport } from '@/app/api/report/route';
import { POST as postSkip } from '@/app/api/skip/route';
import { GET as getState } from '@/app/api/state/route';
import { POST as postVeto } from '@/app/api/veto/route';
import { POST as postVote } from '@/app/api/vote/route';
import type { RoomId } from '@/config/rooms';
import type { ChatMessage, LiveSnapshot, VideoMeta } from '@/lib/types';
import { db, schema } from '@/server/db/client';
import { advance, withLock } from '@/server/engine';
import { ipHash } from '@/server/ip';
import { K } from '@/server/keys';
import { redis } from '@/server/redis';
import { getNowPlaying } from '@/server/state';
import { touchOnline } from '@/server/steal';
import { slotId } from '@/server/themes';

export const CAPTCHA_OK = 'turnstile-ok';

/** Valid 11-char YouTube ids: vid(1) = "video000001". */
export const vid = (n: number) => `video${String(n).padStart(6, '0')}`;

/** Each viewer is a distinct IP, hence a distinct cooldown and skip/report vote. */
const ip = (viewer: number) => `203.0.113.${viewer}`;

export type ApiBody = { error?: string; message?: string; cooldownEndsAt?: number; [k: string]: unknown };
type Result<T = ApiBody> = { status: number; body: T };

async function call<T = ApiBody>(res: Response | Promise<Response>): Promise<Result<T>> {
  const r = await res;
  return { status: r.status, body: (await r.json()) as T };
}

// Each viewer has a cookie jar, like a browser: private rooms let people in by cookie.
const jars = new Map<number, Map<string, string>>();
export const clearCookies = () => jars.clear();

function keepCookies(viewer: number, res: Response) {
  const jar = jars.get(viewer) ?? new Map<string, string>();
  for (const c of res.headers.getSetCookie()) {
    const pair = c.split(';')[0];
    const i = pair.indexOf('=');
    jar.set(pair.slice(0, i), decodeURIComponent(pair.slice(i + 1)));
  }
  jars.set(viewer, jar);
}

const headersOf = (viewer: number) => ({
  'x-forwarded-for': ip(viewer),
  cookie: [...(jars.get(viewer) ?? [])].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; '),
});

const post = (path: string, body: unknown, viewer: number) =>
  new Request(`http://gtr.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headersOf(viewer) },
    body: JSON.stringify(body),
  });

const get = (path: string, viewer = 1) => new Request(`http://gtr.test${path}`, { headers: headersOf(viewer) });

/** Calls a route as `viewer` and keeps the cookies it sets. */
async function callKeeping<T = ApiBody>(viewer: number, res: Response | Promise<Response>): Promise<Result<T>> {
  const r = await res;
  keepCookies(viewer, r);
  return call<T>(r);
}

type As = { viewer?: number; token?: string };

export const vote = (room: string, videoId: string, { viewer = 1, token = CAPTCHA_OK, url }: As & { url?: string } = {}) =>
  call(postVote(post('/api/vote', { room, url: url ?? `https://youtu.be/${videoId}`, token }, viewer)));

export const skip = (room: string, { viewer = 1, token = CAPTCHA_OK }: As = {}) =>
  call<ApiBody & { skipped?: boolean }>(postSkip(post('/api/skip', { room, token }, viewer)));

export const report = (room: string, { viewer = 1, token = CAPTCHA_OK }: As = {}) =>
  call<ApiBody & { hidden?: boolean }>(postReport(post('/api/report', { room, token }, viewer)));

export const veto = (room: string, { viewer = 1 }: As = {}) =>
  call<ApiBody & { vetoed?: boolean }>(postVeto(post('/api/veto', { room }, viewer)));

export const claimInvite = (room: string, code: string, { viewer = 1 }: As = {}) =>
  call<ApiBody & { boosted?: boolean }>(postClaimInvite(post('/api/invite/claim', { room, code }, viewer)));

export const react = (room: string, emoji: string, { viewer = 1 }: As = {}) =>
  call(postReact(post('/api/react', { room, emoji }, viewer)));

export const chat = (room: string, text: unknown, { viewer = 1, seed = `seed-of-viewer-${viewer}` }: As & { seed?: unknown } = {}) =>
  call<ApiBody & { message: ChatMessage }>(postChat(post('/api/chat', { room, seed, text }, viewer)));

export const chatHistory = (room: string, viewer = 1) =>
  call<ApiBody & { messages: ChatMessage[] }>(getChat(get(`/api/chat?room=${room}`, viewer)));

export const decide = (room: string, choice: string, { viewer = 1, token = CAPTCHA_OK }: As = {}) =>
  call(postDecide(post('/api/twitch/decide', { room, choice, token }, viewer)));

export const pickStream = (room: string, channel: string, { viewer = 1, token = CAPTCHA_OK }: As = {}) =>
  call(postPick(post('/api/twitch/pick', { room, channel, token }, viewer)));

export const createRoom = (room: unknown, { viewer = 1, token = CAPTCHA_OK }: As = {}) =>
  callKeeping<ApiBody & { id: string; password: string; ownerKey: string }>(
    viewer,
    postCreateRoom(post('/api/rooms', { room, token }, viewer)),
  );

export const joinRoom = (room: string, password: string, { viewer = 1 }: As = {}) =>
  callKeeping(viewer, postJoinRoom(post('/api/rooms/join', { room, password }, viewer)));

export const claimRoom = (room: string, key: string, { viewer = 1 }: As = {}) =>
  callKeeping(viewer, postClaimRoom(post('/api/rooms/claim', { room, key }, viewer)));

export const roomSettingsUpdate = (room: string, settings: unknown, { viewer = 1 }: As = {}) =>
  callKeeping<ApiBody & { password: string }>(viewer, postRoomSettings(post('/api/rooms/settings', { room, settings }, viewer)));

export const control = (room: string, action: string, { viewer = 1 }: As = {}) =>
  call(postControl(post('/api/rooms/control', { room, action }, viewer)));

export const state = (room: string, viewer = 1) => call<LiveSnapshot & ApiBody>(getState(get(`/api/state?room=${room}`, viewer)));

export const me = (room: string, viewer = 1) =>
  call<{
    voteCooldownEndsAt: number | null;
    skipped: boolean;
    reported: boolean;
    remote: boolean;
    invite: { code: string; friends: number; need: number; boostEndsAt: number | null } | null;
    decided: string | null;
    picked: string | null;
    owner: boolean;
    password: string | null;
  }>(getMe(get(`/api/me?room=${room}`, viewer)));

export const preview = (room: string, url: string) =>
  call(getPreview(get(`/api/preview?room=${room}&url=${encodeURIComponent(url)}`)));

/** A video as if already fetched from YouTube today, so no lookup ever leaves the process. */
export async function seedVideo(v: Partial<VideoMeta> & { id: string }) {
  await db()
    .insert(schema.videos)
    .values({
      title: `Video ${v.id}`,
      channelId: 'channel-1',
      channelTitle: 'Channel 1',
      durationS: 180,
      viewCount: 1000,
      categoryId: '22',
      thumbnailUrl: `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
      embeddable: true,
      ageRestricted: false,
      audioLanguage: null,
      ...v,
      publishedAt: new Date(v.publishedAt ?? Date.UTC(2020, 0, 1)),
    });
  return v.id;
}

/** What the ticker does when the current video ends: the next one goes on screen. */
export const playNext = async (room: RoomId) => {
  await withLock(room, async () => advance(room, (await getNowPlaying(room)) ? 'finished' : null));
  return getNowPlaying(room);
};

export async function playsOf(videoId: string) {
  return db().select().from(schema.plays).where(eq(schema.plays.videoId, videoId));
}

export async function videoRow(id: string) {
  const [row] = await db().select().from(schema.videos).where(eq(schema.videos.id, id));
  return row;
}

/** Viewers the SSE stream would have registered. */
export async function addViewers(room: RoomId, n: number) {
  for (let i = 0; i < n; i++) await redis().zadd(K.presence(room), Date.now(), `viewer-${i}`);
}

/** A viewer's IP hash, as the routes compute it. */
export const iphOf = (viewer: number) => ipHash(new Headers({ 'x-forwarded-for': ip(viewer) }));

/** What the SSE stream does for a viewer who has the page open. */
export const watching = (room: RoomId, viewer: number) => touchOnline(room, iphOf(viewer));

/** Pins the theme for the current slot and the next one, in case a test straddles the boundary. */
export async function setTheme(id: string | null) {
  const slot = slotId();
  for (const s of [slot, slot + 1]) await redis().set(K.theme(s), id ?? 'none');
}

/** Votes are timestamped to the millisecond; ties are broken by the earliest first vote. */
export const tick = () => new Promise((r) => setTimeout(r, 5));
