'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useLive } from '@/lib/live';

/** Our prefix on the tab title, up to the first separator: "👀 412 · ". */
const COUNT_PREFIX = /^👀 .*? · /u;

/**
 * On the room's watch page, the tab shows how many people are on the couch in front of the server-rendered title:
 * "👀 412 · 🇫🇷 Regarder YouTube ensemble · room Français | Grab The Remote". The Hall and the share pages keep
 * their own titles. Next sets the page title on navigation and this runs after; the prefix is stripped again on
 * the way out, so none of it leaks into another page's title.
 */
export function TabTitle() {
  const { room, state, settings } = useLive();
  const path = usePathname();
  const viewers = state?.viewers;
  const onWatchPage = path === `/${room}`;
  useEffect(() => {
    if (viewers === undefined || !onWatchPage) return;
    const count = viewers.toLocaleString(settings.locale);
    document.title = `👀 ${count} · ${document.title.replace(COUNT_PREFIX, '')}`;
    return () => {
      document.title = document.title.replace(COUNT_PREFIX, '');
    };
  }, [viewers, settings.locale, onWatchPage]);
  return null;
}
