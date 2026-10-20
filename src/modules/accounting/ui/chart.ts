import { formatCOP, formatNumber } from '../../../shared/lib/format';
import { compactCOP, escapeHtml } from './render';

/**
 * Hand-made SVG bar chart. Geometry is pure so it can be tested; the controller animates
 * the bars by changing their `y` and `height` (CSS transitions do the rest).
 */

export interface ChartBar {
  key: string;
  label: string;
  value: number;
  count: number;
}

export interface ChartTick {
  value: number;
  y: number;
}

export interface BarShape {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Center of the bar, for labels. */
  cx: number;
}

export interface ChartGeometry {
  width: number;
  height: number;
  plot: { left: number; right: number; top: number; bottom: number };
  baseline: number;
  max: number;
  ticks: ChartTick[];
  bars: BarShape[];
}

const STEPS = [1, 2, 2.5, 5, 10];

/** A rounded-up maximum and a tidy step, so gridlines land on numbers people recognise. */
export function niceScale(max: number, targetTicks = 4): { max: number; step: number } {
  if (!(max > 0)) return { max: 1, step: 1 / targetTicks };
  const raw = max / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = (STEPS.find((candidate) => candidate * magnitude >= raw) ?? 10) * magnitude;
  return { max: Math.ceil(max / step) * step, step };
}

export function chartGeometry(bars: readonly ChartBar[], width = 720, height = 320): ChartGeometry {
  const plot = { left: 58, right: 12, top: 18, bottom: 38 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const baseline = plot.top + plotHeight;
  const { max, step } = niceScale(Math.max(0, ...bars.map((bar) => bar.value)), 4);

  const ticks: ChartTick[] = [];
  for (let value = 0; value <= max + step / 1000; value += step) {
    ticks.push({ value: Math.round(value), y: baseline - (value / max) * plotHeight });
  }

  const band = bars.length ? plotWidth / bars.length : plotWidth;
  const barWidth = Math.min(64, band * 0.6);
  const shapes = bars.map((bar, index): BarShape => {
    const barHeight = (bar.value / max) * plotHeight;
    const cx = plot.left + band * index + band / 2;
    return { x: cx - barWidth / 2, y: baseline - barHeight, width: barWidth, height: barHeight, cx };
  });

  return { width, height, plot, baseline, max, ticks, bars: shapes };
}

const n = (value: number) => Number(value.toFixed(2));

export function chartSvgHtml(geometry: ChartGeometry, bars: readonly ChartBar[]): string {
  const { width, height, plot, baseline } = geometry;
  const grid = geometry.ticks
    .map(
      (tick) => `<g class="acct-grid"><line x1="${plot.left}" x2="${width - plot.right}" y1="${n(tick.y)}" y2="${n(tick.y)}"/><text x="${plot.left - 10}" y="${n(tick.y)}" dy="0.32em" text-anchor="end">${escapeHtml(compactCOP(tick.value))}</text></g>`,
    )
    .join('');

  const last = bars.length - 1;
  const shapes = geometry.bars
    .map((shape, index) => {
      const bar = bars[index]!;
      const latest = index === last ? ' is-latest' : '';
      return `<g class="acct-col" style="--i:${index}">
        <rect class="acct-bar${latest}" data-index="${index}" data-y="${n(shape.y)}" data-h="${n(shape.height)}" x="${n(shape.x)}" y="${n(baseline)}" width="${n(shape.width)}" height="0" rx="7"/>
        <text class="acct-vlabel" data-index="${index}" data-y="${n(shape.y - 9)}" x="${n(shape.cx)}" y="${n(baseline)}">${escapeHtml(compactCOP(bar.value))}</text>
        <text class="acct-xlabel" x="${n(shape.cx)}" y="${height - 12}" text-anchor="middle">${escapeHtml(bar.label)}</text>
        <rect class="acct-bar-hit" data-index="${index}" x="${n(shape.cx - (geometry.width - plot.left - plot.right) / (bars.length || 1) / 2)}" y="${plot.top}" width="${n((geometry.width - plot.left - plot.right) / (bars.length || 1))}" height="${n(baseline - plot.top)}"/>
      </g>`;
    })
    .join('');

  return `<svg class="acct-chart__svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" data-n="${bars.length}">
    <g class="acct-grid-group">${grid}</g>${shapes}</svg>`;
}

/** Gridlines and axis labels only: used to refresh the scale when the bars are reused. */
export function chartGridHtml(geometry: ChartGeometry): string {
  const { width, plot } = geometry;
  return geometry.ticks
    .map(
      (tick) => `<g class="acct-grid"><line x1="${plot.left}" x2="${width - plot.right}" y1="${n(tick.y)}" y2="${n(tick.y)}"/><text x="${plot.left - 10}" y="${n(tick.y)}" dy="0.32em" text-anchor="end">${escapeHtml(compactCOP(tick.value))}</text></g>`,
    )
    .join('');
}

/** The same numbers as a real table, for screen readers. */
export function chartTableHtml(bars: readonly ChartBar[]): string {
  const rows = bars
    .map((bar) => `<tr><th scope="row">${escapeHtml(bar.label)}</th><td>${formatCOP(bar.value)}</td><td>${formatNumber(bar.count)}</td></tr>`)
    .join('');
  return `<table class="sr-only"><caption>Ingresos brutos por mes</caption><thead><tr><th scope="col">Mes</th><th scope="col">Ingresos brutos</th><th scope="col">Ventas</th></tr></thead><tbody>${rows}</tbody></table>`;
}
