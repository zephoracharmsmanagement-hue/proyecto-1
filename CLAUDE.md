# Contexto operativo — Zephora Charms

Este archivo lo lee Claude Code automáticamente al abrir este repo, en
cualquier terminal o sesión.

**Empieza por [`ESTADO.md`](ESTADO.md)** — es el documento de traspaso del
sitio (checkout, pagos con Wompi, inventario, correos, despliegue) y se
mantiene desde la terminal del proyecto. Este archivo no lo duplica; cubre
solo la parte de **automatización de Meta Ads / CAPI / n8n**, que ESTADO.md
no toca, y algunas trampas de herramientas específicas de trabajar con
Claude Code en varias sesiones/terminales a la vez.

## Meta Ads — estado de la automatización

### Campañas en producción (cuenta `1583713932705268`)

Esa cuenta **no pertenece a ningún portafolio comercial** — de ahí sale casi
todo lo raro de esta sección (ver `ESTADO.md` § 4a). La otra cuenta,
`2021753038744595` ("cuenta publicitaria 1 ZC", dentro del portafolio
"Zephora Charms"), existe pero no tiene campañas.

- **"Nueva campaña de Ventas"** (`120247398773240534`) — ACTIVA, $15.000
  COP/día, con **un solo conjunto** (`120247398773250534`). Optimiza por
  `InitiateCheckout`, **no por `Purchase`**: es la limitación de fondo, no un
  descuido de configuración.

  Anuncios pausados y por qué: **Copia 4** (`120247400350270534`) y **Copia 5**
  (`120247400376370534`) por costo — $6.388 y $9.424 por checkout contra $663
  de Copia 2. **Copia 3** (`120247400003930534`) el 2026-09-01 por otra razón:
  pautaba la pulsera Avengers, que quedó en **1 unidad**. Pagar por vender lo
  que no hay es peor que no pautar.

  Copia 3 no era un anuncio cualquiera: llevaba **el 72% del gasto y el 83% de
  los checkouts** de los últimos 7 días, y era el más barato ($1.665 contra
  $3.184 de Copia 2). Al sacarlo quedan Copia 2 —el flojo— y **7 anuncios
  nuevos "Zephora ·"** sin historia. Contar con 3–5 días de costo por checkout
  inflado; es reaprendizaje, no una regresión.

  Lección del diagnóstico, para no repetirla: **Copia 4 tenía el mejor CTR de
  la cuenta (15,43%) y era de los peores en conversión.** Juzgar creativos por
  CTR habría escalado justo el que peor rendía. La métrica que manda es costo
  por resultado.

- **"Retargeting · Recuperación de checkout"** (`120247672148980534`) —
  **PAUSADA**. Nunca entregó: $0 gastados, 0 impresiones. Sí optimizaba por
  `Purchase`. Dos causas: un error de segmentación por lugar (#1870194, tipo de
  ubicación descontinuado por Meta) y, más de fondo, que **el público tiene ~55
  personas**. No reactivar hasta que el público crezca (ver § Públicos).

### Ubicaciones — el desglose que nadie había mirado

Datos de 30 días leídos el 2026-09-01, campaña principal. Ordenado por lo que
de verdad manda, costo por checkout:

| Ubicación | Gasto | % pres. | CTR | Checkouts | Costo/checkout |
|---|---|---|---|---|---|
| FB Stories | $10.111 | 2,8% | 3,65% | 20 | **$506** |
| Threads | $1.177 | 0,3% | 2,18% | 2 | $589 |
| IG Stories | $79.752 | 21,7% | 5,68% | 70 | **$1.139** |
| FB Search | $2.720 | 0,7% | 3,16% | 2 | $1.360 |
| IG Feed | $57.379 | 15,6% | 5,81% | 40 | $1.434 |
| Marketplace | $2.982 | 0,8% | 4,29% | 2 | $1.491 |
| IG Reels | $22.790 | 6,2% | 5,68% | 13 | $1.753 |
| FB Feed | $53.140 | 14,5% | 4,97% | 23 | $2.310 |
| **Audience Network** | **$116.278** | **31,7%** | 1,96% | 47 | **$2.474** |
| **FB Reels** | $19.567 | 5,3% | **6,26%** | 3 | **$6.522** |
| instream video, columna derecha, notificaciones, explorar | ~$1.250 | 0,3% | — | **0** | ∞ |

