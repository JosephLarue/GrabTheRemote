'use client';

import { useEffect, useRef, useState } from 'react';
import { INVITE_BOOST_COOLDOWN_S, INVITE_BOOST_S, INVITE_CLAIM_AFTER_S } from '@/config/app';
import { post } from '@/lib/api';
import { formatClock, useLive, useServerNow } from '@/lib/live';
import { play } from '@/lib/sfx';

const REF_PARAM = 'ref';
const REF_KEY = 'gtr:ref';
const DONE_KEY = (room: string) => `gtr:ref-done:${room}`;
const CODE_RE = /^[A-Za-z0-9_-]{8}$/;

/** A small ticket at the bottom right of the screen; it opens the invite card in a modal. */
export function InviteCta() {
  const { t, me } = useLive();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const invite = me.invite;
  const now = useServerNow(1000);
  const boosted = !!invite?.boostEndsAt && invite.boostEndsAt > now;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  if (!invite) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          play('click');
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={t.invite.title}
        className={`invite-cta btn px-3 py-2 text-sm ${boosted ? 'bg-[var(--mint)] text-[var(--ink)]' : 'bg-[var(--report)] text-[var(--ink)]'}`}
      >
        <span aria-hidden>🎟️</span>
        <span className="max-sm:sr-only">{t.invite.title.replace(/^\S+\s/, '')}</span>
        {!boosted && invite.friends > 0 && (
          <span aria-hidden className="rounded-full border-2 border-[var(--edge)] bg-[var(--cream)] px-1.5 text-xs tabular-nums">
            {invite.friends}/{invite.need}
          </span>
        )}
      </button>

      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        aria-labelledby="invite-title"
        className="invite-dialog panel m-auto w-[min(26rem,calc(100vw-2rem))] p-0 backdrop:bg-black/50"
      >
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 id="invite-title" className="font-display text-2xl">
              {t.invite.title}
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn bg-[var(--remote)] px-3 py-1 text-sm text-[var(--cream)]"
              aria-label={t.remote.hide}
            >
              ✕
            </button>
          </div>
          <InviteCard />
        </div>
      </dialog>
    </>
  );
}

/** Your invite link, how many friends made it, and the boost once they did. */
export function InviteCard() {
  const { room, t, me, settings } = useLive();
  const now = useServerNow(1000);
  const [copied, setCopied] = useState(false);
  const invite = me.invite;
  if (!invite) return null;

  const every = t.duration(Math.min(settings.rules.voteCooldownS, INVITE_BOOST_COOLDOWN_S));
  const boostLeft = invite.boostEndsAt && invite.boostEndsAt > now ? invite.boostEndsAt - now : 0;

  const share = async () => {
    play('click');
    const link = `${window.location.origin}/${room}?${REF_PARAM}=${invite.code}`;
    if (navigator.share) {
      await navigator.share({ title: settings.name, text: t.invite.welcome, url: link }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold">{t.invite.intro(invite.need, every, t.duration(INVITE_BOOST_S))}</p>
      <button type="button" onClick={share} className="btn font-display bg-[var(--report)] px-4 py-2 text-lg text-[var(--ink)]">
        🎟️ {copied ? t.invite.copied : typeof navigator !== 'undefined' && 'share' in navigator ? t.invite.share : t.invite.copy}
      </button>
      {boostLeft > 0 ? (
        <p className="sticker bg-[var(--mint)] text-center text-sm text-[var(--ink)]">{t.invite.boosted(every, formatClock(boostLeft))}</p>
      ) : (
        <div className="flex items-center gap-2 text-sm font-extrabold">
          <span aria-hidden className="flex gap-1">
            {Array.from({ length: invite.need }, (_, i) => (
              <span
                key={i}
                className={`inline-block h-4 w-4 rounded-full border-2 border-[var(--edge)] ${i < invite.friends ? 'bg-[var(--mint)]' : 'bg-white/40'}`}
              />
            ))}
          </span>
          {t.invite.progress(invite.friends, invite.need)}
        </div>
      )}
      <p className="text-xs font-semibold opacity-70">{t.invite.howCounted(INVITE_CLAIM_AFTER_S)}</p>
    </div>
  );
}

/**
 * The newcomer's side: a ?ref=<code> in the URL is kept for the tab, the URL is cleaned, and once they have
 * watched for INVITE_CLAIM_AFTER_S the friend gets credited. Each room counts a connection once.
 */
export function InviteClaim() {
  const { room, t, connected } = useLive();
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const code = url.searchParams.get(REF_PARAM);
      if (code && CODE_RE.test(code)) {
        sessionStorage.setItem(REF_KEY, code);
        url.searchParams.delete(REF_PARAM);
        history.replaceState(null, '', url.pathname + url.search + url.hash);
        if (!localStorage.getItem(DONE_KEY(room))) {
          setWelcome(true);
          setTimeout(() => setWelcome(false), 6000);
        }
      }
    } catch {}
  }, [room]);

  useEffect(() => {
    if (!connected) return;
    let code: string | null = null;
    try {
      code = sessionStorage.getItem(REF_KEY);
      if (!code || !CODE_RE.test(code) || localStorage.getItem(DONE_KEY(room))) return;
    } catch {
      return;
    }
    const timer = setTimeout(async () => {
      const res = await post<{ boosted: boolean }>('/api/invite/claim', { room, code });
      // Whatever the answer, this connection has had its go in this room (a retry couldn't change it).
      if (res.ok || (res.err.error !== 'network' && res.err.error !== 'not_watching')) {
        try {
          localStorage.setItem(DONE_KEY(room), '1');
        } catch {}
      }
    }, INVITE_CLAIM_AFTER_S * 1000);
    return () => clearTimeout(timer);
  }, [room, connected]);

  if (!welcome) return null;
  return (
    <p role="status" className="sticker fixed top-4 left-1/2 z-[60] -translate-x-1/2 bg-[var(--mint)] text-center text-sm text-[var(--ink)]">
      {t.invite.welcome}
    </p>
  );
}
