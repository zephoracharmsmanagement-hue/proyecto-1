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
const CAT = require('./catalogo.json');
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
     el propio envío ayudaría a alcanzarlo. */
  const subtotal = brutoC - descC + brutoB - descB + empaque;
  const gratis = subtotal >= reglas.envioGratisDesde;
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

module.exports = { leerPedido, calcular, detallar, cop, PedidoInvalido, reglas, nombres };
