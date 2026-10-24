import 'server-only';
import { TWITCH_BLOCKED_LABELS } from '@/config/app';
import type { TwitchChannel } from '@/lib/types';
import { env } from './env';
import { K } from './keys';
import { redis } from './redis';

export class TwitchUnavailableError extends Error {}

export const twitchConfigured = () => Boolean(env().TWITCH_CLIENT_ID && env().TWITCH_CLIENT_SECRET);

/** App access token (client credentials), cached until shortly before it expires. */
async function appToken(): Promise<string> {
  const hit = await redis().get(K.twitchToken);
  if (hit) return hit;
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: env().TWITCH_CLIENT_ID,
      client_secret: env().TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new TwitchUnavailableError(`token: ${res.status}`);
  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
  await redis().set(K.twitchToken, access_token, 'EX', Math.max(60, expires_in - 300));
  return access_token;
}

async function helix<T>(path: string, params: [string, string][]): Promise<T[]> {
  const url = new URL(`https://api.twitch.tv/helix/${path}`);
  for (const [k, v] of params) url.searchParams.append(k, v);
  const call = async () =>
    fetch(url, {
      headers: { 'Client-Id': env().TWITCH_CLIENT_ID, Authorization: `Bearer ${await appToken()}` },
      signal: AbortSignal.timeout(5000),
    });
  let res = await call();
  if (res.status === 401) {
    // Revoked or rotated: get a fresh token once.
    await redis().del(K.twitchToken);
    res = await call();
  }
  if (!res.ok) throw new TwitchUnavailableError(`${path}: ${res.status}`);
  return ((await res.json()) as { data: T[] }).data;
}

type Stream = { user_id: string; user_login: string; user_name: string; game_name: string; title: string; viewer_count: number };
type ChannelInfo = { broadcaster_id: string; content_classification_labels?: string[] };

export type LiveCheck = { status: 'live'; channel: TwitchChannel } | { status: 'offline' } | { status: 'mature' };

/**
 * Live status of up to 100 channels, by login. Channels with a blocked content label come back 'mature'.
 * Without API credentials (dev), every channel counts as live and we know nothing else about it.
 */
export async function checkLive(logins: string[]): Promise<Map<string, LiveCheck>> {
  const out = new Map<string, LiveCheck>();
  if (logins.length === 0) return out;
  if (!twitchConfigured()) {
    for (const login of logins) out.set(login, { status: 'live', channel: { login, name: login, title: '', game: '', viewers: null } });
    return out;
  }
  const streams = await helix<Stream>('streams', logins.slice(0, 100).map((l) => ['user_login', l]));
  const infos = streams.length ? await helix<ChannelInfo>('channels', streams.map((s) => ['broadcaster_id', s.user_id])) : [];
  const labels = new Map(infos.map((i) => [i.broadcaster_id, i.content_classification_labels ?? []]));

  for (const login of logins) out.set(login, { status: 'offline' });
  for (const s of streams) {
    const login = s.user_login.toLowerCase();
    const mature = (labels.get(s.user_id) ?? []).some((l) => TWITCH_BLOCKED_LABELS.includes(l));
    out.set(
      login,
      mature
        ? { status: 'mature' }
        : { status: 'live', channel: { login, name: s.user_name, title: s.title, game: s.game_name, viewers: s.viewer_count } },
    );
  }
  return out;
}
