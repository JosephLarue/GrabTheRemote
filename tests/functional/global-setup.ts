import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { testUrls } from './urls';

/** Creates the test database if needed and applies drizzle/ migrations, once per run. */
export default async function setup() {
  const { databaseUrl } = testUrls();
  const name = new URL(databaseUrl).pathname.slice(1);

  const maintenance = new URL(databaseUrl);
  maintenance.pathname = '/postgres';
  const admin = postgres(maintenance.toString(), { max: 1, onnotice: () => {} });
  try {
    const [found] = await admin`select 1 from pg_database where datname = ${name}`;
    if (!found) await admin.unsafe(`create database "${name}"`);
  } finally {
    await admin.end();
  }

  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
  } finally {
    await client.end();
  }
}
