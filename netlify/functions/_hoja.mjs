/* La hoja de inventario: un aviso por cada venta, ajuste o cancelación.
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

/* Lo que de verdad se cobró por una línea. `l.precio` es la tarifa de lista
   por las unidades; la promo «paga N, lleva 1» deja `l.gratis` unidades de esa
   línea en $0 (detallar() en _precios.js). Restarlas aquí hace que la suma de
   `cobrado` de un pedido sea su subtotal real: antes la pieza gratis salía en
   la hoja a precio de lista (las Mariposas de ZC-261009-CCA4B571). */
function cobradoDe(l) {
  const n = l.unidades || 1;
  return Math.round(l.precio - (l.gratis || 0) * (l.precio / n));
}

/* En una venta manual el precio lo puso el chat, no la lista: se reparte el
   total cobrado entre las líneas en proporción a su tarifa, y el redondeo cae
   en la última, para que sumen exactamente lo cobrado. */
function prorrateo(lineas, total) {
  const bruto = lineas.reduce((s, l) => s + (l.precio || 0), 0);
  if (!bruto || typeof total !== 'number') return lineas.map(cobradoDe);
  let resto = total;
  return lineas.map((l, i) => {
    if (i === lineas.length - 1) return resto;
    const c = Math.round(total * (l.precio || 0) / bruto);
    resto -= c;
    return c;
  });
}

const nombreDe = c => (!c ? '' : typeof c === 'string' ? c
  : [c.nombre, c.apellido].filter(Boolean).join(' ')).trim();

/* Una fila por pieza, no por pedido: es lo que hace la hoja legible. Un pedido
   de tres charms son tres movimientos, cada uno con su pieza, su talla y lo que
   queda de ella. Agrupar por pedido obligaría a leer una celda con una lista
   dentro, que en una hoja de cálculo no se puede filtrar ni sumar.

   `tipo` decide los signos:
     venta        unidades vendidas (+), cobrado de la línea
     ajuste       unidades con signo: − lo que sale (faltante, dañada…),
                  + lo que entra (sobrante); sin cobrado
     cancelacion  unidades que vuelven (+), cobrado en negativo: sumada la
                  columna, una venta cancelada queda en cero
   `total` es el del pedido —lo cobrado, con envío— repetido en cada fila. */
function movimientos({ referencia, pago, cuando, ciudad, lineas, restante,
  tipo = 'venta', cliente, canal, total, estado, motivo, signo, prorratear }) {
  const resto = restante || {};
  const ls = lineas || [];
  const cobros = prorratear ? prorrateo(ls, total) : ls.map(cobradoDe);
  return ls.map((l, i) => {
    const sku = l.talla ? `${l.id}|${l.talla}` : l.id;
    const quedan = Object.prototype.hasOwnProperty.call(resto, sku) ? resto[sku] : null;
    const n = l.unidades || 1;
    return {
      referencia,
      cuando,
      pieza: l.nombre,
      id: l.id,
      talla: l.talla || '',
      unidades: tipo === 'ajuste' ? (signo < 0 ? -n : n) : n,
      cobrado: tipo === 'ajuste' ? null : tipo === 'cancelacion' ? -cobros[i] : cobros[i],
      quedan,
      pago: pago || '',
      ciudad: ciudad || '',
      tipo,
      cliente: nombreDe(cliente),
      canal: canal || '',
      total: typeof total === 'number' ? total : null,
      estado: estado || '',
      motivo: motivo || '',
    };
  });
}

async function enviarHoja(datos) {
  const url = String(process.env.HOJA_WEBHOOK || '').trim();
  if (!url) return { enviado: false, motivo: 'sin HOJA_WEBHOOK' };

  const filas = movimientos(datos);
  if (!filas.length) return { enviado: false, motivo: 'sin líneas' };

  const cuerpo = {
    tipo: datos.tipo || 'venta',
    referencia: datos.referencia,
    cuando: datos.cuando,
    pago: datos.pago,
    total: datos.total,
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
        evento: 'hoja_inventario', tipo: cuerpo.tipo, referencia: datos.referencia,
        enviado: false, estado: r.status, filas: filas.length,
      }));
      return { enviado: false, motivo: `HTTP ${r.status}` };
    }
    console.log(JSON.stringify({
      evento: 'hoja_inventario', tipo: cuerpo.tipo, referencia: datos.referencia,
      enviado: true, filas: filas.length,
    }));
    return { enviado: true, filas: filas.length };
  } catch (e) {
    console.error(JSON.stringify({
      evento: 'hoja_inventario', tipo: cuerpo.tipo, referencia: datos.referencia,
      enviado: false, motivo: e.message, filas: filas.length,
    }));
    return { enviado: false, motivo: e.message };
  }
}

/* Una venta cobrada (o una contraentrega en firme). */
const anotarVenta = venta => enviarHoja(Object.assign({}, venta, { tipo: 'venta' }));

/* Un ajuste de inventario que no es venta (ajustar-inventario.mjs). */
const anotarAjuste = ajuste => enviarHoja(Object.assign({}, ajuste, { tipo: 'ajuste' }));

/* Una venta deshecha. `quedan` ya con la unidad devuelta (el restante de
   anular()). La referencia lleva «/cancelacion»: el flujo de n8n empareja las
   filas por referencia + id + talla, y con la referencia de la venta tal cual
   la cancelación SOBRESCRIBIRÍA la fila de la venta en vez de sumarse. */
const anotarCancelacion = c => enviarHoja(Object.assign({}, c, {
  tipo: 'cancelacion', referencia: `${c.referencia}/cancelacion`, estado: c.estado || 'cancelado',
}));

export { anotarVenta, anotarAjuste, anotarCancelacion };
export const _interno = { movimientos, cobradoDe, prorrateo };
