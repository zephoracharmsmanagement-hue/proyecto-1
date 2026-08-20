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

/* A dónde va la hoja de despacho cuando `CORREO_TIENDA` no está.
 *
 * Ha faltado dos veces. La primera dejó a la tienda sin copia de ningún pedido;
 * la segunda tiró a la basura la hoja de despacho del pedido de prueba
 * ZC-260816-9561CFF4 —el comprobante de la clienta salió bien, así que Resend
 * estaba perfecto— y solo se supo leyendo el log. Siempre igual: la venta pasa,
 * nada da error, y lo que se pierde es lo que hacía falta para despachar.
 *
 * «Falla hacia adelante» es correcto para no tumbar una venta, pero aquí estaba
 * mal aplicado: no mandar el correo no salva ninguna venta, solo pierde el
 * pedido. Así que hay destinatario por defecto. No es ningún secreto —esta
 * misma dirección va en el pie de todos los correos a clientas, unas líneas más
 * abajo— y una variable de entorno no debería ser lo único que separe a la
 * tienda de saber qué tiene que empacar.
 *
 * La variable sigue mandando cuando está: cambiar el buzón no exige tocar
 * código. El `.trim()` es por el espacio que se cuela al pegar un valor.
 */
const TIENDA_POR_DEFECTO = 'zephoracharms@gmail.com';
function correoTienda() {
  const puesta = String(process.env.CORREO_TIENDA || '').trim();
  if (puesta) return { para: puesta, defecto: false };
  console.error('CORREO_TIENDA no está puesta: la copia interna sale a '
    + `${TIENDA_POR_DEFECTO} por defecto. Ponla en Netlify (Scopes: Functions).`);
  return { para: TIENDA_POR_DEFECTO, defecto: true };
}

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
        reply_to: responder || correoTienda().para,
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

/* ——— La hoja de despacho ———
 *
 * La copia interna era el recibo de la clienta con otro título, y eso costó un
 * producto: alguien pidió que se lo entregaran en un local concreto, lo escribió
 * en «Indicaciones para la entrega», y ese campo no se imprimía en ninguna parte.
 * El pedido salió sin la indicación. La tienda tuvo que ir a leer los datos al
 * panel de Resend, que es el sitio donde nadie mira cuando está empacando.
 *
 * Los dos correos tienen trabajos distintos: el de la clienta es un comprobante
 * —dice qué compró y cuánto pagó—; el de la tienda es una orden de trabajo —dice
 * qué meter en la caja, qué escribir a mano y qué poner en la guía—. Por eso
 * dejan de compartir plantilla.
 *
 * La regla que sostiene esto: **ningún dato que la clienta escriba puede
 * quedarse sin imprimir.** Lo vigila `pruebas/correo-tienda.js`, que rellena
 * todos los campos que acepta `crear-pago` y comprueba que cada uno aparezca en
 * el correo. Si mañana el formulario gana un campo y esta plantilla no, sale en
 * rojo — que es justo lo que no pasó la vez que se perdió el pedido.
 */
const BLOQUE = (rotulo, valor, destacado) => !valor ? '' : `
  <tr><td style="padding:0 26px 14px">
    <p style="margin:0 0 4px;font:400 12px/1 Arial,sans-serif;letter-spacing:.12em;
       text-transform:uppercase;color:${destacado ? '#B03A48' : '#A9A6AE'}">${esc(rotulo)}</p>
    <p style="margin:0;font:400 ${destacado ? '15' : '14'}px/1.6 Arial,sans-serif;color:#2A1F2E;
       ${destacado ? 'background:#FDF1F2;border-left:3px solid #B03A48;padding:10px 12px' : ''}">${valor}</p>
  </td></tr>`;

