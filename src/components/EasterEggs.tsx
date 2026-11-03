'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EGG_COOLDOWN_S, EGG_DURATION_MS } from '@/config/app';
import { flash, tvSnow } from '@/lib/fx';
import { useLive } from '@/lib/live';
import { play } from '@/lib/sfx';

type Egg = 'bw' | 'snow' | 'roll';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const TAPS = 5;
const TAP_WINDOW_MS = 3000;
const SNOW_MS = 5000;

/** Each egg fires at most once per EGG_COOLDOWN_S per browser. */
function armed(egg: Egg) {
  try {
    const last = Number(localStorage.getItem(`gtr:egg:${egg}`) ?? 0);
    if (Date.now() - last < EGG_COOLDOWN_S * 1000) return false;
    localStorage.setItem(`gtr:egg:${egg}`, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

/**
 * Hidden toys on the watch page. None of them touches playback: they only dress the TV for a few seconds.
 * Konami code: black and white. Five taps on an antenna: analog snow. Five taps on a knob: the vertical hold goes.
 * Render inside the .tv element (the antenna hotspots are positioned against it).
 */
export function EasterEggs() {
  const { t } = useLive();
  const [toast, setToast] = useState<string | null>(null);
  const taps = useRef<Record<string, number[]>>({});

  const fire = useCallback(
    (egg: Egg) => {
      if (!armed(egg)) return;
      play('chime');
      setToast(t.eggs[egg]);
      setTimeout(() => setToast(null), 5000);
      if (egg === 'bw') flash(document.querySelector('.tv-screen'), 'egg-bw', EGG_DURATION_MS);
      if (egg === 'roll') document.querySelectorAll('.tv-player').forEach((el) => flash(el, 'egg-roll', EGG_DURATION_MS));
      if (egg === 'snow') tvSnow(SNOW_MS);
    },
    [t],
  );

  /** Counts quick taps per target; fires on the fifth. */
  const tap = useCallback(
    (key: string, egg: Egg) => {
      const now = Date.now();
      const recent = [...(taps.current[key] ?? []), now].filter((at) => now - at < TAP_WINDOW_MS);
      taps.current[key] = recent;
      if (recent.length >= TAPS) {
        taps.current[key] = [];
        fire(egg);
      }
    },
    [fire],
  );

  // Konami code, anywhere on the page except inside a text field.
  useEffect(() => {
    let i = 0;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      i = e.key === KONAMI[i] ? i + 1 : e.key === KONAMI[0] ? 1 : 0;
      if (i === KONAMI.length) {
        i = 0;
        fire('bw');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fire]);

  // The knobs are plain decoration elsewhere on the page: one click delegate catches them all.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.('.tv-knob')) tap('knob', 'roll');
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [tap]);

  return (
    <>
      {/* Invisible hotspots over the two rabbit ears (.tv::before/::after in globals.css). */}
      <span aria-hidden className="egg-antenna egg-antenna-left" onClick={() => tap('antenna', 'snow')} />
      <span aria-hidden className="egg-antenna egg-antenna-right" onClick={() => tap('antenna', 'snow')} />

      {toast && (
        <p role="status" className="sticker fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-[60] -translate-x-1/2 bg-[var(--report)] text-center text-sm text-[var(--ink)] lg:bottom-6">
          {toast}
        </p>
      )}
    </>
  );
}
