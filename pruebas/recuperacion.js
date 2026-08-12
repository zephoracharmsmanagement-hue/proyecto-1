'use strict';
/* Recuperación de carritos abandonados.
 *
 * Esta batería vigila algo distinto que las demás. En el checkout, un fallo se
 * ve: no cobra, o cobra mal. Aquí un fallo se ve en la bandeja de entrada de
 * una clienta, y para cuando alguien se entera ya se mandó.
 *
 * Los tres errores que hay que hacer imposibles:
 *
 * 1. **Escribirle a quien sí compró.** Es el peor: recibir «no terminaste tu
 *    pedido» justo después de pagar destruye la confianza en el comprobante
 *    que llegó cinco minutos antes.
 * 2. **Escribir dos veces.** Una clienta que recibe dos correos por el mismo
 *    carrito no vuelve, se da de baja.
 * 3. **Escribir demasiado pronto**, mientras el pago por PSE todavía se está
 *    procesando.
 *
 * Y uno que no es de negocio sino legal: **que los datos no se borren**. Este
 * almacén guarda nombre, correo y celular en claro —no hay forma de escribirle
 * a nadie con un hash— y bajo la Ley 1581 no pueden quedarse ahí para siempre.
 */
const path = require('path');
const RAIZ = path.join(__dirname, '..');

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

const MIN = 60 * 1000;

function almacenFalso(inicial = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    async setJSON(k, v) { datos.set(k, JSON.parse(JSON.stringify(v))); },
    async get(k) { return datos.has(k) ? JSON.parse(JSON.stringify(datos.get(k))) : null; },
    async delete(k) { datos.delete(k); },
    async list() { return { blobs: [...datos.keys()].map(key => ({ key })) }; },
    _datos: datos,
  };
}

const pedido = (ref, edadMin, extra = {}) => ({
  v: 1, referencia: ref, creado: Date.now() - edadMin * MIN,
  avisado: null, estado: 'esperando',
  cliente: { nombre: 'María', apellido: 'Gómez', correo: `${ref.toLowerCase()}@ejemplo.com`,
    celular: '3018990672', ciudad: 'Bogotá D.C.', depto: 'Cundinamarca' },
  lineas: [{ nombre: 'Acuario', precio: 85000 }, { nombre: 'Pulsera Copo de Nieve', talla: '18', precio: 58000 }],
  cuentas: { total: 143000 },
  pago: 'anticipado',
  ...extra,
});

/* Captura los correos en vez de mandarlos. */
function espiarResend() {
  const enviados = [];
  const real = global.fetch;
  process.env.RESEND_API_KEY = 'llave-de-prueba';
  global.fetch = async (url, opciones) => {
    if (String(url).includes('resend.com')) {
      enviados.push(JSON.parse(opciones.body));
      return { ok: true, status: 200, text: async () => '{}' };
    }
    return real(url, opciones);
  };
  return enviados;
}

async function correr() {
  const mod = await import('../netlify/functions/recuperar-carritos.mjs');
  const r = await mod.default();
  return JSON.parse(await r.text());
}

