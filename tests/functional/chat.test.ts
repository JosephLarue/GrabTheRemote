import { describe, expect, it } from 'vitest';
import { CHAT_HISTORY } from '@/config/app';
import { chatName } from '@/lib/chat';
import type { LiveEvent } from '@/lib/types';
import { db, schema } from '@/server/db/client';
import { bus } from '@/server/state';
import { defaultInput } from '@/lib/private-room';
import { chat, chatHistory, createRoom, joinRoom } from './helpers';

describe('POST /api/chat', () => {
  it('sends the line to the room only, under the nickname the seed makes', async () => {
    const en: LiveEvent[] = [];
    const fr: LiveEvent[] = [];
    const onEn = (m: string) => en.push(JSON.parse(m));
    const onFr = (m: string) => fr.push(JSON.parse(m));
    bus().on('en', onEn);
    bus().on('fr', onFr);
    await new Promise((r) => setTimeout(r, 100)); // let the subscription settle

    const res = await chat('en', '  hello   couch  ', { seed: 'my-seed-123' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatchObject({ text: 'hello couch', ...chatName('my-seed-123') });
    await new Promise((r) => setTimeout(r, 100));
    bus().off('en', onEn);
    bus().off('fr', onFr);

    expect(en.filter((e) => e.type === 'chat')).toEqual([{ type: 'chat', data: res.body.message }]);
    expect(fr.filter((e) => e.type === 'chat')).toEqual([]);
  });

  it('keeps the last lines, oldest first, for whoever sits down next', async () => {
    for (let i = 0; i < CHAT_HISTORY + 3; i++) await chat('en', `line ${i}`, { viewer: 10 + (i % 50) });
    const { body } = await chatHistory('en');
    expect(body.messages).toHaveLength(CHAT_HISTORY);
    expect(body.messages[0].text).toBe('line 3');
    expect(body.messages.at(-1)!.text).toBe(`line ${CHAT_HISTORY + 2}`);
    expect((await chatHistory('fr')).body.messages).toEqual([]);
  });

  it('refuses empty lines, missing seeds, links and blocked keywords', async () => {
    expect(await chat('en', '   ')).toMatchObject({ status: 400, body: { error: 'bad_chat' } });
    expect(await chat('en', 42)).toMatchObject({ status: 400, body: { error: 'bad_chat' } });
    expect(await chat('en', 'x'.repeat(1000))).toMatchObject({ status: 400, body: { error: 'bad_chat' } });
    expect(await chat('en', 'hi', { seed: 'no' })).toMatchObject({ status: 400, body: { error: 'bad_seed' } });
    expect(await chat('en', 'hi', { seed: null })).toMatchObject({ status: 400, body: { error: 'bad_seed' } });
    // Refusals count against the rate limit too, so a second viewer tries the rest.
    expect(await chat('en', 'check spam.com', { viewer: 2 })).toMatchObject({ status: 422, body: { error: 'chat_link' } });
    await db().insert(schema.blockedKeywords).values({ keyword: 'spoiler' });
    expect(await chat('en', 'SPOILER: he dies', { viewer: 2 })).toMatchObject({ status: 422, body: { error: 'chat_blocked' } });
    expect((await chatHistory('en')).body.messages).toEqual([]);
  });

  it('rate-limits each viewer', async () => {
    for (let i = 0; i < 5; i++) expect((await chat('en', 'spam', { viewer: 7 })).status).toBe(200);
    expect(await chat('en', 'spam', { viewer: 7 })).toMatchObject({ status: 429, body: { error: 'rate_limited' } });
    expect((await chat('en', 'hi', { viewer: 8 })).status).toBe(200);
  });

  it("keeps a private room's chat behind its password", async () => {
    const { body } = await createRoom({ ...defaultInput('en'), name: 'Chez Zerator' }, { viewer: 1 });
    expect(await chat(body.id, 'let me in', { viewer: 2 })).toMatchObject({ status: 403, body: { error: 'locked' } });
    expect(await chatHistory(body.id, 2)).toMatchObject({ status: 403 });
    await joinRoom(body.id, body.password, { viewer: 2 });
    expect((await chat(body.id, 'hi streamer', { viewer: 2 })).status).toBe(200);
    expect((await chatHistory(body.id, 1)).body.messages.map((m) => m.text)).toEqual(['hi streamer']);
  });
});