Tres hallazgos, y el tercero es el que se repite:

1. **Audience Network se llevaba un tercio del presupuesto y rendía 2,2× peor
   que IG Stories.** El renglón más grande de la cuenta era el segundo peor.
2. **FB Stories era la mejor ubicación de todas y recibía el 2,8%.** $506 por
   checkout, la mitad que IG Stories.
3. **FB Reels: mejor CTR de la cuenta (6,26%) y el peor costo por checkout
   ($6.522).** Tercera vez que aparece el mismo patrón en este proyecto —
   Copia 4, el motor de contenido, y ahora esto. **CTR alto no es señal de
   nada**, y cada vez que se ha usado como criterio habría escalado lo peor.

El 2026-09-01 el conjunto pasó de ubicaciones Advantage+ a **manuales**:
Facebook (feed, story, marketplace, search, profile_feed), Instagram (stream,
story, reels, explore_home, ig_search) y Threads. **Fuera Audience Network,
Facebook Reels, Messenger, instream video, columna derecha y notificaciones.**
Verificado por el propietario en el Administrador de anuncios.

Cautela al leer esa tabla: **no se sigue que los $116.278 de Audience Network
rindan a $1.139 al mudarse a IG Stories.** La subasta se encarece cuando se
concentra el presupuesto en menos inventario. Lo que sí sostiene el dato es que
se pagaba precio de Stories por inventario de Audience Network.

### Trampa de la API: un cambio de segmentación pausa el conjunto

`ads_update_entity` sobre el `targeting` de un conjunto devuelve
**`status_forced_to_paused: true`** y deja el conjunto en PAUSED. Es una
salvaguarda de Meta, no un error — pero si nadie mira la respuesta, **la
campaña se queda parada sin que nada avise**. Hay que reactivar con
`ads_activate_entity` justo después, y confirmarlo.

Dos cosas más de ese mismo cambio:

- **El objeto `targeting` se reemplaza entero, no se fusiona.** Si el payload
  no repite las exclusiones geográficas (San Andrés, Providencia, Amazonas,
  Guainía, Vaupés, Vichada), se pierden en silencio y se empieza a pagar por
  tráfico al que no se puede despachar.
- El `entity_type` es **`ad_set`**, con guión bajo — no `adset`, que es lo que
  usa el parámetro `level` de `ads_get_ad_entities`. Los dos nombres conviven
  en la misma herramienta.

### Públicos

- `Zephora · Iniciaron checkout sin comprar (30d)` (`120247672124730534`) —
  ACTIVE, sano, lee del píxel viejo `2130673404542988` (el correcto: es el que
  tiene historia). Incluye `InitiateCheckout` 30d, excluye `Purchase`.
  **Demasiado pequeño para pautar**: la campaña principal produce ~55
  checkouts/mes. Para hacerlo viable: ventana a 180 días e incluir también
  `AddToCart` (134 en 30 días).
- `Público similar (CO, 1%)` (`120247672160220534`) — **INACTIVE,
  `operation_status_code: 433`**. La semilla es demasiado chica para construir
  un lookalike. No sirve hasta que crezca el público de origen.

### Píxeles — hay dos a propósito

- **`2130673404542988`** ("zephora charms pixel 1") — el viejo. Vive en la
  cuenta sin portafolio, así que **nunca podrá tener CAPI** (`server_last_fired_time`
  en época cero). Es el que las campañas y los públicos pueden usar.
