'use strict';
/* Lo que pasa cuando la pasarela dice en qué quedó un pago.
 *
 * Lo comparten wompi-webhook y addi-callback: las dos pasarelas avisan distinto
 * —Wompi firma el evento, Addi usa Basic Auth— pero, ya verificado el aviso, lo
 * que hay que hacer es lo mismo y no puede separarse entre una y otra: cerrar
 * la reserva, anotar el estado del pedido y, si se aprobó, el Purchase a Meta,
 * la hoja, el «ya pagó, despacha» a la tienda y el «¡pago recibido!» a la
 * clienta. Era el bloque central de wompi-webhook; se movió aquí tal cual.
 */
import { cop } from './_precios.js';
import { confirmar, liberar } from './_inventario.mjs';
import { anotarVenta } from './_hoja.mjs';
import { marcar, leer } from './_pedidos.mjs';
import { purchase } from './_meta.js';
import { tomar as tomarSenales } from './_atribucion.mjs';
import { enviar, pagoTienda } from './_correo.js';
import { usarRegalo } from './_suscriptores.mjs';

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

/* El correo de «pago recibido». Con Addi no hubo pago en la tienda: Addi
   aprobó el crédito y es Addi quien le cobra a la clienta en cuotas. */
function correoPagado({ referencia, total, medio }) {
  const t = cop(total || 0);
  const addi = medio === 'addi';
  const titulo = addi ? '¡Compra aprobada!' : '¡Pago recibido!';
  const frase = addi
    ? `Addi aprobó tu compra de <b>${t}</b>. Las cuotas las pagas directamente a Addi.`
    : `Confirmamos tu pago de <b>${t}</b>.`;
  return {
    asunto: `${addi ? 'Compra aprobada' : 'Pago confirmado'} · ${referencia} · Zephora Charms`,
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
      + `<h1 style="margin:0 0 10px;font:400 27px/1.2 Georgia,serif;color:#1F7A5C">${titulo}</h1>`
      + `<p style="margin:0 0 18px;font:400 15px/1.6 Arial,sans-serif;color:#584a5c">`
      + `${frase} Tu pedido entró a preparación y te mandamos `
      + `el número de guía en cuanto lo despachemos.</p>`
      + `<p style="margin:0 0 4px;font:400 12px/1 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#A9A6AE">Referencia</p>`
      + `<p style="margin:0 0 20px;font:400 17px/1.3 monospace;color:#5C3D63;background:#F3E6EB;`
      + `border:1px solid #e9d3dc;border-radius:3px;padding:8px 12px;display:inline-block">${referencia}</p>`
      + `<p style="margin:0;font:400 13.5px/1.6 Arial,sans-serif;color:#6d6070">`
      + `El detalle de las piezas está en el correo anterior, con esta misma referencia.</p>`
      + `</td></tr>`
      + `<tr><td style="padding:0 26px 26px">`
      + `<a href="https://wa.me/573018990672?text=${encodeURIComponent('Hola, Zephora Charms. Escribo por mi pedido ' + referencia + '.')}" `
      + `style="display:block;text-align:center;background:#25806a;color:#fff;text-decoration:none;`
      + `font:400 14px/1 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;`
      + `padding:15px 20px;border-radius:2px">Escribirnos por WhatsApp</a></td></tr>`
      + `<tr><td style="padding:18px 26px 24px;border-top:1px solid #E4DDE0;`
      + `font:400 12px/1.6 Arial,sans-serif;color:#8a8290">`
      + `Zephora Charms · NIT 1.019.151.696-3 · Bogotá D.C., Colombia<br>`
      + `WhatsApp +57 301 899 0672 · zephoracharms@gmail.com</td></tr>`
      + `</table></td></tr></table></body></html>`,
    txt: `${titulo}\n\n${frase.replace(/<\/?b>/g, '')}\n`
      + `Referencia: ${referencia}\n\n`
      + `Tu pedido entró a preparación. Te mandamos el número de guía al despacharlo.\n`
      + `El detalle de las piezas está en el correo anterior, con esta misma referencia.\n\n`
      + `WhatsApp: https://wa.me/573018990672\n`
      + `Zephora Charms · NIT 1.019.151.696-3 · Bogotá D.C., Colombia`,
  };
}

/* registro: { referencia, aprobado, estado, transaccion, metodo, total, correo,
 *             telefono, nombre, cuandoMs, medio ('wompi' | 'addi') } */
