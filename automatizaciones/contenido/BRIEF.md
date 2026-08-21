# Motor de contenido — brief

Documento de arranque en frío. Si estás abriendo esto en una sesión nueva y no
sabes nada del proyecto, el orden es: [`ESTADO.md`](../../ESTADO.md) (cómo está
la tienda), [`CLAUDE.md`](../../CLAUDE.md) (cómo está la pauta) y luego esto.

Lo que sigue **no es un plan de marketing**: es la especificación de una pieza
de software y, sobre todo, el registro de **qué se decidió no construir y por
qué**. La segunda parte importa más que la primera, porque las decisiones de no
construir son las que una sesión nueva deshace sin darse cuenta.

---

## Qué es, en una frase

Un motor que **no produce videos**: produce **paquetes de rodaje**. Elige la
pieza según inventario real, escribe el gancho, el guion segundo a segundo y la
lista de tomas, genera la portada y el b-roll, cronometra los subtítulos y deja
el texto y los hashtags de cada red. El propietario graba, monta en CapCut con
audio en tendencia y publica.

**El objetivo es bajar el trabajo por video de ~40 minutos a ~5.** Lo que se
automatiza es **decidir y preparar**, que es donde se va el tiempo. El corte no
—es la parte que el propietario disfruta y la que ninguna máquina hace con
criterio.

Un Reel vertical sirve para **TikTok, Reels de Instagram y Reels de Facebook**.
Se graba una vez, se publica tres veces. Eso es lo que hace que el video valga
la pena: el costo de producción se reparte entre tres redes.

---

## Las cinco decisiones que no hay que deshacer

Antes de la especificación, porque son lo que se pierde primero.

### 1 · CapCut es del propietario, a propósito. No se automatiza.

**Lo técnico:** CapCut no tiene API pública para editar proyectos desde fuera.
No hay conector oficial. Lo que se encuentra buscando son envoltorios no
oficiales que raspan la aplicación o generan archivos de proyecto por ingeniería
inversa.

**Y hay un riesgo concreto, no teórico:** CapCut y TikTok son ambos de
ByteDance, con la misma cuenta. Un envoltorio no oficial pone en riesgo la
cuenta de TikTok — que es justo el activo que este proyecto intenta construir.
No compensa por ahorrar diez minutos.

**Pero la razón de fondo no es técnica, y es la que hay que entender para no
volver sobre esto:** el audio en tendencia solo se consigue **dentro** de TikTok
y CapCut, y en video corto el audio es la mitad de la viralidad. Una
automatización que arme el video por fuera entrega algo mudo o con música
genérica — es decir, entrega justo la parte que no sirve. Lo mismo con las
plantillas de CapCut: son la forma más rápida que existe de montarse a una
tendencia, y son un botón que aprieta una persona.

| La máquina hace | El propietario hace en CapCut |
|---|---|
| Elige la pieza según inventario real | Pega sus clips |
| Escribe gancho, guion y lista de tomas | Elige plantilla y audio en tendencia |
| Genera portada y b-roll | Ajusta y exporta |
| Escribe subtítulos ya cronometrados | Publica |
| Deja el texto y los hashtags por red | |

Si algún día se quiere armado automático de verdad, **la vía sana es FFmpeg**
—gratis, n8n lo llama directo— y solo para lo mecánico: pegar clips, quemar
subtítulos, exportar vertical. Es fase tardía y probablemente no haga falta.

### 2 · Imagen generada nunca puede parecer producto a la venta que no existe

**Regla firme, sin excepciones.** Cuando hay producto de por medio, **la foto es
real y la IA solo pone el fondo**. Una imagen totalmente generada solo vale para
**sondeo** —preguntar si algo interesaría— y tiene que leerse como pregunta,
nunca como oferta.

La diferencia no es de estilo: es que la tienda cobra de verdad. Una imagen
generada que se lee como catálogo es una venta prometida de algo que no está en
la mano, y eso se paga con la clienta, no con una métrica.

