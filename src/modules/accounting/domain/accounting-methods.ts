import type { AccountingMethod, IncomeEntry } from './types';

/** An income entry together with the day it counts as revenue. */
export interface RecognizedItem {
  entry: IncomeEntry;
  /** ISO date on which the revenue is recognized under the chosen method. */
  date: string;
}

export interface MethodInfo {
  label: string;
  tagline: string;
  detail: string;
}

export const METHOD_INFO: Readonly<Record<AccountingMethod, MethodInfo>> = {
  accrual: {
    label: 'Causación',
    tagline: 'El ingreso cuenta el día de la factura.',
    detail: 'Las ventas pendientes de pago se registran como cuentas por cobrar.',
  },
  cash: {
    label: 'Caja',
    tagline: 'El ingreso cuenta el día que entra el dinero.',
    detail: 'Solo suma lo pagado. Sin fecha de pago usamos la fecha de la venta.',
  },
};

/**
 * Decides which entries are revenue, and when.
 *
 * - Accrual (causación): every sale, paid or pending, on the invoice date.
 * - Cash (caja): only paid sales, on the payment date; when the source has no payment
 *   date (point of sale, bank) the sale date is the payment date.
 */
export function recognize(entries: readonly IncomeEntry[], method: AccountingMethod): RecognizedItem[] {
  const items: RecognizedItem[] = [];
  for (const entry of entries) {
    if (method === 'accrual') {
      items.push({ entry, date: entry.date });
    } else if (entry.status === 'paid') {
      items.push({ entry, date: entry.paidDate ?? entry.date });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.entry.row - b.entry.row);
}
