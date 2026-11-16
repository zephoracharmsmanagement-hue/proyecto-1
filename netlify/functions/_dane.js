'use strict';
/* Código DANE (DIVIPOLA, 5 dígitos) del municipio de un pedido.
 *
 * Skydropx Colombia cotiza por código y el checkout no pide ninguno. La tabla
 * `assets/codigos-dane.json` la arma `herramientas/codigos_dane.mjs` con las
 * mismas ciudades que ofrece el checkout (`assets/colombia.json`).
 *
 * Solo casa el nombre exacto que guarda el checkout, dentro de su
 * departamento. Un «Otro municipio» escrito a mano devuelve null a propósito:
 * adivinar un municipio parecido mandaría un paquete a otro pueblo. Con null,
 * esa guía la revisa una persona.
 *
 * CommonJS, como _precios.js: así el JSON entra con `require` y el empaquetador
 * lo incluye sin tocar `included_files`.
 */
const TABLA = require('../../assets/codigos-dane.json').departamentos;

const propio = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

function codigoDane(departamento, ciudad) {
  if (!propio(TABLA, departamento)) return null;
  const ciudades = TABLA[departamento];
  return propio(ciudades, ciudad) ? ciudades[ciudad] : null;
}

module.exports = { codigoDane };
