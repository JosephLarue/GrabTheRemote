import 'server-only';
import { createHmac } from 'node:crypto';
import {
  INVITE_BOOST_COOLDOWN_S,
  INVITE_BOOST_S,
  INVITE_CLAIMED_TTL_S,
  INVITE_FRIENDS,
  INVITE_WINDOW_S,
  PRESENCE_WINDOW_S,
} from '@/config/app';
import type { RoomId } from '@/config/rooms';
import type { RoomRules } from '@/lib/types';
import { env } from './env';
import { K } from './keys';
import { redis } from './redis';

// Bring friends, vote more often. Every connection has an invite code (an HMAC of its IP hash, so the code
// says nothing about the IP). A newcomer who lands with ?ref=<code>, watches for a bit, and claims, counts as
// one friend for the code's owner, in that room, once. INVITE_FRIENDS friends inside INVITE_WINDOW_S and the
// owner's vote cooldown drops to INVITE_BOOST_COOLDOWN_S for INVITE_BOOST_S.

export type InviteStatus = { code: string; friends: number; need: number; boostEndsAt: number | null };

export const isInviteCode = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{8}$/.test(v);

export function inviteCode(iph: string) {
  return createHmac('sha256', env().IP_HASH_SECRET).update(`invite:${iph}`).digest('base64url').slice(0, 8);
}

/** Keeps code → owner so friends can be credited. Called whenever the owner asks for their status. */
export async function inviteStatus(room: RoomId, iph: string, now = Date.now()): Promise<InviteStatus> {
  const code = inviteCode(iph);
  const r = redis();
  const [, friends, pttl] = await Promise.all([
    r.set(K.inviteCode(code), iph, 'EX', INVITE_CLAIMED_TTL_S),
    r.zcount(K.inviteFriends(room, iph), now - INVITE_WINDOW_S * 1000, '+inf'),
    r.pttl(K.inviteBoost(room, iph)),
  ]);
  return { code, friends, need: INVITE_FRIENDS, boostEndsAt: pttl > 0 ? now + pttl : null };
}

export type ClaimOutcome = 'ok' | 'boosted' | 'unknown' | 'self' | 'not_watching' | 'already';

/** A newcomer (`iph`) credits the owner of `code` in `room`. */
export async function claimInvite(room: RoomId, code: string, iph: string, now = Date.now()): Promise<ClaimOutcome> {
  const r = redis();
  const host = await r.get(K.inviteCode(code));
  if (!host) return 'unknown';
  if (host === iph) return 'self';
  const seen = await r.zscore(K.online(room), iph);
  if (seen === null || Number(seen) < now - PRESENCE_WINDOW_S * 1000) return 'not_watching';
  if (!(await r.set(K.inviteClaimed(room, iph), host, 'EX', INVITE_CLAIMED_TTL_S, 'NX'))) return 'already';

  const friends = K.inviteFriends(room, host);
  await r.multi().zadd(friends, now, iph).zremrangebyscore(friends, '-inf', now - INVITE_WINDOW_S * 1000).expire(friends, INVITE_WINDOW_S).exec();
  if ((await r.zcard(friends)) < INVITE_FRIENDS) return 'ok';
  await r.multi().set(K.inviteBoost(room, host), '1', 'EX', INVITE_BOOST_S).del(friends).exec();
  return 'boosted';
}

/** The vote cooldown this viewer gets in this room right now. */
export async function voteCooldownFor(room: RoomId, iph: string, rules: Pick<RoomRules, 'voteCooldownS'>) {
  const boosted = await redis().exists(K.inviteBoost(room, iph));
  return boosted ? Math.min(rules.voteCooldownS, INVITE_BOOST_COOLDOWN_S) : rules.voteCooldownS;
}
