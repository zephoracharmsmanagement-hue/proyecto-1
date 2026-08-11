'use strict';
/* Lo que Wompi llama cuando una transacción cambia de estado.
 *
 * Sin esto el sitio nunca se entera de que pagaron. La página de gracias no
 * sirve como confirmación: la clienta puede cerrar el navegador antes de que
 * la redirección ocurra, y aun así el pago fue bueno. Lo que decide es este
 * evento, que Wompi manda por su cuenta y reintenta si falla.
 *
 * Y hay que verificarlo. La URL es pública: cualquiera puede inventarse un
 * POST diciendo «pagado». Wompi firma cada evento con un secreto que solo
 * tenemos nosotros, y aquí se recalcula esa firma antes de creer nada.
 *
 * Configurar en Wompi (Ajustes → Eventos):
 *   URL de eventos: https://zephoracharms.com/.netlify/functions/wompi-webhook
 * Variables de entorno:
 *   WOMPI_EVENTOS      prod_events_… — el secreto con que Wompi firma
 *   PEDIDOS_WEBHOOK    opcional: a dónde reenviar el aviso de pago aprobado
 */
const crypto = require('crypto');
const { cop } = require('./_precios');
const { confirmar, liberar } = require('./_inventario');
const { enviar } = require('./_correo');
const { tomarSenales, enviarPurchase } = require('./_capi');

const ok = (cuerpo) => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cuerpo || { recibido: true }),
});

/* Wompi firma así: se concatenan los valores de las propiedades que él mismo
   lista en signature.properties, en ese orden, luego el timestamp y luego el
   secreto; SHA256 de todo eso. Se leen las propiedades del evento en vez de
   fijarlas aquí para no romperse si Wompi añade una. */
function calcularFirma(evento, secreto) {
  const props = (evento.signature && evento.signature.properties) || [];
  const cadena = props
    .map(ruta => ruta.split('.').reduce((o, k) => (o == null ? undefined : o[k]), evento.data))
    .map(v => (v == null ? '' : String(v)))
    .join('');
  return crypto.createHash('sha256')
    .update(`${cadena}${evento.timestamp}${secreto}`)
    .digest('hex');
}

/* Comparación en tiempo constante. Con === , el tiempo que tarda en fallar
   filtra cuánto prefijo acertó quien esté probando firmas. */
