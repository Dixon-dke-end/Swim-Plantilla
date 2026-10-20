import { formatNumber } from './format';
import { prefersReducedMotion } from './view-transition';

/**
 * Animated counters.
 *
 * <span data-counter="20000" data-prefix="" data-suffix=" h" data-decimals="0" data-counter-repeat>20.000 h</span>
 *
 * The markup already holds the final value (works without JavaScript). Counters
 * reset to zero and count up when they enter the viewport. With
 * `data-counter-repeat` they count again every time they come back into view
 * (used for tab panels).
 */

const DURATION = 1600;

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

let observer: IntersectionObserver | null = null;
const frames = new WeakMap<Element, number>();

function render(element: HTMLElement, value: number): void {
  const decimals = Number(element.dataset.decimals ?? 0);
  element.textContent = `${element.dataset.prefix ?? ''}${formatNumber(value, decimals)}${element.dataset.suffix ?? ''}`;
}

function cancel(element: Element): void {
  const frame = frames.get(element);
  if (frame !== undefined) cancelAnimationFrame(frame);
  frames.delete(element);
}

function run(element: HTMLElement): void {
  const target = Number(element.dataset.counter ?? 0);
  cancel(element);
  const start = performance.now();

  const tick = (now: number) => {
    const progress = Math.min(1, (now - start) / DURATION);
    render(element, target * easeOutExpo(progress));
    if (progress < 1) {
      frames.set(element, requestAnimationFrame(tick));
    } else {
      frames.delete(element);
    }
  };

  frames.set(element, requestAnimationFrame(tick));
}

export function initCounters(): void {
  observer?.disconnect();
  observer = null;

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;

  const counters = document.querySelectorAll<HTMLElement>('[data-counter]');
  if (!counters.length) return;

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const element = entry.target as HTMLElement;
        const repeat = element.hasAttribute('data-counter-repeat');

        if (entry.isIntersecting) {
          run(element);
          if (!repeat) observer?.unobserve(element);
        } else if (repeat) {
          cancel(element);
          render(element, 0);
        }
      }
    },
    { threshold: 0.6 },
  );

  counters.forEach((element) => {
    render(element, 0);
    observer?.observe(element);
  });
}
