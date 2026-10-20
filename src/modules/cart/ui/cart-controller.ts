import {
  MAX_QTY,
  MIN_QTY,
  addItem,
  cartCount,
  cartTotals,
  lineKey,
  removeItem,
  updateQty,
  type Cart,
  type CartItem,
  type NewCartItem,
} from '../domain/cart';
import { CART_STORAGE_KEY, loadCart, saveCart } from '../infrastructure/storage';
import { createFocusTrap, type FocusTrap } from '../../../shared/lib/focus-trap';
import { formatCOP } from '../../../shared/lib/format';
import { withViewTransition, type NamedElement } from '../../../shared/lib/view-transition';

export const CART_CHANGE_EVENT = 'cart:change';

export type CartChangeReason = 'init' | 'add' | 'remove' | 'qty' | 'sync';

export interface CartChangeDetail {
  cart: Cart;
  count: number;
  reason: CartChangeReason;
}

interface CatalogColor {
  name: string;
  image: string;
  alt: string;
}

interface CatalogEntry {
  slug: string;
  name: string;
  price: number;
  colors: CatalogColor[];
}

let cart: Cart = loadCart();
let catalog = new Map<string, CatalogEntry>();
let drawer: HTMLElement | null = null;
let trap: FocusTrap | null = null;
let documentBound = false;
let previousCount = cartCount(cart);

const $ = <T extends HTMLElement>(selector: string): T | null => drawer?.querySelector<T>(selector) ?? null;

/** View-transition-names must be valid identifiers: keep ASCII letters, digits and dashes. */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const isOpen = () => Boolean(drawer && !drawer.hidden);

export function getCart(): Cart {
  return cart;
}

function emit(reason: CartChangeReason): void {
  const detail: CartChangeDetail = { cart, count: cartCount(cart), reason };
  document.dispatchEvent(new CustomEvent<CartChangeDetail>(CART_CHANGE_EVENT, { detail }));
}

/* ------------------------------------------------------------------ rendering */

function lineImage(line: CartItem): CatalogColor | undefined {
  const entry = catalog.get(line.slug);
  return entry?.colors.find((color) => color.name === line.color) ?? entry?.colors[0];
}

function createLine(line: CartItem): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'cart-line';
  li.dataset.key = lineKey(line);

  const media = document.createElement('div');
  media.className = 'cart-line__media';
  const image = document.createElement('img');
  image.width = 200;
  image.height = 260;
  image.loading = 'lazy';
  image.decoding = 'async';
  media.append(image);

  const body = document.createElement('div');
  body.className = 'cart-line__body';

  const name = document.createElement('p');
  name.className = 'cart-line__name';
  const meta = document.createElement('p');
  meta.className = 'cart-line__meta';

  const row = document.createElement('div');
  row.className = 'cart-line__row';

  const stepper = document.createElement('div');
  stepper.className = 'stepper stepper--sm';
  stepper.setAttribute('role', 'group');

  const dec = document.createElement('button');
  dec.type = 'button';
  dec.className = 'stepper__btn';
  dec.dataset.cartDec = '';
  dec.textContent = '−';
  dec.setAttribute('aria-label', 'Disminuir cantidad');

  const value = document.createElement('output');
  value.className = 'stepper__value';

  const inc = document.createElement('button');
  inc.type = 'button';
  inc.className = 'stepper__btn';
  inc.dataset.cartInc = '';
  inc.textContent = '+';
  inc.setAttribute('aria-label', 'Aumentar cantidad');

  stepper.append(dec, value, inc);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'link link--static cart-line__remove';
  remove.dataset.cartRemove = '';
  remove.textContent = 'Quitar';

  row.append(stepper, remove);
  body.append(name, meta, row);

  const price = document.createElement('p');
  price.className = 'cart-line__price';

  li.append(media, body, price);
  return li;
}

