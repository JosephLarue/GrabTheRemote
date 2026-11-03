import type { Metadata } from 'next';
import { PrivateRooms } from '@/components/PrivateRooms';
import { dict, localeOf } from '@/i18n';
import { lastRoom } from '@/lib/last-room';
import { decorOf } from '@/server/room-settings';

export async function generateMetadata(): Promise<Metadata> {
  return { title: dict(await lastRoom()).private.title };
}

// Outside any room: speaks and looks like the last room visited.
export default async function PrivatePage() {
  const room = await lastRoom();
  return (
    <div data-room={decorOf(room)} className="contents">
      <PrivateRooms locale={localeOf(room)} />
    </div>
  );
}
