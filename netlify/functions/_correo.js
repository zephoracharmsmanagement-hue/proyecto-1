'use strict';
/* El correo que la clienta recibe después de comprar.
 *
 * Hasta ahora, quien pagaba $250.000 en la web no recibía absolutamente nada:
 * ni comprobante, ni número de pedido, ni a dónde escribir. Ese silencio, en
 * una tienda que la clienta acaba de conocer, produce más ansiedad que la que
 * ahorran todos los sellos de seguridad juntos — y termina en un mensaje de
 * WhatsApp preguntando «¿sí me llegó el pago?» que hay que responder a mano.
 *
 * Se manda por Resend (https://resend.com), que en su plan gratuito cubre de
 * sobra el volumen de la tienda. Variables de entorno:
 *   RESEND_API_KEY    re_… — la llave de la cuenta
 *   CORREO_DESDE      "Zephora Charms <pedidos@zephoracharms.com>"
 *   CORREO_TIENDA     a dónde llega la copia interna (zephoracharms@gmail.com)
 *
 * Sin RESEND_API_KEY no se manda nada y no se rompe nada: el pedido sigue su
 * curso. Un correo que no sale es molesto; una venta que se cae porque el
 * proveedor de correo estaba lento, no se perdona.
 */
const { cop } = require('./_precios');

const WA = '573018990672';
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, m => ESC[m]);

/* Sin imágenes ni fuentes externas: los clientes de correo bloquean lo remoto
   por defecto, y una plantilla que depende de eso llega rota. Tabla y estilos
   en línea porque Gmail descarta el <style> del <head>. */
function plantilla({ titulo, entrada, referencia, lineas, envio, envioGratis, total, pago, cliente, pasos }) {
  const fila = l => `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid #E4DDE0;font:400 14px/1.4 Georgia,serif;color:#2A1F2E">
        ${esc(l.nombre)}${l.talla ? `<br><span style="font-size:12px;color:#8a8290">Talla ${esc(l.talla)} cm</span>` : ''}
      </td>
      <td style="padding:9px 0;border-bottom:1px solid #E4DDE0;text-align:right;font:400 14px/1.4 Georgia,serif;color:#2A1F2E;white-space:nowrap">
        ${esc(cop(l.precio))}
      </td>
    </tr>`;

  const paso = (t, i) => `
    <tr><td style="padding:6px 0;font:400 14px/1.55 Arial,sans-serif;color:#584a5c">
      <b style="color:#5C3D63">${i + 1}.</b> ${esc(t)}
    </td></tr>`;

  return `<!DOCTYPE html>
<html lang="es-CO"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title></head>
<body style="margin:0;padding:0;background:#F6F3F4">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F3F4;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #E4DDE0;border-radius:4px">

  <tr><td style="padding:22px 26px;border-bottom:1px solid #E4DDE0">
    <span style="font:400 19px/1 Georgia,serif;letter-spacing:.13em;text-transform:uppercase;color:#2A1F2E">
      Zephora <i style="color:#5C3D63">Charms</i></span>
  </td></tr>

  <tr><td style="padding:26px 26px 6px">
    <h1 style="margin:0 0 10px;font:400 27px/1.2 Georgia,serif;color:#2A1F2E">${esc(titulo)}</h1>
    <p style="margin:0 0 18px;font:400 15px/1.6 Arial,sans-serif;color:#584a5c">${esc(entrada)}</p>
    <p style="margin:0 0 4px;font:400 12px/1 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#A9A6AE">Tu referencia</p>
    <p style="margin:0 0 20px;font:400 17px/1.3 monospace;color:#5C3D63;background:#F3E6EB;border:1px solid #e9d3dc;border-radius:3px;padding:8px 12px;display:inline-block">${esc(referencia)}</p>
  </td></tr>

  <tr><td style="padding:0 26px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${lineas.map(fila).join('')}
      <tr>
        <td style="padding:9px 0;font:400 14px/1.4 Arial,sans-serif;color:#6d6070">Envío</td>
        <td style="padding:9px 0;text-align:right;font:400 14px/1.4 Arial,sans-serif;color:${envioGratis ? '#1F7A5C' : '#2A1F2E'}">
          ${envioGratis ? 'Gratis' : esc(cop(envio))}</td>
      </tr>
      <tr>
        <td style="padding:14px 0 0;border-top:2px solid #2A1F2E;font:400 12px/1 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#A9A6AE">Total</td>
        <td style="padding:14px 0 0;border-top:2px solid #2A1F2E;text-align:right;font:400 25px/1.1 Georgia,serif;color:#2A1F2E">${esc(cop(total))}</td>
      </tr>
      <tr><td colspan="2" style="padding:6px 0 0;font:400 13px/1.5 Arial,sans-serif;color:#6d6070">
        ${pago === 'contraentrega' ? 'Pago contraentrega — pagas al recibir' : 'Pagado por adelantado'}
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:24px 26px 0">
    <p style="margin:0 0 6px;font:400 12px/1 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#A9A6AE">Enviamos a</p>
    <p style="margin:0;font:400 14px/1.6 Arial,sans-serif;color:#2A1F2E">
      ${esc(cliente.nombre + ' ' + cliente.apellido)}<br>
      ${esc(cliente.direccion)}${cliente.adicional ? ', ' + esc(cliente.adicional) : ''}<br>
      ${cliente.barrio ? esc(cliente.barrio) + ' · ' : ''}${esc(cliente.ciudad)}, ${esc(cliente.depto)}<br>
      ${esc(cliente.celular)}
    </p>
  </td></tr>

  ${pasos && pasos.length ? `
  <tr><td style="padding:22px 26px 0">
    <p style="margin:0 0 6px;font:400 12px/1 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#A9A6AE">Qué sigue</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${pasos.map(paso).join('')}</table>
  </td></tr>` : ''}

  <tr><td style="padding:24px 26px">
    <a href="https://wa.me/${WA}?text=${encodeURIComponent('Hola, Zephora Charms. Escribo por mi pedido ' + referencia + '.')}"
       style="display:block;text-align:center;background:#25806a;color:#fff;text-decoration:none;
              font:400 14px/1 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;
              padding:15px 20px;border-radius:2px">Escribirnos por WhatsApp</a>
  </td></tr>

  <tr><td style="padding:18px 26px 24px;border-top:1px solid #E4DDE0">
    <p style="margin:0 0 6px;font:400 12px/1.6 Arial,sans-serif;color:#8a8290">
      Zephora Charms · NIT 1.019.151.696-3 · Bogotá D.C., Colombia<br>
      WhatsApp +57 301 899 0672 · zephoracharms@gmail.com
    </p>
    <p style="margin:0;font:400 11.5px/1.6 Arial,sans-serif;color:#A9A6AE">
      Recibes este correo porque hiciste un pedido en zephoracharms.com.
      Tienes 5 días hábiles de retracto desde la entrega.
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

/* Versión en texto plano. No es un adorno: sin ella, varios filtros marcan el
   correo como sospechoso, y un comprobante de compra en spam es un comprobante
   que no existe. */
function texto({ titulo, entrada, referencia, lineas, envio, envioGratis, total, pago, cliente }) {
  const l = lineas.map(x => `- ${x.nombre}${x.talla ? ` (talla ${x.talla} cm)` : ''}: ${cop(x.precio)}`);
  return [
    titulo, '', entrada, '',
    `Referencia: ${referencia}`, '',
    ...l,
    `Envío: ${envioGratis ? 'Gratis' : cop(envio)}`,
    `Total: ${cop(total)} (${pago === 'contraentrega' ? 'contraentrega' : 'pagado por adelantado'})`, '',
    'Enviamos a:',
    `${cliente.nombre} ${cliente.apellido}`,
    `${cliente.direccion}${cliente.adicional ? ', ' + cliente.adicional : ''}`,
    `${cliente.ciudad}, ${cliente.depto}`,
    cliente.celular, '',
    `WhatsApp: https://wa.me/${WA}`,
    'Zephora Charms · NIT 1.019.151.696-3 · Bogotá D.C., Colombia',
  ].join('\n');
}

