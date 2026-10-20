export const BASE = process.env.DEMO_BASE ?? 'http://localhost:4321';
export const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
// A laptop-sized CSS viewport rendered at 4/3 density gives a crisp 1920x1080 capture
// with UI large enough to read in a video.
export const VIEWPORT = { width: 1440, height: 810 };
export const SCALE = 4 / 3;
export const OUTPUT = { width: 1920, height: 1080, fps: 30 };

let fontCss;

/** Copies the site's @font-face rules so standalone stage pages use the brand fonts. */
export async function siteFontFaces() {
  if (fontCss) return fontCss;
  const html = await (await fetch(`${BASE}/`)).text();
  const hrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
  const sheets = await Promise.all(hrefs.map(async (href) => (await fetch(new URL(href, BASE))).text()));
  fontCss = sheets.flatMap((css) => css.match(/@font-face\s*{[^}]*}/g) ?? []).join('\n');
  return fontCss;
}
