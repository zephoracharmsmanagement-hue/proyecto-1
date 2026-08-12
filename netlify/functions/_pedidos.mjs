/* Registro de pedidos.
 *
 * ── Por qué existe ──
 *
 * La primera venta real lo dejó claro: el detalle de qué pidió una clienta
 * vivía **solo** en un correo. Si Resend falla, si el correo cae en spam o si
 * alguien lo borra, la tienda cobró y no sabe qué despachar — el log solo dice
 * «2 piezas, $159.440». Hubo que reconstruir el pedido desde el total.
 *
 * Aquí queda guardado el pedido entero, en su propia clave, independiente de
 * que el correo llegue. Sirve además para conciliar contra el panel de Wompi.
 *
 * ── Por qué un almacén aparte y una clave por pedido ──
 *
 * El de inventario es una sola clave que todos los pedidos reescriben con
 * compare-and-swap; meter aquí los pedidos añadiría contención a la pieza más
 * delicada del sistema y la haría crecer sin límite. Con una clave por
 * referencia, cada pedido se escribe una vez y nadie compite con nadie.
 *
 * ── Datos personales ──
 *
 * Esto guarda nombre, teléfono, correo y dirección: hace falta para despachar,
 * y es la misma información que ya viaja en el correo a la tienda. Conviene
 * recordar que está sujeta a la Ley 1581 (habeas data) y que la política de
 * privacidad debe cubrir dónde se guarda. No se guarda **nada** del pago: ni
 * tarjeta ni token, que eso no lo ve el sitio en ningún momento.
 *
 * ── Falla hacia adelante ──
 *
 * Como todo lo que rodea al cobro: si esto no puede escribir, la venta sigue y
 * queda el motivo en el log. Perder el registro es molesto; perder una compra
 * cobrada porque el almacén estaba lento, no.
 */
import { getStore } from '@netlify/blobs';

/* En producción, la tienda de verdad. En cualquier otro contexto —deploy
   preview, branch deploy— una aparte, para que un pedido de prueba no se cuele
   entre los reales. */
const TIENDA = process.env.CONTEXT === 'production' ? 'pedidos' : 'pedidos-pruebas';

let almacenInyectado = null;
let avisado = false;

function almacen() {
  if (almacenInyectado) return almacenInyectado;
  try {
    return getStore({ name: TIENDA, consistency: 'strong' });
  } catch (e) {
    if (!avisado) {
      console.error('pedidos: Blobs no está configurado — no se guarda el registro', e.message);
      avisado = true;
    }
    return null;
  }
}

function usarAlmacen(falso) { almacenInyectado = falso; }

/* Guarda el pedido al crearlo. Una escritura, sin condiciones: la referencia es
   única por diseño, así que nadie más va a tocar esta clave. */
async function guardar(referencia, datos) {
  const store = almacen();
  if (!store || !referencia) return { ok: false, motivo: 'sin almacén' };
  try {
    await store.setJSON(String(referencia), Object.assign({
      referencia, creado: new Date().toISOString(), estado: 'recibido',
    }, datos));
    return { ok: true };
  } catch (e) {
    console.error('pedidos: no se pudo guardar', referencia, e.message);
    return { ok: false, motivo: e.message };
  }
}

/* Anota en qué quedó el pedido cuando Wompi avisa. Se fusiona sobre lo que
   había en vez de reescribirlo: lo que importa conservar es el detalle de las
   piezas y la dirección, que el evento de Wompi no trae. */
async function marcar(referencia, cambios) {
  const store = almacen();
  if (!store || !referencia) return { ok: false, motivo: 'sin almacén' };
  try {
    const previo = await store.get(String(referencia), { type: 'json' });
    /* Sin pedido previo se guarda igual lo que se sepa: es mejor un registro
       parcial que ninguno — pasaría si el pago llega después de que el almacén
       estuviera caído al crear el pedido. */
    await store.setJSON(String(referencia), Object.assign(
      { referencia }, previo || {}, cambios, { actualizado: new Date().toISOString() }));
    return { ok: true, habia: Boolean(previo) };
  } catch (e) {
    console.error('pedidos: no se pudo actualizar', referencia, e.message);
    return { ok: false, motivo: e.message };
  }
}

/* Para consultarlo desde la terminal, sin exponer ningún endpoint nuevo en un
   sitio que cobra:
     netlify blobs:get pedidos ZC-260812-35FCB0D5
   (`netlify blobs --help` lista los subcomandos de la versión instalada). */
async function leer(referencia) {
  const store = almacen();
  if (!store || !referencia) return null;
  try {
    return await store.get(String(referencia), { type: 'json' });
  } catch (e) {
    console.error('pedidos: no se pudo leer', referencia, e.message);
    return null;
  }
}

export { guardar, marcar, leer };
export const _interno = { usarAlmacen, TIENDA };
