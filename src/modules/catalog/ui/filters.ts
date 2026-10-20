import type { Category, Product } from '../data/types';

export type CategoryFilter = Category | 'todos';
export type SortKey = 'destacados' | 'precio-asc' | 'precio-desc' | 'novedades';

export interface ShopState {
  category: CategoryFilter;
  sort: SortKey;
}

/** The product fields the shop filter and sort actually read. */
export type FilterableProduct = Pick<
  Product,
  'slug' | 'name' | 'category' | 'price' | 'isNew' | 'bestsellerRank' | 'releasedAt'
>;

export const CATEGORY_FILTERS: readonly CategoryFilter[] = ['todos', 'bikinis', 'enterizos', 'hombre', 'resort'];
export const SORT_KEYS: readonly SortKey[] = ['destacados', 'precio-asc', 'precio-desc', 'novedades'];

export const DEFAULT_SHOP_STATE: ShopState = { category: 'todos', sort: 'destacados' };

export function parseCategory(raw: string | null | undefined): CategoryFilter {
  return CATEGORY_FILTERS.find((category) => category === raw) ?? 'todos';
}

export function parseSort(raw: string | null | undefined): SortKey {
  return SORT_KEYS.find((sort) => sort === raw) ?? 'destacados';
}

export function filterProducts<T extends Pick<Product, 'category'>>(products: readonly T[], category: CategoryFilter): T[] {
  return category === 'todos' ? [...products] : products.filter((product) => product.category === category);
}

const byName = (a: FilterableProduct, b: FilterableProduct) => a.name.localeCompare(b.name, 'es');

export function sortProducts<T extends FilterableProduct>(products: readonly T[], sort: SortKey): T[] {
  const list = [...products];

  switch (sort) {
    case 'precio-asc':
      return list.sort((a, b) => a.price - b.price || byName(a, b));
    case 'precio-desc':
      return list.sort((a, b) => b.price - a.price || byName(a, b));
    case 'novedades':
      return list.sort((a, b) => b.releasedAt.localeCompare(a.releasedAt) || a.bestsellerRank - b.bestsellerRank);
    case 'destacados':
    default:
      return list.sort((a, b) => a.bestsellerRank - b.bestsellerRank || byName(a, b));
  }
}

export function applyShopState<T extends FilterableProduct>(products: readonly T[], state: ShopState): T[] {
  return sortProducts(filterProducts(products, state.category), state.sort);
}

/** Query string for the URL (`?cat=bikinis&orden=precio-asc`); defaults are omitted. */
export function shopStateToSearch(state: ShopState): string {
  const params: string[] = [];
  if (state.category !== 'todos') params.push(`cat=${state.category}`);
  if (state.sort !== 'destacados') params.push(`orden=${state.sort}`);
  return params.length ? `?${params.join('&')}` : '';
}

export function shopStateFromSearch(search: string): ShopState {
  const params = new URLSearchParams(search);
  return { category: parseCategory(params.get('cat')), sort: parseSort(params.get('orden')) };
}

/** Label for the animated result counter: "12 productos", "1 producto", "Sin productos". */
export function resultCountLabel(count: number): string {
  const total = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  if (total === 0) return 'Sin productos';
  return total === 1 ? '1 producto' : `${total} productos`;
}
