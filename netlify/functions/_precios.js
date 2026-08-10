'use strict';
/* Cálculo del total, del lado del servidor.
 *
 * La página ya calcula el total mientras la clienta arma la pulsera, pero ese
 * número no sirve para cobrar: viaja por el navegador y cualquiera lo cambia
 * antes de enviarlo. Lo único que se acepta del cliente es QUÉ pidió —una lista
 * de identificadores—; el CUÁNTO se calcula aquí, desde catalogo.json.
 *
 * Las reglas son las mismas que las de index.html y salen del mismo sitio:
 * herramientas/extraer_catalogo.py las copia del HTML, y pruebas/precios.js
 * comprueba que este archivo y el navegador den el mismo total.
 */
const CAT = require('../../assets/catalogo.json');
const INV = require('../../assets/stock.json');
const { precios, nombres, pulseras, reglas } = CAT;
const ESP = new Set(pulseras);

/* Tope de piezas por pedido. No es una regla de negocio, es un cortafuegos:
   sin él, un carrito con 10.000 charms genera un cobro absurdo. */
const MAX_CHARMS = 60;

const escala = n => (n <= 0 ? 0 : reglas.escalaCharms[Math.min(n, reglas.escalaCharms.length - 1)]);

class PedidoInvalido extends Error {}

/* Normaliza lo que llegó por la red antes de tocarlo. Todo lo que no reconozca
   lo rechaza en vez de ignorarlo: un charm que se cae en silencio es un pedido
   que llega incompleto y una clienta que reclama con razón. */
function leerPedido(cuerpo) {
  if (!cuerpo || typeof cuerpo !== 'object') throw new PedidoInvalido('Pedido vacío');

  const charms = Array.isArray(cuerpo.charms) ? cuerpo.charms : [];
  if (charms.length > MAX_CHARMS) {
    throw new PedidoInvalido(`Máximo ${MAX_CHARMS} charms por pedido`);
  }
  charms.forEach(id => {
    if (typeof id !== 'string' || !(id in precios)) {
      throw new PedidoInvalido(`Charm desconocido: ${String(id).slice(0, 40)}`);
    }
    if (ESP.has(id)) throw new PedidoInvalido(`${id} es un brazalete, no un charm`);
  });

  let base = null;
  if (cuerpo.base) {
    const id = cuerpo.base.id;
    if (typeof id !== 'string' || !ESP.has(id)) {
      throw new PedidoInvalido(`Brazalete desconocido: ${String(id).slice(0, 40)}`);
    }
    const talla = cuerpo.base.talla == null ? null : String(cuerpo.base.talla);
    if (talla !== null && !/^(17|18|19|20|21)$/.test(talla)) {
      throw new PedidoInvalido(`Talla no válida: ${talla.slice(0, 10)}`);
    }
    base = { id, talla };
  }

  if (!base && charms.length === 0) throw new PedidoInvalido('El pedido no tiene piezas');

  const pago = cuerpo.pago === 'contraentrega' ? 'contraentrega' : 'anticipado';
  return { base, charms, pago, empaque: cuerpo.empaque === true };
}

/* ¿Hay de verdad lo que se está pidiendo?
 *
 * El navegador ya lo comprueba —bloquea el botón al llegar al tope y esconde
 * las tallas sin unidades—, pero eso vive en el cliente y el cliente no manda.
 * Peor: entre que se arma la pulsera y se paga pueden pasar horas, y el
 * inventario pudo cambiar en el medio. Cobrar algo que no existe obliga a
 * devolver el dinero, que bajo la Ley 1480 no es solo una molestia.
 *
 * Esto NO resuelve la carrera de dos clientas comprando la última unidad en el
 * mismo minuto: para eso hace falta reservar, y reservar necesita un almacén
 * con estado. Sí cierra el caso corriente, que es pagar algo agotado desde
 * hace rato o pedir tres de algo que tiene uno.
 */