- **`1029982529813994`** ("zephora charms pixel web") — el nuevo, dentro del
  portafolio "Zephora Charms". Sí recibe `Purchase` de servidor desde
  `wompi-webhook.mjs`. **La cuenta publicitaria no lo tiene compartido**, así
  que Meta no puede optimizar con él hasta que el portafolio cumpla antigüedad
  (semanas). Detalle y plan de migración en `ESTADO.md` § 4a.

Consecuencia práctica: durante estas semanas el píxel nuevo **acumula la
verdad** mientras las campañas **siguen optimizando a ciegas** sobre
`InitiateCheckout` del viejo. No hay atajo; es restricción de cuenta.

### Economía unitaria (del inventario, agosto 2026)

Margen real: **charms 87,9%** ($9.305 costo / $77.449 venta) · **pulseras
70,7%** ($18.742 / $64.571). Una venta de 2 charms deja **~$110.386 de
utilidad neta** tras envío — ese es el CAC máximo por compra. Con costo por
checkout de ~$1.950, el negocio aguanta hasta una conversión checkout→pago
del 2% antes de perder plata. **El presupuesto actual está muy por debajo de
lo que la economía soporta**; el limitante es inventario, no dinero.

El dato de costo **no está en el repo**: vive en `Inventario_Zephora_v3.xlsx`
(hojas Productos y Movimientos). `stock.json` solo trae precio de venta.

### Creativos

`assets/ads/` tiene 10 imágenes alojadas para usar como imagen de anuncio
(la CAPI necesita URL pública). Queda fuera a propósito la variante que
nombra a Pandora — riesgo de marca.

### Píxel del sitio

- **Pixel `2130673404542988`** ("zephora charms pixel 1"), en producción.
  Dispara `PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`, `Lead`
  (conversión real del sitio — el pago ocurre fuera, ver abajo) y `Contact`.
  Detalle completo en `README.md` § Medición.
- **`meta/` — scripts de solo lectura** (`verificar.mjs`, `pixel.mjs`,
  `metricas.mjs`), corren en la máquina del usuario con su token en `.env`.
  Graph API **v25.0** (v19.0, el default anterior, expiró 2026-05-21).
  Nunca se han corrido contra la API real — si truenan, el error más
  probable es un nombre de campo distinto entre versiones.
- **n8n autohospedado** en `n8n.srv1888488.hstgr.cloud`. Workflow construido:
  **"Zephora · Purchase a Meta (CAPI)"** (id `h5U0fGHrW4hekjtp`) — formulario
  para registrar ventas cerradas por WhatsApp, normaliza teléfono a
  `57XXXXXXXXXX`, hashea SHA-256 (teléfono/email/nombre/apellido/país), arma
  el evento `Purchase` con `action_source: chat` y `order_id` determinista
  (dedup nativo de Meta, ventana 7 días), lo manda a
  `graph.facebook.com/v25.0/2130673404542988/events`, guarda todo en la
  Data Table **"Pedidos Zephora"** (id `tmDPVx97PUPX4OzT`). **Sin publicar
  todavía** — falta credential del token CAPI y una prueba con
  `test_event_code`.

  Nota: **el sitio ya cobra de verdad por Wompi** (ver `ESTADO.md` § 4).
  Cuando ese flujo esté estable, lo correcto es que el webhook de Wompi
  dispare el `Purchase` directamente al confirmar el pago — más confiable
  que un formulario llenado a mano. El workflow de n8n de arriba sigue
  siendo válido para ventas cerradas por WhatsApp sin pasar por el checkout
  web. Evaluar si conviene tener los dos disparadores o consolidar en uno.

### Por qué importa

El checkout web ya cobra, pero también sigue existiendo venta cerrada por
WhatsApp fuera de esa ruta. Para esa venta, el pixel del sitio solo ve
`Lead` (alguien escribió), nunca `Purchase` (alguien pagó) — sin CAPI, Meta
optimiza las campañas hacia gente que escribe, no hacia gente que compra.

### Pendiente

Por orden de impacto sobre el dinero:

