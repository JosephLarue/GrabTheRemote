import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, vi } from 'vitest';
import { db } from '@/server/db/client';
import { invalidateBlocklists } from '@/server/moderation';
import { redis } from '@/server/redis';
import { CAPTCHA_OK, clearCookies, setTheme } from './helpers';
import { testUrls } from './urls';

// env() is read lazily, so this runs before any server module touches it. No YouTube key: no quota spent.
const { databaseUrl, redisUrl } = testUrls();
Object.assign(process.env, {
  DATABASE_URL: databaseUrl,
  REDIS_URL: redisUrl,
  YT_API_KEY: '',
  IP_HASH_SECRET: 'functional-tests-only-secret',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'test-site-key',
  TURNSTILE_SECRET: 'test-secret',
  ADMIN_PASSWORD: 'test-admin',
  ORIGIN_SECRET: '',
});

/** Turnstile passes for CAPTCHA_OK only, YouTube oEmbed knows no video. Anything else is a bug in the test. */
async function fakeFetch(input: string | URL | Request, init?: RequestInit) {
  const url = input instanceof Request ? input.url : String(input);
  if (url.startsWith('https://challenges.cloudflare.com/')) {
    const token = new URLSearchParams(init?.body as URLSearchParams).get('response');
    return Response.json({ success: token === CAPTCHA_OK });
  }
  if (url.startsWith('https://www.youtube.com/oembed')) return new Response('Not Found', { status: 404 });
  throw new Error(`Unexpected network call in a functional test: ${url}`);
}

beforeEach(async () => {
  vi.stubGlobal('fetch', fakeFetch);
  await redis().flushdb();
  await db().execute(
    sql`truncate plays, videos, banned_channels, blocked_keywords, theme_slots restart identity cascade`,
  );
  invalidateBlocklists();
  clearCookies();
  // Themes are random; tests that need one set it explicitly.
  await setTheme(null);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  const g = globalThis as unknown as { __redis?: unknown; __db?: unknown };
  await redis().quit();
  await db().$client.end();
  delete g.__redis;
  delete g.__db;
});
