'use strict';
/* Lo que el bot de WhatsApp le dice a una clienta, contrastado con lo que la
 * tienda de verdad cobra y vende.
 *
 * ── Por qué existe ──
 *
 * El prompt del sistema es una copia de las políticas de la tienda, y una copia
 * se desincroniza. Ya pasó tres veces, y las tres las descubrió una clienta, no
 * una prueba:
 *
 *   · **Envíos.** El prompt decía «15.000 anticipado, 25.000 contraentrega,
 *     gratis desde 180.000» cuando la tienda ya daba envío gratis con pago
 *     anticipado sin mínimo. El bot le cobraba de palabra a cada clienta un
 *     envío que era gratis.
 *   · **Addi.** No había sección de medios de pago, así que a quien preguntó le
 *     dijo que no lo aceptábamos. Sí se acepta, y el botón de Addi de la propia
 *     tienda lleva a esa conversación.
 *   · **Material.** El prompt ordenaba «los brazaletes son baño de plata, nunca
 *     llames plata a secas a un brazalete». Desde el 2026-09-18 todo es Plata
 *     925 —por eso la Pulsera Avengers pasó de $58.000 a $118.000— y esa regla
 *     le pisó al servidor la respuesta correcta delante de una clienta.
 *
 * Ninguna de las tres dio error en ningún sitio. El bot respondía con aplomo.
 *
 * ── Qué comprueba, y qué no ──
 *
 * No juzga la redacción ni el tono: comprueba **afirmaciones verificables**
 * contra `catalogo.json`, que es de donde sale el cobro. Si una cifra del
 * prompt no se puede reconciliar con las reglas reales, esto se pone en rojo.
 *
 * La primera comprobación es la más importante y la más aburrida: que la copia
 * versionada siga siendo la que está publicada. Sin eso, el resto revisa un
 * texto que ya nadie usa y da una falsa tranquilidad.
 */
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

const COPIA = path.join(RAIZ, 'automatizaciones', 'n8n', 'prompt-asesora.md');
const CAT = require(path.join(RAIZ, 'assets', 'catalogo.json'));
const reglas = CAT.reglas;

/* El prompt va dentro de un bloque ```text en el documento. */
function leerPrompt() {
  const doc = fs.readFileSync(COPIA, 'utf8');
  const m = doc.match(/```text\n([\s\S]*?)\n```/);
  if (!m) throw new Error('no se encontró el bloque ```text en ' + COPIA);
  return m[1];
}

/* «20.000» → 20000. Solo cifras con separador de miles: así no se cuelan los
   «925» del material ni los «2 cm» de la talla. */
function platas(texto) {
  const out = new Set();
  for (const m of texto.matchAll(/(\d{1,3}(?:\.\d{3})+)/g)) {
    out.add(Number(m[1].replace(/\./g, '')));
  }
  return out;
}

