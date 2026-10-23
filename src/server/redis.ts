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

/** Deletes `key` only if it still holds `value` (atomic). True when it did. */
export async function delIfEquals(key: string, value: string) {
  return (await redis().eval(DEL_IF_LUA, 1, key, value)) === 1;
}
