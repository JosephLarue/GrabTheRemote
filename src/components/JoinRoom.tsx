'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { RoomId } from '@/config/rooms';
import { dictFor, errorText } from '@/i18n';
import { post } from '@/lib/api';
import { useClaimOwner } from '@/lib/claim-owner';

/** A private room's door: its name, and the password field. */
export function JoinRoom({ room, name, locale }: { room: RoomId; name: string; locale: string }) {
  const t = dictFor(locale);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useClaimOwner(room);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await post('/api/rooms/join', { room, password });
    if (res.ok) window.location.reload();
    else {
      setMsg(errorText(t, res.err, { room }));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <h1 className="font-display text-4xl">🔒 {name}</h1>
      <form onSubmit={join} className="panel flex flex-col gap-3 p-5">
        <p className="font-bold">{t.private.lockedSub}</p>
        <label className="text-sm font-extrabold" htmlFor="room-password">
          {t.private.password}
        </label>
        <input
          id="room-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          autoFocus
          className="field font-display text-2xl tracking-widest uppercase"
        />
        <button type="submit" className="btn bg-[var(--glow)] text-[var(--ink)]" disabled={busy || password.trim().length < 4}>
          {busy ? t.private.joining : t.private.join}
        </button>
        <p role="status" aria-live="polite" className="min-h-5 text-sm font-bold text-[var(--danger-panel-ink)]">
          {msg}
        </p>
      </form>
    </div>
  );
}

/** What's left of a private room that closed (or never existed). */
export function RoomClosed({ locale }: { locale: string }) {
  const t = dictFor(locale);
  return (
    <div className="panel mx-auto flex max-w-md flex-col gap-3 p-6">
      <h1 className="font-display text-3xl">🚪 {t.private.closedTitle}</h1>
      <p className="font-bold">{t.private.closedSub}</p>
      <Link href="/private" className="btn self-start bg-[var(--glow)] text-[var(--ink)]">
        {t.private.title}
      </Link>
    </div>
  );
}
