import { FIELD_LABELS, INCOME_FIELDS, type CellValue, type ColumnMapping, type IncomeEntry, type IncomeField } from '../domain/types';
import type { MatchConfidence } from '../domain/column-mapping';
import type { JournalEntry } from '../domain/journal';
import type { BreakdownRow } from '../domain/ledger';
import type { RecognizedItem } from '../domain/accounting-methods';
import type { ImportIssue, ImportResult } from '../domain/types';
import { formatCOP, formatNumber } from '../../../shared/lib/format';

/** Pure HTML builders for the accounting page. Every dynamic value goes through `escapeHtml`. */

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]!);
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** `2026-05-04` -> `4 may 2026` */
export function formatISODate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  return `${day} ${MONTHS[month - 1] ?? ''} ${year}`;
}

/** `0` -> `A`, `26` -> `AA` */
export function columnLetter(index: number): string {
  let letters = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
}

export function headerText(value: CellValue): string {
  if (value === null || value === undefined) return '';
  return value instanceof Date ? '' : String(value).trim();
}

export function columnLabel(index: number, header: CellValue): string {
  const text = headerText(header);
  return `${columnLetter(index)} · ${text || '(sin título)'}`;
}

export interface DeltaView {
  text: string;
  tone: 'up' | 'down' | 'flat' | 'none';
}

/** Month-over-month change as a chip label: `▲ 12,3 %`. */
export function formatDelta(change: number | null): DeltaView {
  if (change === null || !Number.isFinite(change)) return { text: '—', tone: 'none' };
  const percent = Math.abs(change) * 100;
  if (percent < 0.05) return { text: '0 %', tone: 'flat' };
  const text = `${formatNumber(percent, percent >= 100 ? 0 : 1)} %`;
  return change > 0 ? { text: `▲ ${text}`, tone: 'up' } : { text: `▼ ${text}`, tone: 'down' };
}

/** Axis-friendly money: `$14,8 M`, `$950 mil`. */
export function compactCOP(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    return `${sign}$${formatNumber(millions, millions >= 100 ? 0 : 1).replace(/,0$/, '')} M`;
  }
  if (abs >= 1_000) return `${sign}$${formatNumber(abs / 1_000)} mil`;
  return `${sign}$${formatNumber(abs)}`;
}

export function statusLabel(status: IncomeEntry['status']): string {
  return status === 'paid' ? 'Pagado' : 'Pendiente';
}

// ---------------------------------------------------------------------------
// Mapping step
// ---------------------------------------------------------------------------

export type FieldState = 'auto' | 'suggested' | 'manual' | 'none';

export const STATE_LABELS: Readonly<Record<FieldState, string>> = {
  auto: 'Detectado automáticamente',
  suggested: 'Sugerido',
  manual: 'Asignado por ti',
  none: 'Sin asignar',
};

export function fieldState(mapped: boolean, confidence: MatchConfidence | 'manual' | undefined): FieldState {
  if (!mapped) return 'none';
  if (confidence === 'manual') return 'manual';
  return confidence === 'fuzzy' ? 'suggested' : 'auto';
}

export function stateBadgeHtml(state: FieldState): string {
  return `<span class="acct-state acct-state--${state}" data-field-state>${STATE_LABELS[state]}</span>`;
}

export function columnOptionsHtml(headers: readonly CellValue[], selected: number | undefined): string {
  const options = headers.map((header, index) => {
    return `<option value="${index}"${selected === index ? ' selected' : ''}>${escapeHtml(columnLabel(index, header))}</option>`;
  });
  return `<option value=""${selected === undefined ? ' selected' : ''}>Sin asignar</option>${options.join('')}`;
}

export interface MappingRowsInput {
  headers: readonly CellValue[];
  mapping: ColumnMapping;
  confidence: Partial<Record<IncomeField, MatchConfidence | 'manual'>>;
  required: ReadonlySet<IncomeField>;
}

export function mappingRowsHtml({ headers, mapping, confidence, required }: MappingRowsInput): string {
  return INCOME_FIELDS.map((field, position) => {
    const column = mapping[field];
    const state = fieldState(column !== undefined, confidence[field]);
    return `<div class="acct-field" style="--i:${position}" data-field="${field}">
      <label class="acct-field__label" for="acct-f-${field}">${escapeHtml(FIELD_LABELS[field])}${
        required.has(field) ? ' <span class="acct-req">obligatorio</span>' : ''
      }</label>
      <select class="select acct-select" id="acct-f-${field}" data-field-select="${field}" data-demo="map-${field}">${columnOptionsHtml(headers, column)}</select>
      ${stateBadgeHtml(state)}
    </div>`;
  }).join('');
}

