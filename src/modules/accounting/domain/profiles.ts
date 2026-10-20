import { normalizeHeader } from './column-mapping';
import type { AccountingMethod, CellValue, ColumnMapping, IncomeField, IncomeRule, TaxMode } from './types';

/** Values to use for fields the source file does not have. */
export interface ProfileDefaults {
  channel?: string;
  category?: string;
  paymentMethod?: string;
}

/**
 * A saved way of reading one kind of spreadsheet. The mapping stores header *names*,
 * not column numbers, so it keeps working when columns are reordered.
 */
export interface ImportProfile {
  id: string;
  name: string;
  description: string;
  mapping: Partial<Record<IncomeField, string>>;
  accountingMethod: AccountingMethod;
  taxMode: TaxMode;
  taxRate: number;
  incomeRule: IncomeRule;
  defaults?: ProfileDefaults;
  builtIn?: boolean;
}

export const DEFAULT_TAX_RATE = 0.19;

export const BUILT_IN_PROFILES: readonly ImportProfile[] = [
  {
    id: 'marea',
    name: 'Plantilla MAREA',
    description: 'Libro de ventas con una fila por factura: estado de pago, canal y fecha de cobro.',
    mapping: {
      date: 'Fecha',
      invoice: 'N° factura',
      client: 'Cliente',
      channel: 'Canal',
      category: 'Categoría',
      product: 'Producto',
      quantity: 'Cantidad',
      unitPrice: 'Precio unitario (IVA incl.)',
      discount: 'Descuento',
      total: 'Total',
      net: 'Base gravable',
      tax: 'IVA 19%',
      paymentMethod: 'Medio de pago',
      status: 'Estado',
      paidDate: 'Fecha de pago',
      notes: 'Notas',
    },
    accountingMethod: 'accrual',
    taxMode: 'included',
    taxRate: DEFAULT_TAX_RATE,
    incomeRule: 'all-rows',
    builtIn: true,
  },
  {
    id: 'pos',
    name: 'Cuadre de caja (POS)',
    description: 'Exportación del punto de venta: títulos arriba, una fila por ticket, pago inmediato.',
    mapping: {
      date: 'Fecha/Hora',
      invoice: 'Ticket',
      paymentMethod: 'Forma de pago',
      net: 'Valor neto',
      tax: 'Impuesto',
      total: 'Total venta',
    },
    accountingMethod: 'cash',
    taxMode: 'included',
    taxRate: DEFAULT_TAX_RATE,
    incomeRule: 'all-rows',
    defaults: { channel: 'Tienda física', category: 'Sin clasificar' },
    builtIn: true,
  },
  {
    id: 'bank',
    name: 'Extracto bancario',
    description: 'Movimientos del banco: solo los créditos son ingresos, los débitos se ignoran.',
    mapping: {
      date: 'Fecha transacción',
      notes: 'Descripción',
      invoice: 'Referencia',
      debit: 'Débito',
      credit: 'Crédito',
    },
    accountingMethod: 'cash',
    taxMode: 'included',
    taxRate: DEFAULT_TAX_RATE,
    incomeRule: 'credit-column-only',
    defaults: { channel: 'Banco', category: 'Sin clasificar', paymentMethod: 'Transferencia' },
    builtIn: true,
  },
];

/** Used when no saved profile resembles the file: everything is detected from the headers. */
export const AUTO_PROFILE: ImportProfile = {
  id: 'auto',
  name: 'Detección automática',
  description: 'Reconocemos las columnas por su nombre. Ajusta lo que haga falta.',
  mapping: {},
  accountingMethod: 'accrual',
  taxMode: 'included',
  taxRate: DEFAULT_TAX_RATE,
  incomeRule: 'all-rows',
  builtIn: true,
};

/** Positions of the profile's header names inside this file's headers. */
export function resolveProfileMapping(profile: ImportProfile, headers: readonly CellValue[]): ColumnMapping {
  const normalized = headers.map((header) => (typeof header === 'string' ? normalizeHeader(header) : ''));
  const mapping: ColumnMapping = {};
  const used = new Set<number>();

  for (const [field, name] of Object.entries(profile.mapping) as Array<[IncomeField, string]>) {
    const wanted = normalizeHeader(name);
    if (!wanted) continue;
    const column = normalized.findIndex((header, index) => header === wanted && !used.has(index));
    if (column === -1) continue;
    mapping[field] = column;
    used.add(column);
  }
  return mapping;
}

/** Share of the profile's headers that this file has (0 to 1). */
export function profileScore(profile: ImportProfile, headers: readonly CellValue[]): number {
  const wanted = Object.values(profile.mapping).map(normalizeHeader).filter(Boolean);
  if (wanted.length === 0) return 0;
  const present = new Set(headers.map((header) => (typeof header === 'string' ? normalizeHeader(header) : '')));
  return wanted.filter((name) => present.has(name)).length / wanted.length;
}

export interface ProfileMatch {
  profile: ImportProfile;
  score: number;
}

const MIN_PROFILE_SCORE = 0.6;

/** The saved profile whose headers overlap the file the most, if any is close enough. */
export function pickBestProfile(headers: readonly CellValue[], profiles: readonly ImportProfile[]): ProfileMatch | null {
  let best: ProfileMatch | null = null;
  for (const profile of profiles) {
    const score = profileScore(profile, headers);
    if (score < MIN_PROFILE_SCORE) continue;
    if (!best || score > best.score) best = { profile, score };
  }
  return best;
}

export interface BuildProfileInput {
  name: string;
  headers: readonly CellValue[];
  mapping: ColumnMapping;
  accountingMethod: AccountingMethod;
  taxMode: TaxMode;
  taxRate: number;
  incomeRule?: IncomeRule;
  defaults?: ProfileDefaults;
}

/** Turns the current column choices into a reusable profile (header names, not positions). */
export function buildProfile(input: BuildProfileInput): ImportProfile {
  const mapping: Partial<Record<IncomeField, string>> = {};
  for (const [field, column] of Object.entries(input.mapping) as Array<[IncomeField, number]>) {
    const header = input.headers[column];
    if (typeof header === 'string' && header.trim()) mapping[field] = header.trim();
  }
  const name = input.name.trim() || 'Mi formato';
  return {
    id: `custom-${normalizeHeader(name).replace(/ /g, '-') || 'perfil'}`,
    name,
    description: 'Perfil guardado en este navegador.',
    mapping,
    accountingMethod: input.accountingMethod,
    taxMode: input.taxMode,
    taxRate: input.taxRate,
    incomeRule: input.incomeRule ?? inferIncomeRule(input.mapping),
    ...(input.defaults ? { defaults: input.defaults } : {}),
  };
}

/** A file with credit/debit columns and no total is a statement: only credits are income. */
export function inferIncomeRule(mapping: ColumnMapping): IncomeRule {
  return mapping.credit !== undefined && mapping.total === undefined ? 'credit-column-only' : 'all-rows';
}
