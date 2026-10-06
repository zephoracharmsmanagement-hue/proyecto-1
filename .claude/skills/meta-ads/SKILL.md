---
name: meta-ads
description: Cómo pauta Zephora Charms en Meta Ads (Facebook e Instagram) — el método de Felipe Vergara aterrizado a la cuenta real, con su árbol de diagnóstico, reglas de prueba y escalamiento, públicos, creativos y copy. Úsala siempre que se toque la pauta: auditar o diagnosticar una campaña, decidir si pausar, escalar o cambiar presupuesto, leer ROAS, CAC, CPA o CTR, armar campañas, conjuntos o anuncios, crear públicos, escribir copy o ganchos, planear creativos, o cuando se usen las herramientas del conector de Meta Ads (ads_*) — aunque quien pregunta no diga «Meta» ni «pauta» y solo pregunte por qué no se vende, qué anuncio funciona o cuánto se puede gastar.
---

# Pauta en Meta Ads — Zephora Charms

El método viene del curso de Felipe Vergara: el ciclo de ventas, los 7 elementos
de la venta, oferta, segmentación, niveles de conciencia, diversificación
creativa y análisis financiero. Esta skill no lo repite en abstracto: lo aplica a
una cuenta concreta con restricciones concretas, y en varios puntos el método
genérico da el diagnóstico equivocado si no se tienen en cuenta. Esos puntos
están marcados.

**Los costos, márgenes y utilidades no están aquí y no deben estar**: el
repositorio es público. Viven en la *Guía de pauta Zephora*, un documento
privado del propietario
(<https://claude.ai/code/artifact/39108b7b-5ec8-46f8-ac10-9776d356d8bc>, se lee
con las herramientas de Claude Docs). Cuando un cálculo necesite margen o costo,
sale de ahí o se le pregunta al propietario en el chat — nunca se escribe en un
archivo del repo.

## Reglas que no se negocian

1. **Nada que gaste plata sin aprobación.** Crear, activar, pausar, duplicar o
   cambiar presupuesto, puja, evento de optimización o público: primero se
   muestra la estructura exacta (ver «Cómo proponer un cambio») y se espera el
   sí. Aunque el conector tenga permisos de escritura. Leer datos va directo.
2. **No se inventa.** Testimonios, objeciones, reseñas y cifras salen de ventas,
   conversaciones y facturas reales. Lo que es estimación se dice que es
   estimación.
3. **Manda la venta real y su margen, no el CTR.** En esta cuenta ya pasó: la
   «Copia 4» tenía el mejor CTR (15,43%) y era de las peores en costo por
   checkout. Escalar por CTR habría escalado la peor.
4. **Un cambio a la vez.** Hipótesis → variable → prueba → resultado →
   decisión. Si cambian presupuesto, público y creativo juntos, no se aprende
   nada.
5. **Precio y material salen del sitio el día del anuncio.** Hoy: charms en
   Plata Esterlina 925 verificada; **brazaletes en baño de plata** (nunca
   «plata» a secas); brazaletes a 78/82/88 mil. Ya cambiaron dos veces en una
   semana: verificar en `assets/stock.json` y `tienda.js`, no de memoria.
6. **No se nombra a Pandora en un anuncio.** La compatibilidad es real y está en
   el sitio, pero en el texto de un anuncio es riesgo de marca registrada. Se
   dice «compatible con pulseras de sistema modular». Pandora sí puede ir como
   interés en la segmentación, que no se ve.
   **Los nombres de personajes (Marvel, Disney, Pixar) sí se pueden usar**:
   el propietario confirmó el 2026-09-25 que tiene permiso. Se escriben con el
   nombre, una sola versión.
7. **El inventario sale de `assets/stock.json` en `main`**, que es lo que
   vende el sitio, no de cifras escritas en `CLAUDE.md` u otros documentos (se
   desactualizan: en septiembre de 2026 seguían diciendo «faltan 14 letras»
   cuando faltaban 2). Si la rama local difiere de `main`, decirlo. Antes de
   empujar un producto con pauta, confirmar que tiene unidades: pagar por
   mandar gente a una pieza agotada es el peor gasto posible.

