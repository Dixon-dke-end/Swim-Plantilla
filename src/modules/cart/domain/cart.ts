/**
 * Pure cart logic. No DOM, no storage, no side effects: every function
 * returns a new cart and leaves its input untouched.
 */

export const MIN_QTY = 1;
export const MAX_QTY = 10;
/** Orders from this subtotal (COP) ship for free. */
export const FREE_SHIPPING_THRESHOLD = 250_000;
/** Flat shipping fee (COP) below the free shipping threshold. */
export const SHIPPING_FEE = 14_900;

export interface NewCartItem {
  slug: string;
  name: string;
  /** Price per unit in COP. */
  unitPrice: number;
  color: string;
  size: string;
}

export interface CartItem extends NewCartItem {
  qty: number;
}

export type Cart = readonly CartItem[];

export interface CartTotals {
  subtotal: number;
  shipping: number;
  total: number;
  remainingForFreeShipping: number;
  /** 0..1, how close the subtotal is to the free shipping threshold. */
  freeShippingProgress: number;
}

export function clampQty(qty: number): number {
  if (!Number.isFinite(qty)) return MIN_QTY;
  return Math.min(MAX_QTY, Math.max(MIN_QTY, Math.trunc(qty)));
}

/** Identity of a cart line: the same product, color and size share one line. */
export function lineKey(item: Pick<NewCartItem, 'slug' | 'color' | 'size'>): string {
  return `${item.slug}|${item.color}|${item.size}`;
}

export function addItem(cart: Cart, item: NewCartItem, qty: number = MIN_QTY): Cart {
  const key = lineKey(item);
  const existing = cart.find((line) => lineKey(line) === key);

  if (!existing) {
    return [...cart, { ...item, qty: clampQty(qty) }];
  }

  return cart.map((line) =>
    lineKey(line) === key ? { ...line, qty: clampQty(line.qty + Math.trunc(qty)) } : line,
  );
}

export function removeItem(cart: Cart, key: string): Cart {
  return cart.filter((line) => lineKey(line) !== key);
}

export function updateQty(cart: Cart, key: string, qty: number): Cart {
  return cart.map((line) => (lineKey(line) === key ? { ...line, qty: clampQty(qty) } : line));
}

export function cartCount(cart: Cart): number {
  return cart.reduce((sum, line) => sum + line.qty, 0);
}

export function cartTotals(cart: Cart): CartTotals {
  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

  return {
    subtotal,
    shipping,
    total: subtotal + shipping,
    remainingForFreeShipping: Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal),
    freeShippingProgress: Math.min(1, subtotal / FREE_SHIPPING_THRESHOLD),
  };
}
