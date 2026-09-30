---
name: deconstruir-video
description: Convertir un video de referencia (un Reel o TikTok de la competencia, uno viral, uno propio que funcionó) en un guion de Zephora Charms listo para grabar. La deconstrucción toma por toma la hace Gemini con un Gem; esta skill trae ese prompt y la segunda mitad, la que solo puede hacerse aquí, que cruza el análisis con inventario, precios y el molde de guion del repo. Úsala siempre que alguien pegue un análisis audiovisual en .md, pida «copiar», «replicar» o «hacer uno como este» sobre un video, quiera analizar un Reel o TikTok ajeno, o pregunte cómo configurar el Deconstructor en Gemini — aunque no diga «deconstruir» ni «skill».
---

# Deconstruir un video y volverlo guion de Zephora

Dos mitades, dos herramientas, a propósito:

| Paso | Dónde | Por qué ahí |
|---|---|---|
| **1 · Deconstruir** el video de referencia | **Gemini**, en un Gem | Recibe el video directo **con audio**. Claude no recibe video ni oye el sonido, y en video corto el audio es la mitad del resultado (`automatizaciones/contenido/BRIEF.md`, decisión 1) |
| **2 · Traducir** el análisis a un guion propio | **Claude**, aquí | Solo este repo sabe qué piezas hay, a qué precio y con qué molde se escribe un guion |
| **3 · Grabar y montar** | El propietario, en **CapCut** | El audio en tendencia se elige ahí; eso no se automatiza (BRIEF, decisión 1) |

La separación no es comodidad: el Deconstructor tiene prohibido interpretar, y
esta mitad existe para interpretar. Si una sola IA hace las dos, describe lo que
le gustaría ver en vez de lo que hay.

## Paso 1 — Configurar el Gem (una sola vez)

El prompt completo está en
[`references/prompt-gemini.md`](references/prompt-gemini.md). Es el original del
propietario con cinco añadidos descriptivos: precisión temporal honesta, tipo de
audio, apertura de 0–3 s, texto en pantalla por toma y cierre/CTA.

Si el usuario pregunta cómo montarlo: gemini.google.com → **Gems** → **Nuevo
Gem** → pegar el bloque del archivo como instrucciones → guardar. Después solo
sube el video en cada conversación.

**Límite que hay que decir en voz alta:** Gemini muestrea el video a ~1 cuadro
por segundo, así que los cortes de menos de un segundo —lo normal en un Reel—
pueden no aparecer. Si el ritmo exacto importa y el usuario tiene el archivo en
su máquina, los cortes reales salen con:

```
ffmpeg -i video.mp4 -vf "select='gt(scene,0.3)',showinfo" -f null - 2>&1 | grep pts_time
```

Esa lista se le pega a Gemini junto con el video; el prompt ya le dice que las
marcas medidas mandan sobre las suyas.

## Paso 2 — Del análisis al guion (lo que se hace aquí)

Cuando el usuario pegue el `.md` que devolvió Gemini:

### 2.1 · Leer el análisis como datos, no como plan

Revisar primero **«Lo que no se puede determinar»** y las marcas `[incierto]`.
Si el gancho (0–3 s) o el audio cayeron ahí, decirlo antes de construir nada:
un guion montado sobre un gancho que nadie vio con claridad es una copia a
ciegas.

### 2.2 · Separar lo que se copia de lo que no

**Se toma del video de referencia** (es estructura, no es de nadie):

- La mecánica del gancho: qué se ve en el primer cuadro y qué cambia antes del
  segundo 1.
- El ritmo: duración de toma, dónde acelera y dónde se detiene.
- El tipo de plano de cada bloque: macro, cenital, muñeca a contraluz, manos.
- Cómo usa el texto en pantalla: cuántos, cuándo entran, cuánto duran.
- El tipo de cierre y de CTA.

**No se toma nunca:**

- Su producto, su precio ni su oferta.
- Su texto literal. Se reescribe en la voz de Zephora.
- Su audio concreto. Se anota el **tipo** («voz en off sobre audio en
  tendencia»); cuál usar se elige dentro de CapCut o TikTok.
