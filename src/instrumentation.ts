const g = globalThis as unknown as { __shutdownHooked?: boolean };

const SHUTDOWN_TIMEOUT_MS = 8000;

/**
 * SIGTERM (Railway redeploy) / SIGINT (ctrl-c): stop ticking, let in-flight room ticks finish, then close
 * Redis and Postgres cleanly so no play is left half-written and no lock lingers. Registered once per process.
 */
function hookShutdown(close: { stopTicker: () => Promise<void>; closeRedis: () => Promise<void>; closeDb: () => Promise<void> }) {
  if (g.__shutdownHooked) return;
  g.__shutdownHooked = true;
  const { stopTicker, closeRedis, closeDb } = close;

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[shutdown] ${signal}: stopping`);
    // Whatever happens below, the process does not outlive the platform's patience.
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
    try {
      await stopTicker();
      await closeRedis();
      await closeDb();
      console.log('[shutdown] clean');
      process.exit(0);
    } catch (e) {
      console.error('[shutdown] failed', e);
      process.exit(1);
    }
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

export async function register() {
  // One `if` on NEXT_RUNTIME around every import: webpack drops the whole branch from the edge bundle (an early
  // return would not, and ioredis/postgres cannot be resolved there).
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const [{ env }, { startTicker, stopTicker }, { closeRedis }, { closeDb }] = await Promise.all([
      import('./server/env'),
      import('./server/engine'),
      import('./server/redis'),
      import('./server/db/client'),
    ]);

    // A bad environment fails the boot with the list of problems, instead of the first request that needs it.
    try {
      env();
    } catch (e) {
      console.error('[boot]', e instanceof Error ? e.message : e);
      throw e;
    }

    if (process.env.DISABLE_TICKER !== '1') startTicker();
    hookShutdown({ stopTicker, closeRedis, closeDb });
  }
}
