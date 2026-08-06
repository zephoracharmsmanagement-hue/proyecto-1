#!/usr/bin/env node
// Diagnóstico de un pixel: qué eventos llegan, cuántos, y qué falta.
//
//   node meta/pixel.mjs                 # usa META_PIXEL_ID del .env
//   node meta/pixel.mjs 2130673404542988
//
// Solo lectura.

import { api, titulo, tabla, fecha, num, correr } from './lib.mjs';

const pixelId = process.argv[2] || process.env.META_PIXEL_ID;
if (!pixelId) {
  console.error('\nFalta el pixel. Pásalo como argumento o pon META_PIXEL_ID en .env\n');
  process.exit(1);
}

// Los eventos que la página de Zephora dispara. Si uno no aparece en el
// reporte, es que ese punto del embudo no está llegando a Meta.
const ESPERADOS = [
  ['PageView', 'carga de página'],
  ['ViewContent', 've el catálogo'],
  ['AddToCart', 'agrega charm o brazalete'],
  ['InitiateCheckout', 'empieza a armar la pulsera'],
  ['Lead', 'manda el pedido por WhatsApp ← la conversión real'],
  ['Contact', 'clic a WhatsApp/Instagram'],
];

await correr(async () => {
  titulo('Pixel');
  const p = await api(`/${pixelId}`, {
    fields: 'id,name,last_fired_time,enable_automatic_matching,data_use_setting',
  });
  console.log(`  nombre           ${p.name || '—'}`);
  console.log(`  id               ${p.id}`);
  console.log(`  último evento    ${fecha(p.last_fired_time)}`);
  console.log(`  coincid. avanz.  ${p.enable_automatic_matching ? 'activadas' : 'desactivadas'}`);

  if (!p.last_fired_time) {
    console.log('\n  ⚠ Este pixel nunca ha recibido un evento.');
    console.log('    Causas típicas: el sitio no está publicado con este ID,');
    console.log('    o el ID del HTML no coincide con este.');
  }

  // Conteo por tipo de evento en los últimos 7 días.
  titulo('Eventos recibidos (7 días)');
  const desde = Math.floor(Date.now() / 1000) - 7 * 86400;

  let porEvento = {};
  try {
    const stats = await api(`/${pixelId}/stats`, {
      aggregation: 'event',
      start_time: desde,
    });
    for (const fila of stats.data || []) {
      for (const v of fila.value ? Object.entries(fila.value) : []) {
        porEvento[v[0]] = (porEvento[v[0]] || 0) + Number(v[1] || 0);
      }
    }
  } catch (e) {
    // /stats a veces no está disponible según permisos; no es fatal.
    console.log(`  (no se pudo leer el desglose: ${e.message})`);
  }

  tabla(ESPERADOS.map(([ev, desc]) => ({
    evento: ev,
    recibidos: porEvento[ev] != null ? num(porEvento[ev]) : '0',
    estado: porEvento[ev] ? '✓' : '✗ no llega',
    significa: desc,
  })));

  const inesperados = Object.keys(porEvento).filter(
    (e) => !ESPERADOS.some(([n]) => n === e)
  );
  if (inesperados.length) {
    console.log(`\n  Eventos extra no previstos: ${inesperados.join(', ')}`);
    console.log('  Si ves duplicados, revisa que el código base del pixel no esté pegado dos veces.');
  }

  // Lectura accionable en vez de solo volcar números.
  titulo('Lectura');
  if (!porEvento.PageView) {
    console.log('  El pixel no recibe ni PageView: el sitio publicado no lo tiene, o tiene otro ID.');
    console.log('  → Verifica con la extensión Meta Pixel Helper sobre zephoracharms.com');
  } else if (!porEvento.Lead) {
    console.log('  Llegan visitas pero ningún Lead: nadie completó un pedido, o el evento no dispara.');
    console.log('  → Haz un pedido de prueba y míralo en Administrador de Eventos → Probar eventos');
  } else {
    const tasa = ((porEvento.Lead / porEvento.PageView) * 100).toFixed(2);
    console.log(`  ${num(porEvento.PageView)} visitas → ${num(porEvento.Lead)} pedidos (${tasa}%)`);
    console.log('  Ya puedes optimizar campañas por Lead.');
  }
});
