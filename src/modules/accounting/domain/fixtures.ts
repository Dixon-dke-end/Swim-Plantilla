import type { IncomeEntry } from './types';

/** Test helper: a valid income entry with sensible defaults. */
export function makeEntry(overrides: Partial<IncomeEntry> = {}): IncomeEntry {
  const total = overrides.total ?? 119000;
  const net = overrides.net ?? Math.round(total / 1.19);
  return {
    row: 2,
    date: '2026-05-04',
    invoice: 'FV-1',
    client: 'Cliente',
    channel: 'Tienda online',
    category: 'Bikinis',
    product: 'Bikini Alba',
    quantity: 1,
    unitPrice: total,
    discount: 0,
    total,
    net,
    tax: total - net,
    paymentMethod: 'Tarjeta',
    status: 'paid',
    paidDate: null,
    notes: '',
    ...overrides,
  };
}
