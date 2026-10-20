# Video demo MAREA — guion

**Formato:** 1920×1080, 30 fps, H.264 (MP4), unos 3 minutos, sin audio (listo para agregar música o locución).
**Público:** el cliente dueño del negocio. El mensaje no es técnico: la tienda **proyecta una imagen profesional**, **agiliza** la venta y **ordena las cuentas**.
**Estilo:** grabación real del sitio (nada simulado), con cursor visible, títulos de capítulo con la identidad de MAREA y subtítulos cortos en la esquina inferior izquierda.

| # | Escena | Duración | Qué se ve | Texto en pantalla |
|---|--------|----------|-----------|-------------------|
| 1 | Apertura | ~8 s | Cortina verde mar con el logo MAREA; se abre sobre el hero | «Una tienda que vende, convence y lleva las cuentas.» |
| 2 | Primera impresión | ~30 s | Hero animado, scroll por categorías, pestañas de destacados, historia de la tela, adelanto de pruebas, lookbook horizontal, reseñas | «Una imagen profesional desde el primer segundo» · «Cada sección entra con movimiento suave» · «Prueba social: reseñas y garantías a la vista» |
| 3 | Comprar sin fricción | ~22 s | Capítulo + colección: filtros que reacomodan las prendas, orden por precio | «Cada clic responde con una animación: el cliente nunca se pierde» |
| 4 | Ficha de producto | ~24 s | La foto «vuela» de la tarjeta a la ficha, cambio de color, guía de tallas, talla, agregar a la bolsa, carrito | «Del catálogo a la bolsa en tres clics» |
| 5 | Confianza | ~12 s | Página de pruebas: métricas y comparador antes/después arrastrado | «Mostramos la calidad, no solo la prometemos» |
| 6 | En el celular | ~12 s | Teléfono en pantalla con el sitio real: scroll y menú | «Pensado primero para el celular, donde compra tu cliente» |
| 7 | Contabilidad | ~60 s | Capítulo + subir el Excel de ventas → columnas detectadas solas → Causación → procesar → panel con KPIs, gráfico mensual, errores detectados (fila y motivo) → cambio a Caja → asientos contables que cuadran → exportar. Luego el cuadre de caja POS y el extracto bancario | «Sube el Excel que ya usas» · «Las columnas se reconocen solas» · «Detecta errores y duplicados antes que tu contador» · «Mismo archivo, otro método contable» · «Asientos en PUC listos para exportar» · «¿Tu POS o tu banco usan otro formato? También» |
| 8 | Cierre | ~12 s | Tres pilares: Imagen · Agilidad · Control, y tarjeta final («Vende mejor. Ordena tus cuentas con calma.») | «Imagen: una tienda cuidada y procesos claros» · «Agilidad: de Excel a informe en segundos» · «Control: cada peso con su asiento» |

## Notas de producción
- Todo se graba automáticamente con Chrome y un guion de Playwright (`video/record.mjs`): si el sitio cambia, el video se regenera con un comando.
- Cada escena se graba por separado y se une con fundidos cortos (`video/render.mjs`).
- Los datos de ventas son de ejemplo y las cuentas PUC son configurables: el contador del cliente debe validarlas.
