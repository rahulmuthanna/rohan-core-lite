import { limitAndOffset, type Db } from '../../db/transaction.js';
import type { UnitStatus, UnitType } from '../../shared/business-rules.js';

export interface Unit {
  id: number;
  unit_code: string;
  unit_type: UnitType;
  area_sqft: number;
  listed_price_paise: number;
  status: UnitStatus;
  project_id: number;
  project_name: string;
  updated_at: Date;
}

export interface UnitFilters {
  project_id?: number | undefined;
  unit_type?: UnitType | undefined;
  status?: UnitStatus | undefined;
}

const SELECT_UNIT = `
  SELECT u.id, u.unit_code, u.unit_type, u.area_sqft, u.listed_price_paise, u.status,
         u.project_id, p.name AS project_name, u.updated_at
  FROM units u
  JOIN projects p ON p.id = u.project_id`;

export async function listUnits(
  db: Db,
  filters: UnitFilters,
  page: number,
  pageSize: number,
): Promise<{ rows: Unit[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (filters.project_id !== undefined) {
    values.push(filters.project_id);
    conditions.push(`u.project_id = $${values.length}`);
  }
  if (filters.unit_type !== undefined) {
    values.push(filters.unit_type);
    conditions.push(`u.unit_type = $${values.length}`);
  }
  if (filters.status !== undefined) {
    values.push(filters.status);
    conditions.push(`u.status = $${values.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const count = await db.query<{ total: number }>(`SELECT count(*) AS total FROM units u ${where}`, values);
  const { limit, offset } = limitAndOffset(page, pageSize);
  const rows = await db.query<Unit>(
    `${SELECT_UNIT} ${where} ORDER BY p.name, u.unit_code LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

export async function findUnitById(db: Db, id: number): Promise<Unit | undefined> {
  const result = await db.query<Unit>(`${SELECT_UNIT} WHERE u.id = $1`, [id]);
  return result.rows[0];
}

export interface LockedUnit {
  id: number;
  unit_code: string;
  status: UnitStatus;
  listed_price_paise: number;
}

/**
 * Reads a unit and locks its row until the transaction ends.
 * Any other transaction that wants the same unit has to wait, which is what
 * stops two people booking or re-pricing one unit at the same moment.
 */
export async function lockUnit(tx: Db, id: number): Promise<LockedUnit | undefined> {
  const result = await tx.query<LockedUnit>(
    'SELECT id, unit_code, status, listed_price_paise FROM units WHERE id = $1 FOR UPDATE',
    [id],
  );
  return result.rows[0];
}

export async function updateUnitPrice(tx: Db, id: number, listedPricePaise: number): Promise<void> {
  await tx.query('UPDATE units SET listed_price_paise = $2 WHERE id = $1', [id, listedPricePaise]);
}

export async function updateUnitStatus(tx: Db, id: number, status: UnitStatus): Promise<void> {
  await tx.query('UPDATE units SET status = $2 WHERE id = $1', [id, status]);
}
