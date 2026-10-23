import Link from 'next/link';
import { APP_NAME } from '@/config/app';

export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-10 text-sm font-semibold text-[var(--muted)]">
      <p>
        {APP_NAME} is not affiliated with YouTube or Google. It uses YouTube API Services; by using it, you agree to the{' '}
        <a href="https://www.youtube.com/t/terms" className="underline underline-offset-2" target="_blank" rel="noreferrer">
          YouTube Terms of Service
        </a>
        .{' '}
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy
        </Link>{' '}
        ·{' '}
        <Link href="/legal" className="underline underline-offset-2">
          Legal notice
        </Link>
      </p>
    </footer>
  );
}