- Nada que nombre otra marca de joyería. Es el mismo criterio que sacó de
  `assets/ads/` la imagen que nombraba a Pandora.

### 2.3 · Elegir la pieza con el inventario real, no con el video

La pieza la decide el inventario, nunca el video. Las reglas son las de
`automatizaciones/contenido/BRIEF.md` § 1.1 y no se repiten aquí porque ya
tienen trampas documentadas (las unidades de las pulseras viven en `tallas`,
no en `stock`). En corto:

- **Solo piezas con 3 unidades o más**, leídas de `assets/stock.json` y, si
  está disponible, descontando lo apartado con `disponibilidad.mjs`.
- Si el video de referencia depende de una pieza que no tenemos (una letra en
  cero, un signo sin unidades), se dice y se propone la elegible más parecida.
  No se escribe el guion igual.

### 2.4 · Escribir el guion con el molde del repo

El formato es el de `automatizaciones/contenido/CALENDARIO-EDITORIAL.md` § 4.1,
con sus siete partes en orden: pieza y unidades, gancho visual 0–3 s,
desarrollo cronometrado, voz en off exacta, CTA dicho y escrito, **tomas en
orden de rodaje** y texto por red.

Además, una línea al inicio que diga de dónde salió:

> **Referencia:** [nombre del archivo analizado] · se tomó [gancho / ritmo /
> estructura de cierre] · se cambió [lo que se adaptó y por qué]

Y las tres reglas de ese molde, sin excepción:

1. **Todo precio sale de `calcular()`** y se añade a
   `automatizaciones/contenido/verificar-precios-guiones.js`. Correr
   `node automatizaciones/contenido/verificar-precios-guiones.js` antes de
   entregar. Si un precio no se reproduce, no se escribe.
2. **No se enseña una pieza con menos de 3 unidades.**
3. **Producto en cámara = producto real.**

### 2.5 · Marcar con qué se hace cada toma

La regla ya está decidida en `automatizaciones/contenido/BRIEF-FLOW.md`, en
«La frontera» y en «Las tres formas de hacer video», fijadas el 2026-09-08.
Leerla antes de etiquetar: tiene el detalle de modelos y de créditos. Cada toma
de la lista lleva una de estas etiquetas:

- **[cámara]**: es lo que se usa por defecto para cualquier plano donde se lea
  qué pieza es. Es gratis y es la pieza real.
- **[Flow · ambiente]**: tomas sin joya, como ambiente, textura, luz, empaque
  cerrado o fondos para texto. Sirve cualquier modelo, también Omni.
- **[Flow · Veo 3.1 Fast con joya]**: solo cuando la cámara del teléfono no
  puede lograr el plano. Es el **único** modelo autorizado con la pulsera de
  referencia; Omni la desfiguró. Cuesta créditos y es último recurso, no
  opción por defecto. Antes de usarlo, **revisarlo cuadro por cuadro**, no a
  velocidad normal: la joya, **el jump** y el brazalete tienen que ser los
  mismos en cada fotograma.

Todo lo que salga de Flow se entrega **mudo**. Si el video de referencia basa su
efecto en un plano de producto que solo se lograría generándolo, se propone
primero una versión grabada con cámara.

## Lo que esta skill no hace

- **No deconstruye el video ella misma.** Si el usuario pega un video o un
  enlace aquí, explicar el paso 1 y pedir el `.md` de Gemini. Sacar cuadros con
  `ffmpeg` y describirlos sin audio da la mitad del análisis y se presenta como
  entero; solo se hace si el usuario lo pide sabiendo eso.
- **No edita imágenes de producto.** Eso será la skill `imagen-producto`
  (Kie o Flow), que aún no existe. Mientras tanto, la regla vive en `automatizaciones/contenido/BRIEF.md`,
  decisión 2, «se edita la escena, no la joya».
- **No publica.** Publicar es la Fase 4 del BRIEF.
