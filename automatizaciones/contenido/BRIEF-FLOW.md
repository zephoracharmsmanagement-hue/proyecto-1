# Encargo para la sesión de Google Flow — fotos crudas y b-roll

Documento de traspaso entre sesiones. Lo escribe la sesión de estrategia
editorial (2026-09-07) para la sesión que tiene Google Flow conectado y una
carpeta de fotos crudas.

**Antes de nada, leer:** [`BRIEF.md`](BRIEF.md) (qué se decidió no construir) y
[`CALENDARIO-EDITORIAL.md`](CALENDARIO-EDITORIAL.md) (los 8 guiones que hay que
alimentar). Este documento no los repite: dice **qué le toca a Flow y qué no**.

---

## La frontera, en una frase

**Flow hace movimiento y ambiente. Flow no hace producto.**

El plano donde se ve la pieza que se vende se graba con cámara, con la pieza
real en la mano. Todo lo demás —el aire entre cortes, la textura, la luz, el
fondo, el contexto de regalo— puede salir de Flow.

### Por qué, y por qué no se negocia

`BRIEF.md` regla 2: *«Imagen generada nunca puede parecer producto a la venta
que no existe. Cuando hay producto de por medio, la foto es real y la IA solo
pone el fondo.»*

Con video generativo el riesgo es **peor** que con imagen fija, y conviene
entender por qué antes de pedirle un macro a Flow: en un plano cerrado de
joyería, el modelo **reconstruye la pieza fotograma a fotograma**. Un dije que
en el segundo 1 tiene tres cristales, en el segundo 3 tiene cuatro. Un pasador
que se convierte en colgante. Eso no es un defecto de calidad: es un video de un
producto que no existe, enseñado como si estuviera a la venta. La tienda cobra
de verdad, y eso se paga con la clienta.

**Regla operativa:** si en el fotograma se puede leer *qué pieza es y cuánto
cuesta*, no lo hace Flow.

### La regla de oro, con las palabras del propietario

> **No se modifica la joya. Ni los jumps, ni el brazalete.**

Es la regla 2 del `BRIEF.md` dicha mejor, y conviene usar esta formulación
porque nombra las tres cosas concretas que un modelo altera sin que se note: la
pieza, **el jump** (la argollita que la une) y el brazalete. El jump es el que
más se pierde de vista y el que más delata: si cambia de forma o desaparece,
la foto deja de enseñar cómo se engancha de verdad lo que se está vendiendo.

**Lo que sí se puede cambiar:** el fondo, la luz, el contexto, el encuadre.
**Lo que no se toca nunca:** los píxeles de la joya, su jump y el brazalete.

### Y el audio

`BRIEF.md` decisión 1: el audio en tendencia se elige **dentro** de TikTok o
CapCut, y en video corto el audio es la mitad de la viralidad.

**Todo lo que salga de Flow se entrega mudo.** Si trae pista de audio, se quita
antes de guardarlo. Un clip de b-roll con audio propio pelea con el audio en
tendencia y obliga a silenciarlo a mano en cada montaje.

---

## Tarea 1 — Triaje de la carpeta de fotos crudas (antes de crear nada)

Esto va primero y es barato. **No se retoca ni se genera nada hasta tener este
inventario**, porque trabajar una foto de una pieza que no se puede vender es
tiempo tirado — es la misma trampa que `BRIEF.md` § 1.1 describe para el rodaje.

Lo que hay que producir es una tabla: **cada foto cruda → a qué id de
`assets/stock.json` corresponde → cuántas unidades tiene esa pieza**.

**El contador de unidades tiene una trampa ya documentada.** Un charm guarda
`stock: 3`. Una pulsera **no tiene campo `stock`**: tiene
`tallas: {"18": 2, "20": 1}`. Un `item.stock || 0` da **cero para las 18
pulseras sin dar ningún error**. El contador correcto:

```js
tipo === 'pulsera' ? suma(Object.values(tallas)) : stock
```

Con eso, la clasificación de cada foto:

| Unidades de la pieza | Qué se hace con la foto |
|---|---|
| **3 o más** (46 referencias) | **Se trabaja.** Es catálogo utilizable |
| 1–2 (58 referencias) | **Se archiva.** Ni se retoca ni se publica: se agota con dos ventas |
| 0 (25 referencias) | **Se archiva.** No existe |

