# Contrato · `Purchase` a la Conversions API de Meta

Implementado en `netlify/functions/_meta.js`, con las señales de atribución en
`netlify/functions/_atribucion.mjs`. Esto documenta **qué sale, por qué, y cómo
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
checkout.html ──POST /crear-pago──► crear-pago.mjs
   cookies _fbp/_fbc                  hashea la clienta (SHA-256)
                                      guarda señales en Blobs, clave = referencia
                                             │
                                     Wompi cobra
                                             │
Meta ◄──Purchase (CAPI)──── wompi-webhook.mjs ┘
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
| Servidor | `_meta.js` | `event_id` y `custom_data.order_id` |

**Si alguien toca una punta sin la otra, las compras se duplican y nada avisa.**
El panel de Meta reporta el doble, la pauta optimiza hacia un ROAS inventado, y
para cuando se nota lleva semanas decidiendo presupuesto con números falsos.

Por eso `pruebas/meta.js` comprueba el `eventID` **leyendo el HTML**: es la única
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

Se escribe **solo para pedidos que van a la pasarela**, y **se borra al
recogerlas**, con el pago aprobado o rechazado.

Contraentrega no escribe nada aquí: no pasa por Wompi, así que no hay webhook
que venga después a recoger. Su `Purchase` sale de `crear-pago.mjs` en el mismo
momento de registrar el pedido, usando las señales al vuelo. Se deduplica contra
el pixel de `checkout.html` por la misma referencia.

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
   `"evento":"meta_purchase"` y comprobar que dice `"atribuido":true`. Para
   contraentrega la misma línea sale en `crear-pago`.
5. **Quitar `META_TEST_EVENT_CODE`** cuando esté verificado. Mientras esté
   puesto, ninguna compra real llega a las campañas.

## Qué dice el log

Una línea por pedido, en `wompi-webhook` (pago anticipado) o en `crear-pago`
(contraentrega):

```json
{"evento":"meta_purchase","referencia":"ZC-260811-ABCD1234",
 "enviado":true,"motivo":null,"atribuido":true}
```

| Campo | Qué mirar |
|---|---|
| `"enviado": true` | ✅ Meta lo recibió y cuenta como conversión |
| `"motivo": "sin configurar"` | Falta `META_CAPI_TOKEN`. No está roto, está sin configurar |
| `"motivo": "sin datos de emparejamiento"` | Ni señales guardadas ni datos de Wompi. Meta lo habría rechazado |
| `"motivo": "error 400"` | Meta devolvió un error — el campo exacto que no le gustó sale en la línea `Meta CAPI respondió` de al lado |
| `"motivo"` con texto de red | Se cayó o expiró (5 s). Se abandonó el evento |
| `"atribuido": false` | Salió **sin `fbc` ni `fbp`** |

`"atribuido": false` cuenta como conversión igual, pero empareja mucho peor. **Al
revisar por qué una campaña no aprende, esto es lo primero que hay que mirar.**
Con `META_TEST_EVENT_CODE` puesto, `enviado` es `true` pero **nada cuenta**.

## Falla hacia adelante

Nada de esto puede tumbar la respuesta a Wompi. Si falta el token, si Meta
responde mal, si Blobs no está o si el envío expira, se registra en el log y el
webhook sigue: confirma el inventario, manda el correo y devuelve 200. Un evento
de marketing perdido no vale que Wompi reintente un pago en bucle.

## Pendiente / decisiones abiertas

- **Nadie barre el almacén `atribucion`.** Se borra al recoger, que cubre todo lo
  que llega al webhook. Quedan huérfanas las señales de pedidos que nunca
  llegaron a Wompi. El campo `vence` está puesto para que una función programada
  que las barra sea trivial de escribir el día que haga falta.
- **`Purchase` de ventas por WhatsApp** sigue siendo terreno del workflow de n8n
  (`h5U0fGHrW4hekjtp`), con `action_source: chat`. Son dos flujos distintos para
  dos ventas distintas; no se pisan porque el `order_id` es diferente.
