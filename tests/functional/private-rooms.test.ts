import { describe, expect, it } from 'vitest';
import { THEMES_ENABLED } from '@/config/app';
import type { RoomId } from '@/config/rooms';
import { defaultInput, type RoomInput } from '@/lib/private-room';
import { K } from '@/server/keys';
import { redis } from '@/server/redis';
import { getNowPlaying, setNowPlaying } from '@/server/state';
import {
  claimRoom,
  control,
  createRoom,
  joinRoom,
  me,
  playNext,
  playsOf,
  report,
  roomSettingsUpdate,
  seedVideo,
  setTheme,
  skip,
  state,
  vid,
  vote,
} from './helpers';

const STREAMER = 1;

const input = (patch: Partial<RoomInput> = {}, rules: Partial<RoomInput['rules']> = {}): RoomInput => {
  const base = { ...defaultInput('en'), name: 'Chez Zerator', ...patch };
  return { ...base, rules: { ...base.rules, ...rules } };
};

/** A private room made by STREAMER, with `viewers` who entered its password. */
async function room(i: RoomInput = input(), ...viewers: number[]) {
  const { body } = await createRoom(i, { viewer: STREAMER });
  for (const v of viewers) await joinRoom(body.id, body.password, { viewer: v });
  return { id: body.id as RoomId, password: body.password, ownerKey: body.ownerKey };
}

/** `vid(1)` on screen in `id`, voted by viewer 2. */
async function playing(id: RoomId) {
  await seedVideo({ id: vid(1) });
  await vote(id, vid(1), { viewer: 2 });
  await playNext(id);
}