### El hueco concreto que hay que buscar en esa carpeta

Comprobado hoy contra `assets/`: de las 46 referencias elegibles, **37 ya tienen
foto propia y 9 no**. Las nueve son **exactamente las letras elegibles**:

> **`letra-a`, `letra-b`, `letra-d`, `letra-e`, `letra-k`, `letra-l`,
> `letra-o`, `letra-s`, `letra-v`**

De letras solo existe `charms-de-letras-pave.webp`, que es una foto de grupo. No
hay ni una sola foto individual de una inicial.

**Y no están en la carpeta: el propietario confirmó (2026-09-07) que las nueve
letras están llegando y todavía no se han fotografiado.** Así que esto no es una
búsqueda, es **una sesión de fotos pendiente** — mesa, teléfono y media hora en
cuanto lleguen. No hay nada que Flow pueda hacer al respecto.

> **Y no se generan con IA, ni «solo para salir del paso».** Una letra generada
> es una joya dibujada, que es exactamente lo que prohíbe la regla de oro. Sin
> foto real, esas nueve piezas **no salen en cámara**.

Importa porque las letras son el charm más vendible del catálogo —una inicial es
el regalo personalizado por defecto— y salen en los guiones 5 y 7 de
`CALENDARIO-EDITORIAL.md`. **Mientras no lleguen y no estén fotografiadas, esos
dos guiones se graban con sustitutos:** en el guion 5, `sol-y-luna-con-cristales`
(4 u) en lugar de `letra-e`; en el guion 7, `mariposas-tricolor-colgantes` (3 u)
en lugar de `letra-o`. El guion no cambia en nada más — los precios de la § 1.1
de `CALENDARIO-EDITORIAL.md` son los mismos, porque los tres charms cuestan
igual o menos.

> **Las otras 14 letras (F G H I P Q R T U W X Y Z Ñ) no se fotografían ni se
> generan: no existen.** Aparecen solo en la historia de sondeo del guion 8, que
> **pregunta y no ofrece**. Una imagen que las haga parecer comprables es
> justo el fallo que la regla 2 previene.

---

## El presupuesto de créditos — la restricción que manda sobre todo lo demás

**Plan Flow Pro: 250 créditos de tope, +50 que se recargan cada día.**

Tres consecuencias, y la tercera es la que cambia el plan:

**1 · Las imágenes no gastan créditos. El video sí.** Y el costo de un video
depende de tres cosas: **duración, resolución y qué generador se use**. Esa es
toda la economía de esta herramienta.

**2 · El tope de 250 significa que los créditos NO se acumulan indefinidamente.**
Se pueden guardar como mucho **cinco días** (5 × 50 = 250). Estando en 250, la
recarga del día siguiente **se pierde**. Así que: o se gasta con regularidad, o
se ahorra a propósito durante cinco días justo antes de una tanda grande —nunca
más de cinco—.

**3 · Y la que de verdad importa: casi ningún b-roll de este proyecto necesita
video generado.** Esto corrige la lista de doce clips que traía la versión
anterior de este documento; se deja escrito el porqué para que nadie la
reponga.

### La escalera de costo — se baja hasta el escalón más barato que sirva

Antes de gastar un crédito, la pregunta es siempre: **¿cuál es el escalón más
barato que resuelve este plano?**

| # | Cómo se consigue el plano | Costo | Cuándo |
|---|---|---|---|
| **1** | **Una foto que ya existe + zoom lento en CapCut** | **Cero** | Textura, producto, cualquier plano quieto. `BRIEF.md` § 2.2 ya lo dice: *«una imagen con zoom lento da 3 segundos de aire»* |
| **2** | **Grabarlo con el teléfono** | **Cero, 2 minutos** | Manos, mesa, tela, luz de ventana. Todo lo que esté al alcance del brazo |
| **3** | **Imagen generada en Flow + zoom en CapCut** | **Cero créditos** | Fondos y ambientes que no se pueden fotografiar |
| **4** | **Video generado en Flow** | **Caro y limitado** | **Último recurso.** Solo lo que no se puede filmar ni fingir con un zoom |

