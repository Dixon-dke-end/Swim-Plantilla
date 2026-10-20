import { prefersReducedMotion } from './view-transition';

/**
 * Scroll-snap carousel with previous / next buttons.
 * Button state follows two IntersectionObservers on the first and last slide, so no scroll listeners.
 */

function setup(root: HTMLElement): void {
  if (root.dataset.ready) return;
  root.dataset.ready = 'true';

  const track = root.querySelector<HTMLElement>('[data-carousel-track]');
  const prev = root.querySelector<HTMLButtonElement>('[data-carousel-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-carousel-next]');
  const slides = track ? Array.from(track.children) : [];
  if (!track || !prev || !next || slides.length === 0) return;

  const step = () => {
    const first = slides[0] as HTMLElement;
    const gap = parseFloat(getComputedStyle(track).columnGap || '0') || 0;
    return first.getBoundingClientRect().width + gap;
  };

  const scrollByStep = (direction: 1 | -1) => {
    track.scrollBy({ left: direction * step(), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  prev.addEventListener('click', () => scrollByStep(-1));
  next.addEventListener('click', () => scrollByStep(1));

  track.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollByStep(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollByStep(-1);
    }
  });

  if (!('IntersectionObserver' in window)) return;

  const watch = (slide: Element, button: HTMLButtonElement) => {
    new IntersectionObserver(
      ([entry]) => {
        const atEdge = Boolean(entry?.isIntersecting);
        button.setAttribute('aria-disabled', String(atEdge));
        button.toggleAttribute('data-at-edge', atEdge);
      },
      { root: track, threshold: 0.98 },
    ).observe(slide);
  };

  watch(slides[0]!, prev);
  watch(slides[slides.length - 1]!, next);
}

export function initCarousels(): void {
  document.querySelectorAll<HTMLElement>('[data-carousel]').forEach(setup);
}
