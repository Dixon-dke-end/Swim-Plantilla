/**
 * Shared vocabulary of the accounting module. Pure types: no DOM, no spreadsheet library.
 */

/** Every concept the importer knows how to read from a spreadsheet column. */
export type IncomeField =
  | 'date'
  | 'invoice'
  | 'client'
  | 'channel'
  | 'category'
  | 'product'
  | 'quantity'
  | 'unitPrice'
  | 'discount'
  | 'total'
  | 'net'
  | 'tax'
  | 'paymentMethod'
  | 'status'
  | 'paidDate'
  | 'credit'
  | 'debit'
  | 'notes';

/** Display order of the fields in the mapping step. */
export const INCOME_FIELDS: readonly IncomeField[] = [
  'date',
  'invoice',
  'client',
  'channel',
  'category',
  'product',
  'quantity',
  'unitPrice',
  'discount',
  'total',
  'net',
  'tax',
  'paymentMethod',
  'status',
  'paidDate',
  'credit',
  'debit',
  'notes',
];

export const FIELD_LABELS: Readonly<Record<IncomeField, string>> = {
  date: 'Fecha',
  invoice: 'N.º de factura o referencia',
  client: 'Cliente',
  channel: 'Canal de venta',
  category: 'Categoría',
  product: 'Producto',
  quantity: 'Cantidad',
  unitPrice: 'Precio unitario',
  discount: 'Descuento',
  total: 'Total',
  net: 'Base o valor neto',
  tax: 'IVA o impuesto',
  paymentMethod: 'Medio de pago',
  status: 'Estado',
  paidDate: 'Fecha de pago',
  credit: 'Crédito (entradas)',
  debit: 'Débito (salidas)',
  notes: 'Descripción o notas',
};

/** A raw spreadsheet cell as read by the adapter. */
export type CellValue = string | number | boolean | Date | null | undefined;
export type SheetRow = readonly CellValue[];

/** Field → zero-based column index. */
export type ColumnMapping = Partial<Record<IncomeField, number>>;

/** `accrual` = causación, `cash` = caja. */
export type AccountingMethod = 'accrual' | 'cash';
export type TaxMode = 'included' | 'excluded' | 'none';
export type IncomeRule = 'all-rows' | 'credit-column-only';
export type EntryStatus = 'paid' | 'pending';

/** One income record after normalization. Amounts are whole pesos. */
export interface IncomeEntry {
  /** Row number in the original sheet (1-based), for traceability. */
  row: number;
  /** ISO date `yyyy-mm-dd`. */
  date: string;
  invoice: string | null;
  client: string;
  channel: string;
  category: string;
  product: string;
  quantity: number;
  unitPrice: number | null;
  discount: number;
  /** Gross amount (tax included). */
  total: number;
  /** Amount before tax. */
  net: number;
  tax: number;
  paymentMethod: string;
  status: EntryStatus;
  /** ISO date when the money came in, if the source says so. */
  paidDate: string | null;
  notes: string;
}

export interface ImportIssue {
  /** Row number in the original sheet (1-based). */
  row: number;
  field?: IncomeField;
  /** `error` rows are rejected; `duplicate` rows are flagged and left out. */
  kind: 'error' | 'duplicate';
  /** Human-readable reason, in Spanish. */
  reason: string;
  invoice?: string;
}

export interface ImportResult {
  entries: IncomeEntry[];
  issues: ImportIssue[];
  /** Row numbers of totals/summary rows that were skipped on purpose. */
  skippedSummaryRows: number[];
  /** Movements that are not income (e.g. bank debits). */
  ignoredMovements: number;
  /** Cancelled rows ("Anulado"), excluded from income. */
  voided: number;
  /** Non-blank, non-summary rows examined. */
  dataRows: number;
}
