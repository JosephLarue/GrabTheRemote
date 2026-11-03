'use client';

import { useEffect, useRef, useState } from 'react';
import { useLive } from '@/lib/live';
import { preloadCandidate } from '@/lib/preload';
import type { NowPlaying } from '@/lib/types';
import { StaticNoise } from './StaticNoise';
import { TvPowerOn } from './TvPowerOn';

type YTPlayer = {
  loadVideoById: (o: { videoId: string; startSeconds: number }) => void;
  cueVideoById: (o: { videoId: string; startSeconds: number }) => void;
  seekTo: (s: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  getVideoData?: () => { video_id?: string } | undefined;
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
const VOLUME = 80;

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

/**
 * Two YouTube players: one on screen, one on standby behind it. The standby cues the likely next video
 * ahead of time, so when it does come up the players swap and it starts at once instead of loading cold.
 * `overlay` sits on top of everything on the screen, the static and the mass-reported card included.
 */
export function SyncedPlayer({ np, overlay }: { np: NowPlaying | null; overlay?: React.ReactNode }) {
  const { serverNow, state, t } = useLive();
  const hosts = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const players = useRef<(YTPlayer | null)[]>([null, null]);
  // Which player is on screen; the other one is the standby.
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const cued = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(!unmutedThisSession);
  const [waiting, setWaiting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let readyCount = 0;
    loadYT().then((YT) => {
      if (cancelled) return;
      hosts.forEach((host, i) => {
        if (!host.current) return;
        players.current[i] = new YT.Player(host.current, {
          host: 'https://www.youtube-nocookie.com',
          playerVars: { autoplay: 1, mute: 1, controls: 0, disablekb: 1, playsinline: 1, rel: 0, fs: 0, iv_load_policy: 3 },
          events: {
            onReady: () => {
              if (++readyCount === 2) setReady(true);
            },
          },
        });
      });
    });
    return () => {
      cancelled = true;
      players.current.forEach((p) => p?.destroy());
      players.current = [null, null];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playId = np?.playId;
  const videoId = np?.video.id;
  const startedAt = np?.startedAt;
  const reported = np?.state === 'reported_card';
  const pausedAt = np?.pausedAt ?? null;
  // Resuming a pause shifts startedAt: that must not reload the video, so the load reads it from here.
  const startedAtRef = useRef(startedAt);
  useEffect(() => {
    startedAtRef.current = startedAt;
  }, [startedAt]);

  const applySound = (p: YTPlayer) => {
    if (unmutedThisSession) {
      p.unMute();
      p.setVolume(VOLUME);
    } else {
      p.mute();
    }
  };

  // Load the current video (once per play) at the right offset; wait out the static transition first.
  // If the standby player already has it cued, swap players instead of loading.
  useEffect(() => {
    const startedAt = startedAtRef.current;
    if (!ready) return;
    const cur = players.current[activeRef.current];
    if (!cur) return;
    if (!videoId || startedAt === undefined || reported) {
      cur.stopVideo();
      setWaiting(!reported);
      return;
    }
    setWaiting(true);
    const start = () => {
      const offset = Math.max(0, (serverNow() - startedAt) / 1000);
      const standbyIdx = 1 - activeRef.current;
      const standby = players.current[standbyIdx];
      if (standby && cued.current === videoId) {
        // Preloaded: the standby becomes the screen, the old screen player stops and goes on standby.
        applySound(standby);
        standby.seekTo(offset, true);
        standby.playVideo();
        cur.stopVideo();
        cur.mute();
        activeRef.current = standbyIdx;
        setActive(standbyIdx);
      } else {
        applySound(cur);
        cur.loadVideoById({ videoId, startSeconds: offset });
      }
      cued.current = null;
      setWaiting(false);
    };
    const delay = startedAt - serverNow();
    if (delay <= 0) {
      start();
      return;
    }
    const timer = setTimeout(start, delay);
    return () => clearTimeout(timer);
  }, [ready, playId, videoId, reported, serverNow]);

  // Preload: cue the all-but-certain next video on the standby player during the last minute.
  const candidate = ready && state ? preloadCandidate(state.pool, np, serverNow()) : null;
  useEffect(() => {
    if (!candidate || cued.current === candidate) return;
    const standby = players.current[1 - activeRef.current];
    if (!standby) return;
    standby.mute();
    standby.cueVideoById({ videoId: candidate, startSeconds: 0 });
    cued.current = candidate;
  }, [candidate]);

  // Everyone stays on the same frame: correct drift and undo accidental pauses. When the streamer pauses a
  // private room, everyone freezes on the frame they paused at instead.
  useEffect(() => {
    if (!ready || !videoId || startedAt === undefined || reported) return;
    const sync = () => {
      const p = players.current[activeRef.current];
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
    const timer = setInterval(sync, pausedAt ? 1000 : 5000);
    return () => clearInterval(timer);
  }, [ready, videoId, startedAt, reported, pausedAt, serverNow]);

  const crankItUp = () => {
    const p = players.current[activeRef.current];
    if (!p) return;
    p.unMute();
    p.setVolume(VOLUME);
    p.playVideo();
    unmutedThisSession = true;
    setMuted(false);
  };

  // No snapshot yet, or the players still loading: the set is warming up.
  const warming = !state || !ready;

  return (
    <div className="tv-screen">
      {/* Both players fill the screen; the standby sits behind, invisible and muted. */}
      {hosts.map((host, i) => (
        <div
          key={i}
          className="tv-player"
          aria-hidden={active !== i}
          inert={active !== i}
          style={{ zIndex: active === i ? 1 : 0, opacity: active === i ? 1 : 0 }}
        >
          <div ref={host} />
        </div>
      ))}

      {/* Click shield: no pausing, no clicking through to YouTube. Doubles as the unmute target. */}
      <button
        type="button"
        onClick={crankItUp}
        aria-label={muted ? t.player.soundOn : t.player.video}
        tabIndex={muted ? 0 : -1}
        className="absolute inset-0 z-20 grid cursor-default place-items-center"
      >
        {muted && !waiting && !reported && !warming && (
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
      {warming ? (
        <TvPowerOn label={t.player.warmingUp} />
      ) : (
        !reported && (waiting || !videoId) && <StaticNoise label={videoId ? t.player.changing : t.player.nothingOn} />
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
