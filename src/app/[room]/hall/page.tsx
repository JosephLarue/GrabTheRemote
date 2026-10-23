import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdSlot } from '@/components/AdSlot';
import { isRoom } from '@/config/rooms';
import { HALL_TABS, type HallRow, type HallTab, hall } from '@/server/hall';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Hall of Fame' };

const TABS: Record<HallTab, { label: string; blurb: string; unit: (n: number) => string }> = {
  watched: {
    label: 'Most watched',
    blurb: 'Total minutes watched, summed over every viewer.',
    unit: (n) => `${n.toLocaleString('en')} min`,
  },
  picked: { label: 'Most picked', blurb: 'How many times the crowd voted it onto the screen.', unit: (n) => `${n}×` },
  landslide: { label: 'Biggest landslide', blurb: 'Most votes at the moment it was picked.', unit: (n) => `${n} votes` },
  peak: { label: 'Peak crowd', blurb: 'The most people watching at the same time.', unit: (n) => `${n} viewers` },
  shame: {
    label: 'Hall of Shame',
    blurb: 'Fastest skips and mass-reported disasters.',
    unit: (n) => (n < 60 ? `${n}s` : `${Math.floor(n / 60)}m ${n % 60}s`),
  },
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
  const tab: HallTab = (HALL_TABS as readonly string[]).includes(raw ?? '') ? (raw as HallTab) : 'watched';
  const rows = await hall(room, tab);
  const meta = TABS[tab];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-4xl sm:text-5xl">Hall of Fame</h1>

      <nav aria-label="Leaderboards" className="flex flex-wrap gap-2">
        {HALL_TABS.map((t) => (
          <Link
            key={t}
            href={t === 'watched' ? `/${room}/hall` : `/${room}/hall?tab=${t}`}
            aria-current={t === tab ? 'page' : undefined}
            className={`btn text-sm ${t === tab ? (t === 'shame' ? 'bg-[var(--skip)]' : 'bg-[var(--report)]') + ' text-[var(--ink)]' : 'bg-[var(--remote)] text-[var(--cream)]'}`}
          >
            {TABS[t].label}
          </Link>
        ))}
      </nav>

      <p className="font-bold">{meta.blurb}</p>

      {rows.length === 0 ? (
        <div className="panel p-6">
          <p className="font-extrabold">Nobody&apos;s made it here yet.</p>
          <p className="mt-1 text-sm">
            <Link href={`/${room}/vote`} className="font-extrabold underline decoration-[3px] underline-offset-2">
              Pick a video
            </Link>{' '}
            and it could be the first.
          </p>
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((r, i) => (
            <Row key={`${r.videoId}-${r.at ?? i}`} row={r} rank={i + 1} unit={meta.unit} shame={tab === 'shame'} />
          ))}
        </ol>
      )}

      <AdSlot slot="hall-banner" size="banner" />
    </div>
  );
}

function Row({ row, rank, unit, shame }: { row: HallRow; rank: number; unit: (n: number) => string; shame: boolean }) {
  const podium = ['bg-[var(--report)]', 'bg-[#e6e1f5]', 'bg-[#ffb27a]'][rank - 1];
  return (
    <li className="panel flex items-center gap-3 p-2 pr-4 sm:gap-4">
      <span
        className={`font-display grid h-11 w-11 shrink-0 place-items-center rounded-full border-[3px] border-[var(--edge)] text-lg text-[var(--ink)] ${podium ?? 'bg-white'}`}
      >
        {rank}
      </span>
      {row.hidden ? (
        <span className="grid h-[54px] w-[96px] shrink-0 place-items-center rounded-xl border-[3px] border-[var(--edge)] bg-[var(--skip)] text-2xl">
          🚨
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.thumbnailUrl}
          alt=""
          width={96}
          height={54}
          className="h-[54px] w-[96px] shrink-0 rounded-xl border-[3px] border-[var(--edge)] object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        {row.hidden ? (
          <p className="font-extrabold">Mass-reported video</p>
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
          {row.hidden ? 'The crowd hid it' : row.channelTitle}
          {shame && row.reason === 'skipped' && ', skipped'}
        </p>
      </div>
      <span className="font-display shrink-0 text-right text-lg tabular-nums sm:text-xl">
        {shame && row.reason === 'skipped' ? `after ${unit(row.value)}` : unit(row.value)}
      </span>
    </li>
  );
}
