import { cookies } from 'next/headers';
import { isRoom } from '@/config/rooms';
import { dict, dictFor, shameHeadline } from '@/i18n';
import { cardImage } from '@/lib/card-image';
import { rarityOf } from '@/lib/cards';
import { formatLasted, roastOf } from '@/lib/roast';
import { shameEntry } from '@/server/hall';
import { accessOf } from '@/server/private-rooms';
import { roomSettings } from '@/server/room-settings';

export const dynamic = 'force-dynamic';

/** The downloadable PNG of one shame card. Private rooms: for people who entered the room only. */
export async function GET(_req: Request, { params }: { params: Promise<{ room: string; playId: string }> }) {
  const { room, playId } = await params;
  if (!isRoom(room)) return new Response('Not found', { status: 404 });
  const jar = await cookies();
  const [access, settings] = await Promise.all([accessOf(room, (name) => jar.get(name)?.value), roomSettings(room)]);
  if (!settings || !access.enter) return new Response('Not found', { status: 404 });
  const row = await shameEntry(room, Number(playId));
  if (!row) return new Response('Not found', { status: 404 });

  const t = settings.private ? dictFor(settings.locale) : dict(room);
  const rarity = rarityOf(row.reason, row.value);
  const res = await cardImage({
    // Mass-reported videos don't get re-broadcast, not even as a thumbnail.
    thumbnailUrl: row.hidden ? null : row.thumbnailUrl,
    title: row.hidden ? t.hall.massReported : row.title,
    stamp: t.shame.stamps[row.reason ?? 'skipped'],
    headline: shameHeadline(t, row),
    roast: t.hall.roasts[roastOf(row.reason, row.value)],
    rarity,
    rarityLabel: t.cards.rarity[rarity],
    serial: t.cards.serial(row.playId ?? 0),
    room: settings.name,
    lasted: t.cards.lasted(formatLasted(row.value)),
  });
  const headers = new Headers(res.headers);
  headers.set('Content-Disposition', `attachment; filename="grab-the-remote-shame-${row.playId}.png"`);
  headers.set('Cache-Control', 'public, max-age=3600');
  return new Response(res.body, { status: res.status, headers });
}
