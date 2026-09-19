# Confirmación y actualización de estado de envío por WhatsApp (Skydropx) — diseño

**Fecha:** 2026-09-18. **Rama:** `claude/skydropx-whatsapp-envio`.

## 0 · Qué resuelve y qué no

Hoy, cuando un pedido se despacha, la clienta no se entera de nada hasta que
el paquete llega o no llega. El comprobante de compra y la hoja de despacho
(`_correo.js`) ya existen y **no cambian** — esto es un frente nuevo, después
de esos correos: avisar por WhatsApp cuando Skydropx marca el envío como
despachado, y de nuevo en cada cambio de estado hasta la entrega.

**No cubre:** confirmación de compra (ya existe por correo), ni conversación
—esto es 100% mecánico, sin IA, sin lugar para inventar un estado que Skydropx
no reportó—, ni el bot de ventas de `BOT-WHATSAPP-ARQUITECTURA.md` (frente
aparte, no se toca).

## 1 · El disparador: webhook de Skydropx (corregido el 2026-09-18, misma tarde)

> **Esta sección se reescribió el mismo día.** La versión original decía que la
> cuenta de Skydropx era «solo panel web, sin API» y que el campo «Referencia»
> de su formulario servía para guardar la referencia del pedido. **Las dos
> cosas resultaron falsas** al mirarlo contra la cuenta real. Lo que sigue es
> lo verificado; el § 2 describe la arquitectura que salió de eso.

Lo que se comprobó en la cuenta real (capturas de pantalla del propietario):

- **La API y los webhooks de Skydropx están disponibles y sin costo** en esta
  cuenta (Conexiones → API / Webhooks). El formulario de «Crear webhook» pide
  URL, sección, eventos, método de autenticación y nombre del header.
- **Los eventos que ofrece calzan uno a uno con los seis de esta spec**:
  `created`, `picked_up`, `in_transit`, `last_mile`, `delivered`, `exception`.
- **El webhook es «delgado»**: avisa «cambió el recurso X» con un `id`, un
  `status` y un `links.related`; el detalle completo se pide después a la API
  con el token Bearer de la cuenta.
- **El correo de Skydropx NO repite la referencia del pedido.** Comprobado
  contra un correo real: trae guía, transportadora, nombre y dirección de la
  clienta, nada más. Por eso se abandonó la idea de reconocer correos.
- **El campo «Referencia» del formulario de crear guía no sirve para esto**:
  está bajo «Dirección de destino», con el ejemplo «Barrio obrero,
  Candelaria». Es el punto de referencia de la **dirección**, para el
  mensajero — no un ID de pedido.

**Consecuencia para la correlación:** mientras las guías se creen a mano en el
panel, Skydropx no tiene dónde guardar la referencia de Zephora, así que la
correlación necesita una tabla propia guía → referencia (§ 3.5). El día que
las guías se creen **por API**, el campo `reference` de su endpoint de creación
sí acepta un ID propio y esa tabla sobra.

## 2 · Arquitectura

```
Skydropx cambia el estado de un envío
    ↓
[POST al webhook de n8n]  { data: { id, attributes.status, links.related } }
    ↓
[n8n · valida que links.related apunte a pro.skydropx.com]
    → si no: avisa a la tienda y PARA. Ese link se llama con el token de
      Skydropx; sin esta comprobación, quien conozca la URL del webhook
      podría hacer que n8n mande el token a su propio servidor.
    ↓
[n8n · GET a links.related con el token Bearer de Skydropx]
    → trae guía, transportadora, URL de rastreo, estado
    ↓
[n8n · traduce el estado de Skydropx → código canónico de Zephora]
    created→creada · picked_up→recogido · in_transit→en_transito
    last_mile→en_reparto · delivered→entregado · exception→excepcion
    → un estado fuera de esa lista NO se adivina: avisa a la tienda
    ↓
[n8n · busca la referencia del pedido por número de guía]
    (tabla "Guías Zephora"; sin fila → avisa a la tienda, no adivina)
    ↓
[n8n · HTTP Request → POST /envio-estado]  (header de autenticación compartida)
    ↓
¿404 / 401 / 400?  → avisa a la tienda, no manda WhatsApp
¿yaEnviado: true?  → no hace nada más (evita duplicado)
¿200 con datos?    → sigue
    ↓
[n8n · nodo WhatsApp Business Cloud: envía plantilla `actualizacion_envio`]
    con { nombre, textoEstado, guia, transportadora, urlSeguimiento }
    al `celular` que devolvió el endpoint (con el 57 antepuesto)
    ↓
Mensaje al teléfono de la clienta
```

