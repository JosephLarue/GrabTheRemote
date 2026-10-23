import { MAX_DURATION_S } from '@/config/app';
import { ROOM_INFO, type RoomId } from '@/config/rooms';
import type { ApiFailure } from '@/lib/api';
import type { Theme } from '@/lib/types';
import { type Dict, en } from './en';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';

export type { Dict };

const DICTS: Record<string, Dict> = { en, fr, es, it };

/** UI language of a room: its own language, English for The Jungle. */
export const localeOf = (room: RoomId) => (ROOM_INFO[room].lang && DICTS[ROOM_INFO[room].lang] ? ROOM_INFO[room].lang! : 'en');

export const dict = (room: RoomId): Dict => DICTS[localeOf(room)];

/** The room's own language, named in the room's UI language ("français" in /fr). Null for The Jungle. */
export const roomLanguage = (room: RoomId, t: Dict) => {
  const lang = ROOM_INFO[room].lang;
  return lang ? (t.languages[lang] ?? lang) : null;
};

export const themeLabel = (t: Dict, theme: NonNullable<Theme>) => t.themes[theme.id] ?? theme.label;

/**
 * Translates an API error by its code. `kind` disambiguates codes shared by skip and report.
 * Falls back to the server's English message for codes we don't know.
 */
export function errorText(
  t: Dict,
  err: Pick<ApiFailure, 'error' | 'message'>,
  ctx: { room: RoomId; kind?: 'skip' | 'report'; theme?: Theme },
): string {
  const e = t.errors;
  switch (err.error) {
    case 'theme':
      return ctx.theme ? e.theme(`${ctx.theme.emoji} ${themeLabel(t, ctx.theme)}`) : err.message;
    case 'wrong_language': {
      const language = roomLanguage(ctx.room, t);
      return language ? e.wrong_language(language) : err.message;
    }
    case 'too_long':
      return e.too_long(Math.floor(MAX_DURATION_S / 60));
    case 'nothing':
    case 'already': {
      const msg = e[`${err.error}_${ctx.kind ?? 'skip'}`];
      return typeof msg === 'string' ? msg : err.message;
    }
  }
  const msg = (e as Record<string, unknown>)[err.error];
  return typeof msg === 'string' ? msg : err.message;
}
