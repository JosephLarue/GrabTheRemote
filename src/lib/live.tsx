'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { RoomId } from '@/config/rooms';
import type { LiveEvent, LiveSnapshot } from './types';

type Me = { voteCooldownEndsAt: number | null; skipped: boolean; reported: boolean };

type LiveCtx = {
  room: RoomId;
  state: LiveSnapshot | null;
  connected: boolean;
  /** Server time in ms: Date.now() corrected by the offset measured at connect. */
  serverNow: () => number;
  me: Me;
  refreshMe: () => Promise<void>;
};

const Ctx = createContext<LiveCtx | null>(null);

function apply(s: LiveSnapshot | null, e: LiveEvent): LiveSnapshot | null {
  if (e.type === 'snapshot') return e.data;
  if (!s) return s;
  switch (e.type) {
    case 'nowplaying':
      return { ...s, nowPlaying: e.data };
    case 'pool':
      return { ...s, pool: e.data };
    case 'theme':
      return { ...s, theme: e.data.theme, themeEndsAt: e.data.themeEndsAt, pool: e.data.pool };
    case 'viewers':
      return { ...s, viewers: e.data };
    case 'skip':
      return { ...s, skip: e.data };
    case 'report':
      return { ...s, report: e.data };
  }
}

export function LiveProvider({ room, children }: { room: RoomId; children: React.ReactNode }) {
  const [state, setState] = useState<LiveSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [me, setMe] = useState<Me>({ voteCooldownEndsAt: null, skipped: false, reported: false });
  const offset = useRef(0);

  const refreshMe = useCallback(async () => {
    const res = await fetch(`/api/me?room=${room}`, { cache: 'no-store' }).catch(() => null);
    if (res?.ok) setMe(await res.json());
  }, [room]);

  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let closed = false;

    const onSnapshot = (snap: LiveSnapshot) => {
      offset.current = snap.serverNow - Date.now();
    };

    const startPolling = () => {
      if (poll) return;
      poll = setInterval(async () => {
        const res = await fetch(`/api/state?room=${room}`, { cache: 'no-store' }).catch(() => null);
        if (!res?.ok) return;
        const snap = (await res.json()) as LiveSnapshot;
        onSnapshot(snap);
        setState(snap);
      }, 5000);
    };

    const connect = () => {
      if (closed) return;
      es = new EventSource(`/api/stream?room=${room}`);
      es.onopen = () => {
        setConnected(true);
        if (poll) clearInterval(poll);
        poll = null;
      };
      es.onmessage = (m) => {
        const e = JSON.parse(m.data) as LiveEvent;
        if (e.type === 'snapshot') onSnapshot(e.data);
        if (e.type === 'nowplaying') refreshMe();
        setState((s) => apply(s, e));
      };
      es.onerror = () => {
        // EventSource retries on its own; poll meanwhile so the screen keeps moving.
        setConnected(false);
        startPolling();
      };
    };

    connect();
    refreshMe();
    return () => {
      closed = true;
      es?.close();
      if (poll) clearInterval(poll);
    };
  }, [room, refreshMe]);

  const serverNow = useCallback(() => Date.now() + offset.current, []);

  return <Ctx.Provider value={{ room, state, connected, serverNow, me, refreshMe }}>{children}</Ctx.Provider>;
}

export function useLive() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLive outside LiveProvider');
  return ctx;
}

/** Re-renders every `everyMs` and returns the current server time. */
export function useServerNow(everyMs = 250) {
  const { serverNow } = useLive();
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), everyMs);
    return () => clearInterval(t);
  }, [serverNow, everyMs]);
  return now;
}

export function formatClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
