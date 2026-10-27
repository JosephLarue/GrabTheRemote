import { isPrivateRoom } from '@/config/rooms';
import { ApiError, handle, ok } from '@/server/http';
import { ipHash } from '@/server/ip';
import { accessCookie, accessCookieValue, cookieOptions, getPrivateRoom, passwordMatches } from '@/server/private-rooms';
import { rateLimit } from '@/server/ratelimit';

export const dynamic = 'force-dynamic';

/** A viewer enters a private room with the password the streamer gave their chat. */
export const POST = handle(async (req: Request) => {
  // Tight on purpose: passwords are short, guessing them must stay slow.
  await rateLimit('join', ipHash(req.headers), 10, 600);
  const body = (await req.json().catch(() => ({}))) as { room?: string; password?: string };
  const room = String(body.room ?? '').trim().toLowerCase();
  const s = isPrivateRoom(room) ? await getPrivateRoom(room) : null;
  if (!isPrivateRoom(room) || !s) throw new ApiError(404, 'room_gone', 'No room with that ID. Check it with the streamer 🚪');
  if (!passwordMatches(s, String(body.password ?? ''))) throw new ApiError(403, 'bad_password', 'Wrong password 🔒');

  const res = ok({ ok: true, room });
  res.cookies.set(accessCookie(room), accessCookieValue(room, s), cookieOptions);
  return res;
});
