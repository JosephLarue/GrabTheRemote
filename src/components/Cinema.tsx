'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLive } from '@/lib/live';
import { useClientValue } from '@/lib/use-client-value';

export const useCinema = () => useContext(Ctx);

type CinemaCtx = {
  on: boolean;
  toggle: (next: boolean) => void;
  /** In full screen only: the chat can step aside so the TV gets the whole screen. */
  chatOpen: boolean;
  setChatOpen: (next: boolean) => void;
};

const Ctx = createContext<CinemaCtx>({ on: false, toggle: () => {}, chatOpen: true, setChatOpen: () => {} });

const CHAT_KEY = 'gtr:cinema-chat';
function readChatOpen() {
  try {
    return localStorage.getItem(CHAT_KEY) !== '0';
  } catch {
    return true;
  }
}

/**
 * Full screen for the TV, with the chat kept beside it (under it on a portrait screen). The stage covers the
 * window and asks the browser for real full screen on top; where an element can't go full screen (iPhone), the
 * covering alone does the job. Inside, `.cinema-hide` parts step aside (globals.css) and the remote still opens.
 */
export function CinemaStage({ className, children }: { className: string; children: React.ReactNode }) {
  const stage = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  // Whoever folded the chat away last time gets it folded again (the stored choice until this visit changes it).
  const stored = useClientValue(readChatOpen, true);
  const [chosen, setChatOpenState] = useState<boolean | null>(null);
  const chatOpen = chosen ?? stored;

  const setChatOpen = useCallback((next: boolean) => {
    setChatOpenState(next);
    try {
      localStorage.setItem(CHAT_KEY, next ? '1' : '0');
    } catch {}
  }, []);

  const toggle = useCallback((next: boolean) => {
    setOn(next);
    const el = stage.current;
    if (next) el?.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    if (!on) return;
    // Esc in real full screen only leaves full screen: follow it out. Without it, Esc is ours.
    const onChange = () => !document.fullscreenElement && setOn(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.fullscreenElement && setOn(false);
    document.addEventListener('fullscreenchange', onChange);
    window.addEventListener('keydown', onKey);
    document.documentElement.toggleAttribute('data-cinema', true);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      window.removeEventListener('keydown', onKey);
      document.documentElement.removeAttribute('data-cinema');
    };
  }, [on]);

  return (
    <Ctx.Provider value={{ on, toggle, chatOpen, setChatOpen }}>
      <div ref={stage} className={`${className} cinema ${on ? 'is-cinema' : ''} ${chatOpen ? '' : 'chat-folded'}`}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

/** The CTA on the TV: into full screen, and back out. */
export function CinemaButton() {
  const { t } = useLive();
  const { on, toggle } = useContext(Ctx);
  const label = on ? t.cinema.exit : t.cinema.enter;
  return (
    <button
      type="button"
      onClick={() => toggle(!on)}
      aria-pressed={on}
      title={label}
      className="btn shrink-0 bg-[var(--panel)] px-3 py-1.5 text-sm text-[var(--panel-ink)]"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {on ? (
          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        ) : (
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        )}
      </svg>
      <span className="sr-only sm:not-sr-only">{label}</span>
    </button>
  );
}

/** Full screen with the chat folded away: brings it back, and counts what was said meanwhile. */
export function ChatUnfoldButton() {
  const { t, onChat } = useLive();
  const { on, chatOpen, setChatOpen } = useContext(Ctx);
  const [unread, setUnread] = useState(0);
  const folded = on && !chatOpen;
  // Folding or unfolding resets the count (state derived from a prop: adjusted during render, not in an effect).
  const [wasFolded, setWasFolded] = useState(folded);
  if (folded !== wasFolded) {
    setWasFolded(folded);
    setUnread(0);
  }

  useEffect(() => {
    if (folded) return onChat(() => setUnread((n) => n + 1));
  }, [folded, onChat]);

  if (!folded) return null;
  return (
    <button
      type="button"
      onClick={() => setChatOpen(true)}
      title={t.cinema.showChat}
      className="btn relative shrink-0 bg-[var(--panel)] px-3 py-1.5 text-sm text-[var(--panel-ink)]"
    >
      <span aria-hidden>💬</span>
      <span className="sr-only sm:not-sr-only">{t.cinema.showChat}</span>
      {unread > 0 && (
        <span className="absolute -top-2 -right-2 min-w-6 rounded-full border-2 border-[var(--edge)] bg-[var(--glow)] px-1 text-xs font-black text-[var(--ink)] tabular-nums">
          <span aria-hidden>{unread > 99 ? '99+' : unread}</span>
          <span className="sr-only">{t.cinema.newMessages(unread)}</span>
        </span>
      )}
    </button>
  );
}
