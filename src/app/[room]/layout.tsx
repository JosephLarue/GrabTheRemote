import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { JoinRoom, RoomClosed } from '@/components/JoinRoom';
import { PickCelebration } from '@/components/PickCelebration';
import { ROOM_INFO, isPrivateRoom, isRoom } from '@/config/rooms';
import { localeOf } from '@/i18n';
import { lastRoom } from '@/lib/last-room';
import { LiveProvider } from '@/lib/live';
import { accessOf } from '@/server/private-rooms';
import { roomSettings } from '@/server/room-settings';

type Params = Promise<{ room: string }>;

export async function generateViewport({ params }: { params: Params }): Promise<Viewport> {
  const { room } = await params;
  const settings = isRoom(room) ? await roomSettings(room) : null;
  return settings ? { themeColor: ROOM_INFO[settings.decor].wall } : {};
}

// Private rooms stay out of search engines; their name is the page title.
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { room } = await params;
  if (!isPrivateRoom(room)) return {};
  const settings = await roomSettings(room);
  return { title: settings?.name, robots: { index: false, follow: false } };
}

// Every page under /<room> shares that room's live connection and wears its decor ([data-room] in globals.css).
// A private room shows its password form until the visitor has entered it (or owns the room).
export default async function RoomLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Params }>) {
  const { room } = await params;
  if (!isRoom(room)) notFound();
  const settings = await roomSettings(room);
  if (!settings) return <RoomClosed locale={localeOf(await lastRoom())} />;

  const jar = await cookies();
  const access = await accessOf(room, (name) => jar.get(name)?.value);
  if (!access.enter) {
    return (
      <div data-room={settings.decor} className="contents">
        <JoinRoom room={room} name={settings.name} locale={settings.locale} />
      </div>
    );
  }
  return (
    <LiveProvider room={room} settings={settings}>
      {children}
      <PickCelebration />
    </LiveProvider>
  );
}