Los doce clips de la versión anterior de este documento —mármol con luz, lino
arrugándose, manos envolviendo una cajita, tazas de café— **caen todos en los
escalones 1, 2 o 3**. Unas manos envolviendo un regalo se graban con el teléfono
en dos minutos y salen mejor que generadas, porque son las manos de verdad.
Pedirle eso a Flow es gastar el recurso escaso en lo único que sobra.

> **La regla, para no tener que releer la tabla:** un crédito de video se gasta
> **solo cuando algo tiene que moverse y cambiar de forma en cuadro, y no está
> al alcance de la cámara del teléfono.** Si el plano está quieto, es un zoom
> sobre una imagen y es gratis.

### Los ajustes que bajan el costo, y en qué orden se tocan

Cuando toque gastar, se gasta al mínimo:

1. **Duración: la más corta posible.** El b-roll está en pantalla 2–3 segundos.
   Generar 8 para usar 3 es tirar la diferencia.
2. **Generador: siempre el rápido/económico primero.** El de máxima calidad se
   reserva para un plano que ya demostró que se usa.
3. **Resolución: la menor que aguante el destino.** Un clip de 2 segundos entre
   dos cortes, visto en un teléfono, no necesita la resolución máxima. El hero
   del gancho sí.
4. **Un boceto antes que una obra.** Generar barato, meterlo en el montaje, y
   **solo si el video funciona** volver a generarlo en calidad. Al revés se
   pagan cinco veces planos que no entran al corte final.

### El registro de costos — hay que llevarlo desde el primer día

**No hay una tabla de costos escrita en este documento a propósito**, porque
sería un supuesto. La interfaz de Flow muestra el costo antes de generar.

**Anotar ese número real** en `automatizaciones/contenido/COSTOS-FLOW.md`, una
línea por generación: fecha · generador · duración · resolución · créditos ·
para qué guion. En dos semanas eso deja de ser burocracia y se convierte en la
tabla con la que se planea una tanda sin quedarse sin créditos a medias — que
es exactamente lo que pasa la primera vez que alguien no la lleva.

---

## Tarea 2 — Primero todo lo que es gratis

**El orden es este y no otro: agotar lo gratuito antes de tocar un crédito.**
Con imágenes ilimitadas y una carpeta de fotos reales, hay semanas de trabajo
sin gastar nada.

### 2.1 · La carpeta «pauta meta 2026» es el material, y es gratis trabajarla

Vive en la máquina del propietario, no en el repo. Contiene **creativos ya
editados**, no fotos crudas: material que ya pasó por una mano y que tiene buena
calidad. Se usan **todos** los que pasen el triaje de la Tarea 1.

**Que ya estén editados no los descalifica — pero cambia el cuidado.** Un
creativo terminado está **más lejos de la joya real** que una foto de catálogo:
ya lleva encima recortes, retoques y composición. Volver a editarlo acumula
deriva sobre deriva, y la joya es justo lo que no puede derivar.

De ahí la prueba que decide si un creativo sirve como producto:

> **¿Se puede aislar la joya de esta imagen sin tocarla?**
> **Sí** → sirve como producto: se cambia el fondo alrededor y los píxeles de la
> pieza, su jump y el brazalete pasan intactos a la versión nueva.
> **No** → no se usa como producto. Se puede aprovechar como **fondo o
> ambiente**, que es un destino perfectamente útil y no arriesga nada.

### Tres cosas que hay que revisar en un creativo viejo antes de reutilizarlo

Un creativo terminado trae cosas quemadas encima que una foto cruda no tiene, y
dos de ellas son problema de verdad:

1. **Precios quemados en la imagen.** Es la peor. Los precios de la tienda los
   calcula `netlify/functions/_precios.js` con la escala de charms y el
   descuento de brazalete; un creativo de hace meses puede llevar impreso un
   número que hoy **no es el que cobra el checkout**. Reutilizarlo es prometer
   un precio que la tienda desmiente. **Todo creativo con precio en la imagen se
   aparta hasta comprobar el número contra `calcular()`.**
