'use strict';
/* Sistecrédito integrado (2026-10-15): crear-pago crea la transacción en la
 * pasarela de Sistecrédito (api.credinet.co/pay), sistecredito-enlace le pasa
 * al checkout la URL de pago cuando Sistecrédito la tiene lista, y
 * sistecredito-aviso recibe el resultado.
 *
 * Todo con las funciones reales, almacenes falsos y la red de mentira: esta
 * batería no habla nunca con Sistecrédito ni con Resend. Lo que se comprueba es
 * lo que piden las guías de Sistecrédito (G-ALI-08, 10 y 12) y lo que la tienda
 * no puede permitirse:
 *   · la transacción lleva la referencia, el total, la cédula, las cabeceras
 *     de las llaves y las URLs bien;
 *   · un aviso NUNCA se cree por sí solo: se vuelve a consultar a Sistecrédito,
 *     y lo que manda es esa consulta;
 *   · aprobado descuenta el inventario y avisa UNA vez aunque llegue repetido;
 *   · rechazado, cancelado o vencido devuelve las unidades.
 */
const path = require('path');
const crypto = require('crypto');
const RAIZ = path.join(__dirname, '..');

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));
const copia = v => (v == null ? v : JSON.parse(JSON.stringify(v)));

function almacen() {
  const d = {}; let n = 0;
  return {
    d,
    async get(k) { return d[k] ? copia(d[k].v) : null; },
    async getWithMetadata(k) { return d[k] ? { data: copia(d[k].v), etag: d[k].e, metadata: {} } : null; },
    async setJSON(k, v, o = {}) {
      if (o.onlyIfNew && d[k]) return { modified: false };
      if (o.onlyIfMatch && (!d[k] || d[k].e !== o.onlyIfMatch)) return { modified: false };
      d[k] = { v: copia(v), e: 'e' + (++n) }; return { modified: true };
    },
    async delete(k) { delete d[k]; },
    async list() { return { blobs: Object.keys(d).map(key => ({ key })) }; },
  };
}

const CLIENTE = extra => Object.assign({ nombre: 'Laura', apellido: 'Prueba', celular: '3001234567',
  correo: 'laura@ejemplo.com', depto: 'Antioquia', ciudad: 'Medellín', direccion: 'Calle 1 # 2-3',
  adicional: 'Apto 4', barrio: 'Laureles', documento: '1.069.306.205' }, extra || {});

const LLAVE = 'llave-de-suscripcion-de-prueba';

