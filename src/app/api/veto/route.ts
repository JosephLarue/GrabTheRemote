import { advance, withLock } from '@/server/engine';
import { ApiError, handle, ok, roomOf } from '@/server/http';
import { ipHash } from '@/server/ip';
import { rateLimit } from '@/server/ratelimit';
import { getNowPlaying, publish } from '@/server/state';
import { holdsRemote, takeRemote } from '@/server/steal';

export const dynamic = 'force-dynamic';

const noRemote = () => new ApiError(403, 'no_remote', "You don't have the remote 🫳");

// The stolen remote's one-shot veto: no captcha (the holder passed one to vote, and has 60 seconds),
// no threshold, no skip cooldown.
export const POST = handle(async (req: Request) => {
  const iph = ipHash(req.headers);
  await rateLimit('veto', iph, 10, 60);
  const body = (await req.json().catch(() => ({}))) as { room?: string };
  const room = roomOf(body.room);
  if (!(await holdsRemote(room, iph))) throw noRemote();

  const outcome = await withLock(room, async () => {
    const np = await getNowPlaying(room);
    if (!np || np.state !== 'playing') return 'nothing';
    if (!(await takeRemote(room, iph))) return 'gone';
    await advance(room, 'vetoed');
    return 'vetoed';
  });
  if (outcome === 'gone') throw noRemote();
  if (outcome !== 'vetoed') throw new ApiError(409, 'nothing', 'Nothing to veto right now 🤷');
  await publish(room, { type: 'steal', data: null });
  return ok({ ok: true, vetoed: true });
});
