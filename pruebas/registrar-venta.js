'use strict';
/* registrar-venta.mjs — ventas cerradas fuera del checkout (WhatsApp).
 *
 * Lo que hay que demostrar: sin clave no toca nada; con clave descuenta en el
 * MISMO contador que el checkout; sin unidades bloquea (aquí sí); no descuenta
 * dos veces; y el Purchase a Meta sale como venta de chat SIN señales de
 * navegador —serían las del celular del propietario—.
 *
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
  const CLAVE = 'clave-de-prueba-registrar-venta-32';
  process.env.VENTA_MANUAL_KEY = CLAVE;
  delete process.env.HOJA_WEBHOOK;
  const inv = await import('../netlify/functions/_inventario.mjs');
  const ped = await import('../netlify/functions/_pedidos.mjs');
  inv._interno.usarAlmacen(almacenInventario());
  ped._interno.usarAlmacen(almacenPedidos());
  const mod = await import('../netlify/functions/registrar-venta.mjs');

  const stock = require(path.join(RAIZ, 'assets', 'stock.json')).items;
  const charm = Object.keys(stock).find(i => stock[i].tipo === 'charm' && stock[i].stock >= 3);
  const agotado = Object.keys(stock).find(i => stock[i].tipo === 'charm' && stock[i].stock === 0);
  const braz = Object.keys(stock).find(i => stock[i].tallas && Object.values(stock[i].tallas).some(n => n > 0));
  const talla = Object.keys(stock[braz].tallas).find(t => stock[braz].tallas[t] > 0);

  /* fetch grabado: lo que saldría hacia Meta. */
  const salidas = [];
  global.fetch = async (url, op) => { salidas.push({ url: String(url), cuerpo: JSON.parse(op.body) }); return new Response('{}', { status: 200 }); };
  process.env.META_CAPI_TOKEN = 'token-de-prueba';

  const pedir = async (cuerpo, { clave = CLAVE, metodo = 'POST' } = {}) => {
    const headers = new Headers({ 'x-forwarded-for': '181.1.2.3', 'user-agent': 'Celular del propietario' });
    if (clave !== null) headers.set('x-zephora-automation-key', clave);
    const r = await mod.default({ method: metodo, headers, text: async () => JSON.stringify(cuerpo) });
    return { r, d: JSON.parse(await r.text()) };
  };
  const libres = async s => (await inv.disponibles([s]))[s];

  console.log(`\n1 · Clave (pieza de prueba: ${charm})`);
  {
    const antes = await libres(charm);
    const sin = await pedir({ charms: [charm], pago: 'nequi', total: 1000 }, { clave: null });
    const mala = await pedir({ charms: [charm], pago: 'nequi', total: 1000 }, { clave: 'otra-clave-de-prueba-registrar-v' });
    comprobar(sin.r.status === 401 && mala.r.status === 401, 'sin clave o con clave errada → 401', `${sin.r.status}/${mala.r.status}`);
    comprobar(await libres(charm) === antes, 'y el contador no se toca', `${antes} → ${await libres(charm)}`);
    comprobar((await pedir({}, { metodo: 'GET' })).r.status === 405, 'GET → 405');
  }

  console.log('\n2 · Venta válida');
  let refVenta;
  {
    const antes = await libres(charm);
    const antesB = await libres(`${braz}|${talla}`);
    const { r, d } = await pedir({ charms: [charm], base: { id: braz, talla }, pago: 'transferencia',
      total: 150000, telefono: '300 123 4567', nombre: 'Clienta Prueba', correo: 'clienta@ejemplo.com' });
    refVenta = d.referencia;
    comprobar(r.status === 200 && /^MAN-\d{6}-[0-9A-F]{8}$/.test(d.referencia), '200 con referencia MAN-', d.referencia);
    comprobar(await libres(charm) === antes - 1, `el charm baja 1 en el mismo contador que usa la tienda (${antes} → ${await libres(charm)})`);
    comprobar(await libres(`${braz}|${talla}`) === antesB - 1, `el brazalete talla ${talla} baja 1`);
    comprobar(d.restante && d.restante[charm] === antes - 1, 'devuelve lo que queda, del propio CAS', JSON.stringify(d.restante));
    const reg = await ped.leer(d.referencia);
    comprobar(reg && reg.estado === 'venta-manual' && reg.total === 150000 && reg.pago === 'transferencia',
      'queda registrada con el total y el medio reales');

    const ev = salidas.length && salidas[salidas.length - 1].cuerpo.data[0];
    comprobar(ev && ev.event_name === 'Purchase' && ev.action_source === 'chat' && ev.event_id === d.referencia,
      'Purchase a Meta como venta de chat, event_id = referencia');
    comprobar(ev && !ev.user_data.client_ip_address && !ev.user_data.client_user_agent && !ev.user_data.fbp && !ev.user_data.fbc
      && !ev.event_source_url, 'sin IP, user-agent, fbp, fbc ni URL del sitio (serían del propietario)');
    comprobar(ev && ev.user_data.ph && ev.user_data.em && ev.custom_data.value === 150000,
      'con teléfono y correo de la clienta hasheados y el total real');
  }

  console.log('\n3 · No descuenta dos veces');
  {
    const antes = await libres(charm);
    const r = await inv.confirmar(refVenta);
    comprobar(r.modo === 'sin-reserva' && await libres(charm) === antes, 'confirmar otra vez la misma referencia no descuenta', r.modo);
  }

  console.log('\n4 · Sin unidades, aquí sí se bloquea');
  if (agotado) {
    const antesC = await libres(charm);
    const { r, d } = await pedir({ charms: [agotado, charm], pago: 'efectivo', total: 90000 });
    comprobar(r.status === 409 && /Sin unidades/.test(d.error), `pieza agotada (${agotado}) → 409`, d.error);
    comprobar(await libres(charm) === antesC, 'y no descuenta nada del resto del pedido');
  } else ok('no hay piezas agotadas en stock.json para probar el 409');
  {
    const { r } = await pedir({ charms: ['no-existe'], pago: 'nequi', total: 1 });
    comprobar(r.status === 400, 'pieza desconocida → 400');
    const s = await pedir({ base: { id: braz }, pago: 'nequi', total: 1 });
    comprobar(s.r.status === 400 && /talla/.test(s.d.error), 'brazalete sin talla → 400');
    const m = await pedir({ charms: [charm], pago: 'bitcoin', total: 1 });
    comprobar(m.r.status === 400, 'medio de pago desconocido → 400');
  }

  console.log('\n5 · Regalo de suscriptora: descuenta, pero no es una compra');
  {
    const n = salidas.length, antes = await libres(charm);
    const { r } = await pedir({ charms: [charm], pago: 'regalo', total: 0 });
    comprobar(r.status === 200 && await libres(charm) === antes - 1, 'descuenta la pieza regalada');
    comprobar(salidas.length === n, 'y no manda Purchase a Meta');
  }

  console.log('\n6 · Anular una venta manual mal registrada');
  {
    const antes = await libres(charm);
    const { r } = await pedir({ anular: refVenta });
    comprobar(r.status === 200 && await libres(charm) === antes + 1, 'anular devuelve las unidades', `${antes} → ${await libres(charm)}`);
    const otra = await pedir({ anular: refVenta });
    comprobar(otra.r.status === 200 && await libres(charm) === antes + 1, 'anular dos veces no devuelve dos veces');
    const web = await pedir({ anular: 'ZC-260101-AAAAAAAA' });
    comprobar(web.r.status === 400, 'no anula pedidos del checkout (ZC-)');
  }

  console.log(fallos ? `\n${fallos} comprobaciones en rojo.` : '\nTodo en verde.');
}

main().catch(e => { console.log('  ✗ FALLA la batería reventó — ' + (e.stack || e.message)); });
