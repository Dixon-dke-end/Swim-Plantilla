/**
 * Side index of the lab page: highlights the section in view and moves a marker
 * with a CSS transform (the index is sticky, so there are no scroll listeners).
 */

let observer: IntersectionObserver | null = null;

export function initLabIndex(): void {
  observer?.disconnect();
  observer = null;

  const nav = document.querySelector<HTMLElement>('[data-lab-index]');
  if (!nav || !('IntersectionObserver' in window)) return;

  const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
  const targets = links
    .map((link) => document.getElementById(link.hash.slice(1)))
    .filter((element): element is HTMLElement => element !== null);
  if (targets.length === 0) return;

  const visible = new Set<Element>();

  const paint = () => {
    // The first section (in document order) that is inside the reading band wins.
    const active = targets.find((target) => visible.has(target)) ?? null;
    links.forEach((link, index) => {
      const current = targets[index] === active;
      if (current) {
        link.setAttribute('aria-current', 'location');
        nav.style.setProperty('--active', String(index));
      } else {
        link.removeAttribute('aria-current');
      }
    });
    nav.toggleAttribute('data-has-active', active !== null);
  };

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      paint();
    },
    { rootMargin: '-35% 0px -55% 0px' },
  );

  targets.forEach((target) => observer?.observe(target));
}
