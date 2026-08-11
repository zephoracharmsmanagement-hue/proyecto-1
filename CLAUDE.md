# Contexto operativo — Zephora Charms

Este archivo lo lee Claude Code automáticamente al abrir este repo, en cualquier
terminal o sesión. Está pensado para que una sesión nueva no repita descubrimientos
ni vuelva a pisar los mismos errores. `README.md` y `meta/README.md` explican el
"cómo"; esto es el "en qué vamos y qué falta".

## Quién y qué

Zephora Charms — joyería personalizada en Colombia (charms Plata 925, brazaletes
compatibles con Pandora), venta por WhatsApp. Sitio en `zephoracharms.com`,
un solo `index.html` + `assets/`, sin build. Dueña ya tiene campañas de Meta Ads
corriendo (confirmado 2026-08-11).

## Estado — qué ya está hecho y en producción

- **Meta Pixel `2130673404542988`** ("zephora charms pixel 1") instalado y
  verificado en vivo. Antes tenía un placeholder (`TU_PIXEL_ID`) y no medía nada
  — si algo se ve raro en datos históricos, es probable que sea de antes de esta
  fecha.
- **Imágenes extraídas de base64 a `assets/`** (commit `4da1f77`): HTML pasó de
  2546 KB a 115 KB. **Importante para deploys**: ya no se puede arrastrar
  `index.html` solo a Netlify — hay que subir la carpeta completa o un `.zip`
  con `index.html` + `assets/` en el primer nivel.
- **Sitio de producción** lo sirve el proyecto Netlify **`fanciful-trifle-64ca74`**.
  Existen otros dos proyectos llamados `zephoracharms` y `zephora-charms` que
  parecen los correctos por el nombre pero **no son el que sirve el dominio real**
  — solo tienen URL `.netlify.app`. Desplegar ahí no rompe nada, pero tampoco
  cambia lo que ve el público. Verificar siempre el nombre exacto antes de subir.
- **`meta/` — scripts de solo lectura** (`verificar.mjs`, `pixel.mjs`,
  `metricas.mjs`) corren en la máquina del usuario con su token en `.env`.
  Corregido para Graph API **v25.0** (v19.0, el valor anterior, expiró el
  2026-05-21). **Nunca se han corrido contra la API real** — si truenan, el
  error más probable es un nombre de campo distinto entre versiones.
- **n8n autohospedado** en `n8n.srv1888488.hstgr.cloud`. Workflow construido:
  **"Zephora · Purchase a Meta (CAPI)"** (id `h5U0fGHrW4hekjtp`) — formulario
  para registrar ventas cerradas por WhatsApp, normaliza teléfono a
  `57XXXXXXXXXX`, hashea SHA-256 (teléfono/email/nombre/apellido/país),
  arma el evento `Purchase` con `action_source: chat` y `order_id` determinista
  (dedup nativo de Meta, ventana 7 días), lo manda a
  `graph.facebook.com/v25.0/2130673404542988/events`, guarda todo en la
  Data Table **"Pedidos Zephora"** (id `tmDPVx97PUPX4OzT`) junto con la
  respuesta de Meta. **Sin publicar todavía** — falta credential del token
  CAPI y una prueba con `test_event_code`.

## Por qué existe el flujo de CAPI — no es opcional

La venta se cierra en WhatsApp, fuera del sitio. El pixel del sitio solo dispara
`Lead` (alguien mandó el pedido), nunca `Purchase` (alguien pagó). Sin CAPI,
Meta optimiza las campañas hacia gente que escribe, no hacia gente que compra.
Es la pieza de mayor apalancamiento sobre el gasto publicitario, más que
cualquier ajuste de segmentación o creativos.

## Pendiente — en orden de impacto

1. **Generar token CAPI** en Events Manager → dataset `2130673404542988` →
   Configuración → Conversions API → *Generar token de acceso*. Va como
   credential Bearer Auth en n8n, nombre `Meta CAPI Zephora`. **No pegar el
   token en ningún chat.**
2. **Probar el workflow de CAPI** con el código de `test_event_code` que da
   Events Manager → Probar eventos, antes de publicarlo.
