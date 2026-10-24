import { notFound } from 'next/navigation';
import { APP_NAME } from '@/config/app';
import { ROOM_INFO, isRoom } from '@/config/rooms';
import { dictFor } from '@/i18n';
import { roomSettings } from '@/server/room-settings';
import { SHARE_CARD_SIZE, shareCard } from '@/lib/share-card';

export const alt = APP_NAME;
export const size = SHARE_CARD_SIZE;
export const contentType = 'image/png';

// A room link shares that room's decor and tagline. Nothing about a private room beyond its look.
export default async function RoomOgImage({ params }: { params: Promise<{ room: string }> }) {
  const { room } = await params;
  const settings = isRoom(room) ? await roomSettings(room) : null;
  if (!settings) notFound();
  const { wall, tv } = ROOM_INFO[settings.decor];
  return shareCard({ wall, tv, tagline: dictFor(settings.locale).tagline });
}
