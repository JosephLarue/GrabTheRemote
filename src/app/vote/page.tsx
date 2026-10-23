'use client';

import { useEffect, useState } from 'react';
import { AdSlot } from '@/components/AdSlot';
import { PoolBars } from '@/components/PoolBars';
import { ThemeBanner } from '@/components/ThemeBanner';
import { post, rememberPick } from '@/lib/api';
import { formatClock, useLive, useServerNow } from '@/lib/live';
import { useTurnstile } from '@/lib/turnstile';
import type { VideoCard } from '@/lib/types';
import { parseYouTubeId } from '@/lib/youtube-id';

type PreviewRes = { video: VideoCard; inPool: boolean; problem: string | null; matchesTheme: boolean | null };
type PreviewState = { status: 'idle' | 'loading' } | { status: 'ok'; data: PreviewRes } | { status: 'error'; message: string };

export default function VotePage() {
  const { state, me, refreshMe } = useLive();
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
        url.trim() ? { status: 'error', message: "That's not a YouTube link we recognize 🤔" } : { status: 'idle' },
      );
      return;
    }
    setPreview({ status: 'loading' });
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/preview?url=${encodeURIComponent(id)}`, { signal: ctrl.signal });
        const data = await res.json();
        setPreview(res.ok ? { status: 'ok', data } : { status: 'error', message: data.message });
      } catch {
        if (!ctrl.signal.aborted) setPreview({ status: 'error', message: 'Lost the signal. Try again 📡' });
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [id, url]);

  const vote = async (target: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const token = await getToken();
      const res = await post<{ videoId: string }>('/api/vote', { url: target, token });
      if (res.ok) {
        rememberPick(res.data.videoId);
        setMsg({ ok: true, text: "Vote counted! You'll get confetti if it makes it to the screen 🎉" });
        setUrl('');
      } else {
        setMsg({ ok: false, text: res.err.message });
      }
    } catch {
      setMsg({ ok: false, text: 'The robot check failed. Try again 🤖' });
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
          <h1 className="font-display text-3xl sm:text-4xl">Pick what plays next</h1>
          <p className="mt-2 max-w-prose font-semibold">
            Paste a YouTube link. You get one vote every 15 minutes. When the current video ends, the video with the
            most votes takes over the screen.
          </p>

          <form
            className="mt-5 flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (id) vote(url);
            }}
          >
            <label htmlFor="url" className="sr-only">
              YouTube link
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
              {busy ? 'Grabbing…' : 'Grab the remote'}
            </button>
          </form>

          {cooldown > 0 && (
            <p className="mt-3 font-extrabold">
              You can grab the remote again in <span className="font-display tabular-nums">{formatClock(cooldown)}</span>.
            </p>
          )}

          <div className="mt-4 min-h-[86px]" aria-live="polite">
            {preview.status === 'loading' && <p className="font-bold opacity-70">Tuning in…</p>}
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
                      <span className="text-[var(--skip)]">{p.problem}</span>
                    ) : p.matchesTheme === false ? (
                      <span className="text-[var(--skip)]">Doesn&apos;t fit the current theme.</span>
                    ) : p.inPool ? (
                      'Already in the queue. Your vote adds +1.'
                    ) : (
                      'Looks good. Grab it!'
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
          <h2 className="font-display mb-3 text-2xl">The queue</h2>
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
          <h2 className="font-display text-xl">House rules</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold">
            <li>Embeddable YouTube videos only, 15 minutes max.</li>
            <li>No age-restricted videos.</li>
            <li>When there&apos;s a theme, your pick has to fit it.</li>
            <li>If 10% of viewers report a video, it gets hidden.</li>
          </ul>
        </div>
        <AdSlot slot="vote-rail" />
      </aside>
    </div>
  );
}
