# Calendario editorial y fábrica de guiones — Zephora Charms

Documento de estrategia de contenido orgánico para TikTok e Instagram.
Escrito el **2026-09-07**, verificado contra `assets/stock.json`
(conteo 2026-08-01, generado 2026-08-16), `assets/catalogo.json` y el motor de
precios real `netlify/functions/_precios.js`.

## Qué es esto y qué NO es

[`BRIEF.md`](BRIEF.md) es la **especificación del software** que produce paquetes
de rodaje. Este documento es la **doctrina editorial** que ese software tiene que
ejecutar: cada cuánto se publica, qué pilares existen, cómo se reparte la
quincena y cómo se escribe un guion que cierra en checkout.

No se solapan. El BRIEF dice *cómo elegir la pieza*; esto dice *qué se graba con
ella y por qué*. Cuando la Fase 1 del motor genere el campo `guion`, el prompt
sale de la § *Anatomía de un guion* de aquí.

**Este documento no toca `netlify/functions/`.** Solo lee. Cumple la decisión 4
del BRIEF (una sola sesión toca la tienda).

---

## 1 · Lo que dijo el inventario — leer antes de grabar nada

Cinco hallazgos, todos calculados contra los archivos reales. Cuatro no estaban
escritos en ningún sitio del repo y **cambian qué se graba**.

### 1.1 · El tercer dije cuesta $36.560, y nadie lo está contando

El hallazgo más rentable de todo el análisis. `assets/catalogo.json` define:

```
escalaCharms: [0, 0, 0.08, 0.15, 0.25]   // descuento por nº de charms
descuentoBrazalete: 0.30                  // 30% off la pulsera…
minCharmsParaDescuento: 3                 // …a partir de 3 charms
envioGratisDesde: 180000                  // solo pago anticipado
```

Corrido contra `calcular()` de `_precios.js` (pulsera Corazón Liso + charms de
$76.000, pago anticipado):

| Selección | Mercancía | Envío | Total real | Lo que costó el dije que se añadió |
|---|---|---|---|---|
| Pulsera + 1 dije | $134.000 | $15.000 | **$149.000** | — |
| Pulsera + 2 dijes | $197.840 | gratis | **$197.840** | $63.840 |
| **Pulsera + 3 dijes** | $234.400 | gratis | **$234.400** | **$36.560** |
| Pulsera + 4 dijes | $268.600 | gratis | **$268.600** | $34.200 |

**Un dije de lista $76.000 sale en $36.560 cuando es el tercero** —**menos de la
mitad**—, porque dispara a la vez el 15% de la escala y el 30% de la pulsera.

El tercero es donde **se desploma** el precio marginal: el segundo dije cuesta
$63.840 y el tercero $36.560. (El cuarto sale un poco más barato todavía,
$34.200, pero ahí ya no hay ningún descuento nuevo: solo se reparte mejor el
25% de la escala. **El salto que hay que contar es el de 2 a 3.**) Y **no
aparece en ningún guion, ninguna historia ni ningún anuncio**.

> **Números verificados el 2026-09-07** corriendo `calcular()` de
> `netlify/functions/_precios.js` sobre `pulsera-corazon-liso` ($58.000) con
> dijes de $76.000, pago anticipado. **Una versión anterior de esta tabla decía
> $205.200 / $237.800 / tercer dije $32.600: eran incorrectos** y el guion 5 los
> repetía en voz alta. Si se vuelven a tocar, se recalculan, no se estiman.

Esto ordena todo el contenido: **el objetivo de conversión nunca es «compra la
pulsera». Es «llega a tres».** Coincide con lo que ya dice `CLAUDE.md`: el
margen está en el charm (87,9%), no en la pulsera (70,7%), y una venta de dos
charms deja ~$110.386 de utilidad. Un carrito de 3 charms deja más y le cuesta
a la clienta $36.560 más. Es la oferta redonda que la tienda ya tiene programada
y no comunica.

### 1.2 · Amor y Amistad es en 12 días y hay fecha límite de pedido

En Colombia, **Amor y Amistad 2026 cae el sábado 19 de septiembre** (tercer
sábado). Hoy es 7 de septiembre. La quincena que empieza hoy **es** la rampa.

Cruzando los tiempos publicados en `envios-y-devoluciones.html` (Inter
Rapidísimo, días hábiles desde el despacho) con un día hábil de preparación —la
tienda arma cada pulsera a mano— salen fechas límite duras, y no hay festivos
colombianos entre hoy y el 19:

| Destino | Entrega publicada | **Último día para pedir** |
|---|---|---|
| Resto del país y reexpedidos | 3–6 días hábiles | **jueves 10 de septiembre** |
| Ciudades principales (Medellín, Cali, Barranquilla…) | 2–4 días hábiles | **lunes 14 de septiembre** |
| Bogotá y municipios cercanos | 1–2 días hábiles | **miércoles 16 de septiembre** |

