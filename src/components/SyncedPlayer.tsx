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

export function SyncedPlayer({ np }: { np: NowPlaying | null }) {
  const { serverNow } = useLive();
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

  const videoId = np?.video.id;
  const startedAt = np?.startedAt;
  const reported = np?.state === 'reported_card';

  // Load the current video at the right offset; wait out the static transition first.
  useEffect(() => {
    const p = player.current;
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
  }, [ready, videoId, startedAt, reported, serverNow]);

  // Everyone stays on the same frame: correct drift and undo accidental pauses.
  useEffect(() => {
    if (!ready || !videoId || startedAt === undefined || reported) return;
    const t = setInterval(() => {
      const p = player.current;
      if (!p) return;
      const expected = (serverNow() - startedAt) / 1000;
      if (expected < 0) return;
      const st = p.getPlayerState();
      if (st === PAUSED) p.playVideo();
      if (st === PLAYING && Math.abs(p.getCurrentTime() - expected) > DRIFT_S) p.seekTo(expected, true);
    }, 5000);
    return () => clearInterval(t);
  }, [ready, videoId, startedAt, reported, serverNow]);

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
        aria-label={muted ? 'Turn the sound on' : 'Video'}
        tabIndex={muted ? 0 : -1}
        className="absolute inset-0 z-20 grid cursor-default place-items-center"
      >
        {muted && !waiting && !reported && (
          <span className="wobble sticker font-display cursor-pointer bg-[var(--report)] px-5 py-3 text-xl text-[var(--ink)] sm:text-3xl">
            Click to crank it up 🔊
          </span>
        )}
      </button>

      {reported && <MassReportedCard />}
      {!reported && (waiting || !videoId) && (
        <StaticNoise label={videoId ? 'Changing the channel…' : 'Nothing on. Go grab the remote!'} />
      )}
    </div>
  );
}

function MassReportedCard() {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-[var(--skip)] p-6 text-center text-[var(--ink)]">
      <div>
        <p className="font-display text-3xl sm:text-5xl">Mass reported 🚨</p>
        <p className="mt-2 text-base font-extrabold sm:text-xl">The crowd hid this one. Next pick coming right up.</p>
      </div>
    </div>
  );
}