function igual(a, b) {
  const x = Buffer.from(String(a), 'utf8');
  const y = Buffer.from(String(b), 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* Cuándo ocurrió el pago, en milisegundos.
 *
 * Wompi manda `timestamp` en SEGUNDOS, como número. Pasarlo por Date.parse()
 * como si fuera una fecha ISO no da error: da una fecha absurda, y Meta descarta
 * en silencio los eventos con más de siete días. Por eso se convierte a mano y
 * se cae a `finalized_at` —esa sí es ISO— y por último al reloj de ahora. */
function cuandoDelEvento(evento, tx) {
  const seg = Number(evento && evento.timestamp);
  if (Number.isFinite(seg) && seg > 0) return seg * 1000;
  const fin = Date.parse((tx && tx.finalized_at) || '');
  return Number.isFinite(fin) ? fin : Date.now();
}

async function reenviar(carga) {
  const url = process.env.PEDIDOS_WEBHOOK;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(carga),
      signal: AbortSignal.timeout(4000),
    });
  } catch (e) {
    console.error('No se pudo reenviar el aviso de pago', carga.referencia, e.message);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Solo POST' };
  }

  const secreto = process.env.WOMPI_EVENTOS;
  if (!secreto) {
    console.error('Falta WOMPI_EVENTOS: no se puede verificar el evento, se descarta');
    /* 200 a propósito: con 500 Wompi reintenta en bucle un evento que no vamos
       a poder verificar hasta que alguien configure la variable. */
    return ok({ recibido: false, motivo: 'sin secreto configurado' });
  }

  let evento;
  try {
    evento = JSON.parse(event.body || '{}');
  } catch (_) {
    return { statusCode: 400, body: 'JSON inválido' };
  }

  const recibida = evento.signature && evento.signature.checksum;
  if (!recibida || !igual(calcularFirma(evento, secreto), recibida)) {
    console.error('Evento con firma que no cuadra — descartado', {
      evento: evento.event,
      referencia: evento.data && evento.data.transaction && evento.data.transaction.reference,
    });
    return { statusCode: 401, body: 'Firma inválida' };
  }

  const tx = (evento.data && evento.data.transaction) || {};
  const registro = {
    evento: 'pago_' + String(tx.status || 'desconocido').toLowerCase(),
    referencia: tx.reference,
    transaccion: tx.id,
    estado: tx.status,                       // APPROVED · DECLINED · VOIDED · ERROR
    metodo: tx.payment_method_type,
    total: typeof tx.amount_in_cents === 'number' ? tx.amount_in_cents / 100 : null,
    correo: tx.customer_email,
    cuando: evento.timestamp,
  };

  /* Queda en los logs de la función pase lo que pase: es el rastro con el que
     se concilia contra el panel de Wompi. */
  console.log(JSON.stringify(registro));

  /* Cierra la reserva que abrió crear-pago.
   *
   * Aprobado: lo apartado pasa a vendido y deja de caducar. Rechazado, anulado
   * o con error: las unidades vuelven al mostrador ya, sin esperar la media
   * hora de vigencia — en una pieza de la que queda una, esa media hora es una
   * venta que no se pudo hacer.
   *
   * Va antes de los correos a propósito: es lo único de este bloque que afecta
   * a otras clientas, y no puede quedarse sin hacer porque Resend tarde. Ambas
   * son idempotentes, así que los reintentos de Wompi no descuentan dos veces. */
  if (registro.referencia) {
    const cierre = tx.status === 'APPROVED'
      ? await confirmar(registro.referencia)
      : await liberar(registro.referencia);
    console.log(JSON.stringify({
      evento: 'inventario_' + cierre.modo, referencia: registro.referencia, estado: registro.estado,
    }));
  }

  /* El `Purchase` que la pauta necesita ver.
   *
   * Aquí es donde consta que alguien pagó de verdad. El pixel de gracias.html
   * dispara su propio Purchase, pero solo si la clienta vuelve al sitio, y
   * volver es opcional: puede cerrar el navegador, quedarse sin datos, o pagar
   * por PSE desde la app del banco y no regresar. Es el mismo razonamiento por
   * el que el correo de confirmación sale de aquí y no de la página de gracias.
   *
   * Los dos eventos se deduplican por `event_id`, que en las dos puntas es la
   * referencia del pedido. _capi.js explica el trato completo.
   *
   * Las señales se recogen pase lo que pase con el pago —tomarSenales() borra
   * al leer—: si se dejaran solo en el camino aprobado, cada pago rechazado
   * dejaría datos de una clienta guardados sin que nadie los recoja.
   *
   * Nada de esto puede tumbar la respuesta a Wompi: enviarPurchase() no lanza,
   * y un evento de marketing perdido no vale un reintento del webhook. */
  if (registro.referencia) {
    const senales = await tomarSenales(registro.referencia);
    if (tx.status === 'APPROVED') {
      const capi = await enviarPurchase({
        referencia: registro.referencia,
        /* El monto que Wompi dice haber cobrado, no el que el sitio calculó:
           es el que de verdad entró. */
        valor: registro.total != null ? registro.total : (senales && senales.total),
        moneda: tx.currency || 'COP',
        cuando: cuandoDelEvento(evento, tx),
        senales,
        sitio: (process.env.URL_SITIO || process.env.URL || '').replace(/\/$/, '') + '/gracias.html',
      });
      console.log(JSON.stringify({
        evento: 'capi_' + capi.modo,
        referencia: registro.referencia,
        /* Queda escrito si el evento salió con señales de atribución o pelado.
           Un Purchase sin fbc no está mal, pero empareja mucho peor, y al
           revisar por qué una campaña no aprende esto es lo primero que mirar. */
        atribucion: senales ? Boolean(senales.fbc || senales.fbp) : false,
      }));
    }
  }

  if (tx.status === 'APPROVED') {
    await reenviar(Object.assign({
      titulo: `Pago aprobado · ${registro.referencia} · ${cop(registro.total || 0)}`,
    }, registro));

    /* El «ya está» que la clienta espera. El primer correo dijo «estamos
       confirmando tu pago»; este cierra esa frase. Sale del webhook y no de la
       página de gracias a propósito: la clienta puede haber cerrado el
       navegador antes de volver, y el pago fue bueno igual.
       Wompi no manda el detalle del pedido en el evento, así que este correo
       confirma el cobro y remite al comprobante anterior por su referencia. */
    if (registro.correo) {
      const t = cop(registro.total || 0);
      await enviar({
        para: registro.correo,
        asunto: `Pago confirmado · ${registro.referencia} · Zephora Charms`,
        html: `<!DOCTYPE html><html lang="es-CO"><head><meta charset="UTF-8">`
          + `<meta name="viewport" content="width=device-width,initial-scale=1"></head>`
          + `<body style="margin:0;background:#F6F3F4">`
          + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px">`
          + `<tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" `
          + `style="max-width:560px;background:#fff;border:1px solid #E4DDE0;border-radius:4px">`
          + `<tr><td style="padding:22px 26px;border-bottom:1px solid #E4DDE0">`
          + `<span style="font:400 19px/1 Georgia,serif;letter-spacing:.13em;text-transform:uppercase;color:#2A1F2E">`
          + `Zephora <i style="color:#5C3D63">Charms</i></span></td></tr>`
          + `<tr><td style="padding:26px">`
          + `<h1 style="margin:0 0 10px;font:400 27px/1.2 Georgia,serif;color:#1F7A5C">¡Pago recibido!</h1>`
          + `<p style="margin:0 0 18px;font:400 15px/1.6 Arial,sans-serif;color:#584a5c">`
          + `Confirmamos tu pago de <b>${t}</b>. Tu pedido entró a preparación y te mandamos `
          + `el número de guía en cuanto lo despachemos.</p>`
          + `<p style="margin:0 0 4px;font:400 12px/1 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#A9A6AE">Referencia</p>`
          + `<p style="margin:0 0 20px;font:400 17px/1.3 monospace;color:#5C3D63;background:#F3E6EB;`
          + `border:1px solid #e9d3dc;border-radius:3px;padding:8px 12px;display:inline-block">${registro.referencia}</p>`
          + `<p style="margin:0;font:400 13.5px/1.6 Arial,sans-serif;color:#6d6070">`
          + `El detalle de las piezas está en el correo anterior, con esta misma referencia.</p>`
          + `</td></tr>`
          + `<tr><td style="padding:0 26px 26px">`
          + `<a href="https://wa.me/573018990672?text=${encodeURIComponent('Hola, Zephora Charms. Escribo por mi pedido ' + registro.referencia + '.')}" `
          + `style="display:block;text-align:center;background:#25806a;color:#fff;text-decoration:none;`
          + `font:400 14px/1 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;`
          + `padding:15px 20px;border-radius:2px">Escribirnos por WhatsApp</a></td></tr>`
          + `<tr><td style="padding:18px 26px 24px;border-top:1px solid #E4DDE0;`
          + `font:400 12px/1.6 Arial,sans-serif;color:#8a8290">`
          + `Zephora Charms · NIT 1.019.151.696-3 · Bogotá D.C., Colombia<br>`
          + `WhatsApp +57 301 899 0672 · zephoracharms@gmail.com</td></tr>`
          + `</table></td></tr></table></body></html>`,
        txt: `¡Pago recibido!\n\nConfirmamos tu pago de ${t}.\n`
          + `Referencia: ${registro.referencia}\n\n`
          + `Tu pedido entró a preparación. Te mandamos el número de guía al despacharlo.\n`
          + `El detalle de las piezas está en el correo anterior, con esta misma referencia.\n\n`
          + `WhatsApp: https://wa.me/573018990672\n`
          + `Zephora Charms · NIT 1.019.151.696-3 · Bogotá D.C., Colombia`,
      });
    }
  }

  /* Siempre 200 cuando el evento es legítimo, incluso si fue un pago rechazado:
     el 200 le dice a Wompi «lo recibí», no «el pago salió bien». Devolver otra
     cosa lo pone a reintentar un evento que ya está procesado. */
  return ok({ recibido: true, referencia: registro.referencia, estado: registro.estado });
};

exports._interno = { calcularFirma, igual, cuandoDelEvento };
