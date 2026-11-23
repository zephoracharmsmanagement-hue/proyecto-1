'use strict';
/* Varios brazaletes en un mismo pedido (2026-11-23).
 *
 * Hasta ese día el carrito guardaba un solo brazalete: elegir otra talla u otro
 * modelo reemplazaba al anterior, y quien quería dos tenía que cerrar la compra
 * por WhatsApp. Ahora el pedido lleva `bases`, una lista de {id, talla}.
 *
 * Lo que se vigila aquí es lo que duele si se rompe:
 *
 *   · Que nadie lea solo el primero. Cobrar, apartar o despachar un brazalete
 *     de menos no da ningún error: se descubre cuando la clienta reclama.
 *   · Que dos iguales quepan en una línea (`unidades: 2`): la hoja de inventario
 *     casa filas por referencia + id + talla y dos líneas iguales se pisarían.
 *   · Que no se puedan pedir más de los que hay de una talla. Con un solo
 *     brazalete bastaba mirar que la talla tuviera alguno.
 *   · Que lo de antes siga entrando: `base` (uno solo) lo mandan el formulario
 *     de ventas manuales, el bot y los carritos guardados en el navegador.
 *   · Que la página, el pago y el servidor den el mismo total y marquen gratis
 *     la misma pieza.
 */
const { chromium } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');

const RAIZ = path.join(__dirname, '..');
const BASE = process.env.URL || 'http://localhost:8899';
const P = require(path.join(RAIZ, 'netlify', 'functions', '_precios.js'));
const { leerPedido, calcular, detallar, piezasGratis, comprobarInventario, brazaletesDe, cop, PedidoInvalido, SinInventario } = P;
const CAT = require(path.join(RAIZ, 'assets', 'catalogo.json'));
const INV = require(path.join(RAIZ, 'assets', 'stock.json')).items;
const cargar = f => import(pathToFileURL(path.join(RAIZ, 'netlify', 'functions', f)).href);

let fallos = 0;
const comprobar = (c, m, d) => {
  if (!c) fallos++;
  console.log(`  ${c ? '✓' : '✗ FALLA'} ${m}${d !== undefined && d !== '' ? ' — ' + d : ''}`);
};
const lanza = (fn, Clase) => { try { fn(); return null; } catch (e) { return e instanceof Clase ? e : null; } };

/* Las piezas salen del inventario, no de ids escritos aquí (ver _pieza.js). */
function piezas() {
  const conTallas = CAT.pulseras.filter(id => INV[id] && INV[id].tallas);
  const unidades = (id, t) => +INV[id].tallas[t] || 0;
  /* DUO: un modelo con una talla de 2 o más unidades y otra talla con alguna. */
  let duo = null;
  for (const id of conTallas) {
    const ts = Object.keys(INV[id].tallas).filter(t => unidades(id, t) > 0);
    const doble = ts.find(t => unidades(id, t) >= 2), otra = ts.find(t => t !== doble);
    if (doble && otra) { duo = { id, talla: doble, otra, hay: unidades(id, doble) }; break; }
  }
  if (!duo) throw new Error('No hay en stock.json un brazalete con 2 unidades de una talla y otra talla disponible');
  const otroId = conTallas.find(id => id !== duo.id && Object.keys(INV[id].tallas).some(t => unidades(id, t) > 0));
  if (!otroId) throw new Error('No hay un segundo modelo de brazalete con unidades');
  const otro = { id: otroId, talla: Object.keys(INV[otroId].tallas).find(t => unidades(otroId, t) > 0) };
  const charms = Object.keys(CAT.precios).filter(id => !CAT.pulseras.includes(id) && !/^anillo-|^letra-/.test(id)
    && INV[id] && typeof INV[id].stock === 'number' && INV[id].stock >= 2).slice(0, 4);
  if (charms.length < 4) throw new Error('No hay 4 charms con 2 o más unidades');
  return { duo, otro, charms };
}

