import { prefersReducedMotion } from './view-transition';

const SELECTOR = '.reveal, .reveal-media, .reveal-stagger, .meter';

let observer: IntersectionObserver | null = null;

/**
 * Browsers with CSS scroll-driven animations need no JavaScript: the reveal is
 * pure CSS. For everyone else an IntersectionObserver toggles `.is-visible`,
 * and visitors who prefer reduced motion simply get the final state.
 */
export function initReveal(): void {
  observer?.disconnect();
  observer = null;

  const reduced = prefersReducedMotion();
  const scrollDriven = typeof CSS !== 'undefined' && CSS.supports('animation-timeline: view()');
  if (scrollDriven && !reduced) return;

  const targets = document.querySelectorAll<HTMLElement>(SELECTOR);

  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach((target) => target.classList.add('is-visible'));
    return;
  }

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer?.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );

  targets.forEach((target) => observer?.observe(target));
}
