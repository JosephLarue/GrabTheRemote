import { describe, expect, it } from 'vitest';
import { PRELOAD_WINDOW_S } from '@/config/app';
import type { NowPlaying, PoolEntry } from './types';
import { preloadCandidate } from './preload';

const entry = (id: string, votes: number, matchesTheme = true): PoolEntry => ({
  id,
  title: id,
  channelTitle: 'c',
  durationS: 60,
  thumbnailUrl: '',
  votes,
  matchesTheme,
});

const now = 1_000_000;
const np = (endsIn: number, extra: Partial<NowPlaying> = {}): NowPlaying => ({
  playId: 1,
  video: { id: 'current', title: 't', channelTitle: 'c', durationS: 60, thumbnailUrl: '' },
  startedAt: now - 10_000,
  endsAt: now + endsIn * 1000,
  state: 'playing',
  pausedAt: null,
  ...extra,
});

describe('preloadCandidate', () => {
  it('cues the leader in the last minute when it has a clear lead', () => {
    expect(preloadCandidate([entry('a', 3), entry('b', 1)], np(30), now)).toBe('a');
    expect(preloadCandidate([entry('a', 1)], np(30), now)).toBe('a');
  });

  it('waits while the video has more than the window left', () => {
    expect(preloadCandidate([entry('a', 5)], np(PRELOAD_WINDOW_S + 5), now)).toBeNull();
  });

  it('holds off during a remote fight', () => {
    expect(preloadCandidate([entry('a', 2), entry('b', 2)], np(30), now)).toBeNull();
    expect(preloadCandidate([entry('a', 5), entry('b', 4)], np(30), now)).toBeNull();
  });

  it('skips off-theme leaders, empty queues, pauses and reported cards', () => {
    expect(preloadCandidate([entry('a', 5, false)], np(30), now)).toBeNull();
    expect(preloadCandidate([], np(30), now)).toBeNull();
    expect(preloadCandidate([entry('a', 5)], np(30, { pausedAt: now }), now)).toBeNull();
    expect(preloadCandidate([entry('a', 5)], np(30, { state: 'reported_card' }), now)).toBeNull();
    expect(preloadCandidate([entry('a', 5)], null, now)).toBeNull();
  });
});
