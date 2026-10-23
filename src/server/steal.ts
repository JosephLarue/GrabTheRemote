import 'server-only';
import { randomInt } from 'node:crypto';
import { PRESENCE_WINDOW_S, STEAL_EVERY_S, STEAL_HOLD_S, STEAL_VOTER_WINDOW_S } from '@/config/app';
import type { RoomId } from '@/config/rooms';
import { K } from './keys';
import { delIfEquals, redis } from './redis';
import { publish } from './state';

// The stolen remote: once per period, at a random moment, one voter who is watching gets a veto
// over what's playing for STEAL_HOLD_S. Everyone sees the countdown; only the holder sees the button.

export const stealPeriod = (now = Date.now()) => Math.floor(now / 1000 / STEAL_EVERY_S);

/** Called by the live stream with every presence ping. */
export async function touchOnline(room: RoomId, iph: string) {
  await redis().zadd(K.online(room), Date.now(), iph);
}

/** Called on every accepted vote. */
export async function noteVoter(room: RoomId, iph: string) {
  await redis().zadd(K.voters(room), Date.now(), iph);
}

export async function holdsRemote(room: RoomId, iph: string) {
  return (await redis().get(K.steal(room))) === iph;
}

/** Uses up the holder's veto. False if they no longer hold the remote. */
export const takeRemote = (room: RoomId, iph: string) => delIfEquals(K.steal(room), iph);

/** Hands the remote to a random recent voter who is watching. Returns their IP hash, null if nobody qualifies. */
export async function stealRemote(room: RoomId, now = Date.now()): Promise<string | null> {
  const r = redis();
  const [voters, online] = await Promise.all([
    r.zrangebyscore(K.voters(room), now - STEAL_VOTER_WINDOW_S * 1000, '+inf'),
    r.zrangebyscore(K.online(room), now - PRESENCE_WINDOW_S * 1000, '+inf'),
  ]);
  // Nobody else trims these two.
  await Promise.all([
    r.zremrangebyscore(K.voters(room), '-inf', now - STEAL_VOTER_WINDOW_S * 1000),
    r.zremrangebyscore(K.online(room), '-inf', now - PRESENCE_WINDOW_S * 1000),
  ]);
  const here = new Set(online);
  const candidates = voters.filter((v) => here.has(v));
  if (candidates.length === 0) return null;

  const iph = candidates[randomInt(candidates.length)];
  await r.set(K.steal(room), iph, 'PX', STEAL_HOLD_S * 1000);
  await publish(room, { type: 'steal', data: { endsAt: now + STEAL_HOLD_S * 1000 } });
  return iph;
}

// This process's view of each room's current period, so most ticks cost no Redis call.
const plan = new Map<RoomId, { period: number; at: number; drawn: boolean }>();

/**
 * Ticker hook, called while something is playing. The moment is drawn once per period and shared by
 * every instance (SET NX); so is the draw itself. A period with nobody to pick passes without a steal.
 */
export async function maybeStealRemote(room: RoomId, now: number) {
  const period = stealPeriod(now);
  let p = plan.get(room);
  if (p?.period !== period) {
    const ttl = STEAL_EVERY_S * 2;
    const start = period * STEAL_EVERY_S * 1000;
    await redis().set(K.stealAt(room, period), String(start + randomInt(STEAL_EVERY_S * 1000)), 'EX', ttl, 'NX');
    p = { period, at: Number(await redis().get(K.stealAt(room, period))), drawn: false };
    plan.set(room, p);
  }
  if (p.drawn || now < p.at) return;
  p.drawn = true;
  if (await redis().set(K.stealDrawn(room, period), '1', 'EX', STEAL_EVERY_S * 2, 'NX')) await stealRemote(room, now);
}
