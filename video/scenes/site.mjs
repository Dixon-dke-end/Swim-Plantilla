// Storefront scenes: opening, home tour, collection, product, lab, mobile.
import { BASE, siteFontFaces } from '../lib/config.mjs';

const freezeTimeAnimations = (page) =>
  page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      if (animation.timeline === document.timeline) {
        animation.pause();
        animation.currentTime = 0;
      }
    }
  });

const playTimeAnimations = (page) =>
  page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      if (animation.timeline === document.timeline && animation.playState === 'paused') animation.play();
    }
  });

export const opening = {
  name: 'opening',
  async prepare({ page, d }) {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await freezeTimeAnimations(page);
    await d.chapter({ title: ' ', instant: true });
    await d.cursor(false);
  },
  async play({ page, d }) {
    await d.chapter({
      instant: true,
      index: 'DEMO · TIENDA DIGITAL',
      title: 'Una tienda que vende,\n<em>convence</em> y lleva las cuentas.',
      mark: true,
    });
    await d.wait(2200);
    await playTimeAnimations(page);
    await d.hideChapter();
    await d.wait(1600);
    await d.caption({
      kicker: 'Primera impresión',
      title: 'Una imagen profesional desde el primer segundo',
      body: 'Fotografía a pantalla completa, tipografía editorial y movimiento suave.',
      side: 'right',
    });
    await d.cursor(true);
    await d.wait(600);
    await d.moveTo(page.getByRole('link', { name: /Comprar colección/i }), { duration: 1000 });
    await d.wait(1100);
    await d.moveTo(page.getByRole('link', { name: /Ver las pruebas/i }), { duration: 600 });
    await d.wait(900);
    await d.hideCaption();

    await d.scrollTo('#categorias', { duration: 2200, offset: -90 });
    await d.moveTo(page.locator('#categorias a').nth(1), { duration: 800 });
    await d.wait(1100);

    await d.scrollTo('#destacados', { duration: 1800, offset: -90 });
    await d.caption({
      kicker: 'Catálogo vivo',
      title: 'Cada clic se acomoda con una animación',
      body: 'Nada salta ni parpadea: el cliente siempre sabe dónde está.',
      side: 'right',
    });
    await d.click(page.getByRole('tab', { name: 'Novedades' }), { duration: 800 });
    await d.wait(1700);
    await d.click(page.getByRole('tab', { name: 'Más vendidos' }), { duration: 600 });
    await d.wait(1300);
    await d.hideCaption();

    await d.scrollTo('.fabric', { duration: 1700, offset: -60 });
    await d.wait(700);

    const lookbook = await page.evaluate(() => {
      const el = document.querySelector('.lookbook');
      return { top: scrollY + el.getBoundingClientRect().top, height: el.offsetHeight };
    });
    await d.scrollTo(lookbook.top, { duration: 1600 });
    await d.scrollTo(lookbook.top + lookbook.height - 810, { duration: 4600 });
    await d.wait(400);

    await d.scrollTo('.reviews', { duration: 1800, offset: -60 });
    await d.caption({
      kicker: 'Prueba social',
      title: 'Reseñas y garantías a la vista',
      body: 'Lo que dicen otros clientes pesa más que cualquier anuncio.',
      side: 'right',
    });
    await d.click(page.getByRole('button', { name: 'Reseña siguiente' }), { duration: 800 });
    await d.wait(1800);
    await d.hideCaption();
  },
};

