'use client';

import Link from 'next/link';
import { useState } from 'react';
import { post } from '@/lib/api';
import { formatClock, useLive, useServerNow } from '@/lib/live';
import { useTurnstile } from '@/lib/turnstile';

export function Remote() {
  const { room, state, connected, me, refreshMe } = useLive();
  const now = useServerNow(1000);
  const { ref: captchaRef, getToken } = useTurnstile();
  const [busy, setBusy] = useState<'skip' | 'report' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const np = state?.nowPlaying;
  const playing = np?.state === 'playing';
  const skip = state?.skip;
  const report = state?.report;
  const skipCd = skip?.cooldownEndsAt && skip.cooldownEndsAt > now ? skip.cooldownEndsAt - now : 0;

  const press = async (kind: 'skip' | 'report') => {
    setBusy(kind);
    setMsg(null);
    try {
      const token = await getToken();
      const res = await post<{ skipped?: boolean; hidden?: boolean }>(`/api/${kind}`, { room, token });
      if (!res.ok) setMsg(res.err.message);
      else if (res.data.skipped) setMsg('Skipped! The crowd has spoken 🔴');
      else if (res.data.hidden) setMsg('Hidden. Thanks for keeping the couch clean 🚨');
      else setMsg(kind === 'skip' ? 'Vote counted. Need more hands on the button.' : 'Report counted. Thanks 🚨');
    } catch {
      setMsg('The robot check failed. Try again 🤖');
    } finally {
      setBusy(null);
      refreshMe();
    }
  };

  return (
    <aside
      aria-label="The remote"
      className="remote flex flex-row flex-wrap items-center justify-around gap-4 p-5 lg:flex-col lg:flex-nowrap lg:justify-start lg:gap-6 lg:px-6 lg:py-8"
    >
      {/* power LED doubles as the live connection indicator */}
      <div className="flex w-full items-center justify-between gap-3 lg:flex-col">
        <span className="flex items-center gap-2 text-sm font-bold">
          <span
            aria-hidden
            className={`inline-block h-3 w-3 rounded-full border-2 border-[var(--edge)] ${connected ? 'bg-[var(--mint)]' : 'bg-[var(--skip)]'}`}
          />
          {connected ? 'Live' : 'Reconnecting'}
        </span>
        <div className="rounded-xl border-[3px] border-[var(--edge)] bg-[#9fe8c8] px-3 py-1 text-center text-[var(--ink)] shadow-[inset_3px_3px_0_rgba(0,0,0,0.15)]">
          <span className="font-display text-2xl tabular-nums">{state?.viewers ?? '–'}</span>
          <span className="ml-1 text-sm font-extrabold">on the couch</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          className="btn remote-btn font-display bg-[var(--skip)] text-xl text-[var(--ink)] sm:text-2xl"
          disabled={!playing || busy !== null || me.skipped || skipCd > 0}
          onClick={() => press('skip')}
        >
          Skip
          <span className="font-sans text-xs font-extrabold">
            {skipCd > 0 ? `cools in ${formatClock(skipCd)}` : `${skip?.votes ?? 0}/${skip?.needed ?? 3}`}
          </span>
        </button>
        <p className="max-w-[12rem] text-center text-xs font-bold text-[var(--muted)]">
          {skipCd > 0
            ? 'Someone skipped recently. The button is overheating for everyone.'
            : me.skipped
              ? 'You voted to skip this one.'
              : 'Half the room has to agree.'}
        </p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          className="btn remote-btn max-w-[84px] bg-[var(--report)] text-sm text-[var(--ink)]"
          disabled={!playing || busy !== null || me.reported}
          onClick={() => press('report')}
        >
          <span aria-hidden className="text-xl">
            🚨
          </span>
          Report
        </button>
        <p className="text-center text-xs font-bold text-[var(--muted)]">
          {me.reported ? 'Reported.' : `${report?.votes ?? 0}/${report?.needed ?? 3} to hide it`}
        </p>
      </div>

      <Link href={`/${room}/vote`} className="btn whitespace-nowrap bg-[var(--glow)] text-[var(--ink)]">
        Pick what&apos;s next
      </Link>

      <div ref={captchaRef} />
      <p role="status" aria-live="polite" className="min-h-5 w-full text-center text-sm font-bold">
        {msg}
      </p>
    </aside>
  );
}
