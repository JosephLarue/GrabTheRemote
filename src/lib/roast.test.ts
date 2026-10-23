import { describe, expect, it } from 'vitest';
import { formatLasted, roastOf } from './roast';

describe('roastOf', () => {
  it('roasts skips by how fast they went', () => {
    expect(roastOf('skipped', 0)).toBe('ad');
    expect(roastOf('skipped', 4)).toBe('ad');
    expect(roastOf('skipped', 5)).toBe('intro');
    expect(roastOf('skipped', 45)).toBe('minute');
    expect(roastOf('skipped', 120)).toBe('tried');
    expect(roastOf('skipped', 600)).toBe('long');
  });

  it('has its own line for reports and vetoes, however fast', () => {
    expect(roastOf('reported', 2)).toBe('reported');
    expect(roastOf('vetoed', 2)).toBe('veto');
  });
});

describe('formatLasted', () => {
  it('reads like a stopwatch', () => {
    expect(formatLasted(4)).toBe('4s');
    expect(formatLasted(125)).toBe('2m 05s');
  });
});
