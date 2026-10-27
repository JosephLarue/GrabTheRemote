'use client';

import { localeOf } from '@/i18n';
import { tw } from '@/i18n/twitch';
import { useLive } from '@/lib/live';
import { twitchUrl } from '@/lib/twitch';
import { ReactionBar, ReactionOverlay } from './CouchReactions';
import { RemoteDrawer } from './RemoteDrawer';
import { StaticNoise } from './StaticNoise';
import { TwitchPlayer } from './TwitchPlayer';
import { TwitchVote } from './TwitchVote';

/** The Twitch room's watch page: the streamer's name as the room title, the stream, the couch votes. */
export function TwitchStage() {
  const { room, state } = useLive();
  const channel = state?.twitch?.channel ?? null;
  const locale = localeOf(room);

  return (
    // Like the YouTube rooms: the stream gets the whole width, the controls live in the remote drawer.
    <div className="flex flex-col gap-6">
      <section className="flex min-w-0 flex-col gap-5">
        {/* The room's title is the streamer, linking to their channel: the room exists to send people there. */}
        <div className="min-w-0">
          {channel ? (
            <h1 className="font-display text-3xl sm:text-5xl">
              <a
                href={twitchUrl(channel.login)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={tw.openChannel(channel.name)}
                className="inline-flex max-w-full items-center gap-3 hover:underline"
              >
                <span className="live-dot shrink-0" aria-hidden />
                <span className="truncate">{channel.name}</span>
                <span aria-hidden className="shrink-0 text-2xl opacity-80 sm:text-3xl">
                  ↗
                </span>
              </a>
            </h1>
          ) : (
            <h1 className="font-display text-3xl sm:text-5xl">{tw.offAir}</h1>
          )}
          {channel?.title && (
            <p className="mt-1 truncate font-bold" title={channel.title}>
              {channel.title}
              {channel.game && <span className="opacity-75"> · {channel.game}</span>}
            </p>
          )}
        </div>

        <div className="tv tv-stage mt-12">
          <TwitchPlayer login={channel?.login ?? null} overlay={channel ? <ReactionOverlay /> : <StaticNoise label={tw.offAirSub} />} />
          <div className="mt-3 flex items-center justify-between gap-3 px-1 text-[var(--ink)]">
            <p className="truncate text-sm font-black">
              {channel?.viewers != null && tw.onTwitch(channel.viewers.toLocaleString(locale))}
            </p>
            <div className="flex shrink-0 items-center gap-3">
              <span aria-hidden className="tv-knob" />
              <span aria-hidden className="tv-knob hidden bg-[var(--glow)] sm:block" />
            </div>
          </div>
        </div>
        <ReactionBar />
        <TwitchVote />
      </section>

      <RemoteDrawer>
        {channel && (
          <a
            href={twitchUrl(channel.login)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn bg-[var(--tv)] text-center text-[var(--cream)]"
          >
            {tw.follow}
          </a>
        )}
      </RemoteDrawer>
    </div>
  );
}
