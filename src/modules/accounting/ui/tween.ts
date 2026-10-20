import { prefersReducedMotion } from '../../../shared/lib/view-transition';

/**
 * Counts a number up (or down) to its new value. The current value is remembered on the
 * element, so a second call mid-flight continues from where the first one was.
 */

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

const frames = new WeakMap<Element, number>();
const current = new WeakMap<Element, number>();

export interface TweenOptions {
  duration?: number;
  /** Start from this value instead of the one currently shown. */
  from?: number;
  delay?: number;
}

export function tweenNumber(element: HTMLElement, to: number, format: (value: number) => string, options: TweenOptions = {}): void {
  const pending = frames.get(element);
  if (pending !== undefined) cancelAnimationFrame(pending);
  frames.delete(element);

  const from = options.from ?? current.get(element) ?? 0;
  const set = (value: number) => {
    current.set(element, value);
    element.textContent = format(value);
  };

  if (prefersReducedMotion() || from === to) {
    set(to);
    return;
  }

  const { duration = 1100, delay = 0 } = options;
  set(from);
  const start = performance.now() + delay;

  const tick = (now: number) => {
    const progress = Math.min(1, Math.max(0, (now - start) / duration));
    set(progress >= 1 ? to : from + (to - from) * easeOutExpo(progress));
    if (progress < 1) frames.set(element, requestAnimationFrame(tick));
    else frames.delete(element);
  };
  frames.set(element, requestAnimationFrame(tick));
}

/** Numeric value last rendered by `tweenNumber` for this element. */
export function shownValue(element: Element): number {
  return current.get(element) ?? 0;
}
