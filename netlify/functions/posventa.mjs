/* El correo de después de la compra: gracias otra vez, ¿cómo te fue?, y un
 * enlace por pieza para dejar la opinión.
 *
 * ── Cuándo ──
 *
 * DIAS_DESPUES días después del pago. No hay fecha de entrega —el aviso de
 * Skydropx nunca se encendió— y no hace falta: se despacha en 2 o 3 días
 * hábiles y el envío tarda de 1 día en Bogotá a 6 hábiles en el resto del país
 * (envios-y-devoluciones.html). En el peor caso —3 días hábiles de despacho y 6
 * de viaje— son unos 12 días calendario, así que a los 12 días ya la tienen
 * casi todas. Empezó en 10 y el propietario lo subió a 12 el mismo día para no
 * escribirle a nadie antes de que le llegue. Un pedido que no llegó se cancela en esos días (anular-venta
 * lo deja en «cancelado», registrar-venta en «anulada») y sale solo de la lista.
 * Decisión del propietario, 2026-10-13.
 *
 * Y no después de DIAS_MAX: el día que esto se publica, los pedidos de agosto no
 * pueden recibir un «¿cómo te fue?» dos meses tarde.
 *
 * ── A quién ──
 *
 * A toda compra pagada o confirmada con correo —no solo a quien marcó la casilla
 * de novedades, a diferencia del rescate—, porque la política de privacidad dice
 * desde el 2026-10-13 que se escribe una vez después de la compra para esto
 * (opción B del propietario). Por eso mismo el correo no vende nada: ni promo,
 * ni piezas nuevas. Una oferta aquí sí necesitaría la casilla.
 *
 * Un solo correo por pedido, nunca un recordatorio. Y si la misma persona tiene
 * dos pedidos en la ventana, un solo correo con las piezas de los dos.
 *
 * ── Sin incentivo ──
 *
 * Decisión del propietario (2026-09-27 y 2026-10-13): no se ofrece nada a
 * cambio de una reseña. Un beneficio atado a las estrellas es publicidad
 * engañosa (Ley 1480), y un sorteo es un juego promocional que regula
 * Coljuegos. Si algún día se agrega uno, tiene que ser igual para cualquier
 * reseña honesta.
 *
 * ── Falla hacia adelante ──
 *
 * Igual que el rescate: si el almacén o Resend fallan, queda en el log y mañana
 * se intenta otra vez, porque solo se marca lo que salió.
 */
import { listar, marcar } from './_pedidos.mjs';
import { enviar, esc } from './_correo.js';
import { nombres, fotos } from './_precios.js';
import { enlaceResena } from './resenas.mjs';

/* Una vez al día, 10:00 en Colombia (15:00 UTC): una hora después del rescate
   y a media mañana, cuando un correo personal se lee. */
export const config = { schedule: '0 15 * * *' };

const DIAS_DESPUES = 12;
const DIAS_MAX = 30;

/* Compras en firme. Las ventas manuales («venta-manual») cuentan salvo los
   regalos: «gracias por tu compra» a quien no compró queda mal. */
const EN_FIRME = new Set(['pagado', 'confirmado', 'venta-manual']);

/* La fecha desde la que se cuenta: el pago si lo hubo en línea, si no la de
   creación —contraentrega y venta manual quedan en firme al crearse—. */
const desde = p => Date.parse((p && (p.pagadoEn || p.creado)) || '');

const correoDe = p => String((p && p.cliente && p.cliente.correo) || '').trim().toLowerCase();

/* Quien pidió que no le escribamos: respondió el correo y el propietario lo
   anotó en POSVENTA_NO_ESCRIBIR (correos separados por coma). */
function excluidos() {
  return new Set(String(process.env.POSVENTA_NO_ESCRIBIR || '')
    .split(',').map(c => c.trim().toLowerCase()).filter(Boolean));
}

/* Las piezas por las que se puede pedir opinión: las que siguen en el catálogo
   —su página existe— y sin repetir. El empaque no es una pieza. */
