import { describe, expect, it } from 'vitest';
import { loadCart, saveCart, type KeyValueStorage } from './storage';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const data: Record<string, string> = { ...initial };
  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const line = { slug: 'alba', name: 'Bikini Alba', unitPrice: 189000, color: 'Negro', size: 'M', qty: 2 };

describe('cart storage', () => {
  it('round-trips a cart', () => {
    const storage = memoryStorage();
    saveCart([line], storage);
    expect(loadCart(storage)).toEqual([line]);
  });

  it('returns an empty cart when nothing is stored', () => {
    expect(loadCart(memoryStorage())).toEqual([]);
  });

  it('returns an empty cart for corrupt JSON', () => {
    expect(loadCart(memoryStorage({ 'marea:cart:v1': '{oops' }))).toEqual([]);
  });

  it('drops malformed lines', () => {
    const raw = JSON.stringify([line, { slug: 1 }, null, { ...line, qty: 'x' }]);
    expect(loadCart(memoryStorage({ 'marea:cart:v1': raw }))).toEqual([line]);
  });

  it('never throws when storage is unavailable', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadCart(broken)).toEqual([]);
    expect(() => saveCart([line], broken)).not.toThrow();
    expect(loadCart(null)).toEqual([]);
  });
});
