import { ApiError, handle, ok, openRoom } from '@/server/http';
import { shameEntries } from '@/server/hall';

export const dynamic = 'force-dynamic';

const MAX_IDS = 60;

/** The Hall of Shame rows for a browser's collection (its card ids live in its local storage). */
export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  const { room } = await openRoom(req, url.searchParams.get('room'), { kind: 'youtube' });
  const ids = (url.searchParams.get('ids') ?? '')
    .split(',')
    .map((s) => Number(s))
    .filter((n) => Number.isSafeInteger(n) && n > 0);
  if (ids.length > MAX_IDS) throw new ApiError(400, 'too_many', `At most ${MAX_IDS} cards at a time 🃏`);
  return ok({ rows: ids.length ? await shameEntries(room, ids) : [] });
});
