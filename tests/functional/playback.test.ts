import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db, schema } from '@/server/db/client';
import { invalidateMeta } from '@/server/youtube';
import { playNext, playsOf, seedVideo, state, tick, vid, vote } from './helpers';

describe('queue to screen', () => {
  it('plays the most-voted video and consumes its votes', async () => {
    const a = await seedVideo({ id: vid(1) });
    const b = await seedVideo({ id: vid(2) });
    await vote('en', a, { viewer: 1 });
    await vote('en', b, { viewer: 2 });
    await vote('en', b, { viewer: 3 });

    const np = await playNext('en');
    expect(np).toMatchObject({ state: 'playing', video: { id: b } });
    expect(np!.endsAt - np!.startedAt).toBe(180_000);

    const s = (await state('en')).body;
    expect(s.nowPlaying?.video.id).toBe(b);
    expect(s.pool).toEqual([expect.objectContaining({ id: a, votes: 1 })]);
    expect(await playsOf(b)).toEqual([
      expect.objectContaining({ room: 'en', source: 'pool', votesAtPick: 2, endedAt: null }),
    ]);
  });

  it('breaks ties in favour of the earliest first vote', async () => {
    const first = await seedVideo({ id: vid(1) });
    const second = await seedVideo({ id: vid(2) });
    await vote('en', first, { viewer: 1 });
    await tick();
    await vote('en', second, { viewer: 2 });

    expect((await playNext('en'))?.video.id).toBe(first);
  });

  it('skips candidates that became unplayable while queued', async () => {
    const banned = await seedVideo({ id: vid(1) });
    const fine = await seedVideo({ id: vid(2) });
    await vote('en', banned, { viewer: 1 });
    await vote('en', banned, { viewer: 2 });
    await vote('en', fine, { viewer: 3 });
    await db().update(schema.videos).set({ banned: true }).where(eq(schema.videos.id, banned));
    await invalidateMeta(banned);

    expect((await playNext('en'))?.video.id).toBe(fine);
    expect((await state('en')).body.pool).toEqual([]);
  });

  it('closes the previous play when the next one starts', async () => {
    const a = await seedVideo({ id: vid(1) });
    const b = await seedVideo({ id: vid(2) });
    await vote('en', a, { viewer: 1 });
    await playNext('en');
    await vote('en', b, { viewer: 2 });
    await playNext('en');

    expect(await playsOf(a)).toEqual([expect.objectContaining({ endReason: 'finished' })]);
    expect((await playsOf(a))[0].endedAt).toBeInstanceOf(Date);
  });

  it('falls back to the Hall of Fame when the queue is empty', async () => {
    const a = await seedVideo({ id: vid(1) });
    const b = await seedVideo({ id: vid(2) });
    await vote('en', a, { viewer: 1 });
    await playNext('en');
    await vote('en', b, { viewer: 2 });
    await playNext('en');

    // Queue empty: the fallback picks a past play of this room other than the one that just ended.
    const np = await playNext('en');
    expect(np?.video.id).toBe(a);
    expect((await playsOf(a)).at(-1)).toMatchObject({ source: 'fallback', votesAtPick: 0 });
  });

  it('shows nothing when there is nothing to play', async () => {
    expect(await playNext('en')).toBeNull();
    expect((await state('en')).body.nowPlaying).toBeNull();
  });

  it('keeps every room independent', async () => {
    const a = await seedVideo({ id: vid(1) });
    const b = await seedVideo({ id: vid(2) });
    await vote('en', a);
    await vote('fr', b);

    expect((await playNext('en'))?.video.id).toBe(a);
    const fr = (await state('fr')).body;
    expect(fr.nowPlaying).toBeNull();
    expect(fr.pool).toEqual([expect.objectContaining({ id: b, votes: 1 })]);
  });
});