1. **Reponer inventario.** Es el cuello de botella real, no el presupuesto.
   Faltan **14 letras que nunca se compraron** (F G H I P Q R T U W X Y Z Ñ —
   el 52% del abecedario): ~$73.000 de costo para ~$1.064.000 de utilidad
   potencial, el mejor retorno del negocio y además arregla que media
   Colombia no encuentre su inicial. Después, **83 referencias en 1-2
   unidades** ($2,64M para habilitar ~$11,7M de utilidad), priorizando
   charms (88% de margen) sobre pulseras (71%).
2. **Confirmar que los 7 anuncios "Zephora ·" llevan las imágenes 4:5**, no
   las 9:16 originales. Se subieron desde la terminal para arreglar el recorte
   en Feed —el 31% del gasto—, pero los creativos que devuelve la API están
   fechados 20-ago, que no cuadra con que el reformateo fuera posterior. Se ve
   en la vista previa de cada anuncio. Si quedaron con las viejas, hay que
   rehacer los creativos (son inmutables: creativo nuevo + anuncio nuevo).
3. **Probar el `Purchase` de servidor** con `META_TEST_EVENT_CODE` y
   confirmar en Events Manager que aparece **una sola vez** por compra (no
   dos) en el píxel nuevo. **Quitar la variable de prueba al terminar.**
4. **Registrar ventas en la hoja *Movimientos*** del Excel. Hoy las
   recomendaciones de reposición salen de "subir todo a 4 unidades", que es
   una regla pareja, no rotación real. Con unas semanas de movimientos se
   vuelve reposición informada.
5. **Cuando el portafolio cumpla antigüedad**: compartir `1029982529813994`
   con la cuenta `1583713932705268` (o reclamar la cuenta hacia el
   portafolio), migrar la optimización de `InitiateCheckout` a `Purchase`, y
   sacar el segundo `fbq('init', …)` de los tres HTML.
6. **Revisar el access token que se pegó en un chat hace tiempo.** Si sigue
   activo, revocarlo en Configuración del negocio → Usuarios del sistema y
   usar en su lugar un usuario del sistema con permisos acotados.
7. **Marcar `Lead` como conversión personalizada** en Meta.

### Modo de operación acordado

Antes de cualquier acción que modifique o cree algo que gaste presupuesto
real (campañas, conjuntos, anuncios, presupuestos, pujas): mostrar el
payload/estructura exacto para aprobación antes de ejecutar. Lecturas,
diagnósticos y consultas de datos van directo. Esto sigue vigente aunque el
conector de Ads MCP termine con permisos de escritura completos — el
permiso técnico no cambia el acuerdo.

## Conversión — recuperar carritos con permiso y cerrar por WhatsApp

Las dos automatizaciones que el propietario marcó como viables ahora
(2026-08-23). Plan completo, verificado contra el código real, en
[`automatizaciones/conversion/BRIEF.md`](automatizaciones/conversion/BRIEF.md).
Lo que hay que saber sin abrir el documento:

- **`rescate.mjs` ya distingue quién autorizó** (`cliente.optin`, del checkbox
  de checkout.html) — falta que a esos se les mande el mensaje automático en
  vez de solo avisar a la tienda. A quien no autorizó, nunca un automático.
- **Las dos automatizaciones comparten fundación**: la misma app de WhatsApp
  Business, la misma plantilla aprobada por Meta, y un endpoint nuevo para
  reanudar un pago —la reserva de inventario original caduca a los 30 minutos,
  así que un enlace de recuperación tiene que revalidar stock, nunca prometer
  que el carrito «sigue igual» sin comprobarlo—.
- **El bot de WhatsApp no genera el cobro directo desde el día uno.** Manda un
  enlace al checkout existente con la selección ya cargada, y el checkout de
  siempre —con su recálculo de precio en el servidor— hace el resto. Es la
  decisión que baja más el riesgo de un frente marcado como «no admite
  errores».
