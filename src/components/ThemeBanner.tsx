'use client';

import { THEMES_ENABLED } from '@/config/app';
import { formatClock, useLive, useServerNow } from '@/lib/live';

export function ThemeBanner() {
  const { state } = useLive();
  const now = useServerNow(1000);
  if (!state || !THEMES_ENABLED) return null;
  const left = formatClock(state.themeEndsAt - now);
  const t = state.theme;

  return (
    <div
      className={`sticker self-start ${t ? 'rotate-1 bg-[var(--report)]' : 'bg-[var(--cream)]'} text-[var(--ink)]`}
    >
      {t ? (
        <>
          <span className="font-display text-lg">
            {t.emoji} {t.label}
          </span>{' '}
          <span className="text-sm font-bold">is the theme. New theme in {left}.</span>
        </>
      ) : (
        <span className="text-sm font-bold">No theme right now. Anything goes for {left}.</span>
      )}
    </div>
  );
}
