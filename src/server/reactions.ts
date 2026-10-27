import 'server-only';
import { REACTION_BATCH_MS } from '@/config/app';
import type { RoomId } from '@/config/rooms';
import type { ReactionBatch } from '@/lib/types';
import { publish } from './state';

// Reactions are batched per room and per process: one event every REACTION_BATCH_MS at most, however hard
// the couch is mashing. Nothing is stored; a reaction nobody sees in time is simply gone.
const g = globalThis as unknown as { __reactions?: Map<RoomId, ReactionBatch> };

export function addReaction(room: RoomId, emoji: string) {
  const pending = (g.__reactions ??= new Map());
  const batch = pending.get(room);
  if (batch) {
    batch[emoji] = (batch[emoji] ?? 0) + 1;
    return;
  }
  pending.set(room, { [emoji]: 1 });
  setTimeout(() => {
    const data = pending.get(room);
    pending.delete(room);
    if (data) publish(room, { type: 'react', data }).catch((e) => console.error('[reactions]', e));
  }, REACTION_BATCH_MS);
}
