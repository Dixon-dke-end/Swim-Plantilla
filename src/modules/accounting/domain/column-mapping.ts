import type { CellValue, ColumnMapping, IncomeField, IncomeRule, SheetRow } from './types';

export type MatchConfidence = 'exact' | 'synonym' | 'fuzzy';

export interface FieldMatch {
  field: IncomeField;
  confidence: MatchConfidence;
}

export interface AutoMapResult {
  mapping: ColumnMapping;
  confidence: Partial<Record<IncomeField, MatchConfidence>>;
}

/** Lowercase, no accents, no punctuation: `N° Factura` -> `n factura`. */
export function normalizeHeader(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * What accountants and software call each column, in Spanish and English.
 * The first entry of each list is the canonical name (an `exact` match); the rest are synonyms.
 */
const RAW_SYNONYMS: Readonly<Record<IncomeField, readonly string[]>> = {
  date: [
    'fecha', 'date', 'fecha venta', 'fecha de venta', 'fecha factura', 'fecha de factura', 'fecha transacción',
    'fecha de transacción', 'fecha/hora', 'fecha y hora', 'fecha emisión', 'fecha de emisión', 'fecha operación',
    'fecha contable', 'transaction date', 'invoice date', 'sale date', 'posting date', 'día',
  ],
  invoice: [
    'n° factura', 'no factura', 'nro factura', 'número de factura', 'número factura', 'factura', 'invoice', 'invoice number',
    'invoice no', 'ticket', 'n° ticket', 'número de ticket', 'referencia', 'ref', 'reference', 'documento',
    'n° documento', 'consecutivo', 'comprobante', 'recibo', 'pedido', 'order', 'order id',
  ],
  client: ['cliente', 'customer', 'client', 'nombre cliente', 'nombre del cliente', 'razón social', 'tercero', 'comprador', 'buyer', 'name'],
  channel: ['canal', 'channel', 'canal de venta', 'origen', 'fuente', 'source', 'sucursal', 'tienda', 'sede'],
  category: ['categoría', 'category', 'línea', 'rubro', 'tipo de producto', 'familia', 'grupo'],
  product: ['producto', 'product', 'artículo', 'item', 'nombre producto', 'nombre del producto', 'product name', 'descripción producto'],
  quantity: ['cantidad', 'cant', 'qty', 'quantity', 'unidades', 'units', 'uds'],
  unitPrice: [
    'precio unitario', 'precio unitario (iva incl.)', 'precio', 'valor unitario', 'vr unitario', 'unit price', 'price',
    'precio unit', 'precio de venta',
  ],
  discount: ['descuento', 'desc', 'discount', 'dto', 'rebaja'],
  total: [
    'total', 'total venta', 'total ventas', 'valor total', 'total factura', 'valor', 'monto', 'importe', 'amount',
    'total amount', 'venta total', 'vr total', 'valor venta', 'total con iva', 'total iva incluido', 'ingreso', 'ingresos',
  ],
  net: [
    'base gravable', 'base', 'valor neto', 'neto', 'subtotal', 'net', 'net amount', 'base imponible', 'valor antes de iva',
    'valor sin iva', 'sin iva', 'subtotal sin iva',
  ],
  tax: ['iva', 'iva 19%', 'impuesto', 'impuestos', 'tax', 'vat', 'valor iva', 'iva generado', 'impuesto iva'],
  paymentMethod: [
    'medio de pago', 'forma de pago', 'método de pago', 'método pago', 'medio pago', 'forma pago', 'payment method',
    'payment', 'tipo de pago', 'pago con',
  ],
  status: ['estado', 'status', 'estado de pago', 'estado pago', 'situación', 'state'],
  paidDate: [
    'fecha de pago', 'fecha pago', 'fecha de recaudo', 'fecha recaudo', 'fecha de cobro', 'fecha cobro', 'paid date',
    'payment date', 'fecha de abono', 'fecha abono',
  ],
  credit: ['crédito', 'créditos', 'credit', 'depósito', 'depósitos', 'deposit', 'entrada', 'entradas', 'abono', 'abonos', 'valor crédito'],
  debit: ['débito', 'débitos', 'debit', 'cargo', 'cargos', 'retiro', 'retiros', 'withdrawal', 'salida', 'salidas', 'valor débito'],
  notes: ['notas', 'nota', 'notes', 'note', 'observaciones', 'observación', 'comentarios', 'comentario', 'descripción', 'detalle', 'concepto', 'description', 'memo'],
};

interface SynonymEntry {
  field: IncomeField;
  text: string;
  tokens: readonly string[];
  canonical: boolean;
}

const SYNONYMS: readonly SynonymEntry[] = (Object.keys(RAW_SYNONYMS) as IncomeField[]).flatMap((field) =>
  RAW_SYNONYMS[field].map((raw, index) => {
    const text = normalizeHeader(raw);
    return { field, text, tokens: text.split(' '), canonical: index === 0 };
  }),
);

/** Exposed for the UI: how many names we know for each field. */
export const SYNONYM_COUNT = SYNONYMS.length;

interface Candidate extends FieldMatch {
  /** Higher wins between candidates of the same confidence. */
  score: number;
}

const RANK: Record<MatchConfidence, number> = { exact: 3, synonym: 2, fuzzy: 1 };

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function candidatesFor(header: CellValue): Candidate[] {
  if (typeof header !== 'string') return [];
  const text = normalizeHeader(header);
  if (!text || text.length > 60) return [];
  const tokens = text.split(' ');
  const found: Candidate[] = [];

  for (const synonym of SYNONYMS) {
    if (synonym.text === text) {
      found.push({ field: synonym.field, confidence: synonym.canonical ? 'exact' : 'synonym', score: 1 });
      continue;
    }
    const looseEnough = synonym.tokens.length >= 2 || synonym.text.length >= 5;
    if (!looseEnough) continue;
    const contained = synonym.tokens.every((token) => tokens.includes(token));
    if (contained) {
      found.push({ field: synonym.field, confidence: 'fuzzy', score: synonym.tokens.length / tokens.length });
      continue;
    }
    // A typo in a single-word header ("cantidd").
    if (tokens.length === 1 && synonym.tokens.length === 1 && synonym.text.length >= 6 && editDistanceAtMostOne(text, synonym.text)) {
      found.push({ field: synonym.field, confidence: 'fuzzy', score: 0.4 });
    }
  }
  return found;
}

function compare(a: Candidate, b: Candidate): number {
  return RANK[b.confidence] - RANK[a.confidence] || b.score - a.score;
}

/** Best guess for a single header cell, or `null` when it is not a known column. */
export function recognizeHeader(header: CellValue): FieldMatch | null {
  const best = candidatesFor(header).sort(compare)[0];
  return best ? { field: best.field, confidence: best.confidence } : null;
}

/**
 * Finds the header row among the first 20 rows: the one that names the most different fields.
 * Title rows, blank rows and report banners above it are skipped.
 */
export function detectHeaderRow(rows: readonly SheetRow[]): number {
  let best = -1;
  let bestScore = 0;
  const limit = Math.min(rows.length, 20);

  for (let index = 0; index < limit; index++) {
    const fields = new Set<IncomeField>();
    for (const cell of rows[index] ?? []) {
      const match = recognizeHeader(cell);
      if (match) fields.add(match.field);
    }
    if (fields.size > bestScore) {
      best = index;
      bestScore = fields.size;
    }
  }

  if (bestScore >= 2) return best;

  const firstFilled = rows.findIndex((row) => row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ''));
  return Math.max(0, firstFilled);
}