async function main() {
  Object.assign(process.env, {
    RESEND_API_KEY: 're_prueba', CORREO_TIENDA: 'tienda@ejemplo.com', URL_SITIO: 'https://tienda.test',
    SISTECREDITO_SUBSCRIPTION_KEY: LLAVE, SISTECREDITO_STORE_ID: 'tienda-de-prueba',
    SISTECREDITO_VENDOR_ID: 'vendedor-de-prueba',
  });
  ['META_CAPI_TOKEN', 'HOJA_WEBHOOK', 'PEDIDOS_WEBHOOK', 'SISTECREDITO_AMBIENTE', 'SISTECREDITO_SANDBOX',
    'SISTECREDITO_MINIMO'].forEach(k => delete process.env[k]);

  /* La red de mentira. `sc.tx` es lo que Sistecrédito sabe de cada transacción:
     lo que devuelve GetTransactionResponse. `sc.crear` decide cómo contesta create. */
  const correos = [], creadas = [], consultas = [];
  const sc = { tx: {}, crear: 'ok', n: 0 };
  const respuesta = (data, status = 200, extra = {}) => new Response(JSON.stringify(Object.assign({
    function: '/checkout/get/transaction', errorCode: 0, message: status === 200 ? 'Petición realizada con éxito' : '',
    country: 'co', data }, extra)), { status });
  global.fetch = async (url, op = {}) => {
    url = String(url);
    if (url.includes('api.resend.com')) { correos.push(JSON.parse(op.body)); return new Response('{}', { status: 200 }); }
    if (url === 'https://api.credinet.co/pay/create') {
      const cuerpo = JSON.parse(op.body);
      creadas.push({ cuerpo, cabeceras: op.headers || {} });
      if (sc.crear === 'caido') return respuesta(null, 400, { errorCode: 738, message: '738 - Error de prueba' });
      const id = 'tx' + String(++sc.n).padStart(22, '0');
      sc.tx[id] = { _id: id, invoice: cuerpo.invoice, storeId: 'tienda-de-prueba', vendorId: 'vendedor-de-prueba',
        value: cuerpo.value, currency: 'COP', transactionStatus: 'PendingForPaymentMethod',
        paymentMethodResponse: { transactionId: id, statusResponse: 'PendingForPaymentMethod', codeResponse: '3' } };
      return respuesta(sc.tx[id]);
    }
    if (url.startsWith('https://api.credinet.co/pay/GetTransactionResponse?transactionId=')) {
      const id = decodeURIComponent(url.split('=')[1]);
      consultas.push({ id, cabeceras: op.headers || {} });
      return sc.tx[id] ? respuesta(sc.tx[id]) : respuesta(null, 400, { errorCode: 708, message: 'TransactionNotFound' });
    }
    return new Response('{}', { status: 200 });
  };
  const estado = (id, st, extra) => {
    const t = sc.tx[id];
    t.transactionStatus = st;
    t.paymentMethodResponse = Object.assign({}, t.paymentMethodResponse, { statusResponse: st }, extra || {});
  };

  const F = '../netlify/functions/';
  const inv = await import(F + '_inventario.mjs'), ped = await import(F + '_pedidos.mjs');
  const atr = await import(F + '_atribucion.mjs'), sus = await import(F + '_suscriptores.mjs');
  const pedidos = almacen();
  ped._interno.usarAlmacen(pedidos); atr.usarAlmacen(almacen()); sus._interno.usar(almacen());
  const crearPago = await import(F + 'crear-pago.mjs');
  const enlace = await import(F + 'sistecredito-enlace.mjs'), aviso = await import(F + 'sistecredito-aviso.mjs');
  const estadoPedido = await import(F + 'estado-pedido.mjs'), scMod = await import(F + '_sistecredito.mjs');

  const pedir = (mod, { metodo = 'POST', url = 'https://tienda.test/x', cuerpo, crudo, cabeceras = {} } = {}) =>
    mod.default(new Request(url, { method: metodo, headers: cabeceras,
      body: metodo === 'GET' ? undefined : (crudo != null ? crudo : (cuerpo ? JSON.stringify(cuerpo) : '')) }));
  const leerJ = async r => { const t = await r.text(); let d = null; try { d = JSON.parse(t); } catch (_) {} return { s: r.status, d, t }; };

  const stock = require(path.join(RAIZ, 'assets', 'stock.json')).items;
  const charms = Object.keys(stock).filter(i => stock[i].tipo === 'charm' && stock[i].stock >= 3 && !/^letra-/.test(i));
  const [c1, c2, c3] = charms;
  let invStore;
  const crear = async (lista, cliente, extra) => {
    invStore = almacen(); inv._interno.usarAlmacen(invStore);
    return leerJ(await pedir(crearPago, { cuerpo: Object.assign({ charms: lista, base: null, pago: 'sistecredito', cliente }, extra || {}) }));
  };
  const reservas = () => ((invStore.d.estado && invStore.d.estado.v.reservas) || {});
  const vendido = id => ((invStore.d.estado && invStore.d.estado.v.vendido) || {})[id] || 0;
  const firma = ref => crypto.createHmac('sha256', LLAVE).update(String(ref)).digest('hex');
  /* El aviso como lo manda la pasarela: el mismo cuerpo que la consulta, con el
     extraData que se le mandó al crear. */
  const avisar = async (id, cambios = {}) => {
    const d = Object.assign(copia(sc.tx[id] || {}), { extraData: { Authentication: firma((sc.tx[id] || {}).invoice) } }, cambios);
    return leerJ(await pedir(aviso, { crudo: JSON.stringify(d), cabeceras: { 'Content-Type': 'application/json' } }));
  };
  const verEnlace = async ref => leerJ(await pedir(enlace, { metodo: 'GET', url: `https://tienda.test/x?ref=${encodeURIComponent(ref)}` }));

  console.log(`\n1 · La transacción en Sistecrédito (charms de prueba: ${c1}, ${c2}, ${c3}, ${c1})`);
  let ref, total, id;
  {
    const n = correos.length;
    const r = await crear([c1, c2, c3, c1], CLIENTE());
    ref = r.d && r.d.referencia; total = r.d && r.d.total;
    comprobar(r.s === 200 && r.d.modo === 'sistecredito', 'crear-pago responde modo sistecredito', r.t.slice(0, 120));
    const s = creadas[creadas.length - 1] || { cuerpo: {}, cabeceras: {} };
    const c = s.cuerpo, h = s.cabeceras;
    id = Object.keys(sc.tx).pop();
    comprobar(h['Ocp-Apim-Subscription-Key'] === LLAVE && h.ApplicationKey === 'tienda-de-prueba'
      && h.ApplicationToken === 'vendedor-de-prueba', 'las llaves van en sus cabeceras (ApplicationKey = storeId, ApplicationToken = vendorId)');
    comprobar(h.SCOrigen === 'Production' && h.country === 'co' && h.SCLocation === '0,0',
      'ambiente de producción por defecto, país co, ubicación 0,0');
    comprobar(/\S/.test(h['User-Agent'] || ''), 'lleva User-Agent propio (sin él, el firewall de Sistecrédito responde 403 1010)');
    comprobar(c.invoice === ref && c.value === total && c.currency === 'COP' && c.taxBase === total && c.tax === 0,
      'invoice = referencia del pedido y value = total cobrado, sin decimales', `${c.value}`);
    comprobar(c.paymentMethod && c.paymentMethod.paymentMethodId === 2 && c.paymentMethod.bankCode === 1
      && c.paymentMethod.userType === 0, 'medio de pago 2 (Sistecrédito), banco 1, persona natural');
    comprobar(c.client && c.client.docType === 'CC' && c.client.document === '1069306205' && c.client.phone === '3001234567'
      && c.client.indCountry === '57' && c.client.email === 'laura@ejemplo.com' && c.client.city === 'Medellín',
      'la cédula va limpia y como CC, con el celular, el correo y la ciudad');
    comprobar(c.urlConfirmation === 'https://tienda.test/.netlify/functions/sistecredito-aviso' && c.methodConfirmation === 'POST'
      && c.urlResponse === `https://tienda.test/gracias.html?ref=${ref}&modo=sistecredito`, 'aviso y regreso apuntan a la tienda');
    comprobar(c.extraData && c.extraData.Authentication === firma(ref), 'extraData lleva la firma de la referencia');
    comprobar(c.sandbox && c.sandbox.isActive === false, 'sin SISTECREDITO_SANDBOX, el modo de pruebas va apagado');
    const reg = await ped.leer(ref);
    comprobar(reg && reg.pago === 'sistecredito' && reg.estado === 'esperando-pago' && reg.sistecreditoId === id,
      'el pedido queda registrado como Sistecrédito esperando, con el id de la transacción');
    const rs = reservas()[ref];
    comprobar(rs && rs.vence - Date.now() > 30 * 60 * 1000, 'las unidades se apartan más de 30 minutos (la transacción vive unos 15)');
    const nuevos = correos.slice(n);
    comprobar(nuevos.some(m => m.to[0] === 'tienda@ejemplo.com' && /SISTECRÉDITO \(esperando aprobación\)/.test(m.subject)),
      'la tienda recibe «SISTECRÉDITO (esperando aprobación)» en el asunto');
    comprobar(nuevos.some(m => m.to[0] === 'tienda@ejemplo.com' && /no despachar/i.test(m.text || '')),
      'y la hoja dice que no se despacha todavía');
    comprobar(nuevos.some(m => m.to[0] === 'laura@ejemplo.com' && /Sistecrédito/.test(m.html)),
      'la clienta recibe el comprobante que nombra Sistecrédito');
  }

  console.log('\n2 · El enlace de pago');
  {
    let e = await verEnlace(ref);
    comprobar(e.s === 200 && e.d.esperando === true && !e.d.url, 'mientras Sistecrédito no da la URL → esperando');
    estado(id, 'Pending', { paymentRedirectUrl: 'https://sistecredito.example/pago/abc' });
    e = await verEnlace(ref);
    comprobar(e.s === 200 && e.d.url === 'https://sistecredito.example/pago/abc', 'con la URL lista → la devuelve', e.t);
    comprobar(consultas.length && consultas[consultas.length - 1].id === id, 'consulta la transacción por su id');
    comprobar(!/laura|Calle|3001234567|1069306205/i.test(e.t), 'y no devuelve datos de la clienta');
    estado(id, 'Pending', { paymentRedirectUrl: 'javascript:alert(1)' });
    e = await verEnlace(ref);
    comprobar(!e.d.url, 'una URL que no es https no se entrega');
    estado(id, 'Pending', { paymentRedirectUrl: 'https://sistecredito.example/pago/abc' });
    e = await verEnlace('../../pedidos');
    comprobar(e.s === 400, 'una referencia con otro formato → 400');
    e = await verEnlace('ZC-000000-DEADBEEF');
    comprobar(e.s === 404, 'una referencia que no existe → 404');
  }

  console.log('\n3 · El aviso: lo que manda es la consulta, no el mensaje');
  {
    let r = await avisar(id, { transactionStatus: 'Approved' });
    comprobar(r.s === 200 && (await ped.leer(ref)).estado === 'esperando-pago' && vendido(c1) === 0,
      'el aviso dice «Approved» pero Sistecrédito sigue en Pending → no se cierra nada');
    estado(id, 'Approved');
    r = await avisar(id, { extraData: { Authentication: 'firma-falsa' } });
    comprobar(r.s === 401 && (await ped.leer(ref)).estado === 'esperando-pago', 'con una firma de extraData que no cuadra → 401, sin cambios');
    r = await leerJ(await pedir(aviso, { crudo: '{no es json', cabeceras: { 'Content-Type': 'application/json' } }));
    comprobar(r.s === 400, 'cuerpo que no es JSON → 400');
    r = await leerJ(await pedir(aviso, { metodo: 'GET' }));
    comprobar(r.s === 405, 'GET → 405 (el aviso se configuró por POST)');
    r = await avisar('tx-que-no-existe', { invoice: ref, transactionStatus: 'Approved' });
    comprobar(r.s >= 400 && (await ped.leer(ref)).estado === 'esperando-pago',
      'un aviso con un id que Sistecrédito no conoce → no se cierra nada');
  }

  console.log('\n4 · Aprobado y repetidos');
  {
    const n = correos.length;
    const r = await avisar(id);
    comprobar(r.s === 200, 'aprobado → 200');
    const reg = await ped.leer(ref);
    comprobar(reg.estado === 'pagado' && reg.metodo === 'SISTECREDITO' && reg.transaccion === id,
      'el pedido queda pagado, con la transacción de Sistecrédito');
    comprobar(!reservas()[ref] && vendido(c1) === 2 && vendido(c2) === 1, 'el inventario se descuenta (2 del repetido, 1 de los demás)');
    const nuevos = correos.slice(n);
    comprobar(nuevos.some(m => m.to[0] === 'laura@ejemplo.com' && /Compra aprobada/.test(m.subject) && /Sistecrédito aprobó/.test(m.html)),
      'la clienta recibe «Compra aprobada» que dice que Sistecrédito aprobó');
    comprobar(nuevos.some(m => m.to[0] === 'tienda@ejemplo.com' && /^PAGADO/.test(m.subject)), 'y la tienda recibe el «PAGADO — despachar»');
    const m = correos.length;
    const r2 = await avisar(id);
    const e3 = await verEnlace(ref);
    comprobar(r2.s === 200 && correos.length === m && vendido(c1) === 2,
      'el aviso repetido (y la consulta del checkout) → sin correos repetidos ni doble descuento');
    comprobar(e3.d && e3.d.terminado === true && e3.d.estado === 'aprobado', 'el enlace ya dice «aprobado» para mandarla a gracias');
    const e2 = await leerJ(await pedir(estadoPedido, { metodo: 'GET', url: `https://tienda.test/x?ref=${ref}` }));
    comprobar(e2.d.estado === 'aprobado' && e2.d.total === total, 'estado-pedido dice «aprobado» con el total');
  }

  console.log('\n5 · Rechazado, vencido y monto que no cuadra');
  {
    let r0 = await crear([c1, c2], CLIENTE({ correo: 'sofi@ejemplo.com' }));
    const ref2 = r0.d.referencia, id2 = Object.keys(sc.tx).pop();
    comprobar(reservas()[ref2], 'nuevo pedido con Sistecrédito, unidades apartadas');
    const n = correos.length;
    estado(id2, 'Rejected', { codeResponse: '802', description: 'Valor menor al mínimo' });
    const e = await verEnlace(ref2);
    comprobar(e.d && e.d.terminado === true && e.d.estado === 'rechazado' && /mínimo/.test(e.d.mensaje || ''),
      'el checkout se entera del rechazo y, si es por el mínimo (802), lo dice', e.t);
    comprobar(!reservas()[ref2] && vendido(c1) === 0, 'las unidades vuelven al inventario, nada se descuenta');
    comprobar((await ped.leer(ref2)).estado === 'pago-rejected', 'el pedido queda como rechazado');
    const r = await avisar(id2);
    comprobar(r.s === 200 && correos.length === n, 'el aviso del rechazo llega después → 200, sin correos');
    const ep = await leerJ(await pedir(estadoPedido, { metodo: 'GET', url: `https://tienda.test/x?ref=${ref2}` }));
    comprobar(ep.d.estado === 'rechazado', 'estado-pedido dice «rechazado» (gracias.html ofrece reintentar)');

    r0 = await crear([c1, c2], CLIENTE({ correo: 'vence@ejemplo.com' }));
    const ref3 = r0.d.referencia, id3 = Object.keys(sc.tx).pop();
    estado(id3, 'Expired');
    await avisar(id3);
    comprobar(!reservas()[ref3] && (await ped.leer(ref3)).estado === 'pago-expired', 'vencida (15 minutos sin pagar) → unidades liberadas');

    r0 = await crear([c1, c2], CLIENTE({ correo: 'monto@ejemplo.com' }));
    const ref4 = r0.d.referencia, id4 = Object.keys(sc.tx).pop();
    sc.tx[id4].value = 1000;
    estado(id4, 'Approved');
    await avisar(id4);
    comprobar((await ped.leer(ref4)).estado === 'esperando-pago' && vendido(c1) === 0,
      'aprobado por un valor distinto al del pedido → no se da por pagado');
  }

  console.log('\n6 · Lo que crear-pago no deja pasar');
  {
    let r = await crear([c1, c2], CLIENTE({ documento: '' }));
    comprobar(r.s === 400 && /cédula/.test(r.d.error), 'sin cédula → 400 que pide la cédula');
    process.env.SISTECREDITO_MINIMO = '10000000';
    const k = creadas.length;
    r = await crear([c1, c2], CLIENTE());
    comprobar(r.s === 400 && /Sistecrédito aplica para compras desde/.test(r.d.error) && creadas.length === k,
      'por debajo del mínimo de la tienda → 400 que lo explica, sin llamar a Sistecrédito');
    delete process.env.SISTECREDITO_MINIMO;
    sc.crear = 'caido';
    const n = correos.length;
    r = await crear([c1, c2], CLIENTE({ correo: 'caida@ejemplo.com' }));
    const regs = (await ped.listar()).filter(p => p.cliente && p.cliente.correo === 'caida@ejemplo.com');
    comprobar(r.s === 503 && /otro medio de pago/.test(r.d.error), 'Sistecrédito no crea la transacción → 503 que ofrece otro medio');
    comprobar(correos.length === n, 'y la clienta no recibe un «pedido recibido» de algo que no llegó a Sistecrédito');
    comprobar(regs.length === 1 && regs[0].estado === 'no-llego-a-sistecredito' && !reservas()[regs[0].referencia],
      'el intento queda anotado y las unidades se liberan');
    sc.crear = 'ok';
    const sin = process.env.SISTECREDITO_SUBSCRIPTION_KEY; delete process.env.SISTECREDITO_SUBSCRIPTION_KEY;
    r = await crear([c1, c2], CLIENTE());
    comprobar(r.s === 503, 'sin llaves de Sistecrédito → 503, no un error raro');
    const rr = await avisar(id);
    comprobar(rr.s === 503, 'y el aviso sin llaves → 503 (no se puede verificar)');
    process.env.SISTECREDITO_SUBSCRIPTION_KEY = sin;
  }

  console.log('\n7 · Ambiente y modo de pruebas');
  {
    process.env.SISTECREDITO_SANDBOX = 'Approved';
    await crear([c1, c2], CLIENTE({ correo: 'sandbox@ejemplo.com' }));
    const c = creadas[creadas.length - 1].cuerpo;
    comprobar(c.sandbox && c.sandbox.isActive === true && c.sandbox.status === 'Approved',
      'SISTECREDITO_SANDBOX=Approved enciende el modo de pruebas de Sistecrédito (simula sin crédito real)');
    process.env.SISTECREDITO_SANDBOX = 'cualquier-cosa';
    comprobar(scMod._interno.sandbox().isActive === false, 'un valor que no es un estado de la pasarela lo deja apagado');
    delete process.env.SISTECREDITO_SANDBOX;
    process.env.SISTECREDITO_AMBIENTE = 'Staging';
    comprobar(scMod._interno.cabeceras().SCOrigen === 'Staging', 'SISTECREDITO_AMBIENTE=Staging cambia el ambiente');
    delete process.env.SISTECREDITO_AMBIENTE;
    comprobar(scMod.MINIMO() === 50000, 'el mínimo de la tienda por defecto es $50.000');
  }

  console.log(fallos ? `\nSistecrédito: ${fallos} en rojo` : '\nSistecrédito en verde ✓');
  if (fallos) process.exitCode = 1;
}

main().catch(e => { console.log('  ✗ FALLA la batería se cayó: ' + e.stack); process.exitCode = 1; });
