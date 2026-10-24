'use client';

import { useEffect, useRef, useState } from 'react';
import { useLive } from '@/lib/live';
import type { NowPlaying } from '@/lib/types';
import { StaticNoise } from './StaticNoise';

type YTPlayer = {
  loadVideoById: (o: { videoId: string; startSeconds: number }) => void;
  seekTo: (s: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  mute: () => void;
  unMute: () => void;
  setVolume: (v: number) => void;
  destroy: () => void;
};
type YTNamespace = { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer };
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
    __ytLoading?: Promise<YTNamespace>;
  }
}

const PLAYING = 1;
const PAUSED = 2;
const DRIFT_S = 2;

function loadYT() {
  window.__ytLoading ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    window.onYouTubeIframeAPIReady = () => resolve(window.YT!);
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
  return window.__ytLoading;
}

// Survives client-side navigation; a full reload needs a new click (browser autoplay rules).
let unmutedThisSession = false;

/** `overlay` sits on top of everything on the screen, the static and the mass-reported card included. */
export function SyncedPlayer({ np, overlay }: { np: NowPlaying | null; overlay?: React.ReactNode }) {
  const { serverNow, t } = useLive();
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(!unmutedThisSession);
  const [waiting, setWaiting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadYT().then((YT) => {
      if (cancelled || !host.current) return;
      player.current = new YT.Player(host.current, {
        host: 'https://www.youtube-nocookie.com',
        playerVars: { autoplay: 1, mute: 1, controls: 0, disablekb: 1, playsinline: 1, rel: 0, fs: 0, iv_load_policy: 3 },
        events: {
          onReady: () => {
            if (unmutedThisSession) {
              player.current?.unMute();
              player.current?.setVolume(80);
            }
            setReady(true);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = null;
    };
  }, []);

  const playId = np?.playId;
  const videoId = np?.video.id;
  const startedAt = np?.startedAt;
  const reported = np?.state === 'reported_card';
  const pausedAt = np?.pausedAt ?? null;
  // Resuming a pause shifts startedAt: that must not reload the video, so the load reads it from here.
  const startedAtRef = useRef(startedAt);
  startedAtRef.current = startedAt;

  // Load the current video (once per play) at the right offset; wait out the static transition first.
  useEffect(() => {
    const p = player.current;
    const startedAt = startedAtRef.current;
    if (!ready || !p) return;
    if (!videoId || startedAt === undefined || reported) {
      p.stopVideo();
      setWaiting(!reported);
      return;
    }
    setWaiting(true);
    const start = () => {
      p.loadVideoById({ videoId, startSeconds: Math.max(0, (serverNow() - startedAt) / 1000) });
      setWaiting(false);
    };
    const delay = startedAt - serverNow();
    if (delay <= 0) {
      start();
      return;
    }
    const t = setTimeout(start, delay);
    return () => clearTimeout(t);
  }, [ready, playId, videoId, reported, serverNow]);

  // Everyone stays on the same frame: correct drift and undo accidental pauses. When the streamer pauses a
  // private room, everyone freezes on the frame they paused at instead.
  useEffect(() => {
    if (!ready || !videoId || startedAt === undefined || reported) return;
    const sync = () => {
      const p = player.current;
      if (!p) return;
      const expected = ((pausedAt ?? serverNow()) - startedAt) / 1000;
      if (expected < 0) return;
      const st = p.getPlayerState();
      if (pausedAt) {
        if (st === PLAYING) p.pauseVideo();
        if (Math.abs(p.getCurrentTime() - expected) > DRIFT_S) p.seekTo(expected, true);
        return;
      }
      if (st === PAUSED) p.playVideo();
      if (st === PLAYING && Math.abs(p.getCurrentTime() - expected) > DRIFT_S) p.seekTo(expected, true);
    };
    sync();
    const t = setInterval(sync, pausedAt ? 1000 : 5000);
    return () => clearInterval(t);
  }, [ready, videoId, startedAt, reported, pausedAt, serverNow]);

  const crankItUp = () => {
    const p = player.current;
    if (!p) return;
    p.unMute();
    p.setVolume(80);
    p.playVideo();
    unmutedThisSession = true;
    setMuted(false);
  };

  return (
    <div className="tv-screen">
      <div className="tv-player">
        <div ref={host} />
      </div>

      {/* Click shield: no pausing, no clicking through to YouTube. Doubles as the unmute target. */}
      <button
        type="button"
        onClick={crankItUp}
        aria-label={muted ? t.player.soundOn : t.player.video}
        tabIndex={muted ? 0 : -1}
        className="absolute inset-0 z-20 grid cursor-default place-items-center"
      >
        {muted && !waiting && !reported && (
          <span className="wobble sticker font-display cursor-pointer bg-[var(--report)] px-5 py-3 text-xl text-[var(--ink)] sm:text-3xl">
            {t.player.crank}
          </span>
        )}
      </button>

      {pausedAt && !reported && (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-30 grid place-items-center">
          <span className="font-display sticker bg-[var(--report)] px-4 py-2 text-xl text-[var(--ink)] sm:text-2xl">
            {t.private.paused}
          </span>
        </div>
      )}
      {reported && <MassReportedCard />}
      {!reported && (waiting || !videoId) && (
        <StaticNoise label={videoId ? t.player.changing : t.player.nothingOn} />
      )}
      {overlay}
    </div>
  );
}

function MassReportedCard() {
  const { t } = useLive();
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-[var(--skip)] p-6 text-center text-[var(--ink)]">
      <div>
        <p className="font-display text-3xl sm:text-5xl">{t.player.massReported}</p>
        <p className="mt-2 text-base font-extrabold sm:text-xl">{t.player.massReportedSub}</p>
      </div>
    </div>
  );
}
