import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/server/db/client';
import { redis } from '@/server/redis';

export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 3000;

/** Resolves true if the check passes within TIMEOUT_MS. A hung connection counts as down. */
async function check(fn: () => Promise<unknown>): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS);
  });
  try {
    await Promise.race([fn(), timeout]);
    return true;
  } catch (e) {
    console.error('[health]', e);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Used by Railway/Fly to restart the app when Postgres or Redis is unreachable. Exempt from the origin lock. */
export async function GET() {
  const [postgres, redisOk] = await Promise.all([
    check(() => db().execute(sql`select 1`)),
    check(() => redis().ping()),
  ]);
  const ok = postgres && redisOk;
  return NextResponse.json(
    { ok, postgres, redis: redisOk },
    { status: ok ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
