'use strict';
/* El catálogo en PDF que el bot de WhatsApp le manda a las clientas, contra lo
 * que la tienda cobra de verdad.
 *
 * ── Por qué existe ──
 *
 * Un PDF es una copia congelada de 120 precios. El día que uno cambie en la
 * tienda, el PDF sigue diciendo el viejo, y la clienta llega al checkout con
 * otro número en la cabeza. Este proyecto ya perdió ventas así con textos más
 * cortos que este.
 *
 * El PDF no se puede leer desde aquí sin librerías, así que
 * `herramientas/catalogo_pdf.py` extrae sus precios a
 * `assets/catalogo-zephora-charms.json` al publicarlo. Esta prueba contrasta
 * ESE archivo contra `assets/catalogo.json`, que es con el que cobra el
 * servidor.
 *
 * Si se pone en rojo: regenerar el catálogo con precios nuevos y volver a
 * correr el script. Nunca editar el JSON a mano para que pase —el JSON describe
 * al PDF, no a la tienda—.
 *
 * ── Qué NO mira ──
 *
 * Existencias. El PDF lista lo que tenía unidades el día que se generó; si hoy
 * algo está agotado, eso lo resuelve el bot preguntándole a `disponibilidad`
 * antes de cerrar. Vigilarlo aquí pondría la prueba en rojo cada vez que se
 * vende la última unidad de algo.
 */
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

const PDF = path.join(RAIZ, 'assets', 'catalogo-zephora-charms.pdf');
const PRECIOS = path.join(RAIZ, 'assets', 'catalogo-zephora-charms.json');
const CAT = require(path.join(RAIZ, 'assets', 'catalogo.json'));

console.log('\n1 · Los dos archivos, juntos');

comprobar(fs.existsSync(PDF), 'existe el PDF que manda el bot');
comprobar(fs.existsSync(PRECIOS), 'existe su lista de precios');
if (!fs.existsSync(PDF) || !fs.existsSync(PRECIOS)) {
  console.log('\nCatálogo PDF: falta un archivo');
  process.exit(1);
}

/* Se descarga por los datos del celular desde WhatsApp. El original pesaba
   15 MB; el script lo deja en ~3. Si vuelve a subir, alguien lo reemplazó sin
   pasar por el script, y entonces el JSON tampoco describe ese PDF. */
const mb = fs.statSync(PDF).size / 1e6;
comprobar(mb < 6, 'pesa lo que pesa comprimido, no el original', `${mb.toFixed(1)} MB`);

const hoja = JSON.parse(fs.readFileSync(PRECIOS, 'utf8'));
const precios = hoja.precios || {};
comprobar(Object.keys(precios).length >= 50, 'la lista trae las piezas del PDF',
  `${Object.keys(precios).length} piezas · ${hoja.vigentes || 'sin fecha de vigencia'}`);

console.log('\n2 · Lo que el PDF dice contra lo que la tienda cobra');

const desconocidas = Object.keys(precios).filter(id => !(id in CAT.precios));
comprobar(desconocidas.length === 0,
  'toda pieza del PDF sigue existiendo en la tienda',
  desconocidas.length ? desconocidas.join(', ') : undefined);

const distintas = Object.entries(precios)
  .filter(([id, p]) => id in CAT.precios && CAT.precios[id] !== p)
  .map(([id, p]) => `${CAT.nombres[id]}: PDF $${p.toLocaleString('es-CO')} · tienda $${CAT.precios[id].toLocaleString('es-CO')}`);
comprobar(distintas.length === 0,
  'ningún precio del PDF contradice catalogo.json',
  distintas.length ? distintas.slice(0, 5).join(' | ') : undefined);

console.log(fallos
  ? `\nCatálogo PDF: ${fallos} en rojo — regenerarlo con herramientas/catalogo_pdf.py`
  : '\nCatálogo PDF en verde ✓');
if (fallos) process.exitCode = 1;
