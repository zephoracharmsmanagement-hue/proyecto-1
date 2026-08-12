/* Le escribe a quien se quedó a medio pagar.
 *
 * Corre sola cada quince minutos. Busca pedidos que salieron hacia la pasarela
 * y nunca volvieron con un pago aprobado, y les manda UN correo con lo que
 * habían armado.
 *
 * ── Por qué esto es barato y casi todo estaba hecho ──
 *
 * No hace falta rastrear carritos ni adivinar quién es quién: `crear-pago`
 * conoce nombre, correo, celular y piezas de todo el que llega a la pasarela, y
 * el webhook de Wompi sabe si pagó. Un pedido creado que no se confirma **es**
 * un carrito abandonado con contacto completo. Ver `_pendientes.mjs`.
 *
 * ── Las tres reglas que evitan que esto sea spam ──
 *
 * 1. **Un solo mensaje por pedido.** Se marca antes de mandar; si el envío
 *    falla se pierde el aviso, que es preferible a mandarlo dos veces.
 * 2. **45 minutos de espera.** Un pago por PSE puede tardar; escribirle «no
 *    terminaste» a alguien que está pagando es la peor versión de esto.
 * 3. **Los datos se borran.** A los siete días el registro desaparece, haya
 *    habido mensaje o no.
 *
 * El correo se manda a la dirección que la clienta escribió en el checkout, y
 * habla de SU pedido: es un recordatorio transaccional de algo que ella empezó,
 * no una promoción. No lleva ofertas ni descuentos nuevos por eso mismo — en el
 * momento en que trae una promoción deja de ser transaccional y necesita
 * consentimiento aparte bajo la Ley 1581.
 *
 * ── Falla hacia adelante ──
 *
 * Si Blobs o Resend no responden, se registra y se sale. La próxima corrida lo
 * reintenta con los que sigan sin avisar; nada se rompe y nada se duplica.
 */
import { listar, anotarAviso, toca, caduco, cerrar, ESPERA_MS } from './_pendientes.mjs';
import { enviar } from './_correo.js';
import { cop } from './_precios.js';

/* Cada quince minutos. La espera real la decide ESPERA_MS: esto solo marca cada
   cuánto se mira. Más seguido no sirve de nada y más espaciado retrasa el
   mensaje justo cuando todavía tiene efecto. */
export const config = { schedule: '*/15 * * * *' };

const WA = '573018990672';
const esc = s => String(s == null ? '' : s)
  .replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

