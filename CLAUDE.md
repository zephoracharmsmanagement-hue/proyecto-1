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

1. **Generar token CAPI** en Events Manager → dataset `2130673404542988` →
   Configuración → Conversions API → *Generar token de acceso*. Va como
   credential Bearer Auth en n8n, nombre `Meta CAPI Zephora`. **No pegarlo
   en ningún chat.**
2. **Probar el workflow de CAPI** con `test_event_code` (Events Manager →
   Probar eventos) antes de publicarlo.
3. **Conectar Meta Ads MCP** para lectura y escritura completa de campañas.
   No hay URL fija pública para pegar directo — el camino confirmado en la
   documentación de Meta: developers.facebook.com → app **`1910139459666391`**
   ("AGENTE CLAUDE"; la otra app listada, `28046634668340224`, no es
   accesible) → Casos de uso → Añadir → "Ads and monetization" → **"Create &
   manage ads with ads MCP server"** → Guardar. Cuenta propia, no gestión de
   terceros → no requiere App Review. El panel debería mostrar después la
   URL de conexión específica para pegar como conector personalizado en
   claude.ai. **A la fecha de este archivo, sigue sin completarse** — ni en
   claude.ai ni vía `claude mcp add` en ninguna terminal verificada.
4. **Revisar el access token que se pegó en un chat hace tiempo.** Si sigue
   activo, revocarlo en Configuración del negocio → Usuarios del sistema y
   usar en su lugar un usuario del sistema con permisos acotados.
5. **Probar el embudo completo** en Events Manager → Probar eventos:
   `AddToCart`, `InitiateCheckout` y `Lead` — solo `PageView` está
   confirmado en vivo.
6. **Marcar `Lead` como conversión personalizada** en Meta.

### Modo de operación acordado

Antes de cualquier acción que modifique o cree algo que gaste presupuesto
real (campañas, conjuntos, anuncios, presupuestos, pujas): mostrar el
payload/estructura exacto para aprobación antes de ejecutar. Lecturas,
diagnósticos y consultas de datos van directo. Esto sigue vigente aunque el
conector de Ads MCP termine con permisos de escritura completos — el
permiso técnico no cambia el acuerdo.

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
- **Meta Developer Tools MCP ≠ Meta Ads MCP.** El primero es para apps,
  webhooks, App Review y documentación de desarrollador — no lee campañas,
  gasto ni métricas de anuncios. Fácil confundirlos por el nombre.
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