function plantillaTienda({ referencia, lineas, cuentas, pago, cliente, pagado }) {
  const contra = pago === 'contraentrega';
  const piezas = lineas.map(l =>
    `• ${esc(l.nombre)}${l.talla ? ` — <b>talla ${esc(l.talla)} cm</b>` : ''}`
    + `${l.unidades > 1 ? ` — <b>×${l.unidades}</b>` : ''}`).join('<br>');
  const direccion = [
    esc(cliente.direccion) + (cliente.adicional ? ', ' + esc(cliente.adicional) : ''),
    cliente.barrio ? 'Barrio ' + esc(cliente.barrio) : '',
    esc(cliente.ciudad) + ', ' + esc(cliente.depto),
  ].filter(Boolean).join('<br>');
  const contacto = `${esc(cliente.nombre)} ${esc(cliente.apellido)}<br>`
    + `${esc(cliente.tipodoc)} ${esc(cliente.documento)}<br>`
    + `Cel. ${esc(cliente.celular)}<br>${esc(cliente.correo)}`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#F6F3F4">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F3F4">
<tr><td align="center" style="padding:20px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="max-width:560px;background:#fff;border:1px solid #E4DDE0">

  ${pagado ? `
  <tr><td style="padding:14px 26px;background:#1F7A5C">
    <p style="margin:0;font:400 15px/1.4 Arial,sans-serif;color:#fff">
      <b>PAGO CONFIRMADO</b> — ya se puede despachar</p>
  </td></tr>` : ''}

  <tr><td style="padding:20px 26px 4px">
    <p style="margin:0;font:400 12px/1 Arial,sans-serif;letter-spacing:.14em;
       text-transform:uppercase;color:#A9A6AE">${pagado ? 'Listo para despachar' : 'Pedido nuevo · para despachar'}</p>
    <p style="margin:6px 0 0;font:400 24px/1.2 Georgia,serif;color:#2A1F2E">${esc(referencia)}</p>
    <p style="margin:4px 0 18px;font:400 13px/1.5 Arial,sans-serif;color:#6d6070">
      ${contra ? 'CONTRAENTREGA — cobrar al entregar'
        : (pagado ? 'Pagado en línea — confirmado por Wompi'
          : 'Pago en línea — <b>sin confirmar todavía</b>, no despachar aún')}
      · ${esc(cop(cuentas.total))}</p>
  </td></tr>

  ${/* Lo primero, y en rojo: es lo que se pierde si se lee en diagonal. */''}
  ${BLOQUE('⚠ Indicaciones para la entrega', esc(cliente.notas).replace(/\n/g, '<br>'), true)}
  ${BLOQUE('✎ Dedicatoria — va escrita a mano',
    esc(cliente.dedicatoria).replace(/\n/g, '<br>'), true)}
  ${BLOQUE('Qué empacar', piezas)}
  ${BLOQUE('Para la guía — destinatario', contacto)}
  ${BLOQUE('Para la guía — dirección', direccion)}
  ${BLOQUE('Cuentas', `Mercancía ${esc(cop(cuentas.total - cuentas.envio))}<br>`
    + `Envío ${cuentas.envioGratis ? 'GRATIS' : esc(cop(cuentas.envio))}<br>`
    + `<b>Total ${esc(cop(cuentas.total))}</b>`)}

  <tr><td style="padding:4px 26px 22px">
    <a href="https://wa.me/${esc(cliente.celular.replace(/^57/, '57') || WA)}"
       style="display:block;text-align:center;background:#25806a;color:#fff;text-decoration:none;
              font:400 14px/1 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;
              padding:14px 20px;border-radius:2px">Escribirle a la clienta</a>
  </td></tr>

</table></td></tr></table></body></html>`;
}

/* La misma hoja en texto plano. No es un respaldo decorativo: empacando se lee
   en el teléfono, y ahí muchos clientes de correo muestran esta versión. */
function textoTienda({ referencia, lineas, cuentas, pago, cliente, pagado }) {
  const bloque = (rotulo, valor) => (valor ? [rotulo, valor, ''] : []);
  return [
    pagado ? `PAGO CONFIRMADO — YA SE PUEDE DESPACHAR · ${referencia}` : `PEDIDO NUEVO · ${referencia}`,
    `${pago === 'contraentrega' ? 'CONTRAENTREGA — cobrar al entregar'
      : (pagado ? 'Pagado en linea — confirmado por Wompi'
        : 'Pago en linea — SIN CONFIRMAR todavia, no despachar aun')} · ${cop(cuentas.total)}`,
    '',
    ...bloque('>> INDICACIONES PARA LA ENTREGA:', cliente.notas),
    ...bloque('>> DEDICATORIA (va escrita a mano):', cliente.dedicatoria),
    'QUÉ EMPACAR:',
    ...lineas.map(l => `- ${l.nombre}${l.talla ? ` (talla ${l.talla} cm)` : ''}`
      + `${l.unidades > 1 ? ` x${l.unidades}` : ''}`),
    '',
    'PARA LA GUÍA:',
    `${cliente.nombre} ${cliente.apellido}`,
    `${cliente.tipodoc} ${cliente.documento}`,
    `Cel. ${cliente.celular}`,
    cliente.correo,
    `${cliente.direccion}${cliente.adicional ? ', ' + cliente.adicional : ''}`,
    ...(cliente.barrio ? [`Barrio ${cliente.barrio}`] : []),
    `${cliente.ciudad}, ${cliente.depto}`,
    '',
    `Envío: ${cuentas.envioGratis ? 'GRATIS' : cop(cuentas.envio)}`,
    `Total: ${cop(cuentas.total)}`,
  ].join('\n');
}

/* Copia interna, para no depender de mirar el panel de Wompi. */
async function avisoTienda({ referencia, lineas, cuentas, pago, cliente }) {
  const { para, defecto } = correoTienda();
  const datos = { referencia, lineas, cuentas, pago, cliente };
  /* Las indicaciones y la dedicatoria van en el asunto —marcadas— porque el
     correo se ve primero en una lista, y lo que no se ve ahí se empaca sin
     leer. */
  const avisos = [cliente.notas ? '⚠ CON INDICACIONES' : '', cliente.dedicatoria ? '✎ DEDICATORIA' : '']
    .filter(Boolean).join(' ');
  const r = await enviar({
    para,
    asunto: `Pedido ${referencia} · ${cop(cuentas.total)} · `
      + `${pago === 'contraentrega' ? 'CONTRAENTREGA' : 'en línea'}${avisos ? ' · ' + avisos : ''}`,
    html: plantillaTienda(datos), txt: textoTienda(datos),
    responder: cliente.correo,
  });
  return Object.assign({ destinatarioPorDefecto: defecto }, r);
}

/* «Ya pagó, despacha» — la misma hoja, cuando Wompi confirma el cobro.
 *
 * Hasta ahora el aviso de pago aprobado iba solo a la clienta: la tienda recibía
 * el pedido al crearse —antes de que hubiera pago— y nada más. Con pago en línea
 * eso deja la bandeja sin distinguir lo cobrado de lo abandonado, que es
 * justamente lo que hay que saber para empacar.
 *
 * Va la hoja completa y no un «pagado» a secas: quien empaca no debería tener
 * que buscar el correo anterior para saber qué meter en la caja ni dónde
 * entregarlo. Repetir es más barato que perder otro pedido.
 *
 * Si el registro no está —almacén caído al crear el pedido—, se manda lo que se
 * sepa igual. Un aviso incompleto sirve; ninguno, no. */
async function pagoTienda({ referencia, total, pedido }) {
  const { para, defecto } = correoTienda();

  if (!pedido || !pedido.cliente || !pedido.lineas) {
    return enviar({
      para,
      asunto: `PAGADO · ${referencia} · ${cop(total || 0)} — despachar`,
      html: `<p style="font:400 15px/1.6 Arial,sans-serif">Wompi confirmó el pago de `
        + `<b>${esc(referencia)}</b> por <b>${esc(cop(total || 0))}</b>.</p>`
        + `<p style="font:400 15px/1.6 Arial,sans-serif">No se pudo leer el registro del pedido, `
        + `así que el detalle está en el correo «Pedido nuevo» con esta misma referencia.</p>`,
      txt: `PAGADO · ${referencia} · ${cop(total || 0)}\n\n`
        + `No se pudo leer el registro. El detalle está en el correo «Pedido nuevo» con esta referencia.`,
    });
  }

  const cuentas = pedido.cuentas || { envio: 0, envioGratis: false, total: total || 0 };
  const datos = {
    referencia, lineas: pedido.lineas, cuentas,
    pago: pedido.pago || 'anticipado', cliente: pedido.cliente, pagado: true,
  };
  const avisos = [pedido.cliente.notas ? '⚠ CON INDICACIONES' : '',
    pedido.cliente.dedicatoria ? '✎ DEDICATORIA' : ''].filter(Boolean).join(' ');
  const r = await enviar({
    para,
    asunto: `PAGADO · ${referencia} · ${cop(cuentas.total)} — despachar${avisos ? ' · ' + avisos : ''}`,
    html: plantillaTienda(datos), txt: textoTienda(datos),
    responder: pedido.cliente.correo,
  });
  return Object.assign({ destinatarioPorDefecto: defecto }, r);
}

module.exports = {
  enviar, plantilla, texto, pedidoRecibido, avisoTienda, pagoTienda,
  plantillaTienda, textoTienda, correoTienda,
};
