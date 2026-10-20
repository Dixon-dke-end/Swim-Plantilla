/**
 * Same-document view transitions.
 *
 * Every in-page state change goes through `withViewTransition(update)`. When the
 * browser lacks the API, or the visitor prefers reduced motion, `update()` simply
 * runs without any animation.
 *
 * While a transition runs, `<html data-vt="<kind>">` lets CSS tune the animation
 * for that interaction (see shared/styles/motion.css).
 */

/** [element, view-transition-name, optional view-transition-class] */
export type NamedElement = readonly [Element | null | undefined, string, string?];

export interface TransitionOptions {
  /** Interaction kind, exposed as `html[data-vt]`. */
  kind?: string;
  /** Elements that receive a view-transition-name only while this transition runs. */
  names?: readonly NamedElement[];
  /**
   * Product photos carry names for the page-to-page morph. Named
   * elements paint above the page snapshot, so by default they are muted while a
   * transition runs (otherwise they would sit on top of the drawer, menu and dialog).
   * Set this when the transition animates the shared photo itself.
   */
  keepShared?: boolean;
}

/** Elements that can carry a cross-page transition name. */
const SHARED_SELECTOR = '.vt-media';

export function supportsViewTransitions(): boolean {
  return typeof document !== 'undefined' && typeof document.startViewTransition === 'function';
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** True while Astro's ClientRouter is animating a page navigation. */
function isNavigating(): boolean {
  return document.documentElement.hasAttribute('data-astro-transition');
}

function applyNames(names: readonly NamedElement[]): HTMLElement[] {
  const applied: HTMLElement[] = [];
  for (const [element, name, className] of names) {
    if (!(element instanceof HTMLElement)) continue;
    element.style.setProperty('view-transition-name', name);
    if (className) element.style.setProperty('view-transition-class', className);
    applied.push(element);
  }
  return applied;
}

function clearNames(elements: readonly HTMLElement[]): void {
  for (const element of elements) {
    element.style.removeProperty('view-transition-name');
    element.style.removeProperty('view-transition-class');
    if (!element.getAttribute('style')) element.removeAttribute('style');
  }
}

let sequence = 0;

export async function withViewTransition(
  update: () => void | Promise<void>,
  options: TransitionOptions = {},
): Promise<void> {
  if (!supportsViewTransitions() || prefersReducedMotion() || isNavigating()) {
    await update();
    return;
  }

  const { kind = 'ui', names = [], keepShared = false } = options;
  const root = document.documentElement;
  const id = ++sequence;
  const explicit = new Set<Element | null | undefined>(names.map(([element]) => element));
  const muted: NamedElement[] = keepShared
    ? []
    : Array.from(document.querySelectorAll(SHARED_SELECTOR))
        .filter((element) => !explicit.has(element))
        .map((element) => [element, 'none'] as const);
  const applied = applyNames([...names, ...muted]);
  root.dataset.vt = kind;

  try {
    const transition = document.startViewTransition(async () => {
      await update();
    });
    // A skipped transition rejects `ready` too; nobody awaits it, so keep it from surfacing as unhandled.
    transition.ready.catch(() => undefined);
    await transition.finished;
  } catch (error) {
    // A skipped transition still runs the update; only report real failures.
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      console.error('[view-transition]', error);
    }
  } finally {
    clearNames(applied);
    if (id === sequence) delete root.dataset.vt;
  }
}

/**
 * Chip labels need their own names: while an indicator pill slides between chips it
 * is painted above the page snapshot and would hide the text underneath.
 */
export function chipLabelNames(chips: readonly Element[], prefix: string): NamedElement[] {
  return chips.map((chip, index) => [chip.querySelector('.chip__label'), `${prefix}-label-${index}`, 'vt-label'] as const);
}

/** Resolves once an image is decoded, so a transition never snapshots a half-loaded photo. */
export async function decodeImage(image: HTMLImageElement | null | undefined, timeout = 600): Promise<void> {
  if (!image) return;
  try {
    await Promise.race([image.decode(), new Promise<void>((resolve) => setTimeout(resolve, timeout))]);
  } catch {
    // Decoding can reject for lazy or broken images; the transition should continue anyway.
  }
}
