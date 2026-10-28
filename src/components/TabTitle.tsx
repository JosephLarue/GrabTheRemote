'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { APP_NAME } from '@/config/app';
import { useLive } from '@/lib/live';

/** The tab shows how many people are on the couch: "👀 412 · Français · Grab The Remote". */
export function TabTitle() {
  const { state, settings } = useLive();
  const path = usePathname();
  const viewers = state?.viewers;
  useEffect(() => {
    // Next sets the page title on navigation; this runs after and wins. Private rooms keep their name.
    if (viewers === undefined) return;
    const count = viewers.toLocaleString(settings.locale);
    document.title = `👀 ${count} · ${settings.name} · ${APP_NAME}`;
  }, [viewers, settings.locale, settings.name, path]);
  return null;
}
