import { describe, expect, it } from 'vitest';
import { isBlank, parseAmount, parseDate } from './parse';

describe('parseAmount', () => {
  it('passes real numbers through', () => {
    expect(parseAmount(1234567)).toBe(1234567);
    expect(parseAmount(12.5)).toBe(12.5);
    expect(parseAmount(0)).toBe(0);
  });

  it('reads Colombian formatting', () => {
    expect(parseAmount('$ 1.234.567,00')).toBe(1234567);
    expect(parseAmount('318.000,00')).toBe(318000);
    expect(parseAmount('1.234.567')).toBe(1234567);
    expect(parseAmount('1.234')).toBe(1234);
    expect(parseAmount('12,5')).toBe(12.5);
  });

  it('reads US formatting', () => {
    expect(parseAmount('1,234,567.00')).toBe(1234567);
    expect(parseAmount('$1,234.50')).toBe(1234.5);
    expect(parseAmount('1,234')).toBe(1234);
  });

  it('reads plain digits and strips currency noise', () => {
    expect(parseAmount('1234567')).toBe(1234567);
    expect(parseAmount('COP 189000')).toBe(189000);
    expect(parseAmount('  $ 189.000  ')).toBe(189000);
  });

  it('treats blanks as null', () => {
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('   ')).toBeNull();
    expect(parseAmount('-')).toBeNull();
  });

  it('reads negatives, including accounting parentheses', () => {
    expect(parseAmount('-1.500')).toBe(-1500);
    expect(parseAmount('(1.500,00)')).toBe(-1500);
    expect(parseAmount('($ 2,000.00)')).toBe(-2000);
    expect(parseAmount(-30)).toBe(-30);
  });

  it('returns null for text that is not an amount', () => {
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('12/05/2026')).toBeNull();
    expect(parseAmount(Number.NaN)).toBeNull();
    expect(parseAmount(true)).toBeNull();
    expect(parseAmount(new Date(2026, 0, 1))).toBeNull();
  });
});

describe('parseDate', () => {
  it('reads Date objects using local calendar fields', () => {
    expect(parseDate(new Date(2026, 4, 4))).toBe('2026-05-04');
    expect(parseDate(new Date(2026, 9, 15, 19, 37))).toBe('2026-10-15');
  });

  it('rejects invalid Date objects', () => {
    expect(parseDate(new Date('nope'))).toBeNull();
  });

  it('reads Excel serial numbers', () => {
    expect(parseDate(46266)).toBe('2026-09-01');
    expect(parseDate(46266.75)).toBe('2026-09-01');
    expect(parseDate(45292)).toBe('2024-01-01');
  });

  it('rejects numbers that cannot be Excel dates', () => {
    expect(parseDate(12)).toBeNull();
    expect(parseDate(1e12)).toBeNull();
  });

  it('reads dd/mm/yyyy', () => {
    expect(parseDate('04/05/2026')).toBe('2026-05-04');
    expect(parseDate('4/5/2026')).toBe('2026-05-04');
    expect(parseDate('04-05-2026')).toBe('2026-05-04');
    expect(parseDate('04.05.2026')).toBe('2026-05-04');
  });

  it('reads dd/mm/yyyy with a time', () => {
    expect(parseDate('15/10/2026 19:37')).toBe('2026-10-15');
    expect(parseDate('15/10/2026 7:37:10 PM')).toBe('2026-10-15');
  });

  it('reads ISO dates, with or without time', () => {
    expect(parseDate('2026-09-01')).toBe('2026-09-01');
    expect(parseDate('2026-09-01T10:20:00')).toBe('2026-09-01');
    expect(parseDate('2026-09-01 10:20')).toBe('2026-09-01');
    expect(parseDate('2026/9/1')).toBe('2026-09-01');
  });

  it('reads two-digit years as 20xx', () => {
    expect(parseDate('04/05/26')).toBe('2026-05-04');
  });

  it('rejects impossible dates', () => {
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('29/02/2026')).toBeNull();
    expect(parseDate('2026-13-01')).toBeNull();
    expect(parseDate('00/10/2026')).toBeNull();
    expect(parseDate('32/01/2026')).toBeNull();
  });

  it('accepts a real leap day', () => {
    expect(parseDate('29/02/2028')).toBe('2028-02-29');
  });

  it('rejects blanks and free text', () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseDate('mañana')).toBeNull();
    expect(parseDate('TOTAL')).toBeNull();
  });
});

describe('isBlank', () => {
  it('detects empty-looking cells', () => {
    expect(isBlank(null)).toBe(true);
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank('')).toBe(true);
    expect(isBlank('  ')).toBe(true);
    expect(isBlank(0)).toBe(false);
    expect(isBlank('a')).toBe(false);
  });
});
