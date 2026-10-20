import { describe, expect, it } from 'vitest';
import { suggestSetup } from './analyze';
import { BUILT_IN_PROFILES, buildProfile } from './profiles';
import type { SheetRow } from './types';

const posRows: SheetRow[] = [
  ['CUADRE DE CAJA', null, null],
  [null, null, null],
  ['Fecha/Hora', 'Ticket', 'Vendedor', 'Forma de pago', 'Valor neto', 'Impuesto', 'Total venta'],
  [new Date(2026, 7, 1), 'T-1', 'Jhon', 'Efectivo', 100000, 19000, 119000],
];

describe('suggestSetup', () => {
  it('finds the header row and recognizes a saved profile', () => {
    const setup = suggestSetup(posRows, BUILT_IN_PROFILES);
    expect(setup.headerRowIndex).toBe(2);
    expect(setup.profile.id).toBe('pos');
    expect(setup.matched).toBe(true);
    expect(setup.mapping).toEqual({ date: 0, invoice: 1, paymentMethod: 3, net: 4, tax: 5, total: 6 });
  });

  it('falls back to auto-detection for unknown layouts', () => {
    const rows: SheetRow[] = [['Date', 'Invoice #', 'Customer', 'Amount', 'VAT']];
    const setup = suggestSetup(rows, BUILT_IN_PROFILES);
    expect(setup.matched).toBe(false);
    expect(setup.profile.id).toBe('auto');
    expect(setup.mapping).toEqual({ date: 0, invoice: 1, client: 2, total: 3, tax: 4 });
    expect(setup.confidence.total).toBe('synonym');
  });

  it('fills fields the profile does not cover using auto-detection', () => {
    const profile = buildProfile({
      name: 'Parcial',
      headers: ['Día', 'Venta'],
      mapping: { date: 0, total: 1 },
      accountingMethod: 'cash',
      taxMode: 'none',
      taxRate: 0,
    });
    const rows: SheetRow[] = [['Día', 'Venta', 'Cliente', 'Notas']];
    const setup = suggestSetup(rows, [profile]);
    expect(setup.profile.name).toBe('Parcial');
    expect(setup.mapping).toEqual({ date: 0, total: 1, client: 2, notes: 3 });
  });

  it('reads statements as credit-only', () => {
    const rows: SheetRow[] = [['Fecha', 'Débito', 'Crédito']];
    const setup = suggestSetup(rows, []);
    expect(setup.profile.incomeRule).toBe('credit-column-only');
  });

  it('copes with an empty sheet', () => {
    const setup = suggestSetup([], BUILT_IN_PROFILES);
    expect(setup.headers).toEqual([]);
    expect(setup.mapping).toEqual({});
  });
});
