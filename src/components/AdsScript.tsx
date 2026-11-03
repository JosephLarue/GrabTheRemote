'use client';

import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { ADSENSE_CLIENT, adsOn } from '@/lib/ads';

/**
 * Loads AdSense when enabled, and not on the ad-free pages (legal, admin, private rooms: see `adsOn`).
 * For EEA/UK traffic, configure Google's certified CMP in AdSense > Privacy & messaging: the consent message is
 * then served by this same tag, and ads stay non-personalized until the visitor consents.
 */
export function AdsScript() {
  if (!adsOn(usePathname())) return null;
  return (
    <Script
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
    />
  );
}
