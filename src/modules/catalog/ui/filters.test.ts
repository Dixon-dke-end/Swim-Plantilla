import { describe, expect, it } from 'vitest';
import {
  applyShopState,
  filterProducts,
  parseCategory,
  parseSort,
  shopStateToSearch,
  sortProducts,
  type FilterableProduct,
} from './filters';

const products: FilterableProduct[] = [
  { slug: 'a', name: 'Alba', category: 'bikinis', price: 189000, isNew: false, bestsellerRank: 2, releasedAt: '2026-01-10' },
  { slug: 'b', name: 'Brisa', category: 'enterizos', price: 289000, isNew: true, bestsellerRank: 1, releasedAt: '2026-08-01' },
  { slug: 'c', name: 'Costa', category: 'hombre', price: 159000, isNew: false, bestsellerRank: 3, releasedAt: '2026-03-15' },
  { slug: 'd', name: 'Duna', category: 'bikinis', price: 189000, isNew: true, bestsellerRank: 4, releasedAt: '2026-09-20' },
  { slug: 'e', name: 'Eden', category: 'resort', price: 389000, isNew: false, bestsellerRank: 5, releasedAt: '2026-05-05' },
];

const slugs = (list: FilterableProduct[]) => list.map((p) => p.slug);

describe('parseCategory', () => {
  it('accepts known categories', () => {
    expect(parseCategory('bikinis')).toBe('bikinis');
    expect(parseCategory('resort')).toBe('resort');
  });

  it('defaults to "todos" for unknown or missing values', () => {
    expect(parseCategory(null)).toBe('todos');
    expect(parseCategory('zapatos')).toBe('todos');
    expect(parseCategory('')).toBe('todos');
  });
});

describe('parseSort', () => {
  it('accepts known sort keys and defaults to destacados', () => {
    expect(parseSort('precio-asc')).toBe('precio-asc');
    expect(parseSort('novedades')).toBe('novedades');
    expect(parseSort('???')).toBe('destacados');
    expect(parseSort(null)).toBe('destacados');
  });
});

describe('filterProducts', () => {
  it('returns every product for "todos"', () => {
    expect(filterProducts(products, 'todos')).toHaveLength(5);
  });

  it('keeps only the selected category', () => {
    expect(slugs(filterProducts(products, 'bikinis'))).toEqual(['a', 'd']);
    expect(slugs(filterProducts(products, 'hombre'))).toEqual(['c']);
  });
});

describe('sortProducts', () => {
  it('sorts by best seller rank for "destacados"', () => {
    expect(slugs(sortProducts(products, 'destacados'))).toEqual(['b', 'a', 'c', 'd', 'e']);
  });

  it('sorts by ascending price with a stable name tie-break', () => {
    expect(slugs(sortProducts(products, 'precio-asc'))).toEqual(['c', 'a', 'd', 'b', 'e']);
  });

  it('sorts by descending price with a stable name tie-break', () => {
    expect(slugs(sortProducts(products, 'precio-desc'))).toEqual(['e', 'b', 'a', 'd', 'c']);
  });

  it('puts the newest releases first for "novedades"', () => {
    expect(slugs(sortProducts(products, 'novedades'))).toEqual(['d', 'b', 'e', 'c', 'a']);
  });

  it('does not mutate the input', () => {
    const copy = [...products];
    sortProducts(products, 'precio-desc');
    expect(products).toEqual(copy);
  });
});

describe('applyShopState', () => {
  it('filters then sorts', () => {
    expect(slugs(applyShopState(products, { category: 'bikinis', sort: 'precio-desc' }))).toEqual(['a', 'd']);
    expect(slugs(applyShopState(products, { category: 'todos', sort: 'novedades' }))[0]).toBe('d');
  });
});

describe('shopStateToSearch', () => {
  it('omits default values', () => {
    expect(shopStateToSearch({ category: 'todos', sort: 'destacados' })).toBe('');
  });

  it('serializes category and sort', () => {
    expect(shopStateToSearch({ category: 'bikinis', sort: 'destacados' })).toBe('?cat=bikinis');
    expect(shopStateToSearch({ category: 'todos', sort: 'precio-asc' })).toBe('?orden=precio-asc');
    expect(shopStateToSearch({ category: 'hombre', sort: 'novedades' })).toBe('?cat=hombre&orden=novedades');
  });
});
