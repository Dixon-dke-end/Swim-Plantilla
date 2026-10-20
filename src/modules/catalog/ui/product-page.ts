import { MAX_QTY, MIN_QTY, clampQty } from '../../cart/domain/cart';
import { addToCart } from '../../cart/ui/cart-controller';
import { chipLabelNames, decodeImage, withViewTransition } from '../../../shared/lib/view-transition';

/**
 * Product page controller: gallery, swatches, size pills, quantity, add to bag
 * and the size guide dialog. Every state change goes through a view transition.
 */

const ADDED_LABEL = 'Agregado';
const IDLE_LABEL = 'Agregar a la bolsa';
const ADDED_RESET_MS = 2400;

function setupGallery(root: HTMLElement): void {
  const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-slide]'));
  const thumbs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-thumb]'));
  const swatches = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-swatch]'));
  const thumbIndicator = root.querySelector<HTMLElement>('[data-thumb-indicator]');
  const colorName = root.querySelector<HTMLElement>('[data-color-name]');
  let index = 0;

  const paint = (next: number) => {
    index = next;
    slides.forEach((slide, position) => {
      const active = position === next;
      slide.toggleAttribute('data-active', active);
      slide.setAttribute('aria-hidden', String(!active));
    });
    thumbs.forEach((thumb, position) => thumb.setAttribute('aria-pressed', String(position === next)));
    if (thumbIndicator) thumbs[next]?.append(thumbIndicator);

    const colorIndex = slides[next]?.dataset.color;
    if (colorIndex !== undefined && colorIndex !== '') {
      swatches.forEach((swatch) => swatch.setAttribute('aria-pressed', String(swatch.dataset.swatch === colorIndex)));
      const swatch = swatches.find((candidate) => candidate.dataset.swatch === colorIndex);
      if (colorName && swatch) colorName.textContent = swatch.dataset.name ?? '';
    }
  };

  const show = async (next: number, kind: 'swatch' | 'thumb') => {
    if (next === index || !slides[next]) return;
    await decodeImage(slides[next].querySelector('img'));
    await withViewTransition(() => paint(next), {
      kind,
      keepShared: true,
      names: [[thumbIndicator, 'pdp-thumb-indicator', 'vt-indicator']],
    });
  };

  thumbs.forEach((thumb, position) => thumb.addEventListener('click', () => void show(position, 'thumb')));
  swatches.forEach((swatch) =>
    swatch.addEventListener('click', () => {
      const position = slides.findIndex((slide) => slide.dataset.color === swatch.dataset.swatch);
      if (position !== -1) void show(position, 'swatch');
    }),
  );

  paint(0);
}

function setupSizeGuide(root: HTMLElement): void {
  const dialog = document.querySelector<HTMLDialogElement>('[data-guide]');
  const panel = dialog?.querySelector<HTMLElement>('[data-guide-panel]');
  if (!dialog || !panel) return;

  const html = document.documentElement;
  const names = [[panel, 'size-guide', 'vt-dialog']] as const;

  const open = () => {
    if (dialog.open) return;
    void withViewTransition(
      () => {
        dialog.showModal();
        html.classList.add('is-locked');
      },
      { kind: 'dialog', names },
    );
  };

  const close = () => {
    if (!dialog.open) return;
    void withViewTransition(
      () => {
        dialog.close();
        html.classList.remove('is-locked');
      },
      { kind: 'dialog', names },
    );
  };

  root.querySelectorAll('[data-guide-open]').forEach((button) => button.addEventListener('click', open));
  dialog.querySelectorAll('[data-guide-close]').forEach((button) => button.addEventListener('click', close));

  // A click on the dialog itself (outside the panel) is a click on the backdrop.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  // Escape: animate the close instead of the browser's instant one.
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
}