**Dónde vive cada responsabilidad, y por qué:**

- **n8n habla con Skydropx** (recibe el webhook, pide el detalle a su API,
  traduce su vocabulario de estados al canónico de Zephora). Es la misma idea
  que ya usa este proyecto: la plomería hacia un servicio externo vive en n8n,
  nunca en el repo.
- **El repo decide qué le llega a la clienta.** El texto exacto que lee la
  clienta (`textoEstado`) no lo escribe n8n con un `Set` a mano —vive en
  `_envios.mjs`, versionado, con historial en git—, igual que `armar-carrito`
  nunca deja que quien lo llama formatee el precio. Si Skydropx agrega o
  renombra un estado, se ajusta la traducción en n8n; el texto que ve la
  clienta no se toca.
- **La correlación con el pedido y el anti-duplicados viven en código**, no en
  memoria de n8n, porque son la parte que no puede fallar en silencio.

**Por qué webhook y no los correos de Skydropx** (se evaluaron los dos el
2026-09-18): el correo obligaba a reconocer seis plantillas de texto escritas
para humanos —de las cuales solo una se pudo verificar contra un correo real—,
con hasta 10 minutos de retraso por el sondeo y sin traer la referencia del
pedido. El webhook da los seis estados con nombres fijos, en tiempo real, y no
cuesta nada en esta cuenta. La tabla guía → referencia hace falta en los dos
casos, así que no fue un factor.

## 3 · Endpoint nuevo: `netlify/functions/envio-estado.mjs`

### 3.1 · Por qué necesita autenticación (y los otros endpoints de este repo no)

`_pedidos.mjs` dice explícitamente en su comentario que el registro de
pedidos no expone un endpoint nuevo **a propósito** — es donde vive nombre,
celular y dirección de cada clienta, y no hay que sumar una forma de leerlo
desde internet en un sitio que cobra. `/disponibilidad` y `/armar-carrito` no
rompen esa regla porque no devuelven nada personal: precios y existencias ya
son públicos en la tienda.

Este endpoint sí necesita devolver `celular` y `nombre` — no hay forma de que
n8n mande el WhatsApp sin eso. Así que **no puede ser público como los
otros**: lleva una clave compartida por header, la misma clave que ya vive
como variable de entorno en Netlify y como credencial **Header Auth** en n8n
—que el propio `MAPA.md` señala como una de las dos credenciales que n8n ya
tiene disponibles—. Sin el header correcto, `401` y no se lee nada.

```
Header: X-Zephora-Automation-Key: <secreto>
```

### 3.2 · Contrato

**`POST /.netlify/functions/envio-estado`**

Body:
```json
{
  "referencia": "ZC-260828-4A7F21C3",
  "evento": "en_transito",
  "guia": "SKX-1234567890",
  "transportadora": "Interrapidísimo",
  "urlSeguimiento": "https://tracking.skydropx.com/SKX-1234567890"
}
```

`evento` es una lista cerrada — n8n manda uno de estos seis, nunca texto
libre de Skydropx:

| Código | Cuándo |
|---|---|
| `creada` | Guía generada, todavía no recogida |
| `recogido` | La transportadora recogió el paquete |
| `en_transito` | En camino, sin ser todavía el último tramo |
| `en_reparto` | Última milla, llega hoy o mañana |
| `entregado` | Entregado |
| `excepcion` | Incidencia (dirección errada, rechazo, devolución…) |

