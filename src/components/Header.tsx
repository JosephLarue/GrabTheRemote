'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_NAME } from '@/config/app';
import { ROOM_INFO, ROOMS, type RoomId, isPublicRoom, isTwitchRoom } from '@/config/rooms';
import { dict } from '@/i18n';
import { useRoom } from '@/lib/use-room';

const NAV = [
  { href: '', key: 'watch' },
  { href: '/vote', key: 'vote' },
  { href: '/hall', key: 'hall' },
] as const;

export function Header({ lastRoom }: { lastRoom: RoomId }) {
  const path = usePathname();
  // Outside a room (/privacy, /legal…), links go through / and the middleware picks the room.
  const { room, ui } = useRoom(lastRoom);
  const sub = room ? path.slice(room.length + 1) : '';
  const t = dict(ui);

  return (
    <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 pt-6 pb-10">
      <Link
        href={room ? `/${room}` : '/'}
        className="flex items-center gap-2"
      >
        <Image src="/logo.png" alt="" width={56} height={56} priority className="h-12 w-12 sm:h-14 sm:w-14" />
        <span className="font-display -rotate-2 rounded-2xl border-[3px] border-[var(--edge)] bg-[var(--report)] px-4 py-1 text-2xl text-[var(--ink)] shadow-[var(--pop)] sm:text-3xl">
          {APP_NAME}
        </span>
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label={t.nav.main} className="flex gap-2">
          {/* A Twitch room is one page: the vote happens on screen, and there's no Hall of Fame. */}
          {NAV.filter((n) => !(room && isTwitchRoom(room)) || n.href === '').map((n) => {
            const active = room !== null && sub.startsWith(n.href) && (n.href !== '' || sub === '');
            return (
              <Link
                key={n.key}
                href={room ? `/${room}${n.href}` : n.href || '/'}
                aria-current={active ? 'page' : undefined}
                className={`btn text-sm sm:text-base ${active ? 'bg-[var(--glow)] text-[var(--ink)]' : 'bg-[var(--remote)] text-[var(--cream)]'}`}
              >
                {t.nav[n.key]}
              </Link>
            );
          })}
        </nav>
        <nav aria-label={t.nav.rooms} className="flex gap-1">
          {ROOMS.map((r) => (
            <Link
              key={r}
              href={`/${r}${sub}`}
              title={ROOM_INFO[r].name}
              aria-label={ROOM_INFO[r].name}
              aria-current={r === room ? 'page' : undefined}
              className={`grid h-10 w-10 place-items-center rounded-full border-[3px] border-[var(--edge)] text-lg ${r === room ? 'bg-[var(--glow)] shadow-[var(--pop)]' : 'bg-white opacity-70 hover:opacity-100'}`}
            >
              {ROOM_INFO[r].emoji}
            </Link>
          ))}
          <Link
            href="/private"
            title={t.private.nav}
            aria-label={t.private.nav}
            aria-current={path === '/private' || (room && !isPublicRoom(room)) ? 'page' : undefined}
            className={`grid h-10 w-10 place-items-center rounded-full border-[3px] border-[var(--edge)] text-lg ${path === '/private' || (room && !isPublicRoom(room)) ? 'bg-[var(--glow)] shadow-[var(--pop)]' : 'bg-white opacity-70 hover:opacity-100'}`}
          >
            🔒
          </Link>
        </nav>
      </div>
    </header>
  );
}
