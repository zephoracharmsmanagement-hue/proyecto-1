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
| — | **Zephora · Hoja de Inventario** (`K1J4pHYfvd6QuAq8`) | **Activo en producción.** Sin exportar todavía |
| — | **Zephora · Purchase a Meta (CAPI)** (`h5U0fGHrW4hekjtp`) | Construido, **sin publicar** y sin exportar todavía |

### Zephora · Hoja de Inventario

Recibe de `netlify/functions/_hoja.mjs` un aviso por venta cobrada y escribe en
la hoja **Zephora · Inventario** (`1P-iZeFJDkPGSws_imPS_k_TaUYZrQMJGSPhBNWbNE-Y`):
una fila por pieza en *Movimientos* y un upsert por `id`+`talla` en
*Existencias*.

Webhook: `POST /webhook/hoja-inventario`, con cabecera `X-Zephora-Token`
(`HOJA_TOKEN` en Netlify).

**La hoja es un espejo, no un mando.** `quedan` llega calculado por el CAS de
`_inventario.mjs`; el workflow solo lo muestra y nunca resta. Reponer reescribe
`stock.json`, no se hace editando celdas.

#### Bug corregido el 2026-08-20 — filas en blanco

`Buscar en Movimientos` tiene `alwaysOutputData`, así que cuando no encuentra la
venta —o sea, **siempre que es nueva**— emite un item vacío. `Agregar Fila`
mapeaba desde `{{ $json.referencia }}`, que a esa altura ya no era el movimiento
sino ese objeto vacío: **cada venta escribía una fila en blanco**, y de paso la
deduplicación no podía funcionar, porque buscaba filas anteriores que estaban
todas vacías.

Confirmado leyendo la ejecución real del 19 de agosto, no deducido.

El arreglo es leer el item de origen: `{{ $('Separar Movimientos').item.json.X }}`.
**`$('Nodo').item` y no `$node["Nodo"].json`** — la forma vieja no resuelve el
emparejamiento de items dentro de un Split Out y, con varios movimientos en un
pedido, devuelve el de otra pieza. En un flujo de inventario eso es restarle
unidades a la pieza equivocada.

#### Control de errores

Los tres nodos de Sheets reintentan **3 veces con 2 s** y continúan en vez de
parar. El razonamiento: la API de Sheets devuelve 429 con facilidad, y una fila
perdida deja la hoja mostrando **más existencias de las reales** — la dirección
peligrosa del error. Una fila duplicada se ve y se borra; una que falta, no.

**Pendiente:** no hay `errorWorkflow`. Si esto falla del todo, no se entera
nadie.

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
