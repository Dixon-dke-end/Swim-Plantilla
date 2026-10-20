import { describe, expect, it } from 'vitest';
import { makeEntry } from './fixtures';
import { ACCOUNTS, CHART_OF_ACCOUNTS_NOTE, buildJournal, journalTotals } from './journal';

const paidCard = makeEntry({ row: 2, invoice: 'FV-1', date: '2026-05-04', total: 119000, net: 100000, tax: 19000, status: 'paid', paidDate: '2026-05-06', paymentMethod: 'Tarjeta' });
const pendingWholesale = makeEntry({ row: 3, invoice: 'FV-2', date: '2026-05-05', total: 1560600, status: 'pending', paidDate: null, paymentMethod: 'Transferencia' });
const paidCash = makeEntry({ row: 4, invoice: 'FV-3', date: '2026-05-07', total: 159000, status: 'paid', paidDate: '2026-05-07', paymentMethod: 'Efectivo' });

function line(entry: ReturnType<typeof buildJournal>[number], account: string) {
  return entry.lines.find((candidate) => candidate.account === account);
}

describe('buildJournal: accrual (causación)', () => {
  const journal = buildJournal([paidCard, pendingWholesale, paidCash], 'accrual');

  it('books the invoice against Clientes, splitting revenue and IVA', () => {
    const invoice = journal.find((entry) => entry.document === 'FV-1' && entry.kind === 'invoice')!;
    expect(invoice.date).toBe('2026-05-04');
    expect(line(invoice, ACCOUNTS.receivable.code)).toMatchObject({ debit: 119000, credit: 0 });
    expect(line(invoice, ACCOUNTS.revenue.code)).toMatchObject({ debit: 0, credit: 100000 });
    expect(line(invoice, ACCOUNTS.vat.code)).toMatchObject({ debit: 0, credit: 19000 });
  });

  it('books the collection into Bancos for cards and transfers', () => {
    const collection = journal.find((entry) => entry.document === 'FV-1' && entry.kind === 'collection')!;
    expect(collection.date).toBe('2026-05-06');
    expect(line(collection, ACCOUNTS.bank.code)).toMatchObject({ debit: 119000 });
    expect(line(collection, ACCOUNTS.receivable.code)).toMatchObject({ credit: 119000 });
  });

  it('books the collection into Caja for cash payments', () => {
    const collection = journal.find((entry) => entry.document === 'FV-3' && entry.kind === 'collection')!;
    expect(line(collection, ACCOUNTS.cash.code)).toMatchObject({ debit: 159000 });
    expect(line(collection, ACCOUNTS.bank.code)).toBeUndefined();
  });

  it('does not book a collection for pending invoices', () => {
    expect(journal.filter((entry) => entry.document === 'FV-2').map((entry) => entry.kind)).toEqual(['invoice']);
  });

  it('numbers entries in date order', () => {
    expect(journal.map((entry) => entry.id)).toEqual(journal.map((_, index) => `AC-${String(index + 1).padStart(4, '0')}`));
    const dates = journal.map((entry) => entry.date);
    expect(dates).toEqual([...dates].sort());
  });
});

describe('buildJournal: cash (caja)', () => {
  const journal = buildJournal([paidCard, pendingWholesale, paidCash], 'cash');

  it('books revenue directly when the money arrives', () => {
    expect(journal).toHaveLength(2);
    const sale = journal.find((entry) => entry.document === 'FV-1')!;
    expect(sale.kind).toBe('cash-sale');
    expect(sale.date).toBe('2026-05-06');
    expect(line(sale, ACCOUNTS.bank.code)).toMatchObject({ debit: 119000 });
    expect(line(sale, ACCOUNTS.revenue.code)).toMatchObject({ credit: 100000 });
    expect(line(sale, ACCOUNTS.vat.code)).toMatchObject({ credit: 19000 });
    expect(line(sale, ACCOUNTS.receivable.code)).toBeUndefined();
  });

  it('skips pending invoices', () => {
    expect(journal.some((entry) => entry.document === 'FV-2')).toBe(false);
  });
});

describe('buildJournal: balance', () => {
  it('always balances in whole pesos, even with awkward rounding', () => {
    const awkward = [
      makeEntry({ row: 2, invoice: 'R1', total: 100001, net: 84034, tax: 16000, paidDate: '2026-05-05' }),
      makeEntry({ row: 3, invoice: 'R2', total: 99.5, net: 83.6, tax: 15.9, status: 'pending', paidDate: null }),
      makeEntry({ row: 4, invoice: 'R3', total: 333333, net: 280112, tax: 53221, paymentMethod: 'Efectivo' }),
    ];
    for (const method of ['accrual', 'cash'] as const) {
      const journal = buildJournal(awkward, method);
      for (const entry of journal) {
        expect(entry.debit).toBe(entry.credit);
        expect(entry.balanced).toBe(true);
        for (const l of entry.lines) {
          expect(Number.isInteger(l.debit)).toBe(true);
          expect(Number.isInteger(l.credit)).toBe(true);
        }
      }
    }
  });

  it('puts a rounding difference on the IVA line', () => {
    const entry = makeEntry({ row: 2, invoice: 'R1', total: 1000, net: 840.4, tax: 159.6 });
    const invoice = buildJournal([entry], 'accrual')[0]!;
    expect(line(invoice, ACCOUNTS.revenue.code)!.credit).toBe(840);
    expect(line(invoice, ACCOUNTS.vat.code)!.credit).toBe(160);
    expect(invoice.balanced).toBe(true);
  });

  it('omits the IVA line when there is no tax', () => {
    const entry = makeEntry({ row: 2, invoice: 'R1', total: 5000, net: 5000, tax: 0 });
    const invoice = buildJournal([entry], 'accrual')[0]!;
    expect(invoice.lines.map((l) => l.account)).toEqual([ACCOUNTS.receivable.code, ACCOUNTS.revenue.code]);
  });

  it('reverses the sides for negative amounts (credit notes)', () => {
    const entry = makeEntry({ row: 2, invoice: 'NC-1', total: -119000, net: -100000, tax: -19000 });
    const invoice = buildJournal([entry], 'accrual')[0]!;
    expect(line(invoice, ACCOUNTS.receivable.code)).toMatchObject({ debit: 0, credit: 119000 });
    expect(line(invoice, ACCOUNTS.revenue.code)).toMatchObject({ debit: 100000, credit: 0 });
    expect(invoice.balanced).toBe(true);
  });

  it('falls back to the source row when there is no invoice number', () => {
    const entry = makeEntry({ row: 17, invoice: null });
    expect(buildJournal([entry], 'accrual')[0]!.document).toBe('Fila 17');
  });
});

describe('journalTotals', () => {
  it('sums debits and credits across the journal', () => {
    const journal = buildJournal([paidCard, pendingWholesale, paidCash], 'accrual');
    const totals = journalTotals(journal);
    expect(totals.count).toBe(journal.length);
    expect(totals.debit).toBe(totals.credit);
    expect(totals.balanced).toBe(true);
    expect(totals.debit).toBe(119000 + 119000 + 1560600 + 159000 + 159000);
  });

  it('is balanced for an empty journal', () => {
    expect(journalTotals([])).toEqual({ debit: 0, credit: 0, count: 0, balanced: true });
  });
});

describe('chart of accounts note', () => {
  it('warns that the accounts must be validated by the accountant', () => {
    expect(CHART_OF_ACCOUNTS_NOTE).toMatch(/contador/i);
    expect(CHART_OF_ACCOUNTS_NOTE).toMatch(/configurable/i);
  });
});
