import { notFound } from 'next/navigation';
import { APP_NAME } from '@/config/app';
import { ROOM_INFO, isRoom } from '@/config/rooms';
import { dict } from '@/i18n';
import { SHARE_CARD_SIZE, shareCard } from '@/lib/share-card';

export const alt = APP_NAME;
export const size = SHARE_CARD_SIZE;
export const contentType = 'image/png';

// A room link shares that room's decor and tagline.
export default async function RoomOgImage({ params }: { params: Promise<{ room: string }> }) {
  const { room } = await params;
  if (!isRoom(room)) notFound();
  const { wall, tv } = ROOM_INFO[room];
  return shareCard({ wall, tv, tagline: dict(room).tagline });
}