Esas tres fechas son **urgencia real, no inventada**, y es el único recurso de
conversión que no cuesta ni margen ni inventario. Van en pantalla en cada pieza
de la segunda semana. Después del 19, el contenido de regalo pierde el argumento
y el calendario vuelve al modo base de la § 3.2.

### 1.3 · El Empaque Premium es el regalo, y está escondido en el checkout

`empaque: 40000` — «Empaque Premium de Regalo» **con tarjeta de dedicatoria
escrita por la clienta**. Para un producto de regalo en la semana de Amor y
Amistad, esa tarjeta *es* el producto emocional, y hoy solo se descubre en el
paso 2 del checkout, cuando la decisión ya está tomada.

Corona Pavé + 3 dijes de $76.000 + empaque = **$281.400**, envío gratis
(verificado con `calcular()`; sobre Corazón Liso serían **$274.400**). Debe
salir en cámara.

### 1.4 · El zodiaco NO puede ser pilar, y las letras solo a medias

| Familia | Elegible (≥3 u) | Veredicto |
|---|---|---|
| **Marvel** (6 refs) | 6 de 6, a 3 u c/u | **Pilar completo.** Y son los charms más caros: $85.000 |
| **Letras** (27) | **9**: A B D E K L O S V | Solo como *hero* de esas nueve, o como **sondeo** |
| **Zodiaco** (12) | **0** | **Prohibido como pieza de venta** |
| **Pulseras base** (18) | 8 | Corazón Liso y Corona Pavé son las de cámara (§ 1.5) |

El zodiaco es la trampa: 7 signos a 2 unidades y **Cáncer y Acuario en cero**.
Un video «busca tu signo» manda al 17% de la audiencia a un agotado y al resto a
piezas que se acaban con dos ventas. Es exactamente el fallo que el BRIEF § 1.1
describe: gasta la grabación, gasta el alcance y termina en «se agotó».

Las letras son el mismo problema a medias: **faltan 14 que nunca se compraron**
(F G H I P Q R T U W X Y Z Ñ). Regla operativa: **en video se enseñan solo las
nueve elegibles; las 14 ausentes solo aparecen en la historia de sondeo**
(guion 8), que pregunta y no ofrece — regla 2 del BRIEF.

### 1.5 · Dos trampas de talla que arruinarían un video bueno

`stock.json` guarda las pulseras por talla, y eso decide **cuál puede salir en
cámara**:

- **`pulsera-clasica-cierre-barril` solo existe en tallas 20 y 21.** No sirve
  para un video dirigido a muñeca femenina promedio: la mitad de quien lo pida
  no tiene su talla. **Pero es justo la que sirve para muñeca masculina** — y por
  eso es la base correcta del set Marvel (guion 3). Un problema convertido en la
  decisión correcta.
- **`pulsera-corazon-liso` (8 u) y `pulsera-corona-pave` (8 u) cubren 17-18-19-20
  completas.** Son las únicas dos que aguantan un video de venta directa a
  cualquiera. **Son las pulseras de cámara.**
- **`pulsera-avengers` está en CERO.** Un video del set Marvel que enseñe la
  pulsera Avengers manda a comprar la única base agotada. Se monta sobre la
  Clásica.

> **Nota de conteo.** El BRIEF § 1.1 registra «24 en cero / 59 en 1–2 / 46
> elegibles». Recontado hoy sobre el mismo archivo da **25 / 58 / 46** (el pool
> elegible, que es lo que decide, coincide exacto). Una referencia cambió de
> lado en la frontera. No cambia ninguna conclusión; se anota para que la próxima
> sesión no crea que encontró un error.

---

## 2 · Tarea A — Estrategia de frecuencia, mix y pilares

### 2.1 · La restricción que manda: hay una sola persona con cámara

El BRIEF ya lo dice: *«el limitante del contenido no es el inventario; es el
tiempo de grabación»*. Toda la frecuencia sale de ahí, no de lo que recomiende
un algoritmo.

**El eje es una sesión de rodaje semanal en bloque, de ~90 minutos, que produce
8–10 piezas.** Grabar suelto todos los días es lo que hace abandonar una cuenta
en tres semanas. El día de rodaje sugerido es **domingo**, con luz natural de
tarde, para tener la semana entera cargada.

Un Reel vertical se publica en **TikTok, IG Reels y FB Reels**. Se graba una vez,
se publica tres veces: es lo que hace que el minuto de cámara valga.

### 2.2 · Frecuencia por plataforma

| | TikTok | Instagram |
|---|---|---|
| **Cadencia** | **1 video diario, 6 días/semana** (descanso domingo, que es rodaje) | **4 Reels + 2 carruseles por semana**, 6 posts en total |
| **Por qué esa** | Es red de descubrimiento pura: el alcance no depende de seguidores, así que cada publicación es un billete de lotería independiente. Bajar de 5/semana apaga la distribución | El feed sí depende del perfil. Más de 6 posts/semana canibaliza alcance propio; menos de 4 apaga la cuenta |
| **Historias** | — | **Diarias, 2–4 al día.** No es opcional: es donde vive la urgencia de fechas (§ 1.2), el sondeo y la prueba social |
| **Costo marginal** | Cero: es el mismo Reel | Cero en Reels; los carruseles son el trabajo extra real, y salen de Remotion sin cámara |

