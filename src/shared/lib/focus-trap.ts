const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.getClientRects().length > 0 && !element.closest('[inert], [hidden]'),
  );
}

export interface FocusTrap {
  activate(initialFocus?: HTMLElement | null): void;
  deactivate(restoreFocus?: boolean): void;
}

/** Keeps Tab / Shift+Tab inside `container` and hands focus back when released. */
export function createFocusTrap(container: HTMLElement): FocusTrap {
  let previous: HTMLElement | null = null;

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const items = focusableIn(container);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !container.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !container.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };

  return {
    activate(initialFocus) {
      previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      container.addEventListener('keydown', onKeydown);
      (initialFocus ?? focusableIn(container)[0])?.focus({ preventScroll: true });
    },
    deactivate(restoreFocus = true) {
      container.removeEventListener('keydown', onKeydown);
      if (restoreFocus && previous?.isConnected) previous.focus({ preventScroll: true });
      previous = null;
    },
  };
}
