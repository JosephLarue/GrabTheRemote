export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.DISABLE_TICKER !== '1') {
    const { startTicker } = await import('./server/engine');
    startTicker();
  }
}
