'use client';

import { useEffect, useRef, useState } from 'react';
import { errorText } from '@/i18n';
import { tw } from '@/i18n/twitch';
import { post } from '@/lib/api';
import { formatClock, useLive, useServerNow } from '@/lib/live';
import { useTurnstile } from '@/lib/turnstile';
import { isCloseCall } from '@/lib/twitch';
import type { TwitchChannel, TwitchLive } from '@/lib/types';

/** Keep-or-change vote, then the pick window. Between the two, a countdown to the next vote. */
export function TwitchVote() {
  const { state } = useLive();
  const live = state?.twitch;
  const now = useServerNow(250);
  const verdict = useVerdict(live);
  if (!live?.channel) return null;
  const left = Math.max(0, live.phaseEndsAt - now);

  return (
    <>
      {verdict && (
        <p key={verdict} className="verdict font-display sticker self-center bg-[var(--report)] text-2xl text-[var(--ink)]">
          {verdict}
        </p>
      )}
      {live.phase === 'deciding' ? (
        <Decide live={live} left={left} />
      ) : live.phase === 'picking' ? (
        <Pick live={live} left={left} />
      ) : (
        <p className="sticker self-start bg-[var(--panel)] text-[var(--panel-ink)]">🗳️ {tw.nextVoteIn(formatClock(left))}</p>
      )}
    </>
  );
}

/** "Kept!" or "Voted off!" for a few seconds when the deciding window closes. */
function useVerdict(live: TwitchLive | null | undefined) {
  const prev = useRef(live?.phase);
  const [verdict, setVerdict] = useState<string | null>(null);
  useEffect(() => {
    const was = prev.current;
    prev.current = live?.phase;
    if (was !== 'deciding' || live?.phase === 'deciding') return;
    setVerdict(live?.phase === 'picking' ? tw.votedOff : tw.kept);
    const t = setTimeout(() => setVerdict(null), 3500);
    return () => clearTimeout(t);
  }, [live?.phase]);
  return verdict;
}

function useSend() {
  const { room, t, refreshMe } = useLive();
  const { ref, getToken } = useTurnstile();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const send = async (path: string, body: Record<string, string>) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await post(path, { room, token: await getToken(), ...body });
      if (!res.ok) setMsg(errorText(t, res.err, { room }));
      return res.ok;
    } catch {
      setMsg(t.errors.captcha);
      return false;
    } finally {
      setBusy(false);
      refreshMe();
    }
  };
  return { send, busy, msg, captchaRef: ref };
}

