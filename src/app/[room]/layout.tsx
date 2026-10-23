import { notFound } from 'next/navigation';
import { PickCelebration } from '@/components/PickCelebration';
import { isRoom } from '@/config/rooms';
import { LiveProvider } from '@/lib/live';

// Every page under /<room> shares that room's live connection.
export default async function RoomLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ room: string }> }>) {
  const { room } = await params;
  if (!isRoom(room)) notFound();
  return (
    <LiveProvider room={room}>
      {children}
      <PickCelebration />
    </LiveProvider>
  );
}
