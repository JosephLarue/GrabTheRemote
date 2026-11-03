import { notFound } from 'next/navigation';
import { APP_NAME } from '@/config/app';
import { DECOR_INFO, isPublicRoom } from '@/config/rooms';
import { dict, shameHeadline } from '@/i18n';
import { roastOf } from '@/lib/roast';
import { SHARE_CARD_SIZE } from '@/lib/share-card';
import { shameCard } from '@/lib/shame-card';
import { shameEntry } from '@/server/hall';
import { decorOf } from '@/server/room-settings';

export const alt = `${APP_NAME}: Hall of Shame`;
export const size = SHARE_CARD_SIZE;
export const contentType = 'image/png';

export default async function ShameOgImage({ params }: { params: Promise<{ room: string; playId: string }> }) {
  const { room, playId } = await params;
  // Private rooms' plays stay private: their shame pages are behind the password, and so is this card.
  if (!isPublicRoom(room)) notFound();
  const row = await shameEntry(room, Number(playId));
  if (!row) notFound();
  const t = dict(room);
  return shameCard({
    wall: DECOR_INFO[decorOf(room)].wall,
    // Mass-reported videos don't get re-broadcast, not even as a thumbnail.
    thumbnailUrl: row.hidden ? null : row.thumbnailUrl,
    title: row.hidden ? t.hall.massReported : row.title,
    stamp: t.shame.stamps[row.reason ?? 'skipped'],
    headline: shameHeadline(t, row),
    roast: t.hall.roasts[roastOf(row.reason, row.value)],
  });
}
