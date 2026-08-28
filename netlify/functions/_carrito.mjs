/* El carrito, escrito en una URL.
 *
 * ── Por qué es un archivo aparte ──
 *
 * Este formato lo escriben dos funciones —`reanudar` para el correo de
 * recuperación, `armar-carrito` para el bot de WhatsApp— y lo leen dos páginas
 * —`index.html` y `checkout.html`—. Son cuatro sitios que tienen que estar de
 * acuerdo sobre la misma gramática.
 *
 * Las dos páginas ya tienen cada una su copia del lector, y eso no se puede
 * evitar: no comparten código. Lo que sí se puede evitar es que además haya dos
 * copias del escritor, y `pruebas/reanudar.js` § 3 comprueba la salida de aquí
 * contra la expresión regular real de los dos HTML — así que mientras el
 * escritor sea uno solo, esa comprobación cubre los cuatro sitios a la vez. Con
 * dos escritores cubriría uno y el otro podría separarse en silencio.
 *
 * Es la lección de `CLAUDE.md` § *Cómo se reparte el trabajo entre sesiones*
 * aplicada a una función de trece líneas: el riesgo de este repo no son los
 * conflictos de git, es construir dos veces la misma pieza.
 *
 * ── La gramática ──
 *
 *   p=id                 una unidad
 *   p=id*3               tres unidades
 *   p=id@19              brazalete de la talla 19
 *   p=a@19,b*2,c         todo junto, separado por comas
 *   e=1                  empaque de regalo
 *   pago=contraentrega   forma de pago
 *
 * Lo que está en su valor por defecto no se escribe: una URL que viaja en un
 * correo o en un WhatsApp se lee, y `&e=0&pago=anticipado` es ruido.
 */

/* De carrito a parámetros. El carrito es `{base, charms, empaque, pago}`, la
   misma forma que guardan las páginas en localStorage y que acepta
   `leerPedido()` en _precios.js. */
export function comoUrl(carrito) {
  const cuenta = {};
  carrito.charms.forEach(id => { cuenta[id] = (cuenta[id] || 0) + 1; });
  const trozos = [];
  if (carrito.base) {
    trozos.push(carrito.base.talla ? `${carrito.base.id}@${carrito.base.talla}` : carrito.base.id);
  }
  Object.entries(cuenta).forEach(([id, n]) => trozos.push(n > 1 ? `${id}*${n}` : id));
  const q = new URLSearchParams();
  q.set('p', trozos.join(','));
  if (carrito.empaque) q.set('e', '1');
  if (carrito.pago === 'contraentrega') q.set('pago', 'contraentrega');
  return q;
}
