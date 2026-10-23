import { VOTE_COOLDOWN_S } from '@/config/app';
import { parseYouTubeId } from '@/lib/youtube-id';
import { ApiError, handle, ok, roomOf } from '@/server/http';
import { ipHash } from '@/server/ip';
import { K } from '@/server/keys';
import { assertAllowed, assertFitsRoom } from '@/server/moderation';
import { addVote } from '@/server/pool';
import { rateLimit } from '@/server/ratelimit';
import { redis } from '@/server/redis';
import { getNowPlaying, markPoolDirty } from '@/server/state';
import { currentTheme } from '@/server/themes';
import { verifyTurnstile } from '@/server/turnstile';
import { QuotaExhaustedError, getMeta } from '@/server/youtube';

export const dynamic = 'force-dynamic';

const cooldownError = (ttlS: number) =>
  new ApiError(429, 'cooldown', 'Hands off the remote! Your cooldown is still running ✋', {
    cooldownEndsAt: Date.now() + ttlS * 1000,
  });

export const POST = handle(async (req: Request) => {
  const iph = ipHash(req.headers);
  await rateLimit('vote', iph, 20, 60);

  const body = (await req.json().catch(() => ({}))) as { room?: string; url?: string; token?: string };
  const room = roomOf(body.room);
  const id = parseYouTubeId(body.url ?? '');
  if (!id) throw new ApiError(400, 'bad_url', "That's not a YouTube link we recognize 🤔");

  // Cheap checks before the captcha round-trip and any quota spend.
  const ttl = await redis().ttl(K.voteCd(room, iph));
  if (ttl > 0) throw cooldownError(ttl);

  await verifyTurnstile(body.token, req.headers);

  let meta;
  try {
    meta = await getMeta(id, { allowFetch: true });
  } catch (e) {
    if (e instanceof QuotaExhaustedError) {
      throw new ApiError(503, 'quota', "The remote's batteries are dying, try a link someone already posted 🔋");
    }
    throw e;
  }
  if (!meta) throw new ApiError(404, 'not_found', "Couldn't find that video. Private or deleted? 👻");
  await assertAllowed(meta);
  assertFitsRoom(room, meta);

  const np = await getNowPlaying(room);
  if (np?.video.id === id) throw new ApiError(409, 'now_playing', "That's literally on screen right now 📺");

  const theme = await currentTheme();
  if (theme && !theme.check(meta)) {
    throw new ApiError(422, 'theme', `Doesn't fit the theme: ${theme.emoji} ${theme.label}`);
  }

  if (!(await redis().set(K.voteCd(room, iph), '1', 'EX', VOTE_COOLDOWN_S, 'NX'))) {
    throw cooldownError(await redis().ttl(K.voteCd(room, iph)));
  }
  await addVote(room, id);
  await markPoolDirty(room);

  return ok({ ok: true, videoId: id, cooldownEndsAt: Date.now() + VOTE_COOLDOWN_S * 1000 });
});
