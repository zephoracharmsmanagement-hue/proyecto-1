# Contrato · `Purchase` a la Conversions API de Meta

Implementado en `netlify/functions/_capi.js`, disparado desde
`netlify/functions/wompi-webhook.js`. Esto documenta **qué sale, por qué, y cómo
comprobarlo**.

## Por qué existe

El pixel ya dispara `Purchase` en `gracias.html`. El problema es que solo lo
dispara **si la clienta vuelve al sitio**, y volver es opcional: puede cerrar el
navegador al pagar, quedarse sin datos, o pagar por PSE desde la app del banco y
no regresar nunca. Ese pago fue bueno y Meta no se enteraba.

No es un detalle contable. Meta optimiza hacia lo que ve. Si solo ve una parte
de las compras —y encima la parte sesgada hacia quien tiene buena conexión y
paciencia— aprende de una muestra torcida.

## El camino completo

```
checkout.html ──POST /crear-pago──► crear-pago.js
   cookies _fbp/_fbc                  hashea la clienta (SHA-256)
                                      guarda señales en Blobs, clave = referencia
                                             │
                                     Wompi cobra
                                             │
Meta ◄──Purchase (CAPI)──── wompi-webhook.js ┘
                             recoge y BORRA las señales
                             manda el evento si el pago fue APPROVED

gracias.html ──Purchase (pixel, eventID = referencia)──► Meta
                          los dos se deduplican por event_id
```

## La deduplicación — lo que no se puede romper

Los dos eventos describen **la misma compra**. Sin decírselo a Meta, cuenta dos.

Se le dice con `event_id`, que en las dos puntas es **la referencia del pedido**
(`ZC-AAMMDD-XXXXXXXX`):

| Punta | Dónde | Qué manda |
|---|---|---|
| Navegador | `gracias.html` | `fbq('track','Purchase',{…},{eventID: rr})` |
| Servidor | `_capi.js` | `event_id` y `custom_data.order_id` |

**Si alguien toca una punta sin la otra, las compras se duplican y nada avisa.**
El panel de Meta reporta el doble, la pauta optimiza hacia un ROAS inventado, y
para cuando se nota lleva semanas decidiendo presupuesto con números falsos.

Por eso `pruebas/capi.js` comprueba el `eventID` **leyendo el HTML**: es la única
forma de que quitarlo salga en rojo en el mismo push.

## Por qué se guardan señales en Blobs

Meta empareja una compra con el anuncio que la produjo sobre todo por dos
cookies: `_fbc` (el clic en el anuncio) y `_fbp`. El webhook de Wompi es una
llamada servidor a servidor: **no tiene cookies, ni IP, ni user-agent**.

Y como el evento de servidor suele llegar **antes** que el del navegador —el
webhook entra en segundos, la clienta vuelve cuando vuelve— es el de servidor el
que Meta conserva al deduplicar. Mandarlo pelado sería cambiar un evento con
atribución por uno sin ella: **peor que no mandarlo**.

Almacén `atribucion` en Netlify Blobs, clave = referencia del pedido:

```json
{ "v": 1, "vence": 1786086400000,
  "usuario": { "em": "<sha256>", "ph": "<sha256>", "fn": "<sha256>",
               "ln": "<sha256>", "ct": "<sha256>", "st": "<sha256>",
               "country": "<sha256>" },
  "fbp": "fb.1.…", "fbc": "fb.1.…",
  "ip": "181.49.…", "ua": "Mozilla/5.0 …",
  "contenidos": [{ "id": "acuario", "quantity": 2 }],
  "total": 214000 }
```

Se escribe **solo para pedidos que van a la pasarela** —contraentrega no pasa por
el webhook, y escribirle señales dejaría datos que nadie recoge— y **se borra al
leerlas**, con o sin pago aprobado.

## Qué se manda y qué no

Lo que sale ya va hasheado: el blob no contiene un correo ni un teléfono
legibles. Las reglas de normalización son las de Meta, no gusto propio — si no
cuadran, el hash no coincide con el que ellos calculan y **el emparejamiento
falla en silencio**:

| Campo | Normalización |
|---|---|
| `em` | minúsculas, sin espacios alrededor |
| `ph` | solo dígitos, con indicativo: `57XXXXXXXXXX` |
| `fn` / `ln` | minúsculas, sin puntuación, **con tildes y eñes** |
| `ct` / `st` | minúsculas, **sin tildes**, sin espacios ni puntuación |
| `country` | `co` |