async function servidor({ duo, otro, charms }) {
  const A = { id: duo.id, talla: duo.talla }, B = { id: duo.id, talla: duo.otra }, C = { id: otro.id, talla: otro.talla };
  const precio = id => P.precioDe(id);

  console.log('\n1 · El pedido se lee como lista, y lo de antes sigue entrando');
  {
    const lista = leerPedido({ bases: [A, A, C], charms: charms.slice(0, 1) });
    comprobar(lista.bases.length === 3 && lista.base && lista.base.id === A.id && lista.base.talla === A.talla,
      '`bases` trae los tres, y `base` sigue siendo el primero', JSON.stringify(lista.bases));
    const viejo = leerPedido({ base: { id: A.id, talla: +A.talla }, charms: [] });
    comprobar(viejo.bases.length === 1 && viejo.bases[0].talla === A.talla && viejo.base.id === A.id,
      'un pedido con `base` (uno solo, la forma de antes) da una lista de uno, con la talla en texto');
    const ambos = leerPedido({ base: C, bases: [A, B], charms: [] });
    comprobar(ambos.bases.length === 2 && ambos.bases[0].talla === A.talla && ambos.base.talla === A.talla,
      'si llegan los dos campos manda `bases`');
    comprobar(brazaletesDe({ base: A, charms: [] }).length === 1 && brazaletesDe({ bases: [A, B], base: A }).length === 2
      && brazaletesDe({ charms: [] }).length === 0 && brazaletesDe(null).length === 0,
      'brazaletesDe() entiende las dos formas, y la falta de las dos');
    comprobar(!!lanza(() => leerPedido({ bases: [A, { id: charms[0], talla: '18' }], charms: [] }), PedidoInvalido),
      'un charm metido en `bases` se rechaza');
    comprobar(!!lanza(() => leerPedido({ bases: [A, { id: A.id, talla: '47' }], charms: [] }), PedidoInvalido),
      'una talla inventada en el segundo brazalete se rechaza');
    comprobar(!!lanza(() => leerPedido({ bases: [A, null], charms: [] }), PedidoInvalido), 'un hueco en la lista se rechaza');
    const tope = lanza(() => leerPedido({ bases: Array(11).fill(A), charms: [] }), PedidoInvalido);
    comprobar(!!tope && /Máximo 10 brazaletes/.test(tope.message), 'hay tope de brazaletes por pedido', tope && tope.message);
    comprobar(!!lanza(() => leerPedido({ bases: [], charms: [] }), PedidoInvalido), 'una lista vacía sin charms no es un pedido');
    /* Los dos campos en desacuerdo: nunca puede perderse el brazalete en silencio. */
    const vacia = leerPedido({ base: A, bases: [], charms: charms.slice(0, 1) });
    comprobar(vacia.bases.length === 1 && vacia.bases[0].id === A.id, '`bases: []` con el brazalete en `base` no lo pierde: cuenta como lista ausente');
    comprobar(!!lanza(() => leerPedido({ bases: A, charms: charms.slice(0, 1) }), PedidoInvalido), 'un `bases` que no es lista se rechaza en vez de ignorarse');
    comprobar(!!lanza(() => leerPedido({ charms: ['constructor'] }), PedidoInvalido) && !!lanza(() => leerPedido({ charms: ['toString'] }), PedidoInvalido),
      'una clave del prototipo («constructor») no pasa por charm (daba un total NaN)');
  }

  console.log('\n2 · El total cuenta cada brazalete, y lo gratis es lo de menor valor');
  {
    const pedido = leerPedido({ bases: [A, A, C], charms: charms.slice(0, 3), pago: 'anticipado' });
    const c = calcular(pedido);
    const todos = [precio(A.id), precio(A.id), precio(C.id)].concat(charms.slice(0, 3).map(precio)).sort((x, y) => x - y);
    const bruto = todos.reduce((s, x) => s + x, 0);
    comprobar(c.brutoBrazalete === precio(A.id) * 2 + precio(C.id), 'brutoBrazalete suma los tres', cop(c.brutoBrazalete));
    comprobar(c.descuento === todos[0] + todos[1] && c.subtotal === bruto - todos[0] - todos[1] && c.gratis.length === 2,
      `6 piezas: salen gratis las 2 de menor valor (${cop(todos[0])} + ${cop(todos[1])})`, cop(c.total));
    const uno = calcular(leerPedido({ base: A, charms: charms.slice(0, 3) }));
    const crudo = calcular({ base: A, charms: charms.slice(0, 3), pago: 'anticipado' });
    comprobar(uno.total === crudo.total && uno.gratis.length === 1,
      'un pedido de un solo brazalete da lo mismo por `base` que pasando por leerPedido()', cop(uno.total));
    /* Dos brazaletes son 2 piezas para la regla del envío en contraentrega. */
    const R = CAT.reglas, dos = calcular(leerPedido({ bases: [A, C], charms: [], pago: 'contraentrega' }));
    const espera = dos.subtotal >= R.envioGratisDesde
      && (!R.envioGratisSoloAnticipado || (R.contraentregaGratisDesde > 0 && 2 >= R.contraentregaGratisDesde));
    comprobar(dos.envioGratis === espera && (dos.envio === 0) === espera,
      'dos brazaletes cuentan como 2 piezas para el envío de la contraentrega', `envío ${cop(dos.envio)}`);
    /* Desempate entre brazaletes del mismo precio: sale gratis el primero que se eligió. */
    const g = piezasGratis(leerPedido({ bases: [B, A, B, A], charms: [] }));
    comprobar(g.length === 1 && g[0].brazalete === true && g[0].talla === B.talla,
      'de cuatro brazaletes del mismo precio sale gratis el primero que se eligió', g[0] && g[0].talla);
  }

  console.log('\n3 · Las líneas: una por modelo y talla, dos iguales en una sola');
  {
    const pedido = leerPedido({ bases: [A, B, A, C], charms: charms.slice(0, 2) });
    const ls = detallar(pedido), c = calcular(pedido);
    const lA = ls.filter(l => l.id === A.id && String(l.talla) === A.talla), lB = ls.filter(l => l.id === A.id && String(l.talla) === B.talla);
    comprobar(lA.length === 1 && lA[0].unidades === 2 && lA[0].precio === precio(A.id) * 2,
      'dos del mismo modelo y talla van en una línea con unidades 2 y el precio de las dos', JSON.stringify(lA[0]));
    comprobar(lB.length === 1 && lB[0].unidades === 1, 'la otra talla del mismo modelo es otra línea');
    const claves = ls.map(l => l.id + '|' + (l.talla || ''));
    comprobar(new Set(claves).size === claves.length, 'ninguna línea repite id + talla (la hoja de inventario casa por ahí)', claves.join(' '));
    const unidades = ls.reduce((s, l) => s + l.unidades, 0), gratis = ls.reduce((s, l) => s + l.gratis, 0);
    const cobrado = ls.reduce((s, l) => s + l.precio - l.gratis * (l.precio / l.unidades), 0);
    comprobar(unidades === 6 && gratis === c.gratis.length && Math.round(cobrado) === c.subtotal,
      'las líneas suman las 6 piezas, las gratis de calcular() y su subtotal', `${unidades} piezas, ${gratis} gratis, ${cop(cobrado)}`);
    comprobar(ls.every(l => l.gratis <= l.unidades), 'ninguna línea regala más unidades de las que tiene');
    const viejo = detallar({ base: A, charms: [], pago: 'anticipado' });
    comprobar(viejo.length === 1 && viejo[0].unidades === 1 && viejo[0].precio === precio(A.id) && viejo[0].talla === A.talla,
      'un pedido de antes (un `base`) da la misma línea de siempre', JSON.stringify(viejo[0]));
  }

  console.log('\n4 · No se venden más brazaletes de una talla de los que hay');
  {
    comprobar(!lanza(() => comprobarInventario(leerPedido({ bases: Array(duo.hay).fill(A), charms: [] })), SinInventario),
      `pedir los ${duo.hay} que hay de una talla pasa`);
    const e = lanza(() => comprobarInventario(leerPedido({ bases: Array(Math.min(10, duo.hay + 1)).fill(A), charms: [] })), SinInventario);
    comprobar(duo.hay >= 10 || (!!e && new RegExp(`pediste ${duo.hay + 1} y queda`).test(e.message)),
      'pedir uno más de los que hay se rechaza diciendo cuántos quedan', e && e.message.slice(55, 150));
    const sinTalla = lanza(() => comprobarInventario(leerPedido({ bases: [A, { id: otro.id, talla: null }], charms: [] })), SinInventario);
    comprobar(!!sinTalla && /falta elegir la talla/.test(sinTalla.message), 'un segundo brazalete sin talla se devuelve pidiéndola');
    const agotada = ['17', '18', '19', '20', '21'].find(t => !(+INV[duo.id].tallas[t] > 0));
    if (agotada) {
      const a = lanza(() => comprobarInventario(leerPedido({ bases: [A, { id: duo.id, talla: agotada }], charms: [] })), SinInventario);
      comprobar(!!a && /se agotó/.test(a.message) && /quedan/.test(a.message), 'una talla agotada en el segundo brazalete se rechaza como siempre');
    }
    const inv = (await cargar('_inventario.mjs'))._interno;
    const piden = inv.itemsDe(leerPedido({ bases: [A, A, B, C], charms: charms.slice(0, 1) }));
    comprobar(piden[`${A.id}|${A.talla}`] === 2 && piden[`${A.id}|${B.talla}`] === 1 && piden[`${C.id}|${C.talla}`] === 1 && piden[charms[0]] === 1,
      'la reserva aparta cada talla por separado, y dos de la misma', JSON.stringify(piden));
    const viejo = inv.itemsDe({ base: A, charms: [] });
    comprobar(viejo[`${A.id}|${A.talla}`] === 1 && Object.keys(viejo).length === 1, 'y un pedido de antes aparta su brazalete como siempre');
  }

  console.log('\n5 · Enlaces, recuperación y medición');
  {
    const { comoUrl } = await cargar('_carrito.mjs');
    const p = comoUrl({ bases: [A, A, C], charms: [charms[0], charms[0]], pago: 'anticipado' }).get('p');
    comprobar(p === `${A.id}@${A.talla},${A.id}@${A.talla},${C.id}@${C.talla},${charms[0]}*2`,
      'el enlace escribe un trozo por brazalete; dos iguales, dos trozos', p);
    comprobar(comoUrl({ base: A, charms: [], pago: 'anticipado' }).get('p') === `${A.id}@${A.talla}`, 'y un carrito de antes sale igual que antes');
    const re = (await cargar('reanudar.mjs'))._interno;
    const lineas = detallar(leerPedido({ bases: [A, A, C], charms: charms.slice(0, 1) }));
    const car = re.carritoDe({ lineas, pago: 'anticipado' });
    comprobar(car.bases.length === 3 && car.bases.filter(b => b.id === A.id && b.talla === A.talla).length === 2 && car.base.id === A.id,
      'reanudar reconstruye los tres brazaletes desde las líneas guardadas (antes se quedaba con el primero)', JSON.stringify(car.bases));
    const libres = { [`${A.id}|${A.talla}`]: 1, [`${C.id}|${C.talla}`]: 5, [charms[0]]: 5 };
    const rec = re.recortar(car, libres);
    comprobar(rec.cambio && rec.carrito.bases.length === 2 && rec.carrito.bases.filter(b => b.id === A.id).length === 1,
      'si de dos iguales solo queda uno, el carrito recuperado trae uno y avisa del cambio', JSON.stringify(rec.carrito.bases));
    const igual = re.recortar(car, { [`${A.id}|${A.talla}`]: 2, [`${C.id}|${C.talla}`]: 1, [charms[0]]: 1 });
    comprobar(!igual.cambio && igual.carrito.bases.length === 3, 'y si alcanza para todo, no toca nada');
    const { contenidosDe } = (await cargar('crear-pago.mjs'))._interno;
    const cont = contenidosDe(leerPedido({ bases: [A, B, C], charms: charms.slice(0, 1) }));
    comprobar(cont.find(x => x.id === A.id).quantity === 2 && cont.find(x => x.id === C.id).quantity === 1,
      'Meta recibe cada modelo con su cantidad (la talla no cuenta como producto aparte)', JSON.stringify(cont));
  }
}

