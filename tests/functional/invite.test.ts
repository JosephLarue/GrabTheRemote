import { describe, expect, it } from 'vitest';
import { INVITE_BOOST_COOLDOWN_S, INVITE_FRIENDS, VOTE_COOLDOWN_S } from '@/config/app';
import { claimInvite, me, seedVideo, vid, vote, watching } from './helpers';

describe('invite a friend', () => {
  it('gives every viewer a code and counts friends who arrive and watch', async () => {
    const { code, friends, boostEndsAt } = (await me('en', 1)).body.invite!;
    expect(code).toMatch(/^[A-Za-z0-9_-]{8}$/);
    expect(friends).toBe(0);
    expect(boostEndsAt).toBeNull();

    await watching('en', 2);
    expect(await claimInvite('en', code, { viewer: 2 })).toMatchObject({ status: 200, body: { boosted: false } });
    expect((await me('en', 1)).body.invite!.friends).toBe(1);
  });

  it('refuses friends who are not watching, yourself, and the same friend twice', async () => {
    const { code } = (await me('en', 1)).body.invite!;
    expect(await claimInvite('en', code, { viewer: 2 })).toMatchObject({ status: 409, body: { error: 'not_watching' } });
    await watching('en', 1);
    expect(await claimInvite('en', code, { viewer: 1 })).toMatchObject({ status: 409, body: { error: 'self_invite' } });
    await watching('en', 2);
    expect((await claimInvite('en', code, { viewer: 2 })).status).toBe(200);
    expect(await claimInvite('en', code, { viewer: 2 })).toMatchObject({ status: 409, body: { error: 'already_friend' } });
    expect(await claimInvite('en', 'nope', { viewer: 3 })).toMatchObject({ status: 400, body: { error: 'bad_invite' } });
    expect(await claimInvite('en', 'AAAAAAAA', { viewer: 3 })).toMatchObject({ status: 404, body: { error: 'bad_invite' } });
    expect((await me('en', 1)).body.invite!.friends).toBe(1);
  });

  it('boosts the vote cooldown once enough friends made it, in that room only', async () => {
    const { code } = (await me('en', 1)).body.invite!;
    for (let v = 2; v <= INVITE_FRIENDS + 1; v++) {
      await watching('en', v);
      const res = await claimInvite('en', code, { viewer: v });
      expect(res.status).toBe(200);
      expect(res.body.boosted).toBe(v === INVITE_FRIENDS + 1);
    }
    const mine = (await me('en', 1)).body.invite!;
    expect(mine.friends).toBe(0);
    expect(mine.boostEndsAt).toBeGreaterThan(Date.now());

    const id = await seedVideo({ id: vid(1) });
    const boosted = await vote('en', id, { viewer: 1 });
    expect(boosted.status).toBe(200);
    expect(boosted.body.cooldownEndsAt).toBeLessThan(Date.now() + (INVITE_BOOST_COOLDOWN_S + 5) * 1000);

    const plain = await vote('fr', id, { viewer: 1 });
    expect(plain.body.cooldownEndsAt).toBeGreaterThan(Date.now() + (VOTE_COOLDOWN_S - 5) * 1000);
    expect((await me('fr', 1)).body.invite!.boostEndsAt).toBeNull();
  });
});
