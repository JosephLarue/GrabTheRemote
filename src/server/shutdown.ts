import 'server-only';

const g = globalThis as unknown as { __shutdownHooked?: boolean };

const SHUTDOWN_TIMEOUT_MS = 8000;

/**
 * SIGTERM (Railway redeploy) / SIGINT (ctrl-c): stop ticking, let in-flight room ticks finish, then close
 * Redis and Postgres cleanly so no play is left half-written and no lock lingers. Registered once per process.
 */
export function hookShutdown(close: { stopTicker: () => Promise<void>; closeRedis: () => Promise<void>; closeDb: () => Promise<void> }) {
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