export function previewTableHtml(entries: readonly IncomeEntry[]): string {
  if (entries.length === 0) {
    return `<p class="acct-empty">Con esta configuración todavía no hay filas válidas. Revisa que la columna de fecha y la de valores estén bien asignadas.</p>`;
  }
  const rows = entries
    .map(
      (entry, index) => `<tr style="--i:${index}">
        <td data-label="Fila">${entry.row}</td>
        <td data-label="Fecha">${formatISODate(entry.date)}</td>
        <td data-label="Documento">${escapeHtml(entry.invoice ?? '—')}</td>
        <td data-label="Detalle">${escapeHtml(entry.client || entry.product || entry.notes || '—')}</td>
        <td data-label="Canal">${escapeHtml(entry.channel)}</td>
        <td data-label="Pago">${escapeHtml(entry.paymentMethod)}</td>
        <td data-label="Estado"><span class="acct-pill acct-pill--${entry.status}">${statusLabel(entry.status)}</span></td>
        <td class="num" data-label="Total">${formatCOP(entry.total)}</td>
        <td class="num" data-label="Base">${formatCOP(entry.net)}</td>
        <td class="num" data-label="IVA">${formatCOP(entry.tax)}</td>
      </tr>`,
    )
    .join('');
  return `<div class="acct-table-wrap"><table class="acct-table acct-table--stack">
    <thead><tr><th>Fila</th><th>Fecha</th><th>Documento</th><th>Detalle</th><th>Canal</th><th>Pago</th><th>Estado</th><th class="num">Total</th><th class="num">Base</th><th class="num">IVA</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

export function previewStatsHtml(result: ImportResult): string {
  const errors = result.issues.filter((issue) => issue.kind === 'error').length;
  const duplicates = result.issues.filter((issue) => issue.kind === 'duplicate').length;
  const parts = [
    `<span class="acct-stat acct-stat--ok"><strong>${formatNumber(result.entries.length)}</strong> filas listas</span>`,
    errors ? `<span class="acct-stat acct-stat--bad"><strong>${formatNumber(errors)}</strong> con error</span>` : '',
    duplicates ? `<span class="acct-stat acct-stat--warn"><strong>${formatNumber(duplicates)}</strong> duplicadas</span>` : '',
    result.voided ? `<span class="acct-stat"><strong>${formatNumber(result.voided)}</strong> anuladas</span>` : '',
    result.ignoredMovements ? `<span class="acct-stat"><strong>${formatNumber(result.ignoredMovements)}</strong> no son ingresos</span>` : '',
    result.skippedSummaryRows.length
      ? `<span class="acct-stat"><strong>${formatNumber(result.skippedSummaryRows.length)}</strong> fila de totales omitida</span>`
      : '',
  ];
  return parts.filter(Boolean).join('');
}

// ---------------------------------------------------------------------------
// Results step
// ---------------------------------------------------------------------------

export function qualityHtml(result: ImportResult): string {
  const errors = result.issues.filter((issue) => issue.kind === 'error');
  const duplicates = result.issues.filter((issue) => issue.kind === 'duplicate');
  const stat = (label: string, value: number, tone: string, hint = '') =>
    `<li class="acct-quality__stat acct-quality__stat--${tone}${value === 0 ? ' is-zero' : ''}">
      <strong>${formatNumber(value)}</strong><span>${label}</span>${hint ? `<small>${hint}</small>` : ''}
    </li>`;

  const issues = result.issues.length
    ? `<ul class="acct-issues" aria-label="Filas con problemas">${result.issues.map(issueHtml).join('')}</ul>`
    : `<p class="acct-quality__clean">No encontramos filas con problemas.</p>`;

  return `<ul class="acct-quality__stats">
      ${stat('Filas leídas', result.dataRows, 'neutral')}
      ${stat('Filas importadas', result.entries.length, 'ok')}
      ${stat('Filas con error', errors.length, 'bad', 'Se dejan fuera')}
      ${stat('Duplicados', duplicates.length, 'warn', 'Se conserva la primera')}
      ${stat('Anuladas', result.voided, 'neutral', 'No suman ingresos')}
      ${stat('Filas resumen omitidas', result.skippedSummaryRows.length, 'neutral', 'Totales del archivo')}
      ${stat('No son ingresos', result.ignoredMovements, 'neutral', 'Débitos y gastos')}
    </ul>${issues}`;
}

function issueHtml(issue: ImportIssue): string {
  const tag = issue.kind === 'duplicate' ? 'Duplicado' : 'Error';
  return `<li class="acct-issue acct-issue--${issue.kind}">
    <span class="acct-issue__row">Fila ${issue.row}</span>
    <span class="acct-issue__reason">${escapeHtml(issue.reason)}</span>
    <span class="acct-issue__tag">${tag}</span>
  </li>`;
}

export function breakdownItemHtml(row: BreakdownRow, share: number): string {
  const percent = formatNumber(row.share * 100, row.share > 0 && row.share < 0.1 ? 1 : 0);
  return `<li class="acct-bd__item" data-key="${escapeHtml(row.label)}">
    <div class="acct-bd__row"><span class="acct-bd__label">${escapeHtml(row.label)}</span><span class="acct-bd__value num">${formatCOP(row.gross)} <small>${percent} %</small></span></div>
    <div class="acct-bd__track" aria-hidden="true"><span class="acct-bd__fill" style="--w:0" data-w="${share.toFixed(4)}"></span></div>
  </li>`;
}

export function movementRowsHtml(items: readonly RecognizedItem[]): string {
  if (items.length === 0) return '';
  return items
    .map(
      ({ entry, date }, index) => `<tr style="--i:${index}">
        <td data-label="Fecha">${formatISODate(date)}</td>
        <td data-label="Documento">${escapeHtml(entry.invoice ?? `Fila ${entry.row}`)}</td>
        <td data-label="Detalle">${escapeHtml(entry.client || entry.product || entry.notes || '—')}</td>
        <td data-label="Canal">${escapeHtml(entry.channel)}</td>
        <td data-label="Pago">${escapeHtml(entry.paymentMethod)}</td>
        <td data-label="Estado"><span class="acct-pill acct-pill--${entry.status}">${statusLabel(entry.status)}</span></td>
        <td class="num" data-label="Total">${formatCOP(entry.total)}</td>
      </tr>`,
    )
    .join('');
}

export function journalEntryHtml(entry: JournalEntry): string {
  const kind = entry.kind === 'invoice' ? 'Causación' : entry.kind === 'collection' ? 'Recaudo' : 'Ingreso en caja';
  const lines = entry.lines
    .map(
      (line) => `<tr class="${line.credit > 0 ? 'is-credit' : 'is-debit'}">
        <td class="acct-journal__code">${escapeHtml(line.account)}</td>
        <td class="acct-journal__name">${escapeHtml(line.name)}</td>
        <td class="num">${line.debit ? formatCOP(line.debit) : ''}</td>
        <td class="num">${line.credit ? formatCOP(line.credit) : ''}</td>
      </tr>`,
    )
    .join('');
  const balance = entry.balanced
    ? `<span class="acct-balance acct-balance--ok">Cuadra ✓</span>`
    : `<span class="acct-balance acct-balance--bad">No cuadra</span>`;
  return `<article class="acct-journal__entry">
    <header class="acct-journal__head">
      <div><strong>${escapeHtml(entry.id)}</strong> <span class="acct-journal__kind">${kind}</span></div>
      <div class="acct-journal__meta">${formatISODate(entry.date)} · ${escapeHtml(entry.document)}</div>
      ${balance}
    </header>
    <p class="acct-journal__concept">${escapeHtml(entry.concept)}</p>
    <table class="acct-journal__table">
      <thead><tr><th>Cuenta</th><th>Nombre</th><th class="num">Débito</th><th class="num">Crédito</th></tr></thead>
      <tbody>${lines}</tbody>
      <tfoot><tr><td colspan="2">Sumas iguales</td><td class="num">${formatCOP(entry.debit)}</td><td class="num">${formatCOP(entry.credit)}</td></tr></tfoot>
    </table>
  </article>`;
}

export function paginationHtml(page: number, pages: number, total: number, noun: string): string {
  return `<div class="acct-pager__info" aria-live="polite">${formatNumber(total)} ${noun} · página ${page} de ${pages}</div>
    <div class="acct-pager__buttons">
      <button type="button" class="btn btn--ghost btn--sm" data-page="prev"${page <= 1 ? ' disabled' : ''}>Anterior</button>
      <button type="button" class="btn btn--ghost btn--sm" data-page="next"${page >= pages ? ' disabled' : ''}>Siguiente</button>
    </div>`;
}
