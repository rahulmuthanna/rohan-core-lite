import { MILESTONE_PLAN, type MilestoneStage } from './business-rules.js';

/**
 * All money in this application is a whole number of paise (Rs 1 = 100 paise).
 * Every calculation here uses whole-number maths only, so results are exact.
 */

export interface DiscountResult {
  discount_amount_paise: number;
  final_price_paise: number;
}

/**
 * Discount = listed price x discount %, rounded to the nearest paise (halves round up).
 * Final offered price = listed price - discount.
 * discountBps is in basis points: 100 = 1%.
 */
export function calculateDiscount(listedPricePaise: number, discountBps: number): DiscountResult {
  const discountAmountPaise = Math.floor((listedPricePaise * discountBps + 5000) / 10000);
  return {
    discount_amount_paise: discountAmountPaise,
    final_price_paise: listedPricePaise - discountAmountPaise,
  };
}

export interface MilestoneAmount {
  sequence_no: number;
  stage: MilestoneStage;
  percent: number;
  amount_due_paise: number;
}

/**
 * Splits the final price into the four milestones.
 * The first three are rounded down; the last one takes whatever remains,
 * so the four amounts always add up to exactly the final price.
 */
export function splitIntoMilestones(finalPricePaise: number): MilestoneAmount[] {
  let allocatedPaise = 0;
  return MILESTONE_PLAN.map((step, index) => {
    const isLast = index === MILESTONE_PLAN.length - 1;
    const amountDuePaise = isLast
      ? finalPricePaise - allocatedPaise
      : Math.floor((finalPricePaise * step.percent) / 100);
    allocatedPaise += amountDuePaise;
    return { ...step, amount_due_paise: amountDuePaise };
  });
}

const rupeeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Formats paise for messages, using Indian digit grouping: 17320000 -> "₹1,73,200". */
export function formatRupees(paise: number): string {
  return rupeeFormatter.format(paise / 100);
}
