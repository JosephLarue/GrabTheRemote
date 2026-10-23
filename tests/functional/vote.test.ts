import { describe, expect, it } from 'vitest';
import { MAX_DURATION_S } from '@/config/app';
import type { VideoMeta } from '@/lib/types';
import { db, schema } from '@/server/db/client';
import { me, playNext, seedVideo, setTheme, state, vid, vote } from './helpers';

describe('POST /api/vote', () => {
  it('queues the video in the room and starts the voter cooldown', async () => {
    const id = await seedVideo({ id: vid(1) });

    const res = await vote('en', id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, videoId: id });
    expect(res.body.cooldownEndsAt).toBeGreaterThan(Date.now());

    expect((await state('en')).body.pool).toEqual([expect.objectContaining({ id, votes: 1 })]);
    expect((await me('en')).body.voteCooldownEndsAt).toBeGreaterThan(Date.now());
  });

  it('accepts the common YouTube link shapes', async () => {
    const id = await seedVideo({ id: vid(1) });
    const urls = [id, `https://www.youtube.com/watch?v=${id}&t=42`, `https://m.youtube.com/shorts/${id}`];
    for (const [i, url] of urls.entries()) {
      expect((await vote('en', id, { viewer: i + 1, url })).status).toBe(200);
    }
    expect((await state('en')).body.pool[0].votes).toBe(3);
  });

  it('allows one vote per viewer per room, with a cooldown per room', async () => {
    const id = await seedVideo({ id: vid(1) });
    expect((await vote('en', id)).status).toBe(200);

    const again = await vote('en', id);
    expect(again.status).toBe(429);
    expect(again.body.error).toBe('cooldown');
    expect(again.body.cooldownEndsAt).toBeGreaterThan(Date.now());

    expect((await vote('en', id, { viewer: 2 })).status).toBe(200);
    expect((await vote('jungle', id)).status).toBe(200);

    expect((await state('en')).body.pool[0].votes).toBe(2);
    expect((await state('jungle')).body.pool[0].votes).toBe(1);
  });

  it('rejects unknown rooms and links that are not YouTube', async () => {
    expect(await vote('de', vid(1))).toMatchObject({ status: 400, body: { error: 'bad_room' } });
    expect(await vote('en', '', { url: 'https://vimeo.com/123' })).toMatchObject({
      status: 400,
      body: { error: 'bad_url' },
    });
  });

  it('requires a passing captcha, and a failed one does not burn the cooldown', async () => {
    const id = await seedVideo({ id: vid(1) });
    expect(await vote('en', id, { token: '' })).toMatchObject({ status: 400, body: { error: 'captcha' } });
    expect(await vote('en', id, { token: 'bot' })).toMatchObject({ status: 403, body: { error: 'captcha' } });
    expect((await me('en')).body.voteCooldownEndsAt).toBeNull();
    expect((await vote('en', id)).status).toBe(200);
  });

  it('returns 404 for a video YouTube does not know', async () => {
    expect(await vote('en', vid(404))).toMatchObject({ status: 404, body: { error: 'not_found' } });
  });

  it.each<[string, Partial<VideoMeta>]>([
    ['too_long', { durationS: MAX_DURATION_S + 1 }],
    ['live', { durationS: 0 }],
    ['age_restricted', { ageRestricted: true }],
    ['not_embeddable', { embeddable: false }],
    ['banned', { banned: true }],
    ['flagged', { flagged: true }],
  ])('refuses %s videos without queuing them or burning the cooldown', async (code, meta) => {
    const id = await seedVideo({ id: vid(1), ...meta });
    expect(await vote('en', id)).toMatchObject({ status: 422, body: { error: code } });
    expect((await state('en')).body.pool).toEqual([]);
    expect((await me('en')).body.voteCooldownEndsAt).toBeNull();
  });

  it('accepts a video of exactly the maximum duration', async () => {
    const id = await seedVideo({ id: vid(1), durationS: MAX_DURATION_S });
    expect((await vote('en', id)).status).toBe(200);
  });

  it('applies the banned channels and blocked keywords set in the admin', async () => {
    await db().insert(schema.bannedChannels).values({ channelId: 'evil-channel' });
    await db().insert(schema.blockedKeywords).values({ keyword: 'spoiler' });
    const fromBanned = await seedVideo({ id: vid(1), channelId: 'evil-channel' });
    const withKeyword = await seedVideo({ id: vid(2), title: 'Huge SPOILER inside' });

    expect(await vote('en', fromBanned)).toMatchObject({ status: 422, body: { error: 'banned_channel' } });
    expect(await vote('en', withKeyword)).toMatchObject({ status: 422, body: { error: 'blocked_keyword' } });
  });

  it('applies the room language rule', async () => {
    const english = await seedVideo({ id: vid(1), audioLanguage: 'en' });
    const french = await seedVideo({ id: vid(2), audioLanguage: 'fr' });
    const unknown = await seedVideo({ id: vid(3), audioLanguage: null });

    expect(await vote('fr', english)).toMatchObject({ status: 422, body: { error: 'wrong_language' } });
    expect((await vote('fr', french)).status).toBe(200);
    expect((await vote('fr', unknown, { viewer: 2 })).status).toBe(200);
    expect((await vote('en', english)).status).toBe(200);
    expect((await vote('jungle', french)).status).toBe(200);
  });

  it('refuses the video currently on screen', async () => {
    const id = await seedVideo({ id: vid(1) });
    await vote('en', id);
    expect((await playNext('en'))?.video.id).toBe(id);
    expect(await vote('en', id, { viewer: 2 })).toMatchObject({ status: 409, body: { error: 'now_playing' } });
  });

  it('only accepts videos matching the current theme', async () => {
    await setTheme('short');
    const long = await seedVideo({ id: vid(1), durationS: 300 });
    const short = await seedVideo({ id: vid(2), durationS: 90 });

    expect(await vote('en', long)).toMatchObject({ status: 422, body: { error: 'theme' } });
    expect((await vote('en', short)).status).toBe(200);
    expect((await state('en')).body.theme).toMatchObject({ id: 'short' });
  });

  it('rate-limits button mashing', async () => {
    for (let i = 0; i < 20; i++) expect((await vote('en', '', { url: 'nope' })).status).toBe(400);
    expect(await vote('en', '', { url: 'nope' })).toMatchObject({ status: 429, body: { error: 'rate_limited' } });
    expect((await vote('en', '', { url: 'nope', viewer: 2 })).status).toBe(400);
  });
});