const piezas = p => [...new Set((p.lineas || []).map(l => l && l.id))]
  .filter(id => id && id !== 'empaque' && nombres[id]);

function elegibles(pedidos, ahora = Date.now(), fuera = new Set()) {
  return pedidos.filter(p => {
    if (!p || !EN_FIRME.has(p.estado)) return false;
    if (p.pago === 'regalo') return false;
    if (p.posventa) return false;
    const correo = correoDe(p);
    if (!correo || fuera.has(correo)) return false;
    if (!piezas(p).length) return false;
    const t = desde(p);
    if (!Number.isFinite(t)) return false;
    const dias = (ahora - t) / 864e5;
    return dias >= DIAS_DESPUES && dias <= DIAS_MAX;
  });
}

/* Un correo por persona: los pedidos de la misma dirección se juntan. */
function agrupar(lista) {
  const grupos = new Map();
  for (const p of lista) {
    const k = correoDe(p);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(p);
  }
  return [...grupos.values()];
}

/* Las tarjetas: foto, nombre y su enlace firmado, que es lo que pone «Compra
   verificada» en la reseña. Sin enlace firmado —falta el secreto— no se manda:
   un enlace sin firma deja la reseña sin chulo y no se puede volver a pedir. */
function tarjetas(grupo, sitio) {
  const vistas = new Set(), lista = [];
  for (const p of grupo) {
    for (const id of piezas(p)) {
      if (vistas.has(id)) continue;
      vistas.add(id);
      const url = enlaceResena(p.referencia, id);
      if (!url) return null;
      lista.push({ id, nombre: nombres[id], url, foto: fotos[id] ? `${sitio}/assets/${fotos[id]}` : null });
    }
  }
  return lista;
}