function correo(p) {
  const sitio = (process.env.URL_SITIO || process.env.URL || 'https://zephoracharms.com')
    .replace(/\/$/, '');
  const nombre = (p.cliente && p.cliente.nombre) || '';
  const lineas = p.lineas || [];
  const total = (p.cuentas && p.cuentas.total) || 0;

  /* El pago se declinó, que no es lo mismo que haberse ido a medias: ahí la
     clienta sí quiso comprar y fue el banco el que dijo que no. Merece otra
     frase, y sobre todo ofrecerle otro medio de pago. */
  const rechazado = p.estado && p.estado !== 'esperando';

  const wa = `https://wa.me/${WA}?text=` + encodeURIComponent(
    `Hola, Zephora Charms. Quiero terminar mi pedido ${p.referencia}.`);

  const filas = lineas.map(l => `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid #E4DDE0;font:400 14px/1.4 Georgia,serif;color:#2A1F2E">
        ${esc(l.nombre)}${l.talla ? `<br><span style="font-size:12px;color:#8a8290">Talla ${esc(l.talla)} cm</span>` : ''}
      </td>
      <td style="padding:9px 0;border-bottom:1px solid #E4DDE0;text-align:right;font:400 14px/1.4 Georgia,serif;color:#2A1F2E;white-space:nowrap">
        ${esc(cop(l.precio))}
      </td>
    </tr>`).join('');

  const titulo = rechazado ? 'Tu pago no se completó' : 'Tu pulsera te está esperando';
  const entrada = rechazado
    ? 'El banco no aprobó el pago, y eso pasa por mil razones que no tienen que ver contigo. '
      + 'Tu selección sigue guardada: puedes intentar con otro medio o pagar contraentrega.'
    : `${nombre ? nombre + ', a' : 'A'}rmaste esta pulsera y quedó sin terminar. `
      + 'Te la dejamos aquí por si quieres retomarla.';

  const html = `<!DOCTYPE html><html lang="es-CO"><head><meta charset="UTF-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1"></head>`
    + `<body style="margin:0;background:#F6F3F4">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px">`
    + `<tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" `
    + `style="max-width:560px;background:#fff;border:1px solid #E4DDE0;border-radius:4px">`
    + `<tr><td style="padding:22px 26px;border-bottom:1px solid #E4DDE0">`
    + `<span style="font:400 19px/1 Georgia,serif;letter-spacing:.13em;text-transform:uppercase;color:#2A1F2E">`
    + `Zephora <i style="color:#5C3D63">Charms</i></span></td></tr>`
    + `<tr><td style="padding:26px">`
    + `<h1 style="margin:0 0 10px;font:400 27px/1.2 Georgia,serif;color:#5C3D63">${esc(titulo)}</h1>`
    + `<p style="margin:0 0 20px;font:400 15px/1.6 Arial,sans-serif;color:#584a5c">${esc(entrada)}</p>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas}`
    + `<tr><td style="padding:12px 0 0;font:400 15px/1.4 Georgia,serif;color:#2A1F2E">Total</td>`
    + `<td style="padding:12px 0 0;text-align:right;font:400 17px/1.4 Georgia,serif;color:#5C3D63;white-space:nowrap">`
    + `${esc(cop(total))}</td></tr></table>`
    + `<p style="margin:20px 0 0;font:400 13px/1.6 Arial,sans-serif;color:#8a8290">`
    + `Referencia ${esc(p.referencia)}. La disponibilidad de las piezas puede haber cambiado; `
    + `la confirmamos al retomar el pedido.</p>`
    + `</td></tr>`
    + `<tr><td style="padding:0 26px 12px">`
    + `<a href="${sitio}" style="display:block;text-align:center;background:#9E4E68;color:#fff;`
    + `text-decoration:none;font:400 14px/1 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;`
    + `padding:15px 20px;border-radius:2px">Volver a la tienda</a></td></tr>`
    + `<tr><td style="padding:0 26px 26px">`
    + `<a href="${wa}" style="display:block;text-align:center;background:#fff;color:#25806a;`
    + `border:1px solid #25806a;text-decoration:none;font:400 14px/1 Arial,sans-serif;letter-spacing:.08em;`
    + `text-transform:uppercase;padding:14px 20px;border-radius:2px">Terminarlo por WhatsApp</a></td></tr>`
    + `<tr><td style="padding:18px 26px 24px;border-top:1px solid #E4DDE0;`
    + `font:400 12px/1.6 Arial,sans-serif;color:#8a8290">`
    + `Te escribimos una sola vez por este pedido, y no volveremos a hacerlo.<br>`
    + `Zephora Charms · NIT 1.019.151.696-3 · Bogotá D.C., Colombia<br>`
    + `WhatsApp +57 301 899 0672 · zephoracharms@gmail.com</td></tr>`
    + `</table></td></tr></table></body></html>`;

  const txt = [
    titulo, '', entrada, '',
    ...lineas.map(l => `- ${l.nombre}${l.talla ? ` (talla ${l.talla} cm)` : ''}: ${cop(l.precio)}`),
    `Total: ${cop(total)}`, '',
    `Referencia: ${p.referencia}`,
    'La disponibilidad de las piezas puede haber cambiado; la confirmamos al retomar el pedido.', '',
    `Volver a la tienda: ${sitio}`,
    `Terminarlo por WhatsApp: ${wa}`, '',
    'Te escribimos una sola vez por este pedido, y no volveremos a hacerlo.',
    'Zephora Charms · NIT 1.019.151.696-3 · Bogotá D.C., Colombia',
  ].join('\n');

  return { asunto: `${titulo} · ${p.referencia} · Zephora Charms`, html, txt };
}

export default async () => {
  const ahora = Date.now();
  const todos = await listar();

  let avisados = 0;
  let borrados = 0;
  let fallidos = 0;

  for (const p of todos) {
    /* Primero la limpieza: un registro caducado se borra aunque nunca se le
       escribiera. Son datos personales de alguien que no compró. */
    if (caduco(p, ahora)) {
      await cerrar(p.referencia);
      borrados++;
      continue;
    }

    if (!toca(p, ahora)) continue;

    /* Se marca ANTES de mandar. Si Resend falla, este pedido se queda sin
       mensaje; mandarlo dos veces sería peor. */
    if (!(await anotarAviso(p.referencia))) continue;

    const { asunto, html, txt } = correo(p);
    const r = await enviar({ para: p.cliente.correo, asunto, html, txt });
    if (r.enviado) avisados++;
    else fallidos++;
  }

  /* Queda en el log de la función programada: es la única forma de ver si esto
     está haciendo algo, porque nadie mira un correo que sale solo. */
  console.log(JSON.stringify({
    evento: 'recuperacion_carritos',
    revisados: todos.length, avisados, borrados, fallidos,
    esperaMin: ESPERA_MS / 60000,
  }));

  return new Response(JSON.stringify({ revisados: todos.length, avisados, borrados, fallidos }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};

export const _interno = { correo };
