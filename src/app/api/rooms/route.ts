import { roomInputSchema, toSettings } from '@/lib/private-room';
import { ApiError, handle, ok } from '@/server/http';
import { ipHash } from '@/server/ip';
import {
  accessCookie,
  accessCookieValue,
  cookieOptions,
  createPrivateRoom,
  getPrivateRoom,
  ownerCookie,
} from '@/server/private-rooms';
import { rateLimit } from '@/server/ratelimit';
import { verifyTurnstile } from '@/server/turnstile';

export const dynamic = 'force-dynamic';

/** A streamer creates a private room. They get its ID, the password for their chat, and an owner key. */
export const POST = handle(async (req: Request) => {
  const iph = ipHash(req.headers);
  await rateLimit('create-room', iph, 5, 3600);
  const body = (await req.json().catch(() => ({}))) as { room?: unknown; token?: string };
  const input = roomInputSchema.safeParse(body.room);
  if (!input.success) throw new ApiError(400, 'bad_settings', 'Some room settings are missing or invalid 🛠️');
  await verifyTurnstile(body.token, req.headers);

  const { id, password, ownerKey } = await createPrivateRoom(toSettings(input.data), input.data.password);
  const res = ok({ ok: true, id, password, ownerKey });
  res.cookies.set(ownerCookie(id), ownerKey, cookieOptions);
  res.cookies.set(accessCookie(id), accessCookieValue(id, (await getPrivateRoom(id))!), cookieOptions);
  return res;
});
