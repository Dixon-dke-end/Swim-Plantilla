import { describe, expect, it } from 'vitest';
import { recognize } from './accounting-methods';
import { makeEntry } from './fixtures';

const paid = makeEntry({ row: 2, invoice: 'A', date: '2026-05-04', status: 'paid', paidDate: '2026-05-10' });
const pending = makeEntry({ row: 3, invoice: 'B', date: '2026-05-06', status: 'pending', paidDate: null });
const pos = makeEntry({ row: 4, invoice: 'C', date: '2026-05-08', status: 'paid', paidDate: null });

describe('recognize: accrual (causación)', () => {
  it('recognizes every sale on its invoice date, paid or not', () => {
    const items = recognize([paid, pending, pos], 'accrual');
    expect(items.map((item) => [item.entry.invoice, item.date])).toEqual([
      ['A', '2026-05-04'],
      ['B', '2026-05-06'],
      ['C', '2026-05-08'],
    ]);
  });
});

describe('recognize: cash (caja)', () => {
  it('recognizes only paid sales, on the day the money came in', () => {
    const items = recognize([paid, pending, pos], 'cash');
    expect(items.map((item) => [item.entry.invoice, item.date])).toEqual([
      ['C', '2026-05-08'],
      ['A', '2026-05-10'],
    ]);
  });

  it('falls back to the sale date when the source has no payment date', () => {
    expect(recognize([pos], 'cash')[0]!.date).toBe('2026-05-08');
  });
});

describe('recognize: ordering', () => {
  it('sorts by recognition date, then by source row', () => {
    const a = makeEntry({ row: 9, invoice: 'Z', date: '2026-05-01' });
    const b = makeEntry({ row: 5, invoice: 'Y', date: '2026-05-01' });
    expect(recognize([a, b], 'accrual').map((item) => item.entry.invoice)).toEqual(['Y', 'Z']);
  });

  it('does not mutate its input', () => {
    const input = [pending, paid];
    recognize(input, 'accrual');
    expect(input.map((entry) => entry.invoice)).toEqual(['B', 'A']);
  });
});
