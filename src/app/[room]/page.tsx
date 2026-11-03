'use client';

import { AdSlot } from '@/components/AdSlot';
import { ChatUnfoldButton, CinemaButton, CinemaStage } from '@/components/Cinema';
import { CHAT_RAIL, CouchChat, WITH_CHAT } from '@/components/CouchChat';
import { EasterEggs } from '@/components/EasterEggs';
import { InviteCta } from '@/components/Invite';
import { OwnerPanel } from '@/components/OwnerPanel';
import { ReactionOverlay } from '@/components/CouchReactions';
import { PoolBars } from '@/components/PoolBars';
import { Remote } from '@/components/Remote';
import { RemoteDrawer } from '@/components/RemoteDrawer';
import { RemoteFight } from '@/components/RemoteFight';
import { StolenRemote } from '@/components/StolenRemote';
import { SyncedPlayer } from '@/components/SyncedPlayer';
import { TwitchStage } from '@/components/TwitchStage';
import { VoteForm, VoteProvider, useVote, useVoteCooldown } from '@/components/VoteBox';
import { isTwitchRoom } from '@/config/rooms';
import { formatClock, useLive, useServerNow } from '@/lib/live';
import type { NowPlaying } from '@/lib/types';

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
  const np = state?.nowPlaying ?? null;

  return (
    // Left: the TV, then what plays next right under it (+1 straight from there). Right: the chat (with the
    // reactions). The link box and every control are in the remote drawer, on the left. The veto banner stays out
    // in the open (it only lasts a minute).
    <CinemaStage className={WITH_CHAT}>
      <div className="cinema-col flex min-w-0 flex-col gap-6">
        <section aria-label={t.watch.nowPlaying} className="cinema-grow min-w-0">
          {settings.private && (
            <h1 className="cinema-hide font-display mb-4 truncate text-3xl sm:text-4xl">🔒 {settings.name}</h1>
          )}
          <StolenRemote />
          <div className="tv mt-12">
            <EasterEggs />
            <SyncedPlayer np={np} overlay={<ReactionOverlay />} />
            <div className="mt-3 flex items-center justify-between gap-3 px-1 text-[var(--tv-ink)]">
              <div className="min-w-0">
                <p className="truncate text-base font-black sm:text-lg" title={np?.video.title}>
                  {np ? np.video.title : t.watch.nothingOnScreen}
                </p>
                <p className="truncate text-xs font-bold opacity-80">{np?.video.channelTitle}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {np && np.state === 'playing' && <NextPickIn np={np} />}
                <InviteCta />
                <ChatUnfoldButton />
                <CinemaButton />
                <span aria-hidden className="tv-knob" />
                <span aria-hidden className="tv-knob hidden bg-[var(--glow)] sm:block" />
              </div>
            </div>
          </div>
        </section>

        {/* Phones: the link box sits right under the TV; the remote (a floating button there) only keeps the
            skip/report buttons. Desktop: the remote drawer has the full form. */}
        <section aria-label={t.vote.title} className="cinema-hide lg:hidden">
          <VoteForm compact />
        </section>

        <section aria-label={t.watch.queue} className="cinema-hide flex min-w-0 flex-col gap-5">
          <RemoteFight />
          <UpNext />
        </section>
      </div>

      <div className={CHAT_RAIL}>
        <CouchChat />
        <div className="cinema-hide">
          <AdSlot slot="watch-rail" />
        </div>
      </div>

      <RemoteDrawer>
        <div className="hidden lg:contents">
          <VoteForm />
        </div>
        <Remote />
        <OwnerPanel />
      </RemoteDrawer>
    </CinemaStage>
  );
}

/** The countdown under the screen: the only thing on the page that needs to tick, so it ticks alone. */
function NextPickIn({ np }: { np: NowPlaying }) {
  const { t } = useLive();
  const now = useServerNow(500);
  // Paused: the clock stops where the streamer stopped it.
  const left = np.endsAt - (np.pausedAt ?? now);
  return (
    <p className={`text-right ${left < 10_000 ? 'wobble' : ''}`}>
      <span className="block text-[11px] font-extrabold">{t.watch.nextPickIn}</span>
      <span className="font-display text-2xl tabular-nums sm:text-3xl">{formatClock(left)}</span>
    </p>
  );
}

function UpNext() {
  const { state, t } = useLive();
  const { vote, busy, msg } = useVote();
  const cooldown = useVoteCooldown();
  return (
    <div>
      <h2 className="font-display mb-3 text-2xl">{t.watch.upNext}</h2>
      <PoolBars pool={state?.pool ?? []} onPlusOne={(id) => vote(id)} plusOneDisabled={busy || cooldown > 0} />
      {msg && (
        <p role="status" className={`mt-3 font-extrabold ${msg.ok ? 'text-[var(--mint)]' : 'text-[var(--danger-ink)]'}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
