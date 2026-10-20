// Closing: the three business pillars, then the end card.
import { BASE } from '../lib/config.mjs';

export const closing = {
  name: 'closing',
  async prepare({ page, d }) {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await d.cursor(false);
  },
  async play({ d }) {
    await d.wait(600);
    await d.chapter({
      index: 'POR QUÉ IMPORTA',
      title: 'Más <em>profesional</em>, menos trabajo manual',
      pillars: [
        ['Imagen', 'Una tienda cuidada, con la calidad a la vista y procesos claros para el cliente.'],
        ['Agilidad', 'Del Excel que ya usas a un informe contable en segundos, sin reescribir datos.'],
        ['Control', 'Cada peso con su asiento. Errores y duplicados detectados a tiempo.'],
      ],
    });
    await d.wait(5200);
    await d.chapter({
      instant: true,
      title: 'Vende mejor.\nOrdena tus cuentas con <em>calma</em>.',
      subtitle: 'Tienda digital + contabilidad adaptable · Demo 2026',
      mark: true,
    });
    await d.wait(4200);
  },
};
