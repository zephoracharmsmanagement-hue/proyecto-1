#!/usr/bin/env node
/* Deshace una venta ya confirmada, cuando la clienta cancela después.
 *
 *   node herramientas/anular-venta.mjs <referencia>              ← solo muestra qué haría
 *   node herramientas/anular-venta.mjs <referencia> --aplicar    ← lo aplica
 *
 * ── Qué cierra ──
 *
 * Un pedido contraentrega confirma el inventario al crearse, no al entregarse:
 * `crear-pago.mjs` lo trata como venta en firme desde el primer momento, para no
 * dejar una unidad cara caducando media hora en un pedido que ya es real. Eso es
 * correcto casi siempre — y deja un hueco justo cuando la clienta cancela
 * después: `liberar()` no sirve, porque solo borra una *reserva pendiente*, y a
 * esta altura la reserva ya no existe — `confirmar()` la borró al mover las
 * unidades a `vendido`. Sin esto, esas unidades quedan bloqueadas para siempre:
 * la tienda las tiene en la mano y las muestra agotadas.
 *
 * ── Por qué lee el pedido en vez de pedir las piezas a mano ──
 *
 * `_pedidos.mjs` ya guarda `lineas` —id, talla, unidades— por cada referencia:
 * es la misma fuente que usa la tienda para saber qué despachar. Reescribir eso
 * a mano en la terminal es la forma de que un día se teclee mal una unidad y el
 * inventario quede peor que si no se hubiera tocado.
 *
 * ── Por qué esto vive en una terminal y no en un endpoint ──
 *
 * Mismo motivo que ya vale para `armar-carrito.mjs`: no se expone un endpoint
 * nuevo en un sitio que cobra. Anular una venta es una decisión humana —alguien
 * decidió que el pedido no va—, no algo que deba poder disparar una petición
 * HTTP de quien sea.
 *
 * ── Credenciales ──
 *
 * Corre fuera de una función de Netlify, así que no hay `NETLIFY_BLOBS_CONTEXT`
 * que `getStore()` pueda leer solo. Hace falta dárselo a mano:
 *
 *   NETLIFY_AUTH_TOKEN   — Personal access token de tu cuenta. Se genera en
 *                          app.netlify.com → User settings → Applications →
 *                          Personal access tokens → New access token.
 *   NETLIFY_SITE_ID      — el ID del proyecto. Ya viene puesto en .env.example:
 *                          no es secreto, es el mismo que aparece en la URL del
 *                          panel (app.netlify.com/projects/<nombre>).
 *
 * Van en `.env`, igual que el resto de tokens de este repo. **Nunca en un
 * commit ni pegados en un chat.**
 *
 * ── Sin --aplicar no se toca nada ──
 *
 * Mismo criterio que `reponer.mjs`: esto decide qué puede vender la tienda, así
 * que por defecto solo enseña qué haría — el pedido, las piezas, cuánto quedaría
 * libre de cada una— y hay que pedir el escribir a propósito.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStore } from '@netlify/blobs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Mismo cargador de .env, sin dependencias, que ya usa meta/lib.mjs. Vive
   duplicado a propósito: herramientas/ y meta/ son autocontenidas por diseño,
   ninguna importa de la otra. */
