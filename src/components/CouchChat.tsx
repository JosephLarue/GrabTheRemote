'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CHAT_HISTORY, CHAT_MAX_LENGTH } from '@/config/app';
import { errorText } from '@/i18n';
import { post } from '@/lib/api';
import { type ChatName, chatName, isChatSeed } from '@/lib/chat';
import { useLive } from '@/lib/live';
import { useCinema } from './Cinema';
import { ReactionBar } from './CouchReactions';
import type { ChatMessage } from '@/lib/types';

const SEED_KEY = 'gtr:chat-seed';

/**
 * A watch page's grid: the TV and what plays next on the left, the chat on the right from xl (narrower screens,
 * or one with the remote open, would crush the TV: there the chat comes after the queue).
 */
export const WITH_CHAT = 'grid gap-x-8 gap-y-6 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_380px]';

/** The right-hand column: the chat stays in view while the page scrolls past the queue. */
export const CHAT_RAIL = 'chat-rail flex min-w-0 flex-col gap-6 xl:sticky xl:top-4 xl:self-start';

/** One nickname per tab, kept across reloads; a new tab is a new person on the couch. */
function sessionSeed() {
  try {
    const kept = sessionStorage.getItem(SEED_KEY);
    if (isChatSeed(kept)) return kept;
    const seed = crypto.randomUUID();
    sessionStorage.setItem(SEED_KEY, seed);
    return seed;
  } catch {
    return crypto.randomUUID();
  }
}

/** Adds what isn't there yet (the live echo of your own line, a reload of the history), oldest first. */
function merge(list: ChatMessage[], fresh: ChatMessage[]) {
  const seen = new Set(list.map((m) => m.id));
  const added = fresh.filter((m) => !seen.has(m.id));
  if (!added.length) return list;
  return [...list, ...added].sort((a, b) => a.at - b.at).slice(-CHAT_HISTORY);
}

/** The couch talking. No accounts: everyone gets a made-up nickname for as long as their tab is open. */
export function CouchChat() {
  const { room, t, connected, onChat } = useLive();
  const cinema = useCinema();
  const [seed, setSeed] = useState<string | null>(null);
  const [me, setMe] = useState<ChatName | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const list = useRef<HTMLOListElement>(null);
  const pinned = useRef(true);

  useEffect(() => {
    const s = sessionSeed();
    setSeed(s);
    setMe(chatName(s));
  }, []);

  useEffect(() => onChat((m) => setMessages((all) => merge(all, [m]))), [onChat]);

  // On load and after every reconnect: lines sent while the stream was down come back from the history.
  useEffect(() => {
    if (!connected) return;
    let live = true;
    fetch(`/api/chat?room=${room}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { messages: ChatMessage[] } | null) => live && data && setMessages((all) => merge(all, data.messages)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [room, connected]);

  // Follow the conversation, unless someone scrolled up to read.
  useLayoutEffect(() => {
    const el = list.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seed || !text.trim() || busy) return;
    setBusy(true);
    const res = await post<{ message: ChatMessage }>('/api/chat', { room, seed, text });
    setBusy(false);
    if (res.ok) {
      setText('');
      setMsg('');
      pinned.current = true;
      setMessages((all) => merge(all, [res.data.message]));
    } else {
      setMsg(errorText(t, res.err, { room }));
    }
  };

  return (
    <section aria-label={t.chat.title} className="chat-panel panel flex min-w-0 flex-col gap-3 p-4 xl:h-[min(680px,calc(100dvh-2rem))]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-display text-2xl">💬 {t.chat.title}</h2>
        {me && (
          <p className="min-w-0 text-xs font-bold">
            {t.chat.you} <Nick {...me} />
          </p>
        )}
        {cinema.on && (
          <button
            type="button"
            onClick={() => cinema.setChatOpen(false)}
            className="btn ml-auto bg-[var(--remote-hi)] px-3 py-1 text-sm text-[var(--cream)]"
            aria-label={t.cinema.hideChat}
            title={t.cinema.hideChat}
          >
            ▸
          </button>
        )}
      </div>

      <ol
        ref={list}
        aria-live="polite"
        aria-relevant="additions"
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="chat-list flex h-72 flex-col gap-2 overflow-y-auto xl:h-0 xl:min-h-40 xl:flex-1 overscroll-contain rounded-xl border-[3px] border-[var(--edge)] bg-white p-3 text-sm text-[var(--ink)] shadow-[inset_3px_3px_0_rgba(0,0,0,0.12)]"
      >
        {messages.length === 0 && <li className="m-auto text-center font-bold opacity-60">{t.chat.empty}</li>}
        {messages.map((m) => (
          <li key={m.id} className="break-words [overflow-wrap:anywhere]">
            <Nick name={m.name} hue={m.hue} /> <span className="font-semibold">{m.text}</span>
          </li>
        ))}
      </ol>

      <ReactionBar />
      <form onSubmit={send} className="flex gap-2">
        <label htmlFor="chat-text" className="sr-only">
          {t.chat.placeholder}
        </label>
        <input
          id="chat-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={CHAT_MAX_LENGTH}
          autoComplete="off"
          enterKeyHint="send"
          placeholder={t.chat.placeholder}
          className="field min-w-0 flex-1"
        />
        <button type="submit" className="btn shrink-0 bg-[var(--glow)] px-4 text-[var(--ink)]" disabled={!seed || busy || !text.trim()}>
          {t.chat.send}
        </button>
      </form>
      {msg && (
        <p role="status" className="-mt-1 text-sm font-bold text-[var(--skip)]">
          {msg}
        </p>
      )}
    </section>
  );
}

function Nick({ name, hue }: ChatName) {
  return (
    <span
      className="inline-block rounded-md border-2 border-[var(--edge)] px-1.5 text-xs font-extrabold whitespace-nowrap text-[var(--ink)]"
      style={{ background: `hsl(${hue} 85% 75%)` }}
    >
      {name}
    </span>
  );
}
