import { describe, expect, it } from 'vitest';
import { FOIL, RARITIES, rarityOf } from './cards';

describe('shame card rarity', () => {
  it('is rarer the faster the video died', () => {
    expect(rarityOf('skipped', 3)).toBe('legendary');
    expect(rarityOf('skipped', 12)).toBe('epic');
    expect(rarityOf('skipped', 45)).toBe('rare');
    expect(rarityOf('skipped', 200)).toBe('common');
  });

  it('sets vetoes and mass reports apart', () => {
    expect(rarityOf('vetoed', 300)).toBe('mythic');
    expect(rarityOf('reported', 2)).toBe('banned');
  });

  it('has a foil for every rarity', () => {
    for (const r of RARITIES) expect(FOIL[r]).toHaveLength(3);
  });
});
