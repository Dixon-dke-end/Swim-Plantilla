// Small choreography toolkit: eased cursor moves, clicks, cinematic scrolling
// and overlay calls. Every helper awaits real time so the recording breathes.
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

export function createDirector(page) {
  let pointer = { x: 1100, y: 640 };

  const wait = (ms) => page.waitForTimeout(ms);

  async function boxOf(target) {
    const locator = (typeof target === 'string' ? page.locator(target) : target).first();
    await locator.waitFor({ state: 'visible', timeout: 15000 });
    const box = await locator.boundingBox();
    if (!box) throw new Error(`No bounding box for ${target}`);
    return box;
  }

  async function moveTo(target, { duration = 750, offset = { x: 0.5, y: 0.5 } } = {}) {
    const isPoint = typeof target?.x === 'number' && typeof target?.y === 'number' && target.width === undefined;
    let box = isPoint ? null : await boxOf(target);
    const { height: viewportHeight } = page.viewportSize();
    if (box && (box.y < 90 || box.y + box.height > viewportHeight - 24)) {
      // Glide the target into view first, the way a person would scroll to it.
      const current = await page.evaluate(() => scrollY);
      await scrollTo(current + box.y + box.height / 2 - viewportHeight / 2, { duration: 1100 });
      box = await boxOf(target);
    }
    const to = isPoint ? target : { x: box.x + box.width * offset.x, y: box.y + box.height * offset.y };
    const from = { ...pointer };
    // A slight arc makes the motion feel hand-driven instead of robotic.
    const bend = Math.min(60, Math.hypot(to.x - from.x, to.y - from.y) * 0.08);
    // Driven by the wall clock so IPC latency never stretches the move.
    const start = Date.now();
    for (;;) {
      const t = Math.min(1, (Date.now() - start) / duration);
      const p = easeInOut(t);
      const arc = Math.sin(p * Math.PI) * bend;
      await page.mouse.move(from.x + (to.x - from.x) * p, from.y + (to.y - from.y) * p - arc);
      if (t >= 1) break;
      await new Promise((resolve) => setTimeout(resolve, 8));
    }
    pointer = to;
    return to;
  }

  async function click(target, { pause = 260, ...options } = {}) {
    await moveTo(target, options);
    await wait(pause);
    // Clicks during a view transition hit the snapshot layer and are lost.
    await page.waitForFunction(() => !document.activeViewTransition, null, { timeout: 5000 }).catch(() => {});
    await page.mouse.down();
    await wait(90);
    await page.mouse.up();
  }

  async function scrollTo(target, { duration = 1800, block = 'start', offset = 0, settle = 320 } = {}) {
    await page.evaluate(
      async ({ target, duration, block, offset }) => {
        let y = target;
        if (typeof target === 'string') {
          const el = document.querySelector(target);
          if (!el) throw new Error(`Missing ${target}`);
          const rect = el.getBoundingClientRect();
          y = scrollY + rect.top + offset;
          if (block === 'center') y -= (innerHeight - rect.height) / 2;
        }
        y = Math.max(0, Math.min(y, document.documentElement.scrollHeight - innerHeight));
        const from = scrollY;
        const start = performance.now();
        const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
        await new Promise((resolve) => {
          const step = (now) => {
            const p = Math.min(1, (now - start) / duration);
            scrollTo({ top: from + (y - from) * ease(p), behavior: 'instant' });
            p < 1 ? requestAnimationFrame(step) : resolve();
          };
          requestAnimationFrame(step);
        });
      },
      { target, duration, block, offset },
    );
    // Chrome re-rasters the page at full quality right after a scroll stops (~250 ms);
    // starting the next animation inside that window drops it from the capture.
    await wait(settle);
  }

  const overlay = (method, ...args) =>
    page.evaluate(([method, args]) => window.__demo[method](...args), [method, args]);

  return {
    page,
    wait,
    moveTo,
    click,
    scrollTo,
    boxOf,
    caption: (options) => overlay('caption', options),
    hideCaption: () => overlay('hideCaption'),
    chapter: (options) => overlay('chapter', options),
    // Revealing the page behind a full-screen card triggers the same re-raster as a scroll.
    hideChapter: async () => { await overlay('hideChapter'); await wait(320); },
    highlight: async (target, padding) => overlay('highlight', target ? await boxOf(target) : null, padding),
    badge: (text) => overlay('badge', text),
    cursor: (visible) => overlay('cursor', visible),
    setPointer: (point) => { pointer = point; },
  };
}
