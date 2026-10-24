import { REACTIONS } from '@/config/app';
import { ApiError, handle, ok, openRoom } from '@/server/http';
import { ipHash } from '@/server/ip';
import { addReaction } from '@/server/reactions';
import { rateLimit } from '@/server/ratelimit';

export const dynamic = 'force-dynamic';

// Fixed emoji set, no text: nothing to moderate. No captcha either; the rate limit is the only gate.
export const POST = handle(async (req: Request) => {
  const iph = ipHash(req.headers);
  await rateLimit('react', iph, 20, 10);
  const body = (await req.json().catch(() => ({}))) as { room?: string; emoji?: string };
  const { room } = await openRoom(req, body.room);
  if (!(REACTIONS as readonly unknown[]).includes(body.emoji)) {
    throw new ApiError(400, 'bad_reaction', 'That reaction is not on the couch 🙃');
  }
  addReaction(room, body.emoji!);
  return ok();
});
