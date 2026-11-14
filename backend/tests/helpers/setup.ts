import { afterAll, beforeEach } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { resetData } from './test-helpers.js';

// Every test starts from the same state: the 12 seeded units and nothing else.
beforeEach(async () => {
  await resetData();
});

afterAll(async () => {
  await pool.end();
});
