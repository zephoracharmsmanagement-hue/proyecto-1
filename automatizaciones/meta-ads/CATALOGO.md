# Catálogo de Meta, feed del sitio y públicos del píxel nuevo

Estado al 2026-11-12. Rama `claude/tender-pascal-s3tu2h`. Nada de esto está
creado en Meta todavía: los cuatro pasos de abajo esperan la aprobación del
dueño (regla de la cuenta, ver CLAUDE.md § *Modo de operación acordado*).

Comprobado por API el 2026-11-12, antes de proponer nada:

| Qué | Resultado |
|---|---|
| Catálogos del portafolio `1157598043799973` | **0** (no hay nada que reutilizar) |
| Públicos en `act_1683479286750530` | **0** |
| Conversiones personalizadas en `act_1683479286750530` | **0** |
| Píxel `2005297310144764` | activo, del portafolio nuevo; `server_last_fired_time` = **nunca** (sigue el P0 de ESTADO.md) |

El bloqueo de `automatizaciones/MAPA.md` (`has no owning business`) era de la
cuenta vieja `1583713932705268`. La nueva sí pertenece al portafolio, así que
el catálogo ya se puede crear.

## 1 · El feed: `netlify/functions/catalogo-meta.mjs`

Se sirve en **`https://zephoracharms.com/feeds/meta-catalogo.csv`**.

**Función y no CSV estático**, por la disponibilidad: un archivo generado al
desplegar se queda con el conteo de `stock.json`, que no sabe lo vendido ni lo
apartado. Con una función, cada descarga de Meta lee el conteo menos lo
apartado desde Blobs (`_inventario.disponibles()`, la misma resta del checkout
y del asesor). Una descarga cuesta una invocación, no un despliegue de ~15
créditos.

| Campo | De dónde sale |
|---|---|
| `id` | slug de `catalogo.json`, **el mismo que manda el píxel** |
| `price` | `calcular()` de `_precios.js` con un pedido de una pieza. Sin `sale_price`: la promo empieza en 4 piezas |
| `availability` | charm: libre del sku `id`; brazalete: **suma de sus 5 tallas** (`id\|17`…`id\|21`), nunca `item.stock` |
| `image_link` | `/.netlify/images?url=/assets/hd/<foto>&fm=jpg&w=1080` (JPEG público, 1080 px) |
| `link` | `producto-<id>.html`; un anillo enlaza a la página de su modelo |
| `item_group_id`, `size` | solo anillos: cada talla (`anillo-x-t5`) es una variante del modelo |

- **Si Blobs no responde, 503**, no un feed con el conteo crudo. Meta conserva
  el último feed bueno cuando una descarga falla.
- **`pulsera-barril-pandora` sale titulada «Pulsera Barril».** Mismo criterio
  que `assets/ads/`: nada de marcas ajenas en lo que se anuncia. El id no
  cambia, la URL de la página sí lo contiene (cambiarla rompe enlaces y píxel).
- **Kits fuera.** No tienen id propio en el píxel: un kit manda las piezas que
  lo componen, que ya están en el feed. Se agrupan después como *product set*.
- Prueba: `node pruebas/catalogo-meta.js` (en `correr.sh`). Comprueba que cada
  id de `catalogo.json` está una vez, que los ID que mandan las 157 páginas de
  producto existen en el feed, precio contra `calcular()`, la trampa de las
  pulseras, lo apartado y el 503.

Muestra de hoy, con almacén vacío: 166 filas, 157 en existencia, 9 agotadas.

### `content_ids` del píxel contra el feed

Revisado en el código (`tienda.js`, `checkout.html`, `gracias.html`):

| Evento | `content_ids` | ¿Empata? |
|---|---|---|
| `ViewContent` pieza (tienda.js `verPieza`) | `[id]`; anillo: todos sus ids por talla | Sí — la prueba lo verifica página por página |
| `AddToCart` charm / brazalete | `[id]` | Sí |
| `InitiateCheckout` (checkout) | ids del carrito + `contents` | Sí |
| `Purchase` de servidor (`_meta.js`) | `contents` del pedido | Sí, cuando llegue (P0) |
| `Purchase` de navegador (contraentrega en checkout, gracias.html) | **ninguno** | No hace falta: se deduplica con el de servidor, que sí los trae |
| `ViewContent` de categoría / catálogo | `product_group` sin ids | Correcto, no es una pieza |

