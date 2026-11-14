import { describe, expect, it } from 'vitest';
import { calculateDiscount, formatRupees, splitIntoMilestones } from '../src/shared/money.js';

describe('calculateDiscount', () => {
  it('matches the assignment example: Rs 68,00,000 at 1% gives Rs 68,000 off and Rs 67,32,000 final', () => {
    expect(calculateDiscount(680000000, 100)).toEqual({
      discount_amount_paise: 6800000,
      final_price_paise: 673200000,
    });
  });

  it('gives no discount at 0%', () => {
    expect(calculateDiscount(680000000, 0)).toEqual({ discount_amount_paise: 0, final_price_paise: 680000000 });
  });

  it('handles the 2% maximum', () => {
    expect(calculateDiscount(680000000, 200)).toEqual({
      discount_amount_paise: 13600000,
      final_price_paise: 666400000,
    });
  });

  it('handles a fractional percentage such as 1.25%', () => {
    expect(calculateDiscount(680000000, 125)).toEqual({
      discount_amount_paise: 8500000,
      final_price_paise: 671500000,
    });
  });

  it('rounds to the nearest paise, with exact halves rounding up', () => {
    // 10050 paise at 0.50% = 50.25 paise -> 50
    expect(calculateDiscount(10050, 50).discount_amount_paise).toBe(50);
    // 10100 paise at 0.50% = 50.5 paise -> 51
    expect(calculateDiscount(10100, 50).discount_amount_paise).toBe(51);
  });
});

describe('splitIntoMilestones', () => {
  it('matches the assignment example for Rs 67,32,000', () => {
    expect(splitIntoMilestones(673200000)).toEqual([
      { sequence_no: 1, stage: 'BOOKING', percent: 10, amount_due_paise: 67320000 },
      { sequence_no: 2, stage: 'FOUNDATION', percent: 20, amount_due_paise: 134640000 },
      { sequence_no: 3, stage: 'STRUCTURE', percent: 30, amount_due_paise: 201960000 },
      { sequence_no: 4, stage: 'HANDOVER', percent: 40, amount_due_paise: 269280000 },
    ]);
  });

  it('always adds up to exactly the final price, even when it does not divide evenly', () => {
    for (const finalPrice of [673200001, 999999999, 100000007, 98]) {
      const total = splitIntoMilestones(finalPrice).reduce((sum, m) => sum + m.amount_due_paise, 0);
      expect(total).toBe(finalPrice);
    }
  });
});

describe('formatRupees', () => {
  it('uses Indian digit grouping', () => {
    expect(formatRupees(17320000)).toBe('₹1,73,200');
    expect(formatRupees(673200000)).toBe('₹67,32,000');
  });
});
