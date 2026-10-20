/**
 * Before / after slider. The range input is the single source of truth: moving
 * it only updates the `--pos` custom property, and CSS clips the top layer with it.
 */

/** Width of the (invisible) native thumb, in rem. Keep in sync with CompareSlider.astro. */
const THUMB = 3.25;

function setup(root: HTMLElement): void {
  if (root.dataset.ready) return;
  root.dataset.ready = 'true';

  const input = root.querySelector<HTMLInputElement>('input[type="range"]');
  if (!input) return;

  const paint = () => {
    // Offset by half the native thumb so the visible handle follows the pointer exactly.
    root.style.setProperty('--pos', `calc(${THUMB / 2}rem + (100% - ${THUMB}rem) * ${Number(input.value) / 100})`);
    input.setAttribute('aria-valuetext', `${input.value} % de la tela nueva visible`);
  };

  input.addEventListener('input', paint);
  paint();
}

export function initCompare(): void {
  document.querySelectorAll<HTMLElement>('[data-compare]').forEach(setup);
}
