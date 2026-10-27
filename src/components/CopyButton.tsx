'use client';

import { useState } from 'react';

export function CopyButton({ text, label, copied, small }: { text: string; label: string; copied: string; small?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`btn shrink-0 bg-white text-[var(--ink)] ${small ? 'px-2 py-0.5 text-xs' : 'text-sm'}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {}
      }}
    >
      {done ? copied : label}
    </button>
  );
}
