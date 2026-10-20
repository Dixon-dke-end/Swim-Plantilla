import { describe, expect, it } from 'vitest';
import {
  FREE_SHIPPING_THRESHOLD,
  MAX_QTY,
  MIN_QTY,
  SHIPPING_FEE,
  addItem,
  cartCount,
  cartTotals,
  clampQty,
  lineKey,
  removeItem,
  updateQty,
  type Cart,
  type NewCartItem,
} from './cart';

const bikini: NewCartItem = {
  slug: 'alba',
  name: 'Bikini Alba',
  unitPrice: 189000,
  color: 'Negro',
  size: 'M',
};

describe('clampQty', () => {
  it('keeps values inside 1..10', () => {
    expect(MIN_QTY).toBe(1);
    expect(MAX_QTY).toBe(10);
    expect(clampQty(0)).toBe(1);
    expect(clampQty(-4)).toBe(1);
    expect(clampQty(5)).toBe(5);
    expect(clampQty(11)).toBe(10);
  });

  it('falls back to the minimum for invalid numbers', () => {
    expect(clampQty(Number.NaN)).toBe(1);
  });

  it('truncates fractional quantities', () => {
    expect(clampQty(2.9)).toBe(2);
  });
});

describe('addItem', () => {
  it('adds a new line with quantity 1 by default', () => {
    const cart = addItem([], bikini);
    expect(cart).toHaveLength(1);
    expect(cart[0]).toMatchObject({ slug: 'alba', qty: 1, color: 'Negro', size: 'M' });
  });

  it('merges quantity for the same product, color and size', () => {
    const cart = addItem(addItem([], bikini, 2), bikini, 3);
    expect(cart).toHaveLength(1);
    expect(cart[0]?.qty).toBe(5);
  });

  it('creates separate lines when color or size differ', () => {
    let cart: Cart = addItem([], bikini);
    cart = addItem(cart, { ...bikini, size: 'L' });
    cart = addItem(cart, { ...bikini, color: 'Coral' });
    expect(cart).toHaveLength(3);
  });

  it('clamps merged quantity to the maximum', () => {
    const cart = addItem(addItem([], bikini, 8), bikini, 8);
    expect(cart[0]?.qty).toBe(MAX_QTY);
  });

  it('does not mutate the previous cart', () => {
    const original: Cart = addItem([], bikini);
    const next = addItem(original, bikini);
    expect(original[0]?.qty).toBe(1);
    expect(next[0]?.qty).toBe(2);
  });
});

describe('removeItem', () => {
  it('removes only the matching line', () => {
    const cart = addItem(addItem([], bikini), { ...bikini, size: 'L' });
    const next = removeItem(cart, lineKey(bikini));
    expect(next).toHaveLength(1);
    expect(next[0]?.size).toBe('L');
  });

  it('returns an equivalent cart when the key does not exist', () => {
    const cart = addItem([], bikini);
    expect(removeItem(cart, 'nope|x|y')).toEqual(cart);
  });
});

describe('updateQty', () => {
  it('sets the quantity of a line', () => {
    const cart = addItem([], bikini);
    expect(updateQty(cart, lineKey(bikini), 4)[0]?.qty).toBe(4);
  });

  it('clamps the quantity to 1..10', () => {
    const cart = addItem([], bikini);
    expect(updateQty(cart, lineKey(bikini), 0)[0]?.qty).toBe(1);
    expect(updateQty(cart, lineKey(bikini), 99)[0]?.qty).toBe(10);
  });

  it('ignores unknown lines', () => {
    const cart = addItem([], bikini);
    expect(updateQty(cart, 'nope|x|y', 3)).toEqual(cart);
  });
});

describe('cartCount and cartTotals', () => {
  const cart: Cart = addItem(addItem([], bikini, 2), { ...bikini, slug: 'ola', unitPrice: 249000 }, 1);

  it('counts units, not lines', () => {
    expect(cartCount(cart)).toBe(3);
    expect(cartCount([])).toBe(0);
  });

  it('computes subtotal, shipping and total', () => {
    const totals = cartTotals(cart);
    expect(totals.subtotal).toBe(189000 * 2 + 249000);
    expect(totals.shipping).toBe(0);
    expect(totals.total).toBe(totals.subtotal);
  });

  it('charges shipping below the free shipping threshold', () => {
    const small = addItem([], { ...bikini, unitPrice: 159000 });
    const totals = cartTotals(small);
    expect(totals.shipping).toBe(SHIPPING_FEE);
    expect(totals.total).toBe(159000 + SHIPPING_FEE);
    expect(totals.remainingForFreeShipping).toBe(FREE_SHIPPING_THRESHOLD - 159000);
    expect(totals.freeShippingProgress).toBeCloseTo(159000 / FREE_SHIPPING_THRESHOLD, 5);
  });

  it('has no shipping fee for an empty cart', () => {
    const totals = cartTotals([]);
    expect(totals).toMatchObject({ subtotal: 0, shipping: 0, total: 0 });
    expect(totals.freeShippingProgress).toBe(0);
  });

  it('treats the threshold as free shipping', () => {
    const exact = addItem([], { ...bikini, unitPrice: FREE_SHIPPING_THRESHOLD });
    const totals = cartTotals(exact);
    expect(totals.shipping).toBe(0);
    expect(totals.remainingForFreeShipping).toBe(0);
    expect(totals.freeShippingProgress).toBe(1);
  });
});
