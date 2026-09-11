---
name: whatsapp-n8n
description: Conectar WhatsApp Business Cloud API con n8n — bots conversacionales, webhooks, tokens y el orden exacto de montaje, con los errores reales que costaron un día entero de trabajo. Úsala siempre que aparezca WhatsApp junto a n8n, la API de WhatsApp Business, Meta Cloud API, un bot o asesora de WhatsApp, un webhook que valida pero no entrega, un trigger de n8n que no recibe mensajes, tokens que se caen de un día para otro, o cuando toque conectar un número de WhatsApp a cualquier automatización — aunque quien pregunta no nombre a n8n ni a Meta explícitamente.
---

# WhatsApp Business Cloud API + n8n

Montar esto parece un formulario de cuatro campos y no lo es. La documentación
de Meta describe cada pieza por separado y nunca dice en qué orden van, así que
uno termina con el webhook «verificado», el campo `messages` en «Suscrito», y
cero mensajes llegando. Todo se ve bien y nada funciona.

Esta skill existe para que eso no vuelva a costar un día.

## Lo primero, porque es lo que más se pierde

**Hay DOS suscripciones distintas y hacen falta las dos.** Nadie las nombra
juntas en ninguna pantalla:

1. **A nivel de app** — la URL de devolución de llamada, el token de
   verificación y el campo `messages` activado. Esto se hace en el panel de
   desarrolladores y es lo único que casi toda la documentación menciona.
2. **A nivel de WABA** (la cuenta de WhatsApp Business) — la app tiene que
   estar en la lista de *subscribed apps* de esa cuenta. Esto **solo se hace
   por API**, no hay botón en la interfaz.

Sin la número 2, Meta valida la URL sin quejarse, el botón **«Probar»** del
panel entrega el payload de ejemplo perfectamente, y **los mensajes reales
nunca salen hacia tu servidor**. Es el fallo más desconcertante de todos porque
todos los indicadores visibles dicen que está bien.

```
GET   {WABA_ID}/subscribed_apps     ← ¿está tu app en la lista?
POST  {WABA_ID}/subscribed_apps     ← ponerla ahí
```

Se corren desde **Herramientas → Explorador de la API de Graph**, con la app
seleccionada y el permiso `whatsapp_business_management`. Un `{"success": true}`
y listo.

Si en `GET` aparece algo como `WA DevX Webhook Events 1P App` y no tu app, esa
es una app interna de Meta que alimenta la consola de desarrolladores. Su
presencia no reemplaza a la tuya.

## Cuando algo no funciona, empieza por aquí

El árbol de diagnóstico ahorra horas porque parte la búsqueda en dos mitades
independientes:

**¿Apareció una ejecución en n8n?**

- **No** → el problema está del lado de Meta. En este orden:
  1. `GET {WABA_ID}/subscribed_apps` — ¿está tu app?
  2. La configuración del webhook en el panel, ¿tiene URL y token, o se quedó
     en blanco? (se borra sola más seguido de lo que uno esperaría — ver abajo)
  3. El campo `messages`, ¿dice «Suscrito»?
  4. ¿La URL guardada es la de **producción** (`/webhook/…`) y no la de prueba
     (`/webhook-test/…`)?
- **Sí, pero en rojo** → el problema está dentro del workflow. Abre la
  ejecución y mira qué nodo falló; el mensaje de error casi siempre es literal.
- **Sí, en verde, pero la clienta no recibió nada** → el nodo de envío
  respondió bien pero el número de destino no es el que crees, o el mensaje
  salió por otro número.

Ese primer sí/no es la pregunta que más rápido acorrala el problema. Todo lo
demás son detalles.

## El orden de montaje, y por qué importa

El orden no es cosmético: **n8n toca la configuración del webhook en Meta
cuando el workflow se activa, se despublica o se ejecuta en modo prueba.** Si
configuras Meta primero y después andas moviendo el workflow, te vas a
encontrar la configuración vacía sin que nada te avise.

**Deja Meta para el final.**

1. **Arma el workflow completo en n8n** — trigger, lógica, nodo de envío,
   credenciales. Que quede como va a quedar.
