import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatPercent,
  formatRupees,
  paiseToInputText,
  parsePercentToBps,
  parseRupeesToPaise,
} from './format';

describe('parseRupeesToPaise', () => {
  it('reads whole rupees, with or without commas and the rupee sign', () => {
    expect(parseRupeesToPaise('500000')).toBe(50000000);
    expect(parseRupeesToPaise('5,00,000')).toBe(50000000);
    expect(parseRupeesToPaise(' ₹ 5,00,000 ')).toBe(50000000);
  });

  it('reads paise exactly, without decimal rounding errors', () => {
    expect(parseRupeesToPaise('0.07')).toBe(7);
    expect(parseRupeesToPaise('1.1')).toBe(110);
    expect(parseRupeesToPaise('173200.55')).toBe(17320055);
  });

  it('rejects anything that is not an amount', () => {
    for (const text of ['', 'abc', '-100', '1.234', '1e5', '.', '12.']) {
      expect(parseRupeesToPaise(text)).toBeNull();
    }
  });
});

describe('parsePercentToBps', () => {
  it('converts a percentage to basis points', () => {
    expect(parsePercentToBps('0')).toBe(0);
    expect(parsePercentToBps('1')).toBe(100);
    expect(parsePercentToBps('1.25')).toBe(125);
    expect(parsePercentToBps('2')).toBe(200);
  });

  it('rejects more than two decimal places and non-numbers', () => {
    expect(parsePercentToBps('1.255')).toBeNull();
    expect(parsePercentToBps('one')).toBeNull();
    expect(parsePercentToBps('')).toBeNull();
  });
});

describe('formatting', () => {
  it('formats money with Indian digit grouping', () => {
    expect(formatRupees(673200000)).toBe('₹67,32,000');
    expect(formatRupees(17320000)).toBe('₹1,73,200');
    expect(formatRupees(0)).toBe('₹0');
  });

  it('formats a discount in basis points as a percentage', () => {
    expect(formatPercent(100)).toBe('1%');
    expect(formatPercent(125)).toBe('1.25%');
    expect(formatPercent(0)).toBe('0%');
  });

  it('formats a date for reading', () => {
    expect(formatDate('2026-11-14')).toBe('14 Nov 2026');
  });

  it('turns paise back into text for an amount box', () => {
    expect(paiseToInputText(680000000)).toBe('6800000');
    expect(paiseToInputText(17320055)).toBe('173200.55');
    expect(paiseToInputText(105)).toBe('1.05');
  });
});
