import { describe, expect, it } from 'vitest';
import { isRoom, roomFromAcceptLanguage } from './rooms';

describe('roomFromAcceptLanguage', () => {
  it('picks the first supported language', () => {
    expect(roomFromAcceptLanguage('fr-FR,fr;q=0.9,en;q=0.8')).toBe('fr');
    expect(roomFromAcceptLanguage('de-DE,es;q=0.7,en;q=0.5')).toBe('es');
  });
  it('honours q values over order', () => expect(roomFromAcceptLanguage('en;q=0.2,it;q=0.9')).toBe('it'));
  it('falls back to English', () => {
    expect(roomFromAcceptLanguage('de-DE,ja;q=0.5')).toBe('en');
    expect(roomFromAcceptLanguage(null)).toBe('en');
    expect(roomFromAcceptLanguage('fr;q=0')).toBe('en');
  });
  it('never auto-picks The Jungle', () => expect(roomFromAcceptLanguage('*')).toBe('en'));
});

describe('isRoom', () => {
  it('accepts known rooms only', () => {
    expect(isRoom('jungle')).toBe(true);
    expect(isRoom('de')).toBe(false);
    expect(isRoom(undefined)).toBe(false);
  });
});