async function navegador({ duo, otro, charms }) {
  const A = { id: duo.id, talla: duo.talla }, B = { id: duo.id, talla: duo.otra }, C = { id: otro.id, talla: otro.talla };
  const b = await chromium.launch();
  const nueva = async () => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    /* Sin fotos ni medición: aquí se mira qué carrito queda, no cómo se ve. */
    await ctx.route(/\.(webp|jpg|jpeg|png|mp4|woff2?)(\?|$)|facebook|clarity|google/, r => r.abort());
    const p = await ctx.newPage();
    p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    return p;
  };
  const guardado = p => p.evaluate(() => JSON.parse(localStorage.getItem('zephora.carrito.v1') || 'null'));
  const sembrar = (p, c) => p.evaluate(x => localStorage.setItem('zephora.carrito.v1',
    JSON.stringify(Object.assign({ v: 1, cuando: Date.now(), empaque: false, pago: 'anticipado' }, x))), c);
  const talla = (p, x) => p.evaluate(([id, t]) => {
    const c = document.querySelector('.pc[data-id="' + id + '"]');
    c.querySelector('.tbtn[data-talla="' + t + '"]').click(); }, [x.id, x.talla]);
  const hoja = p => p.evaluate(() => ({
    filas: [...document.querySelectorAll('#sheet-body .srow')].map(r => ({ tx: r.querySelector('.srow-n').textContent, gratis: r.classList.contains('srow--gratis'),
      precio: +(r.querySelector('.srow-p s') || r.querySelector('.srow-p')).textContent.replace(/\D/g, '') })),
    total: document.getElementById('v-tot').textContent.trim(), barra: document.getElementById('dock-n').textContent,
    resumen: document.getElementById('l-b').textContent,
    mas: document.querySelectorAll('#sheet-body .srow-mas').length }));

  console.log('\n6 · En la tienda: cada talla es un interruptor y ya no reemplaza');
  {
    const p = await nueva();
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await talla(p, A); await p.waitForTimeout(150);
    await talla(p, B); await p.waitForTimeout(150);
    let g = await guardado(p);
    comprobar(g.bases.length === 2 && g.bases[0].talla === A.talla && g.bases[1].talla === B.talla && g.base.talla === A.talla,
      'elegir otra talla del mismo modelo agrega un segundo brazalete (antes reemplazaba)', JSON.stringify(g.bases));
    await talla(p, C); await p.waitForTimeout(150);
    g = await guardado(p);
    comprobar(g.bases.length === 3 && g.bases[2].id === C.id, 'y otro modelo, un tercero');
    const boton = await p.evaluate(id => document.querySelector('.pc[data-id="' + id + '"] .pc-add').textContent, A.id);
    const marcadas = await p.evaluate(id => [...document.querySelectorAll('.pc[data-id="' + id + '"] .tbtn.is-on')].map(x => x.dataset.talla), A.id);
    comprobar(boton.includes(A.talla) && boton.includes(B.talla) && marcadas.length === 2,
      'la tarjeta dice las dos tallas elegidas y las deja marcadas', boton);
    await talla(p, B); await p.waitForTimeout(150);
    g = await guardado(p);
    comprobar(g.bases.length === 2 && !g.bases.some(x => x.id === A.id && x.talla === B.talla),
      'volver a tocar una talla marcada quita ese brazalete y deja los demás');
    await p.evaluate(() => document.getElementById('dock-open').click()); await p.waitForTimeout(400);
    let h = await hoja(p);
    const t2 = calcular(leerPedido({ bases: [A, C], charms: [] }));
    comprobar(h.filas.length === 2 && h.total === cop(t2.total) && /^Tienes 2 piezas/.test(h.barra) && h.resumen === '2 brazaletes',
      'el carrito muestra los dos, con el total de calcular()', `${h.total} · ${h.barra}`);
    comprobar(h.mas >= 1, 'y ofrece «+ Llevar otro igual» donde quedan unidades');
    await p.evaluate(id => { const f = [...document.querySelectorAll('#sheet-body .srow')].find(r => r.querySelector('.srow-mas') && r.querySelector('img,.srow-nof')); f.querySelector('.srow-mas').click(); }, A.id);
    await p.waitForTimeout(300);
    g = await guardado(p); h = await hoja(p);
    const doble = g.bases.filter(x => x.id === g.bases[0].id && x.talla === g.bases[0].talla).length;
    const t3 = calcular(leerPedido({ bases: g.bases, charms: [] }));
    comprobar(g.bases.length === 3 && h.filas.length === 3 && h.total === cop(t3.total),
      '«+ Llevar otro igual» suma una unidad de esa misma talla', JSON.stringify(g.bases));
    comprobar(doble === 2 || g.bases.filter(x => x.id === C.id).length === 2, 'y queda dos veces en el pedido');
    /* La ✕ quita uno solo. */
    await p.evaluate(() => document.querySelector('#sheet-body .srow .srow-x').click()); await p.waitForTimeout(300);
    g = await guardado(p);
    comprobar(g.bases.length === 2, 'la ✕ de un renglón quita un brazalete, no todos');
    comprobar(!p.errs.length, 'consola limpia', p.errs.join(' | ') || undefined);
    await p.context().close();
  }

  console.log('\n7 · Promo, tope de inventario y carritos de antes');
  {
    const p = await nueva();
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await sembrar(p, { base: A, bases: [A, A, C], charms: charms.slice(0, 3) });
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await p.evaluate(() => document.getElementById('dock-open').click()); await p.waitForTimeout(400);
    const h = await hoja(p);
    const pedido = leerPedido({ bases: [A, A, C], charms: charms.slice(0, 3) }), c = calcular(pedido);
    const tachado = h.filas.filter(f => f.gratis).reduce((s, f) => s + f.precio, 0);
    comprobar(h.total === cop(c.total) && tachado === c.descuento && h.filas.filter(f => f.gratis).length >= 1,
      `6 piezas con 3 brazaletes: mismo total y mismo descuento que el servidor (${cop(c.total)}, −${cop(c.descuento)})`, `${h.total}, tachado ${cop(tachado)}`);
    /* Gratis el mismo renglón que dice el servidor: por modelo y talla, no solo por suma. */
    const corto = tx => tx.replace(/(Brazalete|Charm|Anillo) ·.*$/, '');
    const delServidor = detallar(pedido).filter(l => l.gratis > 0)
      .map(l => l.nombre.replace(/^Brazalete /, '') + (l.talla ? '|' + l.talla : '') + '×' + l.gratis).sort().join(' · ');
    const cuenta = {};
    h.filas.filter(f => f.gratis).forEach(f => {
      const t = (/Talla (\d+)/.exec(f.tx) || [])[1], n = corto(f.tx).replace(/ ×\d+$/, '').trim();
      const k = n + (t ? '|' + t : '');
      cuenta[k] = (cuenta[k] || 0) + (+((/×(\d+)$/.exec(corto(f.tx).trim()) || [0, 1])[1]));
    });
    const dePagina = Object.keys(cuenta).map(k => k + '×' + cuenta[k]).sort().join(' · ');
    comprobar(delServidor === dePagina, 'los renglones marcados GRATIS son los mismos que marca el servidor, con su talla', `${dePagina}  /  ${delServidor}`);
    /* Más de los que hay: al llegar el inventario se recorta a lo que existe. */
    await sembrar(p, { base: A, bases: Array(duo.hay + 2).fill(A), charms: [] });
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1800);
    await p.evaluate(() => document.getElementById('dock-open').click()); await p.waitForTimeout(300);
    const recortado = await hoja(p);
    comprobar(recortado.filas.length === duo.hay && recortado.mas === 0,
      `un carrito con ${duo.hay + 2} de una talla que tiene ${duo.hay} se queda en ${duo.hay}, sin ofrecer otro`, `${recortado.filas.length} renglones`);
    /* Un carrito guardado antes del cambio: solo `base`. */
    await sembrar(p, { base: C, charms: charms.slice(0, 1) });
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await p.evaluate(() => document.querySelector('[data-add]:not([aria-disabled="true"])').click()); await p.waitForTimeout(300);
    const viejo = await guardado(p);
    comprobar(Array.isArray(viejo.bases) && viejo.bases.length === 1 && viejo.bases[0].id === C.id && viejo.base.id === C.id,
      'un carrito de antes (solo `base`) conserva su brazalete y se vuelve a guardar en la forma nueva', JSON.stringify(viejo.bases));
    comprobar(!p.errs.length, 'consola limpia', p.errs.join(' | ') || undefined);
    await p.context().close();
  }

  console.log('\n7b · Un brazalete que no se puede comprar como está se arregla, no se duplica');
  {
    /* Lo que antes resolvía el «tocar otra talla reemplaza»: un brazalete sin
       talla (enlace viejo, o elegido antes de que cargara el inventario) o con
       una talla que se agotó. Tocar una talla con unidades lo corrige. */
    const p = await nueva();
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await sembrar(p, { base: { id: A.id, talla: null }, bases: [{ id: A.id, talla: null }], charms: [] });
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await talla(p, A); await p.waitForTimeout(200);
    let g = await guardado(p);
    comprobar(g.bases.length === 1 && g.bases[0].talla === A.talla, 'a un brazalete sin talla, tocar una talla se la pone (no agrega otro)', JSON.stringify(g.bases));
    const agotada = ['17', '18', '19', '20', '21'].find(t => !(+INV[A.id].tallas[t] > 0));
    if (agotada) {
      await sembrar(p, { base: { id: A.id, talla: agotada }, bases: [{ id: A.id, talla: agotada }], charms: [] });
      await p.goto(BASE + '/index.html', { waitUntil: 'load' });
      await p.waitForTimeout(1500);
      await talla(p, A); await p.waitForTimeout(200);
      g = await guardado(p);
      comprobar(g.bases.length === 1 && g.bases[0].talla === A.talla, `con la talla ${agotada} agotada en el carrito, tocar otra la cambia (no agrega otro)`, JSON.stringify(g.bases));
      await sembrar(p, { base: { id: A.id, talla: agotada }, bases: [{ id: A.id, talla: agotada }], charms: charms.slice(0, 1) });
      await p.goto(BASE + '/index.html', { waitUntil: 'load' });
      await p.waitForTimeout(1500);
      await talla(p, { id: A.id, talla: agotada }); await p.waitForTimeout(200);
      g = await guardado(p);
      comprobar(g.bases.length === 0 && g.charms.length === 1, 'y la talla agotada se puede desmarcar aunque su botón esté apagado', JSON.stringify(g.bases));
    } else comprobar(true, 'no hay talla agotada de ese modelo para probar el cambio');
    /* «Elegido ✓» abre las tallas; ya no quita el brazalete. */
    await sembrar(p, { base: A, bases: [A], charms: [] });
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await p.evaluate(id => document.querySelector('.pc[data-id="' + id + '"] [data-base]').click(), A.id); await p.waitForTimeout(200);
    g = await guardado(p);
    const panel = await p.evaluate(id => !document.querySelector('.pc[data-id="' + id + '"] .tallas').hidden, A.id);
    comprobar(g.bases.length === 1 && panel, 'tocar «Elegido ✓» abre las tallas y deja el brazalete en el pedido');
    comprobar(!p.errs.length, 'consola limpia', p.errs.join(' | ') || undefined);
    await p.context().close();
  }

  console.log('\n8 · El enlace y la página de pago entienden lo mismo');
  {
    const q = `?p=${A.id}@${A.talla},${A.id}@${A.talla},${C.id}@${C.talla},${charms[0]}`;
    const pedido = leerPedido({ bases: [A, A, C], charms: [charms[0]] }), c = calcular(pedido);
    for (const pag of ['index.html', 'checkout.html']) {
      const p = await nueva();
      await p.goto(BASE + '/' + pag + q, { waitUntil: 'load' });
      await p.waitForTimeout(1500);
      const g = await guardado(p);
      comprobar(g && Array.isArray(g.bases) && g.bases.length === 3 && g.bases.filter(x => x.id === A.id && x.talla === A.talla).length === 2
        && g.charms.length === 1, `${pag}: el enlace con dos brazaletes iguales y otro distinto trae los tres`, g && JSON.stringify(g.bases));
      if (pag === 'checkout.html') {
        const r = await p.evaluate(() => ({ total: document.getElementById('res-total').textContent.trim(),
          lineas: [...document.querySelectorAll('#res-lineas .rl, #res-lineas li, #res-lineas > *')].map(x => x.textContent.replace(/\s+/g, ' ')).join(' | ') }));
        comprobar(r.total === cop(c.total), `checkout.html cobra en pantalla lo mismo que el servidor (${cop(c.total)})`, r.total);
        comprobar(/×2/.test(r.lineas) || (r.lineas.match(new RegExp(CAT.nombres[A.id].replace(/^Pulsera /, ''), 'g')) || []).length >= 2,
          'y su resumen dice que ese brazalete va dos veces', r.lineas.slice(0, 160));
      }
      comprobar(!p.errs.length, `${pag}: consola limpia`, p.errs.join(' | ') || undefined);
      await p.context().close();
    }
  }
  await b.close();
}

(async () => {
  const x = piezas();
  console.log(`Varios brazaletes por pedido — ${x.duo.id} t${x.duo.talla} (${x.duo.hay} u.) y t${x.duo.otra}, ${x.otro.id} t${x.otro.talla}`);
  await servidor(x);
  await navegador(x);
  console.log(fallos ? `\n✗ ${fallos} comprobación(es) en rojo` : '\nVarios brazaletes en verde ✓');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
