import { ApiError, handle, ok, openRoom } from '@/server/http';
import { claimInvite, isInviteCode } from '@/server/invite';
import { ipHash } from '@/server/ip';
import { rateLimit } from '@/server/ratelimit';

export const dynamic = 'force-dynamic';

// A newcomer who arrived through an invite link credits their friend. No captcha: the newcomer must already be
// watching (the live stream registers them), and each connection counts once per room.
export const POST = handle(async (req: Request) => {
  const iph = ipHash(req.headers);
  await rateLimit('invite', iph, 10, 60);
  const body = (await req.json().catch(() => ({}))) as { room?: string; code?: unknown };
  const { room } = await openRoom(req, body.room, { kind: 'youtube' });
  if (!isInviteCode(body.code)) throw new ApiError(400, 'bad_invite', "That invite link doesn't look right 🎟️");
  const outcome = await claimInvite(room, body.code, iph);
  if (outcome === 'unknown') throw new ApiError(404, 'bad_invite', 'That invite has expired 🎟️');
  if (outcome === 'self') throw new ApiError(409, 'self_invite', "You can't be your own friend. Well, you can, but it doesn't count 🪞");
  if (outcome === 'not_watching') throw new ApiError(409, 'not_watching', 'Sit on the couch first 🛋️');
  if (outcome === 'already') throw new ApiError(409, 'already_friend', 'You already counted for someone in this room 🎟️');
  return ok({ ok: true, boosted: outcome === 'boosted' });
});