2. **Publícalo.** Confirma que el estado dice publicado/activo.
3. **Saca los dos valores del nodo trigger** (ver abajo, tiene trampa).
4. **Configura el webhook en Meta**: URL de producción + token de verificación
   → *Verificar y guardar*.
5. **Activa el campo `messages`** en la tabla de campos del webhook. Guardar la
   URL nueva suele resetear las suscripciones de campo, así que este paso va
   después, no antes.
6. **`POST {WABA_ID}/subscribed_apps`.**
7. **Prueba mandando un WhatsApp de verdad.** No uses el botón naranja de n8n.

Si después tienes que tocar el workflow, vuelve a comprobar los pasos 4, 5 y 6
antes de dar nada por hecho.

### Los dos valores del trigger, que no están donde uno los busca

En el nodo **WhatsApp Trigger**, panel de parámetros:

- **URL**: pestaña **Production URL** (la de POST). La pestaña **Test URL**
  (`/webhook-test/…`) solo escucha mientras tienes el editor abierto
  escuchando, y Meta la rechaza en la validación.
- **Token de verificación**: es el **id interno del nodo**, y n8n **no lo
  muestra en ninguna parte de la interfaz**. Hay que sacarlo del JSON del
  workflow (menú `⋯` → Download, campo `id` del nodo trigger) o por API. No es
  un texto que uno inventa: si escribes cualquier cosa, Meta responde *«No se
  pudo validar la URL de devolución de llamada o el token de verificación»* y
  uno se pasa media hora cambiando la URL, que estaba bien.

Es una carencia conocida del nodo, con petición abierta en el foro de n8n.

## Los identificadores, que se confunden todo el tiempo

Cuatro números largos que parecen intercambiables y no lo son. Vale la pena
anotarlos antes de empezar:

| Qué | Dónde sale | Para qué sirve |
|---|---|---|
| **App ID** | Panel de desarrolladores, arriba | Credencial del trigger, `subscriptions` |
| **WABA ID** (cuenta de WhatsApp Business) | Configuración del negocio → Cuentas de WhatsApp | `subscribed_apps`, credencial de envío |
| **Phone Number ID** | Administrador de WhatsApp → Números de teléfono | Nodo de envío. **No** es el número de teléfono |
| **App Secret** | Configuración básica de la app | Credencial del trigger. Es secreto |

Un mismo negocio suele tener **dos WABA**: la de pruebas que Meta regala y la
real. Tienen números distintos y suscripciones independientes. Suscribir una no
suscribe la otra.

## Las dos credenciales de n8n, que son de tipos distintos

| Nodo | Tipo | Campos |
|---|---|---|
| WhatsApp Trigger | `whatsAppTriggerApi` | Client ID (= App ID) + Client Secret (= App Secret) |
| WhatsApp (envío) | `whatsAppApi` | Access Token + Business Account ID (= WABA ID) |

**Recibir no usa el token de envío.** Por eso el bot puede estar recibiendo
perfectamente con la credencial de envío rota, y al revés. Cuando el botón
«Retry» de la credencial del trigger da error pero los mensajes entran igual,
ignóralo: esa prueba de conexión no refleja lo que necesita el webhook.

## El token: el de pruebas se muere solo

El token que Meta regala en *Paso 1 · Pruébalo* **caduca en menos de 24 horas**.
El síntoma es inconfundible y muy fácil de malinterpretar: **el bot funcionaba
ayer y hoy no responde nada**, sin que nadie haya tocado nada. Antes de buscar
un bug, mira si el token venció.

Para cualquier cosa que no sea la primera prueba, usa un **token de usuario del
sistema**:

Configuración del negocio → **Usuarios del sistema** → uno existente o nuevo →
**Agregar activos** (está dentro del panel del usuario, o en el menú `⋯`; el
botón «+ Agregar» de arriba crea un usuario nuevo, que no es lo que quieres) →
asignar **la cuenta de WhatsApp** con control total → **Generar token** → app
correcta, caducidad **Nunca**, permisos `whatsapp_business_messaging` y
`whatsapp_business_management`.

El token se muestra **una sola vez**. Si cierras esa ventana sin copiarlo, hay
que generar otro.

Dos cosas que se olvidan:

