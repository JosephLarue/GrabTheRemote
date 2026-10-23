import { desc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';
import { DEFAULT_ROOM, ROOM_INFO, ROOMS, isRoom } from '@/config/rooms';
import { CONSTRAINTS } from '@/config/constraints';
import { YT_QUOTA_HARD, YT_QUOTA_SOFT } from '@/config/app';
import { db, schema } from '@/server/db/client';
import { K } from '@/server/keys';
import { poolIds } from '@/server/pool';
import { redis } from '@/server/redis';
import { snapshot, viewerCount } from '@/server/state';
import { themeWeights } from '@/server/themes';
import { getMeta, quotaUsed } from '@/server/youtube';
import {
  addKeyword,
  banChannel,
  banVideo,
  clearFlag,
  dropCandidate,
  forceSkip,
  removeKeyword,
  setThemeWeights,
  unbanChannel,
  unbanVideo,
} from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin', robots: { index: false } };

const btn = 'btn px-3 py-1 text-xs';

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const { room: raw } = await searchParams;
  const room = isRoom(raw) ? raw : DEFAULT_ROOM;
  const [snap, ids, quota, flagged, banned, channels, keywords, weights, recent, roomViewers] = await Promise.all([
    snapshot(room),
    poolIds(room),
    quotaUsed(),
    db().select().from(schema.videos).where(eq(schema.videos.flagged, true)),
    db().select().from(schema.videos).where(eq(schema.videos.banned, true)),
    db().select().from(schema.bannedChannels).orderBy(desc(schema.bannedChannels.createdAt)),
    db().select().from(schema.blockedKeywords),
    themeWeights(),
    db()
      .select({ play: schema.plays, title: schema.videos.title })
      .from(schema.plays)
      .innerJoin(schema.videos, eq(schema.videos.id, schema.plays.videoId))
      .where(eq(schema.plays.room, room))
      .orderBy(desc(schema.plays.id))
      .limit(15),
    Promise.all(ROOMS.map(viewerCount)),
  ]);
  const pool = await Promise.all(
    ids.map(async (id) => ({
      id,
      votes: Number(await redis().zscore(K.pool(room), id)),
      meta: await getMeta(id, { allowFetch: false }),
    })),
  );
  const np = snap.nowPlaying;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-4xl">Control room</h1>

      <nav aria-label="Rooms" className="flex flex-wrap gap-2">
        {ROOMS.map((r, i) => (
          <Link
            key={r}
            href={`/admin?room=${r}`}
            aria-current={r === room ? 'page' : undefined}
            className={`${btn} ${r === room ? 'bg-[var(--glow)] text-[var(--ink)]' : 'bg-[var(--remote)] text-[var(--cream)]'}`}
          >
            {ROOM_INFO[r].emoji} {ROOM_INFO[r].name} ({roomViewers[i]})
          </Link>
        ))}
      </nav>
      <p className="-mt-3 text-sm">
        Now playing, queue and recent plays below are for {ROOM_INFO[room].name}. Bans, keywords and theme weights apply to
        every room.
      </p>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label={`Viewers now in ${ROOM_INFO[room].name}`} value={snap.viewers} />
        <Stat
          label={`YouTube quota today (soft ${YT_QUOTA_SOFT}, hard ${YT_QUOTA_HARD})`}
          value={`${quota} / 10,000`}
          warn={quota >= YT_QUOTA_SOFT}
        />
        <Stat label="Theme" value={snap.theme ? `${snap.theme.emoji} ${snap.theme.label}` : 'None'} />
      </section>

      <Panel title="Now playing">
        {np ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1 font-extrabold">
              {np.video.title} <span className="font-semibold opacity-70">({np.video.id}, {np.state})</span>
            </p>
            <form action={forceSkip}>
              <input type="hidden" name="room" value={room} />
              <button className={`${btn} bg-[var(--skip)] text-[var(--ink)]`}>Force skip</button>
            </form>
            <form action={banVideo}>
              <input type="hidden" name="id" value={np.video.id} />
              <button className={`${btn} bg-[var(--ink)] text-[var(--cream)]`}>Ban and skip</button>
            </form>
          </div>
        ) : (
          <p>Nothing playing.</p>
        )}
      </Panel>

      <Panel title={`Queue (${pool.length})`}>
        {pool.length === 0 && <p>Empty.</p>}
        <ul className="flex flex-col gap-2">
          {pool.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 border-b-2 border-[var(--edge)]/10 pb-2">
              <span className="font-display w-10 text-right">{c.votes}</span>
              <span className="min-w-0 flex-1 truncate font-bold">{c.meta?.title ?? c.id}</span>
              <span className="text-xs opacity-70">{c.meta?.channelTitle}</span>
              <form action={dropCandidate}>
                <input type="hidden" name="room" value={room} />
                <input type="hidden" name="id" value={c.id} />
                <button className={`${btn} bg-white text-[var(--ink)]`}>Remove</button>
              </form>
              <form action={banVideo}>
                <input type="hidden" name="id" value={c.id} />
                <button className={`${btn} bg-[var(--skip)] text-[var(--ink)]`}>Ban video</button>
              </form>
              {c.meta && (
                <form action={banChannel}>
                  <input type="hidden" name="channelId" value={c.meta.channelId} />
                  <input type="hidden" name="reason" value={`from queue: ${c.meta.title}`} />
                  <button className={`${btn} bg-[var(--ink)] text-[var(--cream)]`}>Ban channel</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={`Mass-reported, waiting for review (${flagged.length})`}>
          {flagged.length === 0 && <p>Nothing to review.</p>}
          <ul className="flex flex-col gap-2">
            {flagged.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2">
                <a
                  className="min-w-0 flex-1 truncate font-bold underline"
                  href={`https://www.youtube.com/watch?v=${v.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {v.title}
                </a>
                <form action={clearFlag}>
                  <input type="hidden" name="id" value={v.id} />
                  <button className={`${btn} bg-[var(--mint)] text-[var(--ink)]`}>It&apos;s fine</button>
                </form>
                <form action={banVideo}>
                  <input type="hidden" name="id" value={v.id} />
                  <button className={`${btn} bg-[var(--skip)] text-[var(--ink)]`}>Ban</button>
                </form>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={`Banned videos (${banned.length})`}>
          {banned.length === 0 && <p>None.</p>}
          <ul className="flex flex-col gap-2">
            {banned.map((v) => (
              <li key={v.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-bold">{v.title}</span>
                <form action={unbanVideo}>
                  <input type="hidden" name="id" value={v.id} />
                  <button className={`${btn} bg-white text-[var(--ink)]`}>Unban</button>
                </form>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Banned channels">
          <form action={banChannel} className="mb-3 flex flex-wrap gap-2">
            <input name="channelId" placeholder="Channel ID (UC…)" className={input} required />
            <input name="reason" placeholder="Reason" className={input} />
            <button className={`${btn} bg-[var(--ink)] text-[var(--cream)]`}>Ban</button>
          </form>
          <ul className="flex flex-col gap-2">
            {channels.map((c) => (
              <li key={c.channelId} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-bold">
                  {c.channelId} <span className="font-semibold opacity-70">{c.reason}</span>
                </span>
                <form action={unbanChannel}>
                  <input type="hidden" name="channelId" value={c.channelId} />
                  <button className={`${btn} bg-white text-[var(--ink)]`}>Unban</button>
                </form>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Blocked title keywords">
          <form action={addKeyword} className="mb-3 flex gap-2">
            <input name="keyword" placeholder="keyword" className={input} required />
            <button className={`${btn} bg-[var(--ink)] text-[var(--cream)]`}>Add</button>
          </form>
          <ul className="flex flex-wrap gap-2">
            {keywords.map((k) => (
              <li key={k.keyword}>
                <form action={removeKeyword}>
                  <input type="hidden" name="keyword" value={k.keyword} />
                  <button className={`${btn} bg-white text-[var(--ink)]`} aria-label={`Remove ${k.keyword}`}>
                    {k.keyword} ✕
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Theme weights">
        <p className="mb-3 text-sm">
          Higher weight means picked more often. 0 disables a theme. Half of all slots have no theme regardless.
        </p>
        <form action={setThemeWeights} className="flex flex-col gap-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CONSTRAINTS.map((c) => (
              <label key={c.id} className="flex items-center justify-between gap-2 font-bold">
                {c.emoji} {c.label}
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  name={`w:${c.id}`}
                  defaultValue={weights[c.id] ?? c.weight}
                  className={`${input} w-20`}
                />
              </label>
            ))}
          </div>
          <button className={`${btn} self-start bg-[var(--glow)] text-[var(--ink)]`}>Save weights</button>
        </form>
      </Panel>

      <Panel title="Recent plays">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-1">Video</th>
              <th>Source</th>
              <th>Votes</th>
              <th>Peak</th>
              <th>Skips</th>
              <th>Reports</th>
              <th>Ended</th>
            </tr>
          </thead>
          <tbody>
            {recent.map(({ play, title }) => (
              <tr key={play.id} className="border-t-2 border-[var(--edge)]/10">
                <td className="max-w-[16rem] truncate py-1 font-bold">{title}</td>
                <td>{play.source}</td>
                <td>{play.votesAtPick}</td>
                <td>{play.peakViewers}</td>
                <td>{play.skipVotes}</td>
                <td>{play.reportVotes}</td>
                <td>{play.endReason ?? 'playing'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

const input =
  'min-w-0 flex-1 rounded-full border-[3px] border-[var(--edge)] bg-white px-3 py-1 text-sm font-bold text-[var(--ink)]';

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel overflow-x-auto p-5">
      <h2 className="font-display mb-3 text-xl">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className={`panel p-4 ${warn ? 'bg-[var(--skip)]' : ''}`}>
      <p className="text-xs font-bold">{label}</p>
      <p className="font-display mt-1 text-2xl">{value}</p>
    </div>
  );
}
