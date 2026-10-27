import { describe, expect, it } from 'vitest';
import { defaultInput, roomInputSchema, toInput, toSettings } from './private-room';

const valid = { ...defaultInput('fr'), name: 'Chez Zerator' };

describe('roomInputSchema', () => {
  it('accepts a room built from the picker options', () => {
    expect(roomInputSchema.safeParse(valid).success).toBe(true);
    expect(roomInputSchema.safeParse({ ...valid, themes: { mode: 'fixed', id: 'music' } }).success).toBe(true);
    expect(roomInputSchema.safeParse({ ...valid, password: 'ABCD1234' }).success).toBe(true);
  });

  it.each([
    ['an empty name', { name: '  ' }],
    ['a duration off the list', { rules: { ...valid.rules, maxDurationMin: 7 } }],
    ['an unknown theme', { themes: { mode: 'fixed', id: 'nope' } }],
    ['the Twitch room as decor', { decor: 'twitch' }],
    ['a short password', { password: 'abc' }],
    ['a password with symbols', { password: 'abc d!' }],
  ])('refuses %s', (_, patch) => expect(roomInputSchema.safeParse({ ...valid, ...patch }).success).toBe(false));
});

describe('toSettings / toInput', () => {
  it('round-trips, durations in seconds on the server side', () => {
    const s = toSettings(roomInputSchema.parse(valid));
    expect(s).toMatchObject({ private: true, locale: 'fr', rules: { maxDurationS: 900, voteCooldownS: 300 } });
    expect(toInput(s)).toEqual({ ...valid, password: '' });
  });
});