describe('private rooms', () => {
  it('gives the streamer an ID, a password and the keys to the room', async () => {
    const res = await createRoom(input(), { viewer: STREAMER });
    expect(res.status).toBe(200);
    expect(res.body.id).toMatch(/^p-[a-z0-9]{6}$/);
    expect(res.body.password).toMatch(/^[A-Z0-9]{6}$/);

    const s = await state(res.body.id, STREAMER);
    expect(s.status).toBe(200);
    expect(s.body.room).toMatchObject({ name: 'Chez Zerator', private: true, decor: 'jungle' });
    expect((await me(res.body.id, STREAMER)).body).toMatchObject({ owner: true, password: res.body.password });
  });

  it('keeps out everyone without the password', async () => {
    const { id, password } = await room();
    expect(await state(id, 2)).toMatchObject({ status: 403, body: { error: 'locked' } });
    expect(await vote(id, vid(1), { viewer: 2 })).toMatchObject({ status: 403, body: { error: 'locked' } });

    expect(await joinRoom(id, 'WRONG1', { viewer: 2 })).toMatchObject({ status: 403, body: { error: 'bad_password' } });
    expect(await joinRoom('p-zzzzzz', password, { viewer: 2 })).toMatchObject({ status: 404 });
    expect((await joinRoom(id, password.toLowerCase(), { viewer: 2 })).status).toBe(200);

    expect((await state(id, 2)).status).toBe(200);
    expect((await me(id, 2)).body).toMatchObject({ owner: false, password: null });
  });

  it('lets the streamer pick the password, and refuses broken settings', async () => {
    expect((await createRoom(input({ password: 'chat2024' }))).body.password).toBe('chat2024');
    expect(await createRoom({ ...input(), name: '' })).toMatchObject({ status: 400, body: { error: 'bad_settings' } });
    expect(await createRoom(input(), { token: 'bot' })).toMatchObject({ status: 403, body: { error: 'captcha' } });
  });

  it("plays by the streamer's rules: length, language, cooldown", async () => {
    const { id } = await room(input({}, { maxDurationMin: 1, lang: 'fr', voteCooldownS: 30 }), 2, 3, 4);
    await seedVideo({ id: vid(1), durationS: 180 });
    await seedVideo({ id: vid(2), durationS: 50, audioLanguage: 'en' });
    await seedVideo({ id: vid(3), durationS: 50, audioLanguage: 'fr' });

    expect(await vote(id, vid(1), { viewer: 2 })).toMatchObject({ status: 422, body: { error: 'too_long' } });
    expect(await vote(id, vid(2), { viewer: 3 })).toMatchObject({ status: 422, body: { error: 'wrong_language' } });
    const ok = await vote(id, vid(3), { viewer: 4 });
    expect(ok.status).toBe(200);
    expect(ok.body.cooldownEndsAt).toBeLessThanOrEqual(Date.now() + 30_000);

    // The public rooms keep their own rules.
    expect((await vote('en', vid(1), { viewer: 2 })).status).toBe(200);
  });

  it('resumes a pause made during the channel-change static without moving the clock', async () => {
    const { id } = await room(input(), 2);
    await playing(id);
    const before = (await getNowPlaying(id))!;
    await control(id, 'pause', { viewer: STREAMER });
    await control(id, 'resume', { viewer: STREAMER });
    expect(await getNowPlaying(id)).toMatchObject({ startedAt: before.startedAt, endsAt: before.endsAt, pausedAt: null });
  });

  it('can turn the skip and report buttons off', async () => {
    const { id } = await room(input({}, { skip: false, report: false }), 2);
    await playing(id);
    expect(await skip(id, { viewer: 2 })).toMatchObject({ status: 403, body: { error: 'skip_off' } });
    expect(await report(id, { viewer: 2 })).toMatchObject({ status: 403, body: { error: 'report_off' } });
  });

  it.skipIf(!THEMES_ENABLED)('can drop the theme roulette, or pin one theme', async () => {
    await setTheme('music');
    const none = await room(input({ themes: { mode: 'none' } }), 2);
    expect((await state(none.id, 2)).body.theme).toBeNull();

    await setTheme(null);
    const fixed = await room(input({ themes: { mode: 'fixed', id: 'music' } }), 2);
    expect((await state(fixed.id, 2)).body.theme).toMatchObject({ id: 'music' });
    await seedVideo({ id: vid(1), categoryId: '22' });
    expect(await vote(fixed.id, vid(1), { viewer: 2 })).toMatchObject({ status: 422, body: { error: 'theme' } });
  });

  it('lets only the streamer pause, resume and skip', async () => {
    const { id } = await room(input(), 2);
    await playing(id);
    expect(await control(id, 'pause', { viewer: 2 })).toMatchObject({ status: 403, body: { error: 'not_owner' } });

    // Past the channel-change static, a few seconds into the video.
    const np = (await getNowPlaying(id))!;
    await setNowPlaying(id, { ...np, startedAt: Date.now() - 5000, endsAt: np.endsAt - 5000 - (np.startedAt - Date.now()) });
    const before = (await getNowPlaying(id))!;
    expect((await control(id, 'pause', { viewer: STREAMER })).status).toBe(200);
    expect((await getNowPlaying(id))?.pausedAt).toBeGreaterThan(0);
    expect(await control(id, 'pause', { viewer: STREAMER })).toMatchObject({ status: 409 });

    await new Promise((r) => setTimeout(r, 50));
    expect((await control(id, 'resume', { viewer: STREAMER })).status).toBe(200);
    const after = (await getNowPlaying(id))!;
    expect(after.pausedAt).toBeNull();
    // The pause is added to the clock: the video still gets its full length.
    expect(after.endsAt - before.endsAt).toBeGreaterThanOrEqual(50);
    expect(after.endsAt - after.startedAt).toBe(before.endsAt - before.startedAt);

    expect((await control(id, 'skip', { viewer: STREAMER })).status).toBe(200);
    expect((await getNowPlaying(id))?.playId).not.toBe(before.playId);
  });

  it('locks out the old password when the streamer changes it', async () => {
    const { id } = await room(input(), 2);
    const res = await roomSettingsUpdate(id, input({ password: 'NEWPASS', decor: 'fr' }), { viewer: STREAMER });
    expect(res).toMatchObject({ status: 200, body: { password: 'NEWPASS' } });

    expect(await state(id, 2)).toMatchObject({ status: 403, body: { error: 'locked' } });
    expect((await state(id, STREAMER)).body.room.decor).toBe('fr');
    expect(await roomSettingsUpdate(id, input(), { viewer: 2 })).toMatchObject({ status: 403 });
  });

  it('hands the room to whoever opens the owner link', async () => {
    const { id, ownerKey } = await room();
    expect(await claimRoom(id, 'nope', { viewer: 5 })).toMatchObject({ status: 403 });
    expect((await claimRoom(id, ownerKey, { viewer: 5 })).status).toBe(200);
    expect((await me(id, 5)).body.owner).toBe(true);
  });

  it('closes for good, by hand or after a day with nobody watching', async () => {
    const a = await room(input(), 2);
    await playing(a.id);
    expect(await control(a.id, 'close', { viewer: 2 })).toMatchObject({ status: 403 });
    expect((await control(a.id, 'close', { viewer: STREAMER })).status).toBe(200);
    expect(await state(a.id, STREAMER)).toMatchObject({ status: 404, body: { error: 'room_gone' } });
    // Whatever was on screen is over: no play row stays open forever.
    expect(await playsOf(vid(1))).toEqual([expect.objectContaining({ room: a.id, endReason: 'admin' })]);
    expect((await playsOf(vid(1)))[0].endedAt).toBeInstanceOf(Date);

    const b = await room();
    await redis().del(K.privateRoom(b.id)); // what the idle TTL does
    expect(await state(b.id, STREAMER)).toMatchObject({ status: 404, body: { error: 'room_gone' } });
  });

  it('leaves the public rooms open to all', async () => {
    expect((await state('en', 9)).body.room).toMatchObject({ private: false, name: 'English' });
  });
});
