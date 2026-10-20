import { recognize } from './accounting-methods';
import type { AccountingMethod, IncomeEntry } from './types';

/**
 * Accounts of the Colombian PUC (Plan Único de Cuentas) used for sales.
 * They are a sensible default for a retail business, not a mandate.
 */
export const ACCOUNTS = {
  cash: { code: '1105', name: 'Caja' },
  bank: { code: '1110', name: 'Bancos' },
  receivable: { code: '130505', name: 'Clientes nacionales' },
  revenue: { code: '4135', name: 'Comercio al por mayor y al por menor' },
  vat: { code: '240805', name: 'IVA generado' },
} as const;

export const CHART_OF_ACCOUNTS_NOTE =
  'Cuentas del PUC colombiano. El plan de cuentas es configurable y debe ser validado por el contador de la empresa antes de usar estos asientos.';

export interface JournalLine {
  account: string;
  name: string;
  debit: number;
  credit: number;
}

/**
 * - `invoice`: sale recognized on the invoice date (causación).
 * - `collection`: the customer paid an earlier invoice (causación).
 * - `cash-sale`: sale recognized when the money arrives (caja).
 */
export type JournalKind = 'invoice' | 'collection' | 'cash-sale';

export interface JournalEntry {
  id: string;
  date: string;
  kind: JournalKind;
  /** Invoice, ticket or reference the entry comes from. */
  document: string;
  concept: string;
  lines: JournalLine[];
  debit: number;
  credit: number;
  balanced: boolean;
}

type Account = { code: string; name: string };
type Draft = Omit<JournalEntry, 'id' | 'debit' | 'credit' | 'balanced'> & { order: number; row: number };

/** A positive amount goes on the natural side; a negative one (credit note) reverses it. */
function line(account: Account, amount: number, natural: 'debit' | 'credit'): JournalLine | null {
  if (amount === 0) return null;
  const onNatural = amount > 0;
  const value = Math.abs(amount);
  const debit = (natural === 'debit') === onNatural ? value : 0;
  return { account: account.code, name: account.name, debit, credit: debit === 0 ? value : 0 };
}

function lines(...candidates: Array<JournalLine | null>): JournalLine[] {
  return candidates.filter((candidate): candidate is JournalLine => candidate !== null);
}

function settlementAccount(entry: IncomeEntry): Account {
  return /efectivo|caja|cash/i.test(entry.paymentMethod) ? ACCOUNTS.cash : ACCOUNTS.bank;
}

function documentOf(entry: IncomeEntry): string {
  return entry.invoice ?? `Fila ${entry.row}`;
}

function conceptOf(prefix: string, entry: IncomeEntry): string {
  const detail = entry.client || entry.product || entry.notes;
  return detail ? `${prefix} · ${detail}` : prefix;
}

/** Whole pesos; the rounding difference always lands on the tax line so the entry balances. */
function amountsOf(entry: IncomeEntry): { total: number; net: number; tax: number } {
  const total = Math.round(entry.total);
  const net = Math.round(entry.net);
  return { total, net, tax: total - net };
}

function sale(entry: IncomeEntry, debitAccount: Account): JournalLine[] {
  const { total, net, tax } = amountsOf(entry);
  return lines(line(debitAccount, total, 'debit'), line(ACCOUNTS.revenue, net, 'credit'), line(ACCOUNTS.vat, tax, 'credit'));
}

/**
 * Builds the journal (libro diario) for the chosen accounting method.
 *
 * Accrual: on the invoice Dr Clientes / Cr Ingresos, Cr IVA; when paid Dr Caja or Bancos / Cr Clientes.
 * Cash: when paid Dr Caja or Bancos / Cr Ingresos, Cr IVA.
 * Every entry balances in whole pesos.
 */
export function buildJournal(entries: readonly IncomeEntry[], method: AccountingMethod): JournalEntry[] {
  const drafts: Draft[] = [];

  if (method === 'accrual') {
    for (const entry of entries) {
      drafts.push({
        date: entry.date,
        kind: 'invoice',
        document: documentOf(entry),
        concept: conceptOf('Venta', entry),
        lines: sale(entry, ACCOUNTS.receivable),
        order: 0,
        row: entry.row,
      });
      if (entry.status === 'paid') {
        const { total } = amountsOf(entry);
        drafts.push({
          date: entry.paidDate ?? entry.date,
          kind: 'collection',
          document: documentOf(entry),
          concept: conceptOf('Recaudo', entry),
          lines: lines(line(settlementAccount(entry), total, 'debit'), line(ACCOUNTS.receivable, total, 'credit')),
          order: 1,
          row: entry.row,
        });
      }
    }
  } else {
    for (const { entry, date } of recognize(entries, 'cash')) {
      drafts.push({
        date,
        kind: 'cash-sale',
        document: documentOf(entry),
        concept: conceptOf('Venta de contado', entry),
        lines: sale(entry, settlementAccount(entry)),
        order: 0,
        row: entry.row,
      });
    }
  }

  drafts.sort((a, b) => a.date.localeCompare(b.date) || a.row - b.row || a.order - b.order);

  return drafts.map(({ order: _order, row: _row, ...draft }, index) => {
    const debit = draft.lines.reduce((sum, l) => sum + l.debit, 0);
    const credit = draft.lines.reduce((sum, l) => sum + l.credit, 0);
    return { ...draft, id: `AC-${String(index + 1).padStart(4, '0')}`, debit, credit, balanced: debit === credit };
  });
}

export interface JournalTotals {
  debit: number;
  credit: number;
  count: number;
  balanced: boolean;
}

export function journalTotals(journal: readonly JournalEntry[]): JournalTotals {
  const debit = journal.reduce((sum, entry) => sum + entry.debit, 0);
  const credit = journal.reduce((sum, entry) => sum + entry.credit, 0);
  return { debit, credit, count: journal.length, balanced: debit === credit && journal.every((entry) => entry.balanced) };
}