async function main() {
  const pend = await import('../netlify/functions/_pendientes.mjs');
  const { ESPERA_MS, CADUCIDAD_MS } = pend;
  const esperaMin = ESPERA_MS / MIN;
  const caducidadMin = CADUCIDAD_MS / MIN;

  console.log('\n1 · A quién le toca mensaje y a quién no');

  comprobar(pend.toca(pedido('ZC-A', esperaMin + 5)) === true,
    'un pedido sin pagar, pasada la espera, sí');
  comprobar(pend.toca(pedido('ZC-B', 5)) === false,
    'uno de hace cinco minutos NO: puede estar pagando por PSE ahora mismo');
  comprobar(pend.toca(pedido('ZC-C', esperaMin - 1)) === false,
    `justo antes de los ${esperaMin} minutos tampoco`);
  comprobar(pend.toca(pedido('ZC-D', esperaMin + 5, { avisado: Date.now() })) === false,
    'a quien ya se le escribió, NUNCA otra vez');
  comprobar(pend.toca(pedido('ZC-E', caducidadMin + 10)) === false,
    'y a uno de hace más de una semana tampoco: ese carrito ya no existe');
  comprobar(pend.toca(pedido('ZC-F', esperaMin + 5, { cliente: { nombre: 'Ana' } })) === false,
    'sin correo no se intenta nada');
  comprobar(pend.toca(null) === false, 'un registro vacío no revienta la corrida');

  console.log('\n2 · La corrida completa');
  {
    const almacen = almacenFalso({
      'ZC-VIEJO': pedido('ZC-VIEJO', esperaMin + 30),
      'ZC-NUEVO': pedido('ZC-NUEVO', 3),
      'ZC-YA-AVISADO': pedido('ZC-YA-AVISADO', esperaMin + 60, { avisado: Date.now() - MIN }),
    });
    pend.usarAlmacen(almacen);
    const enviados = espiarResend();

    const r = await correr();
    comprobar(r.avisados === 1, 'sale un solo correo de los tres pedidos', `avisados: ${r.avisados}`);
    comprobar(enviados.length === 1 && enviados[0].to[0] === 'zc-viejo@ejemplo.com',
      'y le llega al que lleva esperando, no a los otros dos',
      enviados[0] && enviados[0].to[0]);

    /* La marca vive en el almacén: si se perdiera, la siguiente corrida —dentro
       de quince minutos— mandaría el mismo correo otra vez. */
    comprobar(almacen._datos.get('ZC-VIEJO').avisado > 0,
      'queda anotado que ya se le escribió');

    const segunda = await correr();
    comprobar(segunda.avisados === 0 && enviados.length === 1,
      'la corrida siguiente NO le vuelve a escribir');
  }

  console.log('\n3 · Quien pagó no recibe nada');
  {
    /* El caso que más caro sale. El webhook borra el pendiente al aprobar el
       pago, así que para cuando esto corre ya no hay a quién escribirle. */
    const almacen = almacenFalso({ 'ZC-PAGADO': pedido('ZC-PAGADO', esperaMin + 30) });
    pend.usarAlmacen(almacen);
    const enviados = espiarResend();

    await pend.cerrar('ZC-PAGADO');
    comprobar(almacen._datos.size === 0,
      'al confirmarse el pago, el registro desaparece del almacén');

    const r = await correr();
    comprobar(r.avisados === 0 && enviados.length === 0,
      'y no se le escribe «no terminaste tu pedido» a quien acaba de comprar');
  }

  console.log('\n4 · Un pago rechazado sí merece mensaje, y otro distinto');
  {
    const almacen = almacenFalso({ 'ZC-RECH': pedido('ZC-RECH', esperaMin + 30) });
    pend.usarAlmacen(almacen);
    const enviados = espiarResend();

    await pend.marcarFallido('ZC-RECH', 'DECLINED');
    comprobar(almacen._datos.get('ZC-RECH').estado === 'declined',
      'un pago declinado se marca pero NO se borra: ahí sí quiso comprar');

    await correr();
    const c = enviados[0];
    comprobar(c && /no se completó/i.test(c.subject),
      'y el correo habla del pago, no de un carrito olvidado', c && c.subject);
    comprobar(c && /contraentrega/i.test(c.text),
      'ofreciéndole otro medio de pago');
  }

  console.log('\n5 · Los datos se borran solos');
  {
    const almacen = almacenFalso({
      'ZC-CADUCO': pedido('ZC-CADUCO', caducidadMin + 60),
      'ZC-VIVO': pedido('ZC-VIVO', 10),
    });
    pend.usarAlmacen(almacen);
    espiarResend();

    const r = await correr();
    comprobar(r.borrados === 1 && !almacen._datos.has('ZC-CADUCO'),
      'pasada la semana el registro se borra, se le haya escrito o no');
    comprobar(almacen._datos.has('ZC-VIVO'), 'y el que sigue vigente se queda');
  }

  console.log('\n6 · Qué dice el correo');
  {
    const mod = await import('../netlify/functions/recuperar-carritos.mjs');
    const { html, txt, asunto } = mod._interno.correo(pedido('ZC-260812-AAAA1111', esperaMin + 5));

    comprobar(/Acuario/.test(html) && /Copo de Nieve/.test(html),
      'lleva las piezas que había armado');
    comprobar(/talla 18|Talla 18/i.test(html), 'con la talla del brazalete');
    comprobar(/143\.000/.test(html), 'y el total', asunto);
    comprobar(/ZC-260812-AAAA1111/.test(html), 'lleva la referencia');

    /* Sin esto, el correo promete piezas que pueden llevar días apartadas o
       vendidas: el mismo error que la reserva de inventario vino a arreglar. */
    comprobar(/disponibilidad.*puede haber cambiado/i.test(txt),
      'avisa que la disponibilidad pudo cambiar: no promete lo que ya no hay');

    /* Un correo comercial sin consentimiento aparte es otro problema. Este es
       transaccional: habla del pedido de ella, sin ofertas nuevas. */
    comprobar(!/descuento|cupón|cupon|%\s*off|oferta/i.test(txt),
      'no mete promociones: eso lo volvería marketing y necesitaría consentimiento aparte');
    comprobar(/una sola vez/i.test(txt), 'dice que es el único mensaje que se le manda');
    comprobar(/NIT 1\.019\.151\.696-3/.test(txt), 'y quién lo manda');
    comprobar(txt.length > 200 && /wa\.me/.test(txt),
      'lleva versión en texto plano con la salida por WhatsApp');
  }

  console.log('\n7 · Falla hacia adelante');
  {
    pend.usarAlmacen({
      async setJSON() { throw new Error('Blobs caído'); },
      async get() { throw new Error('Blobs caído'); },
      async delete() { throw new Error('Blobs caído'); },
      async list() { throw new Error('Blobs caído'); },
    });
    const r = await correr();
    comprobar(r.revisados === 0 && r.avisados === 0,
      'con Blobs caído la corrida termina en cero, sin lanzar');

    const a = await pend.anotar('ZC-X', { cliente: {} });
    comprobar(a.ok === true, 'y anotar un pendiente nunca puede costar una venta');
  }

  {
    /* Resend caído: el pedido ya quedó marcado como avisado y no se reintenta.
       Es a propósito — ver la cabecera de _pendientes.mjs. */
    const almacen = almacenFalso({ 'ZC-SINCORREO': pedido('ZC-SINCORREO', esperaMin + 30) });
    pend.usarAlmacen(almacen);
    delete process.env.RESEND_API_KEY;
    const r = await correr();
    comprobar(r.fallidos === 1 && r.avisados === 0,
      'sin Resend configurado se cuenta como fallido y la corrida sigue');
  }

  pend.usarAlmacen(null);
  console.log(fallos ? `\nRecuperación: ${fallos} en rojo` : '\nRecuperación de carritos en verde ✓');
}

main().catch(e => { console.log('  ✗ FALLA la batería reventó — ' + e.stack); });
