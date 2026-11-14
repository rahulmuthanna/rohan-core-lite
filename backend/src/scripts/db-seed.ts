import { runSeed } from '../db/admin.js';
import { pool } from '../db/pool.js';

try {
  await runSeed(pool);
  const counts = await pool.query<{ projects: number; units: number }>(
    'SELECT (SELECT count(*) FROM projects) AS projects, (SELECT count(*) FROM units) AS units',
  );
  console.log(`Seed complete: ${counts.rows[0]?.projects} projects, ${counts.rows[0]?.units} units.`);
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
