import {
  applyShopState,
  resultCountLabel,
  shopStateFromSearch,
  shopStateToSearch,
  type CategoryFilter,
  type FilterableProduct,
  type ShopState,
  type SortKey,
} from './filters';
import { syncNavCurrent } from '../../../shared/lib/header';
import { chipLabelNames, withViewTransition, type NamedElement } from '../../../shared/lib/view-transition';

/**
 * Collection page controller: category chips, sort and result count.
 * Cards are filtered and reordered in place inside one view transition, so they
 * glide to their new positions. The URL mirrors the state with replaceState.
 */

interface ShopItem extends FilterableProduct {
  element: HTMLElement;
}

interface ShopController {
  apply(next: ShopState, animate: boolean): Promise<void>;
  state(): ShopState;
}

interface BeforePreparationEvent extends Event {
  readonly from: URL;
  readonly to: URL;
  readonly navigationType: string;
}

let current: ShopController | null = null;
let routerBound = false;

const trimSlash = (path: string) => path.replace(/\/$/, '') || '/';

function create(root: HTMLElement): ShopController | null {
  const grid = root.querySelector<HTMLElement>('[data-shop-grid]');
  const chips = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-shop-chip]'));
  const select = root.querySelector<HTMLSelectElement>('[data-shop-sort]');
  const count = root.querySelector<HTMLElement>('[data-shop-count]');
  const empty = root.querySelector<HTMLElement>('[data-shop-empty]');
  const indicator = root.querySelector<HTMLElement>('[data-indicator]');
  if (!grid || chips.length === 0 || !select || !count) return null;

  const items: ShopItem[] = Array.from(grid.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement)
    .map((element) => ({
      element,
      slug: element.dataset.slug ?? '',
      name: element.dataset.name ?? '',
      category: (element.dataset.category ?? 'bikinis') as FilterableProduct['category'],
      price: Number(element.dataset.price ?? 0),
      isNew: element.dataset.new === 'true',
      bestsellerRank: Number(element.dataset.rank ?? 0),
      releasedAt: element.dataset.released ?? '',
    }));

  let state = shopStateFromSearch(location.search);

  const paint = () => {
    const visible = applyShopState(items, state);
    const shown = new Set(visible);

    // Reorder in place: moving existing nodes keeps their images loaded.
    visible.forEach((item) => grid.append(item.element));
    items.filter((item) => !shown.has(item)).forEach((item) => grid.append(item.element));
    items.forEach((item) => {
      item.element.hidden = !shown.has(item);
    });

    chips.forEach((chip) => {
      const active = chip.dataset.shopChip === state.category;
      chip.setAttribute('aria-pressed', String(active));
      if (active && indicator) chip.append(indicator);
    });

    select.value = state.sort;
    count.textContent = resultCountLabel(visible.length);
    if (empty) empty.hidden = visible.length > 0;
    grid.toggleAttribute('data-empty', visible.length === 0);
  };

  const writeUrl = () => {
    const url = `${location.pathname}${shopStateToSearch(state)}${location.hash}`;
    // Keep the router's own history state: replacing it with null would break back / forward.
    history.replaceState(history.state, '', url);
    syncNavCurrent();
  };

  const apply = async (next: ShopState, animate: boolean) => {
    state = next;

    if (!animate) {
      paint();
      writeUrl();
      return;
    }

    const names: NamedElement[] = [];
    for (const item of items) {
      names.push([item.element, `card-${item.slug}`, 'vt-card']);
      // The cross-page names on the photo and title would split the card; mute them for this transition.
      names.push([item.element.querySelector('[data-card-media]'), 'none']);
      names.push([item.element.querySelector('[data-card-title]'), 'none']);
    }
    names.push([count, 'shop-count', 'vt-count']);
    names.push([indicator, 'shop-indicator', 'vt-indicator']);
    names.push(...chipLabelNames(chips, 'shop-chip'));

    writeUrl();
    await withViewTransition(paint, { kind: 'shop', names });
  };

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const category = chip.dataset.shopChip as CategoryFilter;
      if (category === state.category) return;
      void apply({ ...state, category }, true);
    });
  });

  select.addEventListener('change', () => {
    void apply({ ...state, sort: select.value as SortKey }, true);
  });

  paint();
  return { apply, state: () => state };
}

/** Runs before first paint after a swap (and on load): the grid already matches the URL. */
export function initShop(): void {
  const root = document.querySelector<HTMLElement>('[data-shop]');
  if (!root) {
    current = null;
    return;
  }
  if (root.dataset.ready) return;
  root.dataset.ready = 'true';
  current = create(root);

  if (routerBound) return;
  routerBound = true;

  // Header and menu links to /coleccion?cat=... while already on the collection page
  // become an animated filter change instead of a full page transition.
  document.addEventListener('astro:before-preparation', (event) => {
    const nav = event as BeforePreparationEvent;
    if (!current || nav.navigationType === 'traverse') return;
    if (trimSlash(nav.to.pathname) !== '/coleccion' || trimSlash(nav.from.pathname) !== '/coleccion') return;
    if (nav.to.hash) return;

    event.preventDefault();
    void current.apply(shopStateFromSearch(nav.to.search), true);
  });
}
