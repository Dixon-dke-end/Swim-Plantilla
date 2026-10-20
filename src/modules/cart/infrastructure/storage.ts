import { clampQty, type Cart, type CartItem } from '../domain/cart';

export const CART_STORAGE_KEY = 'marea:cart:v1';

/** The subset of the Web Storage API the cart needs. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** localStorage can throw (private mode, blocked cookies); never let that break the page. */
export function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== 'object' || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.slug === 'string' &&
    typeof line.name === 'string' &&
    typeof line.color === 'string' &&
    typeof line.size === 'string' &&
    typeof line.unitPrice === 'number' &&
    Number.isFinite(line.unitPrice) &&
    typeof line.qty === 'number' &&
    Number.isFinite(line.qty)
  );
}

export function loadCart(storage: KeyValueStorage | null = browserStorage()): Cart {
  if (!storage) return [];
  try {
    const raw = storage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCartItem).map((line) => ({
      slug: line.slug,
      name: line.name,
      unitPrice: line.unitPrice,
      color: line.color,
      size: line.size,
      qty: clampQty(line.qty),
    }));
  } catch {
    return [];
  }
}

export function saveCart(cart: Cart, storage: KeyValueStorage | null = browserStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Storage is full or unavailable: the cart simply stays in memory.
  }
}
