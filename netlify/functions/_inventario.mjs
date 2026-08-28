/* Reserva de inventario, con estado.
 *
 * `comprobarInventario()` en _precios.js cierra el caso corriente: pagar algo
 * que se agotó hace rato. Lo que no puede cerrar es la carrera — dos clientas
 * comprando la última unidad en el mismo minuto leen las dos «queda 1», las dos
 * pasan la comprobación, y las dos pagan. Ahí toca devolver dinero, que bajo la
 * Ley 1480 no es solo una molestia.
 *
 * Para cerrarla hace falta que alguien lleve la cuenta de lo que está
 * comprometido, no solo de lo que existe. Eso vive aquí, en Netlify Blobs.
 *
 * ── Por qué compare-and-swap y no leer-restar-escribir ──
 *
 * La documentación de Blobs es explícita: no hay control de concurrencia, gana
 * la última escritura. Un `leer → restar → escribir` tendría exactamente el
 * mismo defecto que estamos arreglando, solo que más difícil de ver: las dos
 * clientas leen el mismo estado, las dos restan sobre él, y la segunda pisa a la
 * primera. Sería mover el bug de sitio.
 *
 * Por eso cada escritura va con `onlyIfMatch` sobre el etag que se leyó. Si
 * alguien escribió en medio, el etag ya no cuadra, `modified` vuelve en false y
 * se reintenta sobre el estado nuevo. Es lo que hace que «exactamente una» de
 * las dos clientas se lleve la última unidad.
 *
 * ── Por qué una sola clave y no una por pieza ──
 *
 * Un pedido toca varias piezas a la vez (un brazalete de una talla y N charms) y
 * tiene que reservarlas todas o ninguna. Con una clave por pieza harían falta
 * varias escrituras y un deshacer para las que ya pasaron cuando una falla. Con
 * una sola clave, un CAS cubre el pedido entero y la atomicidad sale gratis.
 * A cambio, los pedidos concurrentes compiten por la misma clave — irrelevante
 * al volumen de esta tienda, y el reintento lo absorbe.
 *
 * ── Falla hacia adelante ──
 *
 * Igual que el resto del proyecto: esto solo bloquea con un dato claro de que no
 * hay. Si Blobs no responde, si no está configurado, o si el CAS no converge, la
 * venta pasa y queda registrado en el log. Una lectura que no se pudo hacer no
 * puede costar una compra buena.
 *
 * ── Por qué las funciones que llaman a esto son v2 (.mjs) ──
 *
 * `getStore()` se autoconfigura leyendo la variable `NETLIFY_BLOBS_CONTEXT`, y
 * **el runtime de Netlify solo la inyecta en funciones v2**. Con las funciones
 * v1 de antes (`exports.handler`, `runtimeAPIVersion: 1`) esa variable no
 * existe, `getStore()` lanza MissingBlobsEnvironmentError y este módulo se cae
 * al camino de emergencia: la tienda vende, pero sin reservar nada.
 *
 * Y ese fallo es silencioso por diseño —falla hacia adelante—, así que estuvo
 * en producción una jornada entera sin que nada se rompiera. Se detectó leyendo
 * el log de `crear-pago`, no porque algo fallara.
 *
 * Por eso `crear-pago.mjs` y `wompi-webhook.mjs` son v2 y terminan en `.mjs`:
 * sin `"type": "module"` en package.json, un `.js` sería CommonJS y no podría
 * exportar el handler que v2 espera. Este módulo también es `.mjs`, por el
 * import estático de abajo. Los demás auxiliares —`_precios`, `_correo`,
 * `_meta`— siguen en CommonJS: no importan paquetes de terceros, así que no
 * les afecta nada de esto.
 *
 * **Si alguien vuelve a poner una función en v1, esto deja de reservar y nadie
 * se entera.** El campo `reserva` del log de `pedido_creado` dice si se apartó
 * de verdad: `reservado` es lo bueno, `sin-almacen` es esto volviendo a pasar.
 */
/* Importación **estática** y arriba del todo, a propósito.
 *
 * Antes esto era un `require('@netlify/blobs')` metido dentro de un try, para
 * que un paquete ausente no tumbara la función al arrancar. Salió el tiro por
 * la culata: el rastreador de dependencias de Netlify no ve un require
 * escondido en el cuerpo de una función, así que no empaquetaba la librería, y
 * en producción el require fallaba con «Cannot find module». La red de
 * seguridad hacía su trabajo —la tienda vendía— pero sin reservar nada.
 *
 * Con un import estático eso no puede volver a pasar: ningún empaquetador ni
 * rastreador lo pasa por alto. Y si algún día no se resuelve, **falla el build**
 * en vez de degradarse en silencio en producción, que es justo el cambio que
 * hacía falta. */
