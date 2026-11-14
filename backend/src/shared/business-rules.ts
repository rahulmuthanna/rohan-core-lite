/**
 * The fixed business rules of the application, in one place.
 *
 * Several of these are also enforced by CHECK constraints in the database
 * (see backend/db/migrations). Changing a value here usually needs a new
 * migration as well, so the code and the database keep agreeing.
 */

/** Discount is stored in basis points: 100 = 1%. The allowed range is 0% to 2%. */
export const MIN_DISCOUNT_BPS = 0;
export const MAX_DISCOUNT_BPS = 200;

/** A unit price must be at least Rs 1 and at most Rs 1,000 crore (stored in paise). */
export const MIN_PRICE_PAISE = 100;
export const MAX_PRICE_PAISE = 1_000_000_000_000;

export const UNIT_TYPES = ['1 BHK', '2 BHK', '3 BHK'] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const UNIT_STATUSES = ['AVAILABLE', 'BOOKED', 'SOLD'] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

/** What the database stores for a quotation. */
export const STORED_QUOTATION_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED'] as const;
export type StoredQuotationStatus = (typeof STORED_QUOTATION_STATUSES)[number];

/** What the API shows. EXPIRED is worked out from the validity date, never stored. */
export const QUOTATION_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'EXPIRED'] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

/** The four payment milestones created for every booking, in the order they must be paid. */
export const MILESTONE_PLAN = [
  { sequence_no: 1, stage: 'BOOKING', percent: 10 },
  { sequence_no: 2, stage: 'FOUNDATION', percent: 20 },
  { sequence_no: 3, stage: 'STRUCTURE', percent: 30 },
  { sequence_no: 4, stage: 'HANDOVER', percent: 40 },
] as const;
export type MilestoneStage = (typeof MILESTONE_PLAN)[number]['stage'];

/** A readable name for a stage, for messages: 'BOOKING' -> 'Booking'. */
export function stageLabel(stage: string): string {
  return stage.charAt(0) + stage.slice(1).toLowerCase();
}

/** Business dates ("today", quotation validity) are judged in Indian time. */
export const BUSINESS_TIME_ZONE = 'Asia/Kolkata';

/**
 * SQL for "today's date in India". Used wherever a query needs the business date.
 * Keep in step with BUSINESS_TIME_ZONE.
 */
export const SQL_TODAY_IN_INDIA = "(now() AT TIME ZONE 'Asia/Kolkata')::date";
