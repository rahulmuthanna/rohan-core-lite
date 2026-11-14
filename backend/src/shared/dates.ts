import { BUSINESS_TIME_ZONE } from './business-rules.js';

const indiaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date in India as 'YYYY-MM-DD'. */
export function todayInIndia(): string {
  return indiaDateFormatter.format(new Date());
}

/** True when the text is a real calendar date written as 'YYYY-MM-DD' (so 2026-02-30 is false). */
export function isRealDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return false;
  }
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}
