import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AdSlot } from '@/components/AdSlot';
import { MyCollection, ShameCards } from '@/components/ShameCards';
import { isPublicRoom, isRoom, isTwitchRoom, type RoomId } from '@/config/rooms';
import { type Dict, dict, localeOf } from '@/i18n';
import { formatLasted, roastOf } from '@/lib/roast';
import { roomAlternates } from '@/lib/seo';
import { HALL_TABS, type HallRow, type HallTab, hall } from '@/server/hall';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ room: string }> }): Promise<Metadata> {
  const { room } = await params;
  if (!isRoom(room)) return {};
  const t = dict(room);
  return {
    title: t.seo.hallTitle,
    description: t.seo.hallDescription,
    // Own canonical and hreflang, else the Hall inherits the room root's. Every tab canonicalizes to /hall.
    ...(isPublicRoom(room) ? { alternates: roomAlternates(room, '/hall') } : {}),
    openGraph: { title: t.seo.hallTitle, description: t.seo.hallDescription },
  };
}

const UNITS: Record<HallTab, (t: Dict, locale: string) => (n: number) => string> = {
  watched: (t, locale) => (n) => t.hall.minutes(n.toLocaleString(locale)),
  picked: (t) => t.hall.times,
  landslide: (t) => t.hall.votes,
  peak: (t) => t.hall.viewers,
  shame: () => formatLasted,
};

export default async function HallPage({
  params,
  searchParams,
}: {
  params: Promise<{ room: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ room }, { tab: raw }] = await Promise.all([params, searchParams]);
  if (!isRoom(room)) notFound();
  if (isTwitchRoom(room)) redirect(`/${room}`);
  const tab: HallTab = (HALL_TABS as readonly string[]).includes(raw ?? '') ? (raw as HallTab) : 'watched';
  const rows = await hall(room, tab);
  const t = dict(room);
  const meta = { ...t.hall.tabs[tab], unit: UNITS[tab](t, localeOf(room)) };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-4xl sm:text-5xl">{t.hall.title}</h1>

      <nav aria-label={t.hall.leaderboards} className="flex flex-wrap gap-2">
        {HALL_TABS.map((id) => (
          <Link
            key={id}
            href={id === 'watched' ? `/${room}/hall` : `/${room}/hall?tab=${id}`}
            aria-current={id === tab ? 'page' : undefined}
            className={`btn text-sm ${id === tab ? (id === 'shame' ? 'bg-[var(--skip)]' : 'bg-[var(--report)]') + ' text-[var(--ink)]' : 'bg-[var(--remote)] text-[var(--cream)]'}`}
          >
            {t.hall.tabs[id].label}
          </Link>
        ))}
      </nav>

      <p className="font-bold">{tab === 'shame' ? t.cards.blurb : meta.blurb}</p>

      {tab === 'shame' && <MyCollection />}

      {rows.length === 0 ? (
        <div className="panel p-6">
          <p className="font-extrabold">{t.hall.empty}</p>
          <p className="mt-1 text-sm">
            <Link href={`/${room}#vote`} className="font-extrabold underline decoration-[3px] underline-offset-2">
              {t.hall.emptyPick}
            </Link>{' '}
            {t.hall.emptyRest}
          </p>
        </div>
      ) : tab === 'shame' ? (
        <ShameCards rows={rows} />
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((r, i) => (
            <Row
              key={`${r.videoId}-${r.at ?? i}`}
              row={r}
              rank={i + 1}
              unit={meta.unit}
              shame={false}
              room={room}
              t={t}
            />
          ))}
        </ol>
      )}

      <AdSlot slot="hall-banner" size="banner" />
    </div>
  );
}

function Row({
  row,
  rank,
  unit,
  shame,
  room,
  t,
}: {
  row: HallRow;
  rank: number;
  unit: (n: number) => string;
  shame: boolean;
  room: RoomId;
  t: Dict;
}) {
  const cutShort = shame && (row.reason === 'skipped' || row.reason === 'vetoed');
  const podium = ['bg-[var(--report)]', 'bg-[#e6e1f5]', 'bg-[#ffb27a]'][rank - 1];
  return (
    // Narrow phones: no thumbnail, and the score sits above the share button, so the title keeps its room.
    <li className="panel flex items-center gap-2 p-2 pr-3 sm:gap-4 sm:pr-4">
      <span
        className={`font-display grid h-9 w-9 shrink-0 sm:h-11 sm:w-11 place-items-center rounded-full border-[3px] border-[var(--edge)] text-lg text-[var(--ink)] ${podium ?? 'bg-white'}`}
      >
        {rank}
      </span>
      {row.hidden ? (
        <span className="hidden h-[54px] w-[96px] shrink-0 place-items-center min-[480px]:grid rounded-xl border-[3px] border-[var(--edge)] bg-[var(--skip)] text-2xl">
          🚨
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.thumbnailUrl}
          alt=""
          width={96}
          height={54}
          className="hidden h-[54px] w-[96px] shrink-0 rounded-xl border-[3px] border-[var(--edge)] object-cover min-[480px]:block"
        />
      )}
      <div className="min-w-0 flex-1">
        {row.hidden ? (
          <p className="font-extrabold">{t.hall.massReported}</p>
        ) : (
          <a
            href={`https://www.youtube.com/watch?v=${row.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate font-extrabold hover:underline"
          >
            {row.title}
          </a>
        )}
        <p className="truncate text-xs font-semibold opacity-75">
          {row.hidden ? t.hall.crowdHid : row.channelTitle}
          {shame && row.reason === 'skipped' && t.hall.skipped}
          {shame && row.reason === 'vetoed' && t.hall.vetoed}
        </p>
        {shame && (
          <p className="mt-0.5 truncate text-xs font-black text-[var(--danger-panel-ink)]">
            “{t.hall.roasts[roastOf(row.reason, row.value)]}”
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-4">
        <span className="font-display text-right text-base tabular-nums sm:text-xl">
          {cutShort ? t.hall.after(unit(row.value)) : unit(row.value)}
        </span>
        {shame && row.playId && (
          <Link
            href={`/${room}/shame/${row.playId}`}
            className="btn shrink-0 bg-[var(--skip)] px-3 py-1 text-sm text-[var(--ink)]"
            aria-label={t.hall.shareLabel(row.hidden ? t.hall.massReported : row.title)}
          >
            📸 <span className="hidden sm:inline">{t.hall.share}</span>
          </Link>
        )}
      </div>
    </li>
  );
}
