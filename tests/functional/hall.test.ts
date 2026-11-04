import { describe, expect, it } from 'vitest';
import { HALL_TOP } from '@/config/app';
import { db, schema } from '@/server/db/client';
import { hall } from '@/server/hall';
import { seedVideo, vid } from './helpers';

/** A finished play, as the engine leaves it. */
const play = (videoId: string, at: string, peakViewers: number, votesAtPick = 0) => ({
  room: 'en' as const,
  videoId,
  source: 'pool' as const,
  votesAtPick,
  peakViewers,
  startedAt: new Date(at),
  endedAt: new Date(new Date(at).getTime() + 180_000),
  endReason: 'finished' as const,
});

describe('Hall of Fame records', () => {
  it('lists each video once, with its best play', async () => {
    const a = await seedVideo({ id: vid(1) });
    const b = await seedVideo({ id: vid(2) });
    await db()
      .insert(schema.plays)
      .values([
        play(a, '2026-01-01T10:00:00Z', 4, 2),
        play(a, '2026-01-02T10:00:00Z', 9, 5),
        // Same peak again later: the first time it was reached is the record.
        play(a, '2026-01-03T10:00:00Z', 9, 1),
        play(b, '2026-01-04T10:00:00Z', 6, 7),
      ]);
    expect(await hall('en', 'peak')).toEqual([
      expect.objectContaining({ videoId: a, value: 9, at: '2026-01-02T10:00:00.000Z' }),
      expect.objectContaining({ videoId: b, value: 6, at: '2026-01-04T10:00:00.000Z' }),
    ]);
    expect(await hall('en', 'landslide')).toEqual([
      expect.objectContaining({ videoId: b, value: 7 }),
      expect.objectContaining({ videoId: a, value: 5, at: '2026-01-02T10:00:00.000Z' }),
    ]);
  });

  it('stops at the top ten', async () => {
    const rows: ReturnType<typeof play>[] = [];
    for (let i = 1; i <= HALL_TOP + 3; i++) rows.push(play(await seedVideo({ id: vid(i) }), '2026-01-01T10:00:00Z', i));
    await db().insert(schema.plays).values(rows);
    const top = await hall('en', 'peak');
    expect(top).toHaveLength(HALL_TOP);
    expect(top.map((r) => r.value)).toEqual(rows.map((r) => r.peakViewers).sort((x, y) => y - x).slice(0, HALL_TOP));
  });
});
