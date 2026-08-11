# Automatizaciones — Zephora Charms

El motor que conecta la tienda con n8n, Gemini y Meta. Vive **dentro de este
repo y no en uno aparte**, a propósito: las tres automatizaciones leen datos que
solo existen aquí —`assets/catalogo.json`, `assets/stock.json`, el inventario
apartado en Netlify Blobs, los eventos que dispara el checkout—. Separarlas
obligaría a copiar el catálogo o a sincronizarlo, y un asesor que cotiza con
precios de la semana pasada hace más daño que no tener asesor.

## Qué va en cada carpeta

| Carpeta | Qué guarda |
|---|---|
| `contratos/` | Qué manda cada pieza y qué espera recibir. Es lo primero que hay que leer y lo primero que hay que actualizar cuando algo cambia |
| `n8n/` | Los workflows exportados en JSON, para que existan en git y no solo dentro del servidor de n8n |
| `prompts/` | Los prompts de sistema del asesor comercial, versionados como código |

Lo que **no** va aquí: código que corre en producción. Eso vive en
`netlify/functions/`, donde ya están las llaves de Wompi y el acceso a Blobs.
Tener dos sitios donde buscar un handler es tener un sitio donde no buscar.

## Estado de las tres automatizaciones

### 1. `Purchase` server-side a Meta (CAPI) — **hecho, falta el token**

Cuando Wompi confirma un pago, `netlify/functions/wompi-webhook.js` manda el
evento `Purchase` a la Conversions API. El contrato completo, el porqué de cada
decisión y **cómo probarlo** están en
[`contratos/purchase-capi.md`](contratos/purchase-capi.md).

Para encenderlo solo falta poner `META_CAPI_TOKEN` en Netlify. Sin esa variable
el código no manda nada y lo dice en el log; nada más se rompe.

### 2. Asesor comercial por WhatsApp (Gemini) — **sin empezar**

Flujo en n8n contra la API de Gemini, con el catálogo y el inventario reales
como contexto.

**Sin base vectorial.** `assets/catalogo.json` son 10 KB —132 piezas y 18
pulseras— y cabe entero en el contexto del modelo. Montar embeddings para eso
añade un componente que puede recuperar el fragmento equivocado, a cambio de
nada. Si el catálogo creciera un orden de magnitud, se revisa.

Lo que hay que resolver antes de escribir el primer prompt: **de dónde lee el
stock**. `stock.json` es un archivo estático y no sabe lo que hay apartado; el
estado real está en Blobs. Prometer por WhatsApp una pieza que ya está reservada
es el mismo error que la reserva de inventario vino a arreglar.

### 3. Carritos abandonados — **sin empezar**

Disparo temporizado desde la tienda hacia n8n para escribir por WhatsApp.

Depende de tener un dato que hoy no se guarda: quién abandonó y con qué en el
carrito. El carrito vive en `localStorage` del navegador y nunca llega al
servidor hasta que se confirma el pedido. Hay que decidir en qué momento se
captura el contacto, y eso es una decisión de producto antes que técnica.

## Reglas de trabajo

- **Nada que gaste presupuesto real se ejecuta sin aprobación previa.** Campañas,
  conjuntos, anuncios, pujas: primero se muestra el payload exacto. Lecturas y
  diagnósticos van directo. Sigue vigente aunque el conector tenga permisos de
  escritura.
- **Los tokens no van en el repo ni en un chat.** `.env` (ya en `.gitignore`) o
  credential de n8n. Ver `.env.example`.
- **Un workflow que solo existe en el servidor de n8n no existe.** Al publicar un
  cambio, exportar el JSON a `n8n/`.
- **Lo que se le manda a Meta se prueba con `test_event_code` antes de contarlo
  como conversión real.**
