'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdSlot } from '@/components/AdSlot';
import { errorText, languageName } from '@/i18n';
import { PoolBars } from '@/components/PoolBars';
import { ThemeBanner } from '@/components/ThemeBanner';
import { post, rememberPick } from '@/lib/api';
import { formatClock, useLive, useServerNow } from '@/lib/live';
import { useTurnstile } from '@/lib/turnstile';
import type { VideoCard } from '@/lib/types';
import { parseYouTubeId } from '@/lib/youtube-id';

type PreviewRes = {
  video: VideoCard;
  inPool: boolean;
  problem: string | null;
  problemCode: string | null;
  matchesTheme: boolean | null;
};
type PreviewState = { status: 'idle' | 'loading' } | { status: 'ok'; data: PreviewRes } | { status: 'error'; message: string };

export default function VotePage() {
  const { room, t, settings, state, me, refreshMe } = useLive();
  const { rules } = settings;
  const theme = state?.theme;
  const fail = useCallback(
    (err: { error: string; message: string }) => errorText(t, err, { room, theme, rules }),
    [t, room, theme, rules],
  );
  const now = useServerNow(1000);
  const { ref: captchaRef, getToken } = useTurnstile();
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<PreviewState>({ status: 'idle' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const cooldown = me.voteCooldownEndsAt && me.voteCooldownEndsAt > now ? me.voteCooldownEndsAt - now : 0;
  const id = parseYouTubeId(url);

  // Preview 400 ms after typing stops. Never costs YouTube quota (server uses cache or oEmbed).
  useEffect(() => {
    if (!id) {
      setPreview(
        url.trim() ? { status: 'error', message: t.errors.bad_url } : { status: 'idle' },
      );
      return;
    }
    setPreview({ status: 'loading' });
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/preview?room=${room}&url=${encodeURIComponent(id)}`, { signal: ctrl.signal });
        const data = await res.json();
        setPreview(res.ok ? { status: 'ok', data } : { status: 'error', message: fail(data) });
      } catch {
        if (!ctrl.signal.aborted) setPreview({ status: 'error', message: t.errors.network });
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [id, url, room, t, fail]);

  const vote = async (target: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const token = await getToken();
      const res = await post<{ videoId: string }>('/api/vote', { room, url: target, token });
      if (res.ok) {
        rememberPick(res.data.videoId);
        setMsg({ ok: true, text: t.vote.counted });
        setUrl('');
      } else {
        setMsg({ ok: false, text: fail(res.err) });
      }
    } catch {
      setMsg({ ok: false, text: t.errors.captcha });
    } finally {
      setBusy(false);
      refreshMe();
    }
  };

  const p = preview.status === 'ok' ? preview.data : null;
  const blocked = !!p?.problem || p?.matchesTheme === false;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="panel p-5 sm:p-7">
          <h1 className="font-display text-3xl sm:text-4xl">{t.vote.title}</h1>
          <p className="mt-2 max-w-prose font-semibold">{t.vote.intro(t.duration(rules.voteCooldownS))}</p>

          <form
            className="mt-5 flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (id) vote(url);
            }}
          >
            <label htmlFor="url" className="sr-only">
              {t.vote.linkLabel}
            </label>
            <input
              id="url"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://youtu.be/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="min-w-0 flex-1 rounded-full border-[3px] border-[var(--edge)] bg-white px-5 py-3 font-bold text-[var(--ink)] shadow-[inset_3px_3px_0_rgba(0,0,0,0.12)] outline-none placeholder:text-[var(--ink)]/40 focus-visible:ring-4 focus-visible:ring-[var(--glow)]"
            />
            <button
              type="submit"
              className="btn font-display bg-[var(--skip)] px-6 text-lg text-[var(--ink)]"
              disabled={!id || busy || cooldown > 0 || blocked}
            >
              {busy ? t.vote.grabbing : t.vote.grab}
            </button>
          </form>

          {cooldown > 0 && (
            <p className="mt-3 font-extrabold">
              {t.vote.againIn} <span className="font-display tabular-nums">{formatClock(cooldown)}</span>.
            </p>
          )}

          <div className="mt-4 min-h-[86px]" aria-live="polite">
            {preview.status === 'loading' && <p className="font-bold opacity-70">{t.vote.tuning}</p>}
            {preview.status === 'error' && <p className="font-extrabold text-[var(--skip)]">{preview.message}</p>}
            {p && (
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.video.thumbnailUrl}
                  alt=""
                  width={144}
                  height={81}
                  className="h-[81px] w-[144px] shrink-0 rounded-xl border-[3px] border-[var(--edge)] object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate font-extrabold">{p.video.title}</p>
                  <p className="truncate text-sm font-semibold opacity-75">
                    {p.video.channelTitle}
                    {p.video.durationS > 0 && `, ${formatClock(p.video.durationS * 1000)}`}
                  </p>
                  <p className="mt-1 text-sm font-extrabold">
                    {p.problem ? (
                      <span className="text-[var(--skip)]">
                        {p.problemCode ? fail({ error: p.problemCode, message: p.problem }) : p.problem}
                      </span>
                    ) : p.matchesTheme === false ? (
                      <span className="text-[var(--skip)]">{t.vote.offTheme}</span>
                    ) : p.inPool ? (
                      t.vote.inQueue
                    ) : (
                      t.vote.looksGood
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          {msg && (
            <p role="status" className={`mt-2 font-extrabold ${msg.ok ? 'text-emerald-700 dark:text-[var(--mint)]' : 'text-[var(--skip)]'}`}>
              {msg.text}
            </p>
          )}
          <div ref={captchaRef} className="mt-2" />
        </section>

        <ThemeBanner />

        <section>
          <h2 className="font-display mb-3 text-2xl">{t.vote.queue}</h2>
          <PoolBars
            pool={state?.pool ?? []}
            limit={10}
            onPlusOne={(vid) => vote(vid)}
            plusOneDisabled={busy || cooldown > 0}
          />
        </section>
      </div>

      <aside className="flex flex-col gap-6">
        <div className="panel p-5">
          <h2 className="font-display text-xl">{t.vote.rules}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold">
            <li>{t.vote.ruleEmbeddable(t.duration(rules.maxDurationS))}</li>
            <li>{t.vote.ruleAge}</li>
            <li>{t.vote.ruleLanguage(languageName(rules.lang, t))}</li>
            {settings.themes.mode !== 'none' && <li>{t.vote.ruleTheme}</li>}
            {rules.report && <li>{t.vote.ruleReport}</li>}
          </ul>
        </div>
        <AdSlot slot="vote-rail" />
      </aside>
    </div>
  );
}
