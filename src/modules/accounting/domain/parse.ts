import type { CellValue } from './types';

export function isBlank(value: CellValue): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

/**
 * Reads a monetary amount from whatever a spreadsheet hands us: real numbers or text such as
 * `$ 1.234.567,00` (Colombia), `1,234,567.00` (US), `1234567` or `(1.500)` (negative).
 *
 * A single separator followed by exactly three digits is a thousands separator (`1.234` is
 * one thousand two hundred thirty-four): in a sales ledger that is far likelier than a decimal.
 * Returns `null` for blanks and for text that is not an amount.
 */
export function parseAmount(value: CellValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  let text = value.trim();
  if (!text) return null;

  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }

  text = text
    .replace(/\b(?:COP|USD|EUR|COL)\b/gi, '')
    .replace(/[$€£\s ]/g, '');

  if (text.startsWith('-') || text.startsWith('−')) {
    negative = !negative;
    text = text.slice(1);
  } else if (text.endsWith('-')) {
    negative = !negative;
    text = text.slice(0, -1);
  } else if (text.startsWith('+')) {
    text = text.slice(1);
  }

  if (!/^[\d.,]+$/.test(text) || !/\d/.test(text)) return null;

  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  let decimal: '.' | ',' | null = null;

  if (lastDot >= 0 && lastComma >= 0) {
    decimal = lastDot > lastComma ? '.' : ',';
  } else if (lastDot >= 0 || lastComma >= 0) {
    const separator = lastDot >= 0 ? '.' : ',';
    const index = Math.max(lastDot, lastComma);
    const occurrences = text.split(separator).length - 1;
    const digitsAfter = text.length - index - 1;
    const integerPart = text.slice(0, index);
    if (occurrences === 1 && (digitsAfter !== 3 || integerPart === '0')) decimal = separator;
  }

  let normalized = text;
  if (decimal) {
    const thousands = decimal === '.' ? ',' : '.';
    normalized = normalized.split(thousands).join('').replace(decimal, '.');
  } else {
    normalized = normalized.replace(/[.,]/g, '');
  }

  const number = Number(normalized);
  if (!Number.isFinite(number)) return null;
  return negative ? -number : number;
}

const DAY_MS = 86_400_000;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Builds `yyyy-mm-dd`, or `null` when the day does not exist (31/02, month 13...). */
export function toISODate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
}

/** Excel stores dates as days since 1899-12-30. Plausible range: 1954 to 2119. */
function fromExcelSerial(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 20_000 || serial > 80_000) return null;
  const date = new Date(EXCEL_EPOCH + Math.floor(serial) * DAY_MS);
  return toISODate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/**
 * Reads a calendar date as `yyyy-mm-dd`.
 *
 * `Date` objects come from the spreadsheet reader already shifted to local time, so their
 * local fields are the ones the user sees in Excel. Text follows the Colombian `dd/mm/yyyy`
 * convention. Impossible dates (31/02/2026) return `null`.
 */
export function parseDate(value: CellValue): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return toISODate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === 'number') return fromExcelSerial(value);
  if (typeof value !== 'string') return null;

  const text = value.trim();
  if (!text) return null;

  if (/^\d{5}(?:\.\d+)?$/.test(text)) return fromExcelSerial(Number(text));

  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s,].*)?$/.exec(text);
  if (iso) return toISODate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const latin = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:[T\s,].*)?$/.exec(text);
  if (latin) {
    const year = latin[3]!.length === 2 ? 2000 + Number(latin[3]) : Number(latin[3]);
    return toISODate(year, Number(latin[2]), Number(latin[1]));
  }

  return null;
}
