import { withViewTransition, type NamedElement } from './view-transition';

/**
 * Accessible accordions animated with view transitions.
 *
 * <div data-accordion="pdp" data-glide=".related, .site-footer" data-single>
 *   <div class="acc" data-acc-item>
 *     <h3><button aria-expanded="false" aria-controls="p1" data-acc-trigger>Title</button></h3>
 *     <div id="p1" data-acc-panel hidden>...</div>
 *   </div>
 * </div>
 *
 * `data-glide` lists blocks below the accordion that should glide (instead of
 * cross-fading) when the accordion changes height.
 */

function setup(root: HTMLElement): void {
  if (root.dataset.ready) return;
  root.dataset.ready = 'true';

  const id = root.dataset.accordion || 'acc';
  const single = root.hasAttribute('data-single');
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-acc-item]'));
  const glideSelector = root.dataset.glide;

  const parts = (item: HTMLElement) => ({
    trigger: item.querySelector<HTMLButtonElement>('[data-acc-trigger]'),
    panel: item.querySelector<HTMLElement>('[data-acc-panel]'),
  });

  const setOpen = (item: HTMLElement, open: boolean) => {
    const { trigger, panel } = parts(item);
    trigger?.setAttribute('aria-expanded', String(open));
    if (panel) panel.hidden = !open;
    item.toggleAttribute('data-open', open);
  };

  const toggle = async (item: HTMLElement) => {
    const { trigger } = parts(item);
    const willOpen = trigger?.getAttribute('aria-expanded') !== 'true';

    const names: NamedElement[] = items.map((entry, index) => [entry, `${id}-item-${index}`, 'vt-acc']);
    if (glideSelector) {
      document.querySelectorAll(glideSelector).forEach((element, index) => {
        names.push([element, `${id}-glide-${index}`, 'vt-glide']);
      });
    }

    await withViewTransition(
      () => {
        if (single && willOpen) {
          for (const other of items) if (other !== item) setOpen(other, false);
        }
        setOpen(item, willOpen);
      },
      { kind: 'accordion', names },
    );
  };

  for (const item of items) {
    const { trigger, panel } = parts(item);
    if (!trigger || !panel) continue;
    setOpen(item, trigger.getAttribute('aria-expanded') === 'true');
    trigger.addEventListener('click', () => void toggle(item));
  }
}

export function initAccordions(): void {
  document.querySelectorAll<HTMLElement>('[data-accordion]').forEach(setup);
}
