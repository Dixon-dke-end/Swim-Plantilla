import { describe, expect, it } from 'vitest';
import { makeEntry } from '../domain/fixtures';
import { buildJournal } from '../domain/journal';
import { buildLedger } from '../domain/ledger';
import { journalToCsv, ledgerSheets } from './exporters';

const entries = [
  makeEntry({ row: 2, invoice: 'FV-1', date: '2026-05-04', total: 119000, net: 100000, tax: 19000, client: 'Ana "la mayor"; S.A.', status: 'paid', paidDate: '2026-05-06' }),
  makeEntry({ row: 3, invoice: 'FV-2', date: '2026-05-05', total: 238000, net: 200000, tax: 38000, status: 'pending', paidDate: null }),
];

describe('journalToCsv', () => {
  const csv = journalToCsv(buildJournal(entries, 'accrual'));
  const lines = csv.replace(/^﻿/, '').split('\r\n');

  it('starts with a byte order mark so Excel reads accents', () => {
    expect(csv.startsWith('﻿')).toBe(true);
  });

  it('has a header and one row per journal line', () => {
    expect(lines[0]).toBe('Asiento;Fecha;Documento;Concepto;Cuenta;Nombre de la cuenta;Débito;Crédito');
    // FV-1 invoice (3 lines) + collection (2) + FV-2 invoice (3) = 8 lines, plus header and trailing break.
    expect(lines.filter(Boolean)).toHaveLength(1 + 8);
  });

  it('quotes fields that contain the delimiter or quotes', () => {
    expect(csv).toContain('"Venta · Ana ""la mayor""; S.A."');
  });

  it('writes plain integer amounts', () => {
    expect(lines[1]).toContain(';130505;Clientes nacionales;119000;0');
  });
});

describe('ledgerSheets', () => {
  const sheets = ledgerSheets(entries, buildLedger(entries, 'accrual'), 'accrual');

  it('builds a movements sheet and a summary sheet', () => {
    expect(sheets.map((sheet) => sheet.name)).toEqual(['Libro de ingresos', 'Resumen']);
  });

  it('lists one row per recognized sale under the header', () => {
    const movements = sheets[0]!.rows;
    expect(movements[0]![0]).toBe('Fecha de reconocimiento');
    expect(movements).toHaveLength(1 + 2);
    expect(movements[1]).toContain('FV-1');
    expect(movements[1]).toContain(119000);
  });

  it('summarizes the totals and names the accounting method', () => {
    const flat = sheets[1]!.rows.flat();
    expect(flat).toContain('Causación');
    expect(flat).toContain(357000);
  });
});