Respuestas:

| Código | Cuándo | Qué hace n8n |
|---|---|---|
| `401` | Falta el header o no coincide | Alertar al propietario — algo se desconfiguró |
| `400` | Falta un campo, o `evento` no es uno de los seis | No mandar WhatsApp; registrar el correo crudo para revisar la plantilla de reconocimiento |
| `404` | La `referencia` no existe en Blobs | No mandar WhatsApp; avisar a la tienda para revisar a mano — nunca adivinar a quién le llega |
| `200` | Todo válido | Ver abajo |

Cuerpo de la respuesta `200`:
```json
{
  "celular": "3018990672",
  "nombre": "Valentina",
  "evento": "en_transito",
  "textoEstado": "Tu pedido está en camino.",
  "guia": "SKX-1234567890",
  "transportadora": "Interrapidísimo",
  "urlSeguimiento": "https://tracking.skydropx.com/SKX-1234567890",
  "yaEnviado": false
}
```

Si `yaEnviado` es `true`, n8n no manda el WhatsApp — ya se notificó este mismo
evento para este mismo pedido antes (Skydropx reenvía correos cuando su
sistema reintenta, y n8n puede reprocesar por error).

### 3.3 · `textoEstado` — tabla única, en código

```js
const TEXTOS = {
  creada:      'Tu pedido ya tiene guía de envío y va a ser recogido.',
  recogido:    'Tu pedido fue recogido y va en camino.',
  en_transito: 'Tu pedido está en camino.',
  en_reparto:  'Tu pedido llega hoy — está en la última etapa del envío.',
  entregado:   '¡Tu pedido fue entregado! Esperamos que lo disfrutes 💛',
  excepcion:   'Hay una novedad con tu envío. Te contactamos por WhatsApp o correo en breve.',
};
```

**`excepcion` dispara dos avisos, no uno**: el WhatsApp a la clienta con el
texto neutro de arriba, y un correo a la tienda (reusa `_correo.js`, mismo
patrón que `rescate.mjs` al avisar del carrito) con el detalle crudo de la
incidencia — una excepción de envío necesita que alguien la resuelva, no solo
que la clienta se entere.

### 3.4 · Guardado y anti-duplicados

Usa `leer()` y `marcar()` de `_pedidos.mjs`, sin funciones nuevas de
almacenamiento:

```js
const pedido = await leer(referencia);
if (!pedido) return 404;

const envios = pedido.envios || [];
const yaEnviado = envios.some(e => e.evento === evento);

if (!yaEnviado) {
  await marcar(referencia, {
    envios: [...envios, { evento, guia, transportadora, urlSeguimiento,
                           notificadoEn: new Date().toISOString() }],
  });
}
```

La comprobación es por `evento`, no por `guia` — si algún día un pedido se
manda en dos guías (fuera de alcance de esta versión), el segundo `recogido`
se trataría como duplicado. Se anota como límite conocido, no se resuelve
ahora: no ha pasado ni una vez con el tamaño de esta tienda.

## 4 · Plantilla de WhatsApp — para pegar en Meta

| Campo | Valor |
|---|---|
| **Nombre** | `actualizacion_envio` |
| **Categoría** | **Utility** (no Marketing) |
| **Idioma** | Español (`es`) |

**Por qué Utility y no Marketing:** es una actualización de un pedido que ya
se pagó, no publicidad — exactamente la distinción que ya documentó
`PLANTILLA-WHATSAPP.md` para la plantilla de carritos abandonados, en
sentido contrario. Etiquetarla mal en cualquier dirección arriesga la
calificación de calidad de la cuenta.

### Cuerpo

```
Hola {{1}}, tu pedido de Zephora Charms tiene una novedad:

{{2}}

Guía {{3}} con {{4}}. Puedes seguirlo aquí:
{{5}}

Gracias por tu compra 💛
```

### Ejemplos de las variables (obligatorios en Meta)