- El token solo puede actuar sobre los activos asignados a ese usuario. Si le
  generas el token antes de asignarle la cuenta de WhatsApp, el token existe
  pero Meta responde *«Object with ID … does not exist, cannot be loaded due to
  missing permissions»* al intentar enviar.
- Los permisos recién asignados pueden tardar en propagar. Si acabas de
  asignar el activo y sigue fallando, espera unos minutos y reintenta antes de
  desarmar nada.

## Tabla de errores reales

| Lo que ves | Lo que realmente pasa | Qué hacer |
|---|---|---|
| El botón «Probar» de Meta entrega, los mensajes reales no | La app no está en `subscribed_apps` de la WABA | `POST {WABA_ID}/subscribed_apps` |
| `The WhatsApp App ID … already has a webhook subscription` | Pulsaste **Execute workflow**; n8n intenta registrar su propia suscripción de prueba y choca con la de producción | No uses ese botón. Prueba con un WhatsApp de verdad |
| `No se pudo validar la URL de devolución de llamada o el token` | Pegaste la Test URL, o inventaste el token de verificación | Production URL + id interno del nodo trigger |
| La configuración del webhook aparece **en blanco** en Meta | n8n la borró al despublicar/reactivar o al ejecutar en modo prueba | Reconfigurar, y dejar Meta para el final |
| El bot respondía ayer, hoy no | Token de pruebas caducado (<24 h) | Token de usuario del sistema, sin caducidad |
| `Invalid access token` en la credencial de envío | Lo mismo | Lo mismo |
| `Object with ID … does not exist … missing permissions` al enviar | Al usuario del sistema le falta la cuenta de WhatsApp como activo, o los permisos aún no propagan | Asignar el activo; esperar y reintentar |
| Tres ejecuciones en rojo después de cada respuesta | Los avisos de entrega (`sent`/`delivered`/`read`) llegan por el mismo campo `messages`, con `statuses` en vez de `messages` | Ver «los avisos de entrega» abajo |
| `No prompt specified` / prompt vacío | Llegó un mensaje que no es texto: nota de voz, sticker, foto, tipo desconocido | Expresión con `?.` y un texto de reemplazo |
| `Referenced node doesn't exist` | Renombraste o recreaste un nodo; alguna expresión sigue apuntando al nombre viejo | Buscar todos los `$('Nombre viejo')` |
| `Cannot modify workflow while it is being edited` | Tienes el editor abierto en el navegador | Cerrar la pestaña |
| `Your credit balance is too low` | Es de la API de Anthropic, no de Meta | Cargar créditos en `console.anthropic.com` |

## Los avisos de entrega

Cada mensaje que **envía** el bot genera hasta tres webhooks de vuelta
(`sent`, `delivered`, `read`). Llegan por el mismo campo `messages` pero traen
la clave `statuses` en vez de `messages`, así que cualquier expresión que lea
`messages[0]` se cae y deja la ejecución en rojo.

No le llega nada raro a la clienta —ya recibió su respuesta— pero el historial
se llena de rojo y deja de servir para detectar fallos de verdad.

Dos advertencias que se pagaron caro:

- **La opción `messageStatusUpdates` del nodo trigger no los silencia.** Poner
  la lista vacía no hace nada; n8n aplica el valor por defecto igual.
- **Si filtras, hazlo con cuidado.** Un nodo Filter mal configurado bloquea
  *todos* los mensajes, incluidos los de clientas reales, y el síntoma es
  silencio absoluto. Si vas a agregarlo, **arma la condición en la interfaz de
  n8n, no escribiendo el JSON por API**: la forma exacta que espera el nodo
  Filter (`operator`, `rightValue`, tipos) es fácil de escribir mal, y el error
  `Wrong type: '' is a string but was expecting a boolean` no aparece hasta que
  llega un mensaje real.

Regla general mientras el flujo sea simple: **el ruido en el historial es
cosmético; un filtro roto es pérdida de ventas.** Ante la duda, deja el ruido.

**Esa regla se invierte en cuanto el flujo guarda estado.** Si agregas el
buffer de la sección siguiente, los avisos de estado dejan de ser cosméticos:
sin `messages`, el teléfono sale `null`, escriben `"null\nnull\nnull"` en la
tabla, y cada tanto uno sobrevive al filtro de tiempo y **le manda `null` al
modelo** — una llamada pagada para no responderle a nadie. Ahí el filtro pasa
de opcional a obligatorio.