import { getStore } from '@netlify/blobs';
import { SinInventario, nombres, inventario as INV } from './_precios.js';

/* En producción, el almacén de verdad —el nombre no cambia, para no perder la
   cuenta que ya lleva—. En cualquier otro contexto (deploy preview, branch
   deploy) uno aparte: un pedido de prueba no puede descontar existencias
   reales ni bloquear la última unidad de una pieza que sí está a la venta. */
const TIENDA = process.env.CONTEXT === 'production' ? 'inventario' : 'inventario-pruebas';
const CLAVE = 'estado';

/* Cuánto vale una reserva sin pagar. Tiene que cubrir con holgura el viaje a
   Wompi —elegir medio de pago, abrir la app del banco, volver— sin dejar
   inventario congelado media tarde porque alguien abandonó el checkout. */
const VIGENCIA_MS = 30 * 60 * 1000;

/* Reintentos del compare-and-swap. Cada choque significa que otro pedido
   escribió primero; seis sobran para cualquier volumen que esta tienda vaya a
   ver, y si no convergen es que pasa algo raro y se deja pasar la venta. */
const INTENTOS = 6;

/* El almacén se inyecta para las pruebas. En producción es Netlify Blobs; en
   pruebas/inventario.js es una implementación en memoria que respeta las mismas
   reglas de etag, que es lo único que hay que imitar para que el CAS sea real. */
let almacenInyectado = null;
let avisado = false;

function almacen() {
  if (almacenInyectado) return almacenInyectado;
  try {
    /* Consistencia fuerte: con la eventual, una reserva recién escrita puede
       tardar hasta un minuto en verse, que es justo la ventana de la carrera. */
    return getStore({ name: TIENDA, consistency: 'strong' });
  } catch (e) {
    /* Ya no puede ser que falte el paquete —el import estático lo garantiza—,
       así que llegar aquí significa una sola cosa: el entorno no tiene Blobs
       configurado. Pasa al correr las pruebas fuera de Netlify, y pasaría en
       producción si una función volviera a v1. La tienda sigue vendiendo. */
    if (!avisado) {
      console.error('inventario: Blobs no está configurado en este entorno'
        + ' — se vende sin reserva', e.message);
      avisado = true;
    }
    return null;
  }
}

/* Para las pruebas. No se usa en producción. */
function usarAlmacen(falso) { almacenInyectado = falso; }

/* Un brazalete se cuenta por talla; un charm, por pieza. La talla va en la
   clave porque el inventario la distingue: quedan tres de la 20 y cero de la 18. */
const sku = (id, talla) => (talla ? `${id}|${talla}` : id);
const partir = s => { const i = s.indexOf('|'); return i < 0 ? [s, null] : [s.slice(0, i), s.slice(i + 1)]; };

/* Unidades que existen según stock.json, que sigue siendo la fuente de la
   verdad sobre cuánto hay. Este módulo solo lleva la cuenta de lo comprometido.
   Infinity para lo que no tiene conteo: una pieza sin inventario declarado se
   vende como antes de que existiera el archivo. */
function existencias(s) {
  const items = (INV && INV.items) || {};
  const [id, talla] = partir(s);
  const it = items[id];
  if (!it) return Infinity;
  if (talla !== null) {
    if (!it.tallas) return Infinity;
    return +it.tallas[talla] > 0 ? +it.tallas[talla] : 0;
  }
  return typeof it.stock === 'number' ? it.stock : Infinity;
}

/* Qué consume un pedido, en unidades por sku. */
function itemsDe(pedido) {
  const piden = {};
  if (pedido.base) {
    const s = sku(pedido.base.id, pedido.base.talla);
    piden[s] = (piden[s] || 0) + 1;
  }
  pedido.charms.forEach(id => { piden[id] = (piden[id] || 0) + 1; });
  return piden;
}

/* Contra qué versión de stock.json está contando lo vendido. Ver `rebasar()`. */
const BASE = (INV && INV.generado) || '';

const vacio = () => ({ v: 1, base: BASE, vendido: {}, reservas: {} });

/* Cuando se repone inventario, `vendido` tiene que volver a cero.
 *
 * stock.json dice cuántas unidades HAY; este almacén solo lleva la cuenta de lo
 * comprometido desde entonces. Si al reponer una pieza a 5 unidades siguiéramos
 * restando la que se vendió antes, la tienda ofrecería 4 — y el desfase se
 * acumularía con cada venta, para siempre, hasta dejar de vender cosas que
 * están en la mano. Nadie lo notaría: no hay error, solo menos existencias de
 * las reales.
 *
 * El campo `generado` de stock.json es la señal: cuando cambia, el archivo trae
 * un conteo nuevo y lo vendido antes ya está descontado de él.
 *
 * Las reservas en vuelo NO se tocan: son pedidos que alguien está pagando ahora
 * mismo, y esas unidades siguen sin poder venderse a otra persona. */
