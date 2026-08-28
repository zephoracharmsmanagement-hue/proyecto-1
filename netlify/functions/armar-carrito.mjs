'use strict';
/* Arma un carrito y devuelve el enlace para pagarlo.
 *
 * ── Para quién ──
 *
 * Para el bot de WhatsApp. La clienta dice qué quiere, el bot llama aquí, y
 * recibe dos cosas que no puede producir por su cuenta: **el precio de verdad**
 * y **un enlace al checkout con la selección ya puesta**.
 *
 * ── Por qué existe, si el bot podría armar la URL solo ──
 *
 * Porque el precio no lo puede escribir un modelo. `disponibilidad.mjs` ya lo
 * dice de frente en su cabecera: pedirle a un modelo que haga aritmética de
 * inventario es pedirle justo lo que hace mal y con seguridad. Con el precio es
 * peor todavía, porque hay escalas de descuento por cantidad, un descuento de
 * brazalete condicionado al número de charms y un umbral de envío gratis que
 * mide mercancía y no total (ver `calcular()` en _precios.js). Un modelo que
 * intente eso va a acertar casi siempre, y el «casi» es una clienta a la que se
 * le prometió un número y se le cobra otro.
 *
 * Aquí el número sale del mismo `calcular()` con el que cobra el checkout. El
 * bot lo interpola, no lo produce.
 *
 * ── Lo que NO hace, que es la decisión importante ──
 *
 * **No escribe nada.** No guarda registro, no genera referencia, no aparta
 * inventario y no habla con Wompi.
 *
 * La tentación era que creara el pedido en Blobs y devolviera un enlace de
 * `/reanudar?ref=…`, para que el bot pudiera retomar la conversación después.
 * Tiene tres problemas, y el primero solo se ve leyendo `rescate.mjs`:
 *
 *   · **Envenenaría el rescate.** `rescatables()` busca exactamente los pedidos
 *     en `esperando-pago`. Cada conversación de WhatsApp en la que el bot
 *     armara un carrito dejaría un checkout abandonado que nunca existió, y a
 *     la mañana siguiente el propietario recibiría una lista de pedidos que
 *     nadie empezó. Peor: si ese registro fantasma llevara `optin`, saldría un
 *     correo automático de recuperación por una compra imaginaria.
 *   · **El registro no se puede construir.** `leerCliente()` exige nombre,
 *     apellido, documento, celular, correo, departamento, ciudad y dirección.
 *     El bot tiene un dato: un número de teléfono.
 *   · **Duplicaría estado que ya tiene dueño.** `/reanudar` existe para
 *     resucitar un checkout abandonado de verdad; que el bot acuñe referencias
 *     propias pondría dos cosas distintas bajo el mismo espacio de claves.
 *
 * Así que esto devuelve un enlace a `checkout.html` con el carrito en la URL —el
 * formato que las dos páginas ya leen— y de ahí el pedido sigue el camino de
 * cualquiera: la clienta pone sus datos, `crear-pago` recalcula, aparta, firma y
 * cobra. Es la misma decisión que ya se tomó en `reanudar.mjs`: un solo sitio
 * donde se decide cuánto se cobra.
 *
 * ── Dos comprobaciones de inventario, no una ──
 *
 * `comprobarInventario()` mira `stock.json`, que es el último conteo a mano.
 * `disponibles()` mira además lo apartado por pagos en curso. Hacen falta las
 * dos: la primera trae los mensajes en español que la clienta va a leer; la
 * segunda es la que cacha que la última unidad la está pagando alguien **ahora
 * mismo**, que por WhatsApp duele más que en el checkout —ahí lo corrige una
 * pantalla, aquí hay una persona esperando una respuesta que ya se le dio—.
 *
 * ── Falla hacia adelante, con una excepción ──
 *
 * Si no se puede leer lo apartado, se responde igual con el precio y el enlace,
 * marcando `disponibilidad: 'sin-lectura'`. El bot tiene instrucciones de
 * matizar cuando ve eso, la misma regla que `disponibilidad.mjs`. Lo que no se
 * hace nunca es devolver un enlace con un precio inventado: si el cálculo falla,
 * falla la respuesta.
 */
import { leerPedido, comprobarInventario, calcular, detallar, cop,
  PedidoInvalido, SinInventario } from './_precios.js';
import { disponibles, _interno as inv } from './_inventario.mjs';
import { comoUrl } from './_carrito.mjs';

const CABECERAS = {
  'Content-Type': 'application/json; charset=utf-8',
  /* Sin caché: la respuesta lleva un precio y una disponibilidad que cambian
     con cada venta, y el bot la pide justo antes de prometérsela a alguien. */
  'Cache-Control': 'no-store',
};

