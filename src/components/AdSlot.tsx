'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { ADSENSE_CLIENT, adsOn } from '@/lib/ads';

const SIZES = {
  rail: { w: 300, h: 250 },
  banner: { w: 728, h: 90 },
} as const;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Fixed-size ad slot (no layout shift). Never place it over the player.
 * Renders nothing unless AdSense is fully configured and the page takes ads (see `adsOn`). Consent is handled by
 * the CMP script (see AdsScript).
 */
export function AdSlot({ slot, size = 'rail' }: { slot: string; size?: keyof typeof SIZES }) {
  const { w, h } = SIZES[size];
  const on = adsOn(usePathname());

  useEffect(() => {
    if (!on) return;
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {}
  }, [on]);

  if (!on) return null;

  return (
    <div className="mx-auto flex flex-col items-center gap-1" style={{ maxWidth: '100%' }}>
      <span className="text-[10px] font-bold opacity-70">Ad</span>
      <div style={{ width: w, height: h, maxWidth: '100%' }} className="overflow-hidden rounded-xl bg-black/10">
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: w, height: h }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slot}
        />
      </div>
    </div>
  );
}
