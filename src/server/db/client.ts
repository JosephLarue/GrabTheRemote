import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env';
import * as schema from './schema';

const g = globalThis as unknown as { __db?: ReturnType<typeof drizzle<typeof schema>> };

export function db() {
  g.__db ??= drizzle(postgres(env().DATABASE_URL, { max: 10 }), { schema });
  return g.__db;
}

export { schema };
