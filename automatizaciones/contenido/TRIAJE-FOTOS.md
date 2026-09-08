# Triaje de la carpeta «pauta meta 2026»

Ejecuta la **Tarea 1** de [`BRIEF-FLOW.md`](BRIEF-FLOW.md). Hecho el
**2026-09-07** contra `assets/stock.json` (conteo 2026-08-01) y
`assets/catalogo.json`.

La carpeta vive en la máquina del propietario —`C:\Users\Martin\Pictures\pauta
meta 2026`—, **no en el repo**, y no debe entrar (decisión 5 del `BRIEF.md`).
Esto es el inventario de lo que hay ahí, para no volver a abrirla pieza por
pieza cada sesión.

**No se movió ni se editó ningún archivo.** Es un censo, no una limpieza.

---

## Lo primero, porque bloquea publicar: hay material que no se puede usar

El triaje encontró un problema que el `BRIEF-FLOW` no anticipaba. No es de
inventario ni de calidad: es **riesgo de marca**, y afecta a la mayor parte de
la carpeta.

### 1 · El creativo que había que sacar de la carpeta — hecho 2026-09-08

> **Resuelto.** Movido a `pauta meta 2026/NO USAR - riesgo de marca/`, fuera de
> la carpeta de trabajo. Ya no aparece en ningún triaje futuro de «pauta meta
> 2026». Queda la descripción de por qué, para que nadie lo devuelva por error.

**`WhatsApp Image 2026-08-02 at 10.25.12 PM (8).jpeg`** llevaba como titular,
en tipografía grande:

> **«No es Pandora… pero todos creen que sí»**

Y al pie, «Compatible con charms Pandora».

`CLAUDE.md` § *Creativos* ya registra que se dejó fuera de `assets/ads/` «la
variante que nombra a Pandora — riesgo de marca». **Es esta, y sigue viva en la
carpeta de trabajo.** La frase no es una comparación técnica: dice que la gente
va a confundir el producto con el de otra marca, que es exactamente la
confusión que el derecho de marcas existe para impedir. Un anuncio pagado con
ese texto no es un creativo flojo, es una prueba.

**No se usa, no se recorta, no se reaprovecha el fondo.** Verificado
directamente en esta sesión, no reportado de segunda mano.

### 2 · Las cuatro fotos crudas están tomadas encima de una caja Pandora

`0bd627e3`, `252cd55c`, `662562d4` y `af1c1237` —el material de mejor
resolución de la carpeta— tienen la pulsera apoyada sobre **una caja PANDORA
con el logotipo grabado en relieve por todo el fondo**, repetido y legible.

Verificado abriendo `662562d4`: el fondo entero es la palabra PANDORA y el
anillo-corona de su logotipo, decenas de veces.

Esto **no las descalifica** —son las fotos con mejor luz y las únicas donde se
ve `letra-a` montada—, pero convierte la recomposición de fondo de la Tarea 2.1
en **obligatoria, no opcional**. Y encaja perfecto con lo que el `BRIEF-FLOW`
manda hacer: *la joya no se toca, el fondo sí*. Aquí el fondo **hay** que
cambiarlo.

### 3 · «Compatible con charms Pandora» aparece en ~12 archivos más

Es una afirmación distinta de la del punto 1: describe la compatibilidad física
del producto, no invita a confundirlo. Está en los creativos ya compuestos
—incluido el que se usó de referencia de estilo— y **es una decisión de negocio,
no un error de producción**.

No la resuelve esta sesión. Pero conviene que esté escrito en un sitio: el
mismo `CLAUDE.md` que excluyó la variante del punto 1 no dice nada sobre esta
fórmula más suave, y hoy se está publicando sin que nadie haya decidido que sí.

### 4 · Detalles menores del mismo problema

- **`e3708bcc`** conserva una marca de agua tenue del logotipo corona-O dentro
  de la caja ya compuesta. Se le escapó al retoque.
- **`762007110_1358…`** muestra un charm con el punzón **«925 ALE»** legible
  —marca de fabricante de Pandora—.
- **Disney** (2 creativos) y **Marvel/Avengers** (1) aparecen nombrados. El set
  Marvel sí es catálogo elegible; el asunto es cómo se nombra en el copy.

---

## La tabla

40 archivos en disco → **35 piezas visuales únicas** (un duplicado exacto por
hash y tres WhatsApp que son re-guardados de creativos ya listados).

Elegibilidad recalculada con el contador correcto
—`tipo === 'pulsera' ? suma(Object.values(tallas)) : stock`—: **46 elegibles /
58 en 1–2 / 25 en cero** sobre 129 referencias. Coincide con el `BRIEF.md`.

