/* La hoja de inventario: un aviso por cada venta cobrada.
 *
 * ── Qué problema resuelve ──
 *
 * Hasta ahora la tienda no tenía dónde ver cuánto le quedaba de nada.
 * `stock.json` dice lo que había el día del conteo y lo vendido desde entonces
 * vive en el almacén de Blobs, invisible. Reponer inventario obligaba a
 * preguntarle al propietario qué se había vendido, de memoria — y una memoria no
 * es un inventario.
 *
 * Esto manda cada venta a un webhook (n8n), que escribe la fila en una hoja de
 * cálculo. La hoja es donde se mira; esto es solo el mensajero.
 *
 * ── La regla que no se puede romper ──
 *
 * **La hoja es un espejo, no un mando.** Lo que decide si la tienda puede vender
 * algo sigue siendo `stock.json` más el contador de Blobs. Si la hoja se
 * convirtiera en un inventario paralelo que se edita a mano, habría dos sistemas
 * afirmando cosas distintas sobre la misma pieza — y este proyecto ya sabe cómo
 * acaba eso. Reponer desde la hoja tiene su propio paso explícito, que reescribe
 * `stock.json`; no ocurre por escribir en una celda.
 *
 * Por eso el aviso lleva `quedan`, calculado dentro del mismo CAS que confirma
 * la venta (ver `confirmar()` en `_inventario.mjs`): la hoja **muestra** ese
 * número, no lo deduce. Una hoja que hace su propia resta acaba discrepando del
 * inventario que de verdad manda, y se descubre vendiendo algo que no existe.
 *
 * ── Falla hacia adelante, y aquí de verdad ──
 *
 * Sin `HOJA_WEBHOOK` no se manda nada y no pasa nada. Si n8n está caído o tarda,
 * se anota en el log y la venta sigue su curso. Una hoja de cálculo no puede
 * costar una compra cobrada.
 *
 * Pero ojo con lo aprendido con `CORREO_TIENDA`: «falla hacia adelante» no puede
 * significar «se pierde en silencio». Un aviso que no llega deja la hoja con
 * menos ventas de las reales, o sea con **más existencias de las que hay**, que
 * es la dirección peligrosa del error. Así que cada intento deja línea en el log
 * con su resultado, y `referencia` va en el cuerpo para que n8n pueda descartar
 * duplicados: es preferible reintentar y que la hoja deduplique, a callarse.
 *
 * Variables de entorno:
 *   HOJA_WEBHOOK   URL del webhook de n8n que escribe en la hoja
 *   HOJA_TOKEN     opcional: viaja como cabecera `X-Zephora-Token` para que el
 *                  webhook no acepte filas de cualquiera que sepa la URL
 */

const TIMEOUT_MS = 4000;

/* Una fila por pieza, no por pedido: es lo que hace la hoja legible. Un pedido
   de tres charms son tres movimientos, cada uno con su pieza, su talla y lo que
   queda de ella. Agrupar por pedido obligaría a leer una celda con una lista
   dentro, que en una hoja de cálculo no se puede filtrar ni sumar. */
function movimientos({ referencia, pago, cuando, ciudad, lineas, restante }) {
  const resto = restante || {};
  return (lineas || []).map(l => {
    const sku = l.talla ? `${l.id}|${l.talla}` : l.id;
    const quedan = Object.prototype.hasOwnProperty.call(resto, sku) ? resto[sku] : null;
    return {
      referencia,
      cuando,
      pieza: l.nombre,
      id: l.id,
      talla: l.talla || '',
      unidades: l.unidades,
      /* El precio de la línea ya viene con las unidades multiplicadas y el
         descuento aplicado: es lo que se cobró por esa pieza, no su tarifa. */
      cobrado: l.precio,
      quedan,
      pago,
      ciudad,
    };
  });
}

async function anotarVenta(venta) {
  const url = String(process.env.HOJA_WEBHOOK || '').trim();
  if (!url) return { enviado: false, motivo: 'sin HOJA_WEBHOOK' };

  const filas = movimientos(venta);
  if (!filas.length) return { enviado: false, motivo: 'sin líneas' };

  const cuerpo = {
    tipo: 'venta',
    referencia: venta.referencia,
    cuando: venta.cuando,
    pago: venta.pago,
    total: venta.total,
    movimientos: filas,
  };

  const cabeceras = { 'Content-Type': 'application/json' };
  const token = String(process.env.HOJA_TOKEN || '').trim();
  if (token) cabeceras['X-Zephora-Token'] = token;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: cabeceras,
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!r.ok) {
      console.error(JSON.stringify({
        evento: 'hoja_inventario', referencia: venta.referencia,
        enviado: false, estado: r.status, filas: filas.length,
      }));
      return { enviado: false, motivo: `HTTP ${r.status}` };
    }
    console.log(JSON.stringify({
      evento: 'hoja_inventario', referencia: venta.referencia,
      enviado: true, filas: filas.length,
    }));
    return { enviado: true, filas: filas.length };
  } catch (e) {
    console.error(JSON.stringify({
      evento: 'hoja_inventario', referencia: venta.referencia,
      enviado: false, motivo: e.message, filas: filas.length,
    }));
    return { enviado: false, motivo: e.message };
  }
}

export { anotarVenta };
export const _interno = { movimientos };
