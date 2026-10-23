import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Functional tests: route handlers and admin actions called in-process against a real Postgres and Redis.
export default defineConfig({
  resolve: {
    alias: {
      '@': path('./src'),
      // The real module throws outside a React Server Components build.
      'server-only': path('./node_modules/server-only/empty.js'),
    },
  },
  test: {
    include: ['tests/functional/**/*.test.ts'],
    globalSetup: ['tests/functional/global-setup.ts'],
    setupFiles: ['tests/functional/setup.ts'],
    // Every file shares one database and one Redis, wiped before each test.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