### 3 · La medición cierra en checkouts, no en vistas

Esto ya se aprendió caro en pauta y está escrito en `CLAUDE.md`: **Copia 4 tenía
el mejor CTR de toda la cuenta (15,43%) y era de los peores en conversión.**
Juzgar creativos por CTR habría escalado justo el que peor rendía.

Un Reel con 40.000 vistas y cero checkouts es peor que uno con 3.000 y seis,
porque el primero consume el tiempo de grabación que habría producido el
segundo. **La única métrica que ordena la lista de qué grabar después es el
costo/beneficio por checkout, no el alcance.**

### 4 · Una sola sesión toca la tienda

Regla del repo, ya pisada: dos sesiones construyeron cada una su sistema de
rescate de carritos. Git no dio ningún conflicto y el resultado en producción
habrían sido dos correos a la misma clienta. Ver `CLAUDE.md` §
*Cómo se reparte el trabajo entre sesiones*.

Para este motor: **no toca `netlify/functions/` salvo un endpoint de lectura**
(§ Fase 1). Todo lo demás vive en n8n y en `automatizaciones/`. Si una tarea de
contenido empieza a pedir cambios en el checkout, es señal de que se desvió.

### 5 · Los videos NO se comitean al repo

Netlify cobra **~15 créditos por despliegue de producción**, dure lo que dure, y
el ciclo actual son ~66 (ver `ESTADO.md` § *Lo primero*). Meter videos al repo
gasta despliegues **y** ancho de banda, y no hay vuelta atrás fácil: el
historial de git se queda con ellos para siempre.

Las 10 imágenes de `assets/ads/` son el precedente y son la excepción correcta:
pesan poco y la CAPI necesita URL pública. **Video no.** Cuando la Fase 4 lo
necesite alojado, se resuelve con Netlify Blobs o un host externo — nunca con un
commit.

---

## Fase 1 — El motor de paquetes de rodaje

El v1. Es lo único que hay que construir para que el sistema sirva.

### 1.1 · La elegibilidad de la pieza — y la trampa que ya cazamos

**Nunca se graba una pieza que no se puede vender.** Un Reel que funciona sobre
una pieza con 1 unidad es el peor resultado posible: gasta la grabación, gasta
el alcance y termina en «se agotó».

Regla: **elegible = 3 unidades o más**, descontando lo ya apartado por un pago
en curso.

Los números de hoy (`assets/stock.json`, `generado: 2026-08-16`), sobre 129
referencias:

| Estado | Referencias |
|---|---|
| En cero | 24 |
| 1–2 unidades | 59 |
| **3 o más — pool elegible** | **46** |

46 referencias son meses de calendario a un video por pieza. **El limitante del
contenido no es el inventario; es el tiempo de grabación.**

> **La trampa, y hay que escribirla porque ya nos pasó al calcular esto:**
> `stock.json` guarda las unidades en **dos formas distintas**. Un charm tiene
> `stock: 3`. Un brazalete **no tiene campo `stock`** — tiene
> `tallas: {"18": 2, "20": 1}`. Un lector que haga `item.stock || 0` da **cero
> para las 18 pulseras** y el motor deja de proponerlas para siempre, **sin dar
> ningún error**. Es exactamente el patrón de fallo silencioso que `ESTADO.md`
> § *Los fallos silenciosos* describe como el que más caro salió.
>
> El contador correcto es: `tipo === 'pulsera' ? suma(tallas) : stock`.

Y la segunda: **`stock.json` no sabe lo que se apartó desde el último conteo.**
El almacén `inventario` de Blobs sí. Restar eso a mano en un prompt es pedirle
aritmética de inventario a un modelo, que es lo que hacen mal.

**Eso ya está resuelto y no hay que construirlo.** La función
`netlify/functions/disponibilidad.mjs` hace exactamente esa lectura combinada y
devuelve el catálogo con el campo `disponible` ya calculado en el servidor.