function rebasar(estado) {
  if (estado.base === BASE) return false;
  estado.base = BASE;
  estado.vendido = {};
  return true;
}

/* Las reservas caducan solas. Se limpian al leer, que es la única vez que hace
   falta: nadie tiene que barrer nada en segundo plano. */
function limpiar(estado, ahora) {
  Object.keys(estado.reservas).forEach(ref => {
    if (!(estado.reservas[ref].vence > ahora)) delete estado.reservas[ref];
  });
}

/* Libre = lo que existe, menos lo vendido, menos lo que otros tienen apartado.
   `salvo` excluye una reserva concreta: al reintentar un CAS con la misma
   referencia, la reserva anterior no debe contarse contra sí misma. */
function libre(estado, s, salvo) {
  let tomado = estado.vendido[s] || 0;
  Object.entries(estado.reservas).forEach(([ref, r]) => {
    if (ref !== salvo) tomado += r.items[s] || 0;
  });
  return existencias(s) - tomado;
}

function describir(s, hay, piden) {
  const [id, talla] = partir(s);
  const nombre = nombres[id] || id;
  if (talla !== null) {
    return hay <= 0
      ? `${nombre} talla ${talla} cm se agotó`
      : `${nombre} talla ${talla} cm: queda${hay === 1 ? '' : 'n'} ${hay}`;
  }
  return hay <= 0
    ? `${nombre} se agotó`
    : `${nombre}: pediste ${piden} y queda${hay === 1 ? '' : 'n'} ${hay}`;
}

const espera = ms => new Promise(r => setTimeout(r, ms));

/* El corazón: aplica `mutar` sobre el estado y lo escribe solo si nadie lo tocó
   mientras tanto. Si lo tocaron, vuelve a leer y lo intenta sobre lo nuevo.
   `mutar` puede lanzar SinInventario, y entonces no se escribe nada. */
async function transaccion(mutar, etiqueta) {
  const store = almacen();
  if (!store) return { ok: true, modo: 'sin-almacen' };

  for (let intento = 0; intento < INTENTOS; intento++) {
    let actual = null;
    try {
      actual = await store.getWithMetadata(CLAVE, { type: 'json' });
    } catch (e) {
      console.error(`inventario/${etiqueta}: no se pudo leer, se deja pasar —`, e.message);
      return { ok: true, modo: 'sin-lectura' };
    }

    const estado = (actual && actual.data) || vacio();
    estado.vendido = estado.vendido || {};
    estado.reservas = estado.reservas || {};
    limpiar(estado, Date.now());
    if (rebasar(estado)) {
      console.log(JSON.stringify({
        evento: 'inventario_repuesto', base: estado.base,
        motivo: 'stock.json cambió: lo vendido vuelve a cero porque el conteo nuevo ya lo descuenta',
      }));
    }

    const salida = mutar(estado);   // SinInventario sale por aquí sin escribir

    let escrito;
    try {
      escrito = await store.setJSON(CLAVE, estado,
        actual ? { onlyIfMatch: actual.etag } : { onlyIfNew: true });
    } catch (e) {
      console.error(`inventario/${etiqueta}: no se pudo escribir, se deja pasar —`, e.message);
      return { ok: true, modo: 'sin-escritura' };
    }

    if (escrito && escrito.modified) return salida;

    /* Otro pedido ganó la carrera. Se relee y se recalcula sobre su estado:
       puede que ahora sí falte, y entonces esta clienta recibe el 409 que le
       corresponde en vez de un cobro que habría que devolver. */
    await espera(15 * (intento + 1));
  }

  /* Seis choques seguidos no es «no hay», es que algo va raro. Se deja pasar,
     como todo lo demás en este proyecto, pero se grita en el log. */
  console.error(`inventario/${etiqueta}: el CAS no convergió en ${INTENTOS} intentos, se deja pasar`);
  return { ok: true, modo: 'sin-converger' };
}

/* Aparta las unidades de un pedido. Lanza SinInventario si no alcanzan —el
   mismo error que ya sabe manejar crear-pago.js, para que el checkout siga
   diciéndole a la clienta qué ajustar. */