**Regla de rebaja honesta:** si una semana no hay rodaje, se baja a **3 TikTok y
2 Reels**, y se sostiene con carruseles y guías — que no necesitan cámara. Es
mejor que romper la racha con relleno. Es literalmente lo que el BRIEF § *Lo que
este motor no arregla* anticipa: *«las piezas de pura tipografía y las guías se
publican los días que no hubo cámara»*.

### 2.3 · Balance de formatos en Instagram

| Formato | Peso | Función real |
|---|---|---|
| **Reels** | **65%** (4 de 6) | Único formato con alcance a no-seguidores. Trae gente nueva |
| **Carrusel** | **25%** (1–2 de 6) | El que se **guarda**. Guía de tallas, cómo armar, cuidado de la plata. El guardado empuja alcance y además **reduce cambios por talla equivocada**, que cuestan plata de verdad |
| **Foto fija** | **10%** | Solo para portada de perfil y anuncios de fecha límite. No compite por alcance; sostiene la estética de cuadrícula |

Nada de video largo. A este catálogo y a este tamaño de operación, el video
largo cuesta lo mismo que cuatro Reels y rinde menos.

### 2.4 · Los cuatro pilares de contenido

| # | Pilar | % del mix | Qué hace | Cierra en |
|---|---|---|---|---|
| **1** | **POV / Storytelling emocional** | **35%** | Trae audiencia nueva. Es el pilar de alcance: regalo de pareja, auto-regalo, momento especial, Amor y Amistad | Perfil → link |
| **2** | **Venta directa / producto** | **30%** | Enseña la pieza, el precio real y el salto a 3 dijes (§ 1.1) | Checkout |
| **3** | **Curaduría / estilo** | **20%** | Cómo armar por personalidad, GRWM, combinaciones. Es el que sube el **ticket**, no el volumen | Checkout, carrito grande |
| **4** | **Educación / confianza** | **15%** | Tallas, cuidado de la plata, envíos, garantía. Baja fricción y cambios | Guardado, DM |

**Ningún pilar puede ser 100% de una semana.** Una semana de solo venta directa
quema audiencia; una semana de solo POV no vende nada. La proporción se revisa
por quincena, no por día.

**La regla de oro que ata los cuatro:** *el pilar 1 abre la puerta, el 2 cobra,
el 3 sube el ticket y el 4 evita la devolución.* Si una pieza no hace ninguna de
las cuatro, no se graba.

---

## 3 · Tarea B — Calendario editorial

### 3.1 · Quincena en curso: rampa de Amor y Amistad (7–19 de septiembre)

Objetivo de la quincena: **carritos de 3 piezas antes de las fechas límite de la
§ 1.2**. Todo lo demás es secundario.

**Semana 1 — 7 al 13 de septiembre · construir deseo**

| Día | TikTok | Instagram | Pilar | Pieza | Objetivo | CTA |
|---|---|---|---|---|---|---|
| **Lun 8** | Guion 1 · POV regalo | Reel (mismo) | 1 · POV | Trébol giratorio + Corazón Liso | Alcance nuevo | «Comenta **TRÉBOL**» |
| **Mar 9** | Guion 5 · el 3.er dije | Carrusel «Guía de tallas» | 2 · Venta | Corazón Liso / Corona Pavé | **Checkout** | Link en bio |
| **Mié 10** | Guion 3 · Marvel | Reel (mismo) | 1 · POV | Set Marvel + Clásica 20/21 | Alcance masculino | «Comenta **MARVEL**» |
| **Jue 11** | Guion 2 · auto-regalo | Historias: **hoy cierra resto del país** | 1 · POV | Atrapasueños azul | **Checkout urgente** | Link + fecha límite |
| **Vie 12** | Guion 4 · curaduría 3 pulseras | Reel (mismo) | 3 · Curaduría | 3 combinaciones elegibles | Subir ticket | «¿Cuál te describe?» |
| **Sáb 13** | Repost del mejor de la semana | Carrusel «Cómo cuidar tu plata» | 4 · Educación | — | Guardado | Guardar |
| **Dom 14** | — *rodaje* | Historias: detrás de cámara | — | — | Cercanía | Encuesta |

**Semana 2 — 14 al 19 de septiembre · cerrar antes de la fecha**

