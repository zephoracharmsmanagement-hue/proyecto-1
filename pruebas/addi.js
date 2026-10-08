'use strict';
/* Addi integrado (2026-10-07): crear-pago pide la solicitud a Addi, addi-callback
 * recibe el resultado y estado-pedido se lo cuenta a gracias.html.
 *
 * Todo con las funciones reales y almacenes falsos, y con la red de mentira:
 * esta batería no habla nunca con Addi ni con Resend. Lo que se comprueba es
 * lo que el manual de Addi exige y lo que la tienda no puede permitirse:
 *   · la solicitud lleva la referencia, el total, la cédula y las URLs bien;
 *   · el aviso sin las credenciales de notificación no cambia nada;
 *   · aprobado descuenta el inventario y avisa UNA vez aunque Addi reintente;
 *   · rechazado devuelve las unidades;
 *   · la respuesta al aviso es el mismo cuerpo que mandó Addi.
 */
const path = require('path');
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
  correo: 'laura@ejemplo.com', depto: 'Bogotá D.C.', ciudad: 'Bogotá', direccion: 'Calle 1 # 2-3',
  adicional: 'Apto 4', barrio: 'Chapinero', documento: '1.069.306.205' }, extra || {});

async function main() {
  Object.assign(process.env, {
    RESEND_API_KEY: 're_prueba', CORREO_TIENDA: 'tienda@ejemplo.com', URL_SITIO: 'https://tienda.test',
    ADDI_CLIENT_ID: 'id-de-prueba', ADDI_CLIENT_SECRET: 'secreto-de-prueba',
    ADDI_NOTIF_USUARIO: 'avisos-addi', ADDI_NOTIF_CLAVE: 'clave-de-avisos-de-prueba',
  });
  ['META_CAPI_TOKEN', 'HOJA_WEBHOOK', 'PEDIDOS_WEBHOOK', 'ADDI_AMBIENTE', 'ADDI_ALLY_SLUG'].forEach(k => delete process.env[k]);

  /* La red de mentira. `addi` decide qué contesta Addi en cada caso. */
  const correos = [], solicitudes = [];
  const addi = { min: 50000, max: 3000000, crear: 'ok' };
  global.fetch = async (url, op = {}) => {
    url = String(url);
    if (url.includes('api.resend.com')) { correos.push(JSON.parse(op.body)); return new Response('{}', { status: 200 }); }
    if (url.includes('channels-public-api.addi.com')) {
      return new Response(JSON.stringify({ minAmount: addi.min, maxAmount: addi.max, isActiveAlly: true }), { status: 200 });
    }
    if (url === 'https://auth.addi.com/oauth/token') {
      const b = JSON.parse(op.body);
      const bien = b.client_id === 'id-de-prueba' && b.client_secret === 'secreto-de-prueba'
        && b.audience === 'https://api.addi.com' && b.grant_type === 'client_credentials';
      return new Response(JSON.stringify(bien ? { access_token: 'jwt-de-prueba', expires_in: 86400 } : { error: 'access_denied' }),
        { status: bien ? 200 : 401 });
    }
    if (url === 'https://api.addi.com/v1/online-applications') {
      solicitudes.push({ cuerpo: JSON.parse(op.body), auth: op.headers && op.headers.Authorization, redirect: op.redirect });
      if (addi.crear === 'caido') return new Response('{"message":"internal"}', { status: 500 });
      return new Response(null, { status: 301, headers: { location: 'https://checkout.addi.com/solicitud/abc123' } });
    }
    return new Response('{}', { status: 200 });
  };

  const F = '../netlify/functions/';
  const inv = await import(F + '_inventario.mjs'), ped = await import(F + '_pedidos.mjs');
  const atr = await import(F + '_atribucion.mjs'), sus = await import(F + '_suscriptores.mjs');
  const pedidos = almacen();
  ped._interno.usarAlmacen(pedidos); atr.usarAlmacen(almacen()); sus._interno.usar(almacen());
  const crearPago = await import(F + 'crear-pago.mjs'), callback = await import(F + 'addi-callback.mjs');
  const estadoPedido = await import(F + 'estado-pedido.mjs'), addiMod = await import(F + '_addi.mjs');

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
    return leerJ(await pedir(crearPago, { cuerpo: Object.assign({ charms: lista, base: null, pago: 'addi', cliente }, extra || {}) }));
  };
  const reservas = () => ((invStore.d.estado && invStore.d.estado.v.reservas) || {});
  const vendido = id => ((invStore.d.estado && invStore.d.estado.v.vendido) || {})[id] || 0;
  const AUTH = 'Basic ' + Buffer.from('avisos-addi:clave-de-avisos-de-prueba').toString('base64');
  const avisar = (cuerpo, auth = AUTH) => pedir(callback, { crudo: JSON.stringify(cuerpo),
    cabeceras: Object.assign({ 'Content-Type': 'application/json' }, auth ? { Authorization: auth } : {}) });

  console.log(`\n1 · La solicitud a Addi (charms de prueba: ${c1}, ${c2}, ${c3}, ${c1})`);
  let ref, total;
  {
    const n = correos.length;
    const r = await crear([c1, c2, c3, c1], CLIENTE());
    ref = r.d && r.d.referencia; total = r.d && r.d.total;
    comprobar(r.s === 200 && r.d.modo === 'addi' && r.d.url === 'https://checkout.addi.com/solicitud/abc123',
      'crear-pago responde modo addi con la URL que dio Addi en el Location', r.d && r.d.url);
    const s = solicitudes[solicitudes.length - 1] || {};
    const c = s.cuerpo || {};
    comprobar(s.auth === 'Bearer jwt-de-prueba' && s.redirect === 'manual',
      'pide token primero y crea la solicitud sin seguir la redirección (la URL viene en el 301)');
    comprobar(c.orderId === ref && c.totalAmount === total.toFixed(2) && c.currency === 'COP',
      'orderId = referencia del pedido y totalAmount = total cobrado, con centavos', `${c.totalAmount}`);
    comprobar(c.client && c.client.idType === 'CC' && c.client.idNumber === '1069306205' && c.client.cellphoneCountryCode === '+57',
      'la cédula va limpia (solo números) y como CC');
    const suma = (c.items || []).reduce((a, i) => a + Number(i.unitPrice) * Number(i.quantity), 0) + Number(c.shippingAmount);
    comprobar(Math.abs(suma - total) < 1, 'los ítems más el envío suman el total (la gratis va a $0)', `${suma} vs ${total}`);
    comprobar((c.items || []).some(i => /GRATIS/.test(i.name) && i.unitPrice === '0.00'), 'la pieza gratis de la promo aparece en $0');
    const u = c.allyUrlRedirection || {};
    comprobar(u.callbackUrl === 'https://tienda.test/.netlify/functions/addi-callback'
      && u.redirectionUrl === `https://tienda.test/gracias.html?ref=${ref}&modo=addi`
      && u.logoUrl === 'https://tienda.test/assets/logo-zephora.png', 'callback, regreso y logo apuntan a la tienda');
    const reg = await ped.leer(ref);
    comprobar(reg && reg.pago === 'addi' && reg.estado === 'esperando-pago', 'el pedido queda registrado como Addi esperando');
    const rs = reservas()[ref];
    comprobar(rs && rs.vence - Date.now() > 2 * 3600 * 1000, 'las unidades se apartan por más de 2 horas (lo que tarda Addi como máximo)');
    comprobar(correos.length > n, 'con la solicitud creada sí sale el comprobante de pedido');
  }

  console.log('\n2 · El aviso de Addi: credenciales');
  const aviso = (estado, monto) => ({ orderId: ref, applicationId: 'app-1', approvedAmount: monto, currency: 'COP',
    status: estado, statusTimestamp: String(Math.floor(Date.now() / 1000)) });
  {
    let r = await avisar(aviso('APPROVED', total.toFixed(2)), null);
    comprobar(r.status === 401, 'sin Basic Auth → 401');
    r = await avisar(aviso('APPROVED', total.toFixed(2)), 'Basic ' + Buffer.from('avisos-addi:otra').toString('base64'));
    comprobar(r.status === 401, 'con clave equivocada → 401');
    comprobar((await ped.leer(ref)).estado === 'esperando-pago' && vendido(c1) === 0, 'y el pedido no cambió');
    const guardada = process.env.ADDI_NOTIF_CLAVE; delete process.env.ADDI_NOTIF_CLAVE;
    r = await avisar(aviso('APPROVED', total.toFixed(2)));
    comprobar(r.status === 503, 'sin credenciales configuradas → 503, para que Addi reintente cuando estén');
    process.env.ADDI_NOTIF_CLAVE = guardada;
  }

  console.log('\n3 · Pendiente, aprobado y reintentos');
  {
    const crudoP = JSON.stringify(aviso('PENDING', '0.0'));
    let r = await pedir(callback, { crudo: crudoP, cabeceras: { Authorization: AUTH } });
    comprobar(r.status === 200 && (await r.text()) === crudoP, 'PENDING → 200 con el mismo cuerpo, como exige Addi');
    comprobar((await ped.leer(ref)).estado === 'esperando-pago' && reservas()[ref], 'y la reserva sigue en pie');
    const e1 = await leerJ(await pedir(estadoPedido, { metodo: 'GET', url: `https://tienda.test/x?ref=${ref}` }));
    comprobar(e1.d.estado === 'pendiente', 'estado-pedido dice «pendiente» a gracias.html');

    const n = correos.length;
    const crudoA = JSON.stringify(aviso('APPROVED', total.toFixed(2)));
    r = await pedir(callback, { crudo: crudoA, cabeceras: { Authorization: AUTH } });
    comprobar(r.status === 200 && (await r.text()) === crudoA, 'APPROVED → 200 con el mismo cuerpo');
    const reg = await ped.leer(ref);
    comprobar(reg.estado === 'pagado' && reg.metodo === 'ADDI' && reg.transaccion === 'app-1', 'el pedido queda pagado, con la solicitud de Addi');
    comprobar(!reservas()[ref] && vendido(c1) === 2 && vendido(c2) === 1, 'el inventario se descuenta (2 del repetido, 1 de los demás)');
    const nuevos = correos.slice(n);
    comprobar(nuevos.some(c => c.to[0] === 'laura@ejemplo.com' && /Compra aprobada/.test(c.subject) && /Addi aprobó/.test(c.html)),
      'la clienta recibe «Compra aprobada» que dice que Addi aprobó');
    comprobar(nuevos.some(c => c.to[0] === 'tienda@ejemplo.com'), 'y la tienda recibe la hoja para despachar');

    const m = correos.length;
    r = await pedir(callback, { crudo: crudoA, cabeceras: { Authorization: AUTH } });
    comprobar(r.status === 200 && correos.length === m && vendido(c1) === 2,
      'Addi reintenta el APPROVED → 200, sin correos repetidos ni doble descuento');
    const e2 = await leerJ(await pedir(estadoPedido, { metodo: 'GET', url: `https://tienda.test/x?ref=${ref}` }));
    comprobar(e2.d.estado === 'aprobado' && e2.d.total === total, 'estado-pedido dice «aprobado» con el total');
    comprobar(!/laura|Calle|3001234567/i.test(e2.t), 'y no devuelve datos de la clienta');
    const e3 = await pedir(estadoPedido, { metodo: 'GET', url: 'https://tienda.test/x?ref=../../pedidos' });
    comprobar(e3.status === 400, 'una referencia con otro formato → 400');
  }

  console.log('\n4 · Rechazado');
  {
    const r0 = await crear([c1, c2], CLIENTE({ correo: 'sofi@ejemplo.com' }));
    const ref2 = r0.d.referencia;
    comprobar(reservas()[ref2], 'nuevo pedido con Addi, unidades apartadas');
    const n = correos.length;
    const crudo = JSON.stringify({ orderId: ref2, applicationId: 'app-2', approvedAmount: '0.0', currency: 'COP',
      status: 'REJECTED', statusTimestamp: String(Math.floor(Date.now() / 1000)) });
    const r = await pedir(callback, { crudo, cabeceras: { Authorization: AUTH } });
    comprobar(r.status === 200 && (await r.text()) === crudo, 'REJECTED → 200 con el mismo cuerpo');
    comprobar(!reservas()[ref2] && vendido(c1) === 0, 'las unidades vuelven al inventario, nada se descuenta');
    comprobar((await ped.leer(ref2)).estado === 'pago-rejected', 'el pedido queda como rechazado');
    comprobar(correos.length === n, 'y no se manda ningún «aprobado»');
    const e = await leerJ(await pedir(estadoPedido, { metodo: 'GET', url: `https://tienda.test/x?ref=${ref2}` }));
    comprobar(e.d.estado === 'rechazado', 'estado-pedido dice «rechazado» (gracias.html ofrece reintentar)');
    const desconocido = await avisar({ orderId: 'ZC-000000-DEADBEEF', status: 'APPROVED', approvedAmount: '1.0' });
    comprobar(desconocido.status === 404, 'aviso de un pedido que no existe → 404 (Addi reintenta, no se inventa nada)');
  }

  console.log('\n5 · Lo que crear-pago no deja pasar');
  {
    let r = await crear([c1, c2], CLIENTE({ documento: '' }));
    comprobar(r.s === 400 && /cédula/.test(r.d.error), 'sin cédula → 400 que pide la cédula');
    addi.min = 10000000;
    const k = solicitudes.length;
    r = await crear([c1, c2], CLIENTE());
    comprobar(r.s === 400 && /Addi aplica para compras entre/.test(r.d.error) && solicitudes.length === k,
      'fuera de los topes de Addi → 400 que lo explica, sin llamar a Addi');
    addi.min = 50000;
    addi.crear = 'caido';
    const n = correos.length;
    r = await crear([c1, c2], CLIENTE({ correo: 'caida@ejemplo.com' }));
    const regs = (await ped.listar()).filter(p => p.cliente && p.cliente.correo === 'caida@ejemplo.com');
    comprobar(r.s === 503 && r.d.whatsapp === true, 'Addi caído → 503 con salida por WhatsApp');
    comprobar(correos.length === n, 'y la clienta no recibe un «pedido recibido» de algo que no llegó a Addi');
    comprobar(regs.length === 1 && regs[0].estado === 'no-llego-a-addi' && !reservas()[regs[0].referencia],
      'el intento queda anotado y las unidades se liberan');
    addi.crear = 'ok';
    const sin = process.env.ADDI_CLIENT_SECRET; delete process.env.ADDI_CLIENT_SECRET;
    r = await crear([c1, c2], CLIENTE());
    comprobar(r.s === 503, 'sin credenciales de Addi → 503 (WhatsApp), no un error raro');
    process.env.ADDI_CLIENT_SECRET = sin;
  }

  console.log('\n6 · Detalles del cuerpo');
  {
    const { monto, ambiente } = addiMod._interno;
    comprobar(monto(275000) === '275000.00' && monto(0) === '0.00', 'montos en texto con centavos separados por punto');
    process.env.ADDI_AMBIENTE = 'staging';
    const a = ambiente();
    comprobar(a.auth === 'https://auth.addi-staging.com/oauth/token' && a.audiencia === 'https://api.staging.addi.com'
      && a.api === 'https://api.addi-staging.com', 'ADDI_AMBIENTE=staging cambia a los servidores de pruebas de Addi');
    delete process.env.ADDI_AMBIENTE;
    comprobar(addiMod.autorizado(AUTH) && !addiMod.autorizado('Bearer x') && !addiMod.autorizado(''),
      'solo Basic Auth con las credenciales exactas cuenta como Addi');
  }

  console.log(fallos ? `\nAddi: ${fallos} en rojo` : '\nAddi en verde ✓');
}

main().catch(e => { console.log('  ✗ FALLA la batería se cayó: ' + e.stack); process.exitCode = 1; });