| Archivo | Pieza(s) de `stock.json` | Unidades | Veredicto |
|---|---|---|---|
| `0bd627e3-…jfif` **(cruda)** | manos-orando-con-cruz · virgen-maria · trebol-verde-giratorio · caballo-herradura · pulsera-corazon-liso | 4·4·5·3·8 | **Trabajar** ⭐ |
| `662562d4-…jfif` **(cruda)** | pulsera-corona-pave · esfera-azul-con-cristales · flor-azul-con-cristales · atrapasuenos-corazon-multicolor · **letra-a** | 8·5·4·5·3 | **Trabajar** ⭐ |
| `af1c1237-…jfif` **(cruda)** | pulpo-azul-cristal · atrapasuenos-azul · huella-con-huesito · gatito-con-corazon-azul · mariposas-tricolor · ~~virgo~~ | 5·7·4·3·3·**2** | Trabajar **sin virgo** |
| `252cd55c-…jfif` **(cruda)** | gato-cheshire · dalmata · buzz-lightyear · sulley · mike-wazowski | 3·2·2·1·1 | Archivar |
| `af1c1237-… (1).jfif` | *duplicado exacto* | — | Duplicado |
| `Crear_anuncio_…ZEPHORA_2216.jpeg` | = set de `0bd627e3` | 4·4·5·3·8 | **Trabajar** ⭐ |
| `Modificar_formato_del_texto_2K_2216.jpeg` | = set de `0bd627e3` (1:1) | 4·4·5·3·8 | **Trabajar** ⭐ |
| `Modificar_formato_manteniendo_co…_2216.jpeg` | = set de `0bd627e3` (9:16) | 4·4·5·3·8 | **Trabajar** ⭐ |
| `Modificar_el_formato_2K_2217.jpeg` | = set de `662562d4` (4:5) | 8·5·4·5·3 | **Trabajar** ⭐ |
| `Modificar_formato_manteniendo_co…_2217.jpeg` | = set de `662562d4` (9:16) | 8·5·4·5·3 | **Trabajar** ⭐ |
| `image_(5).jpg_2216.jpeg` | = set de `662562d4` (4:5) | 8·5·4·5·3 | **Trabajar** ⭐ |
| `762070262_…_n.jpg` | **manos-orando-con-cruz** (pieza sola, aislable) | 4 | **Trabajar** ⭐⭐ |
| `762650437_…_n.jpg` | pulsera-corona-pave · pulsera-corazon-pave-pequeno · pulsera-clasica-cierre-barril | 8·6·6 | **Trabajar** ⭐ |
| `762007110_1656…_n.jpg` | conejita-con-corazon-rosa · osito-pave-con-corazon | 4·3 | Trabajar (parcial) |
| `WhatsApp … 10.25.12 PM.jpeg` | «Por qué las clientas aman» (9:16) | 4·3 | Trabajar (parcial) |
| `Modificar_formato_2K_2217.jpeg` | set azul **con virgo** | incl. **2** | Quitar virgo |
| `imageas.jpg_2217.jpeg` | set azul **con virgo** (4:5) | incl. **2** | Quitar virgo |
| `e3708bcc-…jfif` | pulsera-mano-de-hamsa · gatito-con-corazon-azul · carrusel-rosado · ~~corazon-de-filigrana~~ · ~~avion-globo-y-pasaporte~~ | 3·3·3·**2**·**2** | Mixto |
| `WhatsApp … (6).jpeg` | pulsera-mano-de-hamsa · gatito · ~~corazon-de-filigrana~~ · ~~avion~~ | 3·3·**2**·**2** | Mixto |
| `762811723_…_n.jpg` | 6 charms Marvel · **pulsera-avengers** | 3×6 · **0** | **Remontar sobre Clásica** |
| `761361803_…_n.jpg` | libra · virgo · leo · geminis · piscis | 2 c/u | **Archivar** (zodiaco) |
| `761148670_…_n.jpg` | ariel · cenicienta · blancanieves | 2·2·1 | Archivar |
| `762007110_1358…_n.jpg` | gato-cheshire · stitch · sulley · mike · buzz · dalmata | 3·1·1·1·2·2 | Archivar |
| `762846401_…_n.jpg` | charm-medicina · fisioterapia · odontologia · psicologia | 2 c/u | Archivar |
| `763318273_…_n.jpg` | charms-de-letras (foto de grupo) | — | Archivar como producto |
| `Modificar_formato_2K_2217 (1).jpeg` | Disney (verde/morado) | 1–2 | Archivar |
| `Modificar_formato_del_texto_2K_2217.jpeg` | Disney (4:5) | 1–2 | Archivar |
| `image_(6).jpg_2217.jpeg` | Disney (4:5) | 1–2 | Archivar |
| `Gemini_Generated_Image_mp6z….jfif` | sin producto — logotipo Ž sobre rosa | — | **Plancha de portada** |
| `760632220_…_n.jpg` | no identificable | — | Fondo/ambiente |
| `763353914_…_n.jpg` | mixto «Arma tu pulsera» | — | Fondo/educativo |
| `WhatsApp … (1).jpeg` | «Arma tu propia pulsera» (9:16) | mixto | Fondo/educativo |
| `WhatsApp … (3).jpeg` | «Más de 100 charms» | — | Fondo/ambiente |
| `WhatsApp … (4).jpeg` | lifestyle muñeca (mano generada) | — | **Solo fondo** |
| `WhatsApp … (5).jpeg` | lifestyle café (mano generada) | — | **Solo fondo** |
| `WhatsApp … (2).jpeg` | **joya enteramente generada** presentada como oferta | 3·2 | **Solo fondo** |
| `WhatsApp … (8).jpeg` | «No es Pandora…» | — | **NO USAR** |
| `WhatsApp … (7)`, `(9)`, `10.25.13 PM` | duplicados de los anteriores | — | Duplicados |