function setup(root: HTMLElement): void {
  const slug = root.dataset.slug ?? '';
  const name = root.dataset.name ?? '';
  const price = Number(root.dataset.price ?? 0);

  setupGallery(root);
  setupSizeGuide(root);

  const sizes = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-size]'));
  const sizeIndicator = root.querySelector<HTMLElement>('[data-size-indicator]');
  const sizeRow = root.querySelector<HTMLElement>('[data-size-row]');
  const sizeError = root.querySelector<HTMLElement>('[data-size-error]');
  const sizeLabel = root.querySelector<HTMLElement>('[data-size-label]');
  const qtyValue = root.querySelector<HTMLOutputElement>('[data-qty-value]');
  const dec = root.querySelector<HTMLButtonElement>('[data-qty-dec]');
  const inc = root.querySelector<HTMLButtonElement>('[data-qty-inc]');
  const add = root.querySelector<HTMLButtonElement>('[data-add]');
  const addLabel = root.querySelector<HTMLElement>('[data-add-label]');
  const status = root.querySelector<HTMLElement>('[data-add-status]');

  let size: string | null = null;
  let qty = MIN_QTY;
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  const showError = (message: string) => {
    if (sizeError) sizeError.textContent = message;
    if (!message || !sizeRow) return;
    sizeRow.classList.remove('is-shaking');
    void sizeRow.offsetWidth; // restart the animation
    sizeRow.classList.add('is-shaking');
  };

  const paintSize = (next: string) => {
    size = next;
    sizes.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.size === next)));
    const selected = sizes.find((button) => button.dataset.size === next);
    if (selected && sizeIndicator) {
      selected.append(sizeIndicator);
      sizeIndicator.hidden = false;
    }
    if (sizeLabel) sizeLabel.textContent = next;
    if (sizeError) sizeError.textContent = '';
  };

  sizes.forEach((button) =>
    button.addEventListener('click', () => {
      const next = button.dataset.size ?? '';
      if (next === size) return;
      void withViewTransition(() => paintSize(next), {
        kind: 'size',
        names: [[sizeIndicator, 'pdp-size-indicator', 'vt-indicator'], ...chipLabelNames(sizes, 'pdp-size')],
      });
    }),
  );

  const paintQty = () => {
    if (qtyValue) qtyValue.textContent = String(qty);
    dec?.toggleAttribute('disabled', qty <= MIN_QTY);
    inc?.toggleAttribute('disabled', qty >= MAX_QTY);
  };

  const changeQty = (delta: 1 | -1) => {
    const next = clampQty(qty + delta);
    if (next === qty) return;
    qty = next;
    void withViewTransition(paintQty, {
      kind: delta > 0 ? 'qty' : 'qty-down',
      names: [[qtyValue, 'pdp-qty', 'vt-count']],
    });
  };

  dec?.addEventListener('click', () => changeQty(-1));
  inc?.addEventListener('click', () => changeQty(1));

  const paintAdded = (added: boolean) => {
    if (!add) return;
    add.dataset.state = added ? 'added' : 'idle';
    if (addLabel) addLabel.textContent = added ? ADDED_LABEL : IDLE_LABEL;
  };

  const morphAdd = (added: boolean) =>
    withViewTransition(() => paintAdded(added), { kind: 'add', names: [[add, 'pdp-add', 'vt-btn']] });

  add?.addEventListener('click', async () => {
    if (!size) {
      showError('Elige una talla para continuar.');
      sizes[0]?.focus();
      return;
    }

    const activeSwatch = root.querySelector<HTMLElement>('[data-swatch][aria-pressed="true"]');
    const color = activeSwatch?.dataset.name ?? root.querySelector<HTMLElement>('[data-swatch]')?.dataset.name ?? '';
    await addToCart({ slug, name, unitPrice: price, color, size }, qty);

    if (status) status.textContent = `${name} agregado a la bolsa.`;
    clearTimeout(resetTimer);
    await morphAdd(true);
    resetTimer = setTimeout(() => void morphAdd(false), ADDED_RESET_MS);
  });

  paintQty();
}

export function initProductPage(): void {
  const root = document.querySelector<HTMLElement>('[data-product]');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = 'true';
  setup(root);
}
