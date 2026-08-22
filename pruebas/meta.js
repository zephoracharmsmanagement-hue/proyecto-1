'use strict';
/* Purchase a Meta por la Conversions API.
 *
 * Dos cosas que hay que vigilar aquí, y ninguna se ve mirando la pantalla:
 *
 * 1. **La deduplicación.** `Purchase` sale ahora por dos caminos —el pixel de
 *    gracias.html y el webhook de Wompi— y si los dos no mandan el mismo
 *    identificador, Meta cuenta cada compra dos veces. Eso infla el retorno
 *    declarado, y las decisiones de presupuesto salen de un número falso: es
 *    peor que perder el evento.
 *
 * 2. **El hash.** Si el texto no se normaliza igual que lo normaliza Meta, el
 *    hash no coincide con el de nadie y el evento entra sin atribuir. Se manda,
 *    Meta responde 200, y no sirve para nada. Un fallo así no da ninguna señal
 *    de que algo va mal, que es justo lo que lo hace peligroso.
 */
const path = require('path');
const crypto = require('crypto');
const RAIZ = path.join(__dirname, '..');
const meta = require(path.join(RAIZ, 'netlify', 'functions', '_meta.js'));

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

const sha = v => crypto.createHash('sha256').update(v).digest('hex');

/* Sustituye fetch y guarda lo que se le mandó a Meta. */
function espiarFetch(respuesta) {
  const llamadas = [];
  global.fetch = async (url, opciones) => {
    llamadas.push({ url, cuerpo: JSON.parse(opciones.body) });
    if (respuesta instanceof Error) throw respuesta;
    return respuesta || { ok: true, status: 200, text: async () => '{}' };
  };
  return llamadas;
}
const fetchReal = global.fetch;

const PEDIDO = {
  referencia: 'ZC-260811-ABCD1234',
  total: 257350,
  correo: '  Maria@Ejemplo.COM ',
  telefono: '301 899 0672',
  nombre: 'María Fernanda Gómez Ruiz',
  cuando: 1786290000000,
};