function cargarEnv() {
  let texto;
  try {
    texto = readFileSync(join(RAIZ, '.env'), 'utf8');
  } catch {
    return;
  }
  for (const linea of texto.split('\n')) {
    const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (!m) continue;
    const valor = m[2].trim().replace(/^["']|["']$/g, '');
    if (valor && process.env[m[1]] === undefined) process.env[m[1]] = valor;
  }
}
cargarEnv();

function credenciales() {
  const token = process.env.NETLIFY_AUTH_TOKEN;
  const siteID = process.env.NETLIFY_SITE_ID;
  if (!token || !siteID) {
    console.error(
      '\nFaltan credenciales de Netlify.\n\n' +
      '  cp .env.example .env    y llena NETLIFY_AUTH_TOKEN y NETLIFY_SITE_ID\n\n' +
      'El token se genera en app.netlify.com → User settings → Applications →\n' +
      'Personal access tokens. El site ID ya viene puesto en .env.example.\n'
    );
    process.exit(1);
  }
  return { token, siteID };
}

/* Los nombres de los dos almacenes reales, tal como los usa la tienda en
   producción — `_inventario.mjs` y `_pedidos.mjs` los llaman distinto según
   `process.env.CONTEXT`, una variable que solo existe dentro de una función de
   Netlify. Aquí no hay contexto que detectar: este script solo tiene sentido
   contra el almacén real, nunca contra el de pruebas. */
function almacen(nombre, cred) {
  return getStore({ name: nombre, siteID: cred.siteID, token: cred.token, consistency: 'strong' });
}

/* Misma regla que `sku()` en _inventario.mjs, que no se exporta: un brazalete
   se cuenta por talla, un charm por pieza. */
const sku = (id, talla) => (talla ? `${id}|${talla}` : id);

async function main() {
  const referencia = process.argv[2];
  const aplicar = process.argv.includes('--aplicar');
  if (!referencia) {
    console.error(
      'Uso:\n' +
      '  node herramientas/anular-venta.mjs <referencia>\n' +
      '  node herramientas/anular-venta.mjs <referencia> --aplicar\n'
    );
    process.exit(1);
  }

  const cred = credenciales();
  const pedidos = almacen('pedidos', cred);

  const registro = await pedidos.get(referencia, { type: 'json' });
  if (!registro) {
    console.error(`No se encontró el pedido ${referencia} en el almacén de pedidos.`);
    console.error('Revisa que la referencia esté completa y bien escrita.');
    process.exit(1);
  }

  if (!Array.isArray(registro.lineas) || !registro.lineas.length) {
    console.error(`El pedido ${referencia} no trae "lineas" — no hay qué anular.`);
    process.exit(1);
  }

  const items = {};
  registro.lineas.forEach(l => {
    const s = sku(l.id, l.talla);
    items[s] = (items[s] || 0) + (l.unidades || 1);
  });

  console.log(`Pedido ${referencia} · estado actual: ${registro.estado || '(sin estado)'}`);
  console.log(registro.cliente ? `Cliente: ${registro.cliente.nombre || '(sin nombre)'}` : '');
  console.log('\nPiezas a devolver al inventario:');
  registro.lineas.forEach(l => {
    const t = l.talla ? ` talla ${l.talla} cm` : '';
    console.log(`  ${l.nombre}${t} × ${l.unidades}`);
  });

  if (registro.estado === 'cancelado') {
    console.log('\nEste pedido ya está marcado como cancelado en el registro.');
    console.log('Se puede seguir: anular() es idempotente y no resta dos veces si ya se aplicó.');
  }

  if (!aplicar) {
    console.log('\nNo se escribió nada. Repite con --aplicar para devolver estas unidades'
      + ' y marcar el pedido como cancelado.');
    return;
  }

  /* Se inyecta el almacén real de inventario en _inventario.mjs por la misma
     costura que usan las pruebas (`_interno.usarAlmacen`), documentada ahí
     mismo: "en producción es Netlify Blobs [...] que es lo único que hay que
     imitar para que el CAS sea real". Aquí no se imita nada — es el store real,
     con siteID y token de sobra para no depender del contexto de una función. */
  const { _interno, anular } = await import('../netlify/functions/_inventario.mjs');
  _interno.usarAlmacen(almacen('inventario', cred));

  const resultado = await anular(referencia, items);
  console.log(`\nanular() → ${resultado.modo}`);
  if (resultado.modo === 'anulada' || resultado.modo === 'ya-anulada') {
    if (resultado.restante) {
      console.log('Unidades libres ahora:');
      Object.entries(resultado.restante).forEach(([s, n]) => {
        console.log(`  ${s}: ${n === null ? '(sin conteo)' : n}`);
      });
    }
  } else {
    console.error('No se pudo confirmar la escritura — revisa el log de arriba antes de repetir.');
    process.exit(1);
  }

  await pedidos.setJSON(referencia, Object.assign({}, registro, {
    estado: 'cancelado',
    canceladoEn: new Date().toISOString(),
  }));
  console.log(`Pedido ${referencia} marcado como cancelado en el registro.`);
}

main().catch(e => {
  console.error('Error inesperado:', e.message);
  process.exit(1);
});