| Día | TikTok | Instagram | Pilar | Pieza | Objetivo | CTA |
|---|---|---|---|---|---|---|
| **Lun 15** | Guion 6 · empaque + tarjeta | Reel (mismo) | 2 · Venta | Empaque Premium | **Checkout** · ticket alto | Link en bio |
| **Mar 16** | Guion 7 · GRWM | Historias: **hoy cierra Bogotá** | 3 · Curaduría | Corona Pavé + 3 charms | **Checkout urgente** | Link + cuenta atrás |
| **Mié 17** | Guion 5 (2.ª versión, otro gancho) | Foto fija: fechas límite | 2 · Venta | El salto a 3 dijes | **Checkout** | Link |
| **Jue 18** | POV «lo pedí a última hora» | Reel (mismo) | 1 · POV | Corazón Liso | Últimos Bogotá | «Escríbenos» |
| **Vie 19** | Guion 8 · sondeo de letras | **Historia sondeo: ¿cuál te falta?** | 4 · Educación | Las 14 ausentes | **Dato de compra** | Responder historia |
| **Sáb 20** | Contenido de agradecimiento | Reel: pedidos reales saliendo | 1 · POV | — | Prueba social | Seguir |

> El **guion 8 va el viernes 19 a propósito**: es el día de mayor tráfico al
> perfil de toda la quincena, y por tanto el día en que la pregunta de las 14
> letras recoge la muestra más grande y más barata del año. El BRIEF lo marca
> como *«la mejor hora de trabajo del proyecto»* y no depende del motor.

### 3.2 · Plantilla de quincena base (fuera de temporada)

Cuando no hay fecha que empuje, la rejilla se repite así — misma cadencia,
distinta proporción de pilares:

| | Lun | Mar | Mié | Jue | Vie | Sáb | Dom |
|---|---|---|---|---|---|---|---|
| **TikTok** | POV | Venta | POV | Curaduría | Venta | Repost/tendencia | — |
| **Instagram** | Reel POV | Carrusel educativo | Reel POV | Reel curaduría | Reel venta | Carrusel guía | Historias |
| **Pilar** | 1 | 2 / 4 | 1 | 3 | 2 | 4 | — |

**Enfriamiento: una pieza no vuelve a cámara en 21 días** (BRIEF § 1.2). Con 46
referencias elegibles y ~2 piezas nuevas por semana, el pool aguanta **más de
cinco meses sin repetir**.

---

## 4 · Tarea C — Fábrica de guiones · Lote 1

### 4.1 · Anatomía de un guion (el molde del motor)

Todo guion de Zephora tiene exactamente estas partes, y el motor de la Fase 1
debe emitirlas en este orden:

1. **Pieza y unidades** — id de `stock.json` + unidades al decidir. Si es <3, no
   hay guion.
2. **Gancho visual (0–3 s)** — plano concreto, no una idea. Es el 80% del
   resultado.
3. **Desarrollo** — bloques cronometrados, corte cada 2–3 segundos.
4. **Voz en off exacta** — palabra por palabra. No «hablar del regalo».
5. **CTA** — una sola acción, dicha *y* escrita en pantalla.
6. **Lista de tomas en orden de RODAJE**, no de montaje (BRIEF § 1.3).
7. **Texto y hashtags por red.**

**Tres reglas que no se rompen en ningún guion:**
- **El precio que se dice es el que calcula `_precios.js`.** Nunca uno redondeado
  de memoria. Un precio inventado en cámara es una promesa que el checkout
  desmiente.
- **No se enseña una pieza con menos de 3 unidades.**
- **Producto en cámara = producto real.** Nada generado (BRIEF, regla 2).

> **Y la regla se comprueba, no se promete.** Escribir «verificado contra
> `calcular()`» no es verificarlo: la primera versión de este documento lo
> decía y sus tres números centrales estaban mal (§ 1.1). Antes de grabar:
>
> ```
> node automatizaciones/contenido/verificar-precios-guiones.js
> ```
>
> Corre cada precio de este documento contra `calcular()` y sale con error
> nombrando el que dejó de cuadrar. **Un precio nuevo en un guion se añade
> también a ese archivo**, o la próxima vez tampoco lo va a cazar nadie.

---

### GUION 1 · POV — «El regalo que sí pensó» · TikTok + IG Reels
**Pilar 1 · Piezas: `trebol-verde-giratorio` (5 u, $84.000) + `pulsera-corazon-liso` (8 u, tallas 17-20)**

| Bloque | Tiempo | Qué pasa |
|---|---|---|
| **Gancho visual** | 0–3 s | Primer plano cerradísimo de dos manos: una sostiene una cajita cerrada, la otra tiembla un poco al abrirla. **Texto en pantalla: «POV: le dije que no me regalara nada»**. Sin voz todavía — solo el audio en tendencia |
| **Desarrollo** | 3–7 s | La caja se abre. Plano cenital de la pulsera Corazón Liso con el trébol girando. Corte a la muñeca ya puesta, girando a contraluz |
| | 7–12 s | La mano hace girar el trébol con el dedo. Plano macro. El brillo se mueve |
| | 12–16 s | Plano medio: ella mirando la muñeca, sonriendo, mirando a cámara |

