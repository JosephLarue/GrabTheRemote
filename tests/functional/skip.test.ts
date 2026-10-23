import { describe, expect, it } from 'vitest';
import { SKIP_COOLDOWN_S } from '@/config/app';
import { getNowPlaying } from '@/server/state';
import { addViewers, me, playNext, playsOf, seedVideo, skip, state, vid, vote } from './helpers';

/** Puts `vid(1)` on screen in each room with `vid(2)` queued behind it. */
async function playing(...rooms: ('en' | 'fr')[]) {
  const a = await seedVideo({ id: vid(1) });
  const b = await seedVideo({ id: vid(2) });
  for (const room of rooms) await queueAndPlay(room, a, b);
  return { a, b };
}

async function queueAndPlay(room: 'en' | 'fr', a: string, b: string) {
  await vote(room, a, { viewer: 101 });
  await vote(room, a, { viewer: 102 });
  await vote(room, b, { viewer: 103 });
  await playNext(room);
}

describe('POST /api/skip', () => {
  it('needs something on screen', async () => {
    expect(await skip('en')).toMatchObject({ status: 409, body: { error: 'nothing' } });
  });

  it('skips after 3 viewers smash it, then locks the button for the whole room', async () => {
    const { a, b } = await playing('en');

    expect(await skip('en', { viewer: 1 })).toMatchObject({ status: 200, body: { skipped: false } });
    expect((await state('en')).body.skip).toMatchObject({ votes: 1, needed: 3, cooldownEndsAt: null });
    expect((await me('en', 1)).body.skipped).toBe(true);
    expect(await skip('en', { viewer: 1 })).toMatchObject({ status: 409, body: { error: 'already' } });
    expect(await skip('en', { viewer: 2 })).toMatchObject({ status: 200, body: { skipped: false } });
    expect(await skip('en', { viewer: 3 })).toMatchObject({ status: 200, body: { skipped: true } });

    expect((await getNowPlaying('en'))?.video.id).toBe(b);
    expect(await playsOf(a)).toEqual([expect.objectContaining({ endReason: 'skipped', skipVotes: 3 })]);

    const s = (await state('en')).body.skip;
    expect(s.votes).toBe(0);
    expect(s.cooldownEndsAt).toBeGreaterThan(Date.now() + (SKIP_COOLDOWN_S - 5) * 1000);
    const locked = await skip('en', { viewer: 4 });
    expect(locked).toMatchObject({ status: 423, body: { error: 'skip_cooldown' } });
    expect((await me('en', 1)).body.skipped).toBe(false);
  });

  it('needs half of the viewers once the room is big enough', async () => {
    await playing('en');
    await addViewers('en', 10);
    expect((await state('en')).body.skip.needed).toBe(5);

    for (let v = 1; v <= 4; v++) expect((await skip('en', { viewer: v })).body.skipped).toBe(false);
    expect((await skip('en', { viewer: 5 })).body.skipped).toBe(true);
  });

  it('does not count a vote when the captcha fails', async () => {
    await playing('en');
    expect(await skip('en', { token: 'bot' })).toMatchObject({ status: 403, body: { error: 'captcha' } });
    expect((await state('en')).body.skip.votes).toBe(0);
  });

  it('keeps the skip cooldown inside its room', async () => {
    await playing('en', 'fr');
    for (let v = 1; v <= 3; v++) await skip('en', { viewer: v });

    expect(await skip('fr', { viewer: 1 })).toMatchObject({ status: 200, body: { skipped: false } });
    expect((await state('fr')).body.skip).toMatchObject({ votes: 1, cooldownEndsAt: null });
  });
});
