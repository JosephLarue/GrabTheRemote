import Script from 'next/script';

/**
 * Loads AdSense when enabled. For EEA/UK traffic, configure Google's certified CMP in
 * AdSense > Privacy & messaging: the consent message is then served by this same tag,
 * and ads stay non-personalized until the visitor consents.
 */
export function AdsScript() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  if (process.env.NEXT_PUBLIC_ADS_PROVIDER !== 'adsense' || !client) return null;
  return (
    <Script
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
    />
  );
}
