'use client';

import { useState } from 'react';

/** This page's link tagged for analytics: where it was shared from (share sheet or clipboard) and what it is. */
function sharedUrl(medium: 'web' | 'copy', campaign: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('utm_source', 'share');
  url.searchParams.set('utm_medium', medium);
  url.searchParams.set('utm_campaign', campaign);
  return url.toString();
}

/** The phone's share sheet when there is one, else copies the page link. `campaign` names the page in the UTM tag. */
export function ShareButton({
  title,
  text,
  label,
  copied,
  campaign,
}: {
  title: string;
  text: string;
  label: string;
  copied: string;
  campaign: string;
}) {
  const [done, setDone] = useState(false);

  const share = async () => {
    if (navigator.share) {
      // Dismissing the sheet rejects; that's not an error worth showing.
      await navigator.share({ title, text, url: sharedUrl('web', campaign) }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${sharedUrl('copy', campaign)}`);
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch {}
  };

  return (
    <button type="button" className="btn font-display bg-[var(--skip)] px-6 py-3 text-xl text-[var(--ink)]" onClick={share}>
      📸 {done ? copied : label}
    </button>
  );
}
