import { ApiError, handle, ok, twitchRoomOf } from '@/server/http';
import { ipHash } from '@/server/ip';
import { rateLimit } from '@/server/ratelimit';
import { verifyTurnstile } from '@/server/turnstile';
import { voteDecide } from '@/server/twitch';

export const dynamic = 'force-dynamic';

/** Keep or change the stream, while the deciding window is open. One vote per connection per round. */
export const POST = handle(async (req: Request) => {
  const iph = ipHash(req.headers);
  await rateLimit('twitch-decide', iph, 10, 60);
  const body = (await req.json().catch(() => ({}))) as { room?: string; choice?: string; token?: string };
  const room = twitchRoomOf(body.room);
  if (body.choice !== 'keep' && body.choice !== 'change') {
    throw new ApiError(400, 'bad_choice', 'Keep it or change it, those are the options 🤷');
  }
  await verifyTurnstile(body.token, req.headers);

  const result = await voteDecide(room, iph, body.choice);
  if (result === 'closed') throw new ApiError(409, 'decide_closed', 'The vote is closed. Next one at the end of the slot ⏳');
  if (result === 'already') throw new ApiError(409, 'already_decided', 'You already voted on this one 🗳️');
  return ok({ ok: true, choice: body.choice });
});
