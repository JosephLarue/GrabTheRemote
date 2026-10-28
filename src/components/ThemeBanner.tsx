'use client';

import { THEMES_ENABLED } from '@/config/app';
import { themeLabel } from '@/i18n';
import { formatClock, useLive, useServerNow } from '@/lib/live';

export function ThemeBanner() {
  const { state, t: d } = useLive();
  const now = useServerNow(1000);
  const t = state?.theme;
  // No theme: nothing to announce (a sticker saying "anything goes" was noise).
  if (!state || !THEMES_ENABLED || !t) return null;
  const left = formatClock(state.themeEndsAt - now);

  return (
    <div
      className="sticker self-start rotate-1 bg-[var(--report)] text-[var(--ink)]"
    >
      <span className="font-display text-lg">
        {t.emoji} {themeLabel(d, t)}
      </span>{' '}
      <span className="text-sm font-bold">{d.theme.current(left)}</span>
    </div>
  );
}
