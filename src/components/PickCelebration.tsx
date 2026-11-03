'use client';

import { useEffect, useRef, useState } from 'react';
import { isMyPick } from '@/lib/api';
import { useLive } from '@/lib/live';

const COLORS = ['#ff5da2', '#ffd23f', '#3ddcff', '#5ef2b5', '#ff4a3d', '#fff6e0'];

type Piece = { left: number; duration: number; delay: number; angle: number };
const confetti = (): Piece[] =>
  Array.from({ length: 80 }, () => ({
    left: Math.random() * 100,
    duration: 2 + Math.random() * 2,
    delay: Math.random() * 0.6,
    angle: Math.random() * 360,
  }));

/** Confetti when a video this browser voted for grabs the screen. */
export function PickCelebration() {
  const { state, t } = useLive();
  const id = state?.nowPlaying?.video.id;
  const seen = useRef<string | undefined>(undefined);
  // One confetti layout per celebration, drawn when it starts (not on every render).
  const [pieces, setPieces] = useState<Piece[] | null>(null);

  useEffect(() => {
    if (!id || id === seen.current) return;
    const first = seen.current === undefined;
    seen.current = id;
    if (first || !isMyPick(id)) return;
    setPieces(confetti());
    const t = setTimeout(() => setPieces(null), 5000);
    return () => clearTimeout(t);
  }, [id]);

  if (!pieces) return null;
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {!reduced &&
        pieces.map((piece, i) => (
          <span
            key={i}
            className="absolute top-[-20px] block h-3 w-2 rounded-sm"
            style={{
              left: `${piece.left}%`,
              background: COLORS[i % COLORS.length],
              animation: `confetti ${piece.duration}s ${piece.delay}s ease-in forwards`,
              transform: `rotate(${piece.angle}deg)`,
            }}
          />
        ))}
      <p className="font-display sticker absolute top-24 left-1/2 -translate-x-1/2 -rotate-2 bg-[var(--mint)] px-5 py-3 text-xl text-[var(--ink)] sm:text-3xl">
        {t.celebration}
      </p>
      <style>{`@keyframes confetti { to { transform: translateY(110vh) rotate(720deg); } }`}</style>
    </div>
  );
}
