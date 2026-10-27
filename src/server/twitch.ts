import 'server-only';
import { randomInt } from 'node:crypto';
import {
  TWITCH_DECIDE_S,
  TWITCH_LIVE_CHECK_S,
  TWITCH_PICK_MAX_S,
  TWITCH_PICK_MIN_S,
  TWITCH_SLOT_S,
} from '@/config/app';
import type { RoomId } from '@/config/rooms';
import type { TwitchChannel, TwitchLive, TwitchPhase } from '@/lib/types';
import { K } from './keys';
import { streamRefusal } from './moderation';
import { redis } from './redis';
import { checkLive } from './twitch-api';

// The Twitch room's state machine. One stream plays for TWITCH_SLOT_S, then the couch has TWITCH_DECIDE_S to
// vote keep or change. Change wins (strictly more votes) → a pick window of random length opens and the most
// voted live channel takes over; nobody picks → the current stream stays. Keep wins or ties → another slot.
// Every round has its own vote keys, so nothing needs resetting.

type Stored = {
  channel: TwitchChannel | null;
  phase: TwitchPhase;
  phaseEndsAt: number;
  round: number;
  suggestions: TwitchChannel[];
  /** Last time the current stream's live status was checked. */
  checkedAt: number;
};

const VOTES_TTL_S = 3600;
const RECENT_MAX = 20;
const SUGGESTIONS_MAX = 6;

async function load(room: RoomId): Promise<Stored | null> {
  const raw = await redis().get(K.twitch(room));
  return raw ? (JSON.parse(raw) as Stored) : null;
}

const save = (room: RoomId, s: Stored) => redis().set(K.twitch(room), JSON.stringify(s));

async function candidates(room: RoomId, round: number): Promise<TwitchLive['candidates']> {
  const [flat, info] = await Promise.all([
    redis().zrevrange(K.twitchPick(room, round), 0, -1, 'WITHSCORES'),
    redis().hgetall(K.twitchPickInfo(room, round)),
  ]);
  const out: { first: number; entry: TwitchLive['candidates'][number] }[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    const raw = info[flat[i]];
    if (!raw) continue;
    const { first, channel } = JSON.parse(raw) as { first: number; channel: TwitchChannel };
    out.push({ first, entry: { ...channel, votes: Number(flat[i + 1]) } });
  }
  // Ties: the channel nominated first wins.
  return out.sort((a, b) => b.entry.votes - a.entry.votes || a.first - b.first).map((c) => c.entry);
}

async function tally(room: RoomId, round: number): Promise<TwitchLive['tally']> {
  const votes = await redis().hvals(K.twitchDecide(room, round));
  return { keep: votes.filter((v) => v === 'keep').length, change: votes.filter((v) => v === 'change').length };
}

/** What every viewer sees. */
export async function twitchLive(room: RoomId): Promise<TwitchLive> {
  const s = await load(room);
  if (!s) return { channel: null, phase: 'watching', phaseEndsAt: 0, round: 0, tally: { keep: 0, change: 0 }, candidates: [], suggestions: [] };
  const [t, c] = await Promise.all([
    tally(room, s.round),
    s.phase === 'picking' ? candidates(room, s.round) : Promise.resolve([]),
  ]);
  return {
    channel: s.channel,
    phase: s.phase,
    phaseEndsAt: s.phaseEndsAt,
    round: s.round,
    tally: t,
    candidates: c,
    suggestions: s.phase === 'picking' ? s.suggestions : [],
  };
}

/** Puts a channel on screen for a fresh slot: the admin's pin, or the winner of a pick window. */
export async function startChannel(room: RoomId, channel: TwitchChannel, now = Date.now()) {
  const s = await load(room);
  await save(room, {
    channel,
    phase: 'watching',
    phaseEndsAt: now + TWITCH_SLOT_S * 1000,
    round: s?.round ?? 0,
    suggestions: [],
    checkedAt: now,
  });
  await redis()
    .multi()
    .lrem(K.twitchRecent(room), 0, channel.login)
    .lpush(K.twitchRecent(room), channel.login)
    .ltrim(K.twitchRecent(room), 0, RECENT_MAX - 1)
    .exec();
}

/** Recent channels that are live and allowed right now, the current one excluded. */
async function suggestions(room: RoomId, current: string | undefined): Promise<TwitchChannel[]> {
  const recent = (await redis().lrange(K.twitchRecent(room), 0, -1)).filter((l) => l !== current);
  const live = await checkLive(recent).catch(() => new Map());
  const out: TwitchChannel[] = [];
  for (const login of recent) {
    const c = live.get(login);
    if (c?.status === 'live' && !(await streamRefusal(login, c.channel.title))) out.push(c.channel);
    if (out.length >= SUGGESTIONS_MAX) break;
  }
  return out;
}

async function openPick(room: RoomId, s: Stored, now: number) {
  s.phase = 'picking';
  s.phaseEndsAt = now + randomInt(TWITCH_PICK_MIN_S, TWITCH_PICK_MAX_S + 1) * 1000;
  s.suggestions = await suggestions(room, s.channel?.login);
}

