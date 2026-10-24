import { isPrivateRoom } from '@/config/rooms';
import { ApiError, handle, ok } from '@/server/http';
import { ipHash } from '@/server/ip';
import {
  accessCookie,
  accessCookieValue,
  cookieOptions,
  getPrivateRoom,
  ownerCookie,
  ownerKeyMatches,
} from '@/server/private-rooms';
import { rateLimit } from '@/server/ratelimit';

export const dynamic = 'force-dynamic';

/** The streamer opens their owner link on another device: the key becomes an owner cookie. */
export const POST = handle(async (req: Request) => {
  await rateLimit('claim', ipHash(req.headers), 10, 600);
  const body = (await req.json().catch(() => ({}))) as { room?: string; key?: string };
  const room = String(body.room ?? '');
  const s = isPrivateRoom(room) ? await getPrivateRoom(room) : null;
  if (!isPrivateRoom(room) || !s) throw new ApiError(404, 'room_gone', 'This room is closed 🚪');
  const key = String(body.key ?? '');
  if (!ownerKeyMatches(s, key)) throw new ApiError(403, 'not_owner', 'That owner link is not valid 🎙️');

  const res = ok({ ok: true });
  res.cookies.set(ownerCookie(room), key, cookieOptions);
  res.cookies.set(accessCookie(room), accessCookieValue(room, s), cookieOptions);
  return res;
});
