import type { TransitionBeforePreparationEvent } from 'astro:transitions/client';

/**
 * Card → product page photo morph.
 *
 * Only the card that was clicked shares its photo with the product page. If every
 * card carried a permanent name, the cards repeated in "También te puede gustar"
 * would make the other cards fly across the screen during the navigation.
 */

const PRODUCT_PATH = /^\/producto\/([^/]+)\/?$/;

export function productSlugFromUrl(url: URL): string | null {
  return PRODUCT_PATH.exec(url.pathname)?.[1] ?? null;
}

let listening = false;

export function initCardMorph(): void {
  if (listening) return;
  listening = true;

  document.addEventListener('astro:before-preparation', (event) => {
    const { sourceElement, to } = event as TransitionBeforePreparationEvent;
    const slug = productSlugFromUrl(to);
    const media = sourceElement?.closest('.pcard')?.querySelector<HTMLElement>('[data-card-media]');
    if (!slug || !media) return;
    media.style.setProperty('view-transition-name', `product-${slug}`);
  });
}
