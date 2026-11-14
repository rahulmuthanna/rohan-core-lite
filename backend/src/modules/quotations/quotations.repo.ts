import { limitAndOffset, type Db } from '../../db/transaction.js';
import {
  SQL_TODAY_IN_INDIA,
  type QuotationStatus,
  type StoredQuotationStatus,
  type UnitStatus,
  type UnitType,
} from '../../shared/business-rules.js';

export interface Quotation {
  id: number;
  quotation_number: string;
  /** DRAFT, SENT, ACCEPTED, or EXPIRED. EXPIRED is worked out here, never stored. */
  status: QuotationStatus;
  issue_date: string;
  valid_until: string;
  created_at: Date;
  updated_at: Date;
  // Money, unit and customer are read from the cost sheet the quotation was created from.
  cost_sheet_id: number;
  cost_sheet_number: string;
  listed_price_paise: number;
  discount_bps: number;
  discount_amount_paise: number;
  final_price_paise: number;
  unit_id: number;
  unit_code: string;
  unit_type: UnitType;
  area_sqft: number;
  unit_status: UnitStatus;
  project_id: number;
  project_name: string;
  customer_id: number;
  customer_name: string;
  customer_mobile: string;
  customer_email: string;
  /** Set once this quotation has been used for a booking. */
  booking_id: number | null;
  booking_number: string | null;
}

export interface QuotationFilters {
  status?: QuotationStatus | undefined;
  customer_id?: number | undefined;
  unit_id?: number | undefined;
  cost_sheet_id?: number | undefined;
}

/**
 * THE expiry rule (Q6), in one place:
 * a quotation shows as EXPIRED when today's date in India is after valid_until
 * and it has not been used for a booking. A booked quotation never expires.
 */
const SELECT_QUOTATION = `
  SELECT q.id, q.quotation_number,
         CASE
           WHEN b.id IS NULL AND ${SQL_TODAY_IN_INDIA} > q.valid_until THEN 'EXPIRED'
           ELSE q.status
         END AS status,
         q.issue_date, q.valid_until, q.created_at, q.updated_at,
         cs.id AS cost_sheet_id, cs.cost_sheet_number,
         cs.listed_price_paise, cs.discount_bps, cs.discount_amount_paise, cs.final_price_paise,
         u.id AS unit_id, u.unit_code, u.unit_type, u.area_sqft, u.status AS unit_status,
         p.id AS project_id, p.name AS project_name,
         c.id AS customer_id, c.full_name AS customer_name, c.mobile AS customer_mobile, c.email AS customer_email,
         b.id AS booking_id, b.booking_number
  FROM quotations q
  JOIN cost_sheets cs ON cs.id = q.cost_sheet_id
  JOIN units u ON u.id = cs.unit_id
  JOIN projects p ON p.id = u.project_id
  JOIN customers c ON c.id = cs.customer_id
  LEFT JOIN bookings b ON b.quotation_id = q.id`;

export async function listQuotations(
  db: Db,
  filters: QuotationFilters,
  page: number,
  pageSize: number,
): Promise<{ rows: Quotation[]; total: number }> {
  // The filters run on the result of SELECT_QUOTATION so that "status" means the
  // status the user sees, including EXPIRED.
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (filters.status !== undefined) {
    values.push(filters.status);
    conditions.push(`t.status = $${values.length}`);
  }
  if (filters.customer_id !== undefined) {
    values.push(filters.customer_id);
    conditions.push(`t.customer_id = $${values.length}`);
  }
  if (filters.unit_id !== undefined) {
    values.push(filters.unit_id);
    conditions.push(`t.unit_id = $${values.length}`);
  }
  if (filters.cost_sheet_id !== undefined) {
    values.push(filters.cost_sheet_id);
    conditions.push(`t.cost_sheet_id = $${values.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const count = await db.query<{ total: number }>(
    `SELECT count(*) AS total FROM (${SELECT_QUOTATION}) AS t ${where}`,
    values,
  );
  const { limit, offset } = limitAndOffset(page, pageSize);
  const rows = await db.query<Quotation>(
    `SELECT t.* FROM (${SELECT_QUOTATION}) AS t ${where}
     ORDER BY t.created_at DESC, t.id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

export async function findQuotationById(db: Db, id: number): Promise<Quotation | undefined> {
  const result = await db.query<Quotation>(`${SELECT_QUOTATION} WHERE q.id = $1`, [id]);
  return result.rows[0];
}

/** Locks one quotation row until the transaction ends. Returns false when it does not exist. */
export async function lockQuotation(tx: Db, id: number): Promise<boolean> {
  const result = await tx.query('SELECT id FROM quotations WHERE id = $1 FOR UPDATE', [id]);
  return result.rows.length > 0;
}

/** The database fills in the number, DRAFT status, issue date and valid_until (issue date + 7 days). */
export async function insertQuotation(tx: Db, costSheetId: number): Promise<number> {
  const result = await tx.query<{ id: number }>(
    'INSERT INTO quotations (cost_sheet_id) VALUES ($1) RETURNING id',
    [costSheetId],
  );
  return (result.rows[0] as { id: number }).id;
}

export async function updateQuotationStatus(tx: Db, id: number, status: StoredQuotationStatus): Promise<void> {
  await tx.query('UPDATE quotations SET status = $2 WHERE id = $1', [id, status]);
}
