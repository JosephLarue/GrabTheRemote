import { describe, expect, it } from 'vitest';
import { CONSTRAINTS } from '@/config/constraints';
import { dict, errorText, localeOf, roomLanguage } from '.';

describe('localeOf', () => {
  it('uses the room language, English for The Jungle', () => {
    expect(localeOf('fr')).toBe('fr');
    expect(localeOf('it')).toBe('it');
    expect(localeOf('jungle')).toBe('en');
  });
});

describe('roomLanguage', () => {
  it('names the room language in its own UI', () => {
    expect(roomLanguage('fr', dict('fr'))).toBe('français');
    expect(roomLanguage('es', dict('es'))).toBe('español');
    expect(roomLanguage('jungle', dict('jungle'))).toBeNull();
  });
});

describe('errorText', () => {
  const fr = dict('fr');
  it('translates known codes', () => {
    expect(errorText(fr, { error: 'cooldown', message: 'x' }, { room: 'fr' })).toContain('télécommande');
    expect(errorText(fr, { error: 'too_long', message: 'x' }, { room: 'fr' })).toContain('15 minutes');
  });
  it('uses the action for shared codes', () => {
    expect(errorText(fr, { error: 'already', message: 'x' }, { room: 'fr', kind: 'report' })).toBe(
      fr.errors.already_report,
    );
  });
  it('fills in the theme and language', () => {
    const theme = { id: 'music', label: 'Music only', emoji: '🎸' };
    expect(errorText(fr, { error: 'theme', message: 'x' }, { room: 'fr', theme })).toBe(
      'Ne colle pas au thème : 🎸 Musique uniquement',
    );
    expect(errorText(fr, { error: 'wrong_language', message: 'x' }, { room: 'fr' })).toContain('en français');
  });
  it("falls back to the server message for codes it doesn't know", () => {
    expect(errorText(fr, { error: 'mystery', message: 'Server says' }, { room: 'fr' })).toBe('Server says');
  });
});

describe('dictionaries', () => {
  it('translate every theme', () => {
    const ids = CONSTRAINTS.map((c) => c.id);
    expect(Object.keys(dict('en').themes).sort()).toEqual([...ids].sort());
    for (const room of ['fr', 'es', 'it'] as const) expect(Object.keys(dict(room).themes).sort()).toEqual(ids.sort());
  });
});
