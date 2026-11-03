import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { JoinRoom, RoomClosed } from '@/components/JoinRoom';
import { InviteClaim } from '@/components/Invite';
import { PickCelebration } from '@/components/PickCelebration';
import { SoundEffects } from '@/components/SoundEffects';
import { TabTitle } from '@/components/TabTitle';
import { SITE_URL } from '@/config/app';
import { DECOR_INFO, ROOM_INFO, isPrivateRoom, isPublicRoom, isRoom } from '@/config/rooms';
import { dict, localeOf } from '@/i18n';
import { lastRoom } from '@/lib/last-room';
import { LiveProvider } from '@/lib/live';
import { roomAlternates } from '@/lib/seo';
import { accessOf } from '@/server/private-rooms';
import { roomSettings } from '@/server/room-settings';
import { viewerCount } from '@/server/state';

type Params = Promise<{ room: string }>;

export async function generateViewport({ params }: { params: Params }): Promise<Viewport> {
  const { room } = await params;
  const settings = isRoom(room) ? await roomSettings(room) : null;
  return settings ? { themeColor: DECOR_INFO[settings.decor].wall } : {};
}

// Public rooms: a localized title and a description with the live couch count (crawlers fetch it fresh).
// Private rooms stay out of search engines; their name is the page title.
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { room } = await params;
  if (isPrivateRoom(room)) {
    const settings = await roomSettings(room);
    return { title: settings?.name, robots: { index: false, follow: false } };
  }
  if (!isPublicRoom(room)) return {};
  const t = dict(room);
  const info = ROOM_INFO[room];
  const viewers = await viewerCount(room).catch(() => 0);
  const twitch = info.kind === 'twitch';
  const title = twitch ? t.seo.twitchTitle : t.seo.roomTitle(info.name);
  const pitch = twitch ? t.seo.twitchDescription : t.seo.roomDescription(info.name);
  // The couch count only when there is one: "0 on the couch" is no invitation in a search result.
  const description = viewers > 0 ? `${pitch} ${t.seo.watching(viewers)}.` : pitch;
  const url = `${SITE_URL}/${room}`;
  return {
    title: { absolute: `${info.emoji} ${title}` },
    description,
    alternates: roomAlternates(room),
    openGraph: { title, description, url, type: 'website', locale: localeOf(room) },
    twitter: { card: 'summary_large_image', title, description },
  };
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
      <SoundEffects />
      <TabTitle />
      <InviteClaim />
    </LiveProvider>
  );
}
