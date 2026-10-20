// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { detectDelimiter, decodeText, readWorkbook } from './sheet-reader';

function workbookBytes(sheets: Record<string, unknown[][]>, origin?: string): Uint8Array {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows, (origin ? { origin } : {}) as XLSX.AOA2SheetOpts), name);
  }
  return new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx', cellDates: true }));
}

const encode = (text: string) => new TextEncoder().encode(text);

describe('detectDelimiter', () => {
  it('prefers semicolons for Colombian exports', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
  });

  it('detects commas and tabs', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
  });

  it('is not fooled by decimal commas inside a semicolon file', () => {
    expect(detectDelimiter('Fecha;Total\n2026-01-01;1.234,50\n2026-01-02;2.000,00')).toBe(';');
  });
});

describe('decodeText', () => {
  it('strips a UTF-8 byte order mark', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...encode('Fecha;Descripción')]);
    expect(decodeText(bytes)).toBe('Fecha;Descripción');
  });

  it('falls back to Windows-1252 for legacy exports', () => {
    const bytes = new Uint8Array([0x44, 0xe9, 0x62, 0x69, 0x74, 0x6f]); // "Débito" in latin1 is D é b i t o
    expect(decodeText(bytes)).toBe('Débito');
  });
});

describe('readWorkbook: xlsx', () => {
  it('reads every sheet and picks the one with recognizable headers', async () => {
    const bytes = workbookBytes({
      Instrucciones: [['Fecha', 'Qué escribir'], ['Total', 'Se calcula']],
      Ventas: [['Fecha', 'Factura', 'Cliente', 'Total'], [new Date(2026, 4, 4), 'F-1', 'Ana', 119000]],
      Listas: [['Canal'], ['Tienda']],
    });
    const book = await readWorkbook(bytes, 'libro.xlsx');
    expect(book.format).toBe('xlsx');
    expect(book.sheets.map((sheet) => sheet.name)).toEqual(['Instrucciones', 'Ventas', 'Listas']);
    expect(book.sheets[book.defaultSheet]!.name).toBe('Ventas');
    expect(book.sheets[book.defaultSheet]!.headerRowIndex).toBe(0);
  });

  it('returns dates as Date objects and trims trailing blank rows', async () => {
    const bytes = workbookBytes({ Ventas: [['Fecha', 'Total'], [new Date(2026, 4, 4), 100], [null, null], [null, null]] });
    const book = await readWorkbook(bytes, 'libro.xlsx');
    const rows = book.sheets[0]!.rows;
    expect(rows).toHaveLength(2);
    expect(rows[1]![0]).toBeInstanceOf(Date);
  });

  it('keeps original row numbers when the data starts below row 1', async () => {
    const bytes = workbookBytes({ Ventas: [['Fecha', 'Total'], [new Date(2026, 4, 4), 100]] }, 'A3');
    const book = await readWorkbook(bytes, 'libro.xlsx');
    const sheet = book.sheets[0]!;
    expect(sheet.headerRowIndex).toBe(2);
    expect(sheet.rows[2]![0]).toBe('Fecha');
  });

  it('accepts a Blob', async () => {
    const bytes = workbookBytes({ Ventas: [['Fecha', 'Total'], [new Date(2026, 4, 4), 100]] });
    const book = await readWorkbook(new Blob([bytes.buffer as ArrayBuffer]), 'libro.xlsx');
    expect(book.sheets).toHaveLength(1);
  });

  it('rejects files that are not spreadsheets', async () => {
    await expect(readWorkbook(encode('no soy un excel'), 'datos.xlsx')).rejects.toThrow();
  });
});

describe('readWorkbook: csv', () => {
  it('keeps text exactly as written so Colombian numbers survive', async () => {
    const csv = '﻿Fecha transacción;Descripción;Crédito\n2026-09-01;ABONO;318.000,00\n';
    const book = await readWorkbook(encode(csv), 'banco.csv');
    expect(book.format).toBe('csv');
    expect(book.sheets).toHaveLength(1);
    expect(book.sheets[0]!.rows).toEqual([
      ['Fecha transacción', 'Descripción', 'Crédito'],
      ['2026-09-01', 'ABONO', '318.000,00'],
    ]);
  });

  it('detects the header row in CSV files with a banner', async () => {
    const csv = 'Extracto enero\n\nFecha;Débito;Crédito\n2026-01-01;;1.000,00\n';
    const book = await readWorkbook(encode(csv), 'banco.csv');
    expect(book.sheets[0]!.headerRowIndex).toBe(2);
  });
});
