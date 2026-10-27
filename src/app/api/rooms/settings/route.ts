import { roomInputSchema, toSettings } from '@/lib/private-room';
import { ApiError, handle, ok, openRoom } from '@/server/http';
import { accessCookie, accessCookieValue, cookieOptions, updatePrivateRoom } from '@/server/private-rooms';
import { markPoolDirty, publish } from '@/server/state';

export const dynamic = 'force-dynamic';

/**
 * The streamer edits their room. Applies at once for everyone: look, rules, themes. A new password locks out
 * everyone who entered the old one (the streamer keeps their access).
 */
export const POST = handle(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { room?: string; settings?: unknown };
  const { room } = await openRoom(req, body.room, { owner: true });
  const input = roomInputSchema.safeParse(body.settings);
  if (!input.success) throw new ApiError(400, 'bad_settings', 'Some room settings are missing or invalid 🛠️');

  const s = await updatePrivateRoom(room, toSettings(input.data), input.data.password);
  if (!s) throw new ApiError(404, 'room_gone', 'This room is closed 🚪');
  await publish(room, { type: 'room', data: s.settings });
  // The theme rule may have changed which queued videos fit.
  await markPoolDirty(room);

  const res = ok({ ok: true, password: s.password });
  res.cookies.set(accessCookie(room), accessCookieValue(room, s), cookieOptions);
  return res;
});
