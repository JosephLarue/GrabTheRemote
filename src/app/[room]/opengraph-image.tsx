import { notFound } from 'next/navigation';
import { APP_NAME } from '@/config/app';
import { DECOR_INFO, isRoom } from '@/config/rooms';
import { dictFor } from '@/i18n';
import { roomSettings } from '@/server/room-settings';
import { viewerCount } from '@/server/state';
import { SHARE_CARD_SIZE, shareCard } from '@/lib/share-card';

export const alt = APP_NAME;
export const size = SHARE_CARD_SIZE;
export const contentType = 'image/png';
// The couch count is live; a minute old is fine for a share card and spares Redis a trip per crawler hit.
export const revalidate = 60;

// A room link shares that room's decor and tagline. Nothing about a private room beyond its look.
export default async function RoomOgImage({ params }: { params: Promise<{ room: string }> }) {
  const { room } = await params;
  if (!isRoom(room)) notFound();
  const settings = await roomSettings(room);
  if (!settings) notFound();
  const { wall, tv } = DECOR_INFO[settings.decor];
  const t = dictFor(settings.locale);
  const viewers = await viewerCount(room).catch(() => 0);
  // An empty couch is nothing to brag about: the pill only shows when someone is watching.
  return shareCard({ wall, tv, tagline: t.tagline, sub: viewers > 0 ? t.seo.watching(viewers) : undefined });
}