function correo(grupo, lista) {
  const nombre = String((grupo[0].cliente && grupo[0].cliente.nombre) || '').trim().split(/\s+/)[0] || '';
  const refs = grupo.map(p => p.referencia);
  const pedidoTxt = refs.length === 1 ? `tu pedido ${refs[0]}` : `tus pedidos ${refs.join(' y ')}`;
  const titulo = `${nombre ? esc(nombre) + ', ¿c' : '¿C'}ómo te fue con tu joya?`;

  const filas = lista.map(t =>
    `<tr><td style="padding:12px 0;border-top:1px solid #EFE7EA">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>`
    + (t.foto
      ? `<td width="72" style="padding-right:14px"><img src="${esc(t.foto)}" width="72" height="72" alt="" `
        + `style="display:block;width:72px;height:72px;object-fit:cover;border-radius:3px;background:#F6F3F4"></td>`
      : '')
    + `<td style="font:400 14.5px/1.4 Arial,sans-serif;color:#2A1F2E">${esc(t.nombre)}<br>`
    + `<a href="${esc(t.url)}" style="display:inline-block;margin-top:8px;font:400 13px/1 Arial,sans-serif;`
    + `color:#fff;background:#2A1F2E;text-decoration:none;padding:9px 14px;border-radius:3px">Dejar mi opinión</a>`
    + `</td></tr></table></td></tr>`).join('');

  const html = `<!DOCTYPE html><html lang="es-CO"><head><meta charset="UTF-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1"></head>`
    + `<body style="margin:0;background:#F6F3F4"><table role="presentation" width="100%" `
    + `cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" `
    + `style="max-width:520px;background:#fff;border:1px solid #E4DDE0;border-radius:4px">`
    + `<tr><td style="padding:26px 26px 6px">`
    + `<h1 style="margin:0 0 12px;font:400 23px/1.25 Georgia,serif;color:#2A1F2E">${titulo} 💛</h1>`
    + `<p style="margin:0 0 10px;font:400 14.5px/1.65 Arial,sans-serif;color:#6d6070">`
    + `Gracias otra vez por elegir Zephora Charms para ${esc(pedidoTxt)}.</p>`
    + `<p style="margin:0 0 10px;font:400 14.5px/1.65 Arial,sans-serif;color:#6d6070">`
    + `Ya debe estar contigo, y nos encantaría saber cómo te fue. ¿Te gustó? ¿Te quedó bien la talla?</p>`
    + `<p style="margin:0 0 4px;font:400 14.5px/1.65 Arial,sans-serif;color:#6d6070">`
    + `Si quieres contarlo, puedes dejar tu opinión —con foto, si te animas— en cada pieza. `
    + `Le ayuda muchísimo a quien está eligiendo la suya:</p>`
    + `</td></tr><tr><td style="padding:0 26px">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas}</table>`
    + `</td></tr><tr><td style="padding:18px 26px 24px">`
    + `<p style="margin:0 0 14px;font:400 14.5px/1.65 Arial,sans-serif;color:#2A1F2E">`
    + `Con cariño, el equipo de Zephora Charms ✨</p>`
    + `<p style="margin:0;font:400 12px/1.6 Arial,sans-serif;color:#8a8290;`
    + `border-top:1px solid #EFE7EA;padding-top:14px">`
    + `Te escribimos una sola vez después de tu compra, como dice nuestra política de privacidad. `
    + `Si prefieres que no lo hagamos en tus próximos pedidos, responde a este correo.</p>`
    + `</td></tr></table></td></tr></table></body></html>`;

  const txt = `${nombre ? nombre + ', ¿c' : '¿C'}ómo te fue con tu joya?\n\n`
    + `Gracias otra vez por elegir Zephora Charms para ${pedidoTxt}.\n\n`
    + `Ya debe estar contigo, y nos encantaría saber cómo te fue. ¿Te gustó? ¿Te quedó bien la talla?\n\n`
    + `Si quieres contarlo, puedes dejar tu opinión —con foto, si te animas— en cada pieza. `
    + `Le ayuda muchísimo a quien está eligiendo la suya:\n\n`
    + lista.map(t => `  · ${t.nombre}: ${t.url}`).join('\n')
    + `\n\nCon cariño, el equipo de Zephora Charms ✨\n\n`
    + `Te escribimos una sola vez después de tu compra, como dice nuestra política de privacidad. `
    + `Si prefieres que no lo hagamos en tus próximos pedidos, responde a este correo.\n`;

  return {
    para: grupo[0].cliente.correo.trim(),
    asunto: `${nombre ? nombre + ', ¿c' : '¿C'}ómo te fue con tu joya? · Zephora Charms`,
    html, txt,
  };
}

export default async () => {
  const sitio = (process.env.URL_SITIO || process.env.URL || 'https://zephoracharms.com').replace(/\/$/, '');
  const todos = await listar();
  const lista = elegibles(todos, Date.now(), excluidos());
  const grupos = agrupar(lista);

  console.log(JSON.stringify({ evento: 'posventa', revisados: todos.length,
    pedidos: lista.length, correos: grupos.length }));

  const hoy = new Date().toISOString();
  let enviados = 0;
  /* Uno por uno y sin que un fallo tumbe a los demás: son clientas distintas. */
  await Promise.allSettled(grupos.map(async grupo => {
    const lista = tarjetas(grupo, sitio);
    if (!lista) {
      console.error(JSON.stringify({ evento: 'posventa_sin_firma',
        referencias: grupo.map(p => p.referencia) }));
      return;
    }
    const r = await enviar(correo(grupo, lista));
    if (!r.enviado) {
      console.error(JSON.stringify({ evento: 'posventa_falló',
        referencias: grupo.map(p => p.referencia), motivo: r.motivo }));
      return;
    }
    enviados++;
    await Promise.allSettled(grupo.map(p => marcar(p.referencia, { posventa: hoy })));
  }));

  console.log(JSON.stringify({ evento: 'posventa_enviado', enviados }));
  return new Response('ok', { status: 200 });
};

export const _interno = { elegibles, agrupar, tarjetas, correo, piezas, excluidos,
  DIAS_DESPUES, DIAS_MAX };
