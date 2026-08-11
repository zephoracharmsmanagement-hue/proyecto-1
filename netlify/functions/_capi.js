'use strict';
/* El `Purchase` que Meta no puede ver desde el navegador.
 *
 * El pixel ya dispara `Purchase` en gracias.html cuando la clienta vuelve de
 * Wompi. El problema es que **volver es opcional**: puede cerrar el navegador
 * al pagar, quedarse sin datos, o pagar por PSE desde la app del banco y no
 * regresar nunca. Ese pago fue bueno y Meta no se entera. Lo mismo que ya
 * obligó a mandar el correo de confirmación desde el webhook y no desde la
 * página de gracias.
 *
 * Para la pauta no es un detalle contable. Meta optimiza hacia lo que ve; si
 * solo ve la mitad de las compras —y encima la mitad sesgada hacia quien tiene
 * buena conexión y paciencia— aprende de una muestra torcida.
 *
 * ── Por qué event_id y no simplemente «mandar el evento» ──
 *
 * Los dos eventos, el del navegador y este, describen LA MISMA compra. Sin
 * decírselo a Meta, cuenta dos. Se le dice con `event_id`: si llegan dos
 * eventos con el mismo `event_name` y el mismo `event_id`, Meta se queda con
 * uno. Aquí ese identificador es la referencia del pedido —ya es única, ya la
 * conocen las dos puntas— y por eso gracias.html pasa `{eventID: ref}` en su
 * `fbq('track','Purchase', …)`. Si alguien toca una de las dos puntas sin la
 * otra, las compras se duplican en el panel de Meta.
 *
 * ── Por qué hacen falta señales guardadas de antes ──
 *
 * Meta empareja una compra con el anuncio que la originó sobre todo por dos
 * cookies del navegador: `_fbc` (el clic en el anuncio) y `_fbp`. El webhook de
 * Wompi es una llamada servidor-a-servidor: no tiene cookies, ni IP, ni
 * user-agent de la clienta. Y como este evento suele llegar ANTES que el del
 * navegador —el webhook entra en segundos, la clienta vuelve cuando vuelve— es
 * este el que Meta conserva al deduplicar. Mandarlo pelado sería cambiar un
 * evento con atribución por uno sin ella: peor que no mandarlo.
 *
 * Por eso crear-pago.js guarda esas señales cuando sí las tiene (la llamada
 * viene del navegador de la clienta) y el webhook las recoge por referencia.
 *
 * ── Qué se guarda y qué no ──
 *
 * Lo que se guarda ya va hasheado. El blob no contiene un correo ni un teléfono
 * legibles: contiene los SHA-256 que Meta espera, que es lo único que se va a
 * mandar. Si alguien lee ese almacén no se lleva una lista de clientas.
 *
 * El documento de identidad **no se manda ni hasheado**. Meta no lo usa para
 * emparejar, y el SHA-256 de una cédula colombiana se revierte por fuerza bruta
 * en segundos: el espacio de números es diminuto. Hashear no es anonimizar
 * cuando el dominio es pequeño.
 *
 * ── Falla hacia adelante ──
 *
 * Como todo lo demás en este proyecto: si falta el token, si Meta responde mal
 * o si Blobs no está, se registra en el log y la venta sigue su curso. Un
 * evento de marketing que no se pudo mandar no puede tumbar la confirmación de
 * un pago ni hacer que Wompi reintente el webhook en bucle.
 *
 * Variables de entorno (Netlify → Site configuration → Environment variables):
 *   META_CAPI_TOKEN       token de la Conversions API. Events Manager →
 *                         dataset → Configuración → Conversions API →
 *                         Generar token de acceso. NUNCA en el repo ni en un chat.
 *   META_PIXEL_ID         opcional; por defecto el dataset de producción.
 *   META_API_VERSION      opcional; por defecto v25.0.
 *   META_TEST_EVENT_CODE  opcional. Con esto puesto los eventos salen SOLO al
 *                         panel «Probar eventos» y no cuentan como conversiones.
 *                         Se pone para probar y se QUITA después.
 */