function updateLine(li: HTMLLIElement, line: CartItem): void {
  const image = li.querySelector('img');
  const color = lineImage(line);
  if (image) {
    if (color && image.getAttribute('src') !== color.image) image.src = color.image;
    image.alt = color?.alt ?? line.name;
  }

  li.querySelector('.cart-line__name')!.textContent = line.name;
  li.querySelector('.cart-line__meta')!.textContent = `${line.color} · Talla ${line.size}`;
  li.querySelector('.stepper')!.setAttribute('aria-label', `Cantidad de ${line.name}`);
  li.querySelector('.stepper__value')!.textContent = String(line.qty);
  li.querySelector('.cart-line__price')!.textContent = formatCOP(line.unitPrice * line.qty);
  li.querySelector('.cart-line__remove')!.setAttribute('aria-label', `Quitar ${line.name} (${line.color}, talla ${line.size})`);

  li.querySelector('[data-cart-dec]')?.toggleAttribute('disabled', line.qty <= MIN_QTY);
  li.querySelector('[data-cart-inc]')?.toggleAttribute('disabled', line.qty >= MAX_QTY);
}

/** Keyed reconciliation: existing rows (and their images) are reused, never recreated. */
function renderLines(named: boolean): void {
  const list = $<HTMLUListElement>('[data-cart-lines]');
  if (!list) return;

  const existing = new Map<string, HTMLLIElement>();
  list.querySelectorAll<HTMLLIElement>(':scope > li').forEach((li) => existing.set(li.dataset.key ?? '', li));

  const wanted: HTMLLIElement[] = cart.map((line) => {
    const key = lineKey(line);
    const li = existing.get(key) ?? createLine(line);
    existing.delete(key);
    updateLine(li, line);

    if (named) {
      li.style.setProperty('view-transition-name', `cart-line-${slugify(key)}`);
      li.style.setProperty('view-transition-class', 'vt-line');
    }
    return li;
  });

  existing.forEach((li) => li.remove());
  wanted.forEach((li, index) => {
    if (list.children[index] !== li) list.insertBefore(li, list.children[index] ?? null);
  });
}

function renderSummary(): void {
  const totals = cartTotals(cart);
  const empty = cart.length === 0;

  $('[data-cart-empty]')?.toggleAttribute('hidden', !empty);
  $('[data-cart-body]')?.toggleAttribute('hidden', empty);
  $('[data-cart-footer]')?.toggleAttribute('hidden', empty);

  const subtotal = $('[data-cart-subtotal]');
  if (subtotal) subtotal.textContent = formatCOP(totals.subtotal);
  const shipping = $('[data-cart-shipping]');
  if (shipping) shipping.textContent = totals.shipping === 0 ? 'Gratis' : formatCOP(totals.shipping);
  const total = $('[data-cart-total]');
  if (total) total.textContent = formatCOP(totals.total);

  const message = $('[data-cart-shipping-message]');
  if (message) {
    message.textContent =
      totals.remainingForFreeShipping > 0
        ? `Te faltan ${formatCOP(totals.remainingForFreeShipping)} para tener envío gratis.`
        : 'Tu pedido tiene envío gratis.';
  }
  $('[data-cart-progress]')?.style.setProperty('--progress', String(totals.freeShippingProgress));

  const note = $('[data-cart-note]');
  if (note) note.hidden = true;
}

function renderBadge(): void {
  const count = cartCount(cart);
  const label = count === 0 ? 'Abrir bolsa, vacía' : `Abrir bolsa, ${count} ${count === 1 ? 'artículo' : 'artículos'}`;

  document.querySelectorAll<HTMLElement>('[data-cart-count]').forEach((badge) => {
    badge.textContent = String(count);
    badge.closest('.bag-btn')?.classList.toggle('has-items', count > 0);

    if (count > previousCount) {
      badge.classList.remove('is-popping');
      void badge.offsetWidth; // restart the animation
      badge.classList.add('is-popping');
    }
  });
  document.querySelectorAll<HTMLElement>('[data-cart-open]').forEach((button) => button.setAttribute('aria-label', label));

  const heading = $('[data-cart-heading-count]');
  if (heading) heading.textContent = count === 0 ? '' : `(${count})`;
  previousCount = count;
}

function render(named = false): void {
  renderLines(named);
  renderSummary();
  renderBadge();
}

/* ------------------------------------------------------------------ state changes */

function clearLineNames(): void {
  $('[data-cart-lines]')
    ?.querySelectorAll<HTMLElement>(':scope > li')
    .forEach((li) => {
      li.style.removeProperty('view-transition-name');
      li.style.removeProperty('view-transition-class');
    });
}

