import type { Db } from '../../db/transaction.js';
import type { MilestoneStage } from '../../shared/business-rules.js';

export interface Payment {
  id: number;
  milestone_id: number;
  sequence_no: number;
  stage: MilestoneStage;
  amount_paise: number;
  payment_date: string;
  payment_reference: string;
  created_at: Date;
}

const SELECT_PAYMENT = `
  SELECT pay.id, pay.milestone_id, m.sequence_no, m.stage,
         pay.amount_paise, pay.payment_date, pay.payment_reference, pay.created_at
  FROM payments pay
  JOIN payment_milestones m ON m.id = pay.milestone_id`;

/** Payment history of one booking, newest first. */
export async function listPaymentsForBooking(db: Db, bookingId: number): Promise<Payment[]> {
  const result = await db.query<Payment>(`${SELECT_PAYMENT} WHERE m.booking_id = $1 ORDER BY pay.id DESC`, [
    bookingId,
  ]);
  return result.rows;
}

export async function findPaymentById(db: Db, id: number): Promise<Payment | undefined> {
  const result = await db.query<Payment>(`${SELECT_PAYMENT} WHERE pay.id = $1`, [id]);
  return result.rows[0];
}

export async function referenceExists(db: Db, paymentReference: string): Promise<boolean> {
  const result = await db.query('SELECT 1 FROM payments WHERE payment_reference = $1', [paymentReference]);
  return result.rows.length > 0;
}

export async function insertPayment(
  tx: Db,
  input: { milestone_id: number; amount_paise: number; payment_date: string; payment_reference: string },
): Promise<number> {
  const result = await tx.query<{ id: number }>(
    `INSERT INTO payments (milestone_id, amount_paise, payment_date, payment_reference)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [input.milestone_id, input.amount_paise, input.payment_date, input.payment_reference],
  );
  return (result.rows[0] as { id: number }).id;
}
