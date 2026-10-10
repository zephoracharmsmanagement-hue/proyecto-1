'use strict';
/* ajustar-inventario.mjs — faltantes, dañadas, errores de conteo y bloqueos
 * temporales, separados de las ventas.
 *
 * Lo que hay que demostrar: descuenta en el MISMO contador que la tienda, pero
 * no es una venta en ninguna parte — ni Purchase a Meta, ni fila en la hoja, ni
 * en las cuentas de «más vendidos» / «N personas compraron». Y se revierte.
 *
 * Todo con almacenes en memoria: las vistas previas comparten el inventario
 * vivo, así que una prueba contra el servidor descontaría unidades de verdad.
 * Las piezas se eligen de stock.json, nunca escritas a mano.
 */
const path = require('path');
const RAIZ = path.join(__dirname, '..');

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));
const copia = v => JSON.parse(JSON.stringify(v));

function almacenInventario() {
  let g = null, n = 0;
  return {
    async getWithMetadata() { return g ? { data: copia(g.valor), etag: g.etag, metadata: {} } : null; },
    async get() { return g ? copia(g.valor) : null; },
    async setJSON(_k, valor, o = {}) {
      if (o.onlyIfNew && g) return { modified: false };
      if (o.onlyIfMatch && (!g || g.etag !== o.onlyIfMatch)) return { modified: false };
      g = { valor: copia(valor), etag: 'e' + (++n) };
      return { modified: true };
    },
  };
}
function almacenPedidos() {
  const d = {};
  return {
    async get(k) { return d[k] ? copia(d[k]) : null; },
    async setJSON(k, v) { d[k] = copia(v); return { modified: true }; },
    async delete(k) { delete d[k]; },
    async list() { return { blobs: Object.keys(d).map(key => ({ key })) }; },
  };
}

