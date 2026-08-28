/* Rescate de checkouts abandonados.
 *
 * ── Qué recupera ──
 *
 * Una clienta que llegó al final del checkout —escribió nombre, celular,
 * correo y dirección, eligió sus piezas— y no llegó a pagar es la persona más
 * caliente que tiene la tienda. Hoy se perdía en silencio: el pedido quedaba en
 * `esperando-pago` en el registro y nadie volvía a mirarlo.
 *
 * Esto corre una vez al día, los busca, y le manda a la tienda un correo con la
 * lista y un enlace de WhatsApp listo para tocar.
 *
 * ── A quién le escribe la tienda y a quién le escribimos nosotros ──
 *
 * Es la decisión importante de esta pieza y conviene no deshacerla sin pensarlo.
 * Los pedidos se parten en dos grupos, y la línea la traza la propia clienta:
 *
 *   · **Marcó la casilla de comunicaciones** en el checkout → se le manda un
 *     correo automático con el enlace para retomar su pedido. Ella autorizó que
 *     le escribiéramos por algo que no fuera este pedido, así que se puede.
 *   · **No la marcó** → no se le escribe nada automático, nunca. La tienda
 *     recibe el aviso con un enlace de WhatsApp y una persona decide. Responder
 *     por un pedido a medias entra en la finalidad de la compra; un automático
 *     de recuperación ya no está tan claro, y la casilla existe precisamente
 *     para no tener que adivinarlo.
 *
 * Bajo la Ley 1581 la finalidad que autoriza los datos de un pedido es la
 * compra. Por eso la casilla va sin marcar y sin condicionar la venta: una
 * premarcada no es consentimiento. Y por eso este archivo la respeta al pie de
 * la letra en vez de tratarla como un detalle de formulario.
 *
 * Lo que no cambia: en esta tienda la venta se cierra hablando, así que para
 * quien no autorizó, un mensaje del propietario con su tono recupera más que
 * cualquier automático. El trabajo que se automatiza ahí sigue siendo el de
 * *encontrarlos*, que es el que no se hace nunca.
 *
 * ── Falla hacia adelante ──
 *
 * Si el almacén no responde o Resend falla, se registra y ya. Esto es una
 * ayuda, no parte del cobro: nunca puede tumbar nada.
 */
import { listar, marcar } from './_pedidos.mjs';
import { enviar, correoTienda, recuperarCarrito } from './_correo.js';
import { cop } from './_precios.js';

/* Una vez al día, 9:00 en Colombia (14:00 UTC). Por la mañana, que es cuando
   una clienta que abandonó anoche todavía se acuerda de lo que estaba armando. */
export const config = { schedule: '0 14 * * *' };

/* Antes de dos horas no se toca: puede estar todavía en la pasarela, o
   habiendo ido por el celular a mirar el saldo. Escribirle en ese momento es
   interrumpir una compra que iba a ocurrir sola.

   Después de siete días deja de tener sentido: el carrito ya no está, los
   precios pueden haber cambiado, y un mensaje sobre algo de hace una semana
   se lee como vigilancia y no como servicio. */
const HORAS_MIN = 2;
const DIAS_MAX = 7;

const WA = '573018990672';

/* Cuáles hay que rescatar. Separado del envío para poder probarlo sin correo
   ni almacén: es donde está toda la decisión. */
function rescatables(pedidos, ahora = Date.now()) {
  return pedidos.filter(p => {
    if (!p || p.estado !== 'esperando-pago') return false;
    /* Ya se avisó de este: la lista es de trabajo pendiente, no un recordatorio
       diario de lo mismo. Un correo que repite lo de ayer se deja de abrir. */
    if (p.rescateAvisado) return false;
    if (!p.cliente || !p.cliente.celular) return false;
    const creado = Date.parse(p.creado || '');
    if (!Number.isFinite(creado)) return false;
    const horas = (ahora - creado) / 36e5;
    return horas >= HORAS_MIN && horas <= DIAS_MAX * 24;
  }).sort((a, b) => Date.parse(b.creado) - Date.parse(a.creado));
}

/* Quién autorizó que le escribiéramos. Se mira `=== true` y no un valor
   blandito: un pedido viejo, de antes de que existiera la casilla, no trae el
   campo — y `undefined` tiene que caer del lado de «no autorizó», nunca al
   revés. Un permiso que se da solo por ausencia de dato no es un permiso. */
