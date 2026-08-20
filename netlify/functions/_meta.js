'use strict';
/* Purchase a Meta por la Conversions API, desde el servidor.
 *
 * ── Qué arregla ──
 *
 * El pixel ya dispara `Purchase` en gracias.html, y bien: solo después de
 * preguntarle a Wompi que la transacción esté APPROVED. El problema es dónde
 * ocurre. La clienta paga en la pasarela, y volver al sitio es opcional: si
 * cierra el navegador, apaga el móvil o se le va el dato justo ahí, el pago fue
 * bueno y Meta nunca se entera.
 *
 * Es exactamente el mismo razonamiento por el que el correo de «Pago recibido»
 * salió de gracias.html y se movió al webhook. Aquí se aplica al evento de
 * conversión: el webhook siempre llega, porque lo llama Wompi y no el navegador.
 *
 * Y no es un detalle de reporte. Meta optimiza la entrega de los anuncios con
 * los eventos que recibe: si le faltan las compras de quien no volvió al sitio,
 * está aprendiendo de una muestra sesgada y gastando presupuesto real en el
 * público equivocado.
 *
 * ── Deduplicación: lo que hay que no romper ──
 *
 * Ahora el mismo Purchase puede llegar dos veces —una del navegador y otra de
 * aquí— y contarlo doble sería peor que perderlo, porque inflaría el retorno
 * declarado y las decisiones de presupuesto saldrían de un número falso.
 *
 * Meta deduplica por la pareja (event_name, event_id). Los dos lados mandan
 * como `event_id` la **referencia del pedido**, que ya es única por diseño
 * —Wompi rechaza referencias repetidas—. En gracias.html va como `eventID` en
 * la llamada a `fbq`. Si algún día se toca uno de los dos, hay que tocar el
 * otro.
 *
 * ── Falla hacia adelante ──
 *
 * Como todo lo que rodea al cobro: sin token no se manda nada y no se rompe
 * nada; si Meta responde con error o tarda, se registra y el webhook sigue su
 * curso. Perder un evento de medición es molesto; que un pago aprobado quede
 * sin procesar porque la API de Meta estaba lenta, no.
 */
const crypto = require('crypto');

/* El píxel al que va la CAPI. En producción lo fija `META_PIXEL_ID` en Netlify.
 *
 * El de reserva es `1029982529813994`, no el original `2130673404542988`: ese
 * corre en una cuenta publicitaria sin portafolio comercial dueño, así que
 * **no se le puede generar un token de Conversions API**. Dejarlo como valor
 * por defecto sería dejar puesta la única opción que no puede funcionar, y el
 * fallo saldría como un 400 en el log en vez de como algo evidente.
 *
 * Las páginas inicializan los dos píxeles mientras dure el bloqueo de Meta —el
 * viejo para no dejar la campaña activa sin señal, el nuevo para medir
 * completo—. Detalle en ESTADO.md. No es un secreto: viaja al navegador. */
const PIXEL = process.env.META_PIXEL_ID || '1029982529813994';

/* v19.0 —el default de antes— expiró el 2026-05-21. */
const API = 'https://graph.facebook.com/v25.0';

/* Meta exige normalizar antes de hashear: si el hash no se calcula sobre el
   mismo texto que ellos normalizan de su lado, no empareja con nadie y el
   evento entra sin atribuir, que es como no mandarlo. */
const sha256 = v => crypto.createHash('sha256').update(v).digest('hex');

