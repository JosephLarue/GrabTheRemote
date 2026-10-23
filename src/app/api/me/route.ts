import { handle, ok, roomFromUrl } from '@/server/http';
import { ipHash } from '@/server/ip';
import { K } from '@/server/keys';
import { redis } from '@/server/redis';
import { getNowPlaying } from '@/server/state';

export const dynamic = 'force-dynamic';

/** Per-viewer state the live stream doesn't carry (it is the same for everyone). */
export const GET = handle(async (req: Request) => {
  const room = roomFromUrl(req);
  const iph = ipHash(req.headers);
  const np = await getNowPlaying(room);
  const [voteTtl, skipped, reported] = await Promise.all([
    redis().pttl(K.voteCd(room, iph)),
    np ? redis().sismember(K.skipVotes(np.playId), iph) : 0,
    np ? redis().sismember(K.reportVotes(np.playId), iph) : 0,
  ]);
  return ok({
    voteCooldownEndsAt: voteTtl > 0 ? Date.now() + voteTtl : null,
    skipped: skipped === 1,
    reported: reported === 1,
  });
});
