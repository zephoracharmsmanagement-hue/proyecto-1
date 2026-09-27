'use strict';
/* «Más vendidos» (netlify/functions/mas-vendidos.mjs, ENCARGO-FICHA-2 § 5).
 *
 * Reglas de verdad: se cuentan unidades de pedidos que salieron (no los que
 * esperan pago, ni los regalos); nunca se ofrece una pieza con menos de 3
 * libres; el ranking no inventa ventas.
 */
const path = require('path');
let fallos = 0;
const comprobar = (c, m, d) => { if (!c) fallos++; console.log((c ? '  ✓ ' : '  ✗ FALLA ') + m + (d ? ' — ' + d : '')); };
const copia = v => (v == null ? v : JSON.parse(JSON.stringify(v)));
function almacen() {
  const d = {};
  return {
    async get(k) { return d[k] ? copia(d[k]) : null; },
    async setJSON(k, v) { d[k] = copia(v); return { modified: true }; },
    async set(k, v) { d[k] = copia(v); },
    async delete(k) { delete d[k]; },
    async list(o = {}) { return { blobs: Object.keys(d).filter(k => !o.prefix || k.startsWith(o.prefix)).map(key => ({ key })) }; },
    async getWithMetadata(k) { return d[k] ? { data: copia(d[k]), etag: '1' } : null; },
    async setJSONIfMatch() { return { modified: true }; },
  };
}

async function main() {
  const stock = require(path.join(__dirname, '..', 'assets', 'stock.json')).items;
  const libres = it => it.tallas ? Object.values(it.tallas).reduce((a, b) => a + b, 0) : (it.stock || 0);
  const charms = Object.entries(stock).filter(([, it]) => !it.tallas);
  const conStock = charms.filter(([, it]) => libres(it) >= 3).map(([id]) => id);
  const escaso = charms.filter(([, it]) => libres(it) > 0 && libres(it) < 3).map(([id]) => id)[0];
  const pulsera = Object.entries(stock).filter(([, it]) => it.tallas && libres(it) >= 3).map(([id]) => id)[0];
  const [A, B, C] = conStock;

  const F = '../netlify/functions/';
  const ped = await import(F + '_pedidos.mjs');
  const inv = await import(F + '_inventario.mjs');
  ped._interno.usarAlmacen(almacen());
  inv._interno.usarAlmacen(almacen());
  const mod = await import(F + 'mas-vendidos.mjs');

  const alta = (ref, estado, lineas, pago) => ped.guardar(ref, { estado, pago, lineas });
  await alta('P1', 'pagado', [{ id: A, unidades: 2 }]);
  await alta('P2', 'venta-manual', [{ id: A, unidades: 1 }, { id: B, unidades: 1 }], 'nequi');
  await alta('P3', 'confirmado', [{ id: pulsera, talla: '18', unidades: 1 }]);
  await alta('P4', 'esperando-pago', [{ id: C, unidades: 5 }]);          // no salió
  await alta('P5', 'venta-manual', [{ id: C, unidades: 5 }], 'regalo');   // un regalo no es venta
  if (escaso) await alta('P6', 'confirmado', [{ id: escaso, unidades: 9 }]);

  console.log('1 · Ranking');
  const r = await mod.calcularRanking();
  const ids = r.vendidas.map(v => v.id);
  comprobar(r.vendidas[0] && r.vendidas[0].id === A && r.vendidas[0].unidades === 3, `cuenta unidades, no pedidos: ${A} = 3`, JSON.stringify(r.vendidas));
  comprobar(ids.includes(B) && ids.includes(pulsera), 'entran la venta manual y el brazalete');
  comprobar(!ids.includes(C), 'ni lo que espera pago ni un regalo cuentan como venta');
  if (escaso) comprobar(!ids.includes(escaso), `${escaso} vendió 9 pero tiene menos de 3 libres: no se ofrece`);
  comprobar(r.ventasRegistradas === (escaso ? 4 : 3), `ventas registradas: ${r.ventasRegistradas} (sin la que espera pago ni el regalo)`);
  comprobar(Object.values(r.disponibles).every(n => n >= 3) && (!escaso || !(escaso in r.disponibles)), 'la lista de disponibles solo trae piezas con 3 o más');

  console.log('2 · Respuesta');
  mod._interno.limpiar();
  const res = await mod.default(new Request('https://tienda.test/.netlify/functions/mas-vendidos'));
  const d = await res.json();
  comprobar(res.status === 200 && /max-age=600/.test(res.headers.get('cache-control')) && d.minimoLibres === 3 && d.tope === 12,
    '200, cacheada 10 minutos, con el mínimo y el tope declarados');
  comprobar(!JSON.stringify(d).includes('P1'), 'sin referencias de pedidos ni datos personales');

  console.log(fallos ? `\n${fallos} comprobaciones en rojo.` : '\nTodo en verde.');
  process.exit(fallos ? 1 : 0);
}
main().catch(e => { console.log('  ✗ FALLA la batería reventó — ' + (e.stack || e.message)); process.exit(1); });