async function reservar(referencia, pedido) {
  const piden = itemsDe(pedido);
  return transaccion(estado => {
    const faltan = [];
    Object.entries(piden).forEach(([s, n]) => {
      const hay = libre(estado, s, referencia);
      if (hay < n) faltan.push(describir(s, hay, n));
    });
    if (faltan.length) {
      throw new SinInventario(
        'Se agotó algo de tu selección mientras la armabas: ' + faltan.join('; ')
        + '. Ajusta tu pulsera o escríbenos y lo conseguimos por encargo.');
    }
    estado.reservas[referencia] = { items: piden, vence: Date.now() + VIGENCIA_MS };
    return { ok: true, modo: 'reservado', items: piden };
  }, 'reservar');
}

/* El pago entró (o es contraentrega, que se confirma al crear el pedido): lo
   apartado pasa a vendido y deja de caducar. Idempotente a propósito — Wompi
   reintenta sus avisos, y confirmar dos veces no puede descontar dos veces. */
async function confirmar(referencia) {
  return transaccion(estado => {
    const r = estado.reservas[referencia];
    if (!r) return { ok: true, modo: 'sin-reserva' };
    Object.entries(r.items).forEach(([s, n]) => {
      estado.vendido[s] = (estado.vendido[s] || 0) + n;
    });
    delete estado.reservas[referencia];
    /* Cuántas quedan libres de cada pieza que acaba de salir.
     *
     * Se calcula aquí dentro, sobre el estado ya mutado y dentro del mismo CAS,
     * porque es el único punto del programa donde el número es cierto: leerlo
     * después sería otra lectura, con otras ventas de por medio. Lo consume la
     * hoja de inventario, para que muestre el dato de la fuente de verdad en vez
     * de restar por su cuenta —una hoja que hace su propia cuenta acaba siendo
     * un segundo inventario que discrepa del que decide las ventas—.
     *
     * `Infinity` (pieza sin conteo declarado) viaja como null: no es que queden
     * cero, es que no se lleva la cuenta, y un 0 ahí haría pensar que se agotó. */
    const restante = {};
    Object.keys(r.items).forEach(s => {
      const n = libre(estado, s);
      restante[s] = Number.isFinite(n) ? n : null;
    });
    return { ok: true, modo: 'confirmado', items: r.items, restante };
  }, 'confirmar');
}

/* El pago no llegó, se declinó o se anuló: las unidades vuelven al mostrador
   sin esperar a que caduque la reserva. */
async function liberar(referencia) {
  return transaccion(estado => {
    const habia = Boolean(estado.reservas[referencia]);
    delete estado.reservas[referencia];
    return { ok: true, modo: habia ? 'liberado' : 'sin-reserva' };
  }, 'liberar');
}

/* Lo que hay disponible ahora mismo, sin tocar nada.
 *
 * Existe para el asesor de WhatsApp: `stock.json` dice cuántas unidades se
 * contaron, pero no cuántas están apartadas por un pago en curso ni cuántas ya
 * se vendieron. Un asesor que lea solo el archivo promete piezas que ya tienen
 * dueña — el mismo error que esta reserva vino a arreglar, solo que ahora por
 * WhatsApp y con una persona esperando respuesta.
 *
 * Devuelve el número libre por sku (`id` o `id|talla`). Si no hay almacén,
 * devuelve null en vez de mentir con las existencias en bruto: quien pregunta
 * necesita distinguir «quedan 2» de «no lo sé». */
export async function disponibles(skus) {
  const store = almacen();
  if (!store) return null;

  let estado;
  try {
    estado = (await store.get(CLAVE, { type: 'json' })) || vacio();
  } catch (e) {
    console.error('inventario/disponibles: no se pudo leer —', e.message);
    return null;
  }
  estado.vendido = estado.vendido || {};
  estado.reservas = estado.reservas || {};
  /* Se limpia en memoria y no se escribe: una consulta no debe modificar nada,
     y las caducadas ya no cuentan contra lo libre aunque sigan en el blob. */
  limpiar(estado, Date.now());

  const salida = {};
  skus.forEach(s => { salida[s] = Math.max(0, libre(estado, s, null)); });
  return salida;
}

export { reservar, confirmar, liberar };
/* `itemsDe` y `describir` los usa además `armar-carrito.mjs`, que necesita
   comprobar disponibilidad sin reservar nada y contarlo con las mismas palabras
   con las que se lo contaría el checkout: si el bot de WhatsApp dice «quedan 2»
   donde el checkout diría «se agotó», la clienta ya vio dos verdades distintas
   de la misma tienda. */
export const _interno = { usarAlmacen, itemsDe, libre, existencias, sku, vacio,
  describir, VIGENCIA_MS };