async function main() {
  const CLAVE = 'clave-de-prueba-ajustar-inventar';
  process.env.VENTA_MANUAL_KEY = CLAVE;
  /* Webhook de la hoja con una URL centinela: si el ajuste llegara a la hoja,
     aparecería en las salidas grabadas. */
  const HOJA = 'https://hoja.centinela.invalid/webhook';
  process.env.HOJA_WEBHOOK = HOJA;
  process.env.META_CAPI_TOKEN = 'token-de-prueba';

  const inv = await import('../netlify/functions/_inventario.mjs');
  const ped = await import('../netlify/functions/_pedidos.mjs');
  inv._interno.usarAlmacen(almacenInventario());
  ped._interno.usarAlmacen(almacenPedidos());
  const mod = await import('../netlify/functions/ajustar-inventario.mjs');
  const { contar } = await import('../netlify/functions/vendidas.mjs');

  const stock = require(path.join(RAIZ, 'assets', 'stock.json')).items;
  const charm = Object.keys(stock).find(i => stock[i].tipo === 'charm' && stock[i].stock >= 5);
  const otro = Object.keys(stock).find(i => i !== charm && stock[i].tipo === 'charm' && stock[i].stock >= 3);
  const agotado = Object.keys(stock).find(i => stock[i].tipo === 'charm' && stock[i].stock === 0);
  const braz = Object.keys(stock).find(i => stock[i].tallas && Object.values(stock[i].tallas).some(n => n > 0));
  const talla = Object.keys(stock[braz].tallas).find(t => stock[braz].tallas[t] > 0);

  /* fetch grabado: cualquier salida hacia Meta o hacia la hoja. */
  const salidas = [];
  global.fetch = async (url, op) => {
    salidas.push({ url: String(url), cuerpo: op && op.body ? String(op.body) : '' });
    return new Response('{}', { status: 200 });
  };

  const pedir = async (cuerpo, { clave = CLAVE, metodo = 'POST' } = {}) => {
    const headers = new Headers({ 'x-forwarded-for': '181.1.2.3' });
    if (clave !== null) headers.set('x-zephora-automation-key', clave);
    const r = await mod.default({ method: metodo, headers, text: async () => JSON.stringify(cuerpo) });
    return { r, d: JSON.parse(await r.text()) };
  };
  const libres = async s => (await inv.disponibles([s]))[s];

  console.log(`\n1 · Clave (pieza de prueba: ${charm})`);
  {
    const antes = await libres(charm);
    const sin = await pedir({ motivo: 'faltante', charms: [charm] }, { clave: null });
    const mala = await pedir({ motivo: 'faltante', charms: [charm] }, { clave: 'otra-clave-de-prueba-ajustar-inv' });
    comprobar(sin.r.status === 401 && mala.r.status === 401, 'sin clave o con clave errada → 401', `${sin.r.status}/${mala.r.status}`);
    comprobar(await libres(charm) === antes, 'y el contador no se toca');
    comprobar((await pedir({}, { metodo: 'GET' })).r.status === 405, 'GET → 405');
  }

  console.log('\n2 · Motivo');
  {
    const antes = await libres(charm);
    const malo = await pedir({ motivo: 'robo', charms: [charm] });
    const vacio = await pedir({ charms: [charm] });
    comprobar(malo.r.status === 400 && vacio.r.status === 400, 'motivo desconocido o ausente → 400');
    comprobar(await libres(charm) === antes, 'y no descuenta nada');
    /* El formulario manda la etiqueta que ve la persona, con tildes y espacios. */
    const formas = ['Faltante', 'Dañada', 'Error de conteo', 'bloqueo_temporal'];
    const canonicas = [];
    for (const m of formas) {
      const { r, d } = await pedir({ motivo: m, charms: [charm] });
      if (r.status === 200) canonicas.push(d.motivo);
    }
    comprobar(canonicas.join(',') === 'faltante,danada,error-de-conteo,bloqueo-temporal',
      'acepta la etiqueta tal cual y la guarda en forma canónica', canonicas.join(','));
    comprobar(await libres(charm) === antes - formas.length, `cada una descontó 1 (${antes} → ${await libres(charm)})`);
  }

  console.log('\n3 · Descuenta igual que una venta, pero no es una venta');
  let refAjuste;
  {
    salidas.length = 0;
    const antes = await libres(charm);
    const antesB = await libres(`${braz}|${talla}`);
    const { r, d } = await pedir({ motivo: 'bloqueo temporal', charms: [charm], base: { id: braz, talla },
      nota: 'faltante en estante, se está buscando' });
    refAjuste = d.referencia;
    comprobar(r.status === 200 && /^AJ-\d{6}-[0-9A-F]{8}$/.test(d.referencia), '200 con referencia AJ- (no MAN-)', d.referencia);
    comprobar(await libres(charm) === antes - 1, `el charm baja 1 en el mismo contador que usa la tienda (${antes} → ${await libres(charm)})`);
    comprobar(await libres(`${braz}|${talla}`) === antesB - 1, `el brazalete talla ${talla} baja 1`);
    comprobar(d.restante && d.restante[charm] === antes - 1, 'devuelve lo que queda, del propio CAS', JSON.stringify(d.restante));
    comprobar(!('meta' in d), 'la respuesta ni siquiera habla de Meta');

    const reg = await ped.leer(d.referencia);
    comprobar(reg && reg.estado === 'ajuste' && reg.motivo === 'bloqueo-temporal' && /estante/.test(reg.nota),
      'queda registrado como ajuste, con su motivo y su nota');
    comprobar(reg && !('total' in reg) && !('pago' in reg) && !('cliente' in reg),
      'sin total, medio de pago ni clienta: no es una venta');

    comprobar(!salidas.some(s => /facebook|graph\./.test(s.url)), 'no manda Purchase a Meta',
      salidas.map(s => s.url).join(' ') || 'ninguna salida');
    comprobar(!salidas.some(s => s.url === HOJA), 'no escribe en la hoja de inventario');
  }

  console.log('\n4 · No aparece en las cuentas de ventas');
  {
    /* Tres ajustes de la misma pieza: el mínimo para que «vendidas» la muestre. */
    for (let i = 0; i < 3; i++) await pedir({ motivo: 'dañada', charms: [otro] });
    /* Control positivo: tres ventas manuales de otra pieza, escritas directo en
       el registro. Si «vendidas» no las ve, la prueba no está midiendo nada. */
    const control = Object.keys(stock).find(i => i !== charm && i !== otro && stock[i].tipo === 'charm');
    for (let i = 0; i < 3; i++) {
      await ped.guardar(`MAN-PRUEBA-${i}`, { estado: 'venta-manual', pago: 'nequi', total: 1,
        lineas: [{ id: control, unidades: 1 }] });
    }
    const ventas = await contar();
    comprobar(ventas[control] === 3, `el control sí cuenta: 3 ventas manuales de ${control} aparecen`, JSON.stringify(ventas));
    comprobar(!(otro in ventas), `3 ajustes de ${otro} no aparecen como vendidas`);
  }

  console.log('\n5 · Sin unidades que quitar');
  if (agotado) {
    /* Una pieza que ninguna prueba anterior tocó: si fuera una ya vaciada,
       «no descuenta nada del resto» pasaría solo, porque no se baja de 0. */
    const usadas = new Set([charm, otro, agotado]);
    const fresco = Object.keys(stock).find(i => !usadas.has(i) && !/^letra-b$/.test(i)
      && stock[i].tipo === 'charm' && stock[i].stock >= 2);
    const antesF = await libres(fresco);
    const { r, d } = await pedir({ motivo: 'faltante', charms: [agotado, fresco] });
    comprobar(r.status === 409 && /Sin unidades/.test(d.error), `pieza ya en 0 (${agotado}) → 409`, d.error);
    comprobar(antesF > 0 && await libres(fresco) === antesF,
      `y no descuenta la otra pieza del pedido, que sí tenía unidades (${fresco}: ${antesF})`);
  } else ok('no hay piezas agotadas en stock.json para probar el 409');
  {
    const { r } = await pedir({ motivo: 'faltante', charms: ['no-existe'] });
    comprobar(r.status === 400, 'pieza desconocida → 400');
    const s = await pedir({ motivo: 'faltante', base: { id: braz } });
    comprobar(s.r.status === 400 && /talla/.test(s.d.error), 'brazalete sin talla → 400');
  }

  console.log('\n6 · Revertir');
  {
    const antes = await libres(charm);
    const antesB = await libres(`${braz}|${talla}`);
    const { r } = await pedir({ anular: refAjuste });
    comprobar(r.status === 200 && await libres(charm) === antes + 1, 'revertir devuelve la unidad', `${antes} → ${await libres(charm)}`);
    comprobar(await libres(`${braz}|${talla}`) === antesB + 1, 'también la del brazalete');
    const reg = await ped.leer(refAjuste);
    comprobar(reg && reg.estado === 'ajuste-revertido' && reg.revertidoEn, 'queda marcado como revertido, con fecha');

    const fecha = reg.revertidoEn;
    const otra = await pedir({ anular: refAjuste });
    comprobar(otra.r.status === 200 && otra.d.modo === 'ya-anulada' && await libres(charm) === antes + 1,
      'revertir dos veces no devuelve dos veces', otra.d.modo);
    comprobar((await ped.leer(refAjuste)).revertidoEn === fecha, 'y no mueve la fecha de la primera reversión');

    const venta = await pedir({ anular: 'MAN-260101-AAAAAAAA' });
    comprobar(venta.r.status === 400, 'no revierte ventas manuales (MAN-): esas van a registrar-venta');
    const nada = await pedir({ anular: 'AJ-260101-FFFFFFFF' });
    comprobar(nada.r.status === 404, 'un AJ- que no existe → 404');
  }

  console.log('\n7 · Sobrante: suma unidades sin tocar stock.json');
  {
    salidas.length = 0;
    const antes = await libres(charm);
    const { r, d } = await pedir({ motivo: 'Sobrante', charms: [charm], nota: 'conteo 10-oct' });
    comprobar(r.status === 200 && d.motivo === 'sobrante' && d.signo === 1 && /^AJ-/.test(d.referencia),
      '«Sobrante» → 200, motivo sobrante, signo +1', JSON.stringify({ m: d.motivo, s: d.signo }));
    comprobar(await libres(charm) === antes + 1, `suma 1 al contador de la tienda (${antes} → ${await libres(charm)})`);
    comprobar(d.restante && d.restante[charm] === antes + 1, 'devuelve lo que queda, del propio CAS');
    comprobar(!salidas.some(s => /facebook|graph\./.test(s.url)) && !salidas.some(s => s.url === HOJA),
      'ni Meta ni la hoja');
    const reg = await ped.leer(d.referencia);
    comprobar(reg && reg.estado === 'ajuste' && reg.signo === 1, 'queda como ajuste con signo +1');
    const ventas = await contar();
    comprobar(!(charm in ventas) || ventas[charm] === undefined, 'no aparece en «vendidas»');

    const rv = await pedir({ anular: d.referencia });
    comprobar(rv.r.status === 200 && await libres(charm) === antes, 'revertir quita la unidad sumada');
    const rv2 = await pedir({ anular: d.referencia });
    comprobar(rv2.d.modo === 'ya-anulada' && await libres(charm) === antes, 'revertir dos veces no quita dos veces');

    /* Por talla, y una talla que el conteo no tiene: pasa a existir. */
    const tallasConteo = Object.keys(stock[braz].tallas);
    const nueva = ['17', '18', '19', '20', '21'].find(t => !tallasConteo.includes(t));
    const antesT = await libres(`${braz}|${talla}`);
    const t1 = await pedir({ motivo: 'sobrante', base: { id: braz, talla } });
    comprobar(t1.r.status === 200 && await libres(`${braz}|${talla}`) === antesT + 1, `brazalete talla ${talla}: +1`);
    if (nueva) {
      const t2 = await pedir({ motivo: 'sobrante', base: { id: braz, talla: nueva } });
      comprobar(t2.r.status === 200 && await libres(`${braz}|${nueva}`) === 1,
        `talla ${nueva}, que el conteo no tenía: queda con 1`);
      const disp = await import('../netlify/functions/disponibilidad.mjs');
      const resp = await disp.default(new Request('https://tienda.test/.netlify/functions/disponibilidad'));
      const b = (JSON.parse(await resp.text()).brazaletes || []).find(x => x.id === braz);
      comprobar(b && b.tallas && b.tallas[nueva] === 1, `disponibilidad la lista: ${braz} talla ${nueva} = 1`, JSON.stringify(b && b.tallas));
      const otraVacia = ['17', '18', '19', '20', '21'].find(t => !tallasConteo.includes(t) && t !== nueva);
      if (otraVacia) comprobar(!(otraVacia in b.tallas), `y no lista tallas sin conteo ni sobrante (${otraVacia})`);
    } else ok(`${braz} ya tiene las cinco tallas en el conteo: no se prueba la talla nueva`);
    const sinTalla = await pedir({ motivo: 'sobrante', base: { id: braz } });
    comprobar(sinTalla.r.status === 400, 'sobrante de brazalete sin talla → 400');
  }

  console.log('\n8 · Reclasificar un «regalo» como ajuste');
  {
    /* Un bloqueo hecho como regalo, como los del conteo del 10-oct: el
       inventario ya lo descontó; aquí solo cambia de categoría. */
    const pieza = Object.keys(stock).find(i => i !== charm && i !== otro && stock[i].tipo === 'charm' && stock[i].stock >= 3
      && !/^letra-/.test(i));
    for (let i = 0; i < 3; i++) {
      await ped.guardar(`MAN-REGALO-${i}`, { estado: 'venta-manual', pago: 'regalo', total: 0,
        lineas: [{ id: pieza, unidades: 1 }], nota: 'AJUSTE conteo 10-oct: faltante' });
    }
    await ped.guardar('MAN-COBRADA-0', { estado: 'venta-manual', pago: 'nequi', total: 82000, lineas: [{ id: pieza, unidades: 1 }] });
    const antes = await libres(pieza);
    const { r, d } = await pedir({ reclasificar: 'MAN-REGALO-0', motivo: 'faltante', nota: 'conteo 10-oct' });
    comprobar(r.status === 200 && d.modo === 'reclasificado' && d.motivo === 'faltante', 'regalo → ajuste faltante', JSON.stringify(d));
    const reg = await ped.leer('MAN-REGALO-0');
    comprobar(reg.estado === 'ajuste' && reg.reclasificadoDe === 'venta-manual' && reg.pago === 'regalo' && reg.reclasificadoEn,
      'el registro dice de dónde viene y cuándo, sin borrar lo que tenía');
    comprobar(await libres(pieza) === antes, 'las unidades no se mueven (siguen descontadas)');
    const otra = await pedir({ reclasificar: 'MAN-REGALO-0', motivo: 'faltante' });
    comprobar(otra.r.status === 200 && otra.d.modo === 'ya-reclasificado', 'reclasificar dos veces → ya-reclasificado');
    const cobrada = await pedir({ reclasificar: 'MAN-COBRADA-0', motivo: 'faltante' });
    comprobar(cobrada.r.status === 409 && (await ped.leer('MAN-COBRADA-0')).estado === 'venta-manual',
      'una venta cobrada no se reclasifica (409) y queda igual');
    const sumando = await pedir({ reclasificar: 'MAN-REGALO-1', motivo: 'sobrante' });
    comprobar(sumando.r.status === 400, 'reclasificar como «sobrante» → 400 (un regalo quitó unidades)');
    const noHay = await pedir({ reclasificar: 'MAN-260101-00000000', motivo: 'faltante' });
    comprobar(noHay.r.status === 404, 'un MAN- que no existe → 404');
    const ventaMan = await pedir({ anular: 'MAN-COBRADA-0' });
    comprobar(ventaMan.r.status === 400, 'una venta manual no se revierte aquí: va a registrar-venta');
  }

  console.log(fallos ? `\n${fallos} comprobaciones en rojo.` : '\nTodo en verde.');
}

main().catch(e => { console.log('  ✗ FALLA la batería reventó — ' + (e.stack || e.message)); });
