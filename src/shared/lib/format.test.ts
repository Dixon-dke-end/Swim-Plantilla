import { describe, expect, it } from 'vitest';
import { formatCOP } from './format';

const normalize = (value: string) => value.replace(/ /g, ' ');

describe('formatCOP', () => {
  it('formats pesos with dot thousands separators and no decimals', () => {
    expect(normalize(formatCOP(159000))).toBe('$ 159.000');
    expect(normalize(formatCOP(1234567))).toBe('$ 1.234.567');
  });

  it('formats zero', () => {
    expect(normalize(formatCOP(0))).toBe('$ 0');
  });

  it('rounds away fractional amounts', () => {
    expect(normalize(formatCOP(159000.6))).toBe('$ 159.001');
  });
});