/**
 * Assigns each recognized header to a field. Stronger matches claim columns first, and no
 * column or field is used twice.
 */
export function autoMap(headers: readonly CellValue[]): AutoMapResult {
  const all: Array<Candidate & { column: number }> = [];
  headers.forEach((header, column) => {
    for (const candidate of candidatesFor(header)) all.push({ ...candidate, column });
  });
  all.sort((a, b) => compare(a, b) || a.column - b.column);

  const mapping: ColumnMapping = {};
  const confidence: Partial<Record<IncomeField, MatchConfidence>> = {};
  const usedColumns = new Set<number>();

  for (const candidate of all) {
    if (usedColumns.has(candidate.column) || mapping[candidate.field] !== undefined) continue;
    mapping[candidate.field] = candidate.column;
    confidence[candidate.field] = candidate.confidence;
    usedColumns.add(candidate.column);
  }
  return { mapping, confidence };
}

/** What the importer cannot work without, given how income is read. */
export function missingRequiredFields(mapping: ColumnMapping, rule: IncomeRule): IncomeField[] {
  const has = (field: IncomeField) => mapping[field] !== undefined;
  const missing: IncomeField[] = [];
  if (!has('date')) missing.push('date');
  if (rule === 'credit-column-only') {
    if (!has('credit')) missing.push('credit');
  } else if (!(has('total') || has('net') || (has('quantity') && has('unitPrice')))) {
    missing.push('total');
  }
  return missing;
}
