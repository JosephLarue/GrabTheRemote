import { describe, expect, it } from 'vitest';
import { CHAT_MAX_LENGTH } from '@/config/app';
import { chatName, cleanChatText, hasLink, isChatSeed } from './chat';

describe('chatName', () => {
  it('gives a seed the same couch nickname every time', () => {
    const seed = crypto.randomUUID();
    expect(chatName(seed)).toEqual(chatName(seed));
    expect(chatName(seed).name).toMatch(/^\w+ [\w ]+$/);
    expect(chatName(seed).hue).toBeGreaterThanOrEqual(0);
    expect(chatName(seed).hue).toBeLessThan(360);
  });

  it('spreads seeds over many nicknames', () => {
    const names = new Set(Array.from({ length: 200 }, () => chatName(crypto.randomUUID()).name));
    expect(names.size).toBeGreaterThan(150);
  });
});

describe('isChatSeed', () => {
  it.each([crypto.randomUUID(), 'abcdefgh', 'a'.repeat(64)])('takes %s', (s) => expect(isChatSeed(s)).toBe(true));
  it.each(['short', 'a'.repeat(65), 'has space here', '<script>', 42, null])('refuses %s', (s) =>
    expect(isChatSeed(s)).toBe(false),
  );
});

describe('cleanChatText', () => {
  it('collapses whitespace and trims', () => expect(cleanChatText('  hello \n\n  couch\t ')).toBe('hello couch'));
  it('drops invisible and direction-flipping characters', () =>
    expect(cleanChatText('a\u200bb\u202ec\u0007d')).toBe('a b c d'));
  it('flattens zalgo', () => expect(cleanChatText('q\u0301\u0302\u0303\u0304o')).toBe('q\u0301o'));
  it('keeps emoji and accents', () => expect(cleanChatText('Ça va 🔥😂')).toBe('Ça va 🔥😂'));
  it('caps the length', () => expect(cleanChatText('x'.repeat(500))).toHaveLength(CHAT_MAX_LENGTH));
  it('leaves nothing from nothing', () => expect(cleanChatText(' \u200b\n ')).toBe(''));
});

describe('hasLink', () => {
  it.each(['https://evil.example', 'go to www.spam.net', 'free stuff at spam.com', 'BIT.LY/x'])('spots %s', (s) =>
    expect(hasLink(s)).toBe(true),
  );
  it.each(['lol', 'this is so good...', 'ok.so what', 'v2.0 was better'])('lets %s through', (s) =>
    expect(hasLink(s)).toBe(false),
  );
});
