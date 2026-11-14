import { withTransaction } from '../../db/transaction.js';
import { stageLabel } from '../../shared/business-rules.js';
import { conflict, ErrorCode } from '../../shared/errors.js';
import { formatRupees } from '../../shared/money.js';
import { listMilestoneTotals, lockBooking } from '../bookings/bookings.repo.js';
import { bookingNotFound, loadBookingDetail, type BookingDetail } from '../bookings/bookings.service.js';
import { updateUnitStatus } from '../units/units.repo.js';
import * as paymentsRepo from './payments.repo.js';
import type { Payment } from './payments.repo.js';
import type { RecordPaymentInput } from './payments.schemas.js';

export interface RecordPaymentResult {
  payment: Payment;
  booking: BookingDetail;
}

/**
 * Rules P1 to P6. Everything below happens in ONE transaction.
 *
 * The salesperson records an amount against the booking. The payment goes to the
 * earliest milestone that still has a balance (milestones are paid in order 1, 2, 3, 4).
 * An amount larger than that milestone's balance is rejected, never spread over two milestones.
 *
 * The booking row is locked first, so two payments for one booking at the same moment
 * are handled one after the other and can never overpay together.
 */
export async function recordPayment(bookingId: number, input: RecordPaymentInput): Promise<RecordPaymentResult> {
  return withTransaction(async (tx) => {
    const booking = await lockBooking(tx, bookingId);
    if (!booking) {
      throw bookingNotFound();
    }

    // Find the milestone this payment belongs to.
    const milestones = await listMilestoneTotals(tx, bookingId);
    const current = milestones.find((milestone) => milestone.balance_paise > 0);
    if (!current) {
      throw conflict(ErrorCode.BOOKING_FULLY_PAID, 'This booking is fully paid. No further payment can be recorded.');
    }

    // Overpayment check, against the current milestone only.
    if (input.amount_paise > current.balance_paise) {
      const balance = formatRupees(current.balance_paise);
      throw conflict(
        ErrorCode.OVERPAYMENT,
        `The ${stageLabel(current.stage)} milestone has ${balance} remaining. Enter ${balance} or less.`,
        [{ field: 'amount_paise', message: `At most ${balance} can be recorded against this milestone.` }],
      );
    }

    // Duplicate reference check. The UNIQUE constraint payments_payment_reference_key is the safety net.
    if (await paymentsRepo.referenceExists(tx, input.payment_reference)) {
      throw conflict(ErrorCode.DUPLICATE_PAYMENT_REFERENCE, 'This payment reference has already been recorded.', [
        { field: 'payment_reference', message: 'This reference has already been used.' },
      ]);
    }

    const paymentId = await paymentsRepo.insertPayment(tx, {
      milestone_id: current.id,
      amount_paise: input.amount_paise,
      payment_date: input.payment_date,
      payment_reference: input.payment_reference,
    });

    // Rule P6: when nothing is left to pay on the whole booking, the unit becomes Sold.
    const outstandingBefore = milestones.reduce((sum, milestone) => sum + milestone.balance_paise, 0);
    if (outstandingBefore - input.amount_paise === 0) {
      await updateUnitStatus(tx, booking.unit_id, 'SOLD');
    }

    return {
      payment: (await paymentsRepo.findPaymentById(tx, paymentId)) as Payment,
      booking: (await loadBookingDetail(tx, bookingId)) as BookingDetail,
    };
  });
}
