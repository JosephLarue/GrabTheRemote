'use client';

import type { PoolEntry } from '@/lib/types';
import { formatClock, useLive } from '@/lib/live';
import { openVote } from './VoteBox';

const BAR_COLORS = ['var(--glow)', 'var(--tv)', 'var(--report)', 'var(--mint)', '#ff9b4a'];

export function PoolBars({
  pool,
  limit = 5,
  onPlusOne,
  plusOneDisabled,
}: {
  pool: PoolEntry[];
  limit?: number;
  onPlusOne?: (id: string) => void;
  plusOneDisabled?: boolean;
}) {
  const { t } = useLive();
  const top = pool.slice(0, limit);
  const max = Math.max(1, ...top.map((p) => p.votes));

  if (top.length === 0) {
    return (
      <div className="panel p-5">
        <p className="font-extrabold">{t.pool.empty}</p>
        <p className="mt-1 text-sm">
          {t.pool.emptyHint}{' '}
          <button type="button" onClick={openVote} className="font-extrabold underline decoration-[3px] underline-offset-2">
            {t.pool.pickVideo}
          </button>
        </p>
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {top.map((p, i) => (
        <li key={p.id} className={`panel flex items-center gap-3 p-2 pr-3 ${p.matchesTheme ? '' : 'opacity-60'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.thumbnailUrl}
            alt=""
            width={96}
            height={54}
            className="h-[54px] w-[96px] shrink-0 rounded-xl border-[3px] border-[var(--edge)] object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-extrabold" title={p.title}>
              {p.title}
            </p>
            <p className="truncate text-xs font-semibold opacity-75">
              {p.channelTitle}
              {p.durationS > 0 && `, ${formatClock(p.durationS * 1000)}`}
              {!p.matchesTheme && t.pool.offTheme}
            </p>
            <div className="mt-1 h-3 overflow-hidden rounded-full border-2 border-[var(--edge)] bg-[var(--ink)]/10">
              <div
                key={p.votes}
                className="bump h-full origin-left rounded-full transition-[width] duration-500"
                style={{ width: `${(p.votes / max) * 100}%`, background: BAR_COLORS[i % BAR_COLORS.length] }}
              />
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-center">
            <span className="font-display text-2xl tabular-nums">{p.votes}</span>
            <span className="text-[10px] font-extrabold">{t.pool.votes(p.votes)}</span>
          </div>
          {onPlusOne && (
            <button
              type="button"
              className="btn shrink-0 bg-[var(--glow)] px-3 py-1 text-[var(--ink)]"
              disabled={plusOneDisabled || !p.matchesTheme}
              onClick={() => onPlusOne(p.id)}
              aria-label={t.pool.voteFor(p.title)}
            >
              +1
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}