Sin hashear, porque Meta los necesita en claro: `fbc`, `fbp`,
`client_ip_address`, `client_user_agent`.

**El documento de identidad no se manda, ni hasheado.** Meta no lo usa para
emparejar, y el SHA-256 de una cédula colombiana se revierte por fuerza bruta en
segundos: son diez dígitos. Hashear no es anonimizar cuando el dominio es
pequeño.

## Variables de entorno

| Variable | Para qué |
|---|---|
| `META_CAPI_TOKEN` | **Obligatoria para que se mande algo.** Events Manager → dataset `2130673404542988` → Configuración → Conversions API → Generar token de acceso |
| `META_TEST_EVENT_CODE` | Manda los eventos al panel «Probar eventos» **sin contarlos como conversiones**. Se pone para probar y se quita |
| `META_PIXEL_ID` | Opcional. Por defecto `2130673404542988` |
| `META_API_VERSION` | Opcional. Por defecto `v25.0` |

## Cómo probarlo

1. En Netlify → Site configuration → Environment variables, poner
   `META_CAPI_TOKEN` y **también `META_TEST_EVENT_CODE`** con el código que da
   Events Manager → Probar eventos. Con el segundo puesto nada cuenta como
   conversión real.
2. Hacer un pedido de prueba en el sitio y pagarlo.
3. En Events Manager → Probar eventos debe aparecer un `Purchase` con
   `Servidor` como origen. Si también se vuelve a `gracias.html`, Meta debe
   mostrar **uno solo**, marcado como deduplicado — no dos.
4. En Netlify → Logs → Functions → `wompi-webhook`, buscar la línea
   `"evento":"capi_…"`.
5. **Quitar `META_TEST_EVENT_CODE`** cuando esté verificado. Mientras esté
   puesto, ninguna compra real llega a las campañas.

## Qué dice el log

`wompi-webhook` escribe una línea por pago aprobado:

```json
{"evento":"capi_enviado","referencia":"ZC-260811-ABCD1234","atribucion":true}
```

| `evento` | Qué significa |
|---|---|
| `capi_enviado` | ✅ Meta lo recibió y cuenta como conversión |
| `capi_prueba` | Salió, pero con `META_TEST_EVENT_CODE`: **no cuenta** |
| `capi_sin-token` | Falta `META_CAPI_TOKEN`. No está roto, está sin configurar |
| `capi_sin-datos` | No había señales guardadas. Meta lo habría rechazado |
| `capi_rechazado` | Meta devolvió un error — el motivo va en el log de al lado |
| `capi_sin-respuesta` | Meta no contestó en 5 s. Se abandonó el evento |

`"atribucion": false` significa que el evento salió sin `fbc` ni `fbp`. No está
mal —cuenta como conversión— pero empareja mucho peor. **Al revisar por qué una
campaña no aprende, esto es lo primero que hay que mirar.**

## Falla hacia adelante

Nada de esto puede tumbar la respuesta a Wompi. Si falta el token, si Meta
responde mal, si Blobs no está o si el envío expira, se registra en el log y el
webhook sigue: confirma el inventario, manda el correo y devuelve 200. Un evento
de marketing perdido no vale que Wompi reintente un pago en bucle.

## Pendiente / decisiones abiertas

- **Contraentrega no manda CAPI.** Su `Purchase` sigue siendo solo el del
  navegador, como hasta ahora. El `eventID` ya va puesto en `checkout.html` para
  que activarlo sea añadir el envío, sin tener que acordarse de volver al HTML.
- **Nadie barre el almacén `atribucion`.** Se borra al recoger, que cubre todo lo
  que llega al webhook. Quedan huérfanas las señales de pedidos que nunca
  llegaron a Wompi. El campo `vence` está puesto para que una función programada
  que las barra sea trivial de escribir el día que haga falta.
- **`Purchase` de ventas por WhatsApp** sigue siendo terreno del workflow de n8n
  (`h5U0fGHrW4hekjtp`), con `action_source: chat`. Son dos flujos distintos para
  dos ventas distintas; no se pisan porque el `order_id` es diferente.