const autorizo = p => !!(p && p.cliente && p.cliente.optin === true);

/* Y a quién se le puede mandar de verdad.
 *
 * Sin correo no hay a dónde. Y `rescateCliente` va aquí y no en `rescatables()`
 * por una razón concreta: los dos canales se marcan por separado, así que si el
 * aviso a la tienda falla un día, mañana la lista vuelve a salir entera —eso es
 * lo que queremos, el propietario no puede perderse esos pedidos— pero a la
 * clienta que ya recibió el suyo no se le puede escribir otra vez por ese
 * fallo. Dos correos iguales con un día de diferencia es exactamente la clase
 * de automático que hace que la gente deje de abrir los correos de una tienda. */
const alcanzable = p => autorizo(p)
  && !!(p.cliente.correo || '').trim()
  && !p.rescateCliente;

const esc = s => String(s == null ? '' : s)
  .replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

/* El enlace que el propietario toca para escribirle. Lleva la referencia para
   que la clienta sepa de qué se le habla, y no pide nada: recuerda y ofrece
   ayuda. Que el pedido sigue armado es cierto —está en el registro— y es la
   razón por la que este mensaje funciona. */
function enlaceWa(p) {
  const nombre = (p.cliente && p.cliente.nombre) || '';
  const texto = `Hola ${nombre}, te escribo de Zephora Charms. `
    + `Vi que dejaste tu pedido ${p.referencia} armado pero el pago no alcanzó a `
    + `completarse. Lo tengo guardado tal cual: ¿te ayudo a terminarlo?`;
  return `https://wa.me/${WA}?text=${encodeURIComponent(texto)}`;
}

