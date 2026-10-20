import { METHOD_INFO } from '../domain/accounting-methods';
import type { JournalEntry } from '../domain/journal';
import { monthLabel, type Ledger } from '../domain/ledger';
import type { AccountingMethod, IncomeEntry } from '../domain/types';

export type ExportCell = string | number;

export interface ExportSheet {
  name: string;
  rows: ExportCell[][];
}

const DELIMITER = ';';

function csvField(value: ExportCell): string {
  const text = String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Journal entries as CSV: semicolon-delimited with a byte order mark, which is what Colombian
 * spreadsheets open correctly. Amounts are plain integers so any accounting package can import them.
 */
export function journalToCsv(journal: readonly JournalEntry[]): string {
  const rows: ExportCell[][] = [['Asiento', 'Fecha', 'Documento', 'Concepto', 'Cuenta', 'Nombre de la cuenta', 'Débito', 'Crédito']];
  for (const entry of journal) {
    for (const line of entry.lines) {
      rows.push([entry.id, entry.date, entry.document, entry.concept, line.account, line.name, line.debit, line.credit]);
    }
  }
  return `﻿${rows.map((row) => row.map(csvField).join(DELIMITER)).join('\r\n')}\r\n`;
}

/** The income book and its summary, as plain rows ready to become worksheets. */
export function ledgerSheets(_entries: readonly IncomeEntry[], ledger: Ledger, method: AccountingMethod): ExportSheet[] {
  const movements: ExportCell[][] = [
    [
      'Fecha de reconocimiento', 'Fecha de la venta', 'N.º de factura', 'Cliente', 'Canal', 'Categoría', 'Producto', 'Cantidad',
      'Total', 'Base', 'IVA', 'Medio de pago', 'Estado', 'Fila en el archivo',
    ],
    ...ledger.items.map(({ entry, date }): ExportCell[] => [
      date, entry.date, entry.invoice ?? '', entry.client, entry.channel, entry.category, entry.product, entry.quantity,
      entry.total, entry.net, entry.tax, entry.paymentMethod, entry.status === 'paid' ? 'Pagado' : 'Pendiente', entry.row,
    ]),
  ];

  const { totals } = ledger;
  const summary: ExportCell[][] = [
    ['Método contable', METHOD_INFO[method].label],
    [],
    ['Ingresos brutos', totals.gross],
    ['Ingresos netos', totals.net],
    ['IVA generado', totals.tax],
    ['Cuentas por cobrar', totals.receivables],
    ['Ventas', totals.count],
    ['Ticket promedio', totals.averageTicket],
    [],
    ['Mes', 'Ingresos brutos', 'Ventas'],
    ...ledger.byMonth.map((month): ExportCell[] => [monthLabel(month.key, true), month.gross, month.count]),
    [],
    ['Canal', 'Ingresos brutos', 'Ventas'],
    ...ledger.byChannel.map((row): ExportCell[] => [row.label, row.gross, row.count]),
    [],
    ['Categoría', 'Ingresos brutos', 'Ventas'],
    ...ledger.byCategory.map((row): ExportCell[] => [row.label, row.gross, row.count]),
    [],
    ['Medio de pago', 'Ingresos brutos', 'Ventas'],
    ...ledger.byPaymentMethod.map((row): ExportCell[] => [row.label, row.gross, row.count]),
  ];

  return [
    { name: 'Libro de ingresos', rows: movements },
    { name: 'Resumen', rows: summary },
  ];
}

/** Starts a browser download for a file built in memory. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadLedgerXlsx(entries: readonly IncomeEntry[], ledger: Ledger, method: AccountingMethod): Promise<void> {
  const XLSX = await import('xlsx');
  const book = XLSX.utils.book_new();
  for (const sheet of ledgerSheets(entries, ledger, method)) {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
    worksheet['!cols'] = sheet.rows[0]?.map((_, index) => ({ wch: index === 0 ? 24 : 18 })) ?? [];
    XLSX.utils.book_append_sheet(book, worksheet, sheet.name);
  }
  const data: ArrayBuffer = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
  downloadBlob(
    new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `libro-de-ingresos-${method === 'accrual' ? 'causacion' : 'caja'}.xlsx`,
  );
}

export function downloadJournalCsv(journal: readonly JournalEntry[], method: AccountingMethod): void {
  downloadBlob(
    new Blob([journalToCsv(journal)], { type: 'text/csv;charset=utf-8' }),
    `asientos-contables-${method === 'accrual' ? 'causacion' : 'caja'}.csv`,
  );
}
