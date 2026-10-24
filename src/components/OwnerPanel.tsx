'use client';

import { useState } from 'react';
import { errorText } from '@/i18n';
import { post } from '@/lib/api';
import { useClaimOwner } from '@/lib/claim-owner';
import { useLive } from '@/lib/live';
import { type RoomInput, toInput } from '@/lib/private-room';
import { ChatCard } from './PrivateRooms';
import { RoomForm } from './RoomForm';

/**
 * The streamer's controls, in their own private room only: the ID and password to show on stream, pause,
 * skip, settings and closing the room. Everyone else never sees it, and the server checks the owner cookie.
 */
export function OwnerPanel() {
  const { room, t, settings, state, me, refreshMe } = useLive();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  useClaimOwner(room);
  if (!settings.private || !me.owner) return null;

  const p = t.private;
  const np = state?.nowPlaying;
  const paused = Boolean(np?.pausedAt);

  const call = async (path: string, body: Record<string, unknown>) => {
    setBusy(true);
    setMsg(null);
    const res = await post(path, { room, ...body });
    setBusy(false);
    if (!res.ok) setMsg(errorText(t, res.err, { room }));
    return res.ok;
  };

  const save = async (input: RoomInput) => {
    if (await call('/api/rooms/settings', { settings: input })) {
      setMsg(p.saved);
      setEditing(false);
      refreshMe();
    }
  };

  const close = async () => {
    if (window.confirm(p.closeConfirm) && (await call('/api/rooms/control', { action: 'close' }))) {
      window.location.assign('/private');
    }
  };

  // Padding, not margin: a margin would collapse into the TV's and the antennas would poke through.
  return (
    <div className="pb-6">
      <section aria-label={p.panel} className="panel owner-panel flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl">🎙️ {p.panel}</h2>
          {me.password && <ChatCard id={room} password={me.password} t={t} />}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn bg-[var(--report)] text-[var(--ink)]"
            disabled={busy || !np || np.state !== 'playing'}
            onClick={() => call('/api/rooms/control', { action: paused ? 'resume' : 'pause' })}
          >
            {paused ? p.resume : p.pause}
          </button>
          <button
            type="button"
            className="btn bg-[var(--skip)] text-[var(--ink)]"
            disabled={busy || !np}
            onClick={() => call('/api/rooms/control', { action: 'skip' })}
          >
            {p.skipNow}
          </button>
          <button
            type="button"
            aria-expanded={editing}
            className="btn bg-[var(--glow)] text-[var(--ink)]"
            onClick={() => setEditing((e) => !e)}
          >
            {p.settings}
          </button>
          <button
            type="button"
            className="btn ml-auto bg-[var(--ink)] text-[var(--cream)]"
            disabled={busy}
            onClick={close}
          >
            {p.close}
          </button>
        </div>
        {editing && (
          <RoomForm
            t={t}
            initial={toInput(settings)}
            editing
            busy={busy}
            submitLabel={busy ? p.saving : p.save}
            onSubmit={save}
          />
        )}
        <p role="status" aria-live="polite" className="min-h-5 text-sm font-bold">
          {msg}
        </p>
      </section>
    </div>
  );
}
