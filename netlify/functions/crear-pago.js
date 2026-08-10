'use strict';
/* Prepara un cobro. Es la única pieza que decide cuánto se cobra.
 *
 * Recibe del checkout QUÉ pidió la clienta y sus datos de envío; nunca el
 * monto. Recalcula el total con _precios.js, genera una referencia única y la
 * firma con el secreto de integridad de Wompi, que solo existe aquí dentro.
 *
 * Contraentrega no pasa por la pasarela: se registra el pedido y se responde
 * sin firma, porque no hay nada que cobrar todavía.
 *
 * Variables de entorno (Netlify → Site configuration → Environment variables):
 *   WOMPI_LLAVE_PUBLICA     pub_prod_… (o pub_test_… mientras se prueba)
 *   WOMPI_INTEGRIDAD        prod_integrity_… — NUNCA en el repo ni en el HTML
 *   URL_SITIO               https://zephoracharms.com (opcional; Netlify ya da URL)
 *   PEDIDOS_WEBHOOK         opcional: a dónde avisar de cada pedido nuevo
 */
const crypto = require('crypto');
const { leerPedido, comprobarInventario, calcular, detallar, cop,
  PedidoInvalido, SinInventario } = require('./_precios');
const { pedidoRecibido, avisoTienda } = require('./_correo');

const CHECKOUT_WOMPI = 'https://checkout.wompi.co/p/';

const CORS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const responder = (codigo, cuerpo) => ({
  statusCode: codigo,
  headers: CORS,
  body: JSON.stringify(cuerpo),
});

/* Referencia del pedido. Tiene que ser única de verdad: Wompi rechaza una
   referencia repetida, y dos pedidos con la misma referencia son dos pagos que
   no se pueden distinguir al conciliar. Fecha para poder leerla de un vistazo
   en el panel, y 8 bytes de azar para que no colisione. */
function referencia() {
  const d = new Date();
  const dia = d.toISOString().slice(2, 10).replace(/-/g, '');
  return `ZC-${dia}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

/* La firma que Wompi exige para creer el monto:
   SHA256(referencia + monto_en_centavos + moneda + secreto_de_integridad).
   Sin ella, cualquiera abre el checkout con el precio que quiera. */
function firmar(ref, centavos, moneda, secreto) {
  return crypto.createHash('sha256')
    .update(`${ref}${centavos}${moneda}${secreto}`)
    .digest('hex');
}

/* Los datos de la clienta. Se recortan y se validan aquí también: el navegador
   ya los validó, pero el navegador no es de fiar —esta función es una URL
   pública que cualquiera puede llamar sin pasar por el formulario—. */
function leerCliente(c) {
  if (!c || typeof c !== 'object') throw new PedidoInvalido('Faltan los datos de envío');
  const txt = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

  const cliente = {
    nombre: txt(c.nombre, 60),
    apellido: txt(c.apellido, 60),
    tipodoc: ['CC', 'CE', 'NIT', 'PP', 'TI'].includes(c.tipodoc) ? c.tipodoc : 'CC',
    documento: txt(c.documento, 15),
    celular: txt(c.celular, 12).replace(/\D/g, ''),
    correo: txt(c.correo, 120).toLowerCase(),
    depto: txt(c.depto, 60),
    ciudad: txt(c.ciudad, 60),
    direccion: txt(c.direccion, 120),
    adicional: txt(c.adicional, 80),
    barrio: txt(c.barrio, 80),
    notas: txt(c.notas, 400),
    dedicatoria: txt(c.dedicatoria, 200),
  };

  if (cliente.nombre.length < 2) throw new PedidoInvalido('Falta el nombre');
  if (cliente.apellido.length < 2) throw new PedidoInvalido('Falta el apellido');
  if (cliente.documento.length < 5) throw new PedidoInvalido('Falta el documento');
  if (!/^3\d{9}$/.test(cliente.celular)) {
    throw new PedidoInvalido('El celular debe tener 10 dígitos y empezar por 3');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cliente.correo)) {
    throw new PedidoInvalido('El correo no es válido');
  }
  if (!cliente.depto) throw new PedidoInvalido('Falta el departamento');
  if (!cliente.ciudad) throw new PedidoInvalido('Falta la ciudad');
  if (cliente.direccion.length < 5) throw new PedidoInvalido('Falta la dirección');

  return cliente;
}

/* ¿Wompi reconoce este comercio?
 *
 * Existe porque pasó: las llaves estaban puestas, la firma era correcta, y aun
 * así toda clienta que elegía pagar en línea terminaba en una pantalla de
 * Wompi que decía «No se pudo cargar la información del undefined». La cuenta
 * no estaba activa en producción, y el sitio no tenía forma de saberlo: la
 * redirección es un viaje de ida.
 *
 * Se le pregunta a Wompi antes de mandar a nadie. Si responde que el comercio
 * no existe, el checkout ofrece contraentrega o WhatsApp en vez de un callejón
 * sin salida. Y el día que la cuenta se active, esto empieza a pasar solo, sin
 * tocar una línea.
 *
 * Falla hacia adelante a propósito: solo bloquea con un 404 explícito. Si la
 * consulta se cae por red o por lentitud, se deja pasar el pago — no vamos a
 * perder una venta buena por un chequeo que no pudo hacerse. */
async function comercioActivo(llave) {
  const host = llave.startsWith('pub_test_') ? 'sandbox' : 'production';
  try {
    const r = await fetch(`https://${host}.wompi.co/v1/merchants/${llave}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (r.status === 404) {
      console.error(`Wompi no reconoce la llave pública (${host}): comercio inexistente`);
      return false;
    }
    return true;
  } catch (e) {
    console.error('No se pudo verificar el comercio en Wompi, se deja pasar:', e.message);
    return true;
  }
}

