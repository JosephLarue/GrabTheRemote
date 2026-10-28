'use client';

import { useEffect, useState } from 'react';
import { shameHeadline } from '@/i18n';
import { isMyPick } from '@/lib/api';
import { CARDS_EVENT, FOIL, addCard, myCards, rarityOf } from '@/lib/cards';
import { useLive } from '@/lib/live';
import { formatLasted, roastOf } from '@/lib/roast';
import type { HallRow } from '@/server/hall';
import { play } from '@/lib/sfx';

/** The Hall of Shame as a grid of holographic trading cards. */
export function ShameCards({ rows }: { rows: HallRow[] }) {
  return (
    <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {rows.map((row, i) => (
        <li key={row.playId ?? i}>
          <ShameCard row={row} rank={i + 1} />
        </li>
      ))}
    </ol>
  );
}

/** The cards this browser earned: videos it voted for that the crowd cut short. */
export function MyCollection() {
  const { room, t } = useLive();
  const [rows, setRows] = useState<HallRow[] | null>(null);
  // Bumps whenever a card gets claimed (the grid below claims yours as it renders).
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(CARDS_EVENT, bump);
    return () => window.removeEventListener(CARDS_EVENT, bump);
  }, []);

  useEffect(() => {
    const mine = myCards().filter((c) => c.room === room);
    if (mine.length === 0) {
      setRows([]);
      return;
    }
    const ctrl = new AbortController();
    fetch(`/api/cards?room=${room}&ids=${mine.map((c) => c.playId).join(',')}`, { cache: 'no-store', signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { rows: HallRow[] } | null) => setRows(data?.rows ?? []))
      .catch(() => ctrl.signal.aborted || setRows([]));
    return () => ctrl.abort();
  }, [room, version]);

  return (
    <section aria-labelledby="collection-title" className="flex flex-col gap-3">
      <h2 id="collection-title" className="font-display text-2xl">
        🃏 {t.cards.myCollection}
      </h2>
      {rows === null ? null : rows.length === 0 ? (
        <p className="panel p-4 text-sm font-bold">{t.cards.collectionEmpty}</p>
      ) : (
        <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((row) => (
            <li key={row.playId}>
              <ShameCard row={row} owned />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ShameCard({ row, rank, owned }: { row: HallRow; rank?: number; owned?: boolean }) {
  const { room, t, settings } = useLive();
  const [mine, setMine] = useState(!!owned);
  const rarity = rarityOf(row.reason, row.value);
  const [a, b, c] = FOIL[rarity];

  // Picks live in local storage: decided on the client, after hydration. Finding one of yours here claims it.
  useEffect(() => {
    if (owned || !row.playId) return;
    if (isMyPick(row.videoId)) {
      setMine(true);
      addCard({ room, playId: row.playId, videoId: row.videoId });
    }
  }, [owned, room, row.playId, row.videoId]);

  const tilt = (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
    el.style.setProperty('--tilt-y', `${(x - 0.5) * 16}deg`);
    el.style.setProperty('--tilt-x', `${(0.5 - y) * 16}deg`);
  };
  const rest = (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    el.style.setProperty('--tilt-x', '0deg');
    el.style.setProperty('--tilt-y', '0deg');
  };

  const headline = shameHeadline(t, row);
  const title = row.hidden ? t.hall.massReported : row.title;

  return (
    <article
      className={`card ${mine ? 'card-mine' : ''}`}
      style={{ '--foil-a': a, '--foil-b': b, '--foil-c': c } as React.CSSProperties}
      onPointerMove={tilt}
      onPointerLeave={rest}
    >
      <div className="card-frame">
        <span aria-hidden className="card-foil" />
        <div className="flex items-center justify-between gap-2 pb-2 text-[var(--ink)]">
          <span className="font-display text-sm">{rank ? `#${rank}` : t.cards.serial(row.playId ?? 0)}</span>
          <span className="sticker bg-[var(--cream)] px-2 py-0 text-[10px] uppercase">{t.cards.rarity[rarity]}</span>
        </div>
        <div className="card-art">
          {row.hidden ? (
            <div className="grid h-full w-full place-items-center text-4xl">🚨</div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.thumbnailUrl} alt="" loading="lazy" />
          )}
          <span className="card-stamp font-display sticker bg-[var(--skip)] px-2 py-0.5 text-sm text-[var(--ink)] sm:text-base">
            {t.shame.stamps[row.reason ?? 'skipped']}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-xs font-extrabold" title={title}>
          {title}
        </p>
        <p className="font-display text-sm leading-tight sm:text-base">{headline}</p>
        <p className="line-clamp-2 text-[11px] font-black text-[var(--skip)]">“{t.hall.roasts[roastOf(row.reason, row.value)]}”</p>
        <p className="mt-auto flex items-center justify-between pt-2 text-[10px] font-bold opacity-70">
          <span>{settings.name}</span>
          <span>{t.cards.lasted(formatLasted(row.value))}</span>
        </p>
        {mine && row.playId && (
          <>
            <p className="text-[11px] font-black">{t.cards.mine}</p>
            <a
              href={`/${room}/shame/${row.playId}/card`}
              download
              onClick={() => play('chime')}
              className="btn bg-[var(--report)] px-3 py-1 text-xs text-[var(--ink)]"
            >
              ⬇️ {t.cards.download}
            </a>
          </>
        )}
      </div>
    </article>
  );
}
