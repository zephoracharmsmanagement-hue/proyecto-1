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

## 1 · Restricción de fondo: Skydropx solo por panel, sin API

Confirmado con el propietario (2026-09-18): la cuenta de Skydropx es de panel
web, sin API ni webhooks propios. Lo que sí existe y es la base de todo este
diseño:

- **WhatsApp Business API ya está activa** en n8n (credenciales conectadas).
- **Skydropx manda un correo por cada evento** (guía creada, recogido, en
  tránsito, entregado, etc.) a una casilla que el propietario puede compartir
  con n8n.
- **El formulario de creación de guía en Skydropx tiene un campo de
  referencia/número de orden libre** — confirmado por el propietario. Ahí va
  la `referencia` del pedido de Zephora (ej. `ZC-260828-4A7F21C3`), a mano,
  en el mismo momento en que ya se copian los datos del pedido para armar la
  guía. No es un paso nuevo de captura, es un campo más en un formulario que
  ya se llena a mano.

Esa referencia, repetida por Skydropx en su correo de notificación, es lo que
permite encontrar el pedido exacto sin ambigüedad — la alternativa (cruzar por
número de celular) se descartó en la conversación de diseño por el riesgo de
mandarle a alguien el estado del pedido de otra persona.

## 2 · Arquitectura

```
Correo de Skydropx (evento de envío)
    ↓
[n8n · Email Trigger IMAP sobre el buzón compartido]
    ↓
[n8n · nodo de código: reconoce la plantilla de correo de Skydropx]
    → extrae: referencia, evento crudo, guía, transportadora, URL de rastreo
    ↓
[n8n · mapea evento crudo de Skydropx → código canónico de Zephora]
    (creada | recogido | en_transito | en_reparto | entregado | excepcion)
    ↓
[n8n · HTTP Request → POST /.netlify/functions/envio-estado]
    (header de autenticación compartida)
    ↓
¿404 referencia no existe?  → avisa a la tienda, no adivina, no manda WhatsApp
¿yaEnviado: true?           → no hace nada más (evita duplicado)
¿200 con datos?             → sigue
    ↓
[n8n · nodo WhatsApp Business Cloud: envía plantilla `actualizacion_envio`]
    con { nombre, textoEstado, guia, transportadora, urlSeguimiento }
    al `celular` que devolvió el endpoint
    ↓
Mensaje al teléfono de la clienta
```

**Dónde vive cada responsabilidad, y por qué:**

- **n8n reconoce el correo de Skydropx** (formato externo, fuera de nuestro
  control, puede cambiar sin avisar) y **traduce a un código canónico
  propio**. Es la misma idea que ya usa este proyecto: la plomería hacia un
  servicio externo vive en n8n, nunca en el repo.
- **El repo decide qué le llega a la clienta.** El texto exacto que lee la
  clienta (`textoEstado`) no lo escribe n8n con un `Set` a mano —vive en
  `_envios.mjs`, versionado, con historial en git—, igual que `armar-carrito`
  nunca deja que quien lo llama formatee el precio. Si Skydropx cambia la
  redacción de sus correos, se ajusta el reconocimiento en n8n; el texto que
  ve la clienta no se toca.
- **La correlación con el pedido y el anti-duplicados viven en código**, no en
  memoria de n8n, porque son la parte que no puede fallar en silencio.

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

## 5 · Recolectar los correos de muestra de Skydropx — lo que hace falta antes de programar el parseo

El nodo de n8n que reconoce el correo de Skydropx **no se puede escribir a
ciegas** — necesita ver la forma real de cada tipo de correo. Pedirle al
propietario, por cada uno de los seis eventos de la tabla de § 3.2, uno o dos
correos reales reenviados o pegados en un documento aparte (no en este
archivo, y no en un commit — ver la nota de privacidad abajo):

- **Asunto completo**, tal cual.
- **Cuerpo completo**, tal cual — sobre todo la línea o sección donde aparece
  la referencia que se pegó al crear la guía, el número de guía, el nombre de
  la transportadora y el enlace de rastreo.

**Nota de privacidad — antes de pegar cualquier correo en un documento del
repo:** tapar o reemplazar el nombre, celular y dirección de la clienta real
por un dato inventado (`Cliente de prueba`, `300 000 0000`). Lo único que
hace falta del correo es su **forma**, no los datos de una clienta real
metidos para siempre en el historial de git.

Con eso, el nodo de código de n8n queda como una tabla corta: por cada patrón
de asunto/cuerpo reconocible, qué `evento` canónico le corresponde. Si algún
correo no calza con ningún patrón conocido, n8n no adivina — cae al mismo
camino que un `400`: se registra para revisar, no se manda nada.

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
- **Banco de correos de prueba en n8n**, antes de apuntar al buzón real: los
  correos de muestra recolectados en § 5, uno por uno, confirmando que cada
  uno dispara el `evento` correcto y el WhatsApp esperado — mismo espíritu que
  el banco de conversaciones de `BOT-WHATSAPP-ARQUITECTURA.md` § 7.
- **Prueba de plantilla en Meta** con el botón de vista previa antes de
  mandarla a revisión, y una prueba real a un número propio una vez aprobada,
  antes de conectar el buzón de producción.

## 7 · Qué falta y de quién es

| Cosa | Responsabilidad | Bloquea a |
|---|---|---|
| Correos de muestra de los 6 eventos (§ 5) | Propietario | Escribir el nodo de reconocimiento en n8n |
| Acceso al buzón donde llegan los correos de Skydropx (credencial IMAP/Gmail en n8n) | Propietario | Activar el trigger |
| Clave compartida (`X-Zephora-Automation-Key`) — generarla y ponerla en Netlify env vars y en n8n como credencial Header Auth | Propietario, con ayuda de código para generarla | Que el endpoint no quede abierto |
| `netlify/functions/envio-estado.mjs` + `pruebas/envio-estado.js` | Código | — ✅ siguiente paso |
| Plantilla `actualizacion_envio` enviada y aprobada en Meta | Propietario (es quien administra la cuenta de Meta) | Que el nodo de WhatsApp pueda mandar algo |
| Workflow de n8n (nodos) | Código, una vez estén los correos de muestra | — |

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

- **`marcar()` no hace compare-and-swap.** Si dos correos de Skydropx para el
  mismo pedido llegan casi al mismo tiempo, la segunda escritura puede pisar
  el `envios` de la primera y ese evento se notificaría dos veces. No pasa en
  operación normal —los eventos de un mismo envío llegan espaciados en
  horas—, pero **sí puede pasar el primer día**, cuando el trigger de correo
  de n8n procese de una vez el historial acumulado del buzón. Mitigación sin
  tocar código: que ese workflow procese los correos **uno a la vez, en
  orden** (tamaño de lote 1), no en paralelo.
- **`celular` vuelve en formato local (`3018990672`), sin `57` delante.** La
  API de WhatsApp Business necesita el número completo (E.164). Esta spec no
  dice quién le agrega el `57` — hay que decidirlo al construir el workflow
  de n8n (lo más simple: un nodo que lo antepone antes de mandar la
  plantilla) antes de la primera prueba real, no descubrirlo ahí.
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