function cuerpo(lista) {
  const filas = lista.map(p => {
    const c = p.cliente || {};
    const piezas = (p.lineas || []).map(l =>
      `${esc(l.nombre)}${l.talla ? ` (talla ${esc(l.talla)})` : ''}${l.unidades > 1 ? ` ×${l.unidades}` : ''}`
    ).join(', ');
    const cuando = new Date(p.creado).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
    const total = p.cuentas ? cop(p.cuentas.total) : '—';
    return `<tr><td style="padding:12px 0;border-top:1px solid #E4DDE0;font:400 14px/1.6 Arial,sans-serif;color:#2A1F2E">`
      + `<b>${esc(c.nombre)} ${esc(c.apellido)}</b> · ${esc(total)}<br>`
      + `<span style="color:#6d6070">${piezas || 'sin detalle'}</span><br>`
      + `<span style="color:#8a8290;font-size:12.5px">${esc(p.referencia)} · ${esc(cuando)} · `
      + `${esc(c.ciudad)}, ${esc(c.depto)}</span><br>`
      /* Lo que de verdad necesita saber quien lee esto es si ya se le escribió,
         no si podría escribírsele: sin eso, el propietario manda un WhatsApp a
         quien acaba de recibir el correo automático y el mensaje llega doble.
         Por eso la insignia dice lo que pasó, no lo que estaba permitido. */
      + (p.correoEnviado
        ? `<span style="display:inline-block;margin-top:4px;font:400 11.5px/1 Arial,sans-serif;`
          + `color:#1F7A5C;background:#E8F4EF;padding:5px 8px;border-radius:2px">`
          + `Ya le llegó el correo automático — escribir solo si hace falta</span><br>`
        : `<span style="display:inline-block;margin-top:4px;font:400 11.5px/1 Arial,sans-serif;`
          + `color:#8d5b2f;background:#f7efe6;padding:5px 8px;border-radius:2px">`
          + `Sin autorización: solo tú puedes escribirle</span><br>`)
      + `<a href="${enlaceWa(p)}" style="display:inline-block;margin-top:8px;background:#25806a;`
      + `color:#fff;text-decoration:none;font:400 13px/1 Arial,sans-serif;padding:10px 16px;`
      + `border-radius:2px">Escribirle por WhatsApp</a>`
      + `</td></tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="es-CO"><head><meta charset="UTF-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1"></head>`
    + `<body style="margin:0;background:#F6F3F4"><table role="presentation" width="100%" `
    + `cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" `
    + `style="max-width:560px;background:#fff;border:1px solid #E4DDE0;border-radius:4px">`
    + `<tr><td style="padding:24px 26px">`
    + `<h1 style="margin:0 0 6px;font:400 24px/1.2 Georgia,serif;color:#2A1F2E">`
    + `${lista.length} ${lista.length === 1 ? 'pedido quedó' : 'pedidos quedaron'} sin pagar</h1>`
    + `<p style="margin:0 0 4px;font:400 14px/1.6 Arial,sans-serif;color:#6d6070">`
    + `Llegaron hasta el final del checkout y no completaron el pago. `
    + `Escribirles el mismo día es lo que más los recupera.</p>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas}</table>`
    + `</td></tr></table></td></tr></table></body></html>`;

  const txt = `${lista.length} pedido(s) sin pagar\n\n` + lista.map(p => {
    const c = p.cliente || {};
    return `${p.referencia} · ${c.nombre} ${c.apellido} · ${p.cuentas ? cop(p.cuentas.total) : '—'}\n`
      + `  ${(p.lineas || []).map(l => l.nombre).join(', ')}\n`
      + `  WhatsApp: ${enlaceWa(p)}\n`;
  }).join('\n');

  return { html, txt };
}

export default async () => {
  /* Mismo destinatario por defecto que la hoja de despacho: sin la variable,
     esto se rendía y los carritos abandonados del día no los veía nadie —y a
     diferencia de un correo tardío, ese aviso no se recupera al día siguiente
     porque los pedidos ya salieron de la ventana de 7 días. */
  const { para } = correoTienda();

  const sitio = (process.env.URL_SITIO || process.env.URL || '').replace(/\/$/, '');

  const todos = await listar();
  const lista = rescatables(todos);

  console.log(JSON.stringify({
    evento: 'rescate', revisados: todos.length, rescatables: lista.length,
    conPermiso: lista.filter(alcanzable).length,
  }));

  if (!lista.length) return new Response('nada que rescatar', { status: 200 });

  /* Primero el correo a la clienta, y solo a quien autorizó.
   *
   * Va antes que el aviso a la tienda para que ese aviso pueda decir a quién ya
   * se le escribió — si fuera al revés, el propietario leería una lista sin
   * saber cuáles están atendidas y escribiría encima.
   *
   * Uno por uno y sin dejar que un fallo tumbe a los demás: son clientas
   * distintas y el correo de una no puede depender de que el de otra saliera. */
  const hoy = new Date().toISOString();
  const enviados = await Promise.allSettled(
    lista.filter(alcanzable).map(async p => {
      const r = await recuperarCarrito({
        referencia: p.referencia, lineas: p.lineas, cuentas: p.cuentas,
        cliente: p.cliente, sitio,
      });
      if (r.enviado) {
        p.correoEnviado = true;
        await marcar(p.referencia, { rescateCliente: hoy });
      } else {
        console.error(JSON.stringify({
          evento: 'rescate_cliente_falló', referencia: p.referencia, motivo: r.motivo,
        }));
      }
      return r.enviado;
    })
  );
  const aClientas = enviados.filter(r => r.status === 'fulfilled' && r.value).length;

  const { html, txt } = cuerpo(lista);
  const r = await enviar({
    para,
    asunto: `${lista.length} ${lista.length === 1 ? 'pedido quedó' : 'pedidos quedaron'} sin pagar · Zephora Charms`,
    html, txt,
  });

  /* Los dos canales se marcan por separado a propósito. Si el aviso a la tienda
     falla, mañana vuelve a salir la lista —eso está bien— pero a las clientas
     que ya recibieron el suyo no se les puede volver a escribir por eso: el
     `rescateCliente` de arriba ya quedó puesto y `rescatables()` las saca por
     `rescateAvisado`… que aún no está. De ahí que el filtro mire los dos. */
  if (r.enviado) {
    await Promise.allSettled(lista.map(p => marcar(p.referencia, { rescateAvisado: hoy })));
  }

  console.log(JSON.stringify({
    evento: 'rescate_avisado', enviado: r.enviado, motivo: r.motivo || null,
    aClientas,
  }));
  return new Response('ok', { status: 200 });
};

export const _interno = { rescatables, enlaceWa, cuerpo, autorizo, alcanzable,
  HORAS_MIN, DIAS_MAX };
