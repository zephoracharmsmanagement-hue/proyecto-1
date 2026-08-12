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
  Dispara `PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`,
  `AddPaymentInfo`, **`Purchase`**, `Lead` y `Contact`. Detalle completo en
  `README.md` § Medición.

  **`Purchase` es la conversión a optimizar**, no `Lead`. Este archivo decía
  antes que el pago ocurría fuera del sitio; dejó de ser cierto cuando el
  checkout empezó a cobrar por Wompi.
- **`Purchase` server-side (CAPI) — implementado.**
  `netlify/functions/_meta.js`, disparado desde `wompi-webhook.mjs` cuando
  Wompi confirma un pago, y desde `crear-pago.mjs` para contraentrega, que
  no pasa por Wompi. Las señales de atribución (`_fbp`/`_fbc`, IP,
  user-agent) las guarda `_atribucion.mjs` en Blobs entre una punta y otra.
  Contrato completo y cómo probarlo en
  [`automatizaciones/contratos/purchase-capi.md`](automatizaciones/contratos/purchase-capi.md).

  **Antes de tocar `Purchase` en cualquier punta, leer ese contrato.** El
  pixel y el servidor mandan el mismo evento y se deduplican por `event_id`
  = referencia del pedido; quitar el `eventID` de `gracias.html` o de
  `checkout.html`, o cambiar el `event_id` del servidor, hace que Meta cuente
  el doble de compras **sin avisar de nada**. `pruebas/meta.js` lo comprueba
  leyendo el HTML.

  Solo falta `META_CAPI_TOKEN` en Netlify para encenderlo.
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

  Nota: **ya no son dos disparadores compitiendo, son dos ventas distintas.**
  Lo que se compra en el sitio lo manda `_meta.js` con
  `action_source: website`; lo que se cierra por WhatsApp lo manda este
  workflow con `action_source: chat`. Los `order_id` son distintos, así que
  Meta no los deduplica entre sí — correcto, porque son dos compras. No hay
  que consolidarlos.

### Por qué importa

El checkout web ya cobra, pero también sigue existiendo venta cerrada por
WhatsApp fuera de esa ruta. Para esa venta, el pixel del sitio solo ve
`Lead` (alguien escribió), nunca `Purchase` (alguien pagó) — sin CAPI, Meta
optimiza las campañas hacia gente que escribe, no hacia gente que compra.

### Pendiente

1. **Generar token CAPI** en Events Manager → dataset `2130673404542988` →
   Configuración → Conversions API → *Generar token de acceso*. **No pegarlo
   en ningún chat.** El mismo token sirve en los dos sitios, y hace falta en
   los dos:
   - Netlify → Site configuration → Environment variables, como
     `META_CAPI_TOKEN` — es lo único que falta para que el `Purchase` de las
     compras web empiece a salir.
   - n8n, como credential Bearer Auth `Meta CAPI Zephora`, para el workflow
     de las ventas por WhatsApp.
2. **Probar los dos flujos con `test_event_code`** (Events Manager → Probar
   eventos) antes de dejarlos contando conversiones reales. Para el flujo web
   el procedimiento paso a paso está en
   `automatizaciones/contratos/purchase-capi.md` § Cómo probarlo. **Acordarse
   de quitar `META_TEST_EVENT_CODE` después**: mientras esté puesto, ninguna
   compra real llega a la pauta.
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

## Automatizaciones — dónde vive cada cosa

Las automatizaciones (asesor de WhatsApp con Gemini, CAPI, carritos
abandonados) viven **en este repo**, no en uno aparte. Se decidió así porque
las tres leen datos que solo existen aquí —`assets/catalogo.json`,
`assets/stock.json`, el inventario apartado en Blobs, los eventos del
checkout—: separarlas obligaría a duplicar el catálogo, y un asesor que
cotiza con precios viejos hace más daño que no tener asesor.

| Dónde | Qué |
|---|---|
| `netlify/functions/` | **Todo el código que corre en producción**, incluidos los handlers de automatización. No crear otra carpeta de handlers: las llaves de Wompi y el acceso a Blobs ya están aquí |
| `automatizaciones/contratos/` | Qué manda cada pieza y qué espera. Lo primero que se lee y lo primero que se actualiza |
| `automatizaciones/n8n/` | Workflows exportados en JSON |
| `automatizaciones/prompts/` | Prompts de sistema, versionados como código |

Empezar por [`automatizaciones/README.md`](automatizaciones/README.md), que
lleva el estado de las tres.

**Decisión tomada sobre el asesor de Gemini: sin base vectorial.** El catálogo
son 10 KB (132 piezas, 18 pulseras) y cabe entero en el contexto. Montar
embeddings añade un componente que puede recuperar el fragmento equivocado a
cambio de nada. Lo que sí hay que resolver antes de escribir el prompt es de
dónde lee el stock: `stock.json` no sabe lo que está apartado, y eso vive en
Blobs.

### Modo de operación acordado

Antes de cualquier acción que modifique o cree algo que gaste presupuesto
real (campañas, conjuntos, anuncios, presupuestos, pujas): mostrar el
payload/estructura exacto para aprobación antes de ejecutar. Lecturas,
diagnósticos y consultas de datos van directo. Esto sigue vigente aunque el
conector de Ads MCP termine con permisos de escritura completos — el
permiso técnico no cambia el acuerdo.

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
- **Este repo se ha trabajado en paralelo desde varias sesiones** (esta
  conversación y al menos una sesión de terminal en la rama
  `claude/ecommerce-landing-page-elivwb`, empujada también aquí). Antes de
  hacer push, `git fetch` y revisar si hay commits nuevos — ya pasó un
  push rechazado por historial divergente en este proyecto.
- Algunas verificaciones contra APIs externas (`graph.facebook.com`,
  `netlify.com`, etc.) están bloqueadas por política de red en entornos de
  ejecución remota — hay que correrlas desde una terminal con acceso real,
  no asumir que fallan por otra razón.

## Seguridad — recordatorios permanentes

- Tokens de Meta: nunca en archivos versionados, nunca pegados en un chat.
  Van en `.env` (ya en `.gitignore`) o como credential en n8n.
- Un token con `ads_management` gasta dinero real. Preferir usuario del
  sistema con permisos acotados sobre token personal de acceso total.
