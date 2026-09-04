/* Qué brazalete usan las pruebas — elegido del inventario, no escrito a mano.
 *
 * Estaba clavado a `pulsera-avengers` en seis baterías. El 22 de agosto se
 * vendió su última unidad y media suite se puso roja **con el sitio en lo
 * cierto**: el servidor rechazaba, bien rechazado, un brazalete agotado. Un
 * rojo así es peor que no tener prueba, porque enseña a ignorar el rojo.
 *
 * Es exactamente lo que ESTADO.md ya recoge —«las pruebas no clavan datos del
 * catálogo: los leen de stock.json»—, que hasta ahora se había aplicado a las
 * cifras y no a las piezas. Vender es lo normal en una tienda; que vender
 * rompa la suite, no.
 *
 * Cada función se cae con un mensaje que dice qué falta, en vez de devolver
 * `undefined` y dejar que reviente quince aserciones más abajo con otra cara.
 */
const path = require('path');
const INV = require(path.join(__dirname, '..', 'assets', 'stock.json')).items;
/* El nombre visible sale del catálogo: es lo que la clienta lee en el correo,
   y las aserciones del comprobante lo buscan por ahí. */
const NOMBRES = require(path.join(__dirname, '..', 'assets', 'catalogo.json')).nombres;

const pulseras = () => Object.entries(INV).filter(([, v]) => v.tipo === 'pulsera');
const conUnidades = tallas => Object.entries(tallas || {}).filter(([, n]) => n > 0);

function exigir(v, queHaceFalta) {
  if (!v) throw new Error(
    `No hay en stock.json ${queHaceFalta}. Las pruebas eligen la pieza del ` +
    `inventario a propósito; si el catálogo se quedó sin ninguna que sirva, ` +
    `hay que reponer o revisar assets/stock.json.`);
  return v;
}

/* El brazalete de cada día: con unidades y a $58.000, que es el precio sobre el
   que están escritos los totales de las aserciones del checkout. */
function brazalete() {
  const hit = pulseras().find(([, v]) => v.precio === 58000 && conUnidades(v.tallas).length);
  exigir(hit, 'ningún brazalete de $58.000 con unidades');
  return { id: hit[0], talla: conUnidades(hit[1].tallas)[0][0], precio: hit[1].precio,
    nombre: NOMBRES[hit[0]] };
}

/* Para lo que hay que probar sobre la última unidad: una talla con exactamente
   una, para que venderla deje el resto en cero. */
function ultimaUnidad() {
  for (const [id, v] of pulseras()) {
    const sola = conUnidades(v.tallas).find(([, n]) => n === 1);
    if (sola) return { id, talla: sola[0], precio: v.precio };
  }
  return exigir(null, 'ningún brazalete con una talla de una sola unidad');
}

/* Para comprobar que las tallas sin existencias salen deshabilitadas y no
   escondidas: un brazalete con una sola talla disponible de las que muestra. */
function unaSolaTalla() {
  const hit = pulseras().find(([, v]) =>
    conUnidades(v.tallas).length === 1 && Object.keys(v.tallas).length >= 1);
  exigir(hit, 'ningún brazalete con una sola talla disponible');
  return { id: hit[0], talla: conUnidades(hit[1].tallas)[0][0] };
}

/* Un charm con exactamente una unidad, para probar el tope por existencias.
 *
 * Estaba clavado a `clip-mariposas-de-colores` en pruebas/stock.js, con un
 * comentario «// stock 1» al lado. El 4 de septiembre se vendió esa unidad y la
 * aserción se puso roja con el sitio en lo cierto: el charm salía «Agotado»,
 * que es justo lo que tiene que salir. Mismo fallo que el de `brazalete()`, en
 * la otra mitad del catálogo. */
/* Las letras quedan fuera: el catálogo las pinta en una sola tarjeta
   `data-id="letras"`, así que no hay `.pc[data-id="letra-n"]` que clicar. */
function charmDeUnaUnidad() {
  const hit = Object.entries(INV).find(([id, v]) =>
    v.tipo === 'charm' && v.stock === 1 && !/^letra-/.test(id));
  exigir(hit, 'ningún charm con una sola unidad y tarjeta propia');
  return { id: hit[0], precio: hit[1].precio, nombre: NOMBRES[hit[0]] };
}

module.exports = { brazalete, ultimaUnidad, unaSolaTalla, charmDeUnaUnidad };