## El estado de la cuenta, que cambia casi todo

Verificar lo vigente antes de afirmarlo (`ads_get_ad_accounts`,
`ads_get_ad_entities`, `CLAUDE.md` § Meta Ads, `ESTADO.md` § 4a). Hasta la
última verificación:

- La cuenta con las campañas (`1583713932705268`) **no tiene portafolio
  comercial**. De ahí salen las tres limitaciones siguientes. Reclamarla hacia
  el portafolio «Zephora Charms» es manual, en Business Settings. En agosto Meta
  lo bloqueaba por antigüedad del portafolio; al 2026-10-03 ya tenía ~7 semanas
  y se reintentó, y **el 2026-10-06 todavía no se había podido reclamar**
  (sigue abierta la vía de soporte de Meta). **Plan B si sigue bloqueado:** la cuenta
  `2021753038744595` ya está dentro del portafolio, activa, en COP y con medio
  de pago. No hace falta crear otra cuenta ni otro píxel.
- **Dos píxeles.** El viejo (`2130673404542988`) es el único que la cuenta puede
  usar para optimizar y para públicos, y no recibe compras de servidor. El nuevo
  (`1029982529813994`) sí recibe el `Purchase` del webhook de Wompi y de
  `registrar-venta.mjs` (contraentrega y WhatsApp), pero la cuenta no lo tiene
  compartido. Los dos reciben **los mismos eventos de navegador** desde el 13
  de agosto, así que mudarse al nuevo no arranca de cero.
- **Para diagnosticar la CAPI, mirar el píxel nuevo.** El viejo marca
  `server_last_fired_time` en época cero por diseño: nunca podrá tener CAPI. Un
  análisis externo (oct 2026) concluyó «la CAPI nunca ha funcionado» por mirar el
  viejo. La pregunta real es otra: el nuevo registró solo **3 `Purchase` de
  servidor en 28 días, todos en la misma hora del 29 de septiembre** (y del 29 de
  septiembre al 6 de octubre, 5 del navegador y 1 de servidor, con una
  contraentrega cancelada de por medio). Antes de
  culpar a la cuenta, comparar contra las ventas reales del periodo: si hubo
  más, faltan registros en `registrar-venta` o el webhook no los reportó.
- **Sin catálogo** (la cuenta sin portafolio no puede tenerlo): nada de anuncios
  de catálogo ni dinámicos hasta el reclamo.
- **El público similar está inactivo** (semilla muy chica).
- **El checkout no guarda los UTMs en el pedido.** El origen de una venta web no
  queda registrado solo; se anota a mano.
- **`InitiateCheckout` ya no se cuenta doble (corregido el 24 de septiembre,
  visible en la cuenta desde el 27).** Antes se disparaba al tocar «Comprar»
  (`tienda.js`) y otra vez al cargar `checkout.html`, sin `eventID` común, y Meta
  no los deduplicaba. El commit `464366f` dejó **un solo evento, el de
  `checkout.html`** (`tienda.js` ya no lo manda). Consecuencias, todas ya
  medidas: los checkouts reportados cayeron a más o menos la mitad (de ~70 a
  ~35 por semana con el mismo gasto), el costo por checkout reportado casi se
  duplicó sin que nada empeorara, y **cualquier comparación que cruce el 27 de
  septiembre es inválida sin corregirla**. Los clics de compra a WhatsApp que
  cuentan como checkout siguen siendo intencionales; el botón flotante y el
  banner van como `Contact`.
- **Buena parte de la venta se cierra por WhatsApp**, fuera de lo que el píxel
  puede ver.

Consecuencia: **Meta ve una fracción de las ventas.** En la última revisión
atribuyó 2 compras en un mes en que hubo varias más pagadas por Wompi,
contraentrega y WhatsApp.

## Diagnóstico: el orden importa

### Paso 0 — ¿Meta está viendo las ventas reales?