La condición que funciona, con un IF justo después del trigger, sin depender de
operadores raros:

```
leftValue:  {{ $json.messages ? 1 : 0 }}
rightValue: {{ 1 }}
operator:   number / equals
```

Convertir la pregunta a número evita el `Wrong type: '' is a string but was
expecting a boolean` que tumba las condiciones booleanas mal armadas. Salida
`true` al flujo normal; la `false` se deja sin conectar.

## Agrupar los mensajes de una ráfaga

La gente escribe en pedazos: «hola», «tienen la letra A?», «en talla 17?».
Contestar cada uno por separado se lee robótico y, desde que Meta cobra por
token las respuestas de un agente, cuesta el triple.

Lo obvio —un nodo Wait— **empeora la cosa**: cada mensaje abre su propia
ejecución, así que salen tres esperas y tres respuestas tardías. Hace falta un
buffer compartido entre ejecuciones:

```
Trigger → Solo mensajes de clientas (IF)
        → Preparar: telefono, texto_nuevo, ts_este = ahora
        → Leer buffer anterior (Data Table, por telefono)
        → Combinar: buffer + '\n' + texto_nuevo
        → Guardar buffer (upsert: telefono, buffer, last_ts = ts_este)
        → Wait 30 s
        → Releer buffer
        → IF last_ts == mi ts_este ?  → sí: al agente, con el buffer completo
                                       → no: NoOp, esta ejecución está vieja
Agente → Responder → Limpiar buffer
```

La llave está en el segundo IF: si llegó otro mensaje durante la espera, el
`last_ts` guardado ya no es el tuyo y esta ejecución se retira en silencio.
Solo sobrevive la última, y contesta con todo junto.

Tres cosas que ahorran un rodeo:

- **`$getWorkflowStaticData` no sirve de buffer.** n8n solo lo persiste al
  terminar la ejecución, y esta duerme 30 segundos: la siguiente leería vacío y
  el filtro no filtraría nada. Tiene que ser una Data Table.
- **El nodo de leer el buffer necesita `alwaysOutputData`**, o el primer
  mensaje de una conversación nueva —cuando todavía no hay fila— corta el flujo
  antes de empezar.
- **30 segundos, no 60.** Un minuto de silencio después de «hola» se parece a
  un número muerto y la gente se va. Media un minuto alcanza de sobra: las
  ráfagas se escriben en segundos.

## Mensajes que no son texto

Alguien manda una nota de voz, un sticker o una reacción, y `messages[0].text`
no existe. Si el prompt del agente lee ese campo directamente, la ejecución
muere con `No prompt specified`.

```
{{ $json.messages[0].text?.body || '[SIN-TEXTO] tipo: ' + $json.messages[0].type }}
```

Y en el prompt del sistema, una regla que le diga qué hacer cuando ve esa
marca: pedir amablemente que lo escriban, **sin adivinar** qué pudo haber
dicho. Es la diferencia entre un bot que responde algo razonable y uno que se
inventa una conversación.

## Coexistencia: la comprobación que nadie hace y todos necesitan

Si el número ya se usaba en la app de **WhatsApp Business** —que es como
muchos negocios pequeños atienden de verdad—, conectarlo a la API puede dejar
de entregar los mensajes en esa app. **Se apaga el canal manual sin dar ningún
error.**

Después de cualquier cambio en la configuración del número, manda un WhatsApp
desde otro teléfono y confirma **las dos cosas**:

1. que responde el bot, y
2. que el mensaje **sigue apareciendo en la app de WhatsApp Business**.

La segunda es la que importa. Un bot nuevo que funciona no compensa haber
apagado el canal por donde entraba la plata.

## Arquitectura del workflow

Lo que se repite en todos los bots de venta que valen la pena:

```
WhatsApp Trigger → Agente (modelo + memoria + herramientas) → WhatsApp (envío)
```

- **La clave de la memoria es el teléfono de la clienta**
  (`$('WhatsApp Trigger').item.json.messages[0].from`), para que cada
  conversación sea independiente. Ventana de 10–15 turnos suele sobrar.
