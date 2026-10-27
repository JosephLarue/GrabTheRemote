import { CHAT_MAX_LENGTH } from '@/config/app';
import { cleanChatText, hasLink, isChatSeed } from '@/lib/chat';
import { recentChat, sendChat } from '@/server/chat';
import { ApiError, handle, ok, openRoom } from '@/server/http';
import { ipHash } from '@/server/ip';
import { chatHasBlockedKeyword } from '@/server/moderation';
import { rateLimit } from '@/server/ratelimit';

export const dynamic = 'force-dynamic';

/** The last messages, for whoever just sat down (or reconnected). */
export const GET = handle(async (req: Request) => {
  const { room } = await openRoom(req, new URL(req.url).searchParams.get('room'));
  return ok({ messages: await recentChat(room) });
});

// No account, no captcha: the nickname comes from the browser's seed, and the rate limit keeps the pace sane.
export const POST = handle(async (req: Request) => {
  const iph = ipHash(req.headers);
  await rateLimit('chat', iph, 5, 10);
  const body = (await req.json().catch(() => ({}))) as { room?: string; seed?: unknown; text?: unknown };
  const { room } = await openRoom(req, body.room);
  if (!isChatSeed(body.seed)) throw new ApiError(400, 'bad_seed', 'Your couch nickname got lost. Reload the page 🛋️');
  if (typeof body.text !== 'string' || body.text.length > CHAT_MAX_LENGTH * 2) {
    throw new ApiError(400, 'bad_chat', `Say something, but keep it under ${CHAT_MAX_LENGTH} characters 💬`);
  }
  const text = cleanChatText(body.text);
  if (!text) throw new ApiError(400, 'bad_chat', `Say something, but keep it under ${CHAT_MAX_LENGTH} characters 💬`);
  if (hasLink(text)) throw new ApiError(422, 'chat_link', 'No links on the couch. Paste videos in the vote box 🔗');
  if (await chatHasBlockedKeyword(text)) throw new ApiError(422, 'chat_blocked', 'Keep it couch-friendly 🙅');
  return ok({ message: await sendChat(room, body.seed, text) });
});
