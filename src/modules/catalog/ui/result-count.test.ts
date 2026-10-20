import { describe, expect, it } from 'vitest';
import { resultCountLabel } from './filters';

describe('resultCountLabel', () => {
  it('uses the singular for one product', () => {
    expect(resultCountLabel(1)).toBe('1 producto');
  });

  it('uses the plural for several products', () => {
    expect(resultCountLabel(12)).toBe('12 productos');
  });

  it('describes an empty result', () => {
    expect(resultCountLabel(0)).toBe('Sin productos');
  });

  it('never reports a negative or fractional count', () => {
    expect(resultCountLabel(-3)).toBe('Sin productos');
    expect(resultCountLabel(2.9)).toBe('2 productos');
  });
});