/* Aviso de pedido nuevo. Best-effort a propósito: si el aviso falla, el cobro
   sigue su curso. Perder una notificación es molesto; perder una venta porque
   el webhook de avisos estaba caído, no. */
async function avisar(carga) {
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
    console.error('No se pudo avisar del pedido', carga.referencia, e.message);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return responder(405, { error: 'Solo POST' });
  }

  let cuerpo;
  try {
    cuerpo = JSON.parse(event.body || '{}');
  } catch (_) {
    return responder(400, { error: 'El pedido no llegó en JSON válido' });
  }

  let pedido, cliente, cuentas;
  try {
    pedido = leerPedido(cuerpo);
    cliente = leerCliente(cuerpo.cliente);
    comprobarInventario(pedido);
    cuentas = calcular(pedido);
  } catch (e) {
    if (e instanceof PedidoInvalido) return responder(400, { error: e.message });
    /* 409, no 400: el pedido está bien formado, es el mundo el que cambió. El
       checkout lo distingue para decirle a la clienta qué ajustar. */
    if (e instanceof SinInventario) return responder(409, { error: e.message, agotado: true });
    throw e;
  }

  if (cuentas.total <= 0) {
    return responder(400, { error: 'El total del pedido es cero' });
  }

  const ref = referencia();
  const sitio = (process.env.URL_SITIO || process.env.URL || '').replace(/\/$/, '');

  /* Queda en el log de la función: es el registro de que el pedido se creó, y
     con qué total, antes de que la clienta llegue a la pasarela. Al conciliar,
     esto es lo que se compara contra lo que Wompi diga que cobró. */
  console.log(JSON.stringify({
    evento: 'pedido_creado',
    referencia: ref,
    total: cuentas.total,
    pago: pedido.pago,
    piezas: pedido.charms.length + (pedido.base ? 1 : 0),
    ciudad: `${cliente.ciudad}, ${cliente.depto}`,
  }));

  const lineas = detallar(pedido);

  await avisar({
    evento: 'pedido_creado',
    referencia: ref,
    pago: pedido.pago,
    total: cuentas.total,
    totalTexto: cop(cuentas.total),
    envio: cuentas.envio,
    lineas,
    cliente,
  });

  /* Comprobante a la clienta y copia a la tienda. En paralelo y sin dejar que
     un fallo de correo tumbe el pedido: allSettled, no all. */
  const correos = { referencia: ref, lineas, cuentas, pago: pedido.pago, cliente };
  const [aCliente, aTienda] = await Promise.allSettled([
    pedidoRecibido(correos), avisoTienda(correos),
  ]);
  console.log(JSON.stringify({
    evento: 'correos_pedido', referencia: ref,
    cliente: aCliente.status === 'fulfilled' ? aCliente.value : { enviado: false, motivo: 'excepción' },
    tienda: aTienda.status === 'fulfilled' ? aTienda.value : { enviado: false, motivo: 'excepción' },
  }));

  const base = {
    referencia: ref,
    total: cuentas.total,
    centavos: cuentas.centavos,
    envio: cuentas.envio,
    envioGratis: cuentas.envioGratis,
    descuento: cuentas.descuento,
    lineas: detallar(pedido),
  };

  if (pedido.pago === 'contraentrega') {
    /* Nada que firmar: se paga al mensajero. El pedido queda registrado y la
       confirmación de existencias sigue haciéndose por WhatsApp, como hoy. */
    return responder(200, Object.assign({ modo: 'contraentrega' }, base));
  }

  const llave = process.env.WOMPI_LLAVE_PUBLICA;
  const integridad = process.env.WOMPI_INTEGRIDAD;
  if (!llave || !integridad) {
    console.error('Faltan WOMPI_LLAVE_PUBLICA o WOMPI_INTEGRIDAD en el entorno');
    return responder(503, {
      error: 'El pago en línea no está configurado todavía. Puedes pedirlo '
        + 'contraentrega o escribirnos por WhatsApp.',
    });
  }

  if (!(await comercioActivo(llave))) {
    return responder(503, {
      error: 'El pago en línea no está disponible en este momento. Puedes elegir '
        + 'pago contraentrega aquí mismo, o escribirnos y lo cerramos por WhatsApp.',
    });
  }

  return responder(200, Object.assign({
    modo: 'wompi',
    checkout: CHECKOUT_WOMPI,
    llavePublica: llave,
    firma: firmar(ref, cuentas.centavos, 'COP', integridad),
    redirect: `${sitio}/gracias.html`,
  }, base));
};

/* Se exportan para que las pruebas comprueben la firma y la referencia sin
   tener que levantar Netlify. */
exports._interno = { referencia, firmar, leerCliente };
