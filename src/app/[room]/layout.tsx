import type { Viewport } from 'next';
import { notFound } from 'next/navigation';
import { PickCelebration } from '@/components/PickCelebration';
import { ROOM_INFO, isRoom } from '@/config/rooms';
import { LiveProvider } from '@/lib/live';

export async function generateViewport({ params }: { params: Promise<{ room: string }> }): Promise<Viewport> {
  const { room } = await params;
  return isRoom(room) ? { themeColor: ROOM_INFO[room].wall } : {};
}

// Every page under /<room> shares that room's live connection and wears its decor ([data-room] in globals.css).
export default async function RoomLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ room: string }> }>) {
  const { room } = await params;
  if (!isRoom(room)) notFound();
  return (
    <div data-room={room} className="contents">
      <LiveProvider room={room}>
        {children}
        <PickCelebration />
      </LiveProvider>
    </div>
  );
}
