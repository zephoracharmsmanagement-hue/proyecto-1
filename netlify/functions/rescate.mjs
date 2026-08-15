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
 * ── Por qué avisa a la tienda y no le escribe a la clienta ──
 *
 * Es la decisión importante de esta pieza y conviene no deshacerla sin pensarlo.
 *
 * Escribirle automáticamente a alguien que dejó sus datos **para comprar** y no
 * para recibir mensajes es terreno resbaladizo bajo la Ley 1581: la finalidad
 * autorizada era la compra. Y en esta tienda la venta se cierra hablando —el
 * proyecto entero está montado sobre eso—, así que un mensaje escrito por el
 * propietario, con su tono y respondiendo dudas, recupera más que un automático.
 *
 * Así que el trabajo que se automatiza es el de *encontrarlos*, que es el que
 * no se hace nunca. Escribir sigue siendo de la tienda.
 *
 * ── Falla hacia adelante ──
 *
 * Si el almacén no responde o Resend falla, se registra y ya. Esto es una
 * ayuda, no parte del cobro: nunca puede tumbar nada.
 */
import { listar, marcar } from './_pedidos.mjs';
import { enviar } from './_correo.js';
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
  const para = process.env.CORREO_TIENDA;
  if (!para) {
    console.error('rescate: sin CORREO_TIENDA, no hay a quién avisar');
    return new Response('sin destinatario', { status: 200 });
  }

  const todos = await listar();
  const lista = rescatables(todos);

  console.log(JSON.stringify({
    evento: 'rescate', revisados: todos.length, rescatables: lista.length,
  }));

  if (!lista.length) return new Response('nada que rescatar', { status: 200 });

  const { html, txt } = cuerpo(lista);
  const r = await enviar({
    para,
    asunto: `${lista.length} ${lista.length === 1 ? 'pedido quedó' : 'pedidos quedaron'} sin pagar · Zephora Charms`,
    html, txt,
  });

  /* Solo se marcan si el correo salió. Si Resend falló, mañana vuelven a
     aparecer en la lista en vez de perderse por un fallo de correo. */
  if (r.enviado) {
    const hoy = new Date().toISOString();
    await Promise.allSettled(lista.map(p => marcar(p.referencia, { rescateAvisado: hoy })));
  }

  console.log(JSON.stringify({ evento: 'rescate_avisado', enviado: r.enviado, motivo: r.motivo || null }));
  return new Response('ok', { status: 200 });
};

export const _interno = { rescatables, enlaceWa, cuerpo, HORAS_MIN, DIAS_MAX };