const hashCorreo = v => {
  const t = String(v || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? sha256(t) : null;
};

/* Colombia: diez dígitos que empiezan por 3, con indicativo 57 delante y sin
   signos. Un número mal armado empareja con nadie, así que se descarta antes
   de mandarlo en vez de ensuciar el dataset. */
const hashTelefono = v => {
  let d = String(v || '').replace(/\D/g, '');
  if (/^3\d{9}$/.test(d)) d = '57' + d;
  return /^573\d{9}$/.test(d) ? sha256(d) : null;
};

const hashNombre = v => {
  const t = String(v || '').trim().toLowerCase();
  return t ? sha256(t) : null;
};

/* Wompi manda el nombre completo en un solo campo; Meta quiere nombre y
   apellido por separado. Se parte por el primer espacio, que para nombres
   colombianos acierta más de lo que falla, y si no hay espacio se manda solo
   el nombre en vez de inventarse un apellido. */
function partirNombre(completo) {
  const partes = String(completo || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return { fn: null, ln: null };
  if (partes.length === 1) return { fn: hashNombre(partes[0]), ln: null };
  return { fn: hashNombre(partes[0]), ln: hashNombre(partes.slice(1).join(' ')) };
}

/* Ciudad y departamento: minúsculas, sin tildes, sin espacios ni puntuación.
   Aquí sí se quitan las tildes —es la regla de Meta para estos campos— porque
   si no, «Bogotá» y «Bogota» serían dos ciudades distintas. */
const hashLugar = v => {
  const t = String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
  return t ? sha256(t) : null;
};

/* Los datos de la clienta, hasheados desde el formulario del checkout.
 *
 * Es mejor fuente que lo que devuelve Wompi: aquí el nombre y el apellido
 * vienen en campos separados y validados, en vez de un «full_name» que hay que
 * partir por el primer espacio y adivinar. Lo usa crear-pago.mjs para guardar
 * las señales antes de mandar a la clienta a la pasarela.
 *
 * El documento de identidad NO se incluye, ni hasheado. Meta no lo usa para
 * emparejar, y el SHA-256 de una cédula colombiana se revierte por fuerza bruta
 * en segundos: son diez dígitos. Hashear no es anonimizar cuando el dominio es
 * así de pequeño. */
function hashearCliente(cliente) {
  const c = cliente || {};
  const usuario = {};
  const poner = (k, v) => { if (v) usuario[k] = [v]; };
  poner('em', hashCorreo(c.correo));
  poner('ph', hashTelefono(c.celular));
  poner('fn', hashNombre(c.nombre));
  poner('ln', hashNombre(c.apellido));
  poner('ct', hashLugar(c.ciudad));
  poner('st', hashLugar(c.depto));
  poner('country', sha256('co'));
  return usuario;
}

/* Manda el Purchase. Nunca lanza: devuelve qué pasó para que quede en el log. */
async function purchase({ referencia, total, correo, telefono, nombre, cuando, senales }) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return { enviado: false, motivo: 'sin configurar' };
  if (!referencia) return { enviado: false, motivo: 'sin referencia' };

  const s = senales || {};

  /* Lo que guardó el checkout manda sobre lo que devuelve Wompi: viene del
     formulario validado, con nombre y apellido en campos separados y con la
     ciudad y el departamento, que Wompi no siempre echa de vuelta. Lo de Wompi
     rellena lo que falte, que es el caso de un pago sin señales guardadas. */
  const usuario = Object.assign({}, s.usuario || {});
  const em = hashCorreo(correo);
  const ph = hashTelefono(telefono);
  const { fn, ln } = partirNombre(nombre);
  if (em && !usuario.em) usuario.em = [em];
  if (ph && !usuario.ph) usuario.ph = [ph];
  if (fn && !usuario.fn) usuario.fn = [fn];
  if (ln && !usuario.ln) usuario.ln = [ln];

  /* Estas cuatro van SIN hashear: Meta las necesita en claro, y son justamente
     las que el webhook no puede conocer por su cuenta. Ver _atribucion.mjs para
     por qué sin ellas el evento de servidor es peor que no mandarlo. */
  if (s.fbc) usuario.fbc = s.fbc;
  if (s.fbp) usuario.fbp = s.fbp;
  if (s.ip) usuario.client_ip_address = s.ip;
  if (s.ua) usuario.client_user_agent = s.ua;

  /* Sin un solo identificador no hay nada que emparejar. Meta rechazaría el
     evento, así que se ahorra la llamada y queda dicho por qué. */
  if (!Object.keys(usuario).length) {
    return { enviado: false, motivo: 'sin datos de emparejamiento' };
  }

  const sitio = (process.env.URL_SITIO || process.env.URL || 'https://zephoracharms.com')
    .replace(/\/$/, '');

  const evento = {
    event_name: 'Purchase',
    /* En segundos, y el de Wompi cuando venga: el momento del pago, no el de
       este proceso. Meta descarta eventos de más de siete días. */
    event_time: Math.floor((cuando ? new Date(cuando).getTime() : Date.now()) / 1000),
    /* La pareja (event_name, event_id) es lo que deduplica contra el pixel de
       gracias.html. Ver la cabecera de este archivo antes de tocarlo. */
    event_id: String(referencia),
    action_source: 'website',
    event_source_url: `${sitio}/gracias.html`,
    user_data: usuario,
    custom_data: {
      currency: 'COP',
      value: Number(total) || 0,
      /* La segunda red de Meta, esta por pedido y no por evento: dos envíos con
         el mismo order_id no cuentan dos compras. Cubre el caso que el event_id
         no cubre — que Wompi reintente su aviso y el webhook mande otra vez. */
      order_id: String(referencia),
    },
  };

  /* Qué llevaba el pedido. Solo lo sabe el checkout, así que viaja en las
     señales; sin ellas el evento sale igual, solo que sin desglose. */
  if (s.contenidos && s.contenidos.length) {
    evento.custom_data.content_type = 'product';
    evento.custom_data.contents = s.contenidos;
    evento.custom_data.num_items = s.contenidos
      .reduce((n, c) => n + (Number(c.quantity) || 0), 0);
  }

  const cuerpo = { data: [evento] };
  /* Events Manager → Probar eventos. Con esto puesto, el evento aparece ahí y
     no entra en la optimización — es la forma de probar sin ensuciar. */
  if (process.env.META_TEST_EVENT_CODE) cuerpo.test_event_code = process.env.META_TEST_EVENT_CODE;

  try {
    /* El token va en el cuerpo y no en la query. Una URL con el token dentro
       termina en logs de la función, en trazas y en mensajes de error, y ahí se
       queda. Graph acepta access_token en el cuerpo igual de bien. */
    const r = await fetch(`${API}/${PIXEL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ access_token: token }, cuerpo)),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) {
      /* El cuerpo del error de Graph dice el campo exacto que no le gustó, y
         sin eso un fallo de CAPI es indepurable. Se recorta por si viene largo. */
      console.error('Meta CAPI respondió', r.status, (await r.text()).slice(0, 300));
      return { enviado: false, motivo: 'error ' + r.status };
    }
    return {
      enviado: true,
      campos: Object.keys(usuario),
      /* Si salió con fbc o fbp, Meta puede atarlo al anuncio que lo produjo.
         Sin eso cuenta como conversión pero empareja mucho peor, y al revisar
         por qué una campaña no aprende es lo primero que hay que mirar. */
      atribuido: Boolean(usuario.fbc || usuario.fbp),
    };
  } catch (e) {
    console.error('No se pudo mandar Purchase a Meta', referencia, e.message);
    return { enviado: false, motivo: e.message };
  }
}

module.exports = { purchase, hashearCliente,
  _interno: { hashCorreo, hashTelefono, hashNombre, hashLugar, partirNombre, PIXEL } };
