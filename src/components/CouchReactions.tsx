'use client';

import { useEffect, useState } from 'react';
import { REACTION_MAX_PER_WINDOW, REACTION_WINDOW_S, REACTIONS } from '@/config/app';
import { post } from '@/lib/api';
import { useLive } from '@/lib/live';
import { play } from '@/lib/sfx';

type Floater = { id: number; emoji: string; left: number; duration: number; drift: number };

const MAX_FLOATERS = 40;
/** Per emoji per batch, so a stampede still reads as a stampede without burying the video. */
const MAX_PER_BATCH = 6;

// Shared by the bar and the overlay: your own taps float up at once, then get subtracted from the
// batch the server echoes back so they don't float twice.
const pending: Record<string, number> = {};
const localTaps = new Set<(emoji: string) => void>();
/** Taps sent but not yet echoed by the server, so the echo doesn't double them. */
const addPending = (emoji: string, delta: number) => {
  pending[emoji] = Math.max(0, (pending[emoji] ?? 0) + delta);
};
let nextId = 0;
/** This viewer's taps within the window, newest last (the cap counts them). */
const recordTap = (all: number[]) => {
  const now = Date.now();
  return [...all.filter((at) => at > now - REACTION_WINDOW_S * 1000), now];
};

/** Emojis floating up the TV screen. Render inside .tv-screen. */
export function ReactionOverlay() {
  const { onReactions } = useLive();
  const [floaters, setFloaters] = useState<Floater[]>([]);

  useEffect(() => {
    const spawn = (emoji: string, n: number) =>
      setFloaters((f) => {
        const fresh = Array.from({ length: n }, () => ({
          id: nextId++,
          emoji,
          left: 5 + Math.random() * 85,
          duration: 2.4 + Math.random() * 1.4,
          drift: (Math.random() - 0.5) * 80,
        }));
        return [...f, ...fresh].slice(-MAX_FLOATERS);
      });
    const onTap = (emoji: string) => spawn(emoji, 1);
    localTaps.add(onTap);
    const off = onReactions((batch) => {
      for (const [emoji, count] of Object.entries(batch)) {
        const mine = Math.min(pending[emoji] ?? 0, count);
        pending[emoji] = (pending[emoji] ?? 0) - mine;
        if (count - mine > 0) spawn(emoji, Math.min(count - mine, MAX_PER_BATCH));
      }
    });
    return () => {
      localTaps.delete(onTap);
      off();
    };
  }, [onReactions]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      {floaters.map((f) => (
        <span
          key={f.id}
          className="reaction-float absolute bottom-0 text-3xl sm:text-4xl"
          style={
            {
              left: `${f.left}%`,
              animationDuration: `${f.duration}s`,
              '--drift': `${f.drift}px`,
            } as React.CSSProperties
          }
          onAnimationEnd={() => setFloaters((all) => all.filter((x) => x.id !== f.id))}
        >
          {f.emoji}
        </span>
      ))}
    </div>
  );
}

/** The emoji buttons, one tight row above the chat's input. */
export function ReactionBar() {
  const { room, t, state } = useLive();
  const nothingOn = !state?.nowPlaying && !state?.twitch?.channel;
  // The server caps each viewer (REACTION_MAX_PER_WINDOW per REACTION_WINDOW_S); the bar mirrors it so a tap
  // over the cap is refused here instead of floating up and then being refused.
  const [taps, setTaps] = useState<number[]>([]);
  const capped = taps.length >= REACTION_MAX_PER_WINDOW;
  const disabled = nothingOn || capped;

  // Once capped, the oldest tap's expiry reopens the bar.
  useEffect(() => {
    if (taps.length === 0) return;
    const wait = Math.max(0, taps[0] + REACTION_WINDOW_S * 1000 - Date.now());
    const timer = setTimeout(() => setTaps((all) => all.filter((at) => at > Date.now() - REACTION_WINDOW_S * 1000)), wait + 50);
    return () => clearTimeout(timer);
  }, [taps]);

  const react = async (emoji: string) => {
    setTaps(recordTap);
    play('click');
    addPending(emoji, 1);
    localTaps.forEach((fn) => fn(emoji));
    const res = await post('/api/react', { room, emoji });
    // Rate-limited or offline: nothing comes back to subtract.
    if (!res.ok) addPending(emoji, -1);
  };

  return (
    <div
      role="group"
      aria-label={t.reactions.label}
      title={capped ? t.reactions.capped(REACTION_MAX_PER_WINDOW) : undefined}
      className="grid grid-cols-6 gap-1.5"
    >
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="btn reaction-btn bg-[var(--panel)] text-xl"
          disabled={disabled}
          onClick={() => react(emoji)}
          aria-label={capped ? t.reactions.capped(REACTION_MAX_PER_WINDOW) : t.reactions.send(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