Antes de cualquier regla de CTR o ROAS: comparar las compras que atribuye Meta
con las ventas reales del mismo periodo (hoja de ventas del propietario,
correos de pedido de Wompi, contraentregas). Si la diferencia es grande, **el
problema es de medición, no de la campaña**, y las reglas de abajo que usan
«compras» o «ROAS» no se pueden aplicar con los números de Meta.

Este paso existe porque el árbol genérico, aplicado a esta cuenta, falla: con
un CTR de enlace alto y «sin compras», manda a arreglar la oferta o la landing,
cuando las ventas sí están ocurriendo y lo que falla es el píxel.

**Dos cosas que desvían el paso 0:**

- **La contraentrega se cuenta al confirmar, no al recibir.** El `Purchase` de
  una venta contraentrega sale cuando se confirma el pedido, así que **una
  cancelación posterior sigue contada en Meta como compra**. Pasó en la semana
  del 29 de septiembre al 6 de octubre: de 5 compras del navegador y 1 de
  servidor, una contraentrega se canceló. Al contrastar con las ventas reales,
  descontar las canceladas y las devueltas.
- **Antes de comparar dos periodos, revisar si el sitio cambió cómo mide.**
  `git log origin/main -S"InitiateCheckout" --since=<fecha>` y mirar los
  commits que tocan el píxel (`tienda.js`, `checkout.html`, `index.html`). El
  24 de septiembre un cambio de medición se leyó durante dos semanas como si
  fuera un cambio de rendimiento de la pauta, y de ahí salió una conclusión
  equivocada que llegó a quedar escrita aquí. **Una caída o una subida
  repentina en un solo día, sin tocar la campaña, casi siempre es de medición.**

### Dos ROAS, y cuándo usar cada uno

- **ROAS atribuido** = facturación que Meta se atribuye ÷ gasto. Sirve para
  comparar anuncios entre sí dentro de la cuenta, porque el sesgo de medición
  les pega a todos parecido. No sirve para decidir si la pauta es rentable
  mientras el paso 0 dé una brecha grande.
- **MER** (ROAS real del negocio) = facturación total registrada ÷ gasto en
  Meta, en el mismo periodo. Es el que decide rentabilidad y escalamiento.
  Pero mientras no se registre de dónde vino cada venta, el MER incluye las que
  habrían llegado sin pauta (orgánico, recompra, recomendación): es un **techo**
  de lo que produce la pauta, no una medida exacta. Escalar sobre un techo se
  hace con prudencia y diciéndolo.
- **ROAS de equilibrio** = 1 ÷ margen de contribución (margen después de
  producto, empaque, envío y pasarela; el valor está en la Guía privada). Por
  debajo, la pauta se come todo el margen.
- **Margen de adquisición**: qué parte de la contribución se acepta gastar para
  conseguir un cliente. Regla de trabajo actual: 20%. Eso da un CAC objetivo =
  contribución por pedido × 20%, y un MER objetivo = 1 ÷ (margen × 0,20).

### Después del paso 0, en este orden

1. **¿El conjunto salió de aprendizaje?** Meta necesita del orden de 50 eventos
   de optimización por semana por conjunto. Con menos, está en aprendizaje
   limitado y los resultados de 2 o 3 días no dicen nada todavía.
2. **CTR de enlace bajo** → el problema es el creativo o el gancho de los
   primeros 3 segundos. Solución: otro formato, otro ángulo, otro titular. No se
   toca presupuesto ni landing por esto. Los umbrales que circulan (bajo < 1,5%,
   alto > 2%) son genéricos, no del curso: comparar contra el propio historial
   de la cuenta, que ha andado alrededor de 3% a 3,5% en enlace.
3. **CTR alto pero pocos checkouts** → la ficha, el precio o la oferta. Revisar
   que el precio del anuncio sea el del sitio hoy, que la página cargue rápido y
   que la oferta del anuncio aparezca en la página a la que llega.
4. **Checkouts pero pocas ventas** → primero, otra vez el paso 0. Si la
   medición está bien: fricción del checkout (envío, medios de pago, errores de
   Wompi), y el costo de contraentrega.
5. **CPC o CPM muy altos, frecuencia subiendo** → público chico o saturado.
   Ampliar, pasar a segmentación abierta, o refrescar creativos.

