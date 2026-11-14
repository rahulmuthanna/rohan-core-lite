import { applyMigrations } from '../db/admin.js';
import { pool } from '../db/pool.js';

try {
  const { applied, skipped } = await applyMigrations(pool);
  for (const file of applied) console.log(`applied  ${file}`);
  console.log(`Migrations complete: ${applied.length} applied, ${skipped.length} already up to date.`);
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