**Voz en off (exacta):**
> «Le dije que no me regalara nada. Que no era necesario.
> Y llegó con esto… un trébol que gira de verdad.
> Me dijo que era para que la suerte no se me quedara quieta.
> Ya no me la quito.»

**CTA (dicho + en pantalla, últimos 2 s):**
> «Comenta **TRÉBOL** y te mando cómo armar la tuya.»

**Tomas (orden de rodaje):**
1. Todos los planos de muñeca puesta a contraluz (bloques 2 y 4) — misma luz, se graban juntos.
2. Macro del trébol girando (bloque 3) — trípode, misma posición.
3. Cenital de la pulsera sobre la caja (bloque 2).
4. Apertura de la caja (gancho) — se graba al final, 3 o 4 tomas, es la que más se repite.

**Texto TikTok:** `no era necesario 🥹 #amoryamistad #regalosoriginales #joyeriaplata #zephoracharms #parati`
**Texto IG:** `El detalle no era la pulsera. Era que se acordó del trébol. 🍀 Armá la tuya desde el link. #AmorYAmistad #PulserasPersonalizadas #Charms`

---

### GUION 2 · POV — Auto-regalo · TikTok + IG Reels
**Pilar 1 · Pieza: `atrapasuenos-azul` (7 u — la referencia con más unidades del catálogo, $72.000)**

| Bloque | Tiempo | Qué pasa |
|---|---|---|
| **Gancho** | 0–3 s | Mano dejando caer el charm dentro de la palma abierta, cámara lentísima. **Texto: «Nadie me iba a regalar nada, así que…»** |
| **Desarrollo** | 3–8 s | Plano del charm colgando, girando solo. Se ve el detalle del atrapasueños azul |
| | 8–13 s | Manos poniéndolo en la pulsera. El clic del pasador. **Sonido real, sin música encima 1 segundo** |
| | 13–17 s | Muñeca puesta, moviéndose al escribir en un teclado. Vida normal |

**Voz en off (exacta):**
> «Septiembre es el mes del amor y la amistad.
> Y este año me acordé de una amiga que llevaba rato esperando algo bonito.
> Era yo.
> Un atrapasueños, porque los míos los cumplo yo.»

**CTA:**
> «Está en el link. Y si llevas tres dijes, el tercero te sale por **menos de la mitad**.»
> *(En pantalla: `3.er dije de $76.000 = $36.560`)*

**Tomas:**
1. Muñeca puesta escribiendo (bloque 4).
2. Charm colgando y girando (bloque 2) — trípode, luz de ventana.
3. Clic del pasador con audio limpio (bloque 3) — **grabar en silencio absoluto**.
4. Caída del charm en la palma, cámara lenta (gancho) — repetir 5 veces.

**Texto TikTok:** `el amor propio también se regala 💙 #amoryamistad #autoregalo #joyeria #zephoracharms`

---

### GUION 3 · POV — Set Marvel · TikTok + IG Reels
**Pilar 1 · Piezas: `iron-man`, `hulk`, `escudo-capitan-america` (3 u c/u, $85.000 c/u) sobre `pulsera-clasica-cierre-barril` (6 u, tallas 20-21)**
**Total real: $257.350 · envío gratis.**

> **Ojo:** se monta sobre la **Clásica**, no sobre la Avengers — `pulsera-avengers`
> está en **cero unidades** (§ 1.5). Y la Clásica en talla 20-21 es justo la que
> sirve para muñeca masculina, así que la restricción juega a favor.

| Bloque | Tiempo | Qué pasa |
|---|---|---|
| **Gancho** | 0–3 s | Los tres charms cayendo uno a uno sobre una mesa oscura, en cámara lenta, con sonido metálico. **Texto: «Regalarle algo a un man es imposible… hasta que»** |
| **Desarrollo** | 3–8 s | Manos armando la pulsera: entra Iron Man, entra Hulk, entra el escudo |
| | 8–13 s | Muñeca masculina puesta, girando. Plano contra madera |
| | 13–18 s | Plano de su cara (o solo la reacción de la mano cerrando el puño) |

**Voz en off (exacta):**
> «Llevo tres años regalándole medias y perfume.
> Este año le armé esto: Iron Man, Hulk y el escudo del Capi.
> En plata, no en plástico.
> Es la primera vez que no lo guarda en el cajón.»

**CTA:**
> «Comenta **MARVEL** y te armo el set con los que él elija.»

**Tomas:**
1. Muñeca masculina puesta, contra madera, varios ángulos (bloques 3 y 4).
2. Manos armando, charm por charm (bloque 2).
3. Caída de los tres charms sobre mesa oscura, cámara lenta y **audio limpio** (gancho).

**Texto TikTok:** `por fin algo que no guardó en el cajón #regalosparahombre #marvel #amoryamistad #zephoracharms`

---

### GUION 4 · Curaduría — «Tres pulseras según quién eres» · IG Reels (+ TikTok)
**Pilar 3 · Solo piezas elegibles.**

