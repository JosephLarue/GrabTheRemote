import { describe, expect, it } from 'vitest';
import { THEMES_ENABLED } from '@/config/app';
import { GET as health } from '@/app/api/health/route';
import { preview, seedVideo, setTheme, state, vid, vote } from './helpers';

describe('GET /api/health', () => {
  it('reports Postgres and Redis up', async () => {
    const res = await health();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, postgres: true, redis: true });
  });
});

describe('GET /api/state', () => {
  it('describes an empty room', async () => {
    const res = await state('es');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      nowPlaying: null,
      pool: [],
      theme: null,
      viewers: 0,
      skip: { votes: 0, needed: 3, cooldownEndsAt: null },
      report: { votes: 0, needed: 3 },
    });
    expect(Math.abs(res.body.serverNow - Date.now())).toBeLessThan(5000);
  });

  it('dresses The Jungle as the Alliance or the Horde', async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20 && seen.size < 2; i++) seen.add((await state('jungle')).body.room.decor);
    expect([...seen].sort()).toEqual(['alliance', 'horde']);
  });

  it('rejects unknown rooms', async () => {
    expect(await state('de')).toMatchObject({ status: 400, body: { error: 'bad_room' } });
  });

  it.skipIf(!THEMES_ENABLED)('flags queued videos that miss the current theme', async () => {
    const long = await seedVideo({ id: vid(1), durationS: 300 });
    await vote('en', long);
    await setTheme('short');
    expect((await state('en')).body.pool).toEqual([expect.objectContaining({ id: long, matchesTheme: false })]);
  });
});

describe('GET /api/preview', () => {
  it('previews a known video and says whether it is already queued', async () => {
    const id = await seedVideo({ id: vid(1), title: 'Cats' });
    expect((await preview('en', id)).body).toMatchObject({ video: { id, title: 'Cats' }, inPool: false, problem: null });
    await vote('en', id);
    expect((await preview('en', id)).body).toMatchObject({ inPool: true, matchesTheme: true });
    expect((await preview('fr', id)).body.inPool).toBe(false);
  });

  it('warns before voting for a video that will be refused', async () => {
    const id = await seedVideo({ id: vid(1), audioLanguage: 'en' });
    expect((await preview('fr', id)).body.problemCode).toBe('wrong_language');
    expect((await preview('jungle', id)).body.problemCode).toBeNull();
  });

  it('rejects bad links and unknown videos', async () => {
    expect(await preview('en', 'https://example.com')).toMatchObject({ status: 400, body: { error: 'bad_url' } });
    expect(await preview('en', vid(404))).toMatchObject({ status: 404, body: { error: 'not_found' } });
  });
});
