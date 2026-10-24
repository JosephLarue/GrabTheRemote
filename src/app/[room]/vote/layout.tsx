import { redirect } from 'next/navigation';
import { isRoom, isTwitchRoom } from '@/config/rooms';

// Twitch rooms vote on the watch page; there is no queue to add to.
export default async function VoteLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ room: string }> }>) {
  const { room } = await params;
  if (isRoom(room) && isTwitchRoom(room)) redirect(`/${room}`);
  return children;
}
