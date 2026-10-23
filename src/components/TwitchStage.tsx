'use client';

import { COUCH_COLLAPSE_AT } from '@/config/app';
import { localeOf } from '@/i18n';
import { tw } from '@/i18n/twitch';
import { useLive } from '@/lib/live';
import { twitchUrl } from '@/lib/twitch';
import { ReactionBar, ReactionOverlay } from './CouchReactions';
import { StaticNoise } from './StaticNoise';
import { TwitchPlayer } from './TwitchPlayer';
import { TwitchVote } from './TwitchVote';

/** The Twitch room's watch page: the streamer's name as the room title, the stream, the couch votes. */
export function TwitchStage() {
  const { room, state, connected } = useLive();
  const channel = state?.twitch?.channel ?? null;
  const locale = localeOf(room);

  return (
    <div className="grid gap-x-8 gap-y-6 lg:grid-cols-[1fr_220px]">
      <section className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-1">
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

        <div className="tv mt-12">
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

      <aside className="remote flex flex-row flex-wrap items-center justify-around gap-4 p-5 lg:col-start-2 lg:row-start-1 lg:mt-12 lg:flex-col lg:flex-nowrap lg:justify-start lg:gap-6 lg:self-start lg:px-6 lg:py-8">
        <span className="flex items-center gap-2 text-sm font-bold">
          <span
            aria-hidden
            className={`inline-block h-3 w-3 rounded-full border-2 border-[var(--edge)] ${connected ? 'bg-[var(--mint)]' : 'bg-[var(--skip)]'}`}
          />
          {connected ? tw.live : '…'}
        </span>
        <CouchCount />
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
      </aside>
    </div>
  );
}

function CouchCount() {
  const { room, t, state } = useLive();
  const collapsing = (state?.viewers ?? 0) >= COUCH_COLLAPSE_AT;
  return (
    <div
      className={`rounded-xl border-[3px] border-[var(--edge)] px-3 py-1 text-center text-[var(--ink)] shadow-[inset_3px_3px_0_rgba(0,0,0,0.15)] ${collapsing ? 'wobble bg-[var(--report)]' : 'bg-[#9fe8c8]'}`}
    >
      <span className="font-display text-2xl tabular-nums">{state?.viewers?.toLocaleString(localeOf(room)) ?? '–'}</span>
      <span className="ml-1 text-sm font-extrabold">{collapsing ? t.remote.couchCollapsing : t.remote.onCouch}</span>
    </div>
  );
}