**Vive sin mezclar en la rama `claude/zephora-charms-automation-hub-5aihdu`.**
Primera tarea de la Fase 1: traerla. `ESTADO.md` § *Ramas abiertas* explica que
esa rama trae también un rescate de carritos duplicado — **se trae
`disponibilidad.mjs` y `_atribucion.mjs`, pieza por pieza, nunca merge directo.**

### 1.2 · Cómo se ordena la lista

Entre las elegibles, el orden lo dan tres cosas, en este orden:

1. **Margen.** Charms 87,9% contra pulseras 70,7%. Un charm vendido deja más.
2. **Rendimiento pasado de la pieza en contenido** (Fase 3). Al principio no
   hay dato: se empieza por margen y variedad.
3. **Enfriamiento.** Una pieza no vuelve a salir hasta pasados N días (empezar
   en 21). Sin esto el motor propone tres veces seguidas lo mismo, porque las
   señales que lo ordenan cambian despacio.

### 1.3 · Qué trae un paquete

| Campo | Qué es |
|---|---|
| `pieza` | id de `stock.json`, con unidades disponibles al momento de decidir |
| `gancho` | Los primeros 3 segundos. Es el 80% del resultado |
| `guion` | Segundo a segundo, con la duración de cada bloque |
| `tomas` | Lista de lo que hay que grabar, en orden de rodaje, no de montaje |
| `portada` | Imagen generada, lista (§ Fase 2) |
| `broll` | 3–5 imágenes generadas para cortes |
| `subtitulos` | Texto ya cronometrado |
| `texto_tiktok` / `texto_ig` / `texto_fb` | Copy y hashtags, distintos por red |
| `enlace` | El enlace medido de este paquete (§ Fase 3) |
| `estado` | `propuesto` → `aprobado` → `grabado` → `publicado` |

**La lista de tomas va en orden de rodaje.** Un guion pide el mismo plano en el
segundo 2 y en el 11; grabarlo dos veces porque la lista sigue el montaje es
justo el tiempo que este motor existe para no gastar.

### 1.4 · Dónde cae

En una **Data Table de n8n** — el mismo patrón que ya funciona con *Pedidos
Zephora* (`tmDPVx97PUPX4OzT`), en el proyecto `G0JzOUkkmPhzcVQu`. Tabla nueva:
**«Paquetes Zephora»**. Nada se publica sin que el propietario cambie el estado
a `aprobado`.

Instancia: `n8n.srv1888488.hstgr.cloud`. Workflows que ya viven ahí:

| Workflow | Estado |
|---|---|
| `K1J4pHYfvd6QuAq8` · Zephora · Hoja de Inventario | **Activo** |
| `h5U0fGHrW4hekjtp` · Zephora · Purchase a Meta (CAPI) | Sin publicar (falta credential del token) |

### 1.5 · Cómo se nota si se rompe

Regla del repo: **cada red de seguridad nueva tiene que traer cómo se va a
notar que falló** (`ESTADO.md` § *Los fallos silenciosos*).

Para este motor, el fallo mudo es **proponer piezas sin existencias** — el motor
seguiría generando paquetes preciosos de cosas que no se pueden vender y nadie
se enteraría hasta que una clienta lo pidiera. La delación:

- Cada paquete guarda `unidades_al_decidir`. Si empieza a salir 0, la lectura de
  disponibilidad se cayó y está fallando hacia adelante.
- Si el pool elegible baja de 10 referencias, el motor avisa en vez de bajar el
  listón. **Nunca relaja el mínimo de 3 unidades por su cuenta.**

---

## Fase 2 — El banco visual

La parte que sorprende: **la mayor parte del valor de las imágenes generadas no
está en publicarlas como post.**

### 2.1 · Portadas de Reels — lo más importante y lo que casi nadie hace

Cuando alguien llega al perfil desde un video, ve una **cuadrícula**. Esa
cuadrícula decide si sigue o se va. La portada de un Reel es una imagen fija, y
por defecto es un fotograma cualquiera del video, que se ve mal.

