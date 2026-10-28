'use client';

import { remoteFight } from '@/lib/fight';
import { useLive } from '@/lib/live';
import type { PoolEntry } from '@/lib/types';
import { openVote } from './VoteBox';

/** Tug-of-war banner when the top two of the queue are neck and neck. */
export function RemoteFight() {
  const { t, state } = useLive();
  const fight = remoteFight(state?.pool ?? []);
  if (!fight) return null;
  const [a, b] = fight;
  const share = (a.votes / (a.votes + b.votes)) * 100;

  return (
    <section aria-label={t.fight.title} className="panel fight flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display wobble text-2xl text-[var(--skip)] uppercase sm:text-3xl">{t.fight.title}</p>
        <button type="button" onClick={openVote} className="btn shrink-0 bg-[var(--glow)] px-3 py-1 text-sm text-[var(--ink)]">
          {t.fight.pickSide}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <Side entry={a} />
        <div className="relative h-7 flex-1 rounded-full border-[3px] border-[var(--edge)] bg-[var(--tv)]">
          <div
            className="h-full rounded-l-full bg-[var(--glow)] transition-[width] duration-700 ease-out"
            style={{ width: `${share}%` }}
          />
          <span
            aria-hidden
            className="tug absolute top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-[var(--edge)] bg-[var(--report)] text-lg transition-[left] duration-700 ease-out"
            style={{ left: `${share}%` }}
          >
            ⚔️
          </span>
        </div>
        <Side entry={b} right />
      </div>

      <div className="flex justify-between gap-4 text-sm font-extrabold">
        <p className="min-w-0 flex-1 truncate" title={a.title}>
          {a.title}
        </p>
        <p className="shrink-0 opacity-75">{t.fight.vs}</p>
        <p className="min-w-0 flex-1 truncate text-right" title={b.title}>
          {b.title}
        </p>
      </div>
    </section>
  );
}

function Side({ entry, right }: { entry: PoolEntry; right?: boolean }) {
  const { t } = useLive();
  return (
    <div className={`flex shrink-0 items-center gap-2 ${right ? 'flex-row-reverse' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={entry.thumbnailUrl}
        alt=""
        width={72}
        height={40}
        className="hidden h-10 w-[72px] rounded-lg border-[3px] border-[var(--edge)] object-cover sm:block"
      />
      <p className="flex flex-col items-center leading-none">
        <span key={entry.votes} className="bump font-display text-2xl tabular-nums">
          {entry.votes}
        </span>
        <span className="text-[10px] font-extrabold">{t.pool.votes(entry.votes)}</span>
      </p>
    </div>
  );
}
