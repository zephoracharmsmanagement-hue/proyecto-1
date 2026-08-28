'use strict';
/* Retomar un pedido que quedó sin pagar.
 *
 * ── Qué es ──
 *
 * El destino del enlace que va en el correo de recuperación: la clienta llegó
 * al final del checkout, se fue sin pagar, y este enlace la devuelve a su
 * pedido armado. Recibe solo la referencia —corta, y sin exponer la selección
 * entera en la barra del navegador— y devuelve a la clienta al checkout con
 * todo puesto.
 *
 * ── Lo que NO hace, que es la decisión importante ──
 *
 * No firma nada, no reserva nada y no habla con Wompi.
 *
 * La tentación era mandarla directo a la pasarela con la firma ya hecha: un
 * clic menos. Eso obligaría a armar aquí la URL de Wompi con su firma de
 * integridad, que es exactamente lo que ya hace `crear-pago.mjs`, y tendríamos
 * dos sitios generando cobros. En una tienda donde el monto lo calcula el
 * servidor a propósito, duplicar el camino del dinero para ahorrar un clic es
 * mal negocio: el día que cambie una regla de precio habría que acordarse de
 * los dos, y el que se olvide cobra mal sin dar ningún error.
 *
 * Así que esto devuelve a la clienta al checkout de siempre, con el carrito
 * puesto por la URL, y de ahí en adelante el pedido sigue el mismo camino que
 * el de cualquiera: `crear-pago` recalcula, reserva, firma y cobra. Un clic
 * más, un solo sitio donde se decide cuánto se cobra.
 *
 * ── Nunca promete lo que ya no hay ──
 *
 * La reserva original caduca a los 30 minutos y el rescate se dispara horas
 * después, así que para cuando alguien abre este enlace sus unidades llevan
 * rato de vuelta en el mostrador. Decirle «tu pedido sigue guardado» sin mirar
 * sería mentir. Antes de devolverla se comprueba qué queda de verdad y se
 * recorta la selección a eso, avisando de lo que cambió.
 *
 * ── Falla hacia adelante, como todo lo demás ──
 *
 * Si Blobs no responde o la referencia no aparece, no se muestra un error: se
 * manda a la tienda. Quien viene de un correo con ganas de comprar tiene que
 * acabar en un sitio donde pueda comprar, nunca en una pantalla rota.
 */
import { leer, marcar } from './_pedidos.mjs';
import { disponibles } from './_inventario.mjs';
import { inventario as stock } from './_precios.js';
import { comoUrl } from './_carrito.mjs';

/* La misma ventana que usa el rescate para decidir a quién vale la pena
   escribirle. Más allá, los precios y el inventario ya no son los de entonces
   y el enlace prometería un pedido que hay que rehacer de todas formas. */
const DIAS_MAX = 7;

const irA = destino => new Response(null, {
  status: 302,
  headers: { Location: destino, 'Cache-Control': 'no-store' },
});

/* De las líneas guardadas al carrito que entiende el checkout.
 *
 * `detallar()` agrupa los charms repetidos en una línea con `unidades`, así que
 * deshacer eso es repetir el id. El brazalete se reconoce por su tipo en
 * stock.json y no por la posición: confiar en que va primero sería cierto hoy
 * y falso el día que alguien reordene `detallar()`. */
function carritoDe(registro) {
  const items = (stock && stock.items) || {};
  let base = null;
  const charms = [];
  let empaque = false;

  (registro.lineas || []).forEach(l => {
    if (!l || !l.id) return;
    if (l.id === 'empaque') { empaque = true; return; }
    const it = items[l.id];
    if (!it) return;                      /* pieza retirada del catálogo */
    if (it.tipo === 'pulsera') {
      if (!base) base = { id: l.id, talla: l.talla == null ? null : String(l.talla) };
      return;
    }
    for (let i = 0; i < (l.unidades || 1); i++) charms.push(l.id);
  });

  return { base, charms, empaque,
    pago: registro.pago === 'contraentrega' ? 'contraentrega' : 'anticipado' };
}

/* Recorta el carrito a lo que de verdad queda. Devuelve también si hubo que
   tocar algo, que es lo que decide el mensaje que ve la clienta.
   Sin lectura de inventario no se recorta nada: un número inventado por un
   fallo de red es peor que no tener número, la misma regla que `disponibilidad`. */