| Variable | Ejemplo a pegar |
|---|---|
| `{{1}}` | `Valentina` |
| `{{2}}` | `Tu pedido está en camino.` |
| `{{3}}` | `SKX-1234567890` |
| `{{4}}` | `Interrapidísimo` |
| `{{5}}` | `https://tracking.skydropx.com/SKX-1234567890` |

**No lleva botón.** La URL de seguimiento va como variable dentro del cuerpo,
no en un botón de acción — un botón de Meta exige un prefijo fijo más un
sufijo variable, y no sabemos todavía si la URL de rastreo de Skydropx tiene
esa forma estable para los distintos transportadores que usa. Una variable de
cuerpo acepta la URL completa sin esa restricción. Se puede añadir un botón
más adelante si las URLs de muestra confirman un patrón fijo.

**Por qué no empieza ni termina en variable:** Meta rechaza plantillas así —
la misma regla que ya documentó `PLANTILLA-WHATSAPP.md`. Empieza en «Hola
{{1}}», termina en «Gracias por tu compra 💛».

**Sin pie de opt-out.** A diferencia de la plantilla de Marketing, un mensaje
de Utility sobre el propio pedido de la clienta es parte de cumplir la
compra, no una comunicación comercial — no necesita la misma casilla de
autorización que exige `cliente.optin`. Se manda a todo pedido que llegue a
esta automatización, sin filtrar por ese campo.

## 5 · La tabla guía → referencia, y el paso manual que queda

Mientras las guías se creen a mano en el panel de Skydropx, nada en su sistema
guarda la referencia del pedido de Zephora (§ 1). La correlación vive entonces
en una tabla propia, **"Guías Zephora"**, en las Data Tables de n8n:

| Columna | Qué lleva |
|---|---|
| `guia` | El número de guía que asigna la transportadora (ej. `58101124105`) |
| `referencia` | La referencia del pedido de Zephora (ej. `ZC-260918-4A7F21C3`) |

**El paso manual:** al crear cada guía en Skydropx, agregar esa fila. Son dos
datos y diez segundos, en el mismo momento en que ya se están copiando los
datos del pedido al formulario de Skydropx.

Si llega un evento de una guía que no está en la tabla, n8n **no adivina de
qué pedido es**: avisa a la tienda con el número de guía para que se agregue
la fila. Nunca cruza por nombre ni por celular — mandarle a alguien el estado
del pedido de otra persona es peor que no mandar nada.

**Cómo se elimina este paso algún día:** creando las guías por la API de
Skydropx en vez de a mano. Su endpoint de creación acepta un campo
`reference`, que es exactamente para esto. Eso es un frente aparte —
automatizar el despacho, no solo el aviso— y no está en el alcance de esta
spec.

## 6 · Pruebas

- **`pruebas/envio-estado.js`** (nuevo, mismo estilo que `pruebas/armar-carrito.js`):
  - Sin header o header incorrecto → `401`.
  - Falta un campo, o `evento` fuera de la lista de seis → `400`.
  - `referencia` inexistente → `404`.
  - Caso válido → `200`, `textoEstado` correcto para cada uno de los seis
    eventos, `celular`/`nombre` vienen del pedido guardado.
  - Mismo `evento` dos veces sobre el mismo pedido → la segunda vez
    `yaEnviado: true` y `envios` no crece.
  - `excepcion` → confirma que se dispara también el aviso a la tienda.
- **Prueba con el botón «Probar API» de Skydropx**, que manda un webhook de
  ejemplo al workflow: confirma que la autenticación del webhook pasa, que la
  validación del host acepta el link real, y que el nodo de normalización
  encuentra guía y transportadora en la respuesta de la API. **Esa primera
  ejecución real es la que fija los nombres de campo definitivos** — el nodo
  los busca hoy en varias rutas posibles y deja el JSON crudo en el aviso
  justo para poder ajustarlo con datos en vez de suposiciones.
- **Prueba de plantilla en Meta** con el botón de vista previa antes de
  mandarla a revisión, y una prueba real a un número propio una vez aprobada,
  antes de activar el workflow.

