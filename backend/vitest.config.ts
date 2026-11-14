import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Creates (if needed) and rebuilds the separate test database once, before any test runs.
    globalSetup: ['./tests/helpers/global-setup.ts'],
    // Wipes the data before every single test, so tests never depend on each other.
    setupFiles: ['./tests/helpers/setup.ts'],
    // All test files share one database, so they run one file at a time.
    fileParallelism: false,
    // Makes src/config/env.ts choose TEST_DATABASE_URL.
    env: { NODE_ENV: 'test' },
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
