import { headers } from 'next/headers';
import { DEFAULT_ROOM, ROOM_HEADER, type PublicRoomId, isPublicRoom } from '@/config/rooms';

/** Room the current request speaks and looks like, as picked by the middleware. Server components only. */
export async function lastRoom(): Promise<PublicRoomId> {
  const room = (await headers()).get(ROOM_HEADER);
  return isPublicRoom(room) ? room : DEFAULT_ROOM;
}
