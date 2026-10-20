// Injected into every page of the recording. Draws the demo layer (cursor,
// captions, chapter cards, highlights) inside a shadow root attached to <html>,
// so Astro's ClientRouter body swaps never remove it. The host gets its own
// view-transition-name so page transitions do not crossfade the captions.
(() => {
  if (window.__demo || window.top !== window) return;

  const css = `
    :host { all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;
      view-transition-name: demo-overlay; font-family: 'Manrope Variable', system-ui, sans-serif; }
    * { box-sizing: border-box; }
    .caption { position: absolute; left: 48px; bottom: 48px; max-width: 620px; padding: 26px 30px 28px;
      border-radius: 22px; color: #F3EDE4; background: rgba(13, 32, 31, 0.9);
      box-shadow: 0 24px 60px rgba(0,0,0,.28), inset 0 0 0 1px rgba(243,237,228,.12); opacity: 0; visibility: hidden; }
    .caption.right { left: auto; right: 48px; }
    .caption .kicker { font-size: 13px; letter-spacing: .22em; text-transform: uppercase; color: #F2A285; font-weight: 700; }
    .caption .title { margin-top: 10px; font-family: 'Fraunces Variable', Georgia, serif; font-size: 34px; line-height: 1.12; letter-spacing: -.01em; }
    .caption .body { margin-top: 10px; font-size: 17px; line-height: 1.5; color: rgba(243,237,228,.82); }
    .chapter { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; gap: 18px;
      background: radial-gradient(120% 90% at 50% 10%, #13615F 0%, #0D4A4C 45%, #082F31 100%); color: #F3EDE4;
      clip-path: inset(100% 0 0 0); }
    .chapter .index { font-size: 15px; letter-spacing: .3em; color: #F2A285; font-weight: 700; }
    .chapter .title { font-family: 'Fraunces Variable', Georgia, serif; font-size: 96px; line-height: 1; letter-spacing: -.02em; max-width: 1100px; }
    .chapter .title em { font-style: italic; }
    .chapter .subtitle { font-size: 22px; color: rgba(243,237,228,.8); max-width: 760px; margin: 0 auto; line-height: 1.5; }
    .chapter .mark { font-family: 'Fraunces Variable', Georgia, serif; font-size: 30px; letter-spacing: .5em; margin-top: 26px; padding-left: .5em; opacity: .9; }
    .chapter .line { display: block; overflow: hidden; }
    .chapter .line > span { display: inline-block; }
    .pillars { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; max-width: 1180px; margin-top: 30px; text-align: left; }
    .pillar { padding: 28px; border-radius: 22px; background: rgba(243,237,228,.08); box-shadow: inset 0 0 0 1px rgba(243,237,228,.14); }
    .pillar b { display: block; font-family: 'Fraunces Variable', Georgia, serif; font-weight: 400; font-size: 38px; }
    .pillar span { display: block; margin-top: 10px; font-size: 18px; line-height: 1.5; color: rgba(243,237,228,.82); }
    .cursor { position: absolute; left: 0; top: 0; width: 26px; height: 26px; transform: translate(-100px, -100px);
      filter: drop-shadow(0 3px 6px rgba(0,0,0,.35)); transition: opacity .3s; }
    .ripple { position: absolute; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%;
      border: 2px solid #E3643F; background: rgba(227,100,63,.18); }
    .highlight { position: absolute; border-radius: 16px; box-shadow: 0 0 0 3px #E3643F, 0 0 0 9999px rgba(19,32,31,.0), 0 0 40px rgba(227,100,63,.45); opacity: 0; }
    .badge { position: absolute; top: 28px; right: 32px; padding: 9px 16px; border-radius: 999px; font-size: 12px;
      letter-spacing: .18em; text-transform: uppercase; font-weight: 700; color: #F3EDE4; background: rgba(13,32,31,.75);
      opacity: 0; }
  `;

  const host = document.createElement('demo-overlay');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${css}</style>
    <div class="badge"></div>
    <div class="chapter" aria-hidden="true"></div>
    <div class="caption"><div class="kicker"></div><div class="title"></div><div class="body"></div></div>
    <div class="highlight"></div>
    <svg class="cursor" viewBox="0 0 26 26" aria-hidden="true">
      <path d="M4 2.5 L4 21 L9 16.4 L12.4 24 L15.8 22.5 L12.5 15 L19.5 15 Z" fill="#fff" stroke="#13201F" stroke-width="1.6" stroke-linejoin="round"/>
    </svg>`;

  const $ = (selector) => root.querySelector(selector);
  const ease = 'cubic-bezier(.2,.8,.2,1)';

  // Init scripts can run before <html> exists, so mount lazily and re-mount if removed.
  // Scrollbars are hidden while recording, so the site's reserved gutter would
  // show up as an empty strip on the right edge.
  const recordingStyle = document.createElement('style');
  recordingStyle.textContent = 'html { scrollbar-gutter: auto !important; }';

  let watched = null;
  const watcher = new MutationObserver(() => mount());
  const mount = () => {
    const html = document.documentElement;
    if (!html) return;
    if (!host.isConnected) html.appendChild(host);
    if (!recordingStyle.isConnected) html.appendChild(recordingStyle);
    if (watched !== html) {
      watched = html;
      watcher.observe(html, { childList: true });
    }
  };
  mount();
  new MutationObserver(mount).observe(document, { childList: true });

  addEventListener('mousemove', (event) => {
    $('.cursor').style.transform = `translate(${event.clientX - 4}px, ${event.clientY - 2}px)`;
  }, { capture: true, passive: true });

  addEventListener('mousedown', (event) => {
    const ripple = document.createElement('div');
    ripple.className = 'ripple';
    ripple.style.left = `${event.clientX}px`;
    ripple.style.top = `${event.clientY}px`;
    root.appendChild(ripple);
    ripple.animate(
      [{ transform: 'scale(.4)', opacity: 1 }, { transform: 'scale(3.2)', opacity: 0 }],
      { duration: 650, easing: ease },
    ).finished.then(() => ripple.remove());
    $('.cursor').animate([{ scale: 1 }, { scale: .82 }, { scale: 1 }], { duration: 260, easing: ease });
  }, { capture: true, passive: true });

  const lines = (text) =>
    text.split('\n').map((line) => `<span class="line"><span>${line}</span></span>`).join('');

  window.__demo = {
    async caption({ kicker = '', title = '', body = '', side = 'left' }) {
      const box = $('.caption');
      if (box.style.visibility === 'visible') await this.hideCaption();
      box.classList.toggle('right', side === 'right');
      box.querySelector('.kicker').textContent = kicker;
      box.querySelector('.title').textContent = title;
      box.querySelector('.body').textContent = body;
      box.querySelector('.body').style.display = body ? '' : 'none';
      // Paint the new text once while (almost) invisible: the first raster of fresh
      // text costs ~100 ms and would otherwise make the caption pop in half-faded.
      box.getAnimations().forEach((animation) => animation.cancel());
      box.style.opacity = '0.001';
      box.style.visibility = 'visible';
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 60))));
      box.style.opacity = '';
      await box.animate(
        [{ opacity: 0, transform: 'translateY(26px)' }, { opacity: 1, transform: 'none' }],
        { duration: 700, easing: ease, fill: 'forwards' },
      ).finished;
    },
    async hideCaption() {
      const box = $('.caption');
      await box.animate(
        [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(14px)' }],
        { duration: 380, easing: ease, fill: 'forwards' },
      ).finished;
      // Fully drop the layer so it costs nothing while the page scrolls underneath.
      box.style.visibility = 'hidden';
    },
    async chapter({ index = '', title = '', subtitle = '', mark = false, pillars = null, instant = false }) {
      const card = $('.chapter');
      card.innerHTML = `
        ${index ? `<div class="index">${index}</div>` : ''}
        <div class="title">${lines(title)}</div>
        ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
        ${pillars ? `<div class="pillars">${pillars.map(([h, t]) => `<div class="pillar"><b>${h}</b><span>${t}</span></div>`).join('')}</div>` : ''}
        ${mark ? '<div class="mark">MAREA</div>' : ''}`;
      card.getAnimations().forEach((animation) => animation.cancel());
      $('.cursor').style.visibility = 'hidden';
      card.style.clipPath = instant ? 'inset(0 0 0 0)' : 'inset(100% 0 0 0)';
      if (!instant) {
        await card.animate(
          [{ clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0 0 0 0)' }],
          { duration: 900, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' },
        ).finished;
      }
      const parts = [...card.querySelectorAll('.index, .line > span, .subtitle, .pillar, .mark')];
      await Promise.all(parts.map((part, i) => part.animate(
        [{ opacity: 0, transform: 'translateY(60%)' }, { opacity: 1, transform: 'none' }],
        { duration: 900, delay: i * 110, easing: ease, fill: 'backwards' },
      ).finished));
    },
    async hideChapter() {
      const card = $('.chapter');
      setTimeout(() => { $('.cursor').style.visibility = ''; }, 450);
      await card.animate(
        [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 100% 0)' }],
        { duration: 900, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' },
      ).finished;
    },
    async highlight(rect, padding = 10) {
      const box = $('.highlight');
      if (!rect) {
        await box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).finished;
        return;
      }
      Object.assign(box.style, {
        left: `${rect.x - padding}px`, top: `${rect.y - padding}px`,
        width: `${rect.width + padding * 2}px`, height: `${rect.height + padding * 2}px`,
      });
      await box.animate(
        [{ opacity: 0, transform: 'scale(1.04)' }, { opacity: 1, transform: 'none' }],
        { duration: 500, easing: ease, fill: 'forwards' },
      ).finished;
    },
    badge(text) {
      const badge = $('.badge');
      badge.textContent = text;
      badge.animate([{ opacity: badge.style.opacity || 0 }, { opacity: text ? 1 : 0 }], { duration: 400, fill: 'forwards' });
    },
    cursor(visible) {
      $('.cursor').style.opacity = visible ? '1' : '0';
    },
  };
})();
