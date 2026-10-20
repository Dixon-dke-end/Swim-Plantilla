import { recognize, type RecognizedItem } from './accounting-methods';
import type { AccountingMethod, IncomeEntry } from './types';

export interface LedgerTotals {
  /** Revenue including IVA. */
  gross: number;
  /** Revenue before IVA. */
  net: number;
  tax: number;
  /** Money customers still owe (pending invoices), whatever the method. */
  receivables: number;
  count: number;
  averageTicket: number;
}

export interface MonthBucket {
  /** `yyyy-mm` */
  key: string;
  gross: number;
  net: number;
  tax: number;
  count: number;
  /** Change in gross revenue against the previous month (0.1 = +10 %), or null if unknown. */
  change: number | null;
}

export interface BreakdownRow {
  label: string;
  gross: number;
  count: number;
  /** Share of total gross revenue (0 to 1). */
  share: number;
}

export interface Deltas {
  gross: number | null;
  net: number | null;
  tax: number | null;
  count: number | null;
  averageTicket: number | null;
}

export interface Ledger {
  method: AccountingMethod;
  items: RecognizedItem[];
  totals: LedgerTotals;
  byMonth: MonthBucket[];
  byChannel: BreakdownRow[];
  byCategory: BreakdownRow[];
  byPaymentMethod: BreakdownRow[];
  latestMonth: string | null;
  previousMonth: string | null;
  /** Latest month against the one before it. */
  deltas: Deltas;
}

const SHORT_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const LONG_MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** `2026-05` -> `may`, or `mayo 2026` when `long`. */
export function monthLabel(key: string, long = false): string {
  const [year, month] = key.split('-');
  const index = Number(month) - 1;
  const name = (long ? LONG_MONTHS : SHORT_MONTHS)[index] ?? key;
  return long ? `${name} ${year}` : name;
}

function nextMonth(key: string): string {
  const [year, month] = key.split('-').map(Number) as [number, number];
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
}

function change(current: number, previous: number): number | null {
  return previous === 0 ? null : (current - previous) / previous;
}

function breakdown(items: readonly RecognizedItem[], pick: (entry: IncomeEntry) => string, gross: number): BreakdownRow[] {
  const groups = new Map<string, { gross: number; count: number }>();
  for (const { entry } of items) {
    const label = pick(entry);
    const group = groups.get(label) ?? { gross: 0, count: 0 };
    group.gross += entry.total;
    group.count += 1;
    groups.set(label, group);
  }
  return [...groups.entries()]
    .map(([label, group]) => ({ label, ...group, share: gross === 0 ? 0 : group.gross / gross }))
    .sort((a, b) => b.gross - a.gross || a.label.localeCompare(b.label, 'es'));
}

function monthSeries(items: readonly RecognizedItem[]): MonthBucket[] {
  if (items.length === 0) return [];
  const buckets = new Map<string, MonthBucket>();
  for (const { entry, date } of items) {
    const key = date.slice(0, 7);
    const bucket = buckets.get(key) ?? { key, gross: 0, net: 0, tax: 0, count: 0, change: null };
    bucket.gross += entry.total;
    bucket.net += entry.net;
    bucket.tax += entry.tax;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  const keys = [...buckets.keys()].sort();
  const series: MonthBucket[] = [];
  for (let key = keys[0]!; key <= keys[keys.length - 1]!; key = nextMonth(key)) {
    const bucket = buckets.get(key) ?? { key, gross: 0, net: 0, tax: 0, count: 0, change: null };
    const previous = series[series.length - 1];
    bucket.change = previous ? change(bucket.gross, previous.gross) : null;
    series.push(bucket);
  }
  return series;
}

/** Everything the results page shows, computed from the clean entries under one accounting method. */
export function buildLedger(entries: readonly IncomeEntry[], method: AccountingMethod): Ledger {
  const items = recognize(entries, method);

  const gross = items.reduce((sum, { entry }) => sum + entry.total, 0);
  const net = items.reduce((sum, { entry }) => sum + entry.net, 0);
  const tax = items.reduce((sum, { entry }) => sum + entry.tax, 0);
  const receivables = entries.reduce((sum, entry) => sum + (entry.status === 'pending' ? entry.total : 0), 0);
  const totals: LedgerTotals = {
    gross,
    net,
    tax,
    receivables,
    count: items.length,
    averageTicket: items.length === 0 ? 0 : Math.round(gross / items.length),
  };

  const byMonth = monthSeries(items);
  const latest = byMonth[byMonth.length - 1];
  const previous = byMonth[byMonth.length - 2];
  const ticket = (bucket: MonthBucket) => (bucket.count === 0 ? 0 : bucket.gross / bucket.count);

  const deltas: Deltas =
    latest && previous
      ? {
          gross: change(latest.gross, previous.gross),
          net: change(latest.net, previous.net),
          tax: change(latest.tax, previous.tax),
          count: change(latest.count, previous.count),
          averageTicket: change(ticket(latest), ticket(previous)),
        }
      : { gross: null, net: null, tax: null, count: null, averageTicket: null };

  return {
    method,
    items,
    totals,
    byMonth,
    byChannel: breakdown(items, (entry) => entry.channel, gross),
    byCategory: breakdown(items, (entry) => entry.category, gross),
    byPaymentMethod: breakdown(items, (entry) => entry.paymentMethod, gross),
    latestMonth: latest?.key ?? null,
    previousMonth: previous?.key ?? null,
    deltas,
  };
}
