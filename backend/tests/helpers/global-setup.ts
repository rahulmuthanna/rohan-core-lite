import 'dotenv/config';
import pg from 'pg';
import { resetDatabase } from '../../src/db/admin.js';

/**
 * Runs once before the whole test run.
 * Creates the test database if it does not exist yet, then rebuilds its schema and seed data.
 */
export default async function globalSetup(): Promise<void> {
  const mainUrl = process.env.DATABASE_URL;
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!mainUrl || !testUrl) {
    throw new Error('DATABASE_URL and TEST_DATABASE_URL must both be set in backend/.env to run the tests.');
  }
  if (mainUrl === testUrl) {
    throw new Error('TEST_DATABASE_URL must be different from DATABASE_URL: tests wipe their database.');
  }

  const testDatabaseName = decodeURIComponent(new URL(testUrl).pathname.slice(1));
  if (!/^[a-z0-9_]+$/.test(testDatabaseName)) {
    throw new Error('The test database name may contain only lowercase letters, digits and underscores.');
  }

  const main = new pg.Client({ connectionString: mainUrl });
  await main.connect();
  try {
    const existing = await main.query('SELECT 1 FROM pg_database WHERE datname = $1', [testDatabaseName]);
    if (existing.rows.length === 0) {
      await main.query(`CREATE DATABASE "${testDatabaseName}"`);
    }
  } finally {
    await main.end();
  }

  const testPool = new pg.Pool({ connectionString: testUrl });
  try {
    await resetDatabase(testPool, 'test');
  } finally {
    await testPool.end();
  }
}
