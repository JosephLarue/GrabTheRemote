'use client';

import { useEffect } from 'react';
import { play } from '@/lib/sfx';

/** A CRT warming up: a white dot that stretches into a line, then fills the screen and breathes. */
export function TvPowerOn({ label }: { label?: string }) {
  useEffect(() => {
    play('power');
  }, []);
  return (
    <div className="tv-poweron absolute inset-0 z-10 grid place-items-center" aria-busy="true">
      <span aria-hidden className="tv-poweron-beam" />
      {label && <p className="font-display relative z-10 text-sm text-[var(--cream)] opacity-70 sm:text-lg">{label}</p>}
    </div>
  );
}
