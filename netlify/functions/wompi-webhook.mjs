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
import crypto from 'node:crypto';
import { cerrarPago } from './_cierre.mjs';

const ok = (cuerpo) => new Response(JSON.stringify(cuerpo || { recibido: true }),
  { status: 200, headers: { 'Content-Type': 'application/json' } });

const texto = (codigo, mensaje) => new Response(mensaje, { status: codigo });

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

export default async (req) => {
  if (req.method !== 'POST') {
    return texto(405, 'Solo POST');
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
    evento = JSON.parse((await req.text()) || '{}');
  } catch (_) {
    return texto(400, 'JSON inválido');
  }

  const recibida = evento.signature && evento.signature.checksum;
  if (!recibida || !igual(calcularFirma(evento, secreto), recibida)) {
    console.error('Evento con firma que no cuadra — descartado', {
      evento: evento.event,
      referencia: evento.data && evento.data.transaction && evento.data.transaction.reference,
    });
    return texto(401, 'Firma inválida');
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

  /* Lo que sigue —reserva, estado del pedido, Purchase, hoja, avisos y el
     correo de «pago recibido»— lo comparte con addi-callback: ver _cierre.mjs.
     Del evento de Wompi se saca lo que haya para emparejar en Meta: el correo
     viene siempre, el teléfono y el nombre solo a veces. */
  const cd = tx.customer_data || {};
  await cerrarPago(Object.assign({}, registro, {
    aprobado: tx.status === 'APPROVED',
    telefono: cd.phone_number || cd.phone || null,
    nombre: cd.full_name || cd.fullName || null,
    cuandoMs: evento.timestamp ? evento.timestamp * 1000 : null,
    medio: 'wompi',
  }));

  /* Siempre 200 cuando el evento es legítimo, incluso si fue un pago rechazado:
     el 200 le dice a Wompi «lo recibí», no «el pago salió bien». Devolver otra
     cosa lo pone a reintentar un evento que ya está procesado. */
  return ok({ recibido: true, referencia: registro.referencia, estado: registro.estado });
};

export const _interno = { calcularFirma, igual };
