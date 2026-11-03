import 'server-only';
import { THEMES_ENABLED, VOTE_COOLDOWN_S } from '@/config/app';
import { type Constraint, constraintById } from '@/config/constraints';
import { type Decor, FACTIONS, ROOM_INFO, type PublicRoomId, type RoomId, isPublicRoom } from '@/config/rooms';
import { cache } from 'react';
import { localeOf } from '@/i18n';
import type { RoomSettings } from '@/lib/types';
import { getPrivateRoom } from './private-rooms';
import { currentTheme } from './themes';

// One draw per request: the layout, the viewport colour and the pages outside a room agree on the faction.
// Outside React rendering (API routes) each call draws again, which is fine: the client keeps the look it was served.
const drawFaction = cache((): Decor => FACTIONS[Math.floor(Math.random() * FACTIONS.length)]);

/** A public room's look right now. The Jungle wears the Alliance or the Horde, drawn at random on each visit. */
export function decorOf(room: PublicRoomId): Decor {
  const decor = ROOM_INFO[room].decor;
  return decor === 'faction' ? drawFaction() : decor;
}

/** What a public room plays by: the site defaults. */
export function publicSettings(room: PublicRoomId): RoomSettings {
  return {
    name: ROOM_INFO[room].name,
    private: false,
    locale: localeOf(room),
    decor: decorOf(room),
    rules: { maxDurationS: null, voteCooldownS: VOTE_COOLDOWN_S, lang: ROOM_INFO[room].lang, skip: true, report: true },
    themes: { mode: 'roulette' },
  };
}

/** A room's settings. Null for a private room that doesn't exist (anymore). */
export async function roomSettings(room: RoomId): Promise<RoomSettings | null> {
  if (isPublicRoom(room)) return publicSettings(room);
  return (await getPrivateRoom(room))?.settings ?? null;
}

/** The theme a room's votes must fit right now. Null everywhere while themes are switched off. */
export async function themeFor(room: RoomId, settings?: RoomSettings | null): Promise<Constraint | null> {
  if (!THEMES_ENABLED) return null;
  const themes = (settings ?? (await roomSettings(room)))?.themes ?? { mode: 'roulette' };
  if (themes.mode === 'none') return null;
  if (themes.mode === 'fixed') return constraintById(themes.id) ?? null;
  return currentTheme();
}