const crypto = require('crypto');

const TIENDA = 'atribucion';

/* Cuánto se guardan las señales de un pedido esperando su pago. Tiene que
   cubrir con holgura el viaje a Wompi, igual que la reserva de inventario, y
   algo más de margen: el webhook puede reintentarse. */
const VIGENCIA_MS = 24 * 60 * 60 * 1000;

const pixel = () => process.env.META_PIXEL_ID || '2130673404542988';
const version = () => process.env.META_API_VERSION || 'v25.0';

/* Se inyectan para las pruebas: sin esto no hay forma de comprobar qué se le
   manda a Meta sin mandárselo de verdad. En producción son Netlify Blobs y el
   fetch del entorno. */
let almacenInyectado = null;
let fetchInyectado = null;
let avisado = false;

function almacen() {
  if (almacenInyectado) return almacenInyectado;
  try {
    /* Requerido aquí dentro y no arriba, por lo mismo que en _inventario.js:
       si el paquete no entró en el bundle, esto devuelve null y el pedido
       sigue su curso, en vez de tumbar la función entera al arrancar. */
    const { getStore } = require('@netlify/blobs');
    /* Consistencia fuerte: el webhook de Wompi puede entrar segundos después
       de que crear-pago escriba, que es justo la ventana en la que una lectura
       eventual devolvería nada. */
    return getStore({ name: TIENDA, consistency: 'strong' });
  } catch (e) {
    if (!avisado) {
      console.error('capi: no hay almacén para las señales —', e.message);
      avisado = true;
    }
    return null;
  }
}

function usarAlmacen(falso) { almacenInyectado = falso; }
function usarFetch(falso) { fetchInyectado = falso; }
const pedir = (...args) => (fetchInyectado || fetch)(...args);

/* ── Normalización y hasheo ──────────────────────────────────────────────
 *
 * Meta empareja comparando hashes, así que las dos puntas tienen que
 * normalizar IGUAL o el hash no cuadra y el dato se pierde en silencio. Estas
 * reglas son las que documenta Meta para cada campo; no son gusto propio.
 */
const sinTildes = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

function hash(valor) {
  if (!valor) return null;
  return crypto.createHash('sha256').update(String(valor), 'utf8').digest('hex');
}

/* Correo: minúsculas y sin espacios alrededor. */
const normCorreo = v => String(v || '').trim().toLowerCase() || null;

/* Teléfono: solo dígitos, con indicativo de país y sin el +. El checkout
   valida celulares colombianos de 10 dígitos que empiezan por 3; se les
   antepone el 57. Si ya viene con indicativo, se respeta. */
function normTelefono(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (!d) return null;
  if (/^3\d{9}$/.test(d)) return '57' + d;
  return d;
}

/* Nombres: minúsculas, sin puntuación, sin espacios alrededor. Las tildes se
   conservan —Meta acepta UTF-8 en nombres— porque quitarlas separaría a
   «Muñoz» de sí misma según cómo lo escriba cada formulario. */
const normNombre = v => String(v || '').trim().toLowerCase()
  .replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ') || null;

/* Ciudad y departamento: minúsculas, sin tildes, sin espacios ni puntuación.
   Aquí sí se quitan las tildes: es la regla de Meta para estos campos, y sin
   ella «Bogotá» y «Bogota» son dos ciudades distintas. */
const normLugar = v => sinTildes(String(v || '')).toLowerCase()
  .replace(/[^a-z0-9]/g, '') || null;

/* Los datos de la clienta, ya hasheados y listos para mandar. Recibe el objeto
   `cliente` que arma leerCliente() en crear-pago.js. */
