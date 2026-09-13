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

/* El brazalete de cada día: el más barato que todavía tenga unidades.
 *
 * Estuvo clavado a $58.000 —el precio que tenía la gama baja— y era la misma
 * falta que este archivo denuncia arriba: el 13 de septiembre subió toda la
 * tabla $10.000 y la batería del checkout se puso roja sin que el sitio
 * tuviera nada mal. El precio se lee de la pieza elegida, así que las
 * aserciones que lo usan siguen cuadrando cualquiera que sea la tabla. */
function brazalete() {
  const hit = pulseras()
    .filter(([, v]) => conUnidades(v.tallas).length)
    .sort((a, b) => a[1].precio - b[1].precio)[0];
  exigir(hit, 'ningún brazalete con unidades');
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

module.exports = { brazalete, ultimaUnidad, unaSolaTalla };