const responder = (codigo, cuerpo) =>
  new Response(JSON.stringify(cuerpo), { status: codigo, headers: CABECERAS });

/* Lo apartado por pagos en curso, que `stock.json` no sabe.
 *
 * Devuelve la lista de lo que no alcanza, con las mismas palabras que usaría el
 * checkout. Null significa «no se pudo leer», que no es lo mismo que «alcanza
 * para todo» y por eso no se colapsan en el mismo valor. */
async function faltaAlgo(pedido) {
  const piden = inv.itemsDe(pedido);
  const libres = await disponibles(Object.keys(piden));
  if (!libres) return null;

  const faltan = [];
  Object.entries(piden).forEach(([s, n]) => {
    const hay = libres[s];
    if (typeof hay === 'number' && hay < n) faltan.push(inv.describir(s, hay, n));
  });
  return faltan;
}

export default async (req) => {
  if (req.method !== 'POST') {
    return responder(405, { error: 'Solo POST' });
  }

  let cuerpo;
  try {
    cuerpo = JSON.parse((await req.text()) || '{}');
  } catch (_) {
    return responder(400, { error: 'El carrito no llegó en JSON válido' });
  }

  /* Exactamente el mismo lector que usa `crear-pago`. Es deliberado: si el bot
     puede armar algo que el checkout rechazaría, la clienta llega al enlace y
     se encuentra un error después de que se le dijo que todo estaba bien.
     Compartiendo el lector, lo que pasa aquí pasa allí. */
  let pedido, cuentas;
  try {
    pedido = leerPedido(cuerpo);
    comprobarInventario(pedido);
    cuentas = calcular(pedido);
  } catch (e) {
    if (e instanceof PedidoInvalido) return responder(400, { error: e.message });
    /* 409 y no 400, igual que en `crear-pago`: el carrito está bien formado, es
       el inventario el que cambió. El bot lo distingue para ofrecer otra cosa en
       vez de disculparse por un error que no cometió nadie. */
    if (e instanceof SinInventario) return responder(409, { error: e.message, agotado: true });
    throw e;
  }

  if (cuentas.total <= 0) {
    return responder(400, { error: 'El carrito está vacío' });
  }

  const faltan = await faltaAlgo(pedido);
  if (faltan && faltan.length) {
    return responder(409, {
      error: 'Se agotó algo de esa selección: ' + faltan.join('; ')
        + '. Se puede ajustar el pedido o conseguirlo por encargo.',
      agotado: true,
    });
  }

  const sitio = (process.env.URL_SITIO || process.env.URL || '').replace(/\/$/, '');
  const q = comoUrl(pedido);
  q.set('via', 'wa');           /* de dónde vino, para poder medirlo aparte */

  const lineas = detallar(pedido);

  console.log(JSON.stringify({
    evento: 'armar_carrito',
    total: cuentas.total,
    piezas: pedido.charms.length + (pedido.base ? 1 : 0),
    disponibilidad: faltan === null ? 'sin-lectura' : 'real',
    lineas: lineas.map(l => ({ id: l.id, talla: l.talla, unidades: l.unidades })),
  }));

  return responder(200, {
    enlace: `${sitio}/checkout.html?${q.toString()}`,
    /* El total va en número y en texto ya formateado. El texto existe para que
       el bot no tenga que formatear pesos colombianos —separador de miles con
       punto— y acabe escribiendo «$187,450», que aquí se lee como otra cifra. */
    total: cuentas.total,
    totalTexto: cop(cuentas.total),
    subtotal: cuentas.subtotal,
    descuento: cuentas.descuento,
    envio: cuentas.envio,
    envioGratis: cuentas.envioGratis,
    piezas: pedido.charms.length + (pedido.base ? 1 : 0),
    /* Con nombre legible: el bot tiene que poder repetirle a la clienta qué
       lleva el pedido sin traducir identificadores por su cuenta. */
    lineas: lineas.map(l => ({
      nombre: l.nombre, talla: l.talla, unidades: l.unidades, precio: cop(l.precio),
    })),
    /* 'sin-lectura' significa que no se pudo comprobar lo apartado por pagos en
       curso. El precio es bueno; la disponibilidad es la del último conteo. El
       prompt tiene instrucciones de matizar cuando lee esto. */
    disponibilidad: faltan === null ? 'sin-lectura' : 'real',
    aviso: faltan === null
      ? 'No se pudo comprobar lo apartado por pagos en curso: confirmar antes de prometer.'
      : 'Disponibilidad referencial: conteo manual menos lo apartado por pagos en curso.',
  });
};

export const _interno = { faltaAlgo };