- **El modelo nunca calcula precio ni inventa existencia.** Misma regla que ya
  usa `disponibilidad.mjs` para el asesor: el modelo conversa y decide qué
  función llamar; los números siempre salen de `_precios.js` y
  `disponibilidad.mjs`.
- **La rama `sephora-whatsapp-response-system-682wvv` no se fusiona**: es de
  antes del checkout con Wompi, con su propio `index.html` y sin
  `netlify.toml`. Vale por las 28 macros y el system prompt como referencia de
  tono, nunca como código.
- **WhatsApp cambió de facturación este mismo año**: desde el 1 de agosto de
  2026 se cobran las respuestas de un agente de IA por token, y desde el 1 de
  octubre —semanas después de escribir esto— también los mensajes de servicio
  dentro de la ventana de 24 horas. El bot no es gratis por estar dentro de una
  conversación activa.

## Mapa de automatizaciones — qué hay y qué se puede hacer

[`automatizaciones/MAPA.md`](automatizaciones/MAPA.md) inventaría lo que ya
funciona, lo que se puede construir hoy sin pedirle nada a nadie, lo que espera
una autorización del propietario y lo que está bloqueado. Verificado contra las
herramientas reales, no supuesto. Dos hallazgos que conviene tener a mano:

- **n8n tiene dos credenciales** (Header Auth y cuenta de servicio de Google) y
  **las credenciales gestionadas no están disponibles** en esa instancia
  (`available: false`). Toda automatización con un servicio nuevo está bloqueada
  por una autorización, no por programación.
- **La cuenta sin portafolio bloquea también el catálogo**, no solo la CAPI:
  `has no owning business, so its catalogs cannot be listed`, y no existe ningún
  catálogo (`total_count: 0`). O sea que los anuncios dinámicos —los que enseñan
  la pieza exacta que alguien miró— están detrás de la misma puerta. Eso sube la
  prioridad de reclamar la cuenta hacia el portafolio: desbloquea tres cosas, no
  una.

## Contenido orgánico — el motor de paquetes de rodaje

Frente nuevo, hermano de la pauta y con las mismas reglas de dinero. El brief
completo está en
[`automatizaciones/contenido/BRIEF.md`](automatizaciones/contenido/BRIEF.md) —
cuatro fases, orden de construcción y, sobre todo, **qué se decidió no
construir**. Aquí solo lo que hay que saber para no deshacerlo sin leerlo.

- **El motor no produce videos: produce paquetes de rodaje.** Elige la pieza
  según inventario real, escribe gancho, guion y lista de tomas, genera portada
  y b-roll, cronometra subtítulos y deja el texto por red. El propietario graba
  y monta. Baja el trabajo por video de ~40 a ~5 minutos.
- **CapCut no se automatiza, y es decisión, no pendiente.** No hay API pública;
  los envoltorios no oficiales son ingeniería inversa y **CapCut y TikTok son
  ambos de ByteDance con la misma cuenta**, así que arriesgan justo el activo
  que se quiere construir. La razón de fondo es otra: el **audio en tendencia**
  solo se consigue dentro de TikTok y CapCut, y en video corto el audio es la
  mitad de la viralidad. Armar el video por fuera entrega algo mudo.
- **Imagen generada nunca puede parecer producto a la venta que no existe.**
  Con producto de por medio, la foto es la real y la IA solo pone el fondo. Una
  imagen totalmente generada solo vale para **sondeo**, nunca como oferta.
- **La medición cierra en checkouts, no en vistas.** Misma lección que Copia 4:
  mejor CTR de la cuenta y de los peores en conversión.
- **Los videos no se comitean.** ~15 créditos por despliegue y el historial de
  git se los queda para siempre. Las 10 imágenes de `assets/ads/` son la
  excepción correcta —pesan poco y la CAPI necesita URL pública—; video no.
