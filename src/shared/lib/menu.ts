import { navigate } from 'astro:transitions/client';
import { createFocusTrap } from './focus-trap';
import { withViewTransition } from './view-transition';

/** Full-screen mobile menu, opened and closed with a view transition. */

function setup(menu: HTMLElement): void {
  if (menu.dataset.ready) return;
  menu.dataset.ready = 'true';

  const trap = createFocusTrap(menu);
  const root = document.documentElement;
  const isOpen = () => !menu.hidden;

  const burgers = () => document.querySelectorAll<HTMLButtonElement>('[data-menu-open]');
  const setExpanded = (expanded: boolean) => {
    burgers().forEach((burger) => {
      burger.setAttribute('aria-expanded', String(expanded));
      burger.setAttribute('aria-label', expanded ? 'Cerrar menú' : 'Abrir menú');
    });
  };

  const show = () => {
    menu.hidden = false;
    menu.inert = false;
    menu.classList.add('is-open');
    root.classList.add('is-locked');
    setExpanded(true);
    trap.activate(menu.querySelector<HTMLElement>('[data-menu-close]'));
  };

  const hide = (restoreFocus: boolean) => {
    menu.classList.remove('is-open');
    menu.hidden = true;
    menu.inert = true;
    root.classList.remove('is-locked');
    setExpanded(false);
    trap.deactivate(restoreFocus);
  };

  const open = () => {
    if (isOpen()) return Promise.resolve();
    return withViewTransition(show, { kind: 'menu' });
  };

  const close = (restoreFocus = true) => {
    if (!isOpen()) return Promise.resolve();
    return withViewTransition(() => hide(restoreFocus), { kind: 'menu' });
  };

  document.addEventListener('click', (event) => {
    const target = event.target as Element;
    if (target.closest('[data-menu-open]')) {
      void (isOpen() ? close() : open());
      return;
    }
    if (target.closest('[data-menu-close]')) {
      void close();
      return;
    }

    const link = target.closest<HTMLAnchorElement>('#mobile-menu a[href]');
    if (link && isOpen() && !event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
      // Let the menu fold away first, then navigate.
      event.preventDefault();
      const href = link.href;
      void close(false).then(() => navigate(href));
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      event.preventDefault();
      void close();
    }
  });

  // Leaving the mobile layout while the menu is open would strand the visitor.
  matchMedia('(min-width: 72rem)').addEventListener('change', (event) => {
    if (event.matches && isOpen()) hide(false);
  });

  // Safety net for navigations that did not start from a menu link.
  document.addEventListener('astro:before-preparation', () => {
    if (isOpen()) hide(false);
  });
}

export function initMenu(): void {
  const menu = document.getElementById('mobile-menu');
  if (menu) setup(menu);
}
