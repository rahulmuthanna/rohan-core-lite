import { limitAndOffset, type Db } from '../../db/transaction.js';
import type { MilestoneStage, UnitStatus, UnitType } from '../../shared/business-rules.js';
import type { MilestoneAmount } from '../../shared/money.js';

export interface Booking {
  id: number;
  booking_number: string;
  booked_at: Date;
  quotation_id: number;
  quotation_number: string;
  cost_sheet_number: string;
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
  listed_price_paise: number;
  discount_bps: number;
  discount_amount_paise: number;
  /** The accepted quoted price the milestones were created from. */
  final_price_paise: number;
  /** Worked out from payments every time, never stored. */
  collected_paise: number;
  outstanding_paise: number;
}

/** One milestone with its totals, straight from the database. */
export interface MilestoneTotals {
  id: number;
  sequence_no: number;
  stage: MilestoneStage;
  percent: number;
  amount_due_paise: number;
  collected_paise: number;
  balance_paise: number;
}

// SUM() over a bigint returns numeric, so every sum is cast back to bigint.
const SELECT_BOOKING = `
  SELECT b.id, b.booking_number, b.booked_at,
         q.id AS quotation_id, q.quotation_number, cs.cost_sheet_number,
         u.id AS unit_id, u.unit_code, u.unit_type, u.area_sqft, u.status AS unit_status,
         p.id AS project_id, p.name AS project_name,
         c.id AS customer_id, c.full_name AS customer_name, c.mobile AS customer_mobile, c.email AS customer_email,
         cs.listed_price_paise, cs.discount_bps, cs.discount_amount_paise, cs.final_price_paise,
         COALESCE(paid.collected_paise, 0)::bigint AS collected_paise,
         (cs.final_price_paise - COALESCE(paid.collected_paise, 0))::bigint AS outstanding_paise
  FROM bookings b
  JOIN quotations q ON q.id = b.quotation_id
  JOIN cost_sheets cs ON cs.id = q.cost_sheet_id
  JOIN units u ON u.id = b.unit_id
  JOIN projects p ON p.id = u.project_id
  JOIN customers c ON c.id = cs.customer_id
  LEFT JOIN (
    SELECT m.booking_id, SUM(pay.amount_paise) AS collected_paise
    FROM payment_milestones m
    JOIN payments pay ON pay.milestone_id = m.id
    GROUP BY m.booking_id
  ) AS paid ON paid.booking_id = b.id`;

export async function listBookings(
  db: Db,
  customerId: number | undefined,
  page: number,
  pageSize: number,
): Promise<{ rows: Booking[]; total: number }> {
  const values: unknown[] = [];
  let where = '';
  if (customerId !== undefined) {
    values.push(customerId);
    where = 'WHERE cs.customer_id = $1';
  }
  const count = await db.query<{ total: number }>(
    `SELECT count(*) AS total
     FROM bookings b
     JOIN quotations q ON q.id = b.quotation_id
     JOIN cost_sheets cs ON cs.id = q.cost_sheet_id
     ${where}`,
    values,
  );
  const { limit, offset } = limitAndOffset(page, pageSize);
  const rows = await db.query<Booking>(
    `${SELECT_BOOKING} ${where}
     ORDER BY b.booked_at DESC, b.id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

export async function findBookingById(db: Db, id: number): Promise<Booking | undefined> {
  const result = await db.query<Booking>(`${SELECT_BOOKING} WHERE b.id = $1`, [id]);
  return result.rows[0];
}

export async function findBookingIdByQuotation(db: Db, quotationId: number): Promise<number | undefined> {
  const result = await db.query<{ id: number }>('SELECT id FROM bookings WHERE quotation_id = $1', [quotationId]);
  return result.rows[0]?.id;
}

/**
 * Locks one booking row until the transaction ends, so that two payments for the
 * same booking are handled one after the other. Returns the unit id, or undefined
 * when the booking does not exist.
 */
export async function lockBooking(tx: Db, id: number): Promise<{ id: number; unit_id: number } | undefined> {
  const result = await tx.query<{ id: number; unit_id: number }>(
    'SELECT id, unit_id FROM bookings WHERE id = $1 FOR UPDATE',
    [id],
  );
  return result.rows[0];
}

/** The database fills in the booking number and booked_at. */
export async function insertBooking(tx: Db, quotationId: number, unitId: number): Promise<number> {
  const result = await tx.query<{ id: number }>(
    'INSERT INTO bookings (quotation_id, unit_id) VALUES ($1, $2) RETURNING id',
    [quotationId, unitId],
  );
  return (result.rows[0] as { id: number }).id;
}

export async function insertMilestones(tx: Db, bookingId: number, milestones: MilestoneAmount[]): Promise<void> {
  for (const milestone of milestones) {
    await tx.query(
      `INSERT INTO payment_milestones (booking_id, sequence_no, stage, percent, amount_due_paise)
       VALUES ($1, $2, $3, $4, $5)`,
      [bookingId, milestone.sequence_no, milestone.stage, milestone.percent, milestone.amount_due_paise],
    );
  }
}

/** The four milestones of a booking in payment order, each with what has been collected and what is left. */
export async function listMilestoneTotals(db: Db, bookingId: number): Promise<MilestoneTotals[]> {
  const result = await db.query<MilestoneTotals>(
    `SELECT m.id, m.sequence_no, m.stage, m.percent, m.amount_due_paise,
            COALESCE(SUM(pay.amount_paise), 0)::bigint AS collected_paise,
            (m.amount_due_paise - COALESCE(SUM(pay.amount_paise), 0))::bigint AS balance_paise
     FROM payment_milestones m
     LEFT JOIN payments pay ON pay.milestone_id = m.id
     WHERE m.booking_id = $1
     GROUP BY m.id
     ORDER BY m.sequence_no`,
    [bookingId],
  );
  return result.rows;
}
