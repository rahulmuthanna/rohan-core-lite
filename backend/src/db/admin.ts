import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';

const DB_DIR = path.resolve(import.meta.dirname, '../../db');
const MIGRATIONS_DIR = path.join(DB_DIR, 'migrations');
const SEED_FILE = path.join(DB_DIR, 'seed', 'seed.sql');
const VERIFY_FILE = path.join(DB_DIR, 'verify', 'verify.sql');
const MIGRATION_FILE_PATTERN = /^\d{3}_[a-z0-9_]+\.sql$/;
const MIGRATION_LOCK_ID = 727001;

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export async function applyMigrations(pool: pg.Pool): Promise<MigrationResult> {
  const client = await pool.connect();
  const result: MigrationResult = { applied: [], skipped: [] };
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         filename   text        PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    const done = new Set<string>(
      (await client.query<{ filename: string }>('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename),
    );
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => MIGRATION_FILE_PATTERN.test(f)).sort();
    for (const file of files) {
      if (done.has(file)) {
        result.skipped.push(file);
        continue;
      }
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        result.applied.push(file);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
      }
    }
    return result;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => undefined);
    client.release();
  }
}

export async function runSeed(pool: pg.Pool): Promise<void> {
  const sql = await readFile(SEED_FILE, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Seed failed: ${(error as Error).message}`);
  } finally {
    client.release();
  }
}

export async function resetDatabase(pool: pg.Pool, nodeEnv: string): Promise<void> {
  if (nodeEnv === 'production') {
    throw new Error('Refusing to reset the database when NODE_ENV is "production".');
  }
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await applyMigrations(pool);
  await runSeed(pool);
}

export async function runVerify(pool: pg.Pool, log: (line: string) => void): Promise<number> {
  const sql = await readFile(VERIFY_FILE, 'utf8');
  const client = await pool.connect();
  let passed = 0;
  const onNotice = (notice: { message?: string }): void => {
    const message = notice.message ?? '';
    if (message.startsWith('PASS')) passed += 1;
    log(message);
  };
  client.on('notice', onNotice);
  try {
    const existing = await client.query<{ count: number }>('SELECT count(*) AS count FROM customers');
    if ((existing.rows[0]?.count ?? 0) !== 0) {
      throw new Error('db:verify needs a fresh database. Run "npm run db:reset" first.');
    }
    await client.query('BEGIN');
    try {
      await client.query(sql);
    } finally {
      await client.query('ROLLBACK');
      await client.query(
        'ALTER SEQUENCE cost_sheet_number_seq RESTART; ALTER SEQUENCE quotation_number_seq RESTART; ALTER SEQUENCE booking_number_seq RESTART;',
      );
    }
    return passed;
  } finally {
    client.off('notice', onNotice);
    client.release();
  }
}