2. **Menciones de otras marcas.** `CLAUDE.md` deja constancia de que se excluyó
   a propósito una variante que nombraba a Pandora, por riesgo de marca. Si algo
   así sigue en la carpeta, no se reutiliza.
3. **Texto y logos superpuestos** que ya no corresponden a la temporada, o que
   estorban al recortar a 9:16.

### Qué se hace con los que pasan, todo a coste cero

- **Recomposición de fondo.** La misma pieza sobre mármol, en luz de tarde o en
  mesa de regalo, sin volver a fotografiar nada.
- **Versiones de temporada.** Amor y Amistad ahora; Navidad y Día de la Madre
  después. Es **recomponer, no volver a fotografiar**.
- **Recortes por formato:** 9:16 historias, 4:5 feed, 1:1 catálogo.
- **Doble destino:** el mismo archivo sirve para **creativo de pauta** y para
  **contenido orgánico**. Es el mismo trabajo cobrado dos veces.

### 2.2 · Fondos y texturas como imagen, no como video

Lo que en la versión anterior era una lista de clips, ahora es una lista de
**imágenes** —gratis— a las que CapCut les pone el zoom:

Mármol blanco con luz cruzada · lino crudo · madera clara · destellos dorados
desenfocados sobre fondo oscuro · mesa de regalo vestida · superficie de piedra
clara.

Seis fondos, generados una vez, sirven para todos los guiones y todas las
temporadas. **Costo en créditos: cero.**

### 2.3 · Lo que se graba con el teléfono y no le cuesta a nadie

Manos envolviendo una cajita · una tarjeta en blanco y un lápiz · la luz de la
tarde cruzando la mesa · tela moviéndose · unas manos sirviendo café. Son dos
minutos de grabación y quedan mejor que generadas, porque son reales.

**Se hacen el mismo domingo de rodaje** de `CALENDARIO-EDITORIAL.md` § 2.1,
aprovechando que la cámara ya está montada.

---

## Tarea 2b — Dónde SÍ vale gastar créditos de video

Solo cuando esté hecho todo lo anterior, y solo en esto:

| Prioridad | Qué | Por qué vale el crédito |
|---|---|---|
| **1** | **Un plano de establecimiento de Amor y Amistad** que no se puede filmar: mesa vestida en luz dorada, profundidad, ambiente de celebración | Se reutiliza en los guiones 1, 2, 3 y 6 del lote. Un solo gasto, cuatro videos |
| **2** | **Un creativo de pauta con movimiento**, mudo y vertical | Los anuncios se ven **en silencio**, así que aquí el video generado no pierde nada — es justo donde `BRIEF.md` dice que el render mudo encaja. Y la pauta ya está gastando dinero real todos los días |
| **3** | **Un ambiente aspiracional** fuera de alcance: una locación, una luz o una escena que la cámara del teléfono no puede conseguir | Es lo único que no tiene sustituto gratis |

**Tres o cuatro generaciones bien elegidas, reutilizadas en todo el lote.** No
una por video. Un clip de ambiente que no lleva producto **no caduca y no se
gasta**: sirve igual en septiembre que en diciembre.

Y todo lo que salga de Flow, **mudo**: un clip con pista propia pelea con el
audio en tendencia que se elige dentro de CapCut (`BRIEF.md` decisión 1).

---

## Tarea 3 — Fondos para las fotos de catálogo (si Flow no da, se hace con otra herramienta)

`BRIEF.md` § 2.3: hay **116 archivos en `assets/`, casi todos sobre fondo blanco
de catálogo**. La misma pieza sobre mármol, en luz de tarde o en mesa de regalo
es un book de estilo de vida completo sin un día de fotos.

**Pero esto es recomposición, no generación:** se recorta la pieza real de la
foto real y se le cambia el fondo. La pieza **no se vuelve a dibujar**. Si la
herramienta redibuja la joya en vez de recortarla y pegarla, no sirve para esto
—vale para el bloque B de arriba, que no lleva producto—.

Empezar por las **8 pulseras elegibles**, que son las de cámara, y en concreto
por `pulsera-corazon-liso` y `pulsera-corona-pave`: son las dos únicas que
cubren las tallas 17 a 20 completas y por eso son las que aguantan un video de
venta directa a cualquiera.

---

