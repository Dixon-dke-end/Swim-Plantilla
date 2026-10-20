import { describe, expect, it } from 'vitest';
import { normalizeRows } from './normalize';
import type { ColumnMapping, SheetRow } from './types';

const included = { taxMode: 'included', taxRate: 0.19, incomeRule: 'all-rows' } as const;

/** Header row + data rows with the columns: date, invoice, qty, price, discount, total, status, paid. */
const mapping: ColumnMapping = {
  date: 0,
  invoice: 1,
  quantity: 2,
  unitPrice: 3,
  discount: 4,
  total: 5,
  status: 6,
  paidDate: 7,
};
const header: SheetRow = ['Fecha', 'Factura', 'Cant', 'Precio', 'Desc', 'Total', 'Estado', 'Pagó'];

function run(rows: SheetRow[], overrides: Partial<typeof included> = {}, columns: ColumnMapping = mapping) {
  return normalizeRows([header, ...rows], 0, columns, { ...included, ...overrides });
}

describe('normalizeRows: amounts', () => {
  it('uses the total column and derives net and tax when they are missing', () => {
    const { entries } = run([['04/05/2026', 'FV-1', 1, 119000, 0, 119000, 'Pagado', '05/05/2026']]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      row: 2,
      date: '2026-05-04',
      invoice: 'FV-1',
      total: 119000,
      net: 100000,
      tax: 19000,
      status: 'paid',
      paidDate: '2026-05-05',
    });
  });

  it('computes the total from quantity x price - discount when the total is empty', () => {
    const { entries } = run([[new Date(2026, 9, 2), 'FV-2', 6, 289000, 173400, null, 'Pendiente', null]]);
    expect(entries[0]!.total).toBe(1560600);
    expect(entries[0]!.net + entries[0]!.tax).toBe(1560600);
    expect(entries[0]!.status).toBe('pending');
    expect(entries[0]!.paidDate).toBeNull();
  });

  it('uses net and tax columns when the file has them', () => {
    const columns: ColumnMapping = { date: 0, net: 1, tax: 2, total: 3 };
    const result = normalizeRows(
      [['Fecha', 'Neto', 'Impuesto', 'Total'], ['2026-08-01', 133613, 25387, 159000]],
      0,
      columns,
      included,
    );
    expect(result.entries[0]).toMatchObject({ net: 133613, tax: 25387, total: 159000 });
  });

  it('adds tax on top when prices are tax-excluded', () => {
    const columns: ColumnMapping = { date: 0, total: 1 };
    const result = normalizeRows([['Fecha', 'Valor'], ['2026-08-01', 100000]], 0, columns, {
      taxMode: 'excluded',
      taxRate: 0.19,
      incomeRule: 'all-rows',
    });
    expect(result.entries[0]).toMatchObject({ net: 100000, tax: 19000, total: 119000 });
  });

  it('keeps tax at zero when the business does not charge it', () => {
    const columns: ColumnMapping = { date: 0, total: 1 };
    const result = normalizeRows([['Fecha', 'Valor'], ['2026-08-01', 100000]], 0, columns, {
      taxMode: 'none',
      taxRate: 0,
      incomeRule: 'all-rows',
    });
    expect(result.entries[0]).toMatchObject({ net: 100000, tax: 0, total: 100000 });
  });

  it('reads Colombian-formatted text amounts', () => {
    const { entries } = run([['2026-09-01', 'R-1', null, null, null, '318.000,00', null, null]]);
    expect(entries[0]!.total).toBe(318000);
  });

  it('defaults quantity to 1 and discount to 0', () => {
    const { entries } = run([['2026-09-01', 'R-1', null, null, null, 50000, null, null]]);
    expect(entries[0]).toMatchObject({ quantity: 1, discount: 0, unitPrice: null });
  });
});

describe('normalizeRows: rejected rows', () => {
  it('rejects a row with no price and no total, with its original row number', () => {
    const result = run([['2026-09-12', 'FV-9001', 1, null, 0, null, 'Pagado', null]]);
    expect(result.entries).toHaveLength(0);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ row: 2, kind: 'error', field: 'total' });
    expect(result.issues[0]!.reason).toMatch(/valor|total|precio/i);
  });

  it('rejects an impossible date', () => {
    const result = run([['31/02/2026', 'FV-9002', 1, 319000, 0, 319000, 'Pagado', null]]);
    expect(result.entries).toHaveLength(0);
    expect(result.issues[0]).toMatchObject({ row: 2, kind: 'error', field: 'date' });
    expect(result.issues[0]!.reason).toContain('31/02/2026');
  });

  it('rejects a row with no date', () => {
    const result = run([[null, 'FV-9', 1, 1000, 0, 1000, null, null]]);
    expect(result.issues[0]).toMatchObject({ kind: 'error', field: 'date' });
  });

  it('rejects zero-value rows', () => {
    const result = run([['2026-09-12', 'FV-0', 1, 0, 0, 0, null, null]]);
    expect(result.entries).toHaveLength(0);
    expect(result.issues[0]).toMatchObject({ kind: 'error', field: 'total' });
  });
});

