// Records each scene into its own clip: node record.mjs [sceneName ...]
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { CHROME, OUTPUT, SCALE, VIEWPORT } from './lib/config.mjs';
import { startRecording } from './lib/recorder.mjs';
import { encodeFrames } from './lib/encode.mjs';
import { createDirector } from './lib/director.mjs';
import { SCENES } from './scenes/index.mjs';

const requested = process.argv.slice(2);
const scenes = requested.length ? SCENES.filter((s) => requested.includes(s.name)) : SCENES;
if (!scenes.length) {
  console.error(`Unknown scene. Available: ${SCENES.map((s) => s.name).join(', ')}`);
  process.exit(1);
}

const SCENE_TIMEOUT_MS = 4 * 60 * 1000;
const overlay = await readFile(new URL('./lib/overlay.js', import.meta.url), 'utf8');

/**
 * Scrolls the whole page once, off camera, so every photo is already decoded when the
 * take starts; the first decode of a large image would otherwise stall a scroll.
 */
async function warmUp(page) {
  await page.evaluate(async () => {
    const start = scrollY;
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    for (let y = 0; y < document.documentElement.scrollHeight; y += 400) {
      scrollTo({ top: y, behavior: 'instant' });
      await frame();
    }
    // Lazy or hidden images may never load; never let one hold the take hostage.
    const settle = (image) => Promise.race([image.decode().catch(() => {}), new Promise((resolve) => setTimeout(resolve, 1500))]);
    await Promise.all([...document.images].map(settle));
    scrollTo({ top: start, behavior: 'instant' });
    await frame();
  });
  await page.waitForTimeout(600);
}
/**
 * Visits a page through Astro's router and comes back, off camera, so the navigation
 * on camera finds its photos already decoded (like a visitor who browsed before).
 */
async function warmRoute(page, href) {
  const pageLoad = () => page.evaluate(() => new Promise((resolve) => document.addEventListener('astro:page-load', resolve, { once: true })));
  let loaded = pageLoad();
  await page.evaluate((target) => {
    const link = Object.assign(document.createElement('a'), { href: target });
    document.body.appendChild(link);
    link.click();
  }, href);
  await loaded;
  await warmUp(page);
  loaded = pageLoad();
  await page.evaluate(() => history.back());
  await loaded;
  await page.waitForTimeout(800);
}

await mkdir('out/clips', { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--hide-scrollbars', '--disable-features=Translate', '--font-render-hinting=none'],
});

for (const scene of scenes) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    locale: 'es-CO',
    reducedMotion: 'no-preference',
    acceptDownloads: true,
  });
  await context.addInitScript(overlay);
  const page = await context.newPage();
  page.on('pageerror', (error) => console.error(`[${scene.name}] page error:`, error.message));
  const d = createDirector(page);

  const started = Date.now();
  console.log(`${scene.name}: recording…`);
  // A stuck scene must fail loudly instead of hanging the whole run.
  const watchdog = setTimeout(() => {
    console.error(`${scene.name}: exceeded ${SCENE_TIMEOUT_MS / 1000} s, aborting`);
    process.exit(2);
  }, SCENE_TIMEOUT_MS);
  await scene.prepare?.({ page, d, context });
  for (const route of scene.warmRoutes ?? []) await warmRoute(page, route);
  await warmUp(page);
  await page.mouse.move(1100, 640);
  const recording = await startRecording(page, `out/frames/${scene.name}`, OUTPUT);
  try {
    await scene.play({ page, d, context });
  } catch (error) {
    await page.screenshot({ path: `out/fail-${scene.name}.png` }).catch(() => {});
    throw error;
  } finally {
    await recording.stop();
  }
  const clip = `out/clips/${scene.name}.mp4`;
  const { frames, seconds } = await encodeFrames(`out/frames/${scene.name}`, clip, OUTPUT);
  clearTimeout(watchdog);
  console.log(`${scene.name}: ${seconds.toFixed(1)} s, ${frames} frames (${(frames / seconds).toFixed(1)} fps) in ${((Date.now() - started) / 1000).toFixed(0)} s → ${clip}`);
  await context.close();
}

await browser.close();
