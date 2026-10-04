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
  const m = doc.replace(/\r\n/g, '\n').match(/```text\n([\s\S]*?)\n```/);   // CRLF en Windows
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
  /* Desde el 2026-10-04 la promo es «paga 3, lleva 1 gratis · paga 5, lleva
     2 gratis», con brazalete y charms contando igual y tope de 2. Se comprueba
     con los números de las reglas, no escritos aquí. */
  const [[p1, g1], [p2, g2]] = [reglas.promo.tramos[0], reglas.promo.tramos[reglas.promo.tramos.length - 1]];
  comprobar(new RegExp(`paga ${p1 - g1} y llevate ${g1} gratis`, 'i').test(prompt) && new RegExp(`paga ${p2 - g2} y llevate ${g2} gratis`, 'i').test(prompt),
    `anuncia «paga ${p1 - g1}, lleva ${g1} gratis» y «paga ${p2 - g2}, lleva ${g2}»`);
  comprobar(/charms y brazaletes cuentan igual/i.test(prompt),
    'dice que el brazalete cuenta como una pieza más');
  comprobar(/MENOR valor sale gratis/i.test(prompt),
    'dice que la gratis es la de menor valor');
  comprobar(new RegExp(`con ${p1} piezas`).test(prompt) && new RegExp(`con ${p2} piezas salen gratis las ${g2}`).test(prompt) && /nunca prometas 3/i.test(prompt),
    `explica los dos tramos (${p1} → ${g1}, ${p2} → ${g2}) y que no pasa de ${g2}`);
  /* La promo vieja no puede seguir anunciándose como vigente: el bot la
     cobraría de palabra y el checkout no. Solo se admite nombrándola para
     decir que cambió. */
  const viejas = prompt.split('\n').filter(l => /\b(8|15|25|30)\s*%/.test(l) && !/ya NO hay|cambio/i.test(l));
  comprobar(!viejas.length, 'no anuncia los porcentajes de la promo vieja como vigentes',
    viejas.length ? viejas[0].slice(0, 80) : '');

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
     web y ahora está publicado: si lo lee ahí y el bot no lo conoce, lo niega.
     Las palabras cambiaron otra vez el 2026-09-27 —«caja de lujo» y «tarjeta
     con dedicatoria» pasaron a ser solo «caja» y «dedicatoria escrita a
     mano»— y la sección 11 vigila esa versión, la que manda hoy. */
  for (const [que, re] of [
    ['la caja', /\bcaja\b/i],
    ['el paño para la plata', /pa[ñn]o para (limpiar )?(la )?(su )?plata/i],
    ['la dedicatoria escrita a mano', /dedicatoria/i],
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

  /* La promo: el chat y la página tienen que decir lo mismo palabra por
     palabra o la clienta cree que son dos ofertas. Desde el 2026-10-02 la
     página dice «¡Paga 3 y llévate 1 gratis!» en el banner (antes, «¡Lleva 4 y el 4° es gratis!»); la redacción del
     2026-09-22 («paga 3 y llévate el cuarto gratis») acompañaba a la escalera
     vieja y ya no sale en ninguna parte. */
  comprobar(/paga 3 y llevate 1 gratis/i.test(prompt),
    'usa la redacción del banner: «¡Paga 3 y llévate 1 gratis!»');

  const promoVieja = prompt.split('\n').filter(l => /paga 3 y ll[eé]vate el cuarto gratis/i.test(l));
  comprobar(promoVieja.length === 0,
    'y ya no usa la de la escalera vieja, «paga 3 y llévate el cuarto gratis»',
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

  console.log('\n10 · El saludo no repite su propia pregunta');

  /* Casi toda clienta llega por un botón de la página con un mensaje ya
     escrito. Ninguno de esos botones pregunta algo concreto —dicen que hay una
     duda, no cuál es—, y el saludo ya invita a contarla. Una clienta real
     escribió el genérico y el bot, siguiendo la regla de «si ya preguntó algo,
     respondele debajo», le agregó una segunda pregunta idéntica a la que el
     saludo acababa de hacer. Se vio robótico en la captura que lo reportó.

     Los textos se leen de los propios botones en index.html —vía el enlace
     wa.me, que es la fuente real— para que esto no se desactualice si algún
     día cambia la redacción del botón. */
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const aperturas = [...html.matchAll(/wa\.me\/\d+\?text=([^"]+)"/g)]
    .map(m => decodeURIComponent(m[1]))
    .filter(s => /tengo una duda|pulseras y charms/i.test(s));
  const unicas = [...new Set(aperturas)];
  comprobar(unicas.length >= 2,
    'encontró los botones genéricos de contacto en index.html para verificar contra ellos',
    `${unicas.length} encontrados`);

  /* `plano` y `promptPlano` ya se declararon en la sección 8: el prompt está
     escrito sin tildes a propósito, y comparar con tildes da falso positivo
     aquí también —ya pasó al escribir esta misma sección—. */
  for (const apertura of unicas) {
    comprobar(promptPlano.includes(plano(apertura)),
      `el prompt cita el botón «${apertura.slice(0, 40)}…», sin tildes pero igual`);
  }

  comprobar(/no le agregues nada debajo|NO le agregues nada debajo/i.test(prompt),
    'y le dice a la IA que NO responda debajo cuando el mensaje es uno de esos genéricos');

  console.log('\n11 · La actualización del 2026-09-27');

  /* `plano` y `promptPlano` ya existen (sección 8): sin tildes de los dos
     lados, porque el prompt no las lleva y el sitio sí. */

  // 1 · Tiempos de entrega, leídos de la página que los publica, no copiados
  //     a mano. Bogotá va SEPARADA de los municipios cercanos.
  const envios = fs.readFileSync(path.join(RAIZ, 'envios-y-devoluciones.html'), 'utf8');
  /* Hay dos tablas en la página —«Cobertura y costos» y «Tiempos de
     entrega»— con la misma forma de fila. Acotar a la segunda, o la prueba
     compara los tiempos contra la tabla equivocada. */
  const seccionTiempos = envios.split(/<h2>2\. Tiempos de entrega<\/h2>/)[1]
    .split(/<h2>/)[0];
  const filas = [...seccionTiempos.matchAll(/<tr><td>([^<]+)<\/td><td>([^<]+)<\/td><\/tr>/g)]
    .map(m => [m[1].trim(), m[2].trim()]);
  comprobar(filas.length >= 4, 'encontró la tabla de tiempos de entrega en envios-y-devoluciones.html',
    `${filas.length} filas`);
  /* El sitio escribe el rango con guion en (1 – 2) y el prompt lo dice en
     prosa (1 a 2 dias) — mismo dato, otra forma. Comparar la frase entera
     sería un falso positivo seguro. Se comparan solo los números: los que
     trae la tabla tienen que aparecer, en ese orden, cerca del nombre del
     destino dentro del prompt. */
  for (const [destino, plazo] of filas) {
    const numeros = plazo.match(/\d+/g) || [];
    // «Ciudades principales (Medellín, Cali...)» en el prompt es «Ciudades
    // principales como Medellin, Cali o Barranquilla»: mismo destino, otra
    // frase. Se busca solo lo que va antes del paréntesis.
    const destinoBuscado = destino.split('(')[0].trim();
    const iDestino = promptPlano.indexOf(plano(destinoBuscado));
    const ventana = iDestino >= 0 ? promptPlano.slice(iDestino, iDestino + 100) : '';
    const numerosVentana = ventana.match(/\d+/g) || [];
    const encajan = numeros.every((n, i) => numerosVentana[i] === n);
    comprobar(iDestino >= 0 && encajan,
      `dice el tiempo de «${destino}»: ${plazo}`,
      iDestino < 0 ? 'no se encontró el destino' : `numeros cerca: ${numerosVentana.join(',')}`);
  }
  comprobar(/pide hoy y te llega manana/i.test(promptPlano),
    'advierte que nunca hay que prometer «pide hoy y llega mañana»');

  // 3 · Empaque: las palabras que la página usa hoy, ninguna de las viejas.
  const empaque = prompt.split('\n').filter(l => /EMPAQUE\./.test(l))[0] || '';
  comprobar(/\bcaja\b/i.test(prompt) && /pa[ñn]o/i.test(prompt) && /dedicatoria/i.test(prompt),
    'nombra caja, paño y dedicatoria como lo incluido');
  const vieja = prompt.split('\n').filter(l =>
    /caja de lujo|tarjeta impresa|con su bolsa/i.test(l) &&
    !/NO digas|no digas/i.test(l));
  comprobar(vieja.length === 0,
    'no queda «caja de lujo», «tarjeta impresa» ni «con su bolsa» afirmándolo',
    vieja.length ? vieja[0].trim().slice(0, 90) : undefined);

  // 5 · Regalo por suscribirse: la condición real sale de _suscriptores.mjs,
  //     no de la memoria de nadie.
  const suscriptores = fs.readFileSync(
    path.join(RAIZ, 'netlify', 'functions', '_suscriptores.mjs'), 'utf8');
  const minCharms = suscriptores.match(/MIN_CHARMS_REGALO\s*=\s*(\d+)/);
  comprobar(!!minCharms, 'encontró MIN_CHARMS_REGALO en _suscriptores.mjs');
  if (minCharms) {
    comprobar(prompt.includes(`${minCharms[1]} charms o mas`),
      `dice la condición real: ${minCharms[1]} charms o más`);
  }
  comprobar(/VERIFICAR REGALO/.test(prompt),
    'deja la etiqueta [VERIFICAR REGALO] para pedidos de suscriptora por WhatsApp');
  comprobar(/SOLO aparecen las letras que tienen unidades/i.test(prompt),
    'no promete una letra sin confirmar unidades');

  // 6 · Enlaces directos por producto: el patrón tiene que ser el real.
  comprobar(prompt.includes('producto-{id}.html'),
    'usa el patrón real de las páginas de producto');
  const ejemploId = 'mickey-mouse';
  comprobar(fs.existsSync(path.join(RAIZ, `producto-${ejemploId}.html`)) &&
    prompt.includes(`producto-${ejemploId}.html`),
    `el ejemplo que da (producto-${ejemploId}.html) existe de verdad`);

  // 7 · Kits: la composición sale de kits.json, no de una lista copiada.
  const KITS = require(path.join(RAIZ, 'assets', 'kits.json')).kits;
  comprobar(prompt.includes('zephoracharms.com/kits.html'),
    'manda a kits.html para el precio real de cada kit');
  for (const k of KITS) {
    const piezas = [k.base, ...k.charms].map(id => CAT.nombres[id]);
    comprobar(piezas.every(nombre => promptPlano.includes(plano(nombre))),
      `el prompt nombra las piezas del «${k.nombre}»`,
      piezas.filter(n => !promptPlano.includes(plano(n))).join(', ') || undefined);
  }
  comprobar(/NUNCA des el precio de un kit de memoria/i.test(prompt),
    'prohíbe dar el precio de un kit de memoria');

  // 8 · Reseñas: no promete nada a cambio.
  comprobar(/resena/i.test(promptPlano) && /nunca promet.*resena|resena.*nunca promet/i.test(promptPlano.replace(/\n/g, ' ')),
    'no promete nada a cambio de una reseña');

  console.log('\n12 · El catálogo en PDF');

  /* El bot ya puede mandar el catálogo como documento (herramienta
     enviar_catalogo). El PDF es una foto del día: los precios los vigila
     pruebas/catalogo-pdf.js, pero las existencias no, así que el prompt tiene
     que obligar a confirmar con disponibilidad antes de cerrar. */
  comprobar(/enviar_catalogo/.test(prompt),
    'conoce la herramienta que manda el catálogo');
  comprobar(!/No tienes un catalogo para enviar/i.test(prompt),
    'ya no le dice a la clienta que no hay catálogo');
  comprobar(/puede estar agotada hoy/i.test(prompt) && /disponibilidad/i.test(prompt),
    'advierte que una pieza del catálogo puede estar agotada y manda a confirmar');

  console.log(fallos
    ? `\nPrompt del bot: ${fallos} en rojo`
    : '\nPrompt del bot en verde ✓');
  if (fallos) process.exitCode = 1;
}

main();
