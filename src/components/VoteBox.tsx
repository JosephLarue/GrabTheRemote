'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { errorText, themeLabel } from '@/i18n';
import { post, rememberPick } from '@/lib/api';
import { beam } from '@/lib/fx';
import { formatClock, useLive, useServerNow } from '@/lib/live';
import { useTurnstile } from '@/lib/turnstile';
import type { VideoCard } from '@/lib/types';
import { parseYouTubeId } from '@/lib/youtube-id';
import { play } from '@/lib/sfx';
import { ThemeBanner } from './ThemeBanner';

// Voting lives in the remote, not on a page of its own: the link box is in the drawer, the +1s are on the queue
// under the TV, and both go through the one VoteProvider (one cooldown, one captcha).

/** Opens the remote on the link box. Other pages link to `/<room>#vote` instead (RemoteDrawer reads it). */
export const VOTE_HASH = '#vote';
const OPEN_EVENT = 'gtr:vote';
export const openVote = () => window.dispatchEvent(new Event(OPEN_EVENT));
export const onOpenVote = (fn: () => void) => {
  window.addEventListener(OPEN_EVENT, fn);
  return () => window.removeEventListener(OPEN_EVENT, fn);
};

type VoteCtx = {
  /** A YouTube link or id. Resolves true when the vote counted. */
  vote: (target: string) => Promise<boolean>;
  busy: boolean;
  /** Server time at which this viewer can vote again, null when they can. */
  cooldownEndsAt: number | null;
  msg: { ok: boolean; text: string } | null;
};

const Ctx = createContext<VoteCtx | null>(null);

export function useVote() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useVote outside VoteProvider');
  return ctx;
}

/** ms left before this viewer can vote again. Ticks once a second, only in the component that asks. */
export function useVoteCooldown() {
  const { cooldownEndsAt } = useVote();
  const now = useServerNow(1000);
  return cooldownEndsAt && cooldownEndsAt > now ? cooldownEndsAt - now : 0;
}

export function VoteProvider({ children }: { children: React.ReactNode }) {
  const { room, t, settings, state, me, refreshMe } = useLive();
  const theme = state?.theme;
  const rules = settings.rules;
  const { ref: captchaRef, getToken } = useTurnstile();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<VoteCtx['msg']>(null);
  const cooldownEndsAt = me.voteCooldownEndsAt;

  const vote = useCallback(
    async (target: string) => {
      play('click');
      setBusy(true);
      setMsg(null);
      try {
        const token = await getToken();
        const res = await post<{ videoId: string }>('/api/vote', { room, url: target, token });
        if (res.ok) {
          rememberPick(res.data.videoId);
          setMsg({ ok: true, text: t.vote.counted });
          return true;
        }
        setMsg({ ok: false, text: errorText(t, res.err, { room, theme, rules }) });
        return false;
      } catch {
        setMsg({ ok: false, text: t.errors.captcha });
        return false;
      } finally {
        setBusy(false);
        refreshMe();
      }
    },
    [getToken, room, t, theme, rules, refreshMe],
  );

  const value = useMemo(() => ({ vote, busy, cooldownEndsAt, msg }), [vote, busy, cooldownEndsAt, msg]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Turnstile only shows up when it wants a click: float it above everything, the remote may be closed. */}
      <div ref={captchaRef} className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[70]" />
    </Ctx.Provider>
  );
}

type PreviewRes = {
  video: VideoCard;
  inPool: boolean;
  problem: string | null;
  problemCode: string | null;
  matchesTheme: boolean | null;
};
type PreviewState = { status: 'idle' | 'loading' } | { status: 'ok'; data: PreviewRes } | { status: 'error'; message: string };
/** What the server said about one id; anything else being typed means "loading". */
type PreviewResult = { id: string; state: PreviewState };

/**
 * The link box. Full: at the top of the remote (title, theme, cooldown rule). Compact: one row under the TV on
 * phones, where the remote is a floating button nobody would open to find out where to paste a link.
 */
