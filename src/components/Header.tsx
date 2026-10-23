'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_NAME } from '@/config/app';

const NAV = [
  { href: '/', label: 'Watch' },
  { href: '/vote', label: 'Vote' },
  { href: '/hall', label: 'Hall of Fame' },
];

export function Header() {
  const path = usePathname();
  return (
    <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 pt-6 pb-10">
      <Link
        href="/"
        className="font-display -rotate-2 rounded-2xl border-[3px] border-[var(--edge)] bg-[var(--report)] px-4 py-1 text-2xl text-[var(--ink)] shadow-[var(--pop)] sm:text-3xl"
      >
        {APP_NAME} 📺
      </Link>
      <nav aria-label="Main" className="flex gap-2">
        {NAV.map((n) => {
          const active = n.href === '/' ? path === '/' : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? 'page' : undefined}
              className={`btn text-sm sm:text-base ${active ? 'bg-[var(--glow)] text-[var(--ink)]' : 'bg-[var(--remote)] text-[var(--cream)]'}`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
