import { normalizeHeader } from './column-mapping';
import { isBlank, parseAmount, parseDate } from './parse';
import type { ProfileDefaults } from './profiles';
import type {
  CellValue,
  ColumnMapping,
  EntryStatus,
  ImportIssue,
  ImportResult,
  IncomeEntry,
  IncomeField,
  IncomeRule,
  SheetRow,
  TaxMode,
} from './types';

export interface NormalizeProfile {
  taxMode: TaxMode;
  taxRate: number;
  incomeRule: IncomeRule;
  defaults?: ProfileDefaults | undefined;
}

const SUMMARY_PATTERN = /^(?:gran |sub )?total(?:es)?(?: general)?$|^sumas?$/;
const VOID_PATTERN = /anul|void|cancel|devuel|reversad/;
const PENDING_PATTERN = /pend|por cobrar|credito|cartera|unpaid|sin pagar|abierta|\bopen\b/;

const FALLBACK = {
  channel: 'Sin especificar',
  category: 'Sin categoría',
  paymentMethod: 'Sin especificar',
} as const;

function text(value: CellValue): string {
  if (value === null || value === undefined || value instanceof Date) return '';
  return String(value).trim();
}

function describe(value: CellValue): string {
  return value instanceof Date ? value.toLocaleDateString('es-CO') : text(value);
}

/** `Anulado` and friends are cancelled; anything pending is receivable; the rest is paid. */
function classifyStatus(value: CellValue): EntryStatus | 'void' {
  if (isBlank(value)) return 'paid';
  const normalized = normalizeHeader(text(value));
  if (VOID_PATTERN.test(normalized)) return 'void';
  if (PENDING_PATTERN.test(normalized)) return 'pending';
  return 'paid';
}

function isSummaryRow(row: SheetRow, hasDate: boolean): boolean {
  if (hasDate) return false;
  return row.some((cell) => typeof cell === 'string' && SUMMARY_PATTERN.test(normalizeHeader(cell)));
}

interface Amounts {
  total: number;
  net: number;
  tax: number;
}

interface AmountInputs {
  total: number | null;
  net: number | null;
  tax: number | null;
  taxMode: TaxMode;
  taxRate: number;
}

/** Whole pesos, with any rounding difference left on the tax line. */
function settle(total: number, net: number): Amounts {
  const roundedTotal = Math.round(total);
  const roundedNet = Math.round(net);
  return { total: roundedTotal, net: roundedNet, tax: roundedTotal - roundedNet };
}

export function resolveAmounts({ total, net, tax, taxMode, taxRate }: AmountInputs): Amounts | null {
  if (taxMode === 'none') {
    const value = total ?? net;
    return value === null ? null : settle(value, value);
  }

  if (total !== null && (net !== null || tax !== null)) {
    return settle(total, net ?? total - (tax ?? 0));
  }
  if (total !== null) {
    return taxMode === 'included' ? settle(total, total / (1 + taxRate)) : settle(total + total * taxRate, total);
  }
  if (net !== null) {
    const owed = tax ?? net * taxRate;
    return settle(net + owed, net);
  }
  return null;
}

/**
 * Turns raw spreadsheet rows into clean income entries and an honest report of what was
 * left out and why. Blank rows and totals rows are skipped silently, cancelled rows are
 * counted, repeated invoice numbers keep their first occurrence, and unusable rows become
 * issues that point at the original sheet row.
 *
 * @param rowOffset sheet rows above `rows[0]` (when the sheet does not start at row 1)
 */
export function normalizeRows(
  rows: readonly SheetRow[],
  headerRowIndex: number,
  mapping: ColumnMapping,
  profile: NormalizeProfile,
  rowOffset = 0,
): ImportResult {
  const result: ImportResult = { entries: [], issues: [], skippedSummaryRows: [], ignoredMovements: 0, voided: 0, dataRows: 0 };
  const firstSeen = new Map<string, number>();
  const creditOnly = profile.incomeRule === 'credit-column-only';

  const issue = (row: number, kind: ImportIssue['kind'], reason: string, field?: IncomeField, invoice?: string) => {
    result.issues.push({ row, kind, reason, ...(field ? { field } : {}), ...(invoice ? { invoice } : {}) });
  };

  for (let index = headerRowIndex + 1; index < rows.length; index++) {
    const row = rows[index] ?? [];
    const rowNumber = rowOffset + index + 1;
    const cell = (field: IncomeField): CellValue => {
      const column = mapping[field];
      return column === undefined ? undefined : row[column];
    };

    if (row.every(isBlank)) continue;

    const dateCell = cell('date');
    const date = parseDate(dateCell);
    if (isSummaryRow(row, date !== null)) {
      result.skippedSummaryRows.push(rowNumber);
      continue;
    }

    result.dataRows++;

    const status = classifyStatus(cell('status'));
    if (status === 'void') {
      result.voided++;
      continue;
    }

    let credit: number | null = null;
    if (creditOnly) {
      credit = parseAmount(cell('credit'));
      if (credit === null || credit <= 0) {
        result.ignoredMovements++;
        continue;
      }
    }

    if (date === null) {
      issue(
        rowNumber,
        'error',
        isBlank(dateCell) ? 'Falta la fecha.' : `La fecha «${describe(dateCell)}» no es válida.`,
        'date',
      );
      continue;
    }

    const quantity = parseAmount(cell('quantity'));
    const unitPrice = parseAmount(cell('unitPrice'));
    const discount = parseAmount(cell('discount')) ?? 0;
    const explicitTotal = creditOnly ? credit : parseAmount(cell('total'));
    const computedTotal = explicitTotal ?? (unitPrice !== null ? (quantity ?? 1) * unitPrice - discount : null);

    const amounts = resolveAmounts({
      total: computedTotal,
      net: parseAmount(cell('net')),
      tax: parseAmount(cell('tax')),
      taxMode: profile.taxMode,
      taxRate: profile.taxRate,
    });

    if (amounts === null) {
      const raw = cell('total');
      issue(
        rowNumber,
        'error',
        !isBlank(raw) && parseAmount(raw) === null
          ? `El valor «${describe(raw)}» no es un número.`
          : 'No hay valor de venta: faltan el total o el precio unitario.',
        'total',
      );
      continue;
    }
    if (amounts.total === 0) {
      issue(rowNumber, 'error', 'El valor de la venta es cero.', 'total');
      continue;
    }

    const invoice = text(cell('invoice')) || null;
    if (invoice) {
      const key = invoice.toUpperCase();
      const original = firstSeen.get(key);
      if (original !== undefined) {
        issue(rowNumber, 'duplicate', `El número ${invoice} ya aparece en la fila ${original}; se dejó la primera.`, 'invoice', invoice);
        continue;
      }
      firstSeen.set(key, rowNumber);
    }

    const defaults = profile.defaults ?? {};
    const entry: IncomeEntry = {
      row: rowNumber,
      date,
      invoice,
      client: text(cell('client')),
      channel: text(cell('channel')) || defaults.channel || FALLBACK.channel,
      category: text(cell('category')) || defaults.category || FALLBACK.category,
      product: text(cell('product')),
      quantity: quantity ?? 1,
      unitPrice,
      discount,
      total: amounts.total,
      net: amounts.net,
      tax: amounts.tax,
      paymentMethod: text(cell('paymentMethod')) || defaults.paymentMethod || FALLBACK.paymentMethod,
      status,
      paidDate: status === 'paid' ? parseDate(cell('paidDate')) : null,
      notes: text(cell('notes')),
    };
    result.entries.push(entry);
  }

  return result;
}
