import { env } from '../config/env.js';
import { resetDatabase } from '../db/admin.js';
import { pool } from '../db/pool.js';

try {
  await resetDatabase(pool, env.NODE_ENV);
  console.log('Database reset complete: schema rebuilt, migrations applied, seed loaded.');
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
