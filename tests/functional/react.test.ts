import { describe, expect, it } from 'vitest';
import { REACTION_MAX_PER_WINDOW } from '@/config/app';
import { REACTION_BATCH_MS } from '@/config/app';
import type { LiveEvent } from '@/lib/types';
import { bus } from '@/server/state';
import { react } from './helpers';

/** Events the room's live stream would send, collected for `ms`. */
async function listen(room: string, ms: number) {
  const events: LiveEvent[] = [];
  const on = (msg: string) => events.push(JSON.parse(msg));
  bus().on(room, on);
  await new Promise((r) => setTimeout(r, 100)); // let the subscription settle
  return {
    events,
    done: () => new Promise<LiveEvent[]>((r) => setTimeout(() => (bus().off(room, on), r(events)), ms)),
  };
}

describe('POST /api/react', () => {
  it('batches the couch into one event per room', async () => {
    const en = await listen('en', REACTION_BATCH_MS + 300);
    const fr = await listen('fr', 0);
    for (const emoji of ['😂', '😂', '🔥']) expect((await react('en', emoji)).status).toBe(200);
    await react('en', '💀', { viewer: 2 });

    const reacts = (await en.done()).filter((e) => e.type === 'react');
    expect(reacts).toEqual([{ type: 'react', data: { '😂': 2, '🔥': 1, '💀': 1 } }]);
    expect((await fr.done()).filter((e) => e.type === 'react')).toEqual([]);
  });

  it('only takes the couch emojis', async () => {
    expect(await react('en', '🍆')).toMatchObject({ status: 400, body: { error: 'bad_reaction' } });
    expect(await react('en', 'hello')).toMatchObject({ status: 400 });
  });

  it('rate-limits each viewer', async () => {
    for (let i = 0; i < REACTION_MAX_PER_WINDOW; i++) expect((await react('en', '👏', { viewer: 7 })).status).toBe(200);
    expect(await react('en', '👏', { viewer: 7 })).toMatchObject({ status: 429, body: { error: 'rate_limited' } });
    expect((await react('en', '👏', { viewer: 8 })).status).toBe(200);
  });
});
