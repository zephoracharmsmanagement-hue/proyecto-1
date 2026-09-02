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

> ⚠️ **Hay un plan sin ejecutar:**
> [`automatizaciones/meta-ads/PLAN-2026-09-02.md`](automatizaciones/meta-ads/PLAN-2026-09-02.md)
> — cambio de público (18-44), estados de anuncios y copys de los 4 creativos
> nuevos. Lo escribió una sesión web, que no puede escribir a Meta. Si esta
> sesión sí puede, **ese archivo es la tarea**; verificar el estado real antes
> de ejecutar, porque el propietario puede haber aplicado parte a mano.
> Borrar la nota cuando quede aplicado.


### Campañas en producción (cuenta `1583713932705268`)

Esa cuenta **no pertenece a ningún portafolio comercial** — de ahí sale casi
todo lo raro de esta sección (ver `ESTADO.md` § 4a). La otra cuenta,
`2021753038744595` ("cuenta publicitaria 1 ZC", dentro del portafolio
"Zephora Charms"), existe pero no tiene campañas.

- **"Nueva campaña de Ventas"** (`120247398773240534`) — ACTIVA, $15.000
  COP/día. Optimiza por `InitiateCheckout`, **no por `Purchase`**: es la
  limitación de fondo, no un descuido de configuración.

  **Volumen real (30 días al 2026-09-02): 235 checkouts, $381.392 gastados,
  $1.623 por checkout.** Una versión anterior de este archivo decía ~55
  checkouts/mes; era un dato viejo y llevaba a conclusiones equivocadas sobre
  el tamaño de los públicos de retargeting. Verificar siempre contra la API
  antes de razonar sobre volumen.

  Lección del diagnóstico, para no repetirla: **Copia 4 tenía el mejor CTR de
  la cuenta (15,43%) y era de los peores en conversión.** Juzgar creativos por
  CTR habría escalado justo el que peor rendía. La métrica que manda es costo
  por resultado.

  Segunda lección, de la sesión del 2026-09-02: **dos veces se pausó el
  anuncio bueno y quedó corriendo el caro.** Primero Copia 3 ($1.478/checkout)
  contra Copia 2 ($2.780); después "Caja de regalo" ($1.204) contra la misma
  Copia 2 ($2.368). Al pausar por cualquier motivo —agotamiento de la pieza,
  renovación de creativos— revisar qué queda activo, no solo qué se apaga.

  **Copia 3 (`120247400003930534`) está pausada por inventario, no por
  rendimiento**: la pieza que mostraba se agotó y la pauta seguía generando
  pedidos de algo inexistente. Reactivar cuando llegue la mercancía — era el
  mejor anuncio de la cuenta.

  **Techo de anuncios simultáneos: 4-5.** Con $15.000 COP/día, repartir entre
  ocho deja ~$1.900/día por anuncio y ninguno sale de fase de aprendizaje.

- **"Retargeting · Recuperación de checkout"** (`120247672148980534`) —
  **PAUSADA** (confirmado 2026-09-02, $0 gastados, 0 impresiones). Optimiza por
  `Purchase`. No entregaba por un error de segmentación por lugar (#1870194,
  tipo de ubicación descontinuado por Meta). La segunda razón que se
  documentó —público demasiado chico— **partía del dato errado de 55
  checkouts/mes**; con 235 reales el público es viable y vale reevaluar la
  campaña arreglando primero la segmentación.

### Públicos

- `Zephora · Iniciaron checkout sin comprar (30d)` (`120247672124730534`) —
  ACTIVE, sano, lee del píxel viejo `2130673404542988` (el correcto: es el que
  tiene historia). Incluye `InitiateCheckout` 30d, excluye `Purchase`.
  **Se creía demasiado pequeño para pautar, con base en un dato errado de ~55
  checkouts/mes.** El volumen real es de **235 checkouts en 30 días**, así que
  el público debería ser varias veces mayor de lo que se asumió. Confirmar el
  tamaño real antes de descartarlo; si aun así queda corto, ampliar la ventana
  a 180 días e incluir `AddToCart`.
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
(la CAPI necesita URL pública), todas **714×1280 JPG**. Queda fuera a
propósito la variante que nombra a Pandora — riesgo de marca.

**Las fotos de producto del sitio NO sirven para pauta.** Las 111 imágenes de
`assets/*.webp` son **440×440 y WebP**, y fallan por dos lados: Meta no acepta
WebP en creativos (solo JPG/PNG), y 440×440 está por debajo del mínimo de
500×500 para carrusel (recomendado 1080×1080). Convertir el formato es
trivial; la resolución no se arregla escalando —en joyería el detalle es el
producto y el ampliado se ve blando justo en cristales y grabado—. Para
carrusel hacen falta las **fotos originales en alta**, no las de la web.