function recortar(carrito, libres) {
  if (!libres) return { carrito, cambio: false, fuente: 'sin-lectura' };

  const puestos = {};
  const charms = carrito.charms.filter(id => {
    puestos[id] = (puestos[id] || 0) + 1;
    return puestos[id] <= (libres[id] || 0);
  });

  let base = carrito.base;
  if (base) {
    const sku = base.talla ? `${base.id}|${base.talla}` : base.id;
    /* Sin talla elegida vale que quede alguna: la talla se confirma después. */
    const hay = base.talla
      ? (libres[sku] || 0)
      : Object.keys(libres).reduce((n, k) =>
          k === base.id || k.startsWith(base.id + '|') ? n + libres[k] : n, 0);
    if (hay <= 0) base = null;
  }

  const cambio = charms.length !== carrito.charms.length || (!!carrito.base !== !!base);
  return { carrito: Object.assign({}, carrito, { base, charms }), cambio, fuente: 'real' };
}

export default async (req) => {
  const sitio = (process.env.URL_SITIO || process.env.URL || '').replace(/\/$/, '');
  const tienda = `${sitio}/index.html`;

  let ref = '';
  try { ref = new URL(req.url).searchParams.get('ref') || ''; } catch (_) { /* abajo */ }
  ref = String(ref).trim().slice(0, 40);
  if (!ref) return irA(tienda);

  const registro = await leer(ref);

  /* Referencia que no existe, o almacén caído. No se distingue a propósito: en
     los dos casos lo útil para quien viene de un correo es acabar en la tienda,
     y decirle «esa referencia no existe» a quien tiene el correo en la mano
     suena a que le perdimos el pedido. */
  if (!registro) {
    console.log(JSON.stringify({ evento: 'reanudar', referencia: ref, resultado: 'sin-registro' }));
    return irA(`${tienda}?reanudar=no-encontrado`);
  }

  /* Ya pagado: bajo ninguna circunstancia se le vuelve a armar un cobro. Es el
     riesgo serio de esta pieza —un enlace reenviado, o abierto dos veces— y por
     eso va antes que cualquier otra cosa. */
  if (registro.estado === 'pagado' || registro.estado === 'confirmado') {
    console.log(JSON.stringify({ evento: 'reanudar', referencia: ref, resultado: 'ya-pagado' }));
    return irA(`${sitio}/gracias.html?ref=${encodeURIComponent(ref)}`);
  }

  const creado = Date.parse(registro.creado || '');
  if (Number.isFinite(creado) && (Date.now() - creado) > DIAS_MAX * 24 * 36e5) {
    console.log(JSON.stringify({ evento: 'reanudar', referencia: ref, resultado: 'vencido' }));
    return irA(`${tienda}?reanudar=vencido`);
  }

  const carrito = carritoDe(registro);
  if (!carrito.base && !carrito.charms.length) {
    console.log(JSON.stringify({ evento: 'reanudar', referencia: ref, resultado: 'sin-piezas' }));
    return irA(`${tienda}?reanudar=no-encontrado`);
  }

  /* Qué queda de verdad: el conteo menos lo apartado por pagos en curso. */
  const skus = [];
  carrito.charms.forEach(id => { if (skus.indexOf(id) === -1) skus.push(id); });
  if (carrito.base) {
    const items = (stock && stock.items) || {};
    const tallas = (items[carrito.base.id] && items[carrito.base.id].tallas) || null;
    if (tallas) Object.keys(tallas).forEach(t => skus.push(`${carrito.base.id}|${t}`));
    else skus.push(carrito.base.id);
  }

  let libres = null;
  try { libres = await disponibles(skus); }
  catch (e) { console.error('reanudar: no se pudo leer disponibilidad —', e.message); }

  const { carrito: final, cambio, fuente } = recortar(carrito, libres);

  if (!final.base && !final.charms.length) {
    console.log(JSON.stringify({ evento: 'reanudar', referencia: ref, resultado: 'todo-agotado' }));
    return irA(`${tienda}?reanudar=agotado`);
  }

  /* Sale de la lista del rescate: ya se actuó sobre él. Sin esto el correo de
     mañana volvería a ofrecer el mismo pedido a quien ya lo está retomando.
     No cambia el estado —sigue esperando pago hasta que lo pague— porque el
     estado dice qué le pasó al dinero, no qué le pasó al correo. */
  await marcar(ref, { reanudadoEn: new Date().toISOString() });

  console.log(JSON.stringify({
    evento: 'reanudar', referencia: ref,
    resultado: cambio ? 'ajustado' : 'igual',
    fuente,
    piezas: final.charms.length + (final.base ? 1 : 0),
  }));

  const q = comoUrl(final);
  q.set('reanudar', cambio ? 'ajustado' : 'igual');
  q.set('ref', ref);
  return irA(`${sitio}/checkout.html?${q.toString()}`);
};

/* Para que las pruebas comprueben la reconstrucción y el recorte sin levantar
   Netlify ni tocar Blobs, que es donde está toda la decisión. */
export const _interno = { carritoDe, recortar, comoUrl, DIAS_MAX };
