import { describe, expect, it } from 'vitest';
import { remoteFight } from './fight';
import type { PoolEntry } from './types';

const entry = (id: string, votes: number): PoolEntry => ({
  id,
  votes,
  title: id,
  channelTitle: 'c',
  durationS: 60,
  thumbnailUrl: '',
  matchesTheme: true,
});

describe('remoteFight', () => {
  it('starts when the top two are neck and neck', () => {
    const pool = [entry('a', 5), entry('b', 4), entry('c', 4)];
    expect(remoteFight(pool)?.map((p) => p.id)).toEqual(['a', 'b']);
    expect(remoteFight([entry('a', 3), entry('b', 3)])).not.toBeNull();
  });

  it('needs a real fight: two votes each, one vote apart at most', () => {
    expect(remoteFight([entry('a', 1), entry('b', 1)])).toBeNull();
    expect(remoteFight([entry('a', 6), entry('b', 4)])).toBeNull();
    expect(remoteFight([entry('a', 6)])).toBeNull();
    expect(remoteFight([])).toBeNull();
  });
});
