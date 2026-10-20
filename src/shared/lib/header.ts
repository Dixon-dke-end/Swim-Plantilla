import { prefersReducedMotion } from './view-transition';

let sentinelObserver: IntersectionObserver | null = null;

/** Marks the navigation link that matches the current URL with aria-current="page". */
export function syncNavCurrent(): void {
  const path = location.pathname.replace(/\/$/, '') || '/';
  const category = new URLSearchParams(location.search).get('cat');

  document.querySelectorAll<HTMLAnchorElement>('[data-nav-link]').forEach((link) => {
    const url = new URL(link.href);
    const linkPath = url.pathname.replace(/\/$/, '') || '/';
    const linkCategory = url.searchParams.get('cat');
    const current = linkPath === path && (path !== '/coleccion' || linkCategory === category);

    if (current) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

/**
 * Where CSS scroll-driven animations are unavailable (or disabled by reduced
 * motion), a sentinel at the top of the page toggles `html.is-scrolled`, and CSS
 * transitions take over. Elsewhere the header is driven by `animation-timeline: scroll()`.
 */
function initScrolledState(): void {
  sentinelObserver?.disconnect();
  sentinelObserver = null;

  const root = document.documentElement;
  const scrollDriven = typeof CSS !== 'undefined' && CSS.supports('animation-timeline: scroll()');
  if (scrollDriven && !prefersReducedMotion()) {
    root.classList.remove('is-scrolled');
    return;
  }

  const sentinel = document.querySelector('[data-scroll-sentinel]');
  if (!sentinel || !('IntersectionObserver' in window)) {
    root.classList.add('is-scrolled');
    return;
  }

  sentinelObserver = new IntersectionObserver(([entry]) => {
    root.classList.toggle('is-scrolled', !entry?.isIntersecting);
  });
  sentinelObserver.observe(sentinel);
}

export function initHeader(): void {
  syncNavCurrent();
  initScrolledState();
}