- **Elegibilidad: 3 unidades o más.** Hoy son 46 referencias de 129 (24 en cero,
  59 en 1–2). Trampa ya cazada: `stock.json` guarda las unidades en dos formas
  —charm `stock`, pulsera `tallas`— y un `item.stock || 0` da **cero para las 18
  pulseras sin dar ningún error**. Y `stock.json` no sabe lo apartado desde el
  último conteo: eso lo resuelve `disponibilidad.mjs`, que **ya existe sin
  mezclar** en `claude/zephora-charms-automation-hub-5aihdu`. Traerla pieza por
  pieza, nunca merge directo — esa rama trae también un rescate duplicado.
- **Remotion no reabre lo de CapCut, lo confirma.** Se está explorando en otra
  sesión y encaja de verdad, pero **renderiza mudo**: sirve para portadas,
  b-roll, carruseles, creativos de pauta (que se ven en silencio) y piezas de
  pura tipografía — no para el Reel principal. Gratis hasta 3 personas, licencia
  a partir de 4. Necesita host propio para renderizar (Chromium + FFmpeg):
  **Netlify no sirve**, empezar en local. Y le da la vuelta a lo de no comitear
  video: lo que se versiona es el componente React, y el MP4 es salida de build.
  Frontera entre las dos sesiones y contrato del JSON en
  [`automatizaciones/contenido/CONTRATO-REMOTION.md`](automatizaciones/contenido/CONTRATO-REMOTION.md).
- **Fase 4 (publicación automática) existe:** Instagram está como cuenta
  Business ligada a la Página **«Zephora Charms» (`1096237716904526`)**,
  confirmada por API como promovida bajo la cuenta `1583713932705268`. IG Reels
  y FB Reels son **dos integraciones distintas**, no una. TikTok se queda
  manual: una app sin auditar no publica con difusión, y el audio se elige
  dentro de la app de todos modos.

Lo de mayor retorno de todo el frente **no necesita el motor**: una historia con
las iniciales preguntando *«¿cuál te falta?»* resuelve en 24 horas y gratis si
comprar las 14 letras que faltan (~$73.000 de costo, ~$1.064.000 de utilidad
potencial) es apuesta o dato. Hoy se está decidiendo a ciegas.

## Cómo se reparte el trabajo entre sesiones — leer antes de construir

**El riesgo de este repo no son los conflictos de git: es construir dos veces
la misma pieza.** Ya pasó. Dos sesiones hicieron cada una su sistema de rescate
de carritos abandonados y su registro de pedidos, en archivos con nombres
distintos (`rescate.mjs` / `_pedidos.mjs` contra `recuperar-carritos.mjs` /
`_pendientes.mjs`). Git no ve nada raro ahí — archivos distintos, merge limpio,
cero conflictos — y el resultado en producción serían **dos cosas persiguiendo
el mismo pedido y dos correos a la misma clienta**. El detalle de las ramas
implicadas está en `ESTADO.md` § *Ramas abiertas de otras sesiones*.

Por eso la regla va **antes** de empezar a escribir código, no en el momento de
mezclar:

1. **Una sola sesión toca la tienda.** El paralelo solo vale con alcance
   genuinamente disjunto — documentación, macros de WhatsApp, cosas que no
   entran en `netlify/functions/`. Dos tareas que *suenan* distintas
   («medición» y «checkout», «inventario» y «rescate») acaban en los mismos
   archivos.
2. **Antes de construir, comprobar si ya existe.** `ls netlify/functions/` y la
   sección de pendientes de `ESTADO.md`, en ese orden. Las sesiones que
   duplicaron trabajo no fueron descuidadas: partieron de un punto viejo del
   repo donde de verdad no existía.
3. **Arrancar con `git fetch` y desde la rama publicada**
   (`claude/install-frontend-design-skill-8t655e`). El contenedor clona fresco,
   pero clona *un* punto; si es viejo, la sesión trabaja sobre una realidad que
   ya no existe. Es exactamente lo que les pasó a las ramas duplicadas.
