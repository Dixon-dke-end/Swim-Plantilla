import { describe, expect, it } from 'vitest';
import { makeEntry } from './fixtures';
import { buildLedger, monthLabel } from './ledger';

const entries = [
  makeEntry({ row: 2, invoice: 'A', date: '2026-05-04', total: 119000, status: 'paid', paidDate: '2026-06-02', channel: 'Tienda online', category: 'Bikinis', paymentMethod: 'Tarjeta' }),
  makeEntry({ row: 3, invoice: 'B', date: '2026-05-20', total: 238000, status: 'pending', paidDate: null, channel: 'Mayorista', category: 'Enterizos', paymentMethod: 'Transferencia' }),
  makeEntry({ row: 4, invoice: 'C', date: '2026-06-10', total: 357000, status: 'paid', paidDate: '2026-06-10', channel: 'Tienda online', category: 'Bikinis', paymentMethod: 'Tarjeta' }),
];

describe('buildLedger: accrual', () => {
  const ledger = buildLedger(entries, 'accrual');

  it('totals every recognized sale', () => {
    expect(ledger.totals.gross).toBe(714000);
    expect(ledger.totals.net).toBe(100000 + 200000 + 300000);
    expect(ledger.totals.tax).toBe(114000);
    expect(ledger.totals.count).toBe(3);
    expect(ledger.totals.averageTicket).toBe(238000);
  });

  it('reports pending money as receivables', () => {
    expect(ledger.totals.receivables).toBe(238000);
  });

  it('groups by month and computes the change against the previous month', () => {
    expect(ledger.byMonth.map((month) => [month.key, month.gross, month.count])).toEqual([
      ['2026-05', 357000, 2],
      ['2026-06', 357000, 1],
    ]);
    expect(ledger.byMonth[0]!.change).toBeNull();
    expect(ledger.byMonth[1]!.change).toBe(0);
  });

  it('breaks revenue down by channel, category and payment method, largest first', () => {
    expect(ledger.byChannel.map((row) => [row.label, row.gross])).toEqual([
      ['Tienda online', 476000],
      ['Mayorista', 238000],
    ]);
    expect(ledger.byCategory.map((row) => [row.label, row.gross, row.count])).toEqual([
      ['Bikinis', 476000, 2],
      ['Enterizos', 238000, 1],
    ]);
    expect(ledger.byPaymentMethod[0]).toMatchObject({ label: 'Tarjeta', gross: 476000 });
    expect(ledger.byChannel[0]!.share).toBeCloseTo(476000 / 714000);
    expect(ledger.byChannel.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1);
  });

  it('exposes headline deltas for the latest month', () => {
    expect(ledger.latestMonth).toBe('2026-06');
    expect(ledger.previousMonth).toBe('2026-05');
    expect(ledger.deltas.gross).toBe(0);
    expect(ledger.deltas.count).toBe(-0.5);
  });
});

describe('buildLedger: cash', () => {
  const ledger = buildLedger(entries, 'cash');

  it('only counts money that came in, on the day it came in', () => {
    expect(ledger.totals.gross).toBe(119000 + 357000);
    expect(ledger.totals.count).toBe(2);
    expect(ledger.byMonth.map((month) => [month.key, month.gross])).toEqual([['2026-06', 476000]]);
  });

  it('still reports what customers owe', () => {
    expect(ledger.totals.receivables).toBe(238000);
  });

  it('has no month-over-month change with a single month', () => {
    expect(ledger.deltas.gross).toBeNull();
    expect(ledger.previousMonth).toBeNull();
  });
});

describe('buildLedger: the same file gives different numbers per method', () => {
  it('differs between accrual and cash', () => {
    expect(buildLedger(entries, 'accrual').totals.gross).not.toBe(buildLedger(entries, 'cash').totals.gross);
  });
});

describe('buildLedger: gaps and empties', () => {
  it('fills months without sales so the series is continuous', () => {
    const sparse = [
      makeEntry({ row: 2, invoice: 'A', date: '2026-05-04', total: 100 }),
      makeEntry({ row: 3, invoice: 'B', date: '2026-07-04', total: 300 }),
    ];
    const ledger = buildLedger(sparse, 'accrual');
    expect(ledger.byMonth.map((month) => [month.key, month.gross])).toEqual([
      ['2026-05', 100],
      ['2026-06', 0],
      ['2026-07', 300],
    ]);
    expect(ledger.byMonth[2]!.change).toBeNull();
  });

  it('handles an empty ledger', () => {
    const ledger = buildLedger([], 'accrual');
    expect(ledger.totals).toEqual({ gross: 0, net: 0, tax: 0, receivables: 0, count: 0, averageTicket: 0 });
    expect(ledger.byMonth).toEqual([]);
    expect(ledger.latestMonth).toBeNull();
  });
});

describe('monthLabel', () => {
  it('labels months in Spanish', () => {
    expect(monthLabel('2026-05')).toBe('may');
    expect(monthLabel('2026-05', true)).toBe('mayo 2026');
    expect(monthLabel('2026-12', true)).toBe('diciembre 2026');
  });
});
