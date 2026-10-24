import { z } from 'zod';
import {
  PRIVATE_LANGS,
  PRIVATE_LOCALES,
  PRIVATE_MAX_DURATIONS_MIN,
  PRIVATE_VOTE_COOLDOWNS_S,
} from '@/config/app';
import { CONSTRAINTS } from '@/config/constraints';
import { DECORS, type PublicRoomId } from '@/config/rooms';
import type { RoomSettings } from './types';

// What a streamer sends when creating or editing a private room. Every option is picked from a fixed list.

const oneOf = <T extends string | number>(values: readonly T[]) =>
  z.custom<T>((v) => (values as readonly unknown[]).includes(v), { message: `one of ${values.join(', ')}` });

export const roomInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  locale: oneOf(PRIVATE_LOCALES),
  decor: oneOf(DECORS as readonly PublicRoomId[]),
  rules: z.object({
    maxDurationMin: oneOf(PRIVATE_MAX_DURATIONS_MIN),
    voteCooldownS: oneOf(PRIVATE_VOTE_COOLDOWNS_S),
    lang: z.union([z.null(), oneOf(PRIVATE_LANGS)]),
    skip: z.boolean(),
    report: z.boolean(),
  }),
  themes: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('roulette') }),
    z.object({ mode: z.literal('none') }),
    z.object({ mode: z.literal('fixed'), id: oneOf(CONSTRAINTS.map((c) => c.id)) }),
  ]),
  /** Empty: keep the current one (or generate one, on creation). */
  password: z
    .string()
    .trim()
    .max(20)
    .regex(/^[A-Za-z0-9]*$/, 'letters and digits only')
    .refine((p) => p === '' || p.length >= 4, 'at least 4 characters')
    .optional(),
});

export type RoomInput = z.infer<typeof roomInputSchema>;

export function toSettings(input: RoomInput): RoomSettings {
  return {
    name: input.name,
    private: true,
    locale: input.locale,
    decor: input.decor,
    rules: {
      maxDurationS: input.rules.maxDurationMin * 60,
      voteCooldownS: input.rules.voteCooldownS,
      lang: input.rules.lang,
      skip: input.rules.skip,
      report: input.rules.report,
    },
    themes: input.themes,
  };
}

/** The form's starting point: a room like the public ones. */
export function defaultInput(locale: string): RoomInput {
  return {
    name: '',
    locale: PRIVATE_LOCALES.includes(locale) ? locale : 'en',
    decor: 'jungle',
    rules: { maxDurationMin: 15, voteCooldownS: 300, lang: null, skip: true, report: true },
    themes: { mode: 'roulette' },
    password: '',
  };
}

/** Settings back into form values, for editing. */
export function toInput(s: RoomSettings): RoomInput {
  return {
    name: s.name,
    locale: s.locale,
    decor: s.decor,
    rules: {
      maxDurationMin: Math.round(s.rules.maxDurationS / 60),
      voteCooldownS: s.rules.voteCooldownS,
      lang: s.rules.lang,
      skip: s.rules.skip,
      report: s.rules.report,
    },
    themes: s.themes,
    password: '',
  };
}