## Estructura

### Con el volumen de hoy: una campaña, un conjunto

**La cantidad de campañas la decide el volumen de eventos, no el método.** Meta
necesita del orden de 50 eventos de optimización por semana **en un mismo
conjunto** para salir de aprendizaje. Desde que el sitio dejó de contar doble
el `InitiateCheckout` (ver arriba), la cuenta produce **~35 checkouts por
semana con una sola campaña** y ~77 con tres campañas y el doble de gasto. Ni
siquiera un conjunto único llega a 50: queda en aprendizaje limitado, y partir
el volumen en dos o tres conjuntos lo empeora.

**Ojo: el argumento de la estructura es de volumen, no de resultados medidos.**
La primera versión de esta sección decía que separar en tres campañas había
doblado el costo por checkout. **Era falso**: comparaba periodos con
mediciones distintas. Lo que sí muestran los datos, con el conteo corregido:

| Periodo | Estructura | Gasto/día | Checkouts/sem. (reportados) | Costo/checkout reportado | Costo comparable* |
|---|---|---|---|---|---|
| 5 ago – 15 sep | 1 campaña | $10.000–19.000 | 38–85 | $1.275–2.028 | ≈ $2.500–4.000 |
| 16–22 sep | 1 campaña | $28.800 | 72 | $2.802 | ≈ $5.600 |
| 27 sep – 2 oct | 3 campañas | ~$52.000 | ~77 | $4.736 | $4.736 |
| 3–5 oct | 1 campaña | ~$23.000 | ~35 | $4.649 | $4.649 |

\* Antes del 27 de septiembre el sitio contaba cada checkout dos veces, así que
los números reportados de esas filas son **aproximadamente el doble de
checkouts** y la mitad de costo. «Comparable» multiplica por dos el costo de las
filas anteriores. No es exacto, pero el salto en la cuenta del 26 al 27 de
septiembre (17 → 6 checkouts en un día, sin tocar ninguna campaña) lo delata.

Qué se puede afirmar y qué no:

1. **El costo comparable subió al pasar de ≤ $19.000 a ≥ $23.000 diarios** (de
   ≈ $2.500–4.000 a ≈ $4.600–5.600) y no ha vuelto a bajar. La subida empezó
   con **una sola campaña** a $28.800, antes de separar nada, y coincide con el
   fin de Amor y Amistad (19 de septiembre).
2. **El número de campañas no explica el costo.** Con tres campañas y $52.000
   salió a $4.736; con una y $23.000, a $4.649. Culpar a la estructura, ni para
   bien ni para mal, no se sostiene con estos datos.
3. **Tampoco se puede decir que más gasto no compre checkouts**: a $52.000 al
   día hubo ~77 por semana contra ~35 a $23.000. Lo que sí es cierto es que
   cada checkout adicional cuesta más de lo que costaba a $13.000–19.000.
4. **La consolidación del 3 de octubre no se puede evaluar todavía**: 3 días
   completos, 15 checkouts. La primera lectura con sentido es el 10 de octubre,
   y para medir bien hay que comparar siempre contra el conteo nuevo.

Estructura vigente:

- **Una campaña de ventas (`VENTAS · ESCALA · IC`) con un solo conjunto
  amplio** y presupuesto de campaña. Los ángulos nuevos se prueban **como
  anuncios dentro de ese conjunto**, no en una campaña aparte: Meta reparte cada
  creativo a la gente que le responde, y el conjunto no pierde volumen.
- **Techo de 6 a 8 anuncios activos.** Con menos de 5 falta diversidad (Meta
  agrupa los parecidos); con más de 8, cada uno recibe migajas y no se puede
  leer. Un anuncio nuevo entra cuando otro sale.
- Hombres y mujeres: Marvel y la pulsera clásica en tallas 20-21 venden también
  a hombres.

**Cuándo sí separar.** Solo si se cumplen las dos: la cuenta pasa de unos
**150 checkouts por semana**, y cada conjunto separado va a recibir al menos
50. Ahí sí aplica el esquema de cuenta en crecimiento del curso:

