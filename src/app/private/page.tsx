import type { Metadata } from 'next';
import { PrivateRooms } from '@/components/PrivateRooms';
import { dict, localeOf } from '@/i18n';
import { lastRoom } from '@/lib/last-room';

export async function generateMetadata(): Promise<Metadata> {
  return { title: dict(await lastRoom()).private.title };
}

// Outside any room: speaks and looks like the last room visited.
export default async function PrivatePage() {
  const room = await lastRoom();
  return (
    <div data-room={room} className="contents">
      <PrivateRooms locale={localeOf(room)} />
    </div>
  );
}
