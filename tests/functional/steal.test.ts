import { describe, expect, it } from 'vitest';
import { STEAL_HOLD_S } from '@/config/app';
import { K } from '@/server/keys';
import { redis } from '@/server/redis';
import { getNowPlaying } from '@/server/state';
import { maybeStealRemote, stealPeriod, stealRemote } from '@/server/steal';
import { iphOf, me, playNext, playsOf, seedVideo, skip, state, veto, vid, vote, watching } from './helpers';

/** `vid(1)` on screen, `vid(2)` queued, viewer 1 voted and is watching. */
async function playing() {
  const a = await seedVideo({ id: vid(1) });
  const b = await seedVideo({ id: vid(2) });
  await vote('en', a, { viewer: 1 });
  await vote('en', b, { viewer: 2 });
  await playNext('en');
  await watching('en', 1);
  return { a, b };
}

describe('the stolen remote', () => {
  it('goes to a voter who is watching, never to someone who left or never voted', async () => {
    await playing();
    await watching('en', 3); // watching, never voted; viewer 2 voted but isn't watching
    expect(await stealRemote('en')).toBe(iphOf(1));

    expect((await state('en')).body.steal?.endsAt).toBeGreaterThan(Date.now() + (STEAL_HOLD_S - 5) * 1000);
    expect((await me('en', 1)).body.remote).toBe(true);
    expect((await me('en', 2)).body.remote).toBe(false);
  });

  it('skips the period when nobody qualifies', async () => {
    await seedVideo({ id: vid(1) });
    await vote('en', vid(1), { viewer: 1 });
    expect(await stealRemote('en')).toBeNull();
    expect((await state('en')).body.steal).toBeNull();
  });

  it('is drawn once per period, at the moment picked for it', async () => {
    await playing();
    const period = stealPeriod();
    await redis().set(K.stealAt('en', period), String(Date.now() + 200));
    await maybeStealRemote('en', Date.now());
    expect((await state('en')).body.steal).toBeNull();

    await new Promise((r) => setTimeout(r, 250));
    await maybeStealRemote('en', Date.now());
    expect((await me('en', 1)).body.remote).toBe(true);
    await redis().del(K.steal('en'));
    await maybeStealRemote('en', Date.now());
    expect((await me('en', 1)).body.remote).toBe(false);
  });

  it('lets the holder veto what is playing once, with no threshold and no skip cooldown', async () => {
    const { a, b } = await playing();
    await stealRemote('en');

    expect(await veto('en', { viewer: 2 })).toMatchObject({ status: 403, body: { error: 'no_remote' } });
    expect(await veto('en', { viewer: 1 })).toMatchObject({ status: 200, body: { vetoed: true } });
    expect((await getNowPlaying('en'))?.video.id).toBe(b);
    expect(await playsOf(a)).toEqual([expect.objectContaining({ endReason: 'vetoed' })]);

    const s = (await state('en')).body;
    expect(s.steal).toBeNull();
    expect(s.skip.cooldownEndsAt).toBeNull();
    expect((await skip('en', { viewer: 3 })).status).toBe(200);
    expect(await veto('en', { viewer: 1 })).toMatchObject({ status: 403, body: { error: 'no_remote' } });
  });

  it('keeps the veto when there is nothing to veto', async () => {
    await seedVideo({ id: vid(1) });
    await vote('en', vid(1), { viewer: 1 });
    await watching('en', 1);
    await stealRemote('en');

    expect(await veto('en', { viewer: 1 })).toMatchObject({ status: 409, body: { error: 'nothing' } });
    expect((await me('en', 1)).body.remote).toBe(true);
  });

  it('belongs to one room', async () => {
    await playing();
    await stealRemote('en');
    expect((await me('fr', 1)).body.remote).toBe(false);
    expect(await veto('fr', { viewer: 1 })).toMatchObject({ status: 403 });
  });
});
