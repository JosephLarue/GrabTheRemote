import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { TICKER_STALE_MS } from '@/config/app';
import { db } from '@/server/db/client';
import { tickerStatus } from '@/server/engine';
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

/**
 * Used by Railway/Fly to restart the app when Postgres or Redis is unreachable, or when this process's
 * ticker stopped ticking (event loop wedged). Exempt from the origin lock. `ticker` is 'off' when the ticker
 * was never started here (DISABLE_TICKER, or a process that only serves requests).
 */
export async function GET() {
  const [postgres, redisOk] = await Promise.all([
    check(() => db().execute(sql`select 1`)),
    check(() => redis().ping()),
  ]);
  const { started, lastTickAt } = tickerStatus();
  const ticker = !started ? 'off' : Date.now() - lastTickAt > TICKER_STALE_MS ? 'stale' : 'ok';
  const ok = postgres && redisOk && ticker !== 'stale';
  return NextResponse.json(
    { ok, postgres, redis: redisOk, ticker },
    { status: ok ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
