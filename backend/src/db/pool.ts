import pg from 'pg';
import { env } from '../config/env.js';

// BIGINT (money in paise, ids, counts) -> JavaScript number. Fails loudly if it would lose precision.
pg.types.setTypeParser(pg.types.builtins.INT8, (value: string): number => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`BIGINT value ${value} is outside the safe integer range`);
  }
  return parsed;
});

// DATE -> plain 'YYYY-MM-DD' string. Never a JavaScript Date, which would shift by time zone.
pg.types.setTypeParser(pg.types.builtins.DATE, (value: string): string => value);

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
