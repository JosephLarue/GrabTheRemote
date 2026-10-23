// Defaults match docker-compose.yml. Every test wipes both, so refuse anything that looks like real data.
export function testUrls() {
  const databaseUrl = process.env.TEST_DATABASE_URL || 'postgres://gtr:gtr@localhost:5435/gtr_test';
  const redisUrl = process.env.TEST_REDIS_URL || 'redis://localhost:6380/15';
  if (!new URL(databaseUrl).pathname.endsWith('_test')) {
    throw new Error(`TEST_DATABASE_URL must point to a database whose name ends in _test (got ${databaseUrl})`);
  }
  const redisDb = new URL(redisUrl).pathname.slice(1);
  if (!/^\d+$/.test(redisDb) || redisDb === '0') {
    throw new Error(`TEST_REDIS_URL must select a Redis database other than 0, e.g. redis://host:6379/15 (got ${redisUrl})`);
  }
  return { databaseUrl, redisUrl };
}
