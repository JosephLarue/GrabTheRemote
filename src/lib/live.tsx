'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { RoomId } from '@/config/rooms';
import { type Dict, dictFor } from '@/i18n';
import type { ChatMessage, LiveEvent, LiveSnapshot, ReactionBatch, RoomSettings } from './types';

type Me = {
  voteCooldownEndsAt: number | null;
  skipped: boolean;
  reported: boolean;
  /** This viewer holds the stolen remote. */
  remote: boolean;
  /** Invite a friend: this viewer's code and progress in this room. Null in Twitch rooms. */
  invite: { code: string; friends: number; need: number; boostEndsAt: number | null } | null;
  /** Twitch rooms: this viewer's keep/change vote and pick in the current round. */
  decided: 'keep' | 'change' | null;
  picked: string | null;
  /** Private rooms: this viewer is the streamer who made the room, and the password to show their chat. */
  owner: boolean;
  password: string | null;
};

type LiveCtx = {
  room: RoomId;
  /** UI copy in the room's language. */
  t: Dict;
  /** Rules, themes and look; live, since a private room's streamer can change them. */
  settings: RoomSettings;
  state: LiveSnapshot | null;
  connected: boolean;
  /** Server time in ms: Date.now() corrected by the offset measured at connect. */
  serverNow: () => number;
  me: Me;
  refreshMe: () => Promise<void>;
  /** Couch reactions aren't state: listen to the batches as they come. Returns the unsubscribe. */
  onReactions: (fn: (batch: ReactionBatch) => void) => () => void;
  /** Same for chat lines. */
  onChat: (fn: (msg: ChatMessage) => void) => () => void;
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
    case 'steal':
      return { ...s, steal: e.data };
    case 'twitch':
      return { ...s, twitch: e.data };
    case 'room':
      return { ...s, room: e.data };
    case 'closed':
      return s;
    case 'react':
    case 'chat':
      return s;
  }
}

const RECONNECT_MIN_MS = 3000;
const RECONNECT_MAX_MS = 30_000;

export function LiveProvider({
  room,
  settings: initial,
  children,
}: {
  room: RoomId;
  settings: RoomSettings;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<LiveSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [me, setMe] = useState<Me>({
    voteCooldownEndsAt: null,
    skipped: false,
    reported: false,
    remote: false,
    invite: null,
    decided: null,
    picked: null,
    owner: false,
    password: null,
  });
  const offset = useRef(0);
  const reactionListeners = useRef(new Set<(batch: ReactionBatch) => void>());
  const chatListeners = useRef(new Set<(msg: ChatMessage) => void>());

  // A public room's settings are constants, and the page keeps the look it was served (The Jungle draws its
  // faction per visit). A private room's streamer can change everything live, so the snapshot wins there.
  const settings = initial.private ? (state?.room ?? initial) : initial;

  // The root layout can't know the room, so the room sets the document language itself.
  useEffect(() => {
    document.documentElement.lang = settings.locale;
  }, [settings.locale]);

  const refreshMe = useCallback(async () => {
    const res = await fetch(`/api/me?room=${room}`, { cache: 'no-store' }).catch(() => null);
    if (res?.ok) setMe(await res.json());
  }, [room]);

  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let backoff = RECONNECT_MIN_MS;
    let closed = false;

    const onSnapshot = (snap: LiveSnapshot) => {
      offset.current = snap.serverNow - Date.now();
    };

    const startPolling = () => {
      if (poll) return;
      refreshMe();
      poll = setInterval(async () => {
        const res = await fetch(`/api/state?room=${room}`, { cache: 'no-store' }).catch(() => null);
        // Closed, or the password changed: the server-rendered page shows what happened.
        if (res?.status === 403 || res?.status === 404) window.location.reload();
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
        backoff = RECONNECT_MIN_MS;
        if (poll) clearInterval(poll);
        poll = null;
        // Back after an outage: cooldowns, skip/report marks and the invite may have moved meanwhile.
        refreshMe();
      };
      es.onmessage = (m) => {
        let e: LiveEvent;
        try {
          e = JSON.parse(m.data) as LiveEvent;
        } catch {
          return;
        }
        if (e.type === 'snapshot') onSnapshot(e.data);
        if (e.type === 'closed') window.location.reload();
        if (e.type === 'nowplaying' || e.type === 'steal') refreshMe();
        if (e.type === 'react') reactionListeners.current.forEach((fn) => fn(e.data));
        else if (e.type === 'chat') chatListeners.current.forEach((fn) => fn(e.data));
        else setState((s) => apply(s, e));
      };
      es.onerror = () => {
        // EventSource retries on its own after a network blip; poll meanwhile so the screen keeps moving. But a
        // non-2xx answer (a 502 during a deploy, a Cloudflare error) closes it for good: reconnect ourselves,
        // slower each time.
        setConnected(false);
        startPolling();
        if (es?.readyState === EventSource.CLOSED && !retry) {
          es.close();
          retry = setTimeout(() => {
            retry = null;
            backoff = Math.min(backoff * 2, RECONNECT_MAX_MS);
            connect();
          }, backoff);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      es?.close();
      if (poll) clearInterval(poll);
      if (retry) clearTimeout(retry);
    };
  }, [room, refreshMe]);

  const serverNow = useCallback(() => Date.now() + offset.current, []);
  const onReactions = useCallback((fn: (batch: ReactionBatch) => void) => {
    reactionListeners.current.add(fn);
    return () => void reactionListeners.current.delete(fn);
  }, []);
  const onChat = useCallback((fn: (msg: ChatMessage) => void) => {
    chatListeners.current.add(fn);
    return () => void chatListeners.current.delete(fn);
  }, []);

  // One object per real change: every `useLive` consumer re-renders when the value identity changes.
  const value = useMemo(
    () => ({ room, t: dictFor(settings.locale), settings, state, connected, serverNow, me, refreshMe, onReactions, onChat }),
    [room, settings, state, connected, serverNow, me, refreshMe, onReactions, onChat],
  );

  return (
    <Ctx.Provider value={value}>
      {/* The room's look ([data-room] in globals.css): a private room wears the decor its streamer picked. */}
      <div data-room={settings.decor} className="contents">
        {children}
      </div>
    </Ctx.Provider>
  );
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
