import { advance, closePrivateRoom, pausePlayback, resumePlayback, withLock } from '@/server/engine';
import { ApiError, handle, ok, openRoom } from '@/server/http';
import { getNowPlaying } from '@/server/state';

export const dynamic = 'force-dynamic';

const ACTIONS = ['pause', 'resume', 'skip', 'close'] as const;
type Action = (typeof ACTIONS)[number];

/** The streamer's remote: pause or resume everyone's screen, skip what's playing, or close the room. */
export const POST = handle(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { room?: string; action?: string };
  const { room } = await openRoom(req, body.room, { kind: 'youtube', owner: true });
  if (!(ACTIONS as readonly unknown[]).includes(body.action)) throw new ApiError(400, 'bad_action', 'Unknown action 🤷');
  const action = body.action as Action;

  if (action === 'close') {
    await closePrivateRoom(room);
    return ok({ ok: true });
  }

  const done = await withLock(room, async () => {
    if (action === 'pause') return Boolean(await pausePlayback(room));
    if (action === 'resume') return Boolean(await resumePlayback(room));
    if (!(await getNowPlaying(room))) return false;
    await advance(room, 'admin');
    return true;
  });
  if (!done) throw new ApiError(409, 'nothing', 'Nothing to do right now 🤷');
  return ok({ ok: true });
});
