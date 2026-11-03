'use client';

import Link from 'next/link';
import { useState } from 'react';
import { dictFor, errorText } from '@/i18n';
import { post } from '@/lib/api';
import { defaultInput, type RoomInput } from '@/lib/private-room';
import { useTurnstile } from '@/lib/turnstile';
import { CopyButton } from './CopyButton';
import { RoomForm } from './RoomForm';

type Created = { id: string; password: string; ownerKey: string };

/** /private: viewers join a room with its ID and password, streamers create one. */
export function PrivateRooms({ locale }: { locale: string }) {
  const t = dictFor(locale);
  const p = t.private;
  const [created, setCreated] = useState<Created | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl sm:text-5xl">🔒 {p.title}</h1>
        <p className="mt-2 max-w-prose font-bold">{p.intro}</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Join locale={locale} />
        {created ? <Ready locale={locale} created={created} /> : <Create locale={locale} onCreated={setCreated} />}
      </div>
    </div>
  );
}

function Join({ locale }: { locale: string }) {
  const t = dictFor(locale);
  const [room, setRoom] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const id = room.trim().toLowerCase().replace(/^.*\//, '');

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await post('/api/rooms/join', { room: id, password });
    if (res.ok) window.location.assign(`/${id}`);
    else {
      setMsg(errorText(t, res.err, { room: 'en' }));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={join} className="panel flex flex-col gap-3 p-5">
      <h2 className="font-display text-2xl">{t.private.joinTitle}</h2>
      <label htmlFor="join-id" className="text-sm font-extrabold">
        {t.private.roomId}
      </label>
      <input
        id="join-id"
        value={room}
        onChange={(e) => setRoom(e.target.value)}
        placeholder="p-abc123"
        autoComplete="off"
        className="field font-display tracking-wider"
      />
      <label htmlFor="join-password" className="text-sm font-extrabold">
        {t.private.password}
      </label>
      <input
        id="join-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
        className="field font-display tracking-widest uppercase"
      />
      <button
        type="submit"
        className="btn bg-[var(--glow)] text-[var(--ink)]"
        disabled={busy || !id || password.trim().length < 4}
      >
        {busy ? t.private.joining : t.private.join}
      </button>
      <p role="status" aria-live="polite" className="min-h-5 text-sm font-bold text-[var(--danger-panel-ink)]">
        {msg}
      </p>
    </form>
  );
}

function Create({ locale, onCreated }: { locale: string; onCreated: (c: Created) => void }) {
  const t = dictFor(locale);
  const { ref: captchaRef, getToken } = useTurnstile();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const create = async (room: RoomInput) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await post<Created>('/api/rooms', { room, token: await getToken() });
      if (res.ok) onCreated(res.data);
      else setMsg(errorText(t, res.err, { room: 'en' }));
    } catch {
      setMsg(t.errors.captcha);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel flex flex-col gap-4 p-5">
      <div>
        <h2 className="font-display text-2xl">{t.private.createTitle}</h2>
        <p className="mt-1 text-sm font-bold">{t.private.createIntro}</p>
      </div>
      <RoomForm
        t={t}
        initial={defaultInput(locale)}
        busy={busy}
        submitLabel={busy ? t.private.creating : t.private.create}
        onSubmit={create}
      />
      <div ref={captchaRef} />
      <p role="status" aria-live="polite" className="min-h-5 text-sm font-bold text-[var(--danger-panel-ink)]">
        {msg}
      </p>
    </section>
  );
}

function Ready({ locale, created }: { locale: string; created: Created }) {
  const t = dictFor(locale);
  const ownerLink = `${window.location.origin}/${created.id}#owner=${created.ownerKey}`;
  return (
    <section className="panel flex flex-col gap-4 p-5">
      <h2 className="font-display text-3xl">{t.private.createdTitle}</h2>
      <p className="font-bold">{t.private.showChat}</p>
      <ChatCard id={created.id} password={created.password} t={t} />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold">{t.private.ownerLink}</p>
        <div className="flex gap-2">
          <input
            readOnly
            value={ownerLink}
            className="field min-w-0 flex-1 text-xs"
            onFocus={(e) => e.target.select()}
          />
          <CopyButton text={ownerLink} label={t.private.copy} copied={t.private.copied} />
        </div>
      </div>
      <Link
        href={`/${created.id}`}
        className="btn font-display self-start bg-[var(--skip)] px-6 py-3 text-xl text-[var(--ink)]"
      >
        {t.private.enter}
      </Link>
    </section>
  );
}

/** Big and readable: made to be shown on stream. */
export function ChatCard({
  id,
  password,
  t,
  compact,
}: {
  id: string;
  password: string;
  t: ReturnType<typeof dictFor>;
  /** Stacked and smaller, for the remote drawer. */
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'flex flex-col gap-2' : 'flex flex-wrap gap-3'}>
      {[
        [t.private.idTag, id],
        [t.private.passwordTag, password],
      ].map(([label, value]) => (
        <div
          key={label}
          className={`sticker items-center gap-x-3 bg-[var(--report)] text-[var(--ink)] ${compact ? 'grid grid-cols-[1fr_auto]' : 'flex'}`}
        >
          {/* Compact (in the remote): the label on its own line, the value and Copy under it. */}
          <span className={`text-xs font-extrabold uppercase ${compact ? 'col-span-2' : ''}`}>{label}</span>
          <span className={`font-display min-w-0 tracking-wider ${compact ? 'truncate text-xl' : 'text-2xl sm:text-3xl'}`}>
            {value}
          </span>
          <CopyButton text={value} label={t.private.copy} copied={t.private.copied} small />
        </div>
      ))}
    </div>
  );
}
