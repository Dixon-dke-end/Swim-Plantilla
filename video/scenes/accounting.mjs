// Accounting scenes: the full Excel-to-ledger flow, then other source formats.
import { BASE } from '../lib/config.mjs';

const demo = (name) => `[data-demo="${name}"]`;

async function openAccounting(page) {
  await page.goto(`${BASE}/contabilidad`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-accounting][data-ready]');
  await page.waitForTimeout(1200);
}

export const accounting = {
  name: 'accounting',
  async prepare({ page, d }) {
    await openAccounting(page);
    await d.chapter({ title: ' ', instant: true });
    await d.cursor(false);
  },
  async play({ page, d }) {
    await d.chapter({
      instant: true,
      index: '03',
      title: 'Contabilidad que se\n<em>adapta</em> a tu negocio',
      subtitle: 'Tus ingresos, desde el Excel que ya usas. Sin cambiar tu forma de trabajar.',
    });
    await d.wait(2000);
    await d.hideChapter();
    await d.cursor(true);
    await d.caption({
      kicker: 'Paso 1',
      title: 'Sube el Excel que ya usas',
      body: 'Libro de ventas, cuadre de caja del POS o extracto del banco.',
      side: 'right',
    });
    await d.wait(1000);
    await d.scrollTo(330, { duration: 1500 });
    await d.click(demo('sample-ventas'), { duration: 1000 });
    await d.hideCaption();
    await page.waitForSelector(demo('confirm-mapping'), { state: 'visible' });
    await d.wait(1200);

    await d.caption({
      kicker: 'Paso 2',
      title: 'Las columnas se reconocen solas',
      body: 'Detectamos la fila de encabezados, el formato y cada dato. Todo se puede ajustar.',
      side: 'right',
    });
    await d.highlight(page.getByText(/Perfil reconocido/i), 8);
    await d.wait(1800);
    await d.highlight(null);
    await d.scrollTo(380, { duration: 1500 });
    await d.highlight('section[aria-labelledby="acct-cols-title"]', 6);
    await d.wait(1500);
    await d.highlight(null);
    await d.hideCaption();
    await d.moveTo(demo('pick-cash'), { duration: 900 });
    await d.wait(700);
    await d.click(demo('pick-accrual'), { duration: 600 });
    await d.wait(700);
    await d.click(demo('confirm-mapping'), { duration: 1000 });
    await page.waitForSelector(demo('kpi-gross'), { state: 'visible', timeout: 15000 });
    await d.wait(600);

    await d.caption({
      kicker: 'Paso 3',
      title: 'Tu contabilidad, lista en segundos',
      body: '255 ventas procesadas con IVA, cuentas por cobrar y ticket promedio.',
      side: 'right',
    });
    await d.wait(2000);
    await d.hideCaption();
    await d.scrollTo('[data-chart]', { duration: 1700, offset: -190 });
    await d.wait(1600);
    await d.scrollTo(demo('quality'), { duration: 1800, offset: -110 });
    await d.caption({
      kicker: 'Calidad de los datos',
      title: 'Detecta errores y duplicados antes que tu contador',
      body: 'Fila y motivo exactos: nada se pierde ni se cuenta dos veces.',
      side: 'right',
    });
    await d.highlight(demo('quality'), 6);
    await d.wait(2400);
    await d.highlight(null);
    await d.hideCaption();

    await d.scrollTo(0, { duration: 1800 });
    await d.caption({
      kicker: 'Tu método contable',
      title: 'Mismo archivo, otro método',
      body: 'Causación o caja: todo se recalcula al instante.',
      side: 'right',
    });
    await d.click(demo('method-cash'), { duration: 1000 });
    await d.wait(2200);
    await d.click(demo('method-accrual'), { duration: 700 });
    await d.wait(1600);
    await d.hideCaption();

    await d.scrollTo(demo('tab-journal'), { duration: 2000, offset: -140 });
    await d.click(demo('tab-journal'), { duration: 900 });
    await d.caption({
      kicker: 'Asientos contables',
      title: 'Asientos en PUC que siempre cuadran',
      body: 'Débitos y créditos listos para tu contador o tu software contable.',
      side: 'right',
    });
    await d.wait(2200);
    await d.click(demo('export-xlsx'), { duration: 1000 });
    await d.wait(1200);
    await d.hideCaption();
  },
};

export const formats = {
  name: 'formats',
  async prepare({ page }) {
    await openAccounting(page);
    await page.evaluate(() => scrollTo(0, 330));
    await page.waitForTimeout(600);
  },
  async play({ page, d }) {
    await d.caption({
      kicker: 'Se adapta',
      title: '¿Tu POS o tu banco usan otro formato? También.',
      body: 'Cada formato queda guardado como perfil para el próximo mes.',
      side: 'right',
    });
    await d.click(demo('sample-pos'), { duration: 1100 });
    await page.waitForSelector(demo('confirm-mapping'), { state: 'visible' });
    await d.wait(900);
    await d.highlight(page.getByText(/Encabezados detectados/i), 8);
    await d.wait(2400);
    await d.highlight(null);
    await d.hideCaption();
    await d.scrollTo(demo('back-upload'), { duration: 1500, block: 'center' });
    await d.click(demo('back-upload'), { duration: 900 });
    await page.waitForSelector(demo('sample-banco'), { state: 'visible' });
    await d.wait(700);
    await d.scrollTo(330, { duration: 900 });
    await d.click(demo('sample-banco'), { duration: 1000 });
    await page.waitForSelector(demo('confirm-mapping'), { state: 'visible' });
    await d.wait(900);
    await d.caption({
      kicker: 'Extracto bancario',
      title: 'Solo las entradas cuentan como ingreso',
      body: 'Los débitos se separan solos: pagos a proveedores, nómina y arriendo no inflan tus ventas.',
      side: 'right',
    });
    await d.highlight(page.getByText(/Perfil reconocido/i), 8);
    await d.wait(2200);
    await d.highlight(null);
    await d.scrollTo(demo('confirm-mapping'), { duration: 1500, block: 'center' });
    await d.click(demo('confirm-mapping'), { duration: 900 });
    await page.waitForSelector(demo('kpi-gross'), { state: 'visible', timeout: 15000 });
    await d.wait(2400);
    await d.hideCaption();
    await d.wait(400);
  },
};
