import { eq } from 'drizzle-orm';
import { REPORT_CARD_S, reportThreshold } from '@/config/app';
import { db, schema } from '@/server/db/client';
import { closePlay, withLock } from '@/server/engine';
import { ApiError, handle, ok, openRoom } from '@/server/http';
import { ipHash } from '@/server/ip';
import { K } from '@/server/keys';
import { removeCandidate } from '@/server/pool';
import { rateLimit } from '@/server/ratelimit';
import { redis } from '@/server/redis';
import { getNowPlaying, publish, reportState, setNowPlaying, viewerCount } from '@/server/state';
import { verifyTurnstile } from '@/server/turnstile';
import { invalidateMeta } from '@/server/youtube';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req: Request) => {
  const iph = ipHash(req.headers);
  await rateLimit('report', iph, 10, 60);
  const body = (await req.json().catch(() => ({}))) as { room?: string; token?: string };
  const { room, settings } = await openRoom(req, body.room, { kind: 'youtube' });
  if (!settings.rules.report) throw new ApiError(403, 'report_off', 'The streamer turned reports off in this room 🚨');

  const np = await getNowPlaying(room);
  if (!np || np.state !== 'playing') throw new ApiError(409, 'nothing', 'Nothing to report right now 🤷');
  await verifyTurnstile(body.token, req.headers);

  if (!(await redis().sadd(K.reportVotes(np.playId), iph))) {
    throw new ApiError(409, 'already', 'Already reported. The crowd has been notified 🚨');
  }
  const viewers = await viewerCount(room);
  const votes = await redis().scard(K.reportVotes(np.playId));

  let hidden = false;
  if (votes >= reportThreshold(viewers)) {
    await withLock(room, async () => {
      const cur = await getNowPlaying(room);
      if (cur?.playId !== np.playId || cur.state !== 'playing') return;
      await closePlay(cur, 'reported');
      // Blocked from re-submission until an admin clears or bans it.
      await db().update(schema.videos).set({ flagged: true }).where(eq(schema.videos.id, cur.video.id));
      await invalidateMeta(cur.video.id);
      await removeCandidate(room, cur.video.id);
      const card = { ...cur, state: 'reported_card' as const, endsAt: Date.now() + REPORT_CARD_S * 1000 };
      await setNowPlaying(room, card);
      await publish(room, { type: 'nowplaying', data: card });
      hidden = true;
    });
  }
  await publish(room, { type: 'report', data: await reportState(np.playId, viewers) });
  return ok({ ok: true, hidden });
});
