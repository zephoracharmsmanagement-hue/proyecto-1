/* «Más vendidos», con ventas reales (ENCARGO-FICHA-2 § 5).
 *
 * Cuenta UNIDADES vendidas por pieza en los pedidos que de verdad salieron
 * —contraentrega confirmado, pago en línea aprobado o venta manual de
 * registrar-venta—; los regalos no son ventas. Y solo ofrece piezas con 3
 * unidades o más libres (conteo de stock.json menos lo apartado, como
 * disponibilidad.mjs): «más vendido» y «agotado» juntos no venden.
 *
 * Devuelve:
 *   ventasRegistradas  cuántos pedidos válidos hay en total
 *   vendidas           [{id, unidades}] con ventas y ≥3 libres, de más a
 *                      menos, hasta 12
 *   ranking            [id] de TODAS las piezas con ventas, de más a menos,
 *                      sin cifras ni filtro de existencias (orden de la
 *                      Colección Marvel)
 *   disponibles        {id: libres} de las piezas con ≥3, para que la página
 *                      complete con las de más stock de las colecciones que
 *                      más venden mientras haya pocas ventas (<30): con tan
 *                      pocas el ranking es ruido. Esas NO se llaman «más
 *                      vendido» (lo decide la página con los grupos de sus
 *                      tarjetas; _precios.js no expone grupos y no se toca).
 *
 * Público y sin datos personales. Se cachea 10 minutos.
 */
import { inventario as stock } from './_precios.js';
import { disponibles } from './_inventario.mjs';
import { listar } from './_pedidos.mjs';

const VALIDOS = new Set(['confirmado', 'pagado', 'venta-manual']);
const MINIMO_LIBRES = 3;
const TOPE = 12;
let cache = null;

export async function calcularRanking() {
  const items = (stock && stock.items) || {};
  const skus = [];
  Object.entries(items).forEach(([id, it]) => {
    if (it.tallas) Object.keys(it.tallas).forEach(t => skus.push(`${id}|${t}`));
    else skus.push(id);
  });
  const libres = await disponibles(skus);
  /* Sin Blobs no se sabe qué está apartado: se usa el conteo, que es lo que
     ya publica la página, en vez de no mostrar nada. */
  const libresDe = id => {
    const it = items[id];
    if (!it) return 0;
    if (it.tallas) return Object.keys(it.tallas).reduce((n, t) => n + (libres ? libres[`${id}|${t}`] || 0 : it.tallas[t] || 0), 0);
    return libres ? libres[id] || 0 : it.stock || 0;
  };
  const disp = {};
  Object.keys(items).forEach(id => { const n = libresDe(id); if (n >= MINIMO_LIBRES) disp[id] = n; });

  const pedidos = (await listar()) || [];
  const unidades = {};
  let ventasRegistradas = 0;
  for (const p of pedidos) {
    if (!p || !VALIDOS.has(p.estado) || p.pago === 'regalo') continue;
    ventasRegistradas++;
    for (const l of p.lineas || []) {
      if (!l || !l.id) continue;
      unidades[l.id] = (unidades[l.id] || 0) + (Number(l.unidades) > 0 ? Number(l.unidades) : 1);
    }
  }
  const vendidas = Object.entries(unidades)
    .filter(([id, n]) => n > 0 && disp[id])
    .sort((a, b) => b[1] - a[1] || (disp[b[0]] - disp[a[0]]))
    .slice(0, TOPE)
    .map(([id, n]) => ({ id, unidades: n }));
  /* Todas las piezas que vendieron, de más a menos, SIN las cifras y sin
     filtro de existencias: es para ordenar una colección (la de Marvel abre
     con lo más vendido), no para ponerle a nada el sello «Más vendido». Las
     cifras se quedan en las 12 de `vendidas`, como antes. */
  const ranking = Object.entries(unidades)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || (disp[b[0]] || 0) - (disp[a[0]] || 0) || (a[0] < b[0] ? -1 : 1))
    .map(([id]) => id);
  return { ventasRegistradas, vendidas, ranking, disponibles: disp, fuente: libres ? 'conteo-menos-apartado' : 'solo-conteo' };
}

export default async () => {
  try {
    if (!cache || Date.now() - cache.en > 10 * 60 * 1000) cache = { en: Date.now(), datos: await calcularRanking() };
  } catch (e) {
    console.error(JSON.stringify({ evento: 'mas_vendidos_error', error: String(e && e.message || e) }));
    return new Response(JSON.stringify({ error: 'No se pudo calcular' }), { status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  return new Response(JSON.stringify(Object.assign({ minimoLibres: MINIMO_LIBRES, tope: TOPE }, cache.datos)), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=600' },
  });
};

export const _interno = { limpiar() { cache = null; } };
