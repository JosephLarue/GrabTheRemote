'use client';

import { useEffect, useState } from 'react';
import { REACTIONS } from '@/config/app';
import { post } from '@/lib/api';
import { useLive } from '@/lib/live';

type Floater = { id: number; emoji: string; left: number; duration: number; drift: number };

const MAX_FLOATERS = 40;
/** Per emoji per batch, so a stampede still reads as a stampede without burying the video. */
const MAX_PER_BATCH = 6;

// Shared by the bar and the overlay: your own taps float up at once, then get subtracted from the
// batch the server echoes back so they don't float twice.
const pending: Record<string, number> = {};
const localTaps = new Set<(emoji: string) => void>();
let nextId = 0;

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

/** The emoji buttons under the TV. */
export function ReactionBar() {
  const { room, t, state } = useLive();
  const disabled = !state?.nowPlaying && !state?.twitch?.channel;

  const react = async (emoji: string) => {
    pending[emoji] = (pending[emoji] ?? 0) + 1;
    localTaps.forEach((fn) => fn(emoji));
    const res = await post('/api/react', { room, emoji });
    // Rate-limited or offline: nothing comes back to subtract.
    if (!res.ok) pending[emoji] = Math.max(0, (pending[emoji] ?? 0) - 1);
  };

  return (
    <div role="group" aria-label={t.reactions.label} className="flex flex-wrap justify-center gap-2">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="btn reaction-btn bg-[var(--panel)] text-2xl"
          disabled={disabled}
          onClick={() => react(emoji)}
          aria-label={t.reactions.send(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