export const collection = {
  name: 'collection',
  warmRoutes: ['/coleccion'],
  async prepare({ page, d }) {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await d.chapter({ title: ' ', instant: true });
  },
  async play({ page, d }) {
    await d.chapter({
      instant: true,
      index: '02',
      title: 'Comprar,\n<em>sin fricción</em>',
      subtitle: 'Filtros, fichas y carrito que responden al instante.',
    });
    await d.wait(1800);
    await d.hideChapter();
    await d.click(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Colección' }), { duration: 1000 });
    await page.waitForURL('**/coleccion**', { waitUntil: 'commit' });
    await d.wait(1600);
    await d.caption({
      kicker: 'Colección',
      title: 'Filtrar es instantáneo',
      body: 'Las prendas se deslizan a su nuevo lugar en vez de recargar la página.',
      side: 'right',
    });
    const chip = (label) => page.locator('[data-shop-chip]').filter({ hasText: label });
    await d.click(chip('Bikinis'), { duration: 900 });
    await d.wait(1700);
    await d.click(chip('Todos'), { duration: 800 });
    await d.wait(1500);
    await d.moveTo('#shop-sort', { duration: 800 });
    await d.wait(500);
    const values = await page.$$eval('#shop-sort option', (options) => options.map((o) => o.value));
    await page.selectOption('#shop-sort', values[1]);
    await d.wait(1800);
    await d.hideCaption();
  },
};

export const product = {
  name: 'product',
  warmRoutes: ['/producto/ola'],
  async prepare({ page }) {
    await page.goto(`${BASE}/coleccion?cat=enterizos`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
  },
  async play({ page, d }) {
    await d.caption({ kicker: 'Ficha de producto', title: 'Del catálogo a la bolsa en tres clics' });
    await d.scrollTo(250, { duration: 1200 });
    await d.wait(300);
    // The whole card is a stretched link; aim at the photo so the morph starts from it.
    await d.click(page.locator('[data-shop] img').first(), { duration: 1100 });
    await page.waitForURL('**/producto/**', { waitUntil: 'commit' });
    await d.wait(2200);
    const swatches = page.getByRole('radiogroup', { name: 'Color' }).getByRole('radio');
    const swatchCount = await swatches.count();
    const swatchTarget = swatchCount > 1 ? swatches.nth(1) : page.locator('[aria-label="Color"] button').nth(1);
    await d.click(swatchTarget, { duration: 900 });
    await d.wait(1600);
    await d.click(page.getByRole('button', { name: /Guía de tallas/i }), { duration: 900 });
    await d.wait(1700);
    await d.click(page.getByRole('button', { name: 'Cerrar guía de tallas' }), { duration: 900 });
    await d.wait(1000);
    const sizes = page.locator('[aria-label="Talla"]').getByRole('radio');
    const sizeTarget = (await sizes.count()) ? sizes.nth(2) : page.locator('[aria-label="Talla"] button').nth(2);
    await d.click(sizeTarget, { duration: 900 });
    await d.wait(900);
    await d.click(page.getByRole('button', { name: /Agregar a la bolsa/i }), { duration: 900 });
    await d.wait(1600);
    await d.hideCaption();
    await d.click(page.locator('[data-cart-open]').first(), { duration: 1000 });
    await d.wait(2000);
    await d.click(page.locator('[data-cart-close]').first(), { duration: 800 });
    await d.wait(1000);
  },
};

export const lab = {
  name: 'lab',
  async prepare({ page }) {
    await page.goto(`${BASE}/pruebas`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
  },
  async play({ page, d }) {
    await d.caption({
      kicker: 'Pruebas de calidad',
      title: 'Mostramos la calidad, no solo la prometemos',
      side: 'right',
    });
    await d.wait(2200);
    await d.hideCaption();
    await d.scrollTo('#comparacion', { duration: 2200, offset: -110 });
    await d.wait(600);
    const range = await d.boxOf('[data-compare] input[type="range"]');
    const y = range.y + range.height / 2;
    await d.moveTo({ x: range.x + range.width / 2, y }, { duration: 900 });
    await page.mouse.down();
    await d.moveTo({ x: range.x + range.width * 0.18, y }, { duration: 1400 });
    await d.moveTo({ x: range.x + range.width * 0.84, y }, { duration: 1900 });
    await d.moveTo({ x: range.x + range.width * 0.5, y }, { duration: 1100 });
    await page.mouse.up();
    await d.wait(1200);
  },
};

const phoneStage = (src, fonts) => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>${fonts}</style>
<style>
  html, body { margin: 0; height: 100%; background: #F3EDE4; overflow: hidden; }
  body { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 80px; padding: 0 120px; box-sizing: border-box;
    font-family: 'Manrope Variable', system-ui, sans-serif; color: #13201F; }
  .kicker { font-size: 13px; letter-spacing: .22em; text-transform: uppercase; color: #C4502E; font-weight: 700; }
  h1 { font-family: 'Fraunces Variable', Georgia, serif; font-weight: 400; font-size: 64px; line-height: 1.04; letter-spacing: -.02em; margin: 18px 0; }
  h1 em { color: #0D4A4C; }
  p { font-size: 20px; line-height: 1.55; color: #3E4C4A; max-width: 520px; }
  .phone { box-sizing: border-box; width: 340px; height: 712px; padding: 12px; border-radius: 54px; background: #0F1716;
    box-shadow: 0 50px 90px rgba(13,32,31,.28), inset 0 0 0 2px #2A3533; position: relative; }
  .phone::before { content: ''; position: absolute; top: 21px; left: 50%; width: 88px; height: 24px; margin-left: -44px; border-radius: 20px; background: #0F1716; z-index: 2; }
  .screen { width: 316px; height: 688px; border-radius: 42px; overflow: hidden; background: #0B3B3D; display: flex; flex-direction: column; }
  .status { flex: none; height: 40px; display: flex; align-items: center; justify-content: space-between; padding: 4px 30px 0 34px;
    color: #F3EDE4; font-size: 13px; font-weight: 700; letter-spacing: .02em; }
  .status i { display: inline-block; width: 22px; height: 11px; border-radius: 3px; box-shadow: inset 0 0 0 1.5px #F3EDE4; position: relative; }
  .status i::after { content: ''; position: absolute; inset: 2.5px 5px 2.5px 2.5px; border-radius: 1px; background: #F3EDE4; }
  .viewport { flex: 1; overflow: hidden; }
  iframe { width: 390px; height: 800px; border: 0; transform: scale(.8103); transform-origin: 0 0; }
  /* Entrance waits for body.go, set once the embedded site has loaded. */
  .copy > * { opacity: 0; }
  .go .copy > * { opacity: 1; animation: rise .9s cubic-bezier(.2,.8,.2,1) both; }
  .go .copy > :nth-child(2) { animation-delay: .1s } .go .copy > :nth-child(3) { animation-delay: .2s }
  .phone { opacity: 0; }
  .go .phone { opacity: 1; animation: lift 1.1s cubic-bezier(.2,.8,.2,1) both .15s; }
  @keyframes rise { from { opacity: 0; transform: translateY(30px) } }
  @keyframes lift { from { opacity: 0; transform: translateY(60px) rotate(-2deg) } }
</style></head><body>
  <div class="copy">
    <div class="kicker">En el celular</div>
    <h1>Pensado primero para <em>el celular</em>.</h1>
    <p>Ahí es donde compra tu cliente. Menú, filtros y carrito se sienten como una app.</p>
  </div>
  <div class="phone"><div class="screen"><div class="status"><span>9:41</span><i></i></div><div class="viewport"><iframe src="${src}" title="MAREA en el celular"></iframe></div></div></div>
</body></html>`;

export const mobile = {
  name: 'mobile',
  async prepare({ page }) {
    const html = phoneStage(`${BASE}/`, await siteFontFaces());
    await page.route(`${BASE}/__stage/phone`, (route) => route.fulfill({ contentType: 'text/html', body: html }));
    await page.route(`${BASE}/__stage/blank`, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!doctype html><body style="margin:0;background:#F3EDE4"></body>' }));
    await page.goto(`${BASE}/__stage/blank`, { waitUntil: 'load' });
  },
  async play({ page, d }) {
    await d.cursor(false);
    await page.goto(`${BASE}/__stage/phone`, { waitUntil: 'networkidle' });
    await d.cursor(false);
    const frame = page.frameLocator('iframe');
    const inner = page.frames().find((f) => f.url().startsWith(BASE) && f !== page.mainFrame());
    // Phones use overlay scrollbars; drop the desktop gutter inside the mockup.
    await inner.addStyleTag({ content: 'html { scrollbar-gutter: auto !important; }' });
    await inner.evaluate(() => Promise.all([...document.images].filter((image) => image.getBoundingClientRect().top < innerHeight).map((image) => Promise.race([image.decode().catch(() => {}), new Promise((resolve) => setTimeout(resolve, 1500))]))));
    await page.waitForTimeout(400);
    await page.evaluate(() => document.body.classList.add('go'));
    await d.wait(2600);
    await inner.evaluate(async () => {
      const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
      const glide = (to, duration) => new Promise((resolve) => {
        const from = scrollY;
        const start = performance.now();
        const step = (now) => {
          const p = Math.min(1, (now - start) / duration);
          scrollTo({ top: from + (to - from) * ease(p), behavior: 'instant' });
          p < 1 ? requestAnimationFrame(step) : resolve();
        };
        requestAnimationFrame(step);
      });
      await glide(innerHeight * 1.1, 1800);
      await new Promise((r) => setTimeout(r, 400));
      await glide(innerHeight * 2.6, 2000);
      await new Promise((r) => setTimeout(r, 400));
      await glide(0, 1500);
    });
    await d.wait(500);
    await d.cursor(true);
    await d.click(frame.getByRole('button', { name: 'Abrir menú' }), { duration: 900 });
    await d.wait(1800);
    await d.click(frame.locator('[data-menu-close]'), { duration: 700 });
    await d.wait(1200);
  },
};
