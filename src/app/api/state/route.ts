import { handle, ok, openRoom } from '@/server/http';
import { ipHash } from '@/server/ip';
import { rateLimit } from '@/server/ratelimit';
import { snapshot } from '@/server/state';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  // Generous: the client only falls back to polling when the stream drops.
  await rateLimit('state', ipHash(req.headers), 120, 60);
  return ok(await snapshot((await openRoom(req, new URL(req.url).searchParams.get('room'))).room));
});
