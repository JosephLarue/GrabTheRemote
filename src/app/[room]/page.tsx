'use client';

import { AdSlot } from '@/components/AdSlot';
import { ChatUnfoldButton, CinemaButton, CinemaStage } from '@/components/Cinema';
import { CHAT_RAIL, CouchChat, WITH_CHAT } from '@/components/CouchChat';
import { OwnerPanel } from '@/components/OwnerPanel';
import { ReactionOverlay } from '@/components/CouchReactions';
import { PoolBars } from '@/components/PoolBars';
import { Remote } from '@/components/Remote';
import { RemoteDrawer } from '@/components/RemoteDrawer';
import { RemoteFight } from '@/components/RemoteFight';
import { StolenRemote } from '@/components/StolenRemote';
import { SyncedPlayer } from '@/components/SyncedPlayer';
import { TwitchStage } from '@/components/TwitchStage';
import { VoteForm, VoteProvider, useVote } from '@/components/VoteBox';
import { isTwitchRoom } from '@/config/rooms';
import { formatClock, useLive, useServerNow } from '@/lib/live';

export default function WatchPage() {
  const { room } = useLive();
  return isTwitchRoom(room) ? <TwitchStage /> : <YouTubeWatch />;
}

function YouTubeWatch() {
  return (
    <VoteProvider>
      <YouTubeStage />
    </VoteProvider>
  );
}

function YouTubeStage() {
  const { state, t, settings } = useLive();
  const { vote, busy, cooldown, msg } = useVote();
  const now = useServerNow(500);
  const np = state?.nowPlaying ?? null;
  // Paused: the clock stops where the streamer stopped it.
  const left = np ? np.endsAt - (np.pausedAt ?? now) : 0;

  return (
    // The TV gets the whole width; every control is in the remote drawer. The veto banner stays out in the
    // open (it only lasts a minute), and the queue sits under the TV with the ad beside it.
    <div className="flex flex-col gap-6">
      <section aria-label={t.watch.nowPlaying} className="min-w-0">
        {settings.private && <h1 className="font-display mb-4 truncate text-3xl sm:text-4xl">🔒 {settings.name}</h1>}
        <StolenRemote />
        <div className="tv tv-stage mt-12">
          <SyncedPlayer np={np} overlay={<ReactionOverlay />} />
          <div className="mt-3 flex items-center justify-between gap-3 px-1 text-[var(--ink)]">
            <div className="min-w-0">
              <p className="truncate text-base font-black sm:text-lg" title={np?.video.title}>
                {np ? np.video.title : t.watch.nothingOnScreen}
              </p>
              <p className="truncate text-xs font-bold opacity-80">{np?.video.channelTitle}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {np && np.state === 'playing' && (
                <p className={`text-right ${left < 10_000 ? 'wobble' : ''}`}>
                  <span className="block text-[11px] font-extrabold">{t.watch.nextPickIn}</span>
                  <span className="font-display text-2xl tabular-nums sm:text-3xl">{formatClock(left)}</span>
                </p>
                <p className="truncate text-xs font-bold opacity-80">{np?.video.channelTitle}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {np && np.state === 'playing' && (
                  <p className={`text-right ${left < 10_000 ? 'wobble' : ''}`}>
                    <span className="block text-[11px] font-extrabold">{t.watch.nextPickIn}</span>
                    <span className="font-display text-2xl tabular-nums sm:text-3xl">{formatClock(left)}</span>
                  </p>
                )}
                <ChatUnfoldButton />
                <CinemaButton />
                <span aria-hidden className="tv-knob" />
                <span aria-hidden className="tv-knob hidden bg-[var(--glow)] sm:block" />
              </div>
            </div>
          </div>
        </section>

        <section aria-label={t.watch.queue} className="cinema-hide flex min-w-0 flex-col gap-5">
          <RemoteFight />
          <div>
            <h2 className="font-display mb-3 text-2xl">{t.watch.upNext}</h2>
            <PoolBars
              pool={state?.pool ?? []}
              onPlusOne={(id) => vote(id)}
              plusOneDisabled={busy || cooldown > 0}
            />
            {msg && (
              <p role="status" className={`mt-3 font-extrabold ${msg.ok ? 'text-[var(--mint)]' : 'text-[var(--skip)]'}`}>
                {msg.text}
              </p>
            )}
          </div>
        </section>
      </div>

      <div className={CHAT_RAIL}>
        <CouchChat />
        <div className="cinema-hide">
          <AdSlot slot="watch-rail" />
        </div>
      </div>

      <RemoteDrawer>
        <VoteForm />
        <Remote />
        <OwnerPanel />
      </RemoteDrawer>
    </CinemaStage>
  );
}
