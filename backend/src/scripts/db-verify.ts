import { runVerify } from '../db/admin.js';
import { pool } from '../db/pool.js';

try {
  const passed = await runVerify(pool, (line) => console.log(line));
  console.log(`Database verification complete: ${passed} checks passed.`);
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
