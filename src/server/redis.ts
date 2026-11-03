import 'server-only';
import { Redis } from 'ioredis';
import { env } from './env';

const g = globalThis as unknown as { __redis?: Redis; __redisSub?: Redis };

// Commands. Survives Next.js dev hot reloads via globalThis.
export function redis() {
  g.__redis ??= new Redis(env().REDIS_URL, { maxRetriesPerRequest: 3 });
  return g.__redis;
}

// Dedicated connection for SUBSCRIBE (a subscribed connection can't run other commands).
export function redisSub() {
  g.__redisSub ??= new Redis(env().REDIS_URL);
  return g.__redisSub;
}

const DEL_IF_LUA = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
const PEXPIRE_IF_LUA = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end`;

/** Deletes `key` only if it still holds `value` (atomic). True when it did. */
export async function delIfEquals(key: string, value: string) {
  return (await redis().eval(DEL_IF_LUA, 1, key, value)) === 1;
}

/** Extends `key` by `ttlMs` only if it still holds `value` (atomic). True when it did. */
export async function pexpireIfEquals(key: string, value: string, ttlMs: number) {
  return (await redis().eval(PEXPIRE_IF_LUA, 1, key, value, ttlMs)) === 1;
}

/** Graceful shutdown: flushes pending commands, then closes both connections. */
export async function closeRedis() {
  const clients = [g.__redis, g.__redisSub].filter((c): c is Redis => Boolean(c));
  delete g.__redis;
  delete g.__redisSub;
  await Promise.all(clients.map((c) => c.quit().catch(() => c.disconnect())));
}