function hashearCliente(cliente) {
  const c = cliente || {};
  const datos = {
    em: hash(normCorreo(c.correo)),
    ph: hash(normTelefono(c.celular)),
    fn: hash(normNombre(c.nombre)),
    ln: hash(normNombre(c.apellido)),
    ct: hash(normLugar(c.ciudad)),
    st: hash(normLugar(c.depto)),
    country: hash('co'),
  };
  /* Un campo en null no se omite: se manda como ausente. Meta rechaza el
     evento entero si un campo de emparejamiento llega vacío o en null. */
  Object.keys(datos).forEach(k => { if (!datos[k]) delete datos[k]; });
  return datos;
}

/* ── Señales del navegador, guardadas entre crear-pago y el webhook ────── */

/* Lo que el navegador sabe y el webhook nunca va a saber. Se llama desde
   crear-pago.js, que sí recibe la petición directamente de la clienta. */
async function guardarSenales(referencia, senales) {
  const store = almacen();
  if (!store || !referencia) return { ok: true, modo: 'sin-almacen' };
  try {
    await store.setJSON(referencia, Object.assign({
      v: 1,
      vence: Date.now() + VIGENCIA_MS,
    }, senales));
    return { ok: true, modo: 'guardado' };
  } catch (e) {
    console.error('capi/guardar: no se pudieron guardar las señales —', e.message);
    return { ok: true, modo: 'sin-escritura' };
  }
}

/* Las recoge y las borra: un pedido se cobra una vez, y dejarlas ahí sería
   guardar datos de clientas para siempre sin que nadie los vuelva a mirar.
   Se borra también cuando el pago se rechaza —lo hace el webhook— para que el
   almacén no crezca con pedidos que nunca se pagaron. */
async function tomarSenales(referencia) {
  const store = almacen();
  if (!store || !referencia) return null;
  let datos = null;
  try {
    datos = await store.get(referencia, { type: 'json' });
  } catch (e) {
    console.error('capi/tomar: no se pudieron leer las señales —', e.message);
  }
  try {
    await store.delete(referencia);
  } catch (e) {
    console.error('capi/tomar: no se pudieron borrar las señales —', e.message);
  }
  /* Caducadas se tratan como si no estuvieran. Nadie barre este almacén: el
     borrado de arriba es lo que lo mantiene chico, y esta comprobación cubre
     lo que se quedó por el camino. */
  if (datos && datos.vence && datos.vence < Date.now()) return null;
  return datos;
}

/* ── El evento ─────────────────────────────────────────────────────────── */

/* Arma el cuerpo exacto que se le manda a Meta. Separado del envío a propósito:
   así las pruebas comprueban la forma del evento —que es donde están los
   errores caros, como un hash mal normalizado— sin tocar la red. */
function armarEvento({ referencia, valor, moneda, cuando, senales, sitio }) {
  const s = senales || {};
  const usuario = Object.assign({}, s.usuario || {});

  /* Sin hashear: Meta los necesita en claro para emparejar por dispositivo, y
     son justamente los que el webhook no tiene por su cuenta. */
  if (s.fbc) usuario.fbc = s.fbc;
  if (s.fbp) usuario.fbp = s.fbp;
  if (s.ip) usuario.client_ip_address = s.ip;
  if (s.ua) usuario.client_user_agent = s.ua;

  const evento = {
    event_name: 'Purchase',
    /* En segundos, no en milisegundos. Meta descarta eventos con más de siete
       días, y un timestamp en milisegundos cae en el año 55000. */
    event_time: Math.floor((cuando || Date.now()) / 1000),
    /* La referencia del pedido. Es lo que hace que este evento y el del pixel
       en gracias.html sean uno solo para Meta. */
    event_id: referencia,
    /* `website` y no `chat`: esta compra ocurrió en el sitio. El `chat` es para
       el otro flujo, el de las ventas cerradas por WhatsApp en n8n. */
    action_source: 'website',
    user_data: usuario,
    custom_data: {
      currency: moneda || 'COP',
      value: Number(valor) || 0,
      /* La segunda red de deduplicación de Meta, esta por pedido y no por
         evento: dos envíos con el mismo order_id no cuentan dos compras. */
      order_id: referencia,
    },
  };

  if (sitio) evento.event_source_url = sitio;
  if (s.contenidos && s.contenidos.length) {
    evento.custom_data.content_type = 'product';
    evento.custom_data.contents = s.contenidos;
    evento.custom_data.num_items = s.contenidos
      .reduce((n, c) => n + (Number(c.quantity) || 0), 0);
  }
  return evento;
}

