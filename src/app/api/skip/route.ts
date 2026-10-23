import { SKIP_COOLDOWN_S, skipThreshold } from '@/config/app';
import { advance, withLock } from '@/server/engine';
import { ApiError, handle, ok } from '@/server/http';
import { ipHash } from '@/server/ip';
import { K } from '@/server/keys';
import { rateLimit } from '@/server/ratelimit';
import { redis } from '@/server/redis';
import { getNowPlaying, publish, skipState, viewerCount } from '@/server/state';
import { verifyTurnstile } from '@/server/turnstile';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req: Request) => {
  const iph = ipHash(req.headers);
  await rateLimit('skip', iph, 10, 60);
  const body = (await req.json().catch(() => ({}))) as { token?: string };

  const np = await getNowPlaying();
  if (!np || np.state !== 'playing') throw new ApiError(409, 'nothing', 'Nothing to skip right now 🤷');
  const cd = await redis().pttl(K.skipGlobalCd);
  if (cd > 0) {
    throw new ApiError(423, 'skip_cooldown', 'The skip button is overheating 🔥 Wait for it to cool down.', {
      cooldownEndsAt: Date.now() + cd,
    });
  }
  await verifyTurnstile(body.token, req.headers);

  if (!(await redis().sadd(K.skipVotes(np.playId), iph))) {
    throw new ApiError(409, 'already', 'You already smashed skip on this one 🔴');
  }
  const viewers = await viewerCount();
  const votes = await redis().scard(K.skipVotes(np.playId));

  let skipped = false;
  if (votes >= skipThreshold(viewers)) {
    await withLock(async () => {
      const cur = await getNowPlaying();
      if (cur?.playId !== np.playId || cur.state !== 'playing') return;
      if (!(await redis().set(K.skipGlobalCd, '1', 'EX', SKIP_COOLDOWN_S, 'NX'))) return;
      await advance('skipped');
      skipped = true;
    });
  }
  const cur = await getNowPlaying();
  await publish({ type: 'skip', data: await skipState(cur?.playId, viewers) });
  return ok({ ok: true, skipped });
});
