import { describe, expect, it } from 'vitest';
import { TWITCH_DECIDE_S, TWITCH_PICK_MAX_S, TWITCH_PICK_MIN_S, TWITCH_SLOT_S } from '@/config/app';
import type { TwitchChannel } from '@/lib/types';
import { db, schema } from '@/server/db/client';
import { invalidateBlocklists } from '@/server/moderation';
import { forceChange, startChannel, tickTwitch } from '@/server/twitch';
import { decide, me, pickStream, skip, state, vote } from './helpers';

const channel = (login: string): TwitchChannel => ({ login, name: login, title: '', game: '', viewers: null });

const live = async () => (await state('twitch')).body.twitch!;

/** Runs the ticker at `at` ms from the start of the test. */
const t0 = Date.now();
const tickAt = (seconds: number) => tickTwitch('twitch', t0 + seconds * 1000);

/** `alpha` on screen, slot over, deciding window open. */
async function deciding() {
  await startChannel('twitch', channel('alpha'), t0);
  await tickAt(TWITCH_SLOT_S);
  return live();
}

/** Deciding window closed with "change" winning: the pick window is open. */
async function picking() {
  await deciding();
  await decide('twitch', 'change', { viewer: 1 });
  await tickAt(TWITCH_SLOT_S + TWITCH_DECIDE_S);
  return live();
}

describe('the Twitch room', () => {
  it('is off air until a channel is pinned', async () => {
    expect((await live()).channel).toBeNull();
    expect(await tickAt(0)).toBe(false);
    expect(await decide('twitch', 'keep')).toMatchObject({ status: 409, body: { error: 'decide_closed' } });
  });

  it('plays a slot, then opens the keep-or-change vote', async () => {
    await startChannel('twitch', channel('alpha'), t0);
    expect(await live()).toMatchObject({ channel: { login: 'alpha' }, phase: 'watching', phaseEndsAt: t0 + TWITCH_SLOT_S * 1000 });
    expect(await decide('twitch', 'change')).toMatchObject({ status: 409, body: { error: 'decide_closed' } });

    await tickAt(TWITCH_SLOT_S - 1);
    expect((await live()).phase).toBe('watching');
    await tickAt(TWITCH_SLOT_S);
    expect(await live()).toMatchObject({ phase: 'deciding', phaseEndsAt: t0 + (TWITCH_SLOT_S + TWITCH_DECIDE_S) * 1000 });
  });

  it('counts one keep-or-change vote per viewer', async () => {
    await deciding();
    expect((await decide('twitch', 'keep', { viewer: 1 })).status).toBe(200);
    expect(await decide('twitch', 'change', { viewer: 1 })).toMatchObject({ status: 409, body: { error: 'already_decided' } });
    await decide('twitch', 'change', { viewer: 2 });
    await decide('twitch', 'change', { viewer: 3 });
    expect(await decide('twitch', 'maybe', { viewer: 4 })).toMatchObject({ status: 400 });
    expect(await decide('twitch', 'keep', { viewer: 5, token: 'bot' })).toMatchObject({ status: 403 });

    expect((await live()).tally).toEqual({ keep: 1, change: 2 });
    expect((await me('twitch', 1)).body.decided).toBe('keep');
  });

  it('keeps the stream on a tie, for another full slot', async () => {
    await deciding();
    await decide('twitch', 'keep', { viewer: 1 });
    await decide('twitch', 'change', { viewer: 2 });
    await tickAt(TWITCH_SLOT_S + TWITCH_DECIDE_S);

    const end = t0 + (2 * TWITCH_SLOT_S + TWITCH_DECIDE_S) * 1000;
    expect(await live()).toMatchObject({ channel: { login: 'alpha' }, phase: 'watching', phaseEndsAt: end });
  });

  it('opens a pick window of 5 to 20 seconds when "change" wins', async () => {
    const l = await picking();
    const opened = t0 + (TWITCH_SLOT_S + TWITCH_DECIDE_S) * 1000;
    expect(l.phase).toBe('picking');
    expect(l.phaseEndsAt).toBeGreaterThanOrEqual(opened + TWITCH_PICK_MIN_S * 1000);
    expect(l.phaseEndsAt).toBeLessThanOrEqual(opened + TWITCH_PICK_MAX_S * 1000);
  });

  it('puts the most-picked channel on screen when the window closes', async () => {
    await picking();
    expect(await pickStream('twitch', 'https://www.twitch.tv/Bravo', { viewer: 1 })).toMatchObject({ status: 200 });
    expect(await pickStream('twitch', 'charlie', { viewer: 1 })).toMatchObject({ status: 409, body: { error: 'already_picked' } });
    await pickStream('twitch', 'bravo', { viewer: 2 });
    await pickStream('twitch', 'charlie', { viewer: 3 });
    expect(await pickStream('twitch', 'alpha', { viewer: 4 })).toMatchObject({ status: 409, body: { error: 'pick_current' } });
    expect(await pickStream('twitch', 'not a channel', { viewer: 4 })).toMatchObject({ status: 400, body: { error: 'bad_channel' } });

    expect((await live()).candidates.map((c) => [c.login, c.votes])).toEqual([
      ['bravo', 2],
      ['charlie', 1],
    ]);
    expect((await me('twitch', 3)).body.picked).toBe('charlie');

    await tickAt(TWITCH_SLOT_S + TWITCH_DECIDE_S + TWITCH_PICK_MAX_S);
    expect(await live()).toMatchObject({ channel: { login: 'bravo' }, phase: 'watching', candidates: [] });
    expect(await pickStream('twitch', 'delta', { viewer: 5 })).toMatchObject({ status: 409, body: { error: 'pick_closed' } });
  });

  it('keeps the stream when nobody picks', async () => {
    await picking();
    await tickAt(TWITCH_SLOT_S + TWITCH_DECIDE_S + TWITCH_PICK_MAX_S);
    expect(await live()).toMatchObject({ channel: { login: 'alpha' }, phase: 'watching' });
  });

  it('suggests recent channels, not the one being voted off', async () => {
    await startChannel('twitch', channel('bravo'), t0);
    await startChannel('twitch', channel('alpha'), t0);
    const l = await picking();
    expect(l.suggestions.map((s) => s.login)).toEqual(['bravo']);
  });

  it('refuses channels banned by an admin', async () => {
    await db().insert(schema.bannedChannels).values({ channelId: 'twitch:bravo' });
    invalidateBlocklists();
    await picking();
    expect(await pickStream('twitch', 'bravo')).toMatchObject({ status: 422, body: { error: 'banned_channel' } });
  });

  it('lets the admin open a pick window right away', async () => {
    await startChannel('twitch', channel('alpha'), t0);
    await forceChange('twitch', t0);
    expect((await live()).phase).toBe('picking');
  });

  it('keeps YouTube and Twitch routes in their own rooms', async () => {
    expect(await vote('twitch', 'video000001')).toMatchObject({ status: 400, body: { error: 'bad_room' } });
    expect(await skip('twitch')).toMatchObject({ status: 400, body: { error: 'bad_room' } });
    expect(await decide('en', 'keep')).toMatchObject({ status: 400, body: { error: 'bad_room' } });
    expect(await pickStream('en', 'alpha')).toMatchObject({ status: 400, body: { error: 'bad_room' } });
    expect((await state('en')).body.twitch).toBeNull();
  });
});