| Campaña | Etapa | Público | Parte del presupuesto |
|---|---|---|---|
| `VENTAS · PRES · IC` | Presentación | Frío, excluyendo compradores | ~70% |
| `VENTAS · EVAL-CONV · IC` | Evaluación + conversión | Públicos personalizados 90 días | ~30% |
| `VENTAS · ASC` | Ascensión | Compradores | Cuando la lista de clientes alcance para entregar |

Con prueba en presupuesto por conjunto (ABO) y escala en presupuesto de campaña
(CBO), sin mezclar en una misma CBO conjuntos en prueba con validados.

**Antes de subir presupuesto**, comparar checkouts por semana de las dos
semanas anteriores. Si el gasto subió y los checkouts no, devolver el
presupuesto al nivel anterior en vez de seguir subiendo.
- **Evento de optimización: InitiateCheckout, no Purchase.** No es solo por el
  píxel: con el volumen de ventas actual, un conjunto optimizado por compra no
  llega a 50 eventos semanales ni con la medición perfecta, y se queda en
  aprendizaje limitado para siempre. La compra se usa para medir. Se reevalúa
  cuando se reclame la cuenta **y** el volumen de compras lo permita.
- Presupuesto: mensual planeado ÷ 30,4 = diario, y el diario se reparte entre
  conjuntos. Sin fecha de fin salvo promociones con plazo. Las sugerencias de
  presupuesto de Meta se ignoran.
- Atribución estándar: clic 7 días, visualización 1 día. Ubicaciones Advantage+.
- **Nombres**: campaña `OBJETIVO · ETAPA · EVENTO`, conjunto
  `PÚBLICO · CO · EDAD`, anuncio `TIPO · ÁNGULO · PRODUCTO · vN`. El nombre del
  anuncio viaja a los UTMs, así que tiene que decir qué es.
- **UTMs en cada anuncio**:
  `utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}`

## Ediciones, aprendizaje y escalamiento

- **48 a 72 horas sin ediciones significativas** después de lanzar (texto,
  creativo, público, evento, presupuesto de golpe, pausar). La excepción: un CPA
  más de tres veces por encima del CPA de equilibrio.
- **Escalamiento vertical**: subir 15-20% cada 2-3 días, solo en conjuntos
  ganadores y solo si el MER está al menos 20% por encima del ROAS de
  equilibrio. Un salto grande de presupuesto reinicia el aprendizaje: avisarlo.
- **Escalamiento horizontal**: si el MER está en el límite pero hace falta más
  volumen, duplicar el concepto que funciona con creativos nuevos o con otro
  público (abierta, intereses nuevos). «Nuevas geografías» no aplica: solo se
  envía dentro de Colombia.
- Pausar no es gratis: al reactivar, el conjunto vuelve a aprender y los
  primeros días salen más caros. Antes de proponer una pausa, estimar las ventas
  que se dejan de hacer con la conversión real (no la del píxel).

### Mover un anuncio sin perder la prueba social

Los likes, comentarios y compartidos viven en la **publicación**, no en el
anuncio. Para pasar un anuncio a otro conjunto o campaña:

- **Por API**: crear el anuncio nuevo con el **mismo `creative_id`**
  (`ads_create_ad` con `{"creative_id": "…"}`). Apunta a la misma publicación de
  Facebook e Instagram y la prueba social sigue sumando.
- **En Ads Manager**: *Duplicar* → *Conjunto de anuncios existente*, y confirmar
  que diga **«Usar publicación existente»** con el mismo ID. **No editar texto
  ni imagen**: cualquier cambio crea una publicación nueva que arranca en cero.
- **Verificar siempre después**: leer el anuncio nuevo y comparar su
  `creative_id` con el original. El 2026-10-03 un duplicado hecho a mano «se
  hizo» pero nunca se creó, y solo se supo al leer la cuenta.
