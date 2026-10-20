import { describe, expect, it } from 'vitest';
import { chartGeometry, chartSvgHtml, chartTableHtml, niceScale } from './chart';
import { columnLabel, columnLetter, compactCOP, escapeHtml, formatDelta, formatISODate } from './render';

describe('niceScale', () => {
  it('rounds the maximum up to a friendly number', () => {
    expect(niceScale(25_657_300, 4)).toEqual({ max: 30_000_000, step: 10_000_000 });
    expect(niceScale(14_815_200, 4)).toEqual({ max: 15_000_000, step: 5_000_000 });
    expect(niceScale(7, 4)).toEqual({ max: 8, step: 2 });
  });

  it('never returns a zero scale', () => {
    expect(niceScale(0, 4).max).toBeGreaterThan(0);
    expect(niceScale(-5, 4).max).toBeGreaterThan(0);
  });

  it('always covers the value', () => {
    for (const value of [1, 999, 1_234_567, 98_765_432]) {
      expect(niceScale(value, 4).max).toBeGreaterThanOrEqual(value);
    }
  });
});

const bars = [
  { key: '2026-05', label: 'may', value: 14_815_200, count: 33 },
  { key: '2026-06', label: 'jun', value: 25_657_300, count: 52 },
  { key: '2026-07', label: 'jul', value: 0, count: 0 },
];

describe('chartGeometry', () => {
  const geometry = chartGeometry(bars);

  it('keeps every bar inside the plot, with its tallest value at the top tick', () => {
    for (const bar of geometry.bars) {
      expect(bar.y).toBeGreaterThanOrEqual(geometry.plot.top);
      expect(bar.y + bar.height).toBeCloseTo(geometry.baseline);
      expect(bar.x).toBeGreaterThanOrEqual(geometry.plot.left);
      expect(bar.x + bar.width).toBeLessThanOrEqual(geometry.width - geometry.plot.right);
    }
  });

  it('scales bar heights proportionally', () => {
    const [may, jun, jul] = geometry.bars;
    expect(jun!.height / may!.height).toBeCloseTo(25_657_300 / 14_815_200);
    expect(jul!.height).toBe(0);
  });

  it('produces ticks from zero up to the scale maximum', () => {
    expect(geometry.ticks[0]!.value).toBe(0);
    expect(geometry.ticks[geometry.ticks.length - 1]!.value).toBe(geometry.max);
  });

  it('handles an empty series', () => {
    expect(chartGeometry([]).bars).toEqual([]);
  });
});

describe('chart markup', () => {
  it('draws one bar and one hit area per month', () => {
    const html = chartSvgHtml(chartGeometry(bars), bars);
    expect(html.match(/class="acct-bar(?: is-latest)?"/g)).toHaveLength(3);
    expect(html.match(/class="acct-bar-hit"/g)).toHaveLength(3);
    expect(html).toContain('is-latest');
  });

  it('escapes labels', () => {
    const html = chartSvgHtml(chartGeometry([{ key: 'k', label: '<b>', value: 1, count: 1 }]), [{ key: 'k', label: '<b>', value: 1, count: 1 }]);
    expect(html).not.toContain('<b>');
  });

  it('offers the same data as a table for assistive technology', () => {
    const table = chartTableHtml(bars);
    expect(table).toContain('<table');
    expect(table.replace(/ /g, ' ')).toContain('$ 14.815.200');
    expect(table.match(/<tr>/g)!.length).toBe(4);
  });
});

describe('render helpers', () => {
  it('escapes HTML', () => {
    expect(escapeHtml(`<img src=x onerror="a()">&'`)).toBe('&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;');
  });

  it('formats ISO dates', () => {
    expect(formatISODate('2026-05-04')).toBe('4 may 2026');
  });

  it('names spreadsheet columns', () => {
    expect(columnLetter(0)).toBe('A');
    expect(columnLetter(25)).toBe('Z');
    expect(columnLetter(26)).toBe('AA');
    expect(columnLabel(3, 'Total venta')).toBe('D · Total venta');
    expect(columnLabel(3, null)).toBe('D · (sin título)');
  });

  it('formats deltas with direction', () => {
    expect(formatDelta(0.123)).toEqual({ text: '▲ 12,3 %', tone: 'up' });
    expect(formatDelta(-0.041)).toEqual({ text: '▼ 4,1 %', tone: 'down' });
    expect(formatDelta(0)).toEqual({ text: '0 %', tone: 'flat' });
    expect(formatDelta(null)).toEqual({ text: '—', tone: 'none' });
  });

  it('formats compact money', () => {
    expect(compactCOP(14_815_200)).toBe('$14,8 M');
    expect(compactCOP(30_000_000)).toBe('$30 M');
    expect(compactCOP(950_000)).toBe('$950 mil');
    expect(compactCOP(0)).toBe('$0');
  });
});
