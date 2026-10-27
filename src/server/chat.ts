import 'server-only';
import { randomUUID } from 'node:crypto';
import { CHAT_HISTORY, CHAT_TTL_S } from '@/config/app';
import type { RoomId } from '@/config/rooms';
import { chatName } from '@/lib/chat';
import type { ChatMessage } from '@/lib/types';
import { K } from './keys';
import { publish } from './state';
import { redis } from './redis';

// Unlike reactions, a chat line is kept a little: whoever walks in sees the last CHAT_HISTORY of them, for
// up to CHAT_TTL_S after the last one. Nothing about the sender is stored, only the nickname their seed made.

/** `text` is already cleaned and checked (route). */
export async function sendChat(room: RoomId, seed: string, text: string): Promise<ChatMessage> {
  const msg: ChatMessage = { id: randomUUID(), ...chatName(seed), text, at: Date.now() };
  const key = K.chat(room);
  await redis()
    .multi()
    .lpush(key, JSON.stringify(msg))
    .ltrim(key, 0, CHAT_HISTORY - 1)
    .expire(key, CHAT_TTL_S)
    .exec();
  await publish(room, { type: 'chat', data: msg });
  return msg;
}

/** Oldest first, as the chat shows them. */
export async function recentChat(room: RoomId): Promise<ChatMessage[]> {
  const raw = await redis().lrange(K.chat(room), 0, CHAT_HISTORY - 1);
  return raw.map((m) => JSON.parse(m) as ChatMessage).reverse();
}