**Trampa: editar un anuncio existente en vez de crear uno nuevo.** Meta
conserva el ad ID y con él las métricas acumuladas, así que el anuncio nuevo
reporta el gasto y las conversiones del viejo mezclados con los suyos. Pasó el
2026-09-02: cuatro creativos nuevos se montaron sobre anuncios existentes, y
uno de ellos (`zephora simbolos 1`, sobre el ID de Copia 4) arrastraba $26.652
y 4 checkouts ajenos. Si el anuncio reusado tiene historia, **crear uno nuevo
apuntando al mismo `creative_id`** —no hay que resubir la imagen— y pausar el
viejo. Si arrastra ~$0, no vale la pena y basta con medir por ventana de
fechas desde el cambio.

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
2. ~~Pausar "Retargeting · Recuperación de checkout"~~ — **hecho.** Queda en
   su lugar: arreglar el error de segmentación #1870194 y reevaluar, porque el
   público es mayor de lo que se creía (ver arriba).
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

**En sesiones remotas (Claude Code en la web), las escrituras a Meta Ads están
bloqueadas de todos modos**: el clasificador de auto-mode corta cualquier
`ads_activate_entity` / `ads_update_entity` antes de que salga la llamada, y
**la aprobación del usuario en el chat no lo levanta** —se comprobó tres veces
el 2026-09-02—. Las lecturas pasan sin problema, así que el diagnóstico
completo sí se puede hacer desde aquí. Para ejecutar hay dos vías: una regla
de permisos (`/permissions` para `mcp__Meta_Ads_MCP__ads_*`) o que el
propietario aplique los cambios a mano en Ads Manager. Entregar siempre la
lista de cambios en forma de checklist accionable, no solo el payload.

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
  una. **Reconfirmado el 2026-09-02**, también contra el portafolio directo
  (`business_id 1499356148452488` → `total_count: 0`).

  Lo bueno: **el trabajo difícil del feed ya está hecho.** El sitio manda
  `content_ids` con los slugs reales en `AddToCart` y `ViewContent`
  (`index.html:2694`, `index.html:3091`), que es el requisito que suele costar
  semanas. Cuando se desbloquee la cuenta, el catálogo es cuestión de días.

  Y el catálogo no es solo "más alcance": **es la solución estructural al
  problema de agotar lo que se pauta.** Con imagen única, la pauta concentra
  toda la demanda en un SKU de 1-3 unidades y toca pausar el anuncio bueno
  cuando se acaba (ya pasó con Copia 3). El feed de catálogo apaga solo lo que
  queda sin existencias vía el campo `availability`. Un carrusel estático
  reparte la demanda pero **no** se apaga solo: sirve de puente, no de
  solución, y exige la regla de pautar únicamente piezas con **stock ≥3**.

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
3. **Arrancar con `git fetch` y desde la rama publicada, que es `main`**
   —desde el 2026-08-22 Netlify despliega `main`, no
   `claude/install-frontend-design-skill-8t655e`; empujar ahí ya no publica
   nada, y una sesión ya dio por desplegado algo que se quedó en esa rama—. El
   contenedor clona fresco,
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
- **El tronco es `main`, desde la consolidación del 2026-08-20.** Antes no
  había ninguno: nueve ramas `claude/*`, y la que publicaba Netlify se
  llamaba `claude/install-frontend-design-skill-8t655e`, por el nombre de la
  tarea que la abrió. Eso hizo que tres sesiones construyeran **lo mismo dos
  veces** —el `Purchase` server-side, el rescate de carritos y el registro de
  pedidos— y una de esas duplicaciones estuvo a punto de hacer que Meta
  contara el doble de compras.

  **`git fetch --all`, no `git fetch` de la rama propia.** Ese fue el error
  concreto que costó las tres reconciliaciones: se miraba la rama de uno y se
  daba por hecho que el resto estaba quieto. El push rechazado por historial
  divergente es la versión benigna; la cara es construir dos días algo que ya
  existía.

  Lo que falta cambiar en los paneles de GitHub y Netlify —y que no se puede
  hacer desde aquí— está en `ESTADO.md` § Consolidación.
- Algunas verificaciones contra APIs externas (`graph.facebook.com`,
  `netlify.com`, etc.) están bloqueadas por política de red en entornos de
  ejecución remota — hay que correrlas desde una terminal con acceso real,
  no asumir que fallan por otra razón.

## Seguridad — recordatorios permanentes

- Tokens de Meta: nunca en archivos versionados, nunca pegados en un chat.
  Van en `.env` (ya en `.gitignore`) o como credential en n8n.
- Un token con `ads_management` gasta dinero real. Preferir usuario del
  sistema con permisos acotados sobre token personal de acceso total.
