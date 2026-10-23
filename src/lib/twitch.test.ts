import { describe, expect, it } from 'vitest';
import { isCloseCall, parseTwitchLogin } from './twitch';

describe('parseTwitchLogin', () => {
  it.each([
    ['zerator', 'zerator'],
    ['@ZeratoR', 'zerator'],
    ['twitch.tv/zerator', 'zerator'],
    ['https://www.twitch.tv/zerator', 'zerator'],
    ['https://m.twitch.tv/zerator?sr=a', 'zerator'],
    ['https://www.twitch.tv/some_one_123/videos', 'some_one_123'],
    ['  kamet0  ', 'kamet0'],
  ])('reads %s', (input, login) => expect(parseTwitchLogin(input)).toBe(login));

  it.each(['', 'ab', 'a'.repeat(26), 'no spaces', 'https://youtube.com/watch?v=x', 'evil.com/zerator', 'dash-name'])(
    'refuses %s',
    (input) => expect(parseTwitchLogin(input)).toBeNull(),
  );
});

describe('isCloseCall', () => {
  it('is close when both sides are within one vote', () => {
    expect(isCloseCall({ keep: 4, change: 3 })).toBe(true);
    expect(isCloseCall({ keep: 1, change: 1 })).toBe(true);
  });
  it('is not close when one side leads, or nobody votes', () => {
    expect(isCloseCall({ keep: 5, change: 2 })).toBe(false);
    expect(isCloseCall({ keep: 1, change: 0 })).toBe(false);
    expect(isCloseCall({ keep: 0, change: 0 })).toBe(false);
  });
});