describe('normalizeRows: skipped rows', () => {
  it('ignores blank rows without reporting them', () => {
    const result = run([[null, null, null, null, null, null, null, null], ['', ' ', null, null, null, null, null, null]]);
    expect(result.entries).toHaveLength(0);
    expect(result.issues).toHaveLength(0);
    expect(result.dataRows).toBe(0);
  });

  it('skips summary rows instead of reporting errors', () => {
    const rows: SheetRow[] = [
      ['2026-09-01', 'R-1', null, null, null, 1000, null, null],
      [null, null, null, 'TOTAL', null, null, null, null],
      [null, null, null, 'Totales', null, 1000, null, null],
    ];
    const result = run(rows);
    expect(result.entries).toHaveLength(1);
    expect(result.issues).toHaveLength(0);
    expect(result.skippedSummaryRows).toEqual([3, 4]);
    expect(result.dataRows).toBe(1);
  });

  it('does not mistake a dated row for a summary row', () => {
    const result = run([['2026-09-01', 'R-1', null, null, null, 1000, 'Total pagado', null]]);
    expect(result.entries).toHaveLength(1);
    expect(result.skippedSummaryRows).toEqual([]);
  });
});

describe('normalizeRows: duplicates and voided rows', () => {
  it('keeps the first of a repeated invoice and flags the rest', () => {
    const rows: SheetRow[] = [
      ['2026-05-04', 'fv-1074', 1, 100, 0, 100, 'Pagado', null],
      ['2026-05-05', 'FV-1075', 1, 100, 0, 100, 'Pagado', null],
      ['2026-05-04', ' FV-1074 ', 1, 100, 0, 100, 'Pagado', null],
    ];
    const result = run(rows);
    expect(result.entries.map((entry) => entry.invoice)).toEqual(['fv-1074', 'FV-1075']);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ row: 4, kind: 'duplicate' });
    expect(result.dataRows).toBe(3);
  });

  it('does not treat rows without an invoice number as duplicates', () => {
    const result = run([
      ['2026-05-04', null, 1, 100, 0, 100, null, null],
      ['2026-05-04', null, 1, 100, 0, 100, null, null],
    ]);
    expect(result.entries).toHaveLength(2);
  });

  it('counts cancelled rows separately and leaves them out of income', () => {
    const result = run([
      ['2026-05-04', 'FV-1', 1, 100, 0, 100, 'Anulado', null],
      ['2026-05-04', 'FV-2', 1, 100, 0, 100, 'Anulada', null],
      ['2026-05-04', 'FV-3', 1, 100, 0, 100, 'Pagado', null],
    ]);
    expect(result.voided).toBe(2);
    expect(result.entries.map((entry) => entry.invoice)).toEqual(['FV-3']);
  });

  it('accounts for every examined row exactly once', () => {
    const result = run([
      ['2026-05-04', 'FV-1', 1, 100, 0, 100, 'Pagado', null],
      ['2026-05-04', 'FV-1', 1, 100, 0, 100, 'Pagado', null],
      ['2026-05-04', 'FV-2', 1, 100, 0, 100, 'Anulado', null],
      ['31/02/2026', 'FV-3', 1, 100, 0, 100, 'Pagado', null],
    ]);
    const errors = result.issues.filter((issue) => issue.kind === 'error').length;
    const duplicates = result.issues.filter((issue) => issue.kind === 'duplicate').length;
    expect(result.entries.length + errors + duplicates + result.voided + result.ignoredMovements).toBe(result.dataRows);
  });
});

describe('normalizeRows: credit-only (bank statements)', () => {
  const bank: ColumnMapping = { date: 0, notes: 1, invoice: 2, debit: 3, credit: 4 };
  const bankRows: SheetRow[] = [
    ['Fecha', 'Descripción', 'Referencia', 'Débito', 'Crédito', 'Saldo'],
    ['2026-09-01', 'ABONO DATÁFONO', '111', null, '318.000,00', '1'],
    ['2026-09-01', 'PAGO NÓMINA', '222', '1.200.000,00', null, '2'],
    ['2026-09-02', 'TRANSF NEQUI', '333', '', '578.000,00', '3'],
    ['2026-09-03', 'CUOTA DE MANEJO', '444', '85.000,00', '', '4'],
  ];

  it('imports only credits and counts debits as non-income movements', () => {
    const result = normalizeRows(bankRows, 0, bank, { taxMode: 'included', taxRate: 0.19, incomeRule: 'credit-column-only' });
    expect(result.entries.map((entry) => entry.total)).toEqual([318000, 578000]);
    expect(result.ignoredMovements).toBe(2);
    expect(result.issues).toHaveLength(0);
    expect(result.dataRows).toBe(4);
  });

  it('applies profile defaults for fields the source does not have', () => {
    const result = normalizeRows(bankRows, 0, bank, {
      taxMode: 'included',
      taxRate: 0.19,
      incomeRule: 'credit-column-only',
      defaults: { channel: 'Banco', paymentMethod: 'Transferencia' },
    });
    expect(result.entries[0]).toMatchObject({ channel: 'Banco', paymentMethod: 'Transferencia', status: 'paid', notes: 'ABONO DATÁFONO' });
  });
});

describe('normalizeRows: row numbers', () => {
  it('reports the position in the original sheet when the header is not on row 1', () => {
    const rows: SheetRow[] = [
      ['Título', null],
      [null, null],
      ['Fecha', 'Valor'],
      ['31/02/2026', 10],
    ];
    const result = normalizeRows(rows, 2, { date: 0, total: 1 }, included);
    expect(result.issues[0]!.row).toBe(4);
  });

  it('honours a row offset for sheets that start below row 1', () => {
    const rows: SheetRow[] = [['Fecha', 'Valor'], ['31/02/2026', 10]];
    const result = normalizeRows(rows, 0, { date: 0, total: 1 }, included, 5);
    expect(result.issues[0]!.row).toBe(7);
  });
});
