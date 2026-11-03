'use client';

import { useCallback, useEffect, useState } from 'react';
import { COUCH_COLLAPSE_AT } from '@/config/app';
import { useLive } from '@/lib/live';
import { SfxToggle } from './SoundEffects';
import { VOTE_HASH, onOpenVote } from './VoteBox';

const OPEN_KEY = 'gtr:remote-open';

/**
 * The room's controls live in a remote that slides in from the left (the chat has the TV's right), so the TV
 * gets the screen. Closed by default; desktop remembers if it was left open. The tab sticking out shows the live
 * light and the couch count, so nothing important hides behind it.
 */
export function RemoteDrawer({ children }: { children: React.ReactNode }) {
  const { t } = useLive();
  const [open, setOpen] = useState(false);

  // Only desktop reopens it: there it sits beside the TV. On a phone it covers the TV, so it always starts closed.
  useEffect(() => {
    try {
      setOpen(window.matchMedia('(min-width: 1024px)').matches && localStorage.getItem(OPEN_KEY) === '1');
    } catch {}
  }, []);

  const toggle = useCallback((next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, next ? '1' : '0');
    } catch {}
  }, []);

  // Desktop: the page makes room for the open remote instead of hiding behind it (globals.css).
  useEffect(() => {
    document.documentElement.toggleAttribute('data-remote-open', open);
    return () => document.documentElement.removeAttribute('data-remote-open');
  }, [open]);

  // "Pick a video" anywhere (or a link to /<room>#vote) opens the remote on the link box.
  useEffect(() => {
    const toVote = () => {
      toggle(true);
      // The drawer is inert until it re-renders open.
      setTimeout(() => document.getElementById('vote-url')?.focus({ preventScroll: true }), 60);
    };
    if (window.location.hash === VOTE_HASH) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
      toVote();
    }
    return onOpenVote(toVote);
  }, [toggle]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && toggle(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, toggle]);

  return (
    <>
      {/* Phones: the remote covers the TV, so a tap outside puts it away. */}
      {open && <div aria-hidden className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => toggle(false)} />}

      <button
        type="button"
        aria-expanded={open}
        aria-controls="remote-drawer"
        onClick={() => toggle(true)}
        className={`remote-handle ${open ? 'is-hidden' : ''}`}
      >
        <span aria-hidden className="remote-handle-power" />
        <span aria-hidden>📺</span>
        {/* Phones: just the power button, the TV and the count, so it hides as little as possible. */}
        <span className="remote-handle-label max-sm:sr-only">{t.remote.label}</span>
        <LiveLight dot />
        <CouchCount compact />
      </button>

      <aside
        id="remote-drawer"
        aria-label={t.remote.label}
        inert={!open}
        className={`remote remote-drawer ${open ? 'is-open' : ''}`}
      >
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => toggle(false)}
            className="btn bg-[var(--remote-hi)] px-3 py-1 text-sm text-[var(--cream)]"
            aria-label={t.remote.hide}
          >
            ◂ {t.remote.hide}
          </button>
          <span aria-hidden className="remote-ir" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <LiveLight />
          <SfxToggle compact />
          <CouchCount />
        </div>
        {children}
        <p aria-hidden className="font-display mt-auto text-center text-sm tracking-[0.3em] opacity-40">
          GTR
        </p>
      </aside>
    </>
  );
}

/** The power LED doubles as the live connection indicator. */
function LiveLight({ dot }: { dot?: boolean }) {
  const { t, connected } = useLive();
  const label = connected ? t.remote.live : t.remote.reconnecting;
  return (
    <span className="flex items-center gap-2 text-sm font-bold" title={dot ? label : undefined}>
      <span
        aria-hidden
        className={`inline-block h-3 w-3 rounded-full border-2 border-[var(--edge)] ${connected ? 'bg-[var(--mint)]' : 'bg-[var(--skip)]'}`}
      />
      {dot ? <span className="sr-only">{label}</span> : label}
    </span>
  );
}

function CouchCount({ compact }: { compact?: boolean }) {
  const { t, settings, state } = useLive();
  const viewers = state?.viewers;
  const collapsing = (viewers ?? 0) >= COUCH_COLLAPSE_AT;
  return (
    <span
      className={`rounded-xl border-[3px] border-[var(--edge)] px-3 py-1 text-center text-[var(--ink)] shadow-[inset_3px_3px_0_rgba(0,0,0,0.15)] ${collapsing ? 'wobble bg-[var(--report)]' : 'bg-[#9fe8c8]'}`}
    >
      <span className={`font-display tabular-nums ${compact ? 'text-lg' : 'text-2xl'}`}>
        {viewers?.toLocaleString(settings.locale) ?? '–'}
      </span>
      {!compact && (
        <span className="ml-1 text-sm font-extrabold">{collapsing ? t.remote.couchCollapsing : t.remote.onCouch}</span>
      )}
    </span>
  );
}
