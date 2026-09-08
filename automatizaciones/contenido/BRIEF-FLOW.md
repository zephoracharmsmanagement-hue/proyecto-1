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

**Eso es lo primero que hay que buscar en la carpeta cruda**, porque las letras
son el charm más vendible del catálogo (una inicial es el regalo personalizado
por defecto) y salen en los guiones 5 y 7. Si en la carpeta hay tomas sueltas de
iniciales, recuperarlas vale más que cualquier otra cosa que se haga hoy.

> **Las otras 14 letras (F G H I P Q R T U W X Y Z Ñ) no se fotografían ni se
> generan: no existen.** Aparecen solo en la historia de sondeo del guion 8, que
> **pregunta y no ofrece**. Una imagen que las haga parecer comprables es
> justo el fallo que la regla 2 previene.

---

## Tarea 2 — B-roll mudo, que es donde Flow rinde de verdad

`BRIEF.md` § 2.2: *«Un Reel necesita cortes cada 2–3 segundos o la gente se va.
Sin b-roll hay que grabar el triple.»*

Ese es el encargo. **Clips de 3 segundos, verticales 9:16, mudos, sin producto
identificable**, que sirven de aire entre los planos reales.

Especificación fija para todo lo que se pida:

| | |
|---|---|
| Duración | 3 segundos |
| Formato | Vertical 9:16 |
| Audio | **Ninguno** |
| Movimiento | Lento. Un empuje suave o un giro. Nada de cámara nerviosa |
| Luz | Natural, de ventana, tarde. Cálida, no de estudio |
| Paleta | Mármol blanco, madera clara, lino crudo, dorado suave, verde salvia |
| Producto | **Ausente**, o desenfocado al fondo sin que se lea qué pieza es |

### Lo que hace falta, por prioridad

**Bloque A — Ambiente de regalo (urgente: Amor y Amistad es el 19 de septiembre).**
Alimenta los guiones 1, 2, 3 y 6.

1. Manos envolviendo una cajita pequeña con cinta, plano cenital, mármol.
2. Una tarjeta de dedicatoria en blanco sobre una mesa, con una mano dejando un
   lápiz al lado.
3. Luz de ventana de tarde moviéndose sobre una mesa vacía de madera clara.
4. Dos tazas de café y unas manos, plano medio, conversación que no se oye.
5. Una cajita cerrada sobre lino crudo, la cámara empujando muy despacio.

**Bloque B — Textura y transición.** Sirven para cualquier guion.

6. Mármol blanco con la luz cruzando, giro lentísimo.
7. Lino crudo arrugándose muy despacio.
8. Destellos dorados desenfocados (bokeh) sobre fondo oscuro.
9. Agua muy quieta con un reflejo cálido.

**Bloque C — Contexto de uso, sin que se lea la pieza.** Guiones 2 y 7.

10. Una muñeca escribiendo en un teclado, **desenfocada**, sin que se distinga
    qué lleva puesto.
11. Alguien apartándose el pelo con la mano, contraluz, plano corto.
12. Manos abriendo unas cortinas por la mañana.

**Doce clips de 3 segundos cubren los ocho guiones del lote 1 con margen.** No
hacen falta más: el b-roll se reutiliza entre videos, es su gracia.

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
3. **No comitear video al repo.** `BRIEF.md` decisión 5: Netlify cobra ~15
   créditos por despliegue y el historial de git se queda los archivos para
   siempre. Las 10 imágenes de `assets/ads/` son la excepción correcta —pesan
   poco y la CAPI necesita URL pública—. **Video no.** El b-roll vive en la
   máquina o en un host externo.
4. **No inventar precios.** Cualquier número que vaya en pantalla sale de
   `calcular()` en `netlify/functions/_precios.js`, nunca de memoria.
5. **No trabajar piezas de menos de 3 unidades**, por bonitas que salgan.
6. **No entregar nada con audio.**

---

## Cómo se sabe que esta sesión sirvió

No es «cuántos clips salieron». Es:

- **Las 9 letras elegibles tienen foto individual** (o consta que en la carpeta
  cruda no estaban, que también es una respuesta útil y decide si hay que
  fotografiarlas).
- **Doce clips de b-roll mudos** guardados y nombrados por bloque.
- **La tabla de triaje** de la carpeta cruda: cada foto con su id y sus unidades.

Con eso, los ocho guiones de `CALENDARIO-EDITORIAL.md` se pueden grabar y montar
sin parar a buscar material.
