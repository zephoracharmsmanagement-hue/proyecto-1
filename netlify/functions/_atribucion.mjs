/* Las señales del navegador que el webhook de Wompi nunca va a ver.
 *
 * ── Qué problema resuelve ──
 *
 * `_meta.js` ya manda el `Purchase` desde el webhook, y eso cubre a quien pagó
 * y no volvió al sitio. Pero lo manda con lo que Wompi le devuelve: correo,
 * teléfono y nombre. Le faltan las dos señales con las que Meta ata una compra
 * al anuncio que la produjo — las cookies `_fbc` (el clic en el anuncio) y
 * `_fbp` — más la IP y el user-agent de la clienta.
 *
 * Y eso importa más de lo que parece, por el orden en que llegan las cosas. El
 * webhook entra segundos después del pago; la clienta vuelve a gracias.html
 * cuando vuelve, si vuelve. Así que el evento del servidor suele llegar
 * **primero**, y al deduplicar por `event_id` Meta se queda con el primero. El
 * evento que sobrevive es justo el que no tiene atribución.
 *
 * O sea: mandar el evento de servidor pelado no solo no añade atribución —se la
 * quita al del navegador, que sí la traía.
 *
 * ── Cómo ──
 *
 * `crear-pago.mjs` sí recibe la petición del navegador de la clienta, con sus
 * cookies, su IP y su user-agent. Guarda todo eso aquí bajo la referencia del
 * pedido; el webhook lo recoge cuando Wompi confirma.
 *
 * ── Qué se guarda ──
 *
 * Los datos personales se guardan **ya hasheados**, tal como van a viajar a
 * Meta. Este blob no contiene un correo ni un teléfono legibles: quien lo lea
 * no se lleva una lista de clientas. Lo único en claro es lo que Meta exige en
 * claro —las cookies, la IP y el user-agent—, que no identifican a nadie por sí
 * solas.
 *
 * ── Falla hacia adelante ──
 *
 * Igual que la reserva de inventario: si Blobs no responde, se registra y se
 * sigue. El evento saldrá con menos datos, que es peor que con ellos pero mejor
 * que no cobrar.
 *
 * El import de @netlify/blobs es estático a propósito. Estuvo dentro de un try
 * para que un paquete ausente no tumbara la función, y salió el tiro por la
 * culata: el rastreador de dependencias de Netlify no ve un require escondido
 * en el cuerpo de una función y la librería no viajaba en el bundle. Ver la
 * cabecera de _inventario.mjs.
 */
import { getStore } from '@netlify/blobs';

const TIENDA = 'atribucion';

/* Cuánto se guardan las señales esperando el pago. Cubre con holgura el viaje a
   la pasarela y los reintentos del webhook, sin dejar datos de clientas ahí
   más tiempo del que hacen falta. */
const VIGENCIA_MS = 24 * 60 * 60 * 1000;

let almacenInyectado = null;
export function usarAlmacen(falso) { almacenInyectado = falso; }

function almacen() {
  if (almacenInyectado) return almacenInyectado;
  try {
    /* Consistencia fuerte: el webhook puede entrar segundos después de que
       crear-pago escriba, que es justo la ventana en la que una lectura
       eventual devolvería nada. */
    return getStore({ name: TIENDA, consistency: 'strong' });
  } catch (e) {
    console.error('atribucion: no hay almacén —', e.message);
    return null;
  }
}

/* Guarda las señales de un pedido. Nunca lanza. */
export async function guardar(referencia, senales) {
  const store = almacen();
  if (!store || !referencia) return { ok: true, modo: 'sin-almacen' };
  try {
    await store.setJSON(referencia, { v: 1, vence: Date.now() + VIGENCIA_MS, ...senales });
    return { ok: true, modo: 'guardado' };
  } catch (e) {
    console.error('atribucion: no se pudieron guardar las señales —', e.message);
    return { ok: true, modo: 'sin-escritura' };
  }
}

/* Las recoge y las borra.
 *
 * Se borra siempre, con el pago aprobado o rechazado: un pedido se cobra una
 * vez, y dejarlas ahí sería guardar datos de clientas que nadie va a volver a
 * mirar. Es también lo que mantiene chico el almacén — lo único que queda
 * suelto son los pedidos que nunca llegaron a la pasarela, y para esos está
 * `vence`. */
export async function tomar(referencia) {
  const store = almacen();
  if (!store || !referencia) return null;

  let datos = null;
  try {
    datos = await store.get(referencia, { type: 'json' });
  } catch (e) {
    console.error('atribucion: no se pudieron leer las señales —', e.message);
  }
  try {
    await store.delete(referencia);
  } catch (e) {
    console.error('atribucion: no se pudieron borrar las señales —', e.message);
  }

  /* Caducadas se tratan como ausentes: un fbc de hace un mes no atribuye nada. */
  if (datos && datos.vence && datos.vence < Date.now()) return null;
  return datos;
}

export const _interno = { VIGENCIA_MS, TIENDA };
