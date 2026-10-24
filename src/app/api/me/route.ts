import { isTwitchRoom } from '@/config/rooms';
import { handle, ok, openRoom } from '@/server/http';
import { ipHash } from '@/server/ip';
import { K } from '@/server/keys';
import { getPrivateRoom } from '@/server/private-rooms';
import { redis } from '@/server/redis';
import { getNowPlaying } from '@/server/state';
import { holdsRemote } from '@/server/steal';
import { myTwitchVotes } from '@/server/twitch';

export const dynamic = 'force-dynamic';

/** Per-viewer state the live stream doesn't carry (it is the same for everyone). */
export const GET = handle(async (req: Request) => {
  const { room, access } = await openRoom(req, new URL(req.url).searchParams.get('room'));
  const iph = ipHash(req.headers);
  const np = await getNowPlaying(room);
  const [voteTtl, skipped, reported, remote, twitch] = await Promise.all([
    redis().pttl(K.voteCd(room, iph)),
    np ? redis().sismember(K.skipVotes(np.playId), iph) : 0,
    np ? redis().sismember(K.reportVotes(np.playId), iph) : 0,
    holdsRemote(room, iph),
    isTwitchRoom(room) ? myTwitchVotes(room, iph) : { decided: null, picked: null },
  ]);
  return ok({
    voteCooldownEndsAt: voteTtl > 0 ? Date.now() + voteTtl : null,
    skipped: skipped === 1,
    reported: reported === 1,
    remote,
    owner: access.owner,
    // The streamer shows it on stream: only they get it back.
    password: access.owner ? ((await getPrivateRoom(room))?.password ?? null) : null,
    ...twitch,
  });
});
