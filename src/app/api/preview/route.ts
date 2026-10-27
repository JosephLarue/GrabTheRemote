import { parseYouTubeId } from '@/lib/youtube-id';
import { ApiError, handle, ok, openRoom } from '@/server/http';
import { ipHash } from '@/server/ip';
import { assertAllowed, assertFitsRoom } from '@/server/moderation';
import { poolHas } from '@/server/pool';
import { rateLimit } from '@/server/ratelimit';
import { themeFor } from '@/server/room-settings';
import { preview } from '@/server/youtube';

export const dynamic = 'force-dynamic';

/** Never spends YouTube quota: cached metadata, else free oEmbed. */
export const GET = handle(async (req: Request) => {
  const { room, settings } = await openRoom(req, new URL(req.url).searchParams.get('room'), { kind: 'youtube' });
  await rateLimit('preview', ipHash(req.headers), 60, 60);
  const id = parseYouTubeId(new URL(req.url).searchParams.get('url') ?? '');
  if (!id) throw new ApiError(400, 'bad_url', "That's not a YouTube link we recognize 🤔");

  const p = await preview(id);
  if (p.status !== 'ok') {
    if (p.status === 'missing') throw new ApiError(404, 'not_found', "Couldn't find that video. Private or deleted? 👻");
    throw new ApiError(422, 'not_embeddable', "This video doesn't allow playing outside YouTube. Pick another one 📵");
  }

  // Full checks only when metadata is already cached; otherwise the vote itself decides.
  let problem: string | null = null;
  let problemCode: string | null = null;
  let matchesTheme: boolean | null = null;
  if (p.meta) {
    try {
      await assertAllowed(p.meta, settings.rules);
      assertFitsRoom(settings.rules, p.meta);
    } catch (e) {
      problem = e instanceof ApiError ? e.message : null;
      problemCode = e instanceof ApiError ? e.code : null;
    }
    const theme = await themeFor(room, settings);
    matchesTheme = theme ? theme.check(p.meta) : true;
  }
  return ok({ video: p.video, inPool: await poolHas(room, id), problem, problemCode, matchesTheme });
});
