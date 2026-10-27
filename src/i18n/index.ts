import { MAX_DURATION_S } from '@/config/app';
import { ROOM_INFO, type RoomId, isPublicRoom } from '@/config/rooms';
import type { ApiFailure } from '@/lib/api';
import { formatLasted } from '@/lib/roast';
import type { RoomRules, Theme } from '@/lib/types';
import { type Dict, en } from './en';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';

export type { Dict };

const DICTS: Record<string, Dict> = { en, fr, es, it };

/** A supported UI locale, else English. */
export const toLocale = (lang: string | null | undefined) => (lang && DICTS[lang] ? lang : 'en');

/**
 * UI language of a public room: its own language, English for The Jungle and Twitch. A private room's comes
 * from its settings (the LiveProvider passes it on); without them, English.
 */
export const localeOf = (room: RoomId) => toLocale(isPublicRoom(room) ? ROOM_INFO[room].lang : null);

export const dict = (room: RoomId): Dict => DICTS[localeOf(room)];

export const dictFor = (locale: string): Dict => DICTS[toLocale(locale)];

/** A language named in the UI language ("français" in French). Null for "any language". */
export const languageName = (lang: string | null, t: Dict) => (lang ? (t.languages[lang] ?? lang) : null);

/** A public room's own language, named in its UI language ("français" in /fr). Null for The Jungle. */
export const roomLanguage = (room: RoomId, t: Dict) => languageName(isPublicRoom(room) ? ROOM_INFO[room].lang : null, t);

export const themeLabel = (t: Dict, theme: NonNullable<Theme>) => t.themes[theme.id] ?? theme.label;

/**
 * Translates an API error by its code. `kind` disambiguates codes shared by skip and report.
 * Falls back to the server's English message for codes we don't know.
 */
export function errorText(
  t: Dict,
  err: Pick<ApiFailure, 'error' | 'message'>,
  ctx: { room: RoomId; kind?: 'skip' | 'report' | 'veto'; theme?: Theme; rules?: Pick<RoomRules, 'lang' | 'maxDurationS'> },
): string {
  const e = t.errors;
  switch (err.error) {
    case 'theme':
      return ctx.theme ? e.theme(`${ctx.theme.emoji} ${themeLabel(t, ctx.theme)}`) : err.message;
    case 'wrong_language': {
      const language = ctx.rules ? languageName(ctx.rules.lang, t) : roomLanguage(ctx.room, t);
      return language ? e.wrong_language(language) : err.message;
    }
    case 'too_long':
      return e.too_long(Math.floor((ctx.rules?.maxDurationS ?? MAX_DURATION_S) / 60));
    case 'nothing':
    case 'already': {
      const msg = (e as Record<string, unknown>)[`${err.error}_${ctx.kind ?? 'skip'}`];
      return typeof msg === 'string' ? msg : err.message;
    }
  }
  const msg = (e as Record<string, unknown>)[err.error];
  return typeof msg === 'string' ? msg : err.message;
}

/** "Skipped after 4s by 600 people", for a Hall of Shame entry. */
export function shameHeadline(t: Dict, row: { reason?: string; value: number; votes?: number }) {
  const d = formatLasted(row.value);
  if (row.reason === 'vetoed') return t.shame.vetoed(d);
  return (row.reason === 'reported' ? t.shame.reported : t.shame.skipped)(d, row.votes ?? 0);
}
