export async function register() {
  // One `if` on NEXT_RUNTIME around every import: the bundler drops the whole branch from the edge build (an early
  // return would not, and ioredis/postgres/process.* cannot be used there). The shutdown hook lives in its own
  // module for the same reason: process.once/exit at this file's top level would be compiled for the edge too.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const [{ env }, { startTicker, stopTicker }, { closeRedis }, { closeDb }, { hookShutdown }] = await Promise.all([
      import('./server/env'),
      import('./server/engine'),
      import('./server/redis'),
      import('./server/db/client'),
      import('./server/shutdown'),
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