/* Manda el Purchase. Nunca lanza: devuelve un modo que el webhook registra en
   el log, que es como se diagnostica esto sin acceso a la función. */
async function enviarPurchase(datos) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) {
    /* No es un error: es el estado normal hasta que se genere el token en
       Events Manager. Se dice una vez y claro, para que quien mire el log sepa
       que no está roto sino sin configurar. */
    return { ok: true, modo: 'sin-token' };
  }

  const evento = armarEvento(datos);

  /* Sin un solo dato de emparejamiento no hay evento que mandar: Meta lo
     rechaza con un error, y con razón —un Purchase que no se puede atar a nadie
     no sirve para optimizar nada—. Pasa si Blobs no guardó las señales, o si
     este pago no salió del checkout del sitio. Se dice en el log y se sigue. */
  if (!Object.keys(evento.user_data).length) {
    console.error('capi: sin datos de emparejamiento para', datos.referencia,
      '— no se manda el evento');
    return { ok: false, modo: 'sin-datos' };
  }

  const cuerpo = { data: [evento], access_token: token };

  /* Con esto puesto, Meta manda el evento al panel «Probar eventos» y NO lo
     cuenta como conversión. Es lo que hay que usar para la primera prueba. */
  const prueba = process.env.META_TEST_EVENT_CODE;
  if (prueba) cuerpo.test_event_code = prueba;

  const url = `https://graph.facebook.com/${version()}/${pixel()}/events`;

  try {
    const r = await pedir(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      /* El token va en el cuerpo y no en la query: las URLs terminan en logs,
         en trazas y en mensajes de error. */
      body: JSON.stringify(cuerpo),
      /* El webhook de Wompi tiene que responder rápido. Si Meta no contesta en
         cinco segundos, se abandona el evento y se sigue: reintentar aquí
         dejaría a Wompi esperando y lo pondría a reenviar el pago. */
      signal: AbortSignal.timeout(5000),
    });

    const respuesta = await r.json().catch(() => null);

    if (!r.ok) {
      /* El mensaje de Meta es lo único que dice si es el token, la versión de
         la API o un campo mal normalizado. Vale su espacio en el log. */
      const detalle = (respuesta && respuesta.error && respuesta.error.message)
        || `HTTP ${r.status}`;
      console.error('capi: Meta rechazó el evento', datos.referencia, '—', detalle);
      return { ok: false, modo: 'rechazado', detalle };
    }

    return {
      ok: true,
      modo: prueba ? 'prueba' : 'enviado',
      /* Meta devuelve cuántos eventos recibió. Si dice 0 con un 200, algo se
         filtró del lado de ellos y conviene verlo en el log. */
      recibidos: respuesta && respuesta.events_received,
    };
  } catch (e) {
    const expiro = e.name === 'TimeoutError' || e.name === 'AbortError';
    console.error('capi: no se pudo mandar el evento', datos.referencia, '—',
      expiro ? 'Meta no respondió en 5s' : e.message);
    return { ok: false, modo: expiro ? 'sin-respuesta' : 'sin-envio' };
  }
}

module.exports = {
  guardarSenales, tomarSenales, enviarPurchase, hashearCliente,
  _interno: {
    usarAlmacen, usarFetch, armarEvento, hash,
    normCorreo, normTelefono, normNombre, normLugar, VIGENCIA_MS,
  },
};
