import { describe, expect, it } from 'vitest';
import { autoMap, detectHeaderRow, missingRequiredFields, normalizeHeader, recognizeHeader } from './column-mapping';

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
const ENGLISH_HEADERS = ['Date', 'Invoice #', 'Customer', 'Amount', 'VAT'];

describe('normalizeHeader', () => {
  it('ignores accents, case and punctuation', () => {
    expect(normalizeHeader('  N° Factura ')).toBe('n factura');
    expect(normalizeHeader('Categoría')).toBe('categoria');
    expect(normalizeHeader('Precio unitario (IVA incl.)')).toBe('precio unitario iva incl');
    expect(normalizeHeader('Invoice #')).toBe('invoice');
    expect(normalizeHeader('Fecha/Hora')).toBe('fecha hora');
  });
});

describe('recognizeHeader', () => {
  it('returns the field and how sure it is', () => {
    expect(recognizeHeader('Fecha')).toEqual({ field: 'date', confidence: 'exact' });
    expect(recognizeHeader('Total venta')?.field).toBe('total');
    expect(recognizeHeader('Total venta')?.confidence).toBe('synonym');
    expect(recognizeHeader('Valor total factura')?.confidence).toBe('fuzzy');
  });

  it('prefers the more specific field', () => {
    expect(recognizeHeader('Fecha de pago')?.field).toBe('paidDate');
    expect(recognizeHeader('Precio unitario (IVA incl.)')?.field).toBe('unitPrice');
  });

  it('returns null for things that are not headers', () => {
    expect(recognizeHeader('Vendedor')).toBeNull();
    expect(recognizeHeader('Saldo')).toBeNull();
    expect(recognizeHeader(null)).toBeNull();
    expect(recognizeHeader(42)).toBeNull();
    expect(recognizeHeader('')).toBeNull();
  });
});

describe('detectHeaderRow', () => {
  it('finds headers on row 1', () => {
    expect(detectHeaderRow([MAREA_HEADERS, ['2026-05-04', 'FV-1']])).toBe(0);
  });

  it('skips title rows and blank rows (POS: header on row 4)', () => {
    const rows = [
      ['CUADRE DE CAJA · PUNTO DE VENTA CC SANTAFÉ', null, null],
      ['Generado por el software POS · Periodo: agosto - octubre 2026', null, null],
      [null, null, null],
      POS_HEADERS,
      [new Date(2026, 7, 1), 'T-5121', 'Jhon', 'Tarjeta crédito', 133613, 25387, 159000],
    ];
    expect(detectHeaderRow(rows)).toBe(3);
  });

  it('falls back to the first non-empty row when nothing is recognized', () => {
    expect(detectHeaderRow([[null, null], ['x', 'y'], ['1', '2']])).toBe(1);
  });

  it('returns 0 for an empty sheet', () => {
    expect(detectHeaderRow([])).toBe(0);
  });
});

describe('autoMap', () => {
  it('maps the official template', () => {
    const { mapping, confidence } = autoMap(MAREA_HEADERS);
    expect(mapping).toEqual({
      date: 0,
      invoice: 1,
      client: 2,
      channel: 3,
      category: 4,
      product: 5,
      quantity: 6,
      unitPrice: 7,
      discount: 8,
      total: 9,
      net: 10,
      tax: 11,
      paymentMethod: 12,
      status: 13,
      paidDate: 14,
      notes: 15,
    });
    expect(Object.values(confidence).every((level) => level === 'exact' || level === 'synonym')).toBe(true);
  });

  it('maps a POS cash-register export', () => {
    const { mapping } = autoMap(POS_HEADERS);
    expect(mapping).toEqual({ date: 0, invoice: 1, paymentMethod: 3, net: 4, tax: 5, total: 6 });
  });

  it('maps a bank statement with credit and debit columns', () => {
    const { mapping } = autoMap(BANK_HEADERS);
    expect(mapping).toEqual({ date: 0, notes: 1, invoice: 2, debit: 3, credit: 4 });
  });

  it('maps messy English headers', () => {
    const { mapping } = autoMap(ENGLISH_HEADERS);
    expect(mapping).toEqual({ date: 0, invoice: 1, client: 2, total: 3, tax: 4 });
  });

  it('never assigns the same column or the same field twice', () => {
    const { mapping } = autoMap(['Fecha', 'Fecha', 'Total', 'Total venta']);
    const columns = Object.values(mapping);
    expect(new Set(columns).size).toBe(columns.length);
    expect(mapping.date).toBe(0);
    expect(mapping.total).toBe(2);
  });

  it('marks loose matches as fuzzy', () => {
    const { mapping, confidence } = autoMap(['Fecha', 'Valor total factura']);
    expect(mapping.total).toBe(1);
    expect(confidence.total).toBe('fuzzy');
  });
});

describe('missingRequiredFields', () => {
  it('needs a date and some amount', () => {
    expect(missingRequiredFields({}, 'all-rows')).toEqual(['date', 'total']);
    expect(missingRequiredFields({ date: 0 }, 'all-rows')).toEqual(['total']);
    expect(missingRequiredFields({ date: 0, total: 1 }, 'all-rows')).toEqual([]);
    expect(missingRequiredFields({ date: 0, quantity: 1, unitPrice: 2 }, 'all-rows')).toEqual([]);
    expect(missingRequiredFields({ date: 0, net: 1 }, 'all-rows')).toEqual([]);
  });

  it('needs the credit column for statements', () => {
    expect(missingRequiredFields({ date: 0, total: 1 }, 'credit-column-only')).toEqual(['credit']);
    expect(missingRequiredFields({ date: 0, credit: 1 }, 'credit-column-only')).toEqual([]);
  });
});