## Lo que esta sesión NO debe hacer

1. **No generar planos de producto.** Ni macro, ni girando, ni «solo para
   probar». Es la regla 2 y aplica aunque el resultado se vea perfecto.
2. **No tocar `netlify/functions/`.** `BRIEF.md` decisión 4: una sola sesión toca
   la tienda. Si el trabajo empieza a pedir cambios ahí, se desvió.
3. **No gastar un crédito de video en algo que resuelve un zoom sobre una
   imagen, o dos minutos de teléfono.** Es la escalera de costo de arriba, y es
   el error que se comete el primer día.
4. **No comitear video al repo.** `BRIEF.md` decisión 5: Netlify cobra ~15
   créditos por despliegue y el historial de git se queda los archivos para
   siempre. Las 10 imágenes de `assets/ads/` son la excepción correcta —pesan
   poco y la CAPI necesita URL pública—. **Video no.** El b-roll vive en la
   máquina o en un host externo.
5. **No inventar precios.** Cualquier número que vaya en pantalla sale de
   `calcular()` en `netlify/functions/_precios.js`, nunca de memoria.
6. **No trabajar piezas de menos de 3 unidades**, por bonitas que salgan.
7. **No entregar nada con audio.**

---

## Las portadas — Flow y Remotion, no Flow o Remotion

La pregunta estaba abierta y los créditos la resuelven, porque **una portada es
una imagen y las imágenes no cuestan créditos**.

Pero el costo nunca fue el argumento. `BRIEF.md` § 2.1 dice por qué existen las
portadas: cuando alguien llega al perfil desde un video ve una **cuadrícula**, y
esa cuadrícula decide si sigue o se va. Para que parezca marca, **dos portadas
hechas con un mes de diferencia tienen que salir idénticas en estilo**. Un
modelo generativo no es determinista: pedir la misma portada dos veces da dos
portadas parecidas, y una cuadrícula de piezas parecidas se ve improvisada
—justo lo que se quería arreglar—.

**La portada se parte en dos capas, y cada herramienta hace la suya:**

| Capa | Herramienta | Por qué |
|---|---|---|
| **Fondo (plancha)** | **Flow**, imagen, gratis | Se generan **una vez** cuatro o cinco planchas —una por pilar de contenido— y **se reutilizan siempre**. Al no regenerarse, la falta de determinismo deja de importar |
| **Tipografía + recorte del producto real** | **Remotion** (o una plantilla fija mientras tanto) | Es código: sale idéntico siempre. Y **compone en vez de inventar**, así que la regla 2 se cumple sola |

Así la cuadrícula es consistente porque la capa que se repite es la
determinista, y el fondo es un activo fijo, no una tirada nueva cada vez.

**Qué hacer esta semana, sin esperar a nadie:** generar las **cuatro o cinco
planchas** en Flow (gratis) y montar la capa de tipografía en una plantilla fija
de CapCut o Canva. Remotion todavía necesita host propio con Chromium y FFmpeg,
se está explorando en otra sesión y **Netlify no sirve** para renderizarlo
(`CLAUDE.md`). Cuando esté listo, la capa de tipografía se migra y las planchas
siguen siendo las mismas. **Las portadas no se bloquean esperando a Remotion.**

---

## Cómo se sabe que esta sesión sirvió

No es «cuántos clips salieron» ni «cuántos créditos se gastaron». Es:

- **La tabla de triaje** de «fotos de pauta»: cada foto con su id de pieza y sus
  unidades, y las de menos de 3 unidades apartadas.
- **Saber si las 9 letras elegibles estaban en la carpeta** (A B D E K L O S V).
  Si no estaban, eso también es una respuesta: significa que hay que
  fotografiarlas.
- **Las fotos que pasaron el triaje, recompuestas** sobre fondo de estilo de
  vida y recortadas a 9:16, 4:5 y 1:1. Todo a coste cero.
- **Seis fondos y cuatro planchas de portada** generados como imagen.
- **`COSTOS-FLOW.md` empezado**, aunque sea con dos líneas.
- **Cero o casi cero créditos gastados.** Esta primera tanda es de imagen. Si se
  fueron cincuenta créditos en video de textura, la escalera de costo se saltó.
