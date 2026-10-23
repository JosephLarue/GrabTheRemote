import { eq } from 'drizzle-orm';
import { REPORT_CARD_S, reportThreshold } from '@/config/app';
import { db, schema } from '@/server/db/client';
import { closePlay, withLock } from '@/server/engine';
import { ApiError, handle, ok } from '@/server/http';
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
  const body = (await req.json().catch(() => ({}))) as { token?: string };

  const np = await getNowPlaying();
  if (!np || np.state !== 'playing') throw new ApiError(409, 'nothing', 'Nothing to report right now 🤷');
  await verifyTurnstile(body.token, req.headers);

  if (!(await redis().sadd(K.reportVotes(np.playId), iph))) {
    throw new ApiError(409, 'already', 'Already reported. The crowd has been notified 🚨');
  }
  const viewers = await viewerCount();
  const votes = await redis().scard(K.reportVotes(np.playId));

  let hidden = false;
  if (votes >= reportThreshold(viewers)) {
    await withLock(async () => {
      const cur = await getNowPlaying();
      if (cur?.playId !== np.playId || cur.state !== 'playing') return;
      await closePlay(cur, 'reported');
      // Blocked from re-submission until an admin clears or bans it.
      await db().update(schema.videos).set({ flagged: true }).where(eq(schema.videos.id, cur.video.id));
      await invalidateMeta(cur.video.id);
      await removeCandidate(cur.video.id);
      const card = { ...cur, state: 'reported_card' as const, endsAt: Date.now() + REPORT_CARD_S * 1000 };
      await setNowPlaying(card);
      await publish({ type: 'nowplaying', data: card });
      hidden = true;
    });
  }
  await publish({ type: 'report', data: await reportState(np.playId, viewers) });
  return ok({ ok: true, hidden });
});