3. **Conectar Meta Ads MCP para lectura y escritura completa de campañas.**
   No existe una URL fija pública para pegar directo — el camino confirmado
   en la documentación de Meta es: developers.facebook.com → app
   **`1910139459666391`** ("AGENTE CLAUDE", la única de las dos apps que es
   accesible; `28046634668340224` no lo es) → Casos de uso → Añadir →
   "Ads and monetization" → **"Create & manage ads with ads MCP server"** →
   Guardar. Como es cuenta propia (no gestión de terceros) no requiere App
   Review. Ese panel debería mostrar después la URL de conexión específica
   para pegar como conector personalizado en claude.ai. **A la fecha de este
   archivo, todavía no se ha completado esta conexión** — ni en claude.ai ni
   vía `claude mcp add` en ninguna terminal verificada.
4. **Revisar el access token que se pegó en un chat hace tiempo.** Si sigue
   activo, revocarlo en Configuración del negocio → Usuarios del sistema y
   usar en su lugar un token de usuario del sistema con permisos acotados
   (`ads_read`/`ads_management` según haga falta, nunca acceso total).
5. **Probar el embudo completo** en Events Manager → Probar eventos:
   `AddToCart`, `InitiateCheckout` y `Lead` — solo `PageView` está confirmado
   en vivo hasta ahora.
6. **Marcar `Lead` como conversión personalizada** en Meta.

## Modo de operación acordado para Meta Ads

Antes de cualquier acción que modifique o cree algo que gaste presupuesto real
(campañas, conjuntos, anuncios, presupuestos, pujas): mostrar el payload/estructura
exacto para aprobación antes de ejecutar. Lecturas, diagnósticos y consultas de
datos van directo, sin pedir permiso cada vez. Esto sigue vigente aunque el
conector de Ads MCP termine con permisos de escritura completos — el permiso
técnico no cambia el acuerdo.

## Trampas ya pisadas — no repetir

- **`loading="lazy"` no hace nada sobre un `data:` URI.** Si alguna vez se vuelve
  a incrustar una imagen en base64 en el HTML, el atributo queda inerte aunque
  esté escrito — hay que servir el archivo como recurso externo de verdad.
- **Netlify: el nombre "obvio" del proyecto no es el que sirve el dominio.**
  Ver arriba (`fanciful-trifle-64ca74`).
- **Graph API v19.0 expiró.** Si un script viejo trae `v19.0` hardcodeado o
  como default, va a fallar — usar v25.0 o la vigente al momento.
- **Los conectores de claude.ai y el registro `claude mcp add` de una terminal
  son cosas distintas y no se comparten entre sí.** Un servidor MCP agregado
  por `claude mcp add` en una terminal solo vive en esa terminal/máquina; no
  aparece en `ListConnectors` (que es cuenta de claude.ai) ni en otra sesión.
  Al diagnosticar "no veo el conector", primero preguntar en qué terminal y
  con qué comando se agregó.
- **Conectado a nivel de cuenta ≠ activo en el chat.** Los conectores de
  claude.ai (Netlify, Meta Developer Tools, n8n) tienen un interruptor por
  conversación (`enabledInChat`) además del estado de cuenta (`connected`).
  Verificar ambos antes de asumir que algo "no sirve".
- **Este entorno de ejecución remota tiene `graph.facebook.com`,
  `netlify.com` y otros hosts de terceros bloqueados por política de red** —
  cualquier verificación contra la API real de Meta tiene que hacerse desde
  la terminal del usuario (con su `.env` y su token), no desde aquí.
- **Meta Developer Tools MCP ≠ Meta Ads MCP.** El primero es para apps,
  webhooks, App Review y documentación de desarrollador — no lee campañas,
  gasto ni métricas de anuncios. Fácil confundirlos por el nombre similar.
- **App ID `28046634668340224` no es accesible**, aunque aparezca listada.
  Usar siempre `1910139459666391`.

## Seguridad — recordatorios permanentes

- Tokens de Meta: nunca en archivos versionados, nunca pegados en un chat.
  Van en `.env` (ya en `.gitignore`) o como credential en n8n.
- Un token con `ads_management` gasta dinero real. Preferir usuario del
  sistema con permisos acotados sobre token personal de acceso total.
- `.env`, `.env.*` (salvo `.env.example`) y `meta/salida/` están en
  `.gitignore` — verificar con `git status` antes de cualquier commit que
  toque `meta/` o la raíz del repo.
