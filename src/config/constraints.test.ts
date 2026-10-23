import { describe, expect, it } from 'vitest';
import type { VideoMeta } from '@/lib/types';
import { constraintById, drawConstraint } from './constraints';

const base: VideoMeta = {
  id: 'x',
  title: 'Hello World',
  channelId: 'c',
  channelTitle: 'C',
  durationS: 200,
  publishedAt: Date.UTC(2010, 5, 1),
  viewCount: 5000,
  categoryId: '10',
  thumbnailUrl: '',
  embeddable: true,
  ageRestricted: false,
  audioLanguage: null,
  flagged: false,
  banned: false,
};

const check = (id: string, v: Partial<VideoMeta>) => constraintById(id)!.check({ ...base, ...v });

describe('constraints', () => {
  it('checks fields', () => {
    expect(check('short', { durationS: 120 })).toBe(true);
    expect(check('short', { durationS: 121 })).toBe(false);
    expect(check('vintage', {})).toBe(true);
    expect(check('hidden-gem', {})).toBe(true);
    expect(check('music', {})).toBe(true);
    expect(check('caps', { title: 'HELLO 123' })).toBe(true);
    expect(check('caps', { title: '123' })).toBe(false);
    expect(check('one-word', { title: '  Banana ' })).toBe(true);
  });

  it('draws none below pNone, else by weight', () => {
    expect(drawConstraint(0.5, {}, () => 0.4)).toBeNull();
    const seq = [0.9, 0];
    expect(drawConstraint(0.5, {}, () => seq.shift()!)?.id).toBe('short');
    const seq2 = [0.9, 0];
    expect(drawConstraint(0.5, { short: 0, tiny: 0 }, () => seq2.shift()!)?.id).toBe('hidden-gem');
  });
});
