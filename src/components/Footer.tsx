'use client';

import Link from 'next/link';
import { APP_NAME } from '@/config/app';
import type { RoomId } from '@/config/rooms';
import { dict } from '@/i18n';
import { useRoom } from '@/lib/use-room';

export function Footer({ lastRoom }: { lastRoom: RoomId }) {
  const t = dict(useRoom(lastRoom).ui).footer;
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-10 text-sm font-semibold text-[var(--muted)]">
      <p>
        {t.notAffiliated(APP_NAME)}{' '}
        <a href="https://www.youtube.com/t/terms" className="underline underline-offset-2" target="_blank" rel="noreferrer">
          {t.ytTerms}
        </a>
        .{' '}
        <Link href="/privacy" className="underline underline-offset-2">
          {t.privacy}
        </Link>{' '}
        ·{' '}
        <Link href="/legal" className="underline underline-offset-2">
          {t.legal}
        </Link>
      </p>
    </footer>
  );
}
