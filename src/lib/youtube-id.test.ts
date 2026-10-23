import { describe, expect, it } from 'vitest';
import { parseIsoDuration, parseYouTubeId } from './youtube-id';

const ID = 'dQw4w9WgXcQ';

describe('parseYouTubeId', () => {
  it.each([
    ID,
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s&list=PL123`,
    `http://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `https://www.youtube.com/live/${ID}?feature=share`,
    `youtube.com/watch?v=${ID}`,
    `  https://youtu.be/${ID}  `,
  ])('accepts %s', (url) => {
    expect(parseYouTubeId(url)).toBe(ID);
  });

  it.each([
    '',
    'hello',
    'https://vimeo.com/123456789',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/channel/UC1234567890',
    `https://evil.com/watch?v=${ID}`,
    `https://youtube.com.evil.com/watch?v=${ID}`,
  ])('rejects %s', (url) => {
    expect(parseYouTubeId(url)).toBeNull();
  });
});

describe('parseIsoDuration', () => {
  it.each([
    ['PT3M33S', 213],
    ['PT1H', 3600],
    ['PT45S', 45],
    ['P1DT2H', 93600],
    ['P0D', 0],
    ['garbage', 0],
  ])('%s -> %i', (iso, s) => {
    expect(parseIsoDuration(iso)).toBe(s);
  });
});