| Bloque | Tiempo | Qué pasa |
|---|---|---|
| **Gancho** | 0–3 s | Tres pulseras ya armadas sobre mármol, en fila. Una mano entra y las separa. **Texto: «Dime cómo eres y te digo cuál es tuya»** |
| **Desarrollo** | 3–8 s | **La romántica:** `pulsera-corazon-pave-pequeno` (6 u) + `osito-pave-con-corazon` (3 u) + `conejita-con-corazon-rosa` (4 u) |
| | 8–13 s | **La espiritual:** `pulsera-mano-de-hamsa` (3 u) + `corazon-arbol-de-la-vida` (3 u) + `manos-orando-con-cruz` (4 u) |
| | 13–18 s | **La que atrae suerte:** `pulsera-corona-con-cristales` (6 u) + `trebol-verde-giratorio` (5 u) + `caballo-herradura` (3 u) |

**Voz en off (exacta):**
> «Tres pulseras, tres personalidades.
> La primera es para la que se enamora de todo: corazones y un osito.
> La segunda es para la que cree: hamsa, árbol de la vida y unas manos orando.
> Y la tercera es para la que empuja su propia suerte: corona, trébol y herradura.
> Las tres llevan tres dijes. Las tres tienen envío gratis.»

**CTA:**
> «¿Cuál eres? Dímelo en los comentarios y te mando el link de esa.»

**Tomas:**
1. Las tres armadas en fila sobre mármol (gancho) — armar antes de encender la cámara.
2. Plano cerrado de cada una, mismo encuadre, misma luz — **las tres seguidas sin mover el trípode**, para que el corte sea limpio.
3. Mano separándolas (gancho, segunda parte).

**Texto IG:** `Guardá este para cuando no sepas qué regalar. Las tres llevan 3 dijes → envío gratis. #Charms #PulserasPersonalizadas #AmorYAmistad`

---

### GUION 5 · Venta directa — «El tercer dije» · TikTok + IG Reels
**Pilar 2 · El guion más importante del lote. Es el hallazgo § 1.1 puesto en cámara.**
**Piezas: `pulsera-corazon-liso` (8 u) + `esfera-azul-con-cristales` (5 u) + `atrapasuenos-corazon-multicolor` (5 u) + `letra-e` (4 u)**

> **El orden importa y no es decorativo.** Los dos primeros dijes son de $72.000
> y **el tercero, `letra-e`, es el de $76.000**. Así el gancho —«este dije
> cuesta $76.000»— señala exactamente la pieza que entra de tercera, y la cuenta
> que se dice en voz alta es la de esa pieza. Si se cambia el orden o se
> sustituye una pieza, **los tres números cambian y hay que recalcularlos**.

| Bloque | Tiempo | Qué pasa |
|---|---|---|
| **Gancho** | 0–3 s | Pulsera con **dos** dijes sobre la mesa. Una mano deja la `letra-e` al lado, sin ponerla. **Texto: «Este dije cuesta $76.000… pero no si es el tercero»** |
| **Desarrollo** | 3–8 s | En pantalla, número grande: `2 dijes → $190.480`. Plano de la pulsera con dos |
| | 8–13 s | La mano pone el tercero. Clic. En pantalla: `3 dijes → $227.600` |
| | 13–18 s | En pantalla, en grande: `**+$37.120**` y debajo, más pequeño, `menos de la mitad de $76.000`. Plano final de la pulsera completa girando |

**Voz en off (exacta):**
> «Este dije cuesta setenta y seis mil pesos.
> Pero si es el tercero de tu pulsera, no.
> Con dos dijes, esta pulsera va en ciento noventa mil cuatrocientos ochenta.
> Le pongo el tercero… y queda en doscientos veintisiete mil seiscientos.
> Te salió en treinta y siete mil ciento veinte. **Menos de la mitad.**
> Porque a partir de tres, los dijes bajan quince por ciento y la pulsera baja treinta.
> Y desde ciento ochenta mil, el envío va gratis.»

**CTA:**
> «Ármala en el link. Y ponle tres.»

**Tomas:**
1. Pulsera completa (3 dijes) girando sobre la mesa (bloque 4).
2. Pulsera con 2 dijes, quieta (bloques 1 y 2) — **quitar la `letra-e`, no volver a montar todo**.
3. La mano poniendo la `letra-e` de tercera, con clic y audio limpio (bloque 3).

> **Verificación obligatoria antes de publicar:** correr el combo en el checkout
> real y confirmar los tres números. Si `catalogo.json` cambia la escala o el
> descuento, **este guion queda mintiendo** y hay que rehacerlo. Es el único
> guion del lote con esa dependencia.
>
> **Ya pasó una vez.** La primera versión de este guion decía $205.200 /
> $237.800 / tercer dije $32.600, y ninguno de los tres salía de `calcular()`.
> Los reales, con estas piezas y en este orden, son **$190.480 / $227.600 /
> $37.120** (verificado 2026-09-07, antes de grabar). La regla de § 4.1 —**el
> precio se corre, no se estima**— solo sirve si «verificado contra
> `_precios.js`» se puede reproducir, no solo escribir.