async function commit(next: Cart, reason: CartChangeReason): Promise<void> {
  const apply = (named: boolean) => {
    cart = next;
    saveCart(cart);
    render(named);
    emit(reason);
  };

  if (!isOpen()) {
    apply(false);
    return;
  }

  // Lines are named only while the drawer is already open, so opening it never splits the panel.
  const list = $('[data-cart-lines]');
  const names: NamedElement[] = Array.from(list?.querySelectorAll<HTMLElement>(':scope > li') ?? []).map((li) => [
    li,
    `cart-line-${slugify(li.dataset.key ?? '')}`,
    'vt-line',
  ]);

  await withViewTransition(() => apply(true), { kind: 'cart', names });
  clearLineNames();
}

export function addToCart(item: NewCartItem, qty = 1): Promise<void> {
  return commit(addItem(cart, item, qty), 'add');
}

/* ------------------------------------------------------------------ drawer */

function setExpanded(expanded: boolean): void {
  document
    .querySelectorAll<HTMLElement>('[data-cart-open]')
    .forEach((button) => button.setAttribute('aria-expanded', String(expanded)));
}

export async function openCart(): Promise<void> {
  if (!drawer || isOpen()) return;
  const panel = drawer;

  await withViewTransition(
    () => {
      panel.hidden = false;
      panel.inert = false;
      document.documentElement.classList.add('is-locked');
      setExpanded(true);
      trap?.activate($('[data-cart-close]'));
    },
    { kind: 'drawer' },
  );
}

export async function closeCart(restoreFocus = true): Promise<void> {
  if (!drawer || !isOpen()) return;
  const panel = drawer;

  await withViewTransition(
    () => {
      panel.hidden = true;
      panel.inert = true;
      document.documentElement.classList.remove('is-locked');
      setExpanded(false);
      trap?.deactivate(restoreFocus);
    },
    { kind: 'drawer' },
  );
}

function closeCartNow(): void {
  if (!drawer || !isOpen()) return;
  drawer.hidden = true;
  drawer.inert = true;
  document.documentElement.classList.remove('is-locked');
  setExpanded(false);
  trap?.deactivate(false);
}

function bindDrawer(panel: HTMLElement): void {
  drawer = panel;
  trap = createFocusTrap(panel);

  try {
    const raw = panel.querySelector('#cart-catalog')?.textContent;
    const entries: CatalogEntry[] = raw ? JSON.parse(raw) : [];
    catalog = new Map(entries.map((entry) => [entry.slug, entry]));
  } catch {
    catalog = new Map();
  }

  panel.addEventListener('click', (event) => {
    const target = event.target as Element;

    if (target.closest('[data-cart-close]')) {
      void closeCart();
      return;
    }

    if (target.closest('[data-cart-checkout]')) {
      const note = $('[data-cart-note]');
      if (note && note.hidden) {
        void withViewTransition(
          () => {
            note.hidden = false;
          },
          { kind: 'cart' },
        );
      }
      return;
    }

    const li = target.closest<HTMLLIElement>('.cart-line');
    const key = li?.dataset.key;
    if (!li || !key) return;
    const line = cart.find((entry) => lineKey(entry) === key);
    if (!line) return;

    if (target.closest('[data-cart-remove]')) void commit(removeItem(cart, key), 'remove');
    else if (target.closest('[data-cart-inc]')) void commit(updateQty(cart, key, line.qty + 1), 'qty');
    else if (target.closest('[data-cart-dec]')) void commit(updateQty(cart, key, line.qty - 1), 'qty');
  });

  render(false);
}

function bindDocument(): void {
  if (documentBound) return;
  documentBound = true;

  document.addEventListener('click', (event) => {
    const opener = (event.target as Element).closest('[data-cart-open]');
    if (opener) {
      event.preventDefault();
      void (isOpen() ? closeCart() : openCart());
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      event.preventDefault();
      void closeCart();
    }
  });

  // Never leave the drawer open over the next page.
  document.addEventListener('astro:before-preparation', closeCartNow);

  window.addEventListener('storage', (event) => {
    if (event.key !== CART_STORAGE_KEY) return;
    cart = loadCart();
    render(false);
    emit('sync');
  });
}

export function initCart(): void {
  bindDocument();

  const panel = document.getElementById('cart-drawer');
  if (panel && panel !== drawer) bindDrawer(panel);
  else render(false);

  emit('init');
}