Con portadas generadas consistentes —mismo estilo, misma tipografía, la pieza
real recortada— el perfil pasa de verse improvisado a verse marca. Era
literalmente lo que el propietario pidió: *que la gente se interese al entrar al
perfil*. **Y es imagen, no video.**

### 2.2 · B-roll

Un Reel necesita cortes cada 2–3 segundos o la gente se va. Sin b-roll hay que
grabar el triple. Una imagen con zoom lento en CapCut da 3 segundos de aire, y
se pueden tener veinte sin volver a grabar.

### 2.3 · Las 117 fotos vuelven a nacer

`assets/` tiene 117 archivos, casi todos sobre **fondo blanco de catálogo**. La
pieza real puesta en mano, en mármol, en luz de tarde, en mesa de regalo es un
book de estilo de vida completo **sin un solo día de fotos**. Y cada temporada
—Navidad, Día de la Madre, San Valentín— es **recomponer, no volver a
fotografiar**.

Aplica la regla 2: **la pieza de la foto es la real; la IA pone el fondo.**

### 2.4 · Carruseles que se guardan

Guía de tallas, cómo armar tu pulsera, cómo cuidar la plata, guía de regalo. No
llevan producto en riesgo, se guardan mucho —y los guardados empujan alcance— y
posicionan la marca como la que sabe. Es el contenido que **sostiene el perfil
entre video y video**, que es el problema real de una cuenta que depende de que
una persona grabe.

### 2.5 · Probar demanda antes de comprar inventario — la que vale plata

Faltan **14 letras que nunca se compraron**: F G H I P Q R T U W X Y Z Ñ, el 52%
del abecedario. Costo ~$73.000 para ~$1.064.000 de utilidad potencial. Es el
mejor retorno del negocio y además arregla que media Colombia no encuentre su
inicial.

**Pero hoy es una apuesta a ciegas.** Una historia con las iniciales en imagen y
la pregunta *«¿cuál te falta?»* da la respuesta en 24 horas y gratis. Es la
decisión más rentable pendiente y ahora mismo se está tomando sin datos.

> Aquí la regla 2 es innegociable: **eso es sondeo, nunca oferta.** La historia
> pregunta; no enseña un producto disponible. Las 14 letras **no existen en la
> mano** y una imagen que las haga parecer comprables es exactamente el fallo
> que la regla previene.

---

## Fase 3 — La medición

Cierra en checkouts. Ver decisión 3.

- **Un enlace medido por paquete.** Parámetros UTM con el id del paquete, para
  que un checkout se pueda atribuir al Reel que lo produjo. `_atribucion.mjs`
  (rama `hub`, sin mezclar) es el punto de partida.
- **La señal que ordena el calendario** es checkouts por paquete, no vistas.
  Vistas y guardados se anotan porque son diagnóstico —un video con muchas
  vistas y cero checkouts falla en la oferta, no en el gancho—, pero **no
  ordenan la lista**.
- **Ojo con el píxel.** Hay dos a propósito: las campañas y los públicos usan el
  viejo (`2130673404542988`), el `Purchase` de servidor va al nuevo
  (`1029982529813994`). Ver `CLAUDE.md` § *Píxeles*. Un evento de contenido
  mandado al píxel equivocado no da error: simplemente no aparece donde se lo
  busca.
- **Paciencia con la muestra.** La campaña principal produce ~55 checkouts al
  mes. Comparar dos Reels con tres checkouts cada uno no es un resultado, es
  ruido. Antes de sacar conclusiones por pieza hacen falta semanas.

---

## Fase 4 — Publicación automática

**Existe.** El propietario confirmó que **Instagram está como cuenta Business y
ligada a la Página de Facebook**, que es el requisito que la habilita o la mata.
La Página existe y está confirmada por API: **«Zephora Charms»,
`1096237716904526`**, promovida bajo la cuenta publicitaria `1583713932705268`.