function comprobarInventario(pedido) {
  const items = (INV && INV.items) || {};
  /* Sin inventario cargado se deja pasar: una lectura fallida no puede
     bloquear la venta, igual que en la tienda. */
  if (!Object.keys(items).length) return;

  const faltan = [];

  if (pedido.base) {
    const it = items[pedido.base.id];
    if (it && it.tallas) {
      const t = pedido.base.talla;
      if (!t) faltan.push(`${nombres[pedido.base.id]}: falta elegir la talla`);
      else if (!(+it.tallas[t] > 0)) {
        const libres = Object.keys(it.tallas).filter(k => +it.tallas[k] > 0);
        faltan.push(`${nombres[pedido.base.id]} talla ${t} cm se agotó`
          + (libres.length ? ` (quedan ${libres.join(', ')} cm)` : ''));
      }
    }
  }

  const cuenta = {};
  pedido.charms.forEach(id => { cuenta[id] = (cuenta[id] || 0) + 1; });
  Object.entries(cuenta).forEach(([id, piden]) => {
    const it = items[id];
    if (!it || typeof it.stock !== 'number') return;   // pieza sin conteo: pasa
    if (it.stock <= 0) faltan.push(`${nombres[id]} se agotó`);
    else if (piden > it.stock) {
      faltan.push(`${nombres[id]}: pediste ${piden} y queda${it.stock === 1 ? '' : 'n'} ${it.stock}`);
    }
  });

  if (faltan.length) {
    throw new SinInventario(
      'Se agotó algo de tu selección mientras la armabas: ' + faltan.join('; ')
      + '. Ajusta tu pulsera o escríbenos y lo conseguimos por encargo.');
  }
}

/* Se distingue de PedidoInvalido a propósito: un pedido inválido huele a
   manipulación y no merece explicación; este es un caso legítimo que hay que
   contarle bien a la clienta para que corrija y siga comprando. */
class SinInventario extends Error {}

/* El mismo cálculo que hace la página, con los mismos redondeos y en el mismo
   orden. Si esto y render() en index.html se separan, pruebas/precios.js falla. */
function calcular(pedido) {
  const nC = pedido.charms.length;
  const brutoC = pedido.charms.reduce((s, id) => s + precios[id], 0);
  const descC = brutoC * escala(nC);

  const brutoB = pedido.base ? precios[pedido.base.id] : 0;
  const descB = (pedido.base && nC >= reglas.minCharmsParaDescuento)
    ? brutoB * reglas.descuentoBrazalete
    : 0;

  const empaque = pedido.empaque ? reglas.empaque : 0;

  /* El umbral de envío gratis mide mercancía, no total: si contara el envío,
     el propio envío ayudaría a alcanzarlo. Y el beneficio es solo del prepago:
     la contraentrega le cuesta a la tienda la comisión de recaudo y el riesgo
     de devolución, así que ahí el envío se cobra siempre. */
  const subtotal = brutoC - descC + brutoB - descB + empaque;
  const alcanza = subtotal >= reglas.envioGratisDesde;
  const gratis = alcanza
    && (!reglas.envioGratisSoloAnticipado || pedido.pago === 'anticipado');
  const envio = (subtotal <= 0 || gratis) ? 0 : reglas.envio[pedido.pago];

  /* Wompi cobra en centavos y en enteros. Se redondea una sola vez, al final:
     redondear cada línea deja el total descuadrado frente al que vio la
     clienta en pantalla. */
  const total = Math.round(subtotal + envio);

  return {
    brutoCharms: brutoC,
    brutoBrazalete: brutoB,
    descuento: Math.round(descC + descB),
    empaque,
    subtotal: Math.round(subtotal),
    envio,
    envioGratis: gratis,
    total,
    centavos: total * 100,
  };
}

/* Renglones legibles para el correo, el WhatsApp y el resumen del pedido. */
function detallar(pedido) {
  const lineas = [];
  if (pedido.base) {
    lineas.push({
      id: pedido.base.id,
      nombre: nombres[pedido.base.id].replace(/^Pulsera /, 'Brazalete '),
      talla: pedido.base.talla,
      unidades: 1,
      precio: precios[pedido.base.id],
    });
  }
  const cuenta = {};
  pedido.charms.forEach(id => { cuenta[id] = (cuenta[id] || 0) + 1; });
  Object.entries(cuenta).forEach(([id, n]) => {
    lineas.push({ id, nombre: nombres[id], talla: null, unidades: n, precio: precios[id] * n });
  });
  if (pedido.empaque) {
    lineas.push({
      id: 'empaque', nombre: 'Empaque Premium de Regalo',
      talla: null, unidades: 1, precio: reglas.empaque,
    });
  }
  return lineas;
}

const cop = n => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

module.exports = { leerPedido, comprobarInventario, calcular, detallar, cop,
  PedidoInvalido, SinInventario, reglas, nombres };
