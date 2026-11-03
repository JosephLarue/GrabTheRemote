import { redirect } from 'next/navigation';
import { isRoom, isTwitchRoom } from '@/config/rooms';

// There is no vote page anymore: voting happens in the watch page's remote. Old links (shared, bookmarked, the
// proxy's /vote entry) land there with the remote open on the link box.
export default async function VotePage({ params }: { params: Promise<{ room: string }> }) {
  const { room } = await params;
  redirect(isRoom(room) && !isTwitchRoom(room) ? `/${room}#vote` : `/${room}`);
}