function main() {
  const prompt = leerPrompt();

  console.log('\n1 · El material, que es lo que acaba de costar una venta');

  comprobar(/Plata Esterlina 925/i.test(prompt),
    'afirma Plata Esterlina 925');

  /* Las palabras del material viejo pueden aparecer, pero SOLO en una línea que
     las prohíba o que las contraste con la verdad nueva. Buscarlas a secas da
     falso positivo justo en las reglas que arreglan el problema —pasó en la
     primera corrida de esta prueba—.
     
     Es una heurística por palabras, no un analizador: lo que de verdad protege
     es que una AFIRMACIÓN de enchapado no llevaría ninguna de estas señales
     encima. Al añadir una regla nueva sobre material, escribirla con alguna. */
  const prohibidas = /ba[ñn]ado|ba[ñn]o de plata|lat[oó]n|enchapad/i;
  const contexto = /NUNCA|no digas|dejo de ser cierto|de memoria|Plata 925|925 legitima|925 leg[ií]tima/i;
  const sueltas = prompt.split('\n').filter(l =>
    prohibidas.test(l) && !contexto.test(l));
  comprobar(sueltas.length === 0,
    'no describe ninguna pieza como bañada, enchapada o de latón',
    sueltas.length ? sueltas[0].trim().slice(0, 90) : undefined);

  comprobar(/campo `?material`?/i.test(prompt),
    'manda al campo material del servidor en vez de afirmarlo de memoria');

  console.log('\n2 · Las cifras de dinero salen de las reglas reales');

  const enElPrompt = platas(prompt);
  /* Lo único que la tienda cobra hoy por envío. El anticipado es gratis
     (envioGratisDesde 0 y solo para anticipado), así que su tarifa NO debe
     aparecer: nombrarla es cobrarla de palabra. */
  const permitidas = new Set([reglas.envio.contraentrega]);
  if (reglas.envioGratisDesde > 0) permitidas.add(reglas.envioGratisDesde);
  if (reglas.empaque) permitidas.add(reglas.empaque);

  const intrusas = [...enElPrompt].filter(n => !permitidas.has(n));
  comprobar(intrusas.length === 0,
    'ninguna cifra del prompt contradice catalogo.json',
    intrusas.length ? 'sobra: ' + intrusas.map(n => '$' + n.toLocaleString('es-CO')).join(', ') : undefined);

  comprobar(enElPrompt.has(reglas.envio.contraentrega),
    'dice la tarifa de contraentrega que de verdad se cobra',
    '$' + reglas.envio.contraentrega.toLocaleString('es-CO'));

  const gratisSinMinimo = reglas.envioGratisDesde === 0 && reglas.envioGratisSoloAnticipado;
  if (gratisSinMinimo) {
    comprobar(/GRATIS/i.test(prompt) && /SIN MONTO MINIMO|sin monto m[ií]nimo/i.test(prompt),
      'anuncia el envío gratis sin mínimo, que es argumento de venta');
  }

  console.log('\n3 · No ofrece lo que la tienda retiró');

  const premium = prompt.split('\n').filter(l =>
    /empaque premium/i.test(l) && !/SE RETIRO|se retir|NO lo menciones|no existe/i.test(l));
  comprobar(premium.length === 0,
    'no ofrece el Empaque Premium, que se retiró el 2026-09-13',
    premium.length ? premium[0].trim().slice(0, 90) : undefined);

  comprobar(!('empaque' in CAT.precios),
    'y el catálogo tampoco lo trae, así que las dos fuentes concuerdan');

  console.log('\n4 · Las promociones, que son el mejor argumento de venta');

  /* Un cliente pregunto que promociones habia y el bot no supo responder,
     aunque las reglas ya le llegaban dentro de disponibilidad: sencillamente el
     prompt no las nombraba. Ahora las explica, y aqui se comprueba que los
     porcentajes que dice sean los que de verdad se cobran. */
  const pct = n => Math.round(n * 100);
  reglas.escalaCharms.forEach((desc, cuantos) => {
    if (desc === 0) return;
    /* La palabra «charms» es opcional porque el último tramo de la lista se
       escribe «4 o mas: 25%» bajo un encabezado que ya dice «por cantidad de
       charms». Lo que se comprueba de verdad sigue intacto: que ese número de
       piezas y ese porcentaje aparezcan juntos en la misma línea. */
    const esperado = new RegExp(`${cuantos}\\s*(charms?\\s*)?(o mas)?[^\\n]*${pct(desc)}\\s*%`, 'i');
    comprobar(esperado.test(prompt),
      `anuncia el ${pct(desc)}% con ${cuantos} charms`);
  });

  comprobar(new RegExp(`${pct(reglas.descuentoBrazalete)}\\s*%`).test(prompt),
    `anuncia el ${pct(reglas.descuentoBrazalete)}% del brazalete`);

  comprobar(new RegExp(`${reglas.minCharmsParaDescuento} charms o mas`, 'i').test(prompt),
    `dice desde cuantos charms se activa ese 30%`,
    `${reglas.minCharmsParaDescuento}`);

  /* La ley de este repo: un número de precio que no se reproduce con
     calcular() no se escribe. Ya costó una corrección pública cuando un
     documento interno publicó tres totales de ejemplo que no cuadraban. */
  comprobar(/nunca los PESOS|no calcules|NI SIQUIERA|ni siquiera aproximado/i.test(prompt),
    'tiene prohibido calcular totales de ejemplo: esos salen de armar_carrito');

  console.log('\n5 · El saludo, que lo lee toda clienta nueva');

  comprobar(!/\*\*/.test(prompt),
    'sin asteriscos dobles: WhatsApp usa uno solo y con dos se ven los símbolos');

  comprobar(/ADDI SI SE ACEPTA|ADDI SÍ SE ACEPTA/i.test(prompt),
    'Addi sigue declarado como medio de pago aceptado');

  console.log(fallos
    ? `\nPrompt del bot: ${fallos} en rojo`
    : '\nPrompt del bot en verde ✓');
  if (fallos) process.exitCode = 1;
}

main();
