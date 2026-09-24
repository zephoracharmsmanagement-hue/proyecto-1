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

  console.log('\n1 · El material, que ya costó una venta en cada dirección');

  /* Esta comprobación NO sabe de qué está hecho un brazalete, y es a propósito.
     El material cambió dos veces en cinco días —el 18 de septiembre los
     brazaletes pasaron a Plata 925, el 22 volvieron a baño de plata porque el
     dato del proveedor era erróneo— y las dos veces el prompt del bot se quedó
     atrás afirmando lo contrario que el servidor.

     La primera versión de esta prueba escribía la verdad a mano, así que en el
     segundo giro no solo no avisó: pasó a EXIGIR la afirmación falsa. Una
     prueba que se equivoca en la misma dirección que el código no protege de
     nada, y encima da confianza.

     Así que la dirección la lee del único sitio donde el material es dato y no
     prosa: los campos `material` de `disponibilidad.mjs`, que es lo que el bot
     recibe en cada consulta. Si vuelve a cambiar, esto cambia solo. */
  const FUENTE = path.join(RAIZ, 'netlify', 'functions', 'disponibilidad.mjs');
  const servidor = fs.readFileSync(FUENTE, 'utf8');

  function materialDe(empuja) {
    const bloque = servidor.slice(servidor.indexOf(empuja));
    const m = bloque.match(/material:\s*'([^']+)'/);
    if (!m) throw new Error(`no se encontró el material de ${empuja} en ${FUENTE}`);
    return m[1];
  }
  const matBrazalete = materialDe('brazaletes.push(');
  const matCharm = materialDe('piezas.push(');
  const es925 = s => /925/.test(s);

  console.log(`  · según el servidor: charm «${matCharm}» · brazalete «${matBrazalete}»`);

  comprobar(es925(matCharm),
    'el servidor sigue diciendo que los charms son Plata 925',
    'si esto cambia, revisa el resto de esta sección antes que nada');

  comprobar(/Plata Esterlina 925/i.test(prompt),
    'el prompt nombra la Plata Esterlina 925 de los charms');

  /* Una AFIRMACIÓN sobre el brazalete es una línea que lo nombra junto al
     material, sin ninguna señal de que lo esté prohibiendo o corrigiendo. Las
     reglas que arreglan el problema nombran las dos cosas a la vez —«el
     brazalete NO es Plata 925: es baño de plata»— y contarlas como afirmación
     fue un falso positivo real en la primera corrida de esta prueba. */
  const niega = /NUNCA|NO es|no es\b|no digas|jamas|jam[áa]s|dejo de ser|dej[óo] de ser|en vez de|de memoria/i;

  /* Por trozo de frase, no por línea entera. La primera línea del prompt dice
     «charms en Plata Esterlina 925 y brazaletes con bano de plata»: nombra las
     dos familias y los dos materiales, y es exactamente la frase correcta. Una
     línea que contenga «brazalete» y «925» no afirma nada por sí sola — hay que
     mirar a qué familia está pegado cada material. */
  const trozos = prompt.split('\n')
    .filter(l => !niega.test(l))
    .flatMap(l => l.split(/[,;:.·]| y /))
    .filter(s => /brazalete|pulsera/i.test(s));

  const dicen925 = trozos.filter(s => /925|plata esterlina/i.test(s));
  const dicenBanio = trozos.filter(s => /ba[ñn]o de plata|ba[ñn]ad|enchapad|lat[oó]n/i.test(s));

  const [debe, noDebe, comoSeLlama] = es925(matBrazalete)
    ? [dicen925, dicenBanio, 'Plata 925']
    : [dicenBanio, dicen925, 'baño de plata'];

  comprobar(debe.length > 0,
    `el prompt afirma que el brazalete es ${comoSeLlama}, igual que el servidor`);

  comprobar(noDebe.length === 0,
    `y ninguna línea le atribuye al brazalete lo contrario`,
    noDebe.length ? noDebe[0].trim().slice(0, 100) : undefined);

  /* El error de fondo de las dos veces no fue un material equivocado: fue una
     frase que mete a las dos familias en el mismo saco. Mientras sean
     materiales distintos, el prompt no puede tener ninguna. */
  if (es925(matCharm) !== es925(matBrazalete)) {
    const enElMismoSaco = prompt.split('\n').filter(l =>
      /toda? la joyeria|toda? la joyer[íi]a|todo (lo que vendemos|es plata)|todo el catalogo|todo el cat[áa]logo/i.test(l) &&
      /925|plata/i.test(l) && !niega.test(l));
    comprobar(enElMismoSaco.length === 0,
      'no mete charms y brazaletes en el mismo saco: son materiales distintos',
      enElMismoSaco.length ? enElMismoSaco[0].trim().slice(0, 100) : undefined);
  }

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

  console.log('\n5 · Qué hace cuando algo está agotado');

  /* Preguntaron por la Libélula Morada, estaba agotada, y el bot contestó
     «colgantes de mariposas, flores o algo en tono morado» sin nombrar una sola
     pieza real. Nadie compra una descripción. La causa estaba en el servidor
     —`disponibilidad` no devolvía el grupo— y se arregló ahí, pero el prompt
     tiene que pedirlo explícitamente o el modelo vuelve a generalizar. */
  comprobar(/apenas la repongamos|cuando la repongamos|aviso de reposicion/i.test(prompt),
    'promete avisar cuando se reponga');

  comprobar(/campo `?grupo`?/i.test(prompt),
    'usa el campo grupo para buscar alternativas del mismo estilo');

  comprobar(/NOMBRALAS|con nombre propio|nombre y foto/i.test(prompt),
    'exige nombrar las piezas alternativas, no describirlas en abstracto');

  console.log('\n6 · El saludo, que lo lee toda clienta nueva');

  comprobar(!/\*\*/.test(prompt),
    'sin asteriscos dobles: WhatsApp usa uno solo y con dos se ven los símbolos');

  comprobar(/ADDI SI SE ACEPTA|ADDI SÍ SE ACEPTA/i.test(prompt),
    'Addi sigue declarado como medio de pago aceptado');

  console.log('\n7 · Lo que la tienda publicó el 2026-09-22');

  /* Tres cambios del sitio que el prompt tenía que alcanzar, y que no dan error
     en ninguna parte si se quedan atrás: Addi pasó de estar escondido en un
     acordeón a anunciarse en el carrito y en el checkout, se publicó lo que va
     gratis con cada pedido, y la promo cambió de redacción sin cambiar de
     mecánica. */

  /* Addi. El fallo peligroso no era negarlo —eso ya estaba arreglado— sino
     meterlo en la lista de medios que se eligen dentro del checkout, porque ahí
     no está: Wompi no lo soporta y no hay ningún botón. Mandarla a buscarlo la
     deja dando vueltas en la pantalla de pago. */
  const lineaMedios = prompt.split('\n').find(l => /^MEDIOS DE PAGO/.test(l)) || '';
  comprobar(!/addi/i.test(lineaMedios),
    'no mete Addi en la lista de medios que se eligen en el checkout',
    /addi/i.test(lineaMedios) ? lineaMedios.slice(0, 90) : undefined);

  comprobar(/3 cuotas sin interes|3 CUOTAS SIN INTERES/i.test(prompt),
    'dice la frase pública de Addi: hasta 3 cuotas sin interés');

  comprobar(/no hay ningun boton de Addi|Wompi no lo soporta/i.test(prompt),
    'advierte que en el checkout no hay botón de Addi');

  /* Lo que va gratis con cada pedido. El paño nunca se había mencionado en la
     web y ahora está publicado: si lo lee ahí y el bot no lo conoce, lo niega. */
  for (const [que, re] of [
    ['la caja de lujo', /caja de lujo/i],
    ['el paño para la plata', /pa[ñn]o para (limpiar )?(la )?(su )?plata/i],
    ['la tarjeta con dedicatoria', /tarjeta con dedicatoria/i],
  ]) {
    comprobar(re.test(prompt), `nombra ${que} entre lo que va incluido sin costo`);
  }

  /* Y no ofrece ninguna caja de pago. Se quitó el upsell de «cajas premium»
     porque la página ya llama «de lujo» a la que va incluida: ofrecer algo por
     encima le hace dudar de la que sí le llega. Misma heurística por contexto
     que el material: la palabra puede aparecer, pero solo en una línea que la
     prohíba. */
  const ofreceCaja = prompt.split('\n').filter(l =>
    /cajas? premium|empaque (especial|de pago)/i.test(l) &&
    !/no ofrezcas|NO OFREZCAS|SE RETIRO|no existe|no lo menciones/i.test(l));
  comprobar(ofreceCaja.length === 0,
    'no ofrece ninguna caja ni empaque de pago por encima del incluido',
    ofreceCaja.length ? ofreceCaja[0].trim().slice(0, 90) : undefined);

  /* La promo: misma mecánica (ya comprobada arriba contra `reglas`), redacción
     nueva. El chat y la página tienen que decir lo mismo palabra por palabra o
     la clienta cree que son dos ofertas. */
  comprobar(/paga 3 y ll[eé]vate el cuarto gratis/i.test(prompt),
    'usa la redacción nueva de la promo: paga 3 y llévate el cuarto gratis');

  const promoVieja = prompt.split('\n').filter(l => /lleva 4 y paga 3/i.test(l));
  comprobar(promoVieja.length === 0,
    'y ya no usa la vieja «lleva 4 y paga 3», que la página retiró',
    promoVieja.length ? promoVieja[0].trim().slice(0, 90) : undefined);

  console.log('\n8 · Los nombres de pieza que el prompt escribe a mano');

  /* El prompt cita una pieza por su nombre: el ejemplo con el que se le enseña
     a buscar alternativas por concepto. Cuando la tienda renombró cuatro piezas
     —Luciérnaga «You Are My Light» → Luciérnaga Evangeline, y tres «Bola» →
     «Murano»—, la única que el prompt nombraba a mano resultó ser una de ellas.
     Nada falló: el bot seguía ofreciendo un nombre que la clienta ya no veía.
     Por eso los nombres citados se declaran aquí y se contrastan contra
     catalogo.json, que es lo que ve la página. */
  const NOMBRES_CITADOS = ['Luciernaga Evangeline'];

  /* El prompt está escrito sin tildes a propósito, así que comparar exige
     quitarlas de los dos lados. Buscar «Luciérnaga» con tilde da cero y parece
     que está limpio. */
  const plano = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const delCatalogo = new Set(Object.values(CAT.nombres).map(plano));
  const promptPlano = plano(prompt);

  for (const nombre of NOMBRES_CITADOS) {
    comprobar(promptPlano.includes(plano(nombre)),
      `el prompt sigue citando «${nombre}»`);
    comprobar(delCatalogo.has(plano(nombre)),
      `y «${nombre}» sigue siendo el nombre que la clienta ve en la página`);
  }

  console.log('\n9 · No promete un aviso o un silencio que no puede cumplir');

  /* El bot le puede ofrecer a la clienta hablar con una persona, pero solo
     tiene tres herramientas conectadas —disponibilidad, armar_carrito,
     enviar_foto— y ninguna le avisa a nadie ni pausa la conversación. Esas dos
     cosas existen en el workflow (aviso al propietario, marcar chat como
     humano) pero se disparan solas por otros caminos —un envío fallido, que el
     propietario escriba a mano—, nunca porque la IA lo decida. Si el prompt le
     hace decir «ya avisé» o «no responderé más», es la misma familia de fallo
     que Addi o el material: una promesa que el sistema no respalda. */
  const prometeAviso = /ya (le )?avis[eé]|ya (le )?not|ya (le )?dej[eé] la notificaci[oó]n/i;
  const prometeSilencio = /no (te )?volver[eé] a responder|no enviar[eé] m[aá]s respuestas|me quedar[eé] (en silencio|callad)/i;

  const lineasAviso = prompt.split('\n').filter(l => prometeAviso.test(l));
  comprobar(lineasAviso.length === 0,
    'no hay ninguna frase de «ya avisé», que el bot no puede cumplir',
    lineasAviso.length ? lineasAviso[0].trim().slice(0, 90) : undefined);

  const lineasSilencio = prompt.split('\n').filter(l => prometeSilencio.test(l));
  comprobar(lineasSilencio.length === 0,
    'no hay ninguna promesa de silencio, que el bot tampoco puede cumplir',
    lineasSilencio.length ? lineasSilencio[0].trim().slice(0, 90) : undefined);

  comprobar(/no tienes forma de avisarle a nadie|no es una herramienta que tengas/i.test(prompt),
    'el propio prompt le explica a la IA por qué no debe prometerlo');

  comprobar(/en breve (te )?escribe|en breve te escriben/i.test(prompt),
    'ofrece la alternativa honesta: el equipo revisa el chat y escribe en breve');

  console.log(fallos
    ? `\nPrompt del bot: ${fallos} en rojo`
    : '\nPrompt del bot en verde ✓');
  if (fallos) process.exitCode = 1;
}

main();