**Texto TikTok:** `hagan la cuenta 🧮 #joyeria #charms #pulseraspersonalizadas #zephoracharms`

---

### GUION 6 · Venta directa — Empaque y tarjeta · TikTok + IG Reels
**Pilar 2 · `pulsera-corona-pave` (8 u, tallas 17-20) + `letra-o` (4 u) + `virgen-maria` (4 u) + `manos-orando-con-cruz` (4 u) + Empaque Premium ($40.000)**
**Total real: $281.400 · envío gratis** (verificado con `calcular()`, 2026-09-07).

> Los tres dijes son de **$76.000**, así que cualquier otro trío a ese precio da
> el mismo total. Con dijes de otro precio **cambia**, y hay que recalcularlo
> antes de decirlo en cámara.

| Bloque | Tiempo | Qué pasa |
|---|---|---|
| **Gancho** | 0–3 s | Mano escribiendo a mano en la tarjeta de dedicatoria. Solo se ve la punta del lápiz y una palabra a medias. **Texto: «Lo que va escrito aquí no lo escribimos nosotros»** |
| **Desarrollo** | 3–8 s | La tarjeta entra en el empaque premium. Plano cenital del empaque cerrándose |
| | 8–14 s | Se abre desde el punto de vista de quien lo recibe: primero la tarjeta, después la pulsera |
| | 14–18 s | Muñeca puesta, con el empaque abierto de fondo, desenfocado |

**Voz en off (exacta):**
> «El empaque premium trae una tarjeta.
> Y lo que va escrito en esa tarjeta lo escribes tú, en el checkout — nosotros solo lo copiamos tal cual.
> Es lo primero que ve, antes que la pulsera.
> Pulsera, tres dijes y empaque: doscientos ochenta y un mil cuatrocientos, con envío gratis.»

**CTA:**
> «Escoge “Empaque Premium” en el paso dos. Ahí va tu dedicatoria.»

**Tomas:**
1. Apertura completa desde el punto de vista de quien recibe (bloque 3) — es la más larga, **grabar primero con luz fresca**.
2. Muñeca puesta con empaque desenfocado (bloque 4).
3. Cenital del empaque cerrándose (bloque 2).
4. Macro de la mano escribiendo (gancho).

**Texto IG:** `La tarjeta la escribís vos. Nosotros solo la copiamos tal cual. 🤍 #AmorYAmistad #RegalosConSignificado`

---

### GUION 7 · GRWM — Curaduría · IG Reels (formato nativo de IG)
**Pilar 3 · `pulsera-corona-pave` (8 u) + `letra-o` (4 u) + `carrusel-rosado` (3 u) + `flor-azul-con-cristales` (4 u)**

| Bloque | Tiempo | Qué pasa |
|---|---|---|
| **Gancho** | 0–3 s | Espejo, medio arreglada, muñeca vacía levantada a cámara. **Texto: «GRWM pero la parte que de verdad importa»** |
| **Desarrollo** | 3–9 s | Se pone la Corona Pavé. Plano de la muñeca contra el espejo |
| | 9–15 s | Añade los tres charms uno a uno. Cada clic, un corte |
| | 15–20 s | Se ajusta el pelo, la muñeca aparece en el plano al mover la mano. Salida |

**Voz en off (exacta):**
> «Todo el mundo hace el GRWM de la cara.
> Yo lo hago de la muñeca, que es lo que se ve cuando hablo con las manos.
> Corona pavé, mi inicial, un carrusel y una flor azul.
> Cuatro cosas que no combinan en teoría y que en la muñeca sí.»

**CTA:**
> «Comenta **PULSERA** y te mando el catálogo por mensaje.»

**Tomas:**
1. Todo el bloque de espejo, seguido, sin cortar (bloques 1, 2 y 4) — se corta en montaje.
2. Macro de cada charm entrando (bloque 3) — trípode aparte, luz de ventana.

**Texto IG:** `GRWM de muñeca 💍 Comentá PULSERA y te paso el catálogo. #GRWM #Charms #ZephoraCharms`

---

### GUION 8 · Sondeo — Las 14 letras que faltan · **Historia de Instagram** (no Reel)
**Pilar 4 · La pieza de mayor retorno de todo el documento, y no necesita cámara ni inventario.**

> **Esto es sondeo, nunca oferta** (BRIEF, regla 2). Las 14 letras **no existen
> en la mano**. La historia **pregunta**; no enseña un producto comprable, no
> lleva precio y no lleva link de compra. Si alguna versión de esto parece
> catálogo, está mal hecha.

**Formato:** dos historias seguidas.

**Historia 1 — la pregunta.** Fondo liso de marca. En tipografía grande, el
abecedario completo, con **las nueve que existen en color** (A B D E K L O S V) y
**las demás en gris muy claro**. Encima:

> «Tenemos nueve letras.
> Nos faltan catorce.
> **¿Cuál es la tuya?**»

Sticker de **caja de preguntas** abierta: *«Escribe tu inicial»*.

**Historia 2 — el porqué (se sube 30 min después).**
> «Preguntamos en serio: con lo que respondan, compramos las que más falten.
> Si la tuya no está, escríbela — es la forma de que llegue.»

**Por qué esto vale más que cualquier Reel del lote:** las 14 letras ausentes son
~$73.000 de costo para ~$1.064.000 de utilidad potencial (`CLAUDE.md` §
*Pendiente*, punto 1). Hoy esa compra **se decide a ciegas**. Esta historia da la
respuesta en 24 horas, cuesta cero, y va publicada el **viernes 19**, el día de
más tráfico al perfil de la quincena.

**Qué se hace con el resultado:** se cuenta cuántas veces sale cada letra en las
respuestas y se compran las más pedidas primero. **El resultado se anota en
`ESTADO.md`**, no en un chat: es un dato de compra, no una anécdota.

---

## 5 · Medición — cómo se sabe si esto sirve

Se hereda entera la decisión 3 del BRIEF y la lección de Copia 4 (`CLAUDE.md`):
**mejor CTR de la cuenta y de los peores en conversión.**

| Señal | Ordena el calendario | Para qué sirve |
|---|---|---|
| **Checkouts atribuidos al paquete** | **Sí. Es la única** | Decide qué se graba después |
| Guardados y compartidos | No | Diagnóstico: un carrusel muy guardado y sin checkout está bien hecho y mal ofertado |
| Vistas y alcance | No | Diagnóstico del gancho, nada más |
| Comentarios con la palabra clave | No, pero se cuenta | Mide si el CTA de comentario funciona; alimenta el bot de WhatsApp |

**Paciencia con la muestra:** la tienda produce ~55 checkouts al mes. Comparar
dos Reels con tres checkouts cada uno **no es un resultado, es ruido**. Antes de
declarar que un pilar funciona hacen falta semanas, no días.

**Un solo experimento por quincena.** Esta quincena el experimento es el
**guion 5** (el tercer dije): si el argumento del $37.120 —«menos de la
mitad»— mueve checkouts, pasa
a ser el CTA por defecto de todo el pilar 2 y se lleva también a la pauta.

---

## 6 · Lo que se decidió NO hacer — no deshacer sin leer

Igual que el BRIEF, esta parte importa más que el calendario.

1. **Nada de contenido de zodiaco** hasta reponer. Cero referencias elegibles y
   dos signos en cero (§ 1.4). Se ve tentador porque es el formato que más
   circula en joyería; aquí manda gente a un agotado.
2. **Nada de trends de baile ni de humor sin producto.** Traen vistas que no
   vuelven y consumen el mismo tiempo de cámara que un guion que vende. Es la
   versión orgánica del error de Copia 4.
3. **No se enseña `pulsera-avengers`, `pulsera-mickey-mouse-pave` ni
   `pulsera-rosa-clasica`**: están en cero.
4. **Las 14 letras ausentes solo aparecen en el sondeo**, nunca en un Reel de
   producto.
5. **No se publica un precio de memoria.** Sale de `_precios.js` o no sale.
6. **No se automatiza la publicación todavía** (BRIEF, Fase 4). Publicar a mano
   cuesta minutos y no arriesga la cuenta; automatizar antes de que los paquetes
   sean buenos es automatizar el envío de algo que no vale la pena enviar.
7. **No se graba con producto de menos de 3 unidades**, por bonito que se vea en
   cámara. Sin excepciones y sin bajar el listón cuando el pool se estreche: si
   el pool elegible baja de 10 referencias, el motor avisa (BRIEF § 1.5).

---

## 7 · Qué falta para que esto sea automático

Este documento es ejecutable **hoy, a mano**. Para que lo produzca el motor:

| # | Falta | Depende de |
|---|---|---|
| 1 | Que el prompt del motor emita el molde de la § 4.1 | Fase 1, paso 3 del BRIEF |
| 2 | Que el motor lea el precio real por combinación en vez de escribirlo | Llamar a `_precios.js` desde el paquete. **Hoy el guion 5 se verifica a mano** |
| 3 | Portadas consistentes para la cuadrícula | Remotion, [`CONTRATO-REMOTION.md`](CONTRATO-REMOTION.md) |
| 4 | Atribución de checkouts al paquete | `_atribucion.mjs`, sin mezclar en la rama `hub` |

**El punto 2 es el que más vale y el más barato:** el motor ya va a tener la
pieza elegida; llamar a `calcular()` con esa pieza y devolver el trío de números
del guion 5 convierte el hallazgo § 1.1 en una línea que se escribe sola en cada
guion de venta directa, en vez de un número que alguien tiene que acordarse de
comprobar.