### Tres cosas de la tabla que cambian decisiones

- **`762811723` enseña `pulsera-avengers`, que está en cero.** Es literalmente
  lo que `CALENDARIO-EDITORIAL.md` § 6.3 prohíbe. Los 6 charms Marvel sí son
  elegibles: el set se remonta sobre `pulsera-clasica-cierre-barril` (6 u,
  tallas 20-21), como ya manda el guion 3.
- **Tres creativos llevan `virgo` (2 u)** dentro de una composición por lo demás
  toda elegible. Se quita el dije, no se descarta la pieza.
- **`WhatsApp … (2).jpeg` es joya generada enseñada como oferta** — regla 2 del
  `BRIEF.md`. Sirve de fondo y nada más. (Además tiene la errata «Si nosabes
  qué regalar».)

---

## Los tres checks que pedía la Tarea 2.1

**(a) Precios quemados: ninguno.** Ningún creativo lleva una cifra en COP. Lo
que sí llevan 14 de ellos es la promo **«brazalete + 3 charms → 30% OFF en el
brazalete»**, y esa afirmación **es correcta**: `descuentoBrazalete: 0.3` y
`minCharmsParaDescuento: 3`.

Pero **se queda corta**. Omite que `escalaCharms[3] = 0.15` se dispara a la vez,
que es lo que hace que el tercer dije salga por menos de la mitad
(`CALENDARIO-EDITORIAL.md` § 1.1). El creativo **infravende** el argumento más
fuerte que tiene la tienda. No hay que corregirlo por falso; hay que rehacerlo
por incompleto.

> Y ojo con qué número se le pone encima: los que estaban escritos en el
> calendario hasta hoy (**$205.200 / $237.800 / tercer dije $32.600**) **eran
> incorrectos**. Los reales están en la § 1.1 corregida, y antes de imprimir
> uno en una imagen se corre
> `node automatizaciones/contenido/verificar-precios-guiones.js`.

**(b) Menciones de marca:** todo el bloque de arriba. Es el hallazgo grande.

**(c) Texto que estorba el 9:16:** resuelto para los creativos compuestos —ya
existen en 1:1, 4:5 y 9:16 del mismo set—. Los que sí estorban son los
`762*_n.jpg` (título arriba + firma abajo, ~35% del alto) y `760632220` /
`WhatsApp (3)`, con texto centrado encima del producto.

---

## Las nueve letras: el `BRIEF-FLOW` acierta, con un matiz

**Confirmado:** no hay ninguna foto de catálogo individual de las nueve
elegibles (A B D E K L O S V). Sigue haciendo falta la sesión de fotos.

**El matiz:** `letra-a` **sí está fotografiada**, montada en una pulsera, en
`662562d4` y sus cinco composiciones. Sirve para enseñarla en contenido; **no**
sirve como foto de catálogo —está en ángulo, parcialmente ocluida, no es
recortable sobre blanco, y el fondo es la caja Pandora—.

**B, D, E, K, L, O, S y V no aparecen en ningún archivo.**

Esto no cambia la conclusión del brief: *grabar* no está bloqueado (los guiones
5 y 7 usan `letra-e` y `letra-o` con la pieza real en la mano), y toda la rama
de trabajo con imagen sí lo está.

---

## Por dónde empezar, a coste cero

**El set de `0bd627e3`** —manos orando (4) · virgen María (4) · trébol (5) ·
herradura (3), sobre Corazón Liso (8)—. Es el único donde **las cinco piezas son
elegibles**, ya está recompuesto en los tres formatos, no tiene precio quemado y
es coherente con el pilar espiritual del guion 4 y con el titular que la marca
ya usa («Un camino de fe, una vida de suerte»).

Lo que hay que hacerle: **cambiarle el fondo** —obligatorio, por la caja
Pandora— y recortarlo a 9:16 / 4:5 / 1:1. Nada de eso cuesta créditos de video.

---

## Lo que este triaje NO hizo

- **No movió ni borró nada.** Incluido el creativo del punto 1: la decisión de
  borrarlo es del propietario, no de una sesión.
- **No generó ninguna imagen.** Cero créditos gastados, que es lo que el
  `BRIEF-FLOW` pone como medida de éxito de la primera tanda.
- **No decidió sobre «Compatible con charms Pandora».** Está señalado para que
  alguien lo decida, no resuelto.