async function cerrarPago(registro) {
  const { referencia, aprobado } = registro;
  const cuando = registro.cuandoMs ? new Date(registro.cuandoMs).toISOString() : null;

  /* Cierra la reserva que abrió crear-pago.
   *
   * Aprobado: lo apartado pasa a vendido y deja de caducar. Rechazado, anulado
   * o con error: las unidades vuelven al mostrador ya, sin esperar a que la
   * reserva venza — en una pieza de la que queda una, esa espera es una venta
   * que no se pudo hacer.
   *
   * Va antes de los correos a propósito: es lo único de este bloque que afecta
   * a otras clientas, y no puede quedarse sin hacer porque Resend tarde. Ambas
   * son idempotentes, así que los reintentos de la pasarela no descuentan dos
   * veces. */
  let cierre = null;
  if (referencia) {
    cierre = aprobado ? await confirmar(referencia) : await liberar(referencia);
    console.log(JSON.stringify({
      evento: 'inventario_' + cierre.modo, referencia, estado: registro.estado,
    }));

    /* En qué quedó el pedido, sobre el registro que dejó crear-pago. Se fusiona
       para no perder el detalle de las piezas ni la dirección, que el aviso de
       la pasarela no trae. */
    await marcar(referencia, {
      estado: aprobado ? 'pagado' : 'pago-' + String(registro.estado || 'desconocido').toLowerCase(),
      transaccion: registro.transaccion,
      metodo: registro.metodo,
      cobrado: registro.total,
      pagadoEn: cuando,
    });
  }

  /* Las señales de atribución que guardó crear-pago (cookies del pixel, IP,
   * user-agent), que esta petición no puede conocer porque la hace la pasarela
   * y no un navegador. Ver _atribucion.mjs.
   *
   * Se recogen con cualquier estado, no solo con el aprobado, porque tomar()
   * borra al leer: si solo se recogieran en el camino bueno, cada pago
   * rechazado dejaría datos de una clienta guardados sin que nadie los limpie. */
  const senales = referencia ? await tomarSenales(referencia) : null;

  if (!aprobado) return { cierre };

  /* Purchase a Meta desde el servidor.
   *
   * gracias.html ya lo dispara, pero solo si la clienta vuelve al sitio
   * después de pagar — y volver es opcional. Este siempre llega, porque lo
   * dispara la pasarela. Los dos mandan la referencia como identificador del
   * evento, que es lo que hace que Meta cuente una compra y no dos. */
  const aMeta = await purchase({
    referencia,
    total: registro.total,
    correo: registro.correo,
    telefono: registro.telefono || null,
    nombre: registro.nombre || null,
    cuando: registro.cuandoMs || null,
    senales,
  });
  console.log(JSON.stringify({
    evento: 'meta_purchase', referencia, medio: registro.medio || 'wompi',
    enviado: aMeta.enviado, motivo: aMeta.motivo || null, campos: aMeta.campos || null,
    /* Si salió sin fbc ni fbp, Meta no puede atarlo al anuncio que lo
       produjo. Cuenta como conversión, pero empareja mucho peor. */
    atribuido: aMeta.atribuido || false,
  }));

  await reenviar(Object.assign({
    titulo: `Pago aprobado · ${referencia} · ${cop(registro.total || 0)}`,
  }, registro));

  /* «Ya pagó, despacha» a la tienda, con la hoja completa.
   *
   * Falla hacia adelante como todo lo demás: si no se puede leer el registro
   * o Resend no responde, se anota y el aviso sigue. Un aviso que no sale
   * es molesto; que la pasarela reintente porque esto lanzó, no. */
  try {
    const pedido = await leer(referencia);

    /* Charm de regalo de suscriptora: se gasta AQUÍ, con el pago aprobado, y
       no al crear el pedido —un pago rechazado no puede gastarlo—. Si otro
       pedido de la misma clienta lo usó primero, este va sin regalo y la
       hoja de «PAGADO» deja de pedirlo. */
    if (pedido && pedido.regalo === 'suscriptor') {
      const uso = await usarRegalo(pedido.cliente && pedido.cliente.correo, referencia);
      if (!uso.ok) pedido.regalo = null;
      await marcar(referencia, { regalo: pedido.regalo, regaloMotivo: uso.ok ? null : uso.motivo });
      console.log(JSON.stringify({ evento: 'regalo_suscriptor', referencia,
        usado: uso.ok, motivo: uso.motivo || uso.modo }));
    }

    /* A la hoja de inventario. Aquí y no al crear el pedido: hasta que la
       pasarela aprueba, el pago en línea no ha sacado nada del inventario. */
    await anotarVenta({
      referencia,
      pago: (pedido && pedido.pago) || 'anticipado',
      cuando: cuando || new Date().toISOString(),
      ciudad: pedido && pedido.cliente
        ? `${pedido.cliente.ciudad}, ${pedido.cliente.depto}` : '',
      total: (pedido && pedido.cuentas && pedido.cuentas.total) || registro.total,
      lineas: (pedido && pedido.lineas) || [],
      restante: cierre && cierre.restante,
    });

    const aTienda = await pagoTienda({ referencia, total: registro.total, pedido });
    console.log(JSON.stringify({
      evento: 'aviso_tienda_pagado', referencia,
      enviado: aTienda.enviado !== false, conRegistro: Boolean(pedido && pedido.cliente),
    }));
  } catch (e) {
    console.error('No se pudo avisar a la tienda del pago', referencia, e.message);
  }

  /* El «ya está» que la clienta espera. Sale de aquí y no de la página de
     gracias a propósito: la clienta puede haber cerrado el navegador antes de
     volver, y el pago fue bueno igual. */
  if (registro.correo) {
    const c = correoPagado(registro);
    await enviar({ para: registro.correo, asunto: c.asunto, html: c.html, txt: c.txt });
  }

  return { cierre };
}

export { cerrarPago };
export const _interno = { correoPagado };