async function main() {
  console.log('1 · Normalización antes de hashear');

  comprobar(meta._interno.hashCorreo('  Maria@Ejemplo.COM ') === sha('maria@ejemplo.com'),
    'el correo se recorta y se pasa a minúsculas antes del hash');
  comprobar(meta._interno.hashCorreo('no-es-un-correo') === null,
    'un correo mal formado se descarta en vez de mandarse');

  comprobar(meta._interno.hashTelefono('301 899 0672') === sha('573018990672'),
    'al teléfono colombiano se le pone el 57 y se le quitan los signos');
  comprobar(meta._interno.hashTelefono('+57 301 899 0672') === sha('573018990672'),
    'y si ya venía con indicativo, no se duplica');
  comprobar(meta._interno.hashTelefono('12345') === null,
    'un número que no cuadra se descarta: emparejaría con nadie');

  const { fn, ln } = meta._interno.partirNombre('María Fernanda Gómez Ruiz');
  comprobar(fn === sha('maría') && ln === sha('fernanda gómez ruiz'),
    'el nombre completo se parte en nombre y apellido');
  const solo = meta._interno.partirNombre('Valentina');
  comprobar(solo.fn === sha('valentina') && solo.ln === null,
    'con un solo nombre no se inventa apellido');

  console.log('\n2 · Lo que recibe Meta');

  process.env.META_CAPI_TOKEN = 'token-de-prueba';
  delete process.env.META_TEST_EVENT_CODE;

  {
    const llamadas = espiarFetch();
    const r = await meta.purchase(PEDIDO);
    comprobar(r.enviado === true, 'se manda el evento', r.motivo || '');
    comprobar(llamadas.length === 1, 'una sola llamada por pago');

    const ev = llamadas[0].cuerpo.data[0];
    comprobar(ev.event_name === 'Purchase', 'el evento es Purchase');
    comprobar(ev.event_id === PEDIDO.referencia,
      'el event_id es la referencia del pedido — es lo que deduplica contra gracias.html',
      ev.event_id);
    comprobar(ev.action_source === 'website', 'action_source es website');
    comprobar(ev.custom_data.currency === 'COP' && ev.custom_data.value === 257350,
      'el valor va en pesos y con la moneda declarada');
    comprobar(ev.event_time === 1786290000,
      'el momento es el del pago según Wompi, en segundos', String(ev.event_time));
    comprobar(ev.user_data.em[0] === sha('maria@ejemplo.com')
      && ev.user_data.ph[0] === sha('573018990672'),
      'los identificadores viajan hasheados, nunca en claro');

    const crudo = JSON.stringify(llamadas[0].cuerpo);
    comprobar(!/maria@ejemplo\.com/i.test(crudo) && !/3018990672/.test(crudo),
      'y no queda ni rastro del correo o el teléfono sin hashear en el cuerpo');
    comprobar(/graph\.facebook\.com\/v25\.0\//.test(llamadas[0].url),
      'contra la v25.0 de Graph: la v19.0 expiró el 2026-05-21');
  }

  {
    const llamadas = espiarFetch();
    await meta.purchase(Object.assign({}, PEDIDO, { telefono: null, nombre: null }));
    const ev = llamadas[0].cuerpo.data[0];
    comprobar(ev.user_data.em && !ev.user_data.ph && !ev.user_data.fn,
      'si Wompi no manda teléfono ni nombre, va solo el correo y no campos vacíos');
  }

  {
    process.env.META_TEST_EVENT_CODE = 'TEST12345';
    const llamadas = espiarFetch();
    await meta.purchase(PEDIDO);
    comprobar(llamadas[0].cuerpo.test_event_code === 'TEST12345',
      'con test_event_code puesto, el evento va a Probar eventos y no a la optimización');
    delete process.env.META_TEST_EVENT_CODE;
  }

  console.log('\n3 · Falla hacia adelante');

  {
    const token = process.env.META_CAPI_TOKEN;
    delete process.env.META_CAPI_TOKEN;
    const llamadas = espiarFetch();
    const r = await meta.purchase(PEDIDO);
    comprobar(r.enviado === false && r.motivo === 'sin configurar' && llamadas.length === 0,
      'sin META_CAPI_TOKEN no se manda nada y no se rompe nada');
    process.env.META_CAPI_TOKEN = token;
  }

  {
    const llamadas = espiarFetch();
    const r = await meta.purchase({ referencia: 'ZC-1', total: 1000 });
    comprobar(r.enviado === false && r.motivo === 'sin datos de emparejamiento'
      && llamadas.length === 0,
      'sin ningún identificador no se llama a Meta: el evento no emparejaría con nadie');
  }

  {
    espiarFetch({ ok: false, status: 400, text: async () => '{"error":{"message":"campo malo"}}' });
    const r = await meta.purchase(PEDIDO);
    comprobar(r.enviado === false && r.motivo === 'error 400',
      'si Meta rechaza el evento, se registra y no se lanza');
  }

  {
    espiarFetch(new Error('se cayó la red'));
    const r = await meta.purchase(PEDIDO);
    comprobar(r.enviado === false && /red/.test(r.motivo),
      'si la red falla, un pago aprobado no se queda sin procesar por eso');
  }


  /* ──────────────────────────────────────────────────────────────────────
   * Señales de atribución
   *
   * El webhook de Wompi es servidor a servidor: no ve cookies, ni IP, ni
   * user-agent. Y como su evento suele llegar ANTES que el del navegador, es el
   * que Meta conserva al deduplicar — mandarlo pelado no solo no añade
   * atribución, se la quita al del navegador, que sí la traía.
   * ────────────────────────────────────────────────────────────────────── */
  console.log('\n5 · Datos de la clienta desde el checkout');

  const CLIENTA = {
    nombre: 'María José', apellido: 'Muñoz Ríos',
    correo: 'Maria.Jose@Gmail.COM', celular: '3018990672',
    documento: '1019151696', tipodoc: 'CC',
    ciudad: 'Bogotá D.C.', depto: 'Cundinamarca',
  };
  const usuario = meta.hashearCliente(CLIENTA);

  comprobar(usuario.em[0] === sha('maria.jose@gmail.com'), 'el correo va hasheado');
  comprobar(usuario.ph[0] === sha('573018990672'), 'el teléfono va hasheado con indicativo');
  comprobar(usuario.ct[0] === sha('bogotadc'),
    'la ciudad va sin tildes ni puntos: es la regla de Meta para ese campo');
  comprobar(usuario.st[0] === sha('cundinamarca'), 'el departamento también');
  comprobar(usuario.country[0] === sha('co'), 'el país va como código de dos letras');

  /* Lo importante que NO puede pasar: el SHA-256 de una cédula se revierte por
     fuerza bruta en segundos —son diez dígitos— y Meta ni la usa. */
  const plano = JSON.stringify(usuario);
  comprobar(!plano.includes(sha('1019151696')) && !plano.includes('1019151696'),
    'el documento de identidad no sale, ni hasheado');

  console.log('\n6 · Lo que el checkout sabe y el webhook no');

  {
    const llamadas = espiarFetch();
    const r = await meta.purchase(Object.assign({}, PEDIDO, {
      senales: {
        usuario,
        fbc: 'fb.1.1786290000000.IwAR0abc-DEF',
        fbp: 'fb.1.1786290000000.1234567890',
        ip: '181.49.1.2', ua: 'Mozilla/5.0 (iPhone)',
        contenidos: [{ id: 'acuario', quantity: 2 }, { id: 'mickey-mouse', quantity: 1 }],
      },
    }));
    const ev = llamadas[0].cuerpo.data[0];

    /* Sin hashear a propósito: Meta los necesita en claro. */
    comprobar(ev.user_data.fbc === 'fb.1.1786290000000.IwAR0abc-DEF',
      'el fbc del clic en el anuncio viaja sin hashear');
    comprobar(ev.user_data.fbp && ev.user_data.client_ip_address === '181.49.1.2'
      && ev.user_data.client_user_agent === 'Mozilla/5.0 (iPhone)',
      'fbp, IP y user-agent viajan sin hashear');
    comprobar(r.atribuido === true,
      'y queda dicho en el resultado, que es lo que va al log');

    /* El formulario del checkout es mejor fuente que el full_name de Wompi:
       nombre y apellido vienen separados y validados, sin adivinar dónde parte. */
    comprobar(ev.user_data.fn[0] === sha('maría josé'),
      'el nombre sale del formulario, no de partir el full_name de Wompi');
    comprobar(ev.user_data.ln[0] === sha('muñoz ríos'), 'y el apellido completo');

    comprobar(ev.custom_data.order_id === PEDIDO.referencia,
      'va order_id además de event_id: cubre que Wompi reintente su aviso');
    comprobar(ev.custom_data.num_items === 3,
      'num_items suma unidades, no líneas', String(ev.custom_data.num_items));
    comprobar(ev.custom_data.contents.length === 2, 'y viaja el desglose de piezas');
  }

  {
    /* Sin señales guardadas el evento sale igual, con lo que devuelva Wompi. */
    const llamadas = espiarFetch();
    const r = await meta.purchase(PEDIDO);
    const ev = llamadas[0].cuerpo.data[0];
    comprobar(r.enviado === true && !ev.user_data.fbc,
      'sin señales el evento sale igual: la atribución es un extra, no un requisito');
    comprobar(r.atribuido === false,
      'pero se marca como no atribuido, para poder verlo en el log');
  }

  console.log('\n7 · El token no viaja en la URL');
  {
    const llamadas = espiarFetch();
    await meta.purchase(PEDIDO);
    comprobar(!llamadas[0].url.includes(process.env.META_CAPI_TOKEN),
      'una URL con el token dentro termina en logs y trazas, y ahí se queda');
    comprobar(llamadas[0].cuerpo.access_token === process.env.META_CAPI_TOKEN,
      'el token viaja en el cuerpo');
  }

  console.log('\n8 · Lo que aporta crear-pago');
  {
    const { _interno: cp } = await import('../netlify/functions/crear-pago.mjs');

    /* Estas cookies entran por una URL pública y salen hacia Meta en claro. */
    comprobar(cp.cookiePixel('fb.1.1786290000000.IwAR0abc-DEF') !== null,
      'una cookie del pixel con formato válido se acepta');
    comprobar(cp.cookiePixel('<script>alert(1)</script>') === null,
      'una cadena arbitraria se descarta en vez de mandarse a Meta');
    comprobar(cp.cookiePixel('') === null, 'una cookie ausente no se inventa');

    const cab = n => ({ get: k => n[k] || null });
    comprobar(cp.ipCliente(cab({ 'x-nf-client-connection-ip': '181.49.1.2' })) === '181.49.1.2',
      'la IP sale de la cabecera de Netlify');
    comprobar(cp.ipCliente(cab({ 'x-forwarded-for': '181.49.1.2, 10.0.0.1' })) === '181.49.1.2',
      'del x-forwarded-for solo sirve la primera entrada');

    const contenidos = cp.contenidosDe({ base: { id: 'pulsera', talla: '18' },
      charms: ['acuario', 'acuario', 'mickey-mouse'] });
    comprobar(contenidos.find(c => c.id === 'acuario').quantity === 2,
      'los contenidos agrupan por producto y cuentan unidades');
    comprobar(!JSON.stringify(contenidos).includes('|'),
      'la talla no entra: Meta cuenta productos, no unidades de inventario');
  }

  console.log('\n9 · El almacén de señales');
  {
    const atr = await import('../netlify/functions/_atribucion.mjs');
    const datos = new Map();
    atr.usarAlmacen({
      async setJSON(k, v) { datos.set(k, JSON.parse(JSON.stringify(v))); },
      async get(k) { return datos.has(k) ? JSON.parse(JSON.stringify(datos.get(k))) : null; },
      async delete(k) { datos.delete(k); },
    });

    await atr.guardar('ZC-A', { usuario, fbp: 'fb.1.1.1' });
    const leidas = await atr.tomar('ZC-A');
    comprobar(leidas && leidas.fbp === 'fb.1.1.1', 'las señales se guardan y se recogen');
    comprobar(datos.size === 0,
      'y se borran al recogerlas: un pedido se cobra una vez');
    comprobar(await atr.tomar('ZC-A') === null, 'recogerlas dos veces no revive nada');
    comprobar(await atr.tomar('ZC-NO-EXISTE') === null,
      'una referencia desconocida no revienta');

    /* Nadie barre este almacén; el borrado al leer es lo que lo mantiene chico,
       y esto cubre lo que se quedó por el camino. */
    await atr.usarAlmacen && datos.set('ZC-VIEJO', { usuario, vence: Date.now() - 1000 });
    comprobar(await atr.tomar('ZC-VIEJO') === null, 'unas señales caducadas no se usan');

    atr.usarAlmacen({
      async setJSON() { throw new Error('Blobs caído'); },
      async get() { throw new Error('Blobs caído'); },
      async delete() { throw new Error('Blobs caído'); },
    });
    const g = await atr.guardar('ZC-B', { usuario });
    comprobar(g.ok === true && g.modo === 'sin-escritura',
      'con Blobs caído, guardar no tumba la venta');
    comprobar(await atr.tomar('ZC-B') === null,
      'con Blobs caído, recoger devuelve nada sin lanzar');
  }

  console.log('\n10 · Contraentrega también cuenta');
  {
    /* Contraentrega no pasa por Wompi, así que no hay webhook: su Purchase de
       servidor sale de crear-pago. Aquí se comprueba que el HTML manda el
       eventID con el que se deduplica contra él. */
    const fs = require('fs');
    const checkout = fs.readFileSync(path.join(RAIZ, 'checkout.html'), 'utf8');
    comprobar(/content_name:'Contraentrega'\},d\.referencia\)/.test(checkout),
      'checkout.html manda la referencia como eventID del Purchase de contraentrega');
    comprobar(/fbp:cookie\('_fbp'\),\s*fbc:cookie\('_fbc'\)/.test(checkout),
      'y manda las cookies del pixel al servidor con el pedido');

    const cp = fs.readFileSync(path.join(RAIZ, 'netlify', 'functions', 'crear-pago.mjs'), 'utf8');
    comprobar(/pago: 'contraentrega'/.test(cp) && /await purchase\(/.test(cp),
      'crear-pago manda el Purchase de contraentrega, que el webhook nunca vería');
  }

  global.fetch = fetchReal;
  console.log(fallos ? `\nMeta CAPI: ${fallos} en rojo` : '\nMeta CAPI en verde ✓');
}

main().catch(e => { console.log('  ✗ FALLA excepción no capturada — ' + e.stack); process.exit(1); });