function Decide({ live, left }: { live: TwitchLive; left: number }) {
  const { me } = useLive();
  const { send, busy, msg, captchaRef } = useSend();
  const { keep, change } = live.tally;
  const close = isCloseCall(live.tally);
  const keepShare = keep + change === 0 ? 50 : (keep / (keep + change)) * 100;
  const urgent = left < 10_000;

  return (
    <section aria-label={tw.keepQuestion(live.channel!.name)} className={`panel decide flex flex-col gap-4 p-5 ${close ? 'close-call' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-2xl sm:text-3xl">{tw.keepQuestion(live.channel!.name)}</p>
        <span className={`font-display text-3xl tabular-nums ${urgent ? 'heartbeat text-[var(--skip)]' : ''}`}>
          {formatClock(left)}
        </span>
      </div>

      {close && <p className="font-display wobble sticker self-center bg-[var(--skip)] text-xl text-[var(--ink)]">{tw.close}</p>}

      <div className="flex items-center gap-3">
        <span className="font-display w-8 text-right text-2xl tabular-nums">{keep}</span>
        <div className="relative h-7 flex-1 rounded-full border-[3px] border-[var(--edge)] bg-[var(--skip)]">
          <div
            className="h-full rounded-l-full bg-[var(--mint)] transition-[width] duration-700 ease-out"
            style={{ width: `${keepShare}%` }}
          />
          <span
            aria-hidden
            className={`tug absolute top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-[var(--edge)] bg-[var(--report)] text-lg transition-[left] duration-700 ease-out ${close ? 'tug-hard' : ''}`}
            style={{ left: `${keepShare}%` }}
          >
            📺
          </span>
        </div>
        <span className="font-display w-8 text-2xl tabular-nums">{change}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className={`btn font-display bg-[var(--mint)] py-3 text-2xl text-[var(--ink)] uppercase ${me.decided === 'keep' ? 'ring-4 ring-[var(--report)]' : ''}`}
          disabled={busy || me.decided !== null}
          onClick={() => send('/api/twitch/decide', { choice: 'keep' })}
        >
          👍 {tw.keep}
        </button>
        <button
          type="button"
          className={`btn font-display bg-[var(--skip)] py-3 text-2xl text-[var(--ink)] uppercase ${me.decided === 'change' ? 'ring-4 ring-[var(--report)]' : ''}`}
          disabled={busy || me.decided !== null}
          onClick={() => send('/api/twitch/decide', { choice: 'change' })}
        >
          👎 {tw.change}
        </button>
      </div>
      <div ref={captchaRef} />
      <p role="status" aria-live="polite" className="min-h-5 text-center text-sm font-bold">
        {msg ?? (me.decided && tw.youVoted(me.decided))}
      </p>
    </section>
  );
}

function Pick({ live, left }: { live: TwitchLive; left: number }) {
  const { me } = useLive();
  const { send, busy, msg, captchaRef } = useSend();
  const [channel, setChannel] = useState('');
  const done = me.picked !== null;
  const pick = (login: string) => send('/api/twitch/pick', { channel: login });
  const max = Math.max(1, ...live.candidates.map((c) => c.votes));
  // Suggestions already in the race show up once, as candidates.
  const suggestions = live.suggestions.filter((s) => !live.candidates.some((c) => c.login === s.login));

  return (
    <section aria-label={tw.pickTitle} className="panel pick flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-2xl sm:text-3xl">{tw.pickTitle}</p>
          <p className="text-sm font-bold">{tw.pickHint}</p>
        </div>
        <span className="font-display heartbeat text-4xl text-[var(--skip)] tabular-nums">{formatClock(left)}</span>
      </div>

      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await pick(channel)) setChannel('');
        }}
      >
        <label className="sr-only" htmlFor="twitch-channel">
          {tw.channelLabel}
        </label>
        <input
          id="twitch-channel"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          placeholder={tw.placeholder}
          autoComplete="off"
          disabled={done}
          className="min-w-0 flex-1 rounded-full border-[3px] border-[var(--edge)] bg-white px-4 py-2 font-bold text-[var(--ink)]"
        />
        <button type="submit" className="btn bg-[var(--glow)] text-[var(--ink)]" disabled={busy || done || !channel.trim()}>
          {tw.pick}
        </button>
      </form>

      {live.candidates.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-extrabold">{tw.candidates}</p>
          <ol className="flex flex-col gap-2">
            {live.candidates.map((c) => (
              <li key={c.login} className="flex items-center gap-3">
                <ChannelLabel channel={c} />
                <div className="h-3 flex-1 overflow-hidden rounded-full border-2 border-[var(--edge)] bg-[var(--ink)]/10">
                  <div
                    key={c.votes}
                    className="bump h-full origin-left rounded-full bg-[var(--glow)] transition-[width] duration-500"
                    style={{ width: `${(c.votes / max) * 100}%` }}
                  />
                </div>
                <span className="font-display w-16 shrink-0 text-right tabular-nums">{tw.votes(c.votes)}</span>
                <button
                  type="button"
                  className={`btn shrink-0 bg-[var(--glow)] px-3 py-1 text-[var(--ink)] ${me.picked === c.login ? 'ring-4 ring-[var(--report)]' : ''}`}
                  disabled={busy || done}
                  onClick={() => pick(c.login)}
                  aria-label={`${tw.pick} ${c.name}`}
                >
                  +1
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="text-sm font-bold">{tw.nobody}</p>
      )}

      {suggestions.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-extrabold">{tw.suggestions}</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.login}
                type="button"
                className="btn bg-[var(--remote)] px-3 py-1 text-sm text-[var(--cream)]"
                disabled={busy || done}
                onClick={() => pick(s.login)}
              >
                {s.name}
                {s.game && <span className="font-semibold opacity-75">· {s.game}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={captchaRef} />
      <p role="status" aria-live="polite" className="min-h-5 text-center text-sm font-bold">
        {msg ?? (me.picked && tw.youPicked(live.candidates.find((c) => c.login === me.picked)?.name ?? me.picked))}
      </p>
    </section>
  );
}

function ChannelLabel({ channel }: { channel: TwitchChannel }) {
  return (
    <p className="w-40 min-w-0 shrink-0 truncate font-extrabold sm:w-56" title={channel.title || undefined}>
      {channel.name}
      {channel.game && <span className="ml-1 text-xs font-semibold opacity-75">{channel.game}</span>}
    </p>
  );
}
