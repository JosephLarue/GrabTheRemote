import { describe, expect, it, vi } from 'vitest';
import { addKeyword, banChannel, banVideo, clearFlag, forceSkip, unbanChannel, unbanVideo } from '@/app/admin/actions';
import { getNowPlaying } from '@/server/state';
import { playNext, playsOf, seedVideo, state, vid, videoRow, vote } from './helpers';

// Outside a Next.js request there is no cache to revalidate.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe('admin actions', () => {
  it('force skip ends the current play', async () => {
    const id = await seedVideo({ id: vid(1) });
    await vote('it', id);
    await playNext('it');

    await forceSkip(form({ room: 'it' }));
    expect(await playsOf(id)).toEqual([expect.objectContaining({ endReason: 'admin' })]);
  });

  it('banning a video drops it from every queue and takes it off screen', async () => {
    const id = await seedVideo({ id: vid(1) });
    const other = await seedVideo({ id: vid(2) });
    await vote('en', id);
    await vote('jungle', id);
    await vote('jungle', other, { viewer: 2 });
    await playNext('en');

    await banVideo(form({ id }));

    expect((await getNowPlaying('en'))?.video.id).not.toBe(id);
    expect(await playsOf(id)).toEqual([expect.objectContaining({ endReason: 'admin' })]);
    expect((await state('jungle')).body.pool.map((p) => p.id)).toEqual([other]);
    expect(await vote('fr', id, { viewer: 3 })).toMatchObject({ status: 422, body: { error: 'banned' } });
  });

  it('unbanning or clearing the flag lets the video back in', async () => {
    const banned = await seedVideo({ id: vid(1), banned: true, flagged: true });
    const flagged = await seedVideo({ id: vid(2), flagged: true });

    await unbanVideo(form({ id: banned }));
    await clearFlag(form({ id: flagged }));

    expect(await videoRow(banned)).toMatchObject({ banned: false, flagged: false });
    expect((await vote('en', banned)).status).toBe(200);
    expect((await vote('en', flagged, { viewer: 2 })).status).toBe(200);
  });

  it('channel bans and keywords apply immediately', async () => {
    const id = await seedVideo({ id: vid(1), channelId: 'channel-x', title: 'Totally fine video' });
    expect((await vote('en', id)).status).toBe(200);

    await banChannel(form({ channelId: 'channel-x', reason: 'spam' }));
    expect(await vote('fr', id)).toMatchObject({ status: 422, body: { error: 'banned_channel' } });
    await unbanChannel(form({ channelId: 'channel-x' }));
    expect((await vote('fr', id)).status).toBe(200);

    await addKeyword(form({ keyword: '  FINE ' }));
    expect(await vote('es', id)).toMatchObject({ status: 422, body: { error: 'blocked_keyword' } });
  });
});
