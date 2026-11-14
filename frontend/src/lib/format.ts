import type { MilestoneStage, MilestoneState, QuotationStatus, UnitStatus } from '../api/types';

/**
 * Display and input helpers.
 * The server does every calculation. The only maths here is unit conversion:
 * rupees typed by the user -> paise, and percent typed by the user -> basis points.
 * Both conversions work on the digits as text, so no decimal rounding can creep in.
 */

const rupeeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** 17320000 paise -> '₹1,73,200' (Indian digit grouping). */
export function formatRupees(paise: number): string {
  return rupeeFormatter.format(paise / 100);
}

/** 680000000 paise -> '6800000', the plain text to put into an amount box. */
export function paiseToInputText(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const rest = paise % 100;
  return rest === 0 ? String(rupees) : `${rupees}.${String(rest).padStart(2, '0')}`;
}

const DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

/** Reads a number with at most two decimal places and returns it multiplied by 100, or null. */
function toHundredths(text: string): number | null {
  const cleaned = text.replace(/[\s,₹]/g, '');
  if (!DECIMAL_PATTERN.test(cleaned)) {
    return null;
  }
  const [whole = '0', fraction = ''] = cleaned.split('.');
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(value) ? value : null;
}

/** '5,00,000' or '500000.50' -> paise. Returns null when the text is not a valid amount. */
export function parseRupeesToPaise(text: string): number | null {
  return toHundredths(text);
}

/** '1.25' (percent) -> 125 basis points. Returns null when the text is not a valid percentage. */
export function parsePercentToBps(text: string): number | null {
  return toHundredths(text);
}

/** 125 basis points -> '1.25%'. */
export function formatPercent(bps: number): string {
  return `${bps / 100}%`;
}

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** '2026-11-14' -> '14 Nov 2026'. */
export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}

const indiaDateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

/** A timestamp such as '2026-11-14T09:04:34.449Z' -> the date in India, '14 Nov 2026'. */
export function formatTimestamp(isoTimestamp: string): string {
  return indiaDateFormatter.format(new Date(isoTimestamp));
}

const todayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date in India as 'YYYY-MM-DD', the form a date input uses. */
export function todayInIndia(): string {
  return todayFormatter.format(new Date());
}

export function formatArea(areaSqft: number): string {
  return `${areaSqft.toLocaleString('en-IN')} sq ft`;
}

export const UNIT_STATUS_LABEL: Record<UnitStatus, string> = {
  AVAILABLE: 'Available',
  BOOKED: 'Booked',
  SOLD: 'Sold',
};

export const QUOTATION_STATUS_LABEL: Record<QuotationStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  EXPIRED: 'Expired',
};

export const MILESTONE_STAGE_LABEL: Record<MilestoneStage, string> = {
  BOOKING: 'Booking',
  FOUNDATION: 'Foundation',
  STRUCTURE: 'Structure',
  HANDOVER: 'Handover',
};

export const MILESTONE_STATE_LABEL: Record<MilestoneState, string> = {
  PENDING: 'Pending',
  PARTLY_PAID: 'Partly paid',
  PAID: 'Paid',
};
