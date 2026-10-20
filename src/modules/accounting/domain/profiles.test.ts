import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_PROFILES,
  buildProfile,
  inferIncomeRule,
  pickBestProfile,
  profileScore,
  resolveProfileMapping,
} from './profiles';

const MAREA_HEADERS = [
  'Fecha',
  'N° factura',
  'Cliente',
  'Canal',
  'Categoría',
  'Producto',
  'Cantidad',
  'Precio unitario (IVA incl.)',
  'Descuento',
  'Total',
  'Base gravable',
  'IVA 19%',
  'Medio de pago',
  'Estado',
  'Fecha de pago',
  'Notas',
];
const POS_HEADERS = ['Fecha/Hora', 'Ticket', 'Vendedor', 'Forma de pago', 'Valor neto', 'Impuesto', 'Total venta'];
const BANK_HEADERS = ['Fecha transacción', 'Descripción', 'Referencia', 'Débito', 'Crédito', 'Saldo'];

describe('built-in profiles', () => {
  it('ships the three presets with distinct ids', () => {
    const names = BUILT_IN_PROFILES.map((profile) => profile.name);
    expect(names).toContain('Plantilla MAREA');
    expect(names).toContain('Cuadre de caja (POS)');
    expect(names).toContain('Extracto bancario');
    expect(new Set(BUILT_IN_PROFILES.map((profile) => profile.id)).size).toBe(BUILT_IN_PROFILES.length);
  });

  it('configures each preset for its source', () => {
    const byId = Object.fromEntries(BUILT_IN_PROFILES.map((profile) => [profile.id, profile]));
    expect(byId['marea']!.accountingMethod).toBe('accrual');
    expect(byId['marea']!.incomeRule).toBe('all-rows');
    expect(byId['pos']!.accountingMethod).toBe('cash');
    expect(byId['bank']!.incomeRule).toBe('credit-column-only');
    expect(byId['bank']!.accountingMethod).toBe('cash');
    expect(BUILT_IN_PROFILES.every((profile) => profile.taxRate === 0.19)).toBe(true);
  });
});

describe('resolveProfileMapping', () => {
  it('turns header names into column indexes, ignoring accents and case', () => {
    const marea = BUILT_IN_PROFILES.find((profile) => profile.id === 'marea')!;
    const mapping = resolveProfileMapping(marea, MAREA_HEADERS.map((header) => header.toUpperCase()));
    expect(mapping.date).toBe(0);
    expect(mapping.total).toBe(9);
    expect(mapping.paidDate).toBe(14);
  });

  it('skips headers the file does not have', () => {
    const marea = BUILT_IN_PROFILES.find((profile) => profile.id === 'marea')!;
    const mapping = resolveProfileMapping(marea, ['Fecha', 'Total']);
    expect(mapping).toEqual({ date: 0, total: 1 });
  });
});

describe('pickBestProfile', () => {
  it('recognizes each preset by its headers', () => {
    expect(pickBestProfile(MAREA_HEADERS, BUILT_IN_PROFILES)?.profile.id).toBe('marea');
    expect(pickBestProfile(POS_HEADERS, BUILT_IN_PROFILES)?.profile.id).toBe('pos');
    expect(pickBestProfile(BANK_HEADERS, BUILT_IN_PROFILES)?.profile.id).toBe('bank');
  });

  it('returns null when nothing overlaps enough', () => {
    expect(pickBestProfile(['Date', 'Invoice #', 'Customer', 'Amount', 'VAT'], BUILT_IN_PROFILES)).toBeNull();
    expect(pickBestProfile([], BUILT_IN_PROFILES)).toBeNull();
  });

  it('prefers a custom profile that matches better', () => {
    const custom = buildProfile({
      name: 'Mi Excel',
      headers: ['Día', 'Venta'],
      mapping: { date: 0, total: 1 },
      accountingMethod: 'cash',
      taxMode: 'none',
      taxRate: 0,
    });
    const pick = pickBestProfile(['Día', 'Venta'], [...BUILT_IN_PROFILES, custom]);
    expect(pick?.profile.name).toBe('Mi Excel');
    expect(pick?.score).toBe(1);
  });
});

describe('profileScore', () => {
  it('is the share of the profile headers present in the file', () => {
    const pos = BUILT_IN_PROFILES.find((profile) => profile.id === 'pos')!;
    expect(profileScore(pos, POS_HEADERS)).toBe(1);
    expect(profileScore(pos, ['Fecha/Hora', 'Ticket'])).toBeCloseTo(2 / 6);
  });
});

describe('buildProfile', () => {
  it('stores the mapping by header name so it survives column reordering', () => {
    const profile = buildProfile({
      name: '  Libro de ventas  ',
      headers: ['Valor', 'Día'],
      mapping: { total: 0, date: 1 },
      accountingMethod: 'accrual',
      taxMode: 'excluded',
      taxRate: 0.19,
    });
    expect(profile.name).toBe('Libro de ventas');
    expect(profile.mapping).toEqual({ total: 'Valor', date: 'Día' });
    expect(profile.incomeRule).toBe('all-rows');
    expect(resolveProfileMapping(profile, ['Día', 'Otra', 'Valor'])).toEqual({ date: 0, total: 2 });
  });
});

describe('inferIncomeRule', () => {
  it('uses the credit column when there is no total', () => {
    expect(inferIncomeRule({ date: 0, credit: 1, debit: 2 })).toBe('credit-column-only');
    expect(inferIncomeRule({ date: 0, total: 1, credit: 2 })).toBe('all-rows');
    expect(inferIncomeRule({ date: 0, total: 1 })).toBe('all-rows');
  });
});