/**
 * Ticker step, inside the room lock. Returns true when what viewers see changed (phase, stream info),
 * so the ticker publishes it.
 */
export async function tickTwitch(room: RoomId, now: number): Promise<boolean> {
  const s = await load(room);
  if (!s?.channel) return false;

  let changed = false;
  if (s.phase === 'watching' && now - s.checkedAt >= TWITCH_LIVE_CHECK_S * 1000) {
    s.checkedAt = now;
    changed = true;
    // Twitch being down is not the streamer going offline: keep watching.
    const check = (await checkLive([s.channel.login]).catch(() => null))?.get(s.channel.login);
    if (check?.status === 'live') {
      s.channel = check.channel;
    } else if (check) {
      s.round++;
      await openPick(room, s, now);
      await save(room, s);
      return true;
    }
  }
  if (now < s.phaseEndsAt) {
    if (changed) await save(room, s);
    return changed;
  }

  switch (s.phase) {
    case 'watching':
      s.round++;
      s.phase = 'deciding';
      s.phaseEndsAt = now + TWITCH_DECIDE_S * 1000;
      break;
    case 'deciding': {
      const { keep, change } = await tally(room, s.round);
      if (change > keep) await openPick(room, s, now);
      else {
        s.phase = 'watching';
        s.phaseEndsAt = now + TWITCH_SLOT_S * 1000;
      }
      break;
    }
    case 'picking': {
      const [winner] = await candidates(room, s.round);
      if (winner) {
        const { login, name, title, game, viewers } = winner;
        await startChannel(room, { login, name, title, game, viewers }, now);
        return true;
      }
      s.phase = 'watching';
      s.phaseEndsAt = now + TWITCH_SLOT_S * 1000;
      s.suggestions = [];
      break;
    }
  }
  await save(room, s);
  return true;
}

/** Admin: skips the deciding vote and opens a pick window now. */
export async function forceChange(room: RoomId, now = Date.now()) {
  const s = await load(room);
  if (!s?.channel) return;
  s.round++;
  await openPick(room, s, now);
  await save(room, s);
}

export type DecideResult = 'ok' | 'closed' | 'already';

export async function voteDecide(room: RoomId, iph: string, choice: 'keep' | 'change'): Promise<DecideResult> {
  const s = await load(room);
  if (!s || s.phase !== 'deciding' || Date.now() >= s.phaseEndsAt) return 'closed';
  const key = K.twitchDecide(room, s.round);
  if (!(await redis().hsetnx(key, iph, choice))) return 'already';
  await redis().multi().expire(key, VOTES_TTL_S).set(K.twitchDirty(room), '1').exec();
  return 'ok';
}

export type PickResult =
  | { status: 'ok'; channel: TwitchChannel }
  | { status: 'closed' | 'already' | 'current' | 'offline' | 'mature' | 'banned_channel' | 'blocked_keyword' };

export async function votePick(room: RoomId, iph: string, login: string): Promise<PickResult> {
  const s = await load(room);
  if (!s || s.phase !== 'picking' || Date.now() >= s.phaseEndsAt) return { status: 'closed' };
  if (login === s.channel?.login) return { status: 'current' };
  const picked = K.twitchPicked(room, s.round);
  if (await redis().hexists(picked, iph)) return { status: 'already' };

  // Someone already nominated it in this window: it was checked seconds ago.
  const known = await redis().hget(K.twitchPickInfo(room, s.round), login);
  let channel: TwitchChannel;
  if (known) channel = (JSON.parse(known) as { channel: TwitchChannel }).channel;
  else {
    const check = (await checkLive([login])).get(login);
    if (!check || check.status !== 'live') return { status: check?.status === 'mature' ? 'mature' : 'offline' };
    const refusal = await streamRefusal(login, check.channel.title);
    if (refusal) return { status: refusal };
    channel = check.channel;
  }

  if (!(await redis().hsetnx(picked, iph, login))) return { status: 'already' };
  const pick = K.twitchPick(room, s.round);
  const info = K.twitchPickInfo(room, s.round);
  await redis()
    .multi()
    .zincrby(pick, 1, login)
    .hsetnx(info, login, JSON.stringify({ first: Date.now(), channel }))
    .expire(pick, VOTES_TTL_S)
    .expire(info, VOTES_TTL_S)
    .expire(picked, VOTES_TTL_S)
    .set(K.twitchDirty(room), '1')
    .exec();
  return { status: 'ok', channel };
}

/** This viewer's votes in the current round, for /api/me. */
export async function myTwitchVotes(room: RoomId, iph: string) {
  const s = await load(room);
  if (!s) return { decided: null, picked: null };
  const [decided, picked] = await Promise.all([
    redis().hget(K.twitchDecide(room, s.round), iph),
    redis().hget(K.twitchPicked(room, s.round), iph),
  ]);
  return { decided: decided as 'keep' | 'change' | null, picked };
}
