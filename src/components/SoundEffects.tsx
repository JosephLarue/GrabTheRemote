'use client';

import { useEffect, useRef, useState } from 'react';
import { isMyPick } from '@/lib/api';
import { addCard } from '@/lib/cards';
import { shatter } from '@/lib/fx';
import { useLive } from '@/lib/live';
import { useClientValue } from '@/lib/use-client-value';
import { onSfxChange, play, setSfxEnabled, sfxEnabled } from '@/lib/sfx';
import type { NowPlaying } from '@/lib/types';

/** Reads the live state and turns its changes into sounds and effects. Also collects shame cards. */
export function SoundEffects() {
  const { room, state, serverNow, t } = useLive();
  const np = state?.nowPlaying ?? null;
  const steal = state?.steal ?? null;
  const prev = useRef<NowPlaying | null | undefined>(undefined);
  const stealWas = useRef(false);
  const [toast, setToast] = useState<string | null>(null);

  // Channel changes: static for a normal switch, a buzzer when the crowd cut it short, the TV shattering
  // on a veto. A card is earned when the video that just died was one of this browser's picks.
  useEffect(() => {
    const before = prev.current;
    prev.current = np;
    if (before === undefined || before?.playId === np?.playId) return;
    const now = serverNow();
    const cutShort = !!before && before.state === 'playing' && before.endsAt - now > 3000 && now >= before.startedAt;
    const vetoed = cutShort && !!steal && steal.endsAt > now;
    if (vetoed) {
      shatter(before?.video.thumbnailUrl);
      play('shatter');
    } else if (cutShort || before?.state === 'reported_card') {
      play('buzz');
    } else {
      play('zap');
    }
    if (before && (cutShort || before.state === 'reported_card') && isMyPick(before.video.id)) {
      if (addCard({ room, playId: before.playId, videoId: before.video.id })) {
        setToast(t.cards.claimed);
        setTimeout(() => setToast(null), 6000);
      }
    }
    if (np && isMyPick(np.video.id)) {
      const delay = Math.max(0, np.startedAt - now);
      setTimeout(() => play('cheer'), delay);
    }
  }, [np, steal, serverNow, room, t]);

  useEffect(() => {
    const active = !!steal && steal.endsAt > serverNow();
    if (active && !stealWas.current) play('steal');
    stealWas.current = active;
  }, [steal, serverNow]);

  if (!toast) return null;
  return (
    <p role="status" className="sticker fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-[60] -translate-x-1/2 bg-[var(--ink)] text-center text-sm text-[var(--cream)] lg:bottom-6">
      {toast}
    </p>
  );
}

/** The sound on/off switch, remembered per browser. */
export function SfxToggle({ compact }: { compact?: boolean }) {
  const { t } = useLive();
  const on = useClientValue(sfxEnabled, true, onSfxChange);
  const label = on ? t.sfx.on : t.sfx.off;
  return (
    <button
      type="button"
      onClick={() => setSfxEnabled(!on)}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`btn px-3 py-1 text-sm ${on ? 'bg-[var(--mint)] text-[var(--ink)]' : 'bg-[var(--remote-hi)] text-[var(--cream)]'}`}
    >
      <span aria-hidden>{on ? '🔔' : '🔕'}</span>
      {!compact && <span className="sr-only">{label}</span>}
    </button>
  );
}