- **El modelo nunca calcula precios ni inventa existencias.** Las herramientas
  son endpoints de solo lectura del mismo servidor que ya cobra: el modelo
  conversa y decide a qué función llamar, los números salen del servidor. Un
  modelo haciendo aritmética de descuentos acierta casi siempre, y el «casi» es
  una clienta a la que se le prometió un precio y se le cobra otro.
- **Las herramientas no escriben.** Nada de crear pedidos ni apartar
  inventario desde el bot; que el enlace lleve al checkout de siempre, donde el
  precio se recalcula. Un solo sitio donde se decide cuánto se cobra.
- **El modelo:** para conversación de venta, un Sonnet rinde de sobra y cuesta
  bastante menos que un Opus. La diferencia por mensaje es de centavos, pero
  también lo es la diferencia de calidad para esta tarea.
- **Registro conversacional:** si el negocio es de un país concreto, dilo en el
  prompt. Un modelo que escribe en un español de otro país suena a plantilla
  importada y se nota.

## Trabajar con n8n por API sin romper cosas

- **La ruta de `setNodeParameter` es relativa a los parámetros del nodo.** Si
  escribes `/parameters/model/value`, no cambias nada: creas un objeto
  `parameters` anidado *dentro* de los parámetros, que n8n ignora. La operación
  responde éxito, la publicación responde éxito, y el nodo sigue igual. Va
  `/model/value` a secas. Este error se puede repetir cuatro veces seguidas
  antes de que uno lo vea, porque nada falla — simplemente no pasa nada.
- **Ante la duda, usa `updateNodeParameters` con `replace: true`** y escribe
  los parámetros completos del nodo. No depende de rutas y deja el nodo en un
  estado conocido.
- **Verifica leyendo la versión publicada, no el «éxito» de la escritura.**
  `get_workflow_version` con el `activeVersionId` que devolvió la publicación
  es la única confirmación que vale. «Guardado con éxito» solo dice que el
  servidor aceptó la petición, no que hizo lo que querías.
- **Publicar es lo que activa el cambio.** Guardar no basta.
- **El editor abierto bloquea la escritura por API** con `Cannot modify
  workflow while it is being edited by a user in the editor`. Es un error
  explícito, no silencioso: si lo ves, cierra la pestaña y reintenta.
- **Los parámetros complejos, mejor en la interfaz.** Condiciones de Filter,
  selectores de recurso y campos con lista desplegable tienen formas internas
  que es fácil escribir mal por API, y el error no aparece hasta que llega
  tráfico real. Ármalos en la interfaz y, si acaso, exporta el JSON después.
- **Renombrar un nodo rompe las expresiones que lo referencian.** Si recreas el
  trigger, revisa todos los `$('…')` del workflow antes de publicar.

## Costos, para dimensionar

- **Recibir y responder dentro de la ventana de 24 h** que abre la clienta
  cuando escribe: gratis o casi.
- **Escribir primero** (recuperación de carrito, por ejemplo) exige plantilla
  aprobada y se cobra por conversación. Ronda los USD 0,04–0,09 según el país.
- **El modelo**: unos centavos por conversación con Sonnet.
- Lo que sí cuesta caro es la **calificación de calidad** de la cuenta: mandar
  plantillas de marketing a quien no las pidió la baja, y con ella el límite de
  mensajes. El filtro de consentimiento no es burocracia, es lo que protege el
  canal.

## Este proyecto (Zephora Charms)

Valores de referencia. No son secretos —son identificadores que aparecen en el
panel y en los payloads—, pero los tokens **nunca** van aquí ni en el chat: van
en la credencial de n8n y nada más.

| Qué | Valor |
|---|---|
| App | `AGENTE CLAUDE` · `1910139459666391` |
| WABA real | `1868981540432885` |
| Número real | +57 301 899 0672 · Phone Number ID `990934840764558` |
| WABA de pruebas | `2512013739322486` |
| Número de pruebas | +1 555 669-8565 · Phone Number ID `1340581369129098` |
| Workflow | `Zephora · Asesora de WhatsApp` (`74TjEtDnn940jh9k`) |
| Usuario del sistema | `Conversions API System User` |

El mismo usuario del sistema sostiene el `Purchase` de servidor del píxel
nuevo. Si le quitas activos, apagas la medición de compras sin que nada dé
error.
