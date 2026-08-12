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

  global.fetch = fetchReal;
  console.log(fallos ? `\nMeta CAPI: ${fallos} en rojo` : '\nMeta CAPI en verde ✓');
}

main().catch(e => { console.log('  ✗ FALLA excepción no capturada — ' + e.stack); process.exit(1); });
