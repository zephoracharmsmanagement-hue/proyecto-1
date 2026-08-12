# Workflows de n8n

Aquí van los workflows **exportados en JSON**. Un workflow que solo existe
dentro del servidor de n8n no está versionado, no se puede revisar en un diff y
no se puede recuperar si alguien lo edita mal.

Servidor autohospedado: `n8n.srv1888488.hstgr.cloud`.

## Cómo exportar

En n8n: abrir el workflow → menú `⋯` → **Download**. Guardar aquí con el mismo
nombre del archivo que ya esté, para que el diff muestre qué cambió y no un
archivo nuevo entero.

**Antes de subirlo, revisar que no traiga credenciales.** n8n exporta las
credenciales por referencia (un id y un nombre), no por valor, pero un nodo de
código o una cabecera escrita a mano sí puede llevar un token pegado. Ese token
queda en el historial de git para siempre.

## Workflows

| Archivo | Workflow | Estado |
|---|---|---|
| — | **Zephora · Purchase a Meta (CAPI)** (`h5U0fGHrW4hekjtp`) | Construido, **sin publicar** y sin exportar todavía |

### Zephora · Purchase a Meta (CAPI)

Formulario para registrar ventas cerradas por WhatsApp. Normaliza el teléfono a
`57XXXXXXXXXX`, hashea con SHA-256, arma el evento `Purchase` con
`action_source: chat` y un `order_id` determinista, lo manda a
`graph.facebook.com/v25.0/2130673404542988/events` y guarda todo en la Data
Table **Pedidos Zephora** (`tmDPVx97PUPX4OzT`).

Le falta la credential del token CAPI (Bearer Auth, nombre `Meta CAPI Zephora`)
y una prueba con `test_event_code`.

**Este workflow no se pisa con el `Purchase` de la web.** Son dos ventas
distintas: la del checkout la manda `netlify/functions/_meta.js` con
`action_source: website`, y esta la manda n8n con `action_source: chat`. Los
`order_id` son diferentes, así que Meta no las deduplica entre sí — que es lo
correcto, porque son dos compras.