## 7 · Qué falta y de quién es

| Cosa | Responsabilidad | Bloquea a |
|---|---|---|
| Clave compartida (`X-Zephora-Automation-Key`) — generarla y ponerla en Netlify env vars y en n8n como credencial Header Auth | Propietario | Que el endpoint no quede abierto |
| Token de la API de Skydropx (Conexiones → API → Ver credenciales) como credencial Bearer en n8n | Propietario | Pedir el detalle del envío tras el webhook |
| Credencial de header propia para el webhook de entrada, con el mismo valor en Skydropx | Propietario | Que cualquiera no pueda disparar el workflow |
| Crear el webhook en Skydropx (URL de n8n, sección Envíos, los 6 eventos) | Propietario | Que llegue algo |
| Credencial de Gmail en n8n, solo para los avisos a la tienda | Propietario | Los cuatro caminos de aviso |
| Phone Number ID de WhatsApp Manager | Propietario | Que el nodo de WhatsApp pueda mandar |
| Plantilla `actualizacion_envio` en Meta | Propietario | — ✅ activa desde el 2026-09-18 |
| `netlify/functions/envio-estado.mjs` + `pruebas/envio-estado.js` | Código | — ✅ en `main` desde el 2026-09-18 |
| Workflow de n8n | Código | — ✅ construido el 2026-09-18, sin activar |

## 8 · Fuera de alcance de esta versión

- Pedidos con más de una guía (envíos partidos).
- Botón de acción en la plantilla (queda para cuando se confirme el patrón de
  URL de rastreo).
- Cualquier lógica de reintento si WhatsApp devuelve error al mandar — se
  registra y se revisa a mano, no se reintenta solo.
- Tocar el bot de ventas de `BOT-WHATSAPP-ARQUITECTURA.md` — es un flujo
  aparte, sin relación de código con este.

## 9 · Límites conocidos, anotados tras la revisión final de la implementación

No son código pendiente de este endpoint — son comportamiento ya verdadero
que hay que tener presente al construir el workflow de n8n o al operar esto
en producción:

- **`marcar()` no hace compare-and-swap.** Si dos eventos de Skydropx para el
  mismo pedido llegan casi al mismo tiempo, la segunda escritura puede pisar
  el `envios` de la primera y ese evento se notificaría dos veces. No pasa en
  operación normal —los eventos de un mismo envío llegan espaciados en
  horas—; el riesgo real sería una ráfaga de reintentos de Skydropx sobre el
  mismo envío. Con webhooks el riesgo es menor que con el sondeo de correo
  (que habría procesado el buzón acumulado de golpe el primer día), pero no
  es cero.
- **`celular` vuelve en formato local (`3018990672`), sin `57` delante.** La
  API de WhatsApp Business necesita el número completo (E.164). Lo antepone
  el nodo «Preparar variables de WhatsApp» del workflow, no el endpoint —
  queda anotado porque es el tipo de detalle que se descubre en la primera
  prueba real si nadie lo escribió.
- **Un pedido se marca como notificado antes de que n8n confirme que el
  WhatsApp salió.** Si el nodo de WhatsApp falla después de que este endpoint
  ya respondió `200`, un reintento del mismo evento vería `yaEnviado: true` y
  no se volvería a intentar nada — el mensaje se perdería en silencio. Es la
  misma decisión de § 8 ("no se reintenta solo"), pero conviene que el
  workflow de n8n **alerte si el nodo de WhatsApp falla**, en vez de dejar
  que el error se pierda ahí.
- **Un apagón de Blobs se ve igual que una referencia que no existe.**
  `leer()` devuelve `null` tanto si el pedido no está como si el almacén no
  responde, y el endpoint contesta `404` en los dos casos. La respuesta —no
  adivinar, avisar a la tienda— sigue siendo la correcta en ambos casos; el
  único costo es que el motivo que ve la tienda («no existe esa referencia»)
  puede ser impreciso durante un apagón real.
