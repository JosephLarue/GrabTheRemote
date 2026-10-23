'use client';

import Link from 'next/link';
import { useState } from 'react';
import { COUCH_COLLAPSE_AT } from '@/config/app';
import { errorText, localeOf } from '@/i18n';
import { post } from '@/lib/api';
import { formatClock, useLive, useServerNow } from '@/lib/live';
import { useTurnstile } from '@/lib/turnstile';

export function Remote() {
  const { room, t, state, connected, me, refreshMe } = useLive();
  const now = useServerNow(1000);
  const { ref: captchaRef, getToken } = useTurnstile();
  const [busy, setBusy] = useState<'skip' | 'report' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const np = state?.nowPlaying;
  const playing = np?.state === 'playing';
  const skip = state?.skip;
  const report = state?.report;
  const skipCd = skip?.cooldownEndsAt && skip.cooldownEndsAt > now ? skip.cooldownEndsAt - now : 0;
  const viewers = state?.viewers;
  const collapsing = (viewers ?? 0) >= COUCH_COLLAPSE_AT;

  const press = async (kind: 'skip' | 'report') => {
    setBusy(kind);
    setMsg(null);
    try {
      const token = await getToken();
      const res = await post<{ skipped?: boolean; hidden?: boolean }>(`/api/${kind}`, { room, token });
      if (!res.ok) setMsg(errorText(t, res.err, { room, kind }));
      else if (res.data.skipped) setMsg(t.remote.skipped);
      else if (res.data.hidden) setMsg(t.remote.hidden);
      else setMsg(kind === 'skip' ? t.remote.skipCounted : t.remote.reportCounted);
    } catch {
      setMsg(t.errors.captcha);
    } finally {
      setBusy(null);
      refreshMe();
    }
  };

  return (
    <aside
      aria-label={t.remote.label}
      className="remote flex flex-row flex-wrap items-center justify-around gap-4 p-5 lg:flex-col lg:flex-nowrap lg:justify-start lg:gap-6 lg:px-6 lg:py-8"
    >
      {/* power LED doubles as the live connection indicator */}
      <div className="flex w-full items-center justify-between gap-3 lg:flex-col">
        <span className="flex items-center gap-2 text-sm font-bold">
          <span
            aria-hidden
            className={`inline-block h-3 w-3 rounded-full border-2 border-[var(--edge)] ${connected ? 'bg-[var(--mint)]' : 'bg-[var(--skip)]'}`}
          />
          {connected ? t.remote.live : t.remote.reconnecting}
        </span>
        <div
          className={`rounded-xl border-[3px] border-[var(--edge)] px-3 py-1 text-center text-[var(--ink)] shadow-[inset_3px_3px_0_rgba(0,0,0,0.15)] ${collapsing ? 'wobble bg-[var(--report)]' : 'bg-[#9fe8c8]'}`}
        >
          <span className="font-display text-2xl tabular-nums">{viewers?.toLocaleString(localeOf(room)) ?? '–'}</span>
          <span className="ml-1 text-sm font-extrabold">{collapsing ? t.remote.couchCollapsing : t.remote.onCouch}</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          className="btn remote-btn font-display bg-[var(--skip)] text-xl text-[var(--ink)] sm:text-2xl"
          disabled={!playing || busy !== null || me.skipped || skipCd > 0}
          onClick={() => press('skip')}
        >
          {t.remote.skip}
          <span className="font-sans text-xs font-extrabold">
            {skipCd > 0 ? t.remote.coolsIn(formatClock(skipCd)) : `${skip?.votes ?? 0}/${skip?.needed ?? 3}`}
          </span>
        </button>
        <p className="max-w-[12rem] text-center text-xs font-bold text-[var(--muted)]">
          {skipCd > 0
            ? t.remote.overheating
            : me.skipped
              ? t.remote.youSkipped
              : t.remote.halfRoom}
        </p>
      </div>

      <div className="flex flex-col items-center gap-2">
        {/* Caution tape around a yellow label: reads as "for emergencies", not as a second skip button. */}
        <button
          type="button"
          className="report-btn"
          disabled={!playing || busy !== null || me.reported}
          onClick={() => press('report')}
        >
          <span className="report-label">
            <span aria-hidden className="report-siren">
              🚨
            </span>
            <span className="font-display text-base uppercase">{t.remote.report}</span>
          </span>
        </button>
        <p className="text-center text-xs font-bold text-[var(--muted)]">
          {me.reported ? t.remote.reported : t.remote.toHide(report?.votes ?? 0, report?.needed ?? 3)}
        </p>
      </div>

      <Link href={`/${room}/vote`} className="btn whitespace-nowrap bg-[var(--glow)] text-[var(--ink)]">
        {t.remote.pickNext}
      </Link>

      <div ref={captchaRef} />
      <p role="status" aria-live="polite" className="min-h-5 w-full text-center text-sm font-bold">
        {msg}
      </p>
    </aside>
  );
}