Es **la última fase a propósito**. Al principio el propietario publica en las
tres redes a mano, que cuesta minutos y no arriesga nada. Automatizar la
publicación antes de que el motor produzca paquetes buenos es automatizar el
envío de algo que todavía no vale la pena enviar.

### Lo que se puede automatizar

| Red | Vía | Realidad |
|---|---|---|
| **Instagram Reels** | Content Publishing API sobre la Página ligada | Viable. Contenedor → esperar a que procese → publicar. Necesita permisos `instagram_basic` + `instagram_content_publish` y **App Review**. Tiene tope diario de publicaciones |
| **Facebook Reels** | API de la Página, distinta de la de IG | Viable, **pero es otra integración**: no es el mismo endpoint ni el mismo flujo de subida. Contar el doble de trabajo |
| **TikTok** | Content Posting API | **Se queda manual.** Una app sin auditar solo publica en privado o al propio perfil sin difusión. Y aunque se auditara, sigue en pie la decisión 1: el audio en tendencia se elige dentro de TikTok |

### Antes de escribir código de Fase 4, comprobar tres cosas

1. **Leer por API el `instagram_business_account` de la Página
   `1096237716904526`.** El propietario lo confirmó y eso basta para planear,
   pero antes de construir hay que verlo en la respuesta de la API. La
   herramienta `ads_get_ig_accounts` del conector de Ads devolvió
   *«this tool is new and is being gradually rolled out»* para esta cuenta, así
   que la comprobación toca por otra vía.
2. **La app de Meta y el App Review.** Es el conector **Meta Developer Tools**
   (`devtools_*`) el que sirve para apps, webhooks y App Review — **no** el de
   Ads. Los dos nombres se confunden de verdad y ya costó rondas de
   «reconecté y sigue sin funcionar»; ver `CLAUDE.md` § *Trabajar con Claude
   Code en varias sesiones*.
3. **El video necesita URL pública** — y por la decisión 5 esa URL **no sale de
   un commit al repo**.

---

## Orden de construcción

| # | Qué | Por qué en ese sitio |
|---|---|---|
| 1 | Traer `disponibilidad.mjs` de la rama `hub`, pieza por pieza | Sin lectura de inventario real todo lo demás propone piezas que no existen |
| 2 | Data Table «Paquetes Zephora» | El sitio donde caen los paquetes antes de que exista quien los llene |
| 3 | Workflow del motor: elegir pieza → escribir guion → guardar `propuesto` | Ya sirve: el propietario aprueba, graba y publica a mano |
| 4 | Portadas y b-roll dentro del paquete | El paquete pasa de guion a rodaje sin trabajo intermedio |
| 5 | Sondeo de las 14 letras | **Se puede hacer hoy, a mano, sin esperar al motor.** Es la de mayor retorno de toda la lista |
| 6 | Enlace medido y atribución a checkouts | Cuando haya suficientes paquetes publicados para comparar |
| 7 | Publicación a IG y FB Reels | Al final, y solo si publicar a mano se vuelve la molestia |

**El 5 no depende de nada.** Si esta lista se atasca en el 1, el sondeo de las
letras sigue siendo la mejor hora de trabajo del proyecto.

---

## Lo que este motor no arregla

Para que no se le pida lo que no puede dar:

- **No repone inventario.** Sigue siendo el cuello de botella real del negocio,
  por delante del presupuesto de pauta (`CLAUDE.md` § *Pendiente*). Un motor de
  contenido sobre un catálogo con 59 referencias en 1–2 unidades solo consigue
  agotarlas más rápido.
- **No arregla que las campañas optimicen a ciegas.** Siguen optimizando por
  `InitiateCheckout` sobre el píxel viejo hasta que el portafolio cumpla
  antigüedad. Es restricción de cuenta, no de contenido.
- **No graba.** Si nadie graba, el motor produce paquetes que nadie usa. Es la
  única dependencia que no tiene solución técnica.
