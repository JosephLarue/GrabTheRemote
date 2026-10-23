import { describe, expect, it } from 'vitest';
import { REPORT_CARD_S } from '@/config/app';
import { hall } from '@/server/hall';
import { getNowPlaying } from '@/server/state';
import { addViewers, me, playNext, playsOf, preview, report, seedVideo, state, vid, videoRow, vote } from './helpers';

async function playing() {
  const id = await seedVideo({ id: vid(1) });
  await vote('en', id, { viewer: 101 });
  await vote('jungle', id, { viewer: 101 });
  await playNext('en');
  return id;
}

describe('POST /api/report', () => {
  it('needs something on screen', async () => {
    expect(await report('en')).toMatchObject({ status: 409, body: { error: 'nothing' } });
  });

  it('takes the video off screen after 3 reports and keeps it out everywhere', async () => {
    const id = await playing();

    expect(await report('en', { viewer: 1 })).toMatchObject({ status: 200, body: { hidden: false } });
    expect((await me('en', 1)).body.reported).toBe(true);
    expect(await report('en', { viewer: 1 })).toMatchObject({ status: 409, body: { error: 'already' } });
    expect(await report('en', { viewer: 2 })).toMatchObject({ status: 200, body: { hidden: false } });
    expect(await report('en', { viewer: 3 })).toMatchObject({ status: 200, body: { hidden: true } });

    // A "mass reported" card replaces the video for a few seconds.
    const np = await getNowPlaying('en');
    expect(np).toMatchObject({ state: 'reported_card', video: { id } });
    expect(np!.endsAt).toBeLessThanOrEqual(Date.now() + REPORT_CARD_S * 1000);
    expect(await report('en', { viewer: 4 })).toMatchObject({ status: 409, body: { error: 'nothing' } });

    // Flagged for the admin, out of this room's queue and refused in every room.
    expect((await videoRow(id)).flagged).toBe(true);
    expect(await playsOf(id)).toEqual([expect.objectContaining({ endReason: 'reported', reportVotes: 3 })]);
    expect((await state('jungle')).body.pool).toEqual([]);
    expect(await vote('fr', id, { viewer: 9 })).toMatchObject({ status: 422, body: { error: 'flagged' } });
    expect((await preview('fr', id)).body.problemCode).toBe('flagged');
  });

  it('hides mass-reported videos in the Hall of Shame', async () => {
    const id = await playing();
    for (let v = 1; v <= 3; v++) await report('en', { viewer: v });

    expect(await hall('en', 'shame')).toEqual([expect.objectContaining({ videoId: id, reason: 'reported', hidden: true })]);
    expect(await hall('fr', 'shame')).toEqual([]);
  });

  it('needs 10% of the viewers once the room is big enough', async () => {
    await playing();
    await addViewers('en', 45);
    expect((await state('en')).body.report.needed).toBe(5);
    for (let v = 1; v <= 4; v++) expect((await report('en', { viewer: v })).body.hidden).toBe(false);
    expect((await report('en', { viewer: 5 })).body.hidden).toBe(true);
  });
});
