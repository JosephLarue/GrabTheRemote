import 'server-only';
import { P_NO_CONSTRAINT, THEME_SLOT_S } from '@/config/app';
import { type Constraint, constraintById, drawConstraint } from '@/config/constraints';
import type { Theme } from '@/lib/types';
import { db, schema } from './db/client';
import { K } from './keys';
import { redis } from './redis';

export const slotId = (now = Date.now()) => Math.floor(now / 1000 / THEME_SLOT_S);
export const slotEndsAt = (slot: number) => (slot + 1) * THEME_SLOT_S * 1000;

export async function themeWeights(): Promise<Record<string, number>> {
  const raw = await redis().hgetall(K.themeWeights);
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Number(v)]));
}

/** Theme for a slot, drawn once (first caller wins via SET NX) and logged to Postgres. */
export async function themeForSlot(slot: number): Promise<Constraint | null> {
  const existing = await redis().get(K.theme(slot));
  if (existing !== null) return existing === 'none' ? null : (constraintById(existing) ?? null);

  const drawn = drawConstraint(P_NO_CONSTRAINT, await themeWeights());
  const won = await redis().set(K.theme(slot), drawn?.id ?? 'none', 'EX', THEME_SLOT_S * 2, 'NX');
  if (!won) return themeForSlot(slot);
  await db()
    .insert(schema.themeSlots)
    .values({ slotId: slot, constraintId: drawn?.id ?? null })
    .onConflictDoNothing();
  return drawn;
}

export const currentTheme = () => themeForSlot(slotId());

export const toTheme = (c: Constraint | null): Theme => (c ? { id: c.id, label: c.label, emoji: c.emoji } : null);
