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

## El estado de la cuenta, que cambia casi todo

Verificar lo vigente antes de afirmarlo (`ads_get_ad_accounts`,
`ads_get_ad_entities`, `CLAUDE.md` § Meta Ads, `ESTADO.md` § 4a). Hasta la
última verificación:

- La cuenta con las campañas (`1583713932705268`) **no tiene portafolio
  comercial**. De ahí salen las tres limitaciones siguientes. Reclamarla hacia
  el portafolio «Zephora Charms» es manual, en Business Settings.
- **Dos píxeles.** El viejo (`2130673404542988`) es el único que la cuenta puede
  usar para optimizar y para públicos, y no recibe compras de servidor. El nuevo
  (`1029982529813994`) sí recibe el `Purchase` del webhook de Wompi, pero la
  cuenta no lo tiene compartido.
- **Sin catálogo** (la cuenta sin portafolio no puede tenerlo): nada de anuncios
  de catálogo ni dinámicos hasta el reclamo.
- **El público similar está inactivo** (semilla muy chica).
- **El checkout no guarda los UTMs en el pedido.** El origen de una venta web no
  queda registrado solo; se anota a mano.
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

### Dos ROAS, y cuándo usar cada uno

- **ROAS atribuido** = facturación que Meta se atribuye ÷ gasto. Sirve para
  comparar anuncios entre sí dentro de la cuenta, porque el sesgo de medición
  les pega a todos parecido. No sirve para decidir si la pauta es rentable
  mientras el paso 0 dé una brecha grande.
- **MER** (ROAS real del negocio) = facturación total registrada ÷ gasto en
  Meta, en el mismo periodo. Es el que decide rentabilidad y escalamiento.
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

Es una cuenta con poco historial de compras medidas, así que va el esquema de
cuenta nueva del curso:

| Campaña | Etapa | Público | Parte del presupuesto |
|---|---|---|---|
| `VENTAS · PRES · IC` | Presentación | Frío, excluyendo compradores | La mayor (~70% hoy) |
| `VENTAS · EVAL-CONV · IC` | Evaluación + conversión | Públicos personalizados 90 días | El resto (~30%) |
| `VENTAS · ASC` | Ascensión | Compradores | Cuando la lista de clientes alcance para entregar |

- **Prueba con presupuesto por conjunto (ABO)**, para que cada conjunto reciba
  lo mismo y se puedan comparar. **Presupuesto de campaña (CBO) solo para
  escalar** lo que ya ganó. Nunca mezclar en una misma CBO públicos en prueba
  con públicos validados.
- Conjuntos de presentación: el curso usa tres (abierta, intereses, similar).
  Aquí van dos mientras el similar esté inactivo: **abierta** (público
  Advantage+) e **intereses** (público original: charms, joyería, pulseras,
  regalos, Pandora como interés). Hombres y mujeres: Marvel y la pulsera clásica
  en tallas 20-21 venden también a hombres.
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
mano, paño de limpieza, envío gratis con pago anticipado, el cuarto charm
gratis, brazalete 30% más barato desde 3 charms, Addi, garantía de 30 días, 5
días para cambio de talla.

Escalera real de descuento de charms (`tienda.js`, `ESC`): 1 charm 0%, 2 charms
8%, 3 charms 15%, 4 o más 25%. El −30% del brazalete arranca en 3 charms.

- Presentación: ninguna oferta explícita. La idea de armar la pulsera y el
  «desde» del brazalete.
- Evaluación: Plata 925 con sello, garantía, empaque incluido.
- Conversión: envío gratis, lleva 4 paga 3, 30% en el brazalete, Addi.
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
