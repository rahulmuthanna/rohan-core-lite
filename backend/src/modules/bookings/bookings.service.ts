import { pool } from '../../db/pool.js';
import { withTransaction, type Db } from '../../db/transaction.js';
import { conflict, ErrorCode, notFound } from '../../shared/errors.js';
import { splitIntoMilestones } from '../../shared/money.js';
import type { Pagination } from '../../shared/validation.js';
import { listPaymentsForBooking, type Payment } from '../payments/payments.repo.js';
import { findQuotationById, lockQuotation, type Quotation } from '../quotations/quotations.repo.js';
import { quotationExpired, quotationNotFound } from '../quotations/quotations.service.js';
import { lockUnit, updateUnitStatus } from '../units/units.repo.js';
import { ensureUnitIsAvailable, unitNotFound } from '../units/units.service.js';
import * as bookingsRepo from './bookings.repo.js';
import type { Booking, MilestoneTotals } from './bookings.repo.js';
import type { CreateBookingInput, ListBookingsQuery } from './bookings.schemas.js';

export type MilestoneState = 'PENDING' | 'PARTLY_PAID' | 'PAID';

export interface MilestoneView extends MilestoneTotals {
  state: MilestoneState;
  /** True for the one milestone that the next payment will go to. */
  is_current: boolean;
}

export interface BookingDetail extends Booking {
  milestones: MilestoneView[];
  payments: Payment[];
}

export function bookingNotFound(): Error {
  return notFound(ErrorCode.BOOKING_NOT_FOUND, 'Booking not found.');
}

function milestoneState(milestone: MilestoneTotals): MilestoneState {
  if (milestone.balance_paise === 0) {
    return 'PAID';
  }
  return milestone.collected_paise === 0 ? 'PENDING' : 'PARTLY_PAID';
}

/** Adds the state of each milestone and marks the earliest one that still has a balance. */
export function describeMilestones(milestones: MilestoneTotals[]): MilestoneView[] {
  const current = milestones.find((milestone) => milestone.balance_paise > 0);
  return milestones.map((milestone) => ({
    ...milestone,
    state: milestoneState(milestone),
    is_current: milestone.id === current?.id,
  }));
}

/** A booking with its four milestones and its payment history. */
export async function loadBookingDetail(db: Db, id: number): Promise<BookingDetail | undefined> {
  const booking = await bookingsRepo.findBookingById(db, id);
  if (!booking) {
    return undefined;
  }
  const milestones = await bookingsRepo.listMilestoneTotals(db, id);
  const payments = await listPaymentsForBooking(db, id);
  return { ...booking, milestones: describeMilestones(milestones), payments };
}

export async function listBookings(query: ListBookingsQuery): Promise<{ data: Booking[]; pagination: Pagination }> {
  const { rows, total } = await bookingsRepo.listBookings(pool, query.customer_id, query.page, query.page_size);
  return { data: rows, pagination: { page: query.page, page_size: query.page_size, total } };
}

export async function getBooking(id: number): Promise<BookingDetail> {
  const booking = await loadBookingDetail(pool, id);
  if (!booking) {
    throw bookingNotFound();
  }
  return booking;
}

/**
 * Rules B1 to B3. Everything below happens in ONE transaction:
 * either the booking, the unit status change and all four milestones are saved, or nothing is.
 *
 * Two requests for the same unit at the same moment are safe because of the unit row lock:
 * the second request waits at lockUnit, and when it continues it sees the unit is BOOKED.
 * The UNIQUE constraints on bookings.unit_id and bookings.quotation_id are a second safety net.
 */
export async function createBooking(input: CreateBookingInput): Promise<BookingDetail> {
  return withTransaction(async (tx) => {
    // 1. The quotation must exist. Lock it so it cannot be booked twice at once.
    if (!(await lockQuotation(tx, input.quotation_id))) {
      throw quotationNotFound();
    }
    const quotation = (await findQuotationById(tx, input.quotation_id)) as Quotation;

    // 2. It must not have been used already.
    if (quotation.booking_id !== null) {
      throw conflict(
        ErrorCode.QUOTATION_ALREADY_BOOKED,
        `Quotation ${quotation.quotation_number} has already been used for booking ${quotation.booking_number}.`,
      );
    }

    // 3. It must be unexpired and Accepted.
    if (quotation.status === 'EXPIRED') {
      throw quotationExpired(quotation);
    }
    if (quotation.status !== 'ACCEPTED') {
      throw conflict(
        ErrorCode.QUOTATION_NOT_ACCEPTED,
        `Only an Accepted quotation can be booked. Quotation ${quotation.quotation_number} has not been accepted yet.`,
      );
    }

    // 4. The unit must still be Available. The lock makes a simultaneous request wait here.
    const unit = await lockUnit(tx, quotation.unit_id);
    if (!unit) {
      throw unitNotFound();
    }
    ensureUnitIsAvailable(unit);

    // 5. Save the booking, mark the unit Booked, and create the four milestones.
    const bookingId = await bookingsRepo.insertBooking(tx, quotation.id, unit.id);
    await updateUnitStatus(tx, unit.id, 'BOOKED');
    await bookingsRepo.insertMilestones(tx, bookingId, splitIntoMilestones(quotation.final_price_paise));

    return (await loadBookingDetail(tx, bookingId)) as BookingDetail;
  });
}
