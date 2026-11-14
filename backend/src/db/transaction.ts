import type pg from 'pg';
import { pool } from './pool.js';

/**
 * Anything that can run SQL: the shared pool, or the single connection of a transaction.
 * Every repo function takes a Db, so the same function works inside and outside a transaction.
 */
export interface Db {
  query<Row extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<pg.QueryResult<Row>>;
}

/**
 * Runs `work` inside one database transaction.
 * If `work` finishes, everything is saved together (COMMIT).
 * If `work` throws, nothing is saved (ROLLBACK) and the error continues upward.
 */
export async function withTransaction<Result>(work: (tx: Db) => Promise<Result>): Promise<Result> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Turns a page number and page size into the LIMIT and OFFSET for a list query. */
export function limitAndOffset(page: number, pageSize: number): { limit: number; offset: number } {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}
