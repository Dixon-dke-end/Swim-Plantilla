import { withViewTransition } from './view-transition';

/**
 * Client-side only newsletter form: validates the email and swaps the form for
 * an animated success state. Nothing is sent over the network.
 */

let counter = 0;

function setup(root: HTMLElement): void {
  if (root.dataset.ready) return;
  root.dataset.ready = 'true';

  const form = root.querySelector<HTMLFormElement>('form');
  const input = root.querySelector<HTMLInputElement>('input[type="email"]');
  const error = root.querySelector<HTMLElement>('[data-newsletter-error]');
  const success = root.querySelector<HTMLElement>('[data-newsletter-success]');
  const reset = root.querySelector<HTMLButtonElement>('[data-newsletter-reset]');
  const target = root.querySelector<HTMLElement>('[data-newsletter-card]') ?? root;
  if (!form || !input || !success) return;

  const name = `newsletter-${++counter}`;
  const names = [[target, name, 'vt-soft'] as const];

  const showError = (message: string) => {
    if (error) error.textContent = message;
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input.value.trim();

    if (!value) {
      showError('Escribe tu correo electrónico.');
      input.focus();
      return;
    }
    if (!input.checkValidity()) {
      showError('Revisa el formato de tu correo, por ejemplo nombre@correo.com.');
      input.focus();
      return;
    }

    showError('');
    void withViewTransition(
      () => {
        form.hidden = true;
        success.hidden = false;
        success.classList.add('is-active');
      },
      { kind: 'newsletter', names },
    ).then(() => success.focus({ preventScroll: true }));
  });

  input.addEventListener('input', () => {
    if (input.getAttribute('aria-invalid') === 'true') showError('');
  });

  reset?.addEventListener('click', () => {
    void withViewTransition(
      () => {
        success.hidden = true;
        success.classList.remove('is-active');
        form.hidden = false;
        form.reset();
      },
      { kind: 'newsletter', names },
    ).then(() => input.focus({ preventScroll: true }));
  });
}

export function initNewsletter(): void {
  document.querySelectorAll<HTMLElement>('[data-newsletter]').forEach(setup);
}