- Pausar la campaña vieja no borra las publicaciones: no hay que tocarlas.
- **Pausar un anuncio tampoco pierde los likes.** Siguen en la publicación y se
  recuperan reactivando el anuncio o creando otro con el mismo `creative_id`.
  Por eso **la prueba social no justifica seguir gastando en un anuncio que no
  convierte**: un anuncio con 60 likes y 3 checkouts por $30.000 sigue siendo un
  mal comprador. Mucha reacción es atención, no ventas, y en esta cuenta eso ya
  pasó con Copia 4. Pausar sale barato, porque la prueba social se conserva.

### Trampas del conector de Meta Ads

- **El COP no tiene centavos.** `daily_budget: 5000` son $5.000, aunque la
  documentación del conector diga «unidad menor (centavos)». El 2026-09-06 un
  «son centavos» dejó un presupuesto en $500.000/día. Después de tocar un
  presupuesto, releerlo de la API antes de activar nada.
- **Editar una campaña la pausa.** `ads_update_entity` sobre una campaña activa
  devuelve `status_forced_to_paused: true`. Toda edición de campaña son dos
  llamadas (`ads_update_entity` y `ads_activate_entity`) más una lectura que
  confirme `effective_status: ACTIVE`. Pasó el 2026-09-10 al subir el
  presupuesto: la campaña quedó apagada por el cambio que quería escalarla.
- **En modo Auto, las escrituras se bloquean al azar.** El revisor automático
  de la sesión bloqueó la mitad de las acciones del 2026-10-03, aprobó otras
  idénticas, e incluso bloqueó una lectura. La aprobación en el chat no lo
  levanta y no deja reintentar lo bloqueado. **Para trabajar sobre la pauta, la
  sesión va en modo «Aceptar ediciones»**: cada acción le llega al propietario
  para aprobarla en el teléfono, que es justo el acuerdo de la regla 1.

## Públicos

Todos los de sitio web sobre el **píxel viejo** (`2130673404542988`).

- **Visitantes con intención · 90d**: ViewContent + AddToCart +
  InitiateCheckout. A 30 días y solo checkout, el público quedaba en ~55
  personas y el retargeting no entregaba.
- **Compradores web · 180d** (Purchase) y **lista de clientes** (email y
  celular de todos los pedidos, también WhatsApp y contraentrega): se excluyen
  de la presentación y son la base de la ascensión. Una lista necesita del orden
  de 100 coincidencias para entregar.
- **Interacción Instagram · 90d** y **video 10 s · 90d** para personalizados.
- **Similar**: reconstruir sobre visitantes con intención cuando ese público
  pase de ~1.000 personas; empezar por el tamaño más bajo.
- Segmentación abierta y Advantage+ no se usan para retargeting.

## Oferta

La persona tiene que sentir que recibió varias veces lo que pagó. Zephora ya
regala más de lo que dice en sus anuncios; verificar vigencia en el sitio antes
de prometerlo: empaque de regalo en todos los pedidos, dedicatoria escrita a
mano, paño de limpieza, envío gratis con pago anticipado, «paga 3, lleva 1
gratis · paga 5, lleva 2 gratis» (lo de menor valor), Addi, garantía de 30 días, 5 días para cambio
de talla.

Promo real desde el 2026-10-04 (`tienda.js`, `PROMO`): **paga 3 y llévate 1
gratis; paga 5 y llévate 2 gratis**. Brazalete y charms cuentan igual; con 4
piezas sale gratis la de menor valor, con 7 las dos de menor valor, y no pasa
de 2. Ya no existen la escalera 8/15/25% ni el −30% del brazalete: un anuncio
que los prometa promete algo que el checkout no cobra. Texto del banner del
sitio: «🎁 ARMA TU SET: Mezcla charms y brazaletes. ¡PAGA 3 Y LLÉVATE 1 GRATIS!
· Paga 5 y llévate 2 ✨».

Las promos vigentes completas (2026-10-06, confirmadas por el propietario):

| Promoción | Cómo funciona |
|---|---|
| Paga 3, lleva 1 gratis | Con 4 piezas, la más barata sale gratis. El brazalete cuenta como pieza. |
| Paga 5, lleva 2 gratis | Con 7 piezas, las 2 más baratas salen gratis. Es el máximo: con 8 o más siguen siendo 2. |
| Regalo de suscripción | Una letra (su inicial) gratis. Solo en la primera compra de 2 charms o más, con el mismo correo con el que se suscribió y confirmó. |
| Envío gratis | Pagando en línea. Con contraentrega el envío cuesta **$20.000**. |

