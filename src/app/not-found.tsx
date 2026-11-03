import Link from 'next/link';
import { dict } from '@/i18n';
import { lastRoom } from '@/lib/last-room';
import { decorOf } from '@/server/room-settings';

// Outside any room: speaks and looks like the last room visited, and sends people back to it.
export default async function NotFound() {
  const room = await lastRoom();
  const t = dict(room);
  return (
    <div data-room={decorOf(room)} className="contents">
      <section className="panel mx-auto max-w-xl p-6 text-center sm:p-8">
        <p className="text-6xl" aria-hidden="true">
          🚪
        </p>
        <h1 className="font-display mt-2 text-3xl">{t.notFound.title}</h1>
        <p className="mt-2 font-bold">{t.notFound.body}</p>
        <Link href={`/${room}`} className="btn mt-6 inline-block bg-[var(--glow)] text-[var(--ink)]">
          {t.notFound.back}
        </Link>
      </section>
    </div>
  );
}