export function VoteForm({ compact = false }: { compact?: boolean }) {
  const { room, t, settings, state } = useLive();
  const { rules } = settings;
  const theme = state?.theme;
  const { vote, busy, msg } = useVote();
  const cooldown = useVoteCooldown();
  const inputId = compact ? 'vote-url-compact' : 'vote-url';
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<PreviewResult | null>(null);
  const id = parseYouTubeId(url);
  const fail = useCallback(
    (err: { error: string; message: string }) => errorText(t, err, { room, theme, rules }),
    [t, room, theme, rules],
  );

  // Preview 400 ms after typing stops. Never costs YouTube quota (server uses cache or oEmbed).
  useEffect(() => {
    if (!id) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/preview?room=${room}&url=${encodeURIComponent(id)}`, { signal: ctrl.signal });
        const data = await res.json();
        setResult({ id, state: res.ok ? { status: 'ok', data } : { status: 'error', message: fail(data) } });
      } catch {
        if (!ctrl.signal.aborted) setResult({ id, state: { status: 'error', message: t.errors.network } });
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [id, room, t, fail]);

  // Derived, not stored: no id means idle (or a bad link), an id without its answer yet means loading.
  const preview: PreviewState = !id
    ? url.trim()
      ? { status: 'error', message: t.errors.bad_url }
      : { status: 'idle' }
    : result?.id === id
      ? result.state
      : { status: 'loading' };
  const p = preview.status === 'ok' ? preview.data : null;
  const blocked = !!p?.problem || p?.matchesTheme === false;

  return (
    <section
      aria-label={compact ? t.vote.title : undefined}
      aria-labelledby={compact ? undefined : 'vote-title'}
      className="flex flex-col gap-3"
    >
      {!compact && (
        <>
          <h2 id="vote-title" className="font-display text-xl">
            {t.vote.title}
          </h2>
          {/* The theme decides what gets in: say it right where the link goes, not only under the TV. */}
          <ThemeBanner />
          <p className="text-xs font-semibold opacity-85">{t.vote.intro(t.duration(rules.voteCooldownS))}</p>
        </>
      )}

      <form
        className={compact ? 'flex gap-2' : 'flex flex-col gap-2'}
        onSubmit={async (e) => {
          e.preventDefault();
          beam(e.currentTarget.querySelector('button'));
          if (id && (await vote(url))) setUrl('');
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          {t.vote.linkLabel}
        </label>
        <input
          id={inputId}
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://youtu.be/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className={compact ? 'field min-w-0 flex-1' : 'field'}
        />
        <button
          type="submit"
          className={`btn font-display bg-[var(--skip)] text-[var(--ink)] ${compact ? 'shrink-0 px-4 text-base' : 'text-lg'}`}
          disabled={!id || busy || cooldown > 0 || blocked}
        >
          {busy ? t.vote.grabbing : compact ? t.vote.grabShort : t.vote.grab}
        </button>
      </form>

      {cooldown > 0 && (
        <p className="text-sm font-extrabold">
          {t.vote.againIn} <span className="font-display tabular-nums">{formatClock(cooldown)}</span>.
        </p>
      )}

      <div aria-live="polite" className="empty:hidden">
        {preview.status === 'loading' && <p className="text-sm font-bold opacity-70">{t.vote.tuning}</p>}
        {preview.status === 'error' && <p className="text-sm font-extrabold text-[var(--danger-ink)]">{preview.message}</p>}
        {p && (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.video.thumbnailUrl}
              alt=""
              width={96}
              height={54}
              className="h-[54px] w-[96px] shrink-0 rounded-xl border-[3px] border-[var(--edge)] object-cover"
            />
            <div className="min-w-0 text-sm">
              <p className="line-clamp-2 font-extrabold">{p.video.title}</p>
              <p className="truncate text-xs font-semibold opacity-75">
                {p.video.channelTitle}
                {p.video.durationS > 0 && `, ${formatClock(p.video.durationS * 1000)}`}
              </p>
              <p className="mt-0.5 text-xs font-extrabold">
                {p.problem ? (
                  <span className="text-[var(--danger-ink)]">
                    {p.problemCode ? fail({ error: p.problemCode, message: p.problem }) : p.problem}
                  </span>
                ) : p.matchesTheme === false ? (
                  // Name the theme: "off-theme" alone reads like any other rule (15 min max, 15 min cooldown…).
                  <span className="text-[var(--danger-ink)]">
                    {theme ? t.errors.theme(`${theme.emoji} ${themeLabel(t, theme)}`) : t.vote.offTheme}
                  </span>
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
        <p role="status" className={`text-sm font-extrabold ${msg.ok ? 'text-[var(--mint)]' : 'text-[var(--danger-ink)]'}`}>
          {msg.text}
        </p>
      )}

    </section>
  );
}
