/* Los pedidos que se quedaron a medio pagar.
 *
 * ── Por qué existe, y por qué no hace falta rastrear el carrito ──
 *
 * La forma habitual de recuperar carritos abandonados es seguirle la pista al
 * carrito del navegador y adivinar quién lo dejó. Aquí no hace falta: hay un
 * momento en el que la clienta ya dio su nombre, su correo, su celular y las
 * piezas que quiere, y es justo antes de irse a la pasarela. Si después no
 * aparece un pago aprobado, **eso es un carrito abandonado con contacto
 * completo**, sin cookies ni conjeturas.
 *
 * Y el proyecto ya llevaba media cuenta: la reserva de inventario aparta las
 * unidades 30 minutos esperando ese pago. Lo único que faltaba era guardar a
 * quién pertenecían.
 *
 * ── Qué se guarda y por cuánto ──
 *
 * Esto SÍ guarda datos personales en claro —nombre, correo, celular—, a
 * diferencia del almacén de atribución, que solo guarda hashes. No hay forma de
 * escribirle a alguien con un hash.
 *
 * Por eso el borrado no es opcional y tiene tres caminos:
 *   · La clienta pagó        → se borra al confirmar. Ya no hay nada que recuperar.
 *   · Se le escribió y no volvió → se borra al caducar (CADUCIDAD_MS).
 *   · Nunca se le escribió    → se borra igual al caducar.
 *
 * Nada se queda para siempre. Bajo la Ley 1581 los datos se guardan para la
 * finalidad con la que se dieron, y la finalidad aquí se agota en días.
 *
 * ── Una sola vez ──
 *
 * A cada pedido se le escribe UN mensaje. El campo `avisado` lo garantiza, y se
 * marca ANTES de mandar: si el envío falla se pierde el aviso, que es mucho
 * mejor que mandarlo dos veces. Una clienta que recibe dos correos por el mismo
 * carrito no vuelve, se da de baja.
 */
import { getStore } from '@netlify/blobs';

const TIENDA = 'pendientes';

/* Cuánto se espera antes de escribir.
 *
 * La reserva de inventario dura 30 minutos, pero eso no basta como referencia:
 * un pago por PSE puede tardar más —el banco responde cuando responde— y
 * escribirle «no terminaste» a alguien que está pagando en ese momento es la
 * peor versión de esto. Con 45 minutos, quien seguía pagando ya terminó. */
export const ESPERA_MS = 45 * 60 * 1000;

/* Cuándo se borra el registro pase lo que pase. Una semana cubre de sobra la
   ventana en la que un recordatorio tiene sentido; después son datos de alguien
   que no compró, guardados sin motivo. */
export const CADUCIDAD_MS = 7 * 24 * 60 * 60 * 1000;

let almacenInyectado = null;
export function usarAlmacen(falso) { almacenInyectado = falso; }

function almacen() {
  if (almacenInyectado) return almacenInyectado;
  try {
    return getStore({ name: TIENDA, consistency: 'strong' });
  } catch (e) {
    console.error('pendientes: no hay almacén —', e.message);
    return null;
  }
}

/* Anota un pedido que salió hacia la pasarela. Nunca lanza: esto es una
   herramienta de recuperación, no puede costar una venta. */
export async function anotar(referencia, datos) {
  const store = almacen();
  if (!store || !referencia) return { ok: true, modo: 'sin-almacen' };
  try {
    await store.setJSON(referencia, {
      v: 1,
      referencia,
      creado: Date.now(),
      avisado: null,
      estado: 'esperando',
      ...datos,
    });
    return { ok: true, modo: 'anotado' };
  } catch (e) {
    console.error('pendientes: no se pudo anotar', referencia, '—', e.message);
    return { ok: true, modo: 'sin-escritura' };
  }
}

/* La clienta pagó: ya no hay nada que recuperar y no hay por qué seguir
   guardando sus datos. Idempotente — Wompi reintenta sus avisos. */
export async function cerrar(referencia) {
  const store = almacen();
  if (!store || !referencia) return { ok: true, modo: 'sin-almacen' };
  try {
    await store.delete(referencia);
    return { ok: true, modo: 'cerrado' };
  } catch (e) {
    console.error('pendientes: no se pudo cerrar', referencia, '—', e.message);
    return { ok: true, modo: 'sin-borrado' };
  }
}

/* El pago se declinó o se anuló. NO se borra: un pago rechazado es justo el
   caso donde un mensaje sirve más —la clienta quería comprar y el banco dijo
   que no— y se le puede ofrecer otro medio. Solo se deja anotado. */
export async function marcarFallido(referencia, estado) {
  const store = almacen();
  if (!store || !referencia) return { ok: true, modo: 'sin-almacen' };
  try {
    const p = await store.get(referencia, { type: 'json' });
    if (!p) return { ok: true, modo: 'sin-registro' };
    await store.setJSON(referencia, { ...p, estado: String(estado || 'fallido').toLowerCase() });
    return { ok: true, modo: 'marcado' };
  } catch (e) {
    console.error('pendientes: no se pudo marcar', referencia, '—', e.message);
    return { ok: true, modo: 'sin-escritura' };
  }
}

/* Todo lo que hay guardado. Lo usa la función programada; el volumen de esta
   tienda hace que recorrerlo entero sea más simple y más barato que llevar un
   índice que puede desincronizarse. */
export async function listar() {
  const store = almacen();
  if (!store) return [];
  let claves;
  try {
    const r = await store.list();
    claves = (r && r.blobs) || [];
  } catch (e) {
    console.error('pendientes: no se pudo listar —', e.message);
    return [];
  }

  const salida = [];
  for (const b of claves) {
    try {
      const p = await store.get(b.key, { type: 'json' });
      if (p) salida.push(p);
    } catch (e) {
      console.error('pendientes: no se pudo leer', b.key, '—', e.message);
    }
  }
  return salida;
}

/* Marca que ya se le escribió. Se llama ANTES de mandar el correo a propósito:
   ver la cabecera de este archivo. */
export async function anotarAviso(referencia) {
  const store = almacen();
  if (!store || !referencia) return false;
  try {
    const p = await store.get(referencia, { type: 'json' });
    if (!p || p.avisado) return false;
    await store.setJSON(referencia, { ...p, avisado: Date.now() });
    return true;
  } catch (e) {
    console.error('pendientes: no se pudo anotar el aviso', referencia, '—', e.message);
    return false;
  }
}

/* ¿A este pedido le toca mensaje?
 *
 * Separado del envío para poder probar la decisión sin mandar nada: es donde
 * está la lógica que puede escribirle a quien no debe. */
export function toca(p, ahora = Date.now()) {
  if (!p || p.avisado) return false;
  if (!p.cliente || !p.cliente.correo) return false;
  const edad = ahora - (p.creado || 0);
  return edad >= ESPERA_MS && edad < CADUCIDAD_MS;
}

export const caduco = (p, ahora = Date.now()) =>
  ahora - ((p && p.creado) || 0) >= CADUCIDAD_MS;

export const _interno = { TIENDA };