Ojo: el enlace de WhatsApp del pie (`data-wa="pie"`, sin `data-wa-evento`)
dispara `InitiateCheckout` **sin** `content_ids`. Para el catálogo no estorba
(no empata con nada); para el público de abajo suma gente que escribió por
WhatsApp, que también es intención.

La comprobación **en vivo** (que Meta empate de verdad) se hace después del
paso 2 con `ads_catalog_event_source_get_health` → `match_rate`.

## 2 · Payloads para aprobar

**Requisito previo:** el feed tiene que estar en producción (merge a `main`, un
despliegue). Si el catálogo se crea antes, la primera descarga da 404.

### Paso A — crear el catálogo con el feed programado

`ads_catalog_create`
```json
{
  "business_id": "1157598043799973",
  "catalog_name": "Zephora · Catálogo web",
  "vertical": "commerce",
  "feed_name": "Sitio · catalogo-meta",
  "feed_url": "https://zephoracharms.com/feeds/meta-catalogo.csv",
  "schedule": { "interval": "hourly", "timezone": "America/Bogota" }
}
```
Cada hora = 24 invocaciones al día. Si se prefiere, `daily` a las 6:00.

### Paso B — conectar el píxel al catálogo

`ads_catalog_event_source_connect`
```json
{ "catalog_id": "<id que devuelva el paso A>", "event_source_id": "2005297310144764" }
```

### Paso C — público «IC + AddToCart sin Purchase, 180 d»

`ads_create_custom_audience` — **no se usa en ningún conjunto**, solo acumula.
```json
{
  "ad_account_id": "1683479286750530",
  "subtype": "WEBSITE",
  "name": "Zephora · IC + AddToCart sin compra (180d)",
  "description": "InitiateCheckout o AddToCart en 180 días, sin Purchase. Para que acumule; no pautar todavía.",
  "prefill": true,
  "rule": "{\"inclusions\":{\"operator\":\"or\",\"rules\":[{\"event_sources\":[{\"type\":\"pixel\",\"id\":\"2005297310144764\"}],\"retention_seconds\":15552000,\"filter\":{\"operator\":\"and\",\"filters\":[{\"field\":\"event\",\"operator\":\"eq\",\"value\":\"InitiateCheckout\"}]},\"template\":\"VISITORS_BY_URL\"},{\"event_sources\":[{\"type\":\"pixel\",\"id\":\"2005297310144764\"}],\"retention_seconds\":15552000,\"filter\":{\"operator\":\"and\",\"filters\":[{\"field\":\"event\",\"operator\":\"eq\",\"value\":\"AddToCart\"}]},\"template\":\"VISITORS_BY_URL\"}]},\"exclusions\":{\"operator\":\"or\",\"rules\":[{\"event_sources\":[{\"type\":\"pixel\",\"id\":\"2005297310144764\"}],\"retention_seconds\":15552000,\"filter\":{\"operator\":\"and\",\"filters\":[{\"field\":\"event\",\"operator\":\"eq\",\"value\":\"Purchase\"}]},\"template\":\"VISITORS_BY_URL\"}]}}"
}
```
180 d = 15.552.000 s. El píxel nació el 10-nov, así que hoy el público arranca
casi vacío: es justo para eso que se crea ya.

### Paso D — `Lead` como conversión personalizada

**El conector no tiene herramienta para crear conversiones personalizadas**
(`ads_pixel_event_create` crea reglas de evento sin código, que es otra cosa y
dispararía un `Lead` duplicado). Dos caminos:

1. **Events Manager (recomendado, 1 minuto):** Conversiones personalizadas →
   Crear → Origen «Zephora web» (`2005297310144764`) → Evento `Lead` → sin
   reglas de URL → nombre `Zephora · Lead (suscripción)` → categoría *Cliente
   potencial*.
2. Graph API desde la terminal del dueño (`meta/`, token en `.env`):
   `POST /v25.0/act_1683479286750530/customconversions` con
   `name`, `event_source_id=2005297310144764`, `custom_event_type=LEAD`.

**Antes de crearla, saber qué mide:** hoy `Lead` solo se dispara al
**suscribirse al correo** (`tienda.js`, `content_name: 'suscripcion'`). Los
clics a WhatsApp van como `Contact` (170 enlaces con `data-wa-evento`). La
nota de CLAUDE.md que llama a `Lead` «conversión real del sitio» es de antes
de ese cambio.