async function enviar({ para, asunto, html, txt, responder }) {
  const llave = process.env.RESEND_API_KEY;
  if (!llave) {
    console.log('Sin RESEND_API_KEY: no se manda correo a', para);
    return { enviado: false, motivo: 'sin configurar' };
  }
  const desde = process.env.CORREO_DESDE || 'Zephora Charms <pedidos@zephoracharms.com>';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: desde, to: [para], subject: asunto, html, text: txt,
        reply_to: responder || process.env.CORREO_TIENDA || undefined,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      console.error('Resend respondió', r.status, (await r.text()).slice(0, 300));
      return { enviado: false, motivo: 'error ' + r.status };
    }
    return { enviado: true };
  } catch (e) {
    console.error('No se pudo mandar el correo a', para, e.message);
    return { enviado: false, motivo: e.message };
  }
}

/* Confirmación de pedido recibido. Para contraentrega es el comprobante final;
   para pago en línea es el «lo estamos esperando» previo al pago aprobado. */
async function pedidoRecibido({ referencia, lineas, cuentas, pago, cliente }) {
  const contra = pago === 'contraentrega';
  const datos = {
    titulo: contra ? 'Pedido confirmado' : 'Recibimos tu pedido',
    entrada: contra
      ? 'Lo estamos preparando. Pagas en efectivo cuando el mensajero te lo entregue.'
      : 'Estamos confirmando tu pago. En cuanto quede aprobado te escribimos otra vez.',
    referencia, lineas,
    envio: cuentas.envio, envioGratis: cuentas.envioGratis, total: cuentas.total,
    pago, cliente,
    pasos: contra
      ? ['Te escribimos por WhatsApp para confirmar existencias y la talla.',
        'Despachamos por Inter Rapidísimo y te mandamos el número de guía.',
        'Pagas al mensajero al recibir. Entre 1 y 6 días hábiles según el destino.']
      : ['Si el pago quedó aprobado, te llega un segundo correo confirmándolo.',
        'Te escribimos por WhatsApp si hace falta ajustar la talla.',
        'Despachamos por Inter Rapidísimo con número de guía.'],
  };
  return enviar({
    para: cliente.correo,
    asunto: `${datos.titulo} · ${referencia} · Zephora Charms`,
    html: plantilla(datos), txt: texto(datos),
  });
}

/* Copia interna, para no depender de mirar el panel de Wompi. */
async function avisoTienda({ referencia, lineas, cuentas, pago, cliente }) {
  const para = process.env.CORREO_TIENDA;
  if (!para) return { enviado: false, motivo: 'sin CORREO_TIENDA' };
  const datos = {
    titulo: 'Pedido nuevo',
    entrada: `${pago === 'contraentrega' ? 'Contraentrega' : 'Pago en línea'} · `
      + `${cliente.ciudad}, ${cliente.depto}`,
    referencia, lineas,
    envio: cuentas.envio, envioGratis: cuentas.envioGratis, total: cuentas.total,
    pago, cliente, pasos: null,
  };
  return enviar({
    para,
    asunto: `Pedido ${referencia} · ${cop(cuentas.total)} · ${pago === 'contraentrega' ? 'CONTRAENTREGA' : 'en línea'}`,
    html: plantilla(datos), txt: texto(datos),
    responder: cliente.correo,
  });
}

module.exports = { enviar, plantilla, texto, pedidoRecibido, avisoTienda };
