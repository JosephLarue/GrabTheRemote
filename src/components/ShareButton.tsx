'use client';

import { useState } from 'react';

/** The phone's share sheet when there is one, else copies the page link. */
export function ShareButton({ title, text, label, copied }: { title: string; text: string; label: string; copied: string }) {
  const [done, setDone] = useState(false);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      // Dismissing the sheet rejects; that's not an error worth showing.
      await navigator.share({ title, text, url }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
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
