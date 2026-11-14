import { limitAndOffset, type Db } from '../../db/transaction.js';
import type { UnitStatus, UnitType } from '../../shared/business-rules.js';

export interface CostSheet {
  id: number;
  cost_sheet_number: string;
  created_at: Date;
  // The frozen money, exactly as saved.
  listed_price_paise: number;
  discount_bps: number;
  discount_amount_paise: number;
  final_price_paise: number;
  // The unit as it is today.
  unit_id: number;
  unit_code: string;
  unit_type: UnitType;
  area_sqft: number;
  unit_status: UnitStatus;
  current_listed_price_paise: number;
  /** True when the unit's price today differs from the price frozen on this cost sheet. */
  price_changed: boolean;
  /** Today's unit price minus the frozen price. Zero when nothing changed. */
  price_difference_paise: number;
  project_id: number;
  project_name: string;
  customer_id: number;
  customer_name: string;
  customer_mobile: string;
  customer_email: string;
  quotation_count: number;
}

export interface CostSheetFilters {
  customer_id?: number | undefined;
  unit_id?: number | undefined;
}

const SELECT_COST_SHEET = `
  SELECT cs.id, cs.cost_sheet_number, cs.created_at,
         cs.listed_price_paise, cs.discount_bps, cs.discount_amount_paise, cs.final_price_paise,
         u.id AS unit_id, u.unit_code, u.unit_type, u.area_sqft, u.status AS unit_status,
         u.listed_price_paise AS current_listed_price_paise,
         (u.listed_price_paise <> cs.listed_price_paise) AS price_changed,
         (u.listed_price_paise - cs.listed_price_paise) AS price_difference_paise,
         p.id AS project_id, p.name AS project_name,
         c.id AS customer_id, c.full_name AS customer_name, c.mobile AS customer_mobile, c.email AS customer_email,
         (SELECT count(*) FROM quotations q WHERE q.cost_sheet_id = cs.id) AS quotation_count
  FROM cost_sheets cs
  JOIN units u ON u.id = cs.unit_id
  JOIN projects p ON p.id = u.project_id
  JOIN customers c ON c.id = cs.customer_id`;

export async function listCostSheets(
  db: Db,
  filters: CostSheetFilters,
  page: number,
  pageSize: number,
): Promise<{ rows: CostSheet[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (filters.customer_id !== undefined) {
    values.push(filters.customer_id);
    conditions.push(`cs.customer_id = $${values.length}`);
  }
  if (filters.unit_id !== undefined) {
    values.push(filters.unit_id);
    conditions.push(`cs.unit_id = $${values.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const count = await db.query<{ total: number }>(`SELECT count(*) AS total FROM cost_sheets cs ${where}`, values);
  const { limit, offset } = limitAndOffset(page, pageSize);
  const rows = await db.query<CostSheet>(
    `${SELECT_COST_SHEET} ${where}
     ORDER BY cs.created_at DESC, cs.id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

export async function findCostSheetById(db: Db, id: number): Promise<CostSheet | undefined> {
  const result = await db.query<CostSheet>(`${SELECT_COST_SHEET} WHERE cs.id = $1`, [id]);
  return result.rows[0];
}

export async function insertCostSheet(
  tx: Db,
  input: {
    unit_id: number;
    customer_id: number;
    listed_price_paise: number;
    discount_bps: number;
    discount_amount_paise: number;
    final_price_paise: number;
  },
): Promise<number> {
  const result = await tx.query<{ id: number }>(
    `INSERT INTO cost_sheets
       (unit_id, customer_id, listed_price_paise, discount_bps, discount_amount_paise, final_price_paise)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      input.unit_id,
      input.customer_id,
      input.listed_price_paise,
      input.discount_bps,
      input.discount_amount_paise,
      input.final_price_paise,
    ],
  );
  return (result.rows[0] as { id: number }).id;
}

export async function deleteCostSheet(tx: Db, id: number): Promise<void> {
  await tx.query('DELETE FROM cost_sheets WHERE id = $1', [id]);
}