El regalo de suscripción tiene condiciones, así que un anuncio no debe
prometerlo a quien no se haya suscrito. Y como la contraentrega cobra envío y el
pago en línea no, «envío gratis» en un anuncio solo es cierto para el pago en
línea: decirlo así, sin dejar que se lea como válido para todos los pedidos.

- Presentación: ninguna oferta explícita. La idea de armar la pulsera y el
  «desde» del brazalete.
- Evaluación: Plata 925 con sello, garantía, empaque incluido.
- Conversión: envío gratis, paga 3 lleva 1 gratis (mezclando charms y brazaletes), Addi.
- Ascensión: charms nuevos para la pulsera que ya tiene.

Ojo: las páginas de preguntas frecuentes y de envíos todavía dicen «envío
gratis desde $180.000», aunque el sitio lo da siempre con pago anticipado. Un
anuncio que prometa envío gratis debe llevar a la ficha o al checkout, no a esas
páginas.

## Creativos y copy

La regla de Andromeda: Meta agrupa los anuncios que se parecen (misma foto,
mismo fondo) y los trata como uno. La diversidad tiene que estar en la razón de
compra, el formato, el producto y el contexto, no en el color de fondo.

Método del curso: elegir 2 a 4 tipos de creativo, 2 a 3 anuncios de cada uno,
medir, y después concentrarse en lo que funcione. Los 10 tipos traducidos a
piezas de Zephora, la primera prueba propuesta, los niveles de conciencia con
ejemplos y las reglas de redacción están en
[`references/creativos-y-copy.md`](references/creativos-y-copy.md). Leerlo
antes de proponer un creativo o escribir un texto.

Lo mínimo sin abrirlo:

- Estructura de un texto: gancho que detenga el scroll → beneficio que rompa
  las objeciones de tiempo, dinero y confianza → llamado a la acción directo.
  Se lee como la recomendación de una amiga que sabe, no como un infomercial.
- Prohibido: «¡la mejor calidad!», «¡gran oferta!», «¡compra ya!», y cualquier
  afirmación que el sitio no respalde.
- Nivel «decisión» en este método es **el cliente que ya compró** (base de la
  ascensión), no «alguien que conoce la oferta y solo necesita el empujón».

## Investigación de mercado (las 7 maletas)

Público, problema, solución, diferenciales, testimonios, objeciones y garantía.
Fuentes, en orden de valor: conversaciones con 5 clientes reales (preguntas
abiertas, anotar frases textuales), chats de WhatsApp de quien preguntó y no
compró, comentarios de Instagram, biblioteca de anuncios de Meta (los que llevan
más tiempo activos están validados por quien los paga; `ads_library_search`),
reseñas negativas de la competencia en Mercado Libre, búsquedas de Google
(búsquedas relacionadas, el truco del asterisco), tiendas Shopify que más
venden, TikTok One. Lo que salga se anota en las 7 maletas del documento de
estrategia del propietario, con la fuente.

## Cómo proponer un cambio

Antes de cualquier escritura en la cuenta, mostrar esto y esperar aprobación:

```
Qué:        <crear / pausar / cambiar presupuesto de … >
Objeto:     <nombre e id de la campaña, conjunto o anuncio>
Antes → después: <valor actual> → <valor nuevo>
Por qué:    <el dato que lo justifica, con su periodo>
Hipótesis:  <qué esperamos ver y en cuántos días>
Riesgo:     <reinicio de aprendizaje, gasto adicional, etc.>
```

## Al terminar

Si algo del estado de la cuenta cambió (reclamo hecho, píxel compartido,
público activo, UTMs guardados en el pedido, precios o materiales), actualizar
esta skill, `CLAUDE.md` § Meta Ads y la Guía privada. Tres fuentes que dicen
cosas distintas son como esta cuenta llegó a tener dos rescates de carrito.
