'use client';

import Link from 'next/link';
import { APP_NAME, COFFEE_URL } from '@/config/app';
import { type RoomId, isTwitchRoom } from '@/config/rooms';
import { dict } from '@/i18n';
import { useRoom } from '@/lib/use-room';

export function Footer({ lastRoom }: { lastRoom: RoomId }) {
  const { room, ui } = useRoom(lastRoom);
  const t = dict(ui).footer;
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-10 text-sm font-semibold text-[var(--muted)]">
      <p className="mb-4 text-center">
        <a
          href={COFFEE_URL}
          className="sticker bg-[var(--report)] text-base text-[var(--ink)] transition hover:-rotate-2 hover:scale-105 sm:text-lg"
          target="_blank"
          rel="noreferrer"
        >
          {t.coffee}
        </a>
      </p>
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
      {room && isTwitchRoom(room) && (
        <p className="mt-1">
          Streams play in Twitch&apos;s player, and the{' '}
          <a href="https://www.twitch.tv/p/legal/terms-of-service/" className="underline underline-offset-2" target="_blank" rel="noreferrer">
            Twitch Terms of Service
          </a>{' '}
          apply. {APP_NAME} is not affiliated with Twitch.
        </p>
      )}
    </footer>
  );
}