4. **Reclamar el trabajo en `ESTADO.md` al empezar**, si va a haber paralelo.
   Es el único canal que las sesiones comparten, porque se lee al abrir el
   repo. Una línea —«sesión X está en el rescate de abandonados»— habría
   evitado el caso entero. Se borra al terminar.
5. **Ramas cortas: mezclar a la rama publicada el mismo día.** El tiempo que
   una rama vive separada es justo lo que le da para reconstruir lo que ya
   existe. Y no cuesta despliegues extra: varios commits juntos salen en un
   solo deploy de ~15 créditos (ver `ESTADO.md` § *Al desplegar*).

Al mezclar una rama vieja, mirar **de dónde salió** (`git merge-base`) antes
que el diff: una rama anterior al doble píxel trae un `<head>` con un solo
`fbq('init', …)`, y un merge descuidado borra el píxel nuevo —y con él el
`Purchase` de servidor— sin que nada dé error.

## Trabajar con Claude Code en varias sesiones/terminales — trampas ya pisadas

- **Los conectores de claude.ai y el registro `claude mcp add` de una
  terminal son cosas distintas y no se comparten entre sí.** Un servidor
  MCP agregado por `claude mcp add` en una terminal solo vive en esa
  terminal/máquina; no aparece en los conectores de la cuenta ni en otra
  sesión. Al diagnosticar "no veo el conector", preguntar primero en qué
  terminal y con qué comando se agregó.
- **Conectado a nivel de cuenta ≠ activo en el chat.** Los conectores de
  claude.ai (Netlify, Meta Developer Tools, n8n) tienen un interruptor por
  conversación además del estado de cuenta. Verificar ambos antes de
  asumir que algo "no sirve".
- **Meta Developer Tools MCP ≠ Meta Ads MCP, y los nombres se prestan a
  confusión de verdad.** El de developer tools (UUID
  `ae1781cf-f2bf-4f2a-902a-0573c66798dc`, herramientas `devtools_*`) sirve
  para apps, webhooks, App Review y documentación — **no lee campañas ni
  métricas**. En algún momento apareció renombrado como "Meta ads" y
  "Meta_ads", que es casi idéntico al bueno, y eso costó varias rondas de
  "reconecté y sigue sin funcionar". El que sí lee campañas ha aparecido como
  "Meta Ads" (`11f49046-c27c-4c2a-a932-46daee29c03b`) y "Meta Ads MCP", con
  herramientas `ads_*` (`ads_get_ad_entities`, `ads_update_entity`, …).
  **Diagnóstico rápido:** si `ToolSearch` de "ads campaign insights" no
  devuelve nada, el conector activo es el equivocado, por más que el nombre
  diga "ads". Conviene renombrar el de devtools a su nombre real para que
  deje de disfrazarse.
- **El interruptor por chat se apaga solo en cada reconexión.** En una
  conversación larga esto pasa muchas veces y parece que el conector "se
  cayó". Trabajar desde terminal con `claude mcp add` evita el ciclo.
- **Este repo se ha trabajado en paralelo desde varias sesiones.** Antes de
  hacer push, `git fetch` y revisar si hay commits nuevos — ya pasó un
  push rechazado por historial divergente en este proyecto. Pero el push
  rechazado es la versión benigna del problema; la cara cara está arriba, en
  *Cómo se reparte el trabajo entre sesiones*.
- Algunas verificaciones contra APIs externas (`graph.facebook.com`,
  `netlify.com`, etc.) están bloqueadas por política de red en entornos de
  ejecución remota — hay que correrlas desde una terminal con acceso real,
  no asumir que fallan por otra razón.

## Seguridad — recordatorios permanentes

- Tokens de Meta: nunca en archivos versionados, nunca pegados en un chat.
  Van en `.env` (ya en `.gitignore`) o como credential en n8n.
- Un token con `ads_management` gasta dinero real. Preferir usuario del
  sistema con permisos acotados sobre token personal de acceso total.
