// @vitest-environment node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildJournal, journalTotals } from './domain/journal';
import { buildLedger } from './domain/ledger';
import { suggestSetup } from './domain/analyze';
import { normalizeRows } from './domain/normalize';
import { BUILT_IN_PROFILES } from './domain/profiles';
import { readWorkbook } from './infrastructure/sheet-reader';

const ROOT = path.resolve(process.cwd(), 'public', 'plantillas');

async function importFile(relative: string) {
  const bytes = new Uint8Array(await readFile(path.join(ROOT, relative)));
  const workbook = await readWorkbook(bytes, path.basename(relative));
  const sheet = workbook.sheets[workbook.defaultSheet]!;
  const setup = suggestSetup(sheet.rows, BUILT_IN_PROFILES);
  const result = normalizeRows(sheet.rows, setup.headerRowIndex, setup.mapping, setup.profile);
  return { workbook, sheet, setup, result };
}

describe('official template (plantilla-ingresos-marea.xlsx)', () => {
  it('skips the instructions sheet and reads the two example rows, computing formula cells', async () => {
    const { workbook, sheet, setup, result } = await importFile('plantilla-ingresos-marea.xlsx');
    expect(workbook.sheets.map((s) => s.name)).toEqual(['Instrucciones', 'Ingresos', 'Listas']);
    expect(sheet.name).toBe('Ingresos');
    expect(setup.profile.id).toBe('marea');
    expect(setup.headerRowIndex).toBe(0);
    expect(result.issues).toEqual([]);
    expect(result.dataRows).toBe(2);
    expect(result.entries.map((entry) => [entry.invoice, entry.total, entry.status])).toEqual([
      ['FV-0001', 189000, 'paid'],
      ['FV-0002', 1560600, 'pending'],
    ]);
    expect(buildLedger(result.entries, 'accrual').totals.gross).toBe(1_749_600);
    expect(buildLedger(result.entries, 'cash').totals.gross).toBe(189_000);
  });
});

describe('ventas-marea-2026.xlsx', () => {
  it('imports the sales book and reports the three problem rows', async () => {
    const { sheet, setup, result } = await importFile('ejemplos/ventas-marea-2026.xlsx');
    expect(sheet.name).toBe('Ingresos');
    expect(sheet.rows).toHaveLength(266);
    expect(setup.profile.id).toBe('marea');
    expect(result.dataRows).toBe(265);
    expect(result.entries).toHaveLength(255);
    expect(result.voided).toBe(7);
    expect(result.entries.filter((entry) => entry.status === 'pending')).toHaveLength(22);
    // 262 generated sales = 255 income entries + 7 cancelled; the 3 extra rows are the problems.
    expect(result.entries.length + result.voided).toBe(262);
    expect(result.issues.map((issue) => [issue.row, issue.kind, issue.field])).toEqual([
      [264, 'error', 'total'],
      [265, 'error', 'date'],
      [266, 'duplicate', 'invoice'],
    ]);
    expect(result.issues[1]!.reason).toContain('31/02/2026');
    expect(result.issues[2]!.reason).toContain('FV-1074');
    expect(result.skippedSummaryRows).toEqual([]);
  });

  it('gives different results for causación and caja from the same file', async () => {
    const { result } = await importFile('ejemplos/ventas-marea-2026.xlsx');
    const accrual = buildLedger(result.entries, 'accrual');
    const cash = buildLedger(result.entries, 'cash');
    expect(accrual.totals).toEqual({
      gross: 102_215_800,
      net: 85_895_621,
      tax: 16_320_179,
      receivables: 18_452_500,
      count: 255,
      averageTicket: 400_846,
    });
    expect(cash.totals.gross).toBe(83_763_300);
    expect(cash.totals.count).toBe(233);
    expect(cash.totals.receivables).toBe(18_452_500);
    expect(accrual.byMonth.map((month) => [month.key, month.gross])).toEqual([
      ['2026-05', 14_815_200],
      ['2026-06', 25_657_300],
      ['2026-07', 17_889_000],
      ['2026-08', 13_053_500],
      ['2026-09', 11_649_000],
      ['2026-10', 19_151_800],
    ]);
    expect(cash.byMonth.map((month) => month.gross)).toEqual([9_642_200, 16_202_900, 20_138_200, 12_302_000, 10_942_000, 14_536_000]);
    expect(buildJournal(result.entries, 'accrual')).toHaveLength(488);
    expect(buildJournal(result.entries, 'cash')).toHaveLength(233);
  });
});

describe('cuadre-caja-pos.xlsx', () => {
  it('detects the header on row 4 and skips the TOTAL row', async () => {
    const { sheet, setup, result } = await importFile('ejemplos/cuadre-caja-pos.xlsx');
    expect(sheet.name).toBe('Cuadre');
    expect(setup.headerRowIndex).toBe(3);
    expect(setup.profile.id).toBe('pos');
    expect(result.skippedSummaryRows).toEqual([118]);
    expect(result.issues).toEqual([]);
    expect(result.entries).toHaveLength(112);
    expect(result.dataRows).toBe(112);
    expect(buildLedger(result.entries, 'cash').totals.gross).toBe(31_512_000);
  });
});

describe('extracto-bancario.csv', () => {
  it('imports only the credit rows', async () => {
    const { workbook, setup, result } = await importFile('ejemplos/extracto-bancario.csv');
    expect(workbook.format).toBe('csv');
    expect(setup.profile.id).toBe('bank');
    expect(setup.profile.incomeRule).toBe('credit-column-only');
    expect(result.dataRows).toBe(87);
    expect(result.entries).toHaveLength(58);
    expect(result.ignoredMovements).toBe(29);
    expect(result.issues).toEqual([]);
    expect(result.entries.every((entry) => entry.total > 0)).toBe(true);
    expect(buildLedger(result.entries, 'cash').totals.gross).toBe(18_202_000);
  });
});

describe('accounting invariants over the real files', () => {
  it.each(['plantilla-ingresos-marea.xlsx', 'ejemplos/ventas-marea-2026.xlsx', 'ejemplos/cuadre-caja-pos.xlsx', 'ejemplos/extracto-bancario.csv'])(
    '%s: every journal entry balances under both methods',
    async (file) => {
      const { result } = await importFile(file);
      for (const method of ['accrual', 'cash'] as const) {
        const journal = buildJournal(result.entries, method);
        expect(journalTotals(journal).balanced).toBe(true);
        expect(buildLedger(result.entries, method).totals.count).toBe(result.entries.filter((e) => method === 'accrual' || e.status === 'paid').length);
      }
    },
  );
});
