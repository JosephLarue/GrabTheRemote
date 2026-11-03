import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShareButton } from '@/components/ShareButton';
import { isRoom } from '@/config/rooms';
import { dict, shameHeadline } from '@/i18n';
import { roastOf } from '@/lib/roast';
import { shameEntry } from '@/server/hall';

export const dynamic = 'force-dynamic';

type Params = Promise<{ room: string; playId: string }>;

async function load(params: Params) {
  const { room, playId } = await params;
  if (!isRoom(room)) notFound();
  const row = await shameEntry(room, Number(playId));
  if (!row) notFound();
  const t = dict(room);
  return { room, row, t, headline: shameHeadline(t, row), roast: t.hall.roasts[roastOf(row.reason, row.value)] };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { row, t, headline, roast } = await load(params);
  const what = row.hidden ? t.hall.massReported : row.title;
  const description = `${what}. ${roast}.`;
  return {
    title: `${headline} · ${t.shame.title}`,
    description,
    // Spelled out: the root layout's openGraph would otherwise win, and chat apps show that, not <title>.
    openGraph: { title: headline, description, type: 'website' },
    twitter: { card: 'summary_large_image', title: headline, description },
    robots: { index: false },
  };
}

/** One Hall of Shame entry, made to be screenshotted and shared. The share card is opengraph-image.tsx. */
export default async function ShamePage({ params }: { params: Params }) {
  const { room, row, t, headline, roast } = await load(params);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
      <p className="font-display text-3xl sm:text-4xl">{t.shame.title}</p>

      <article className="panel w-full -rotate-1 overflow-hidden p-4 sm:p-6">
        <div className="relative">
          {row.hidden ? (
            <div className="grid aspect-video w-full place-items-center rounded-2xl border-[3px] border-[var(--edge)] bg-[var(--skip)] text-7xl">
              🚨
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.thumbnailUrl}
              alt=""
              className="aspect-video w-full rounded-2xl border-[3px] border-[var(--edge)] object-cover grayscale-[40%]"
            />
          )}
          <span className="font-display sticker absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 bg-[var(--skip)] px-6 py-2 text-3xl text-[var(--ink)] uppercase sm:text-5xl">
            {t.shame.stamps[row.reason ?? 'skipped']}
          </span>
        </div>
        <p className="mt-4 truncate text-lg font-black" title={row.hidden ? undefined : row.title}>
          {row.hidden ? t.hall.massReported : row.title}
        </p>
        <p className="font-display mt-2 text-2xl sm:text-3xl">{headline}</p>
        <p className="mt-2 text-lg font-black text-[var(--danger-panel-ink)]">“{roast}”</p>
      </article>

      <ShareButton
        title={headline}
        text={`${headline}. ${roast}.`}
        label={t.shame.share}
        copied={t.shame.copied}
        campaign="shame"
      />

      <div className="flex flex-wrap justify-center gap-3">
        <Link href={`/${room}#vote`} className="btn bg-[var(--glow)] text-[var(--ink)]">
          {t.shame.cta}
        </Link>
        <Link href={`/${room}/hall?tab=shame`} className="btn bg-[var(--remote)] text-[var(--cream)]">
          {t.shame.back}
        </Link>
      </div>
    </div>
  );
}
