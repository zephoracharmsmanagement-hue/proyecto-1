# Avisos por WhatsApp de cada pedido y guías de Skydropx — diseño

**Fecha:** 2026-11-15 (quinta versión). **Rama:** `claude/avisos-whatsapp-diseno`.
**Estado:** la etapa 1 está **en producción en n8n** desde el 15-nov; la
etapa 2 es diseño para aprobación del propietario. No hay código de funciones
en esta rama.

Lo de n8n, WhatsApp y Skydropx sale de la investigación y del avance de la
Sesión 3 (14 y 15-nov). **Empezar por el § A:** el propietario simplificó el
alcance el 15-nov y parte de este documento quedó aparcada.

## A · Dónde estamos al 15-nov: el alcance simplificado

El propietario, a la Sesión 3: «de momento solo quiero que de alguna manera se
me avise a mi celular cuando se haga alguna compra, ya sea pagada o
contraentrega. lo de crear las guias por skydropx si me interesa».

### Etapa 1 · Aviso a su celular — EN PRODUCCIÓN desde el 15-nov, solo n8n

**No necesitó código de la tienda ni despliegue.** La tienda ya le avisa a la
hoja de inventario en el momento exacto de cada venta (`anotarVenta`), y ese
aviso trae referencia, medio de pago, total, clienta, ciudad y piezas. n8n se
cuelga de ahí.

Lo que quedó vivo (lo publicó la Sesión 3 el 15-nov, con el sí del
propietario, «Sí, llegó: publica»):

- Plantilla `pedido_nuevo_aviso` (Utilidad, 6 variables), **aprobada por Meta**
  en la cuenta real.
- Flujo «Zephora · Aviso de compra al propietario» (`VRtLgnQXj9dIiKC2`),
  publicado (versión `0baec109`). Deja pasar solo compras `ZC-` y manda la
  plantilla al celular del propietario.
- «Zephora · Hoja de Inventario» (`K1J4pHYfvd6QuAq8`), publicada con el nodo
  «Avisar compra al propietario» (versión `ec3e16f9`), que llama al flujo del
  aviso sin esperar y con el error tolerado. **Para volver atrás:** la versión
  anterior es `e5f7dcb1`.
- Contra repetidos: la tabla de datos «Avisos de compra Zephora»
  (`wTqQTkGYgjnbAnlN`) guarda cada referencia avisada; si Wompi reenvía el
  pago, no sale un segundo WhatsApp.
- Prueba: ejecución 7801 (`ZC-PRUEBA-AVISO-01`, contraentrega $61.000), que le
  llegó al propietario.

**Falta confirmar el recorrido completo con una compra real** (tienda → hoja
→ aviso). Al 15-nov, 23:30 h, no había entrado ninguna desde la publicación:
la última venta que llegó a la hoja fue del 13-nov (ejecución 6304).

**Cómo se comprueba**, con la primera compra real:

1. En n8n, «Zephora · Hoja de Inventario» tiene una ejecución nueva por webhook
   con esa referencia.
2. «Zephora · Aviso de compra al propietario» tiene una ejecución nueva (no
   manual) en verde, y esa referencia aparece en «Avisos de compra Zephora».
3. Al propietario le llegó el WhatsApp. Si no llegó y la ejecución del aviso
   está en error, la hoja igual quedó escrita: eso es lo que se buscaba con el
   error tolerado.

| | ¿Lo cubre la etapa 1? |
|---|---|
| Compras web: contraentrega al confirmar; Wompi, Addi y Sistecrédito al aprobarse | Sí |
| Ventas manuales `MAN-` | No: el flujo solo deja pasar las `ZC-` |
| Celular y dirección dentro del WhatsApp | No: siguen en el correo de tienda |
| Aviso de que el WhatsApp falló | No: con n8n caído no llegan ni la hoja ni el WhatsApp. El correo de tienda sí sale siempre |
| Recordatorio diario de lo no despachado | No (aparcado) |

Los tres cuidados que se le pasaron a la Sesión 3 antes de publicar:

1. **Avisos repetidos** (`wompi-webhook` no comprueba si el pedido ya estaba
   pagado). Resuelto con la tabla «Avisos de compra Zephora», probado con la
   misma referencia dos veces (ejecuciones 7623 y 7624).
2. **La hoja primero.** Resuelto: el nodo llama sin esperar y con el error
   tolerado.
3. **Lo que no pasa por la hoja no avisa.** Sigue igual: por eso conviene el
   paso sin código del § 0, que el correo de pedidos le suene en el celular.

### Etapa 2 · Guías de Skydropx — sí necesita código de la tienda

Está en el § 7. n8n no puede armar una guía con el aviso de la hoja, porque no
trae celular ni dirección.

### Aparcado hasta que el propietario lo pida

Mensajes a la clienta, botones de contraentrega, «Corregir datos», resumen
diario de las 8:00 a. m., botón «Ya lo despaché» y correo de respaldo. Los
§§ 2 a 6, 8 y 10 a 12 describen ese diseño completo y quedan como referencia.
Todo eso sí necesita código de la tienda.

Lo que se pierde al aparcar el resumen diario: si un día el WhatsApp tampoco
se ve, nada vuelve a recordar ese pedido.

## 0 · Qué pasó con el pedido ZC-261107-28AEB010

**El correo de tienda sí salió y sí llegó.** En Recibidos de
`zephoracharms@gmail.com` están, del 7-nov:

- «Pedido ZC-261107-28AEB010 · $240.000 · en línea · ✎ DEDICATORIA»
- «PAGADO · ZC-261107-28AEB010 · $240.000 — despachar · ✎ DEDICATORIA»
- «Transacción APROBADA en Zephora Charms» (el de Wompi)

No es un fallo de código: el aviso existió y nadie lo vio, porque ese buzón no
se revisa a diario. El arreglo es de canal. (El correo dice $240.000; el
encargo, $255.000.)

En la misma bandeja hay más pedidos pagados del 5 al 13-nov. Vale la pena
revisar que todos estén despachados.

**Mientras esto se construye, sin código:** poner en `CORREO_TIENDA` (Netlify)
un buzón que el propietario sí lea, o reenviar desde Gmail los correos con
asunto «PAGADO» y «CONTRAENTREGA» a su correo personal.

## 1 · Lo que ya existe y se reutiliza

| Pieza | Qué aporta | Qué le falta |
|---|---|---|
| `_hoja.mjs` → `anotarVenta()` | El momento exacto de «venta confirmada» en los tres caminos | No lleva celular ni dirección |
| `_correo.js` → `textoTienda()` | La hoja de despacho en texto plano | — (es el contenido del aviso) |
| `_pedidos.mjs` | El pedido completo por referencia (`leer`, `marcar`, `listar`) | No tiene ningún campo de «despachado» |
| `envio-estado.mjs` + `_envios.mjs` | Avisos de estado de envío, con clave y anti-duplicados | Sin activar |
| Flujo n8n `ze4dI8GW96yfKGyd` | Estados de Skydropx → plantilla `actualizacion_envio` | Sin publicar; nunca recibió un evento real; su aviso a la tienda usa un correo que n8n no puede enviar |
| Tabla n8n «Guías Zephora» | Relación guía → referencia | Se llena a mano |
| Bot `74TjEtDnn940jh9k` | La marca `humano_hasta`, que lo calla 12 h en un chat | No lee los botones de plantilla |
| `rescate.mjs`, `posventa.mjs` | El patrón de función diaria | — |

Los tres puntos de disparo, que son los mismos de la hoja:

1. **Contraentrega:** `crear-pago.mjs`, bloque `pedido.pago === 'contraentrega'`, después de `anotarVenta`.
2. **Pago en línea, Addi y Sistecrédito:** `_cierre.mjs` → `cerrarPago()`, rama aprobada. Nunca antes de la aprobación.
3. **Venta manual `MAN-`:** `registrar-venta.mjs`, después de `anotarVenta`.

## 2 · Reparto: qué hace la tienda y qué hace n8n

**El repo decide cuándo, a quién y con qué texto; n8n hace la plomería con
Meta y Skydropx.** Es la regla de la spec del 18-sep.

```
Venta confirmada (3 caminos)
   ↓
[Netlify · _avisos.mjs · avisarPedido()]
   arma las variables, normaliza el celular, anota el intento
   ↓  POST a AVISOS_WEBHOOK (cabecera X-Zephora-Token, espera 4 s)
[n8n · «Zephora · Avisos de pedido»]  responde 200 al recibir y luego trabaja
   1. plantilla al PROPIETARIO     ← primero, no espera a nada
   2. plantilla a la CLIENTA       ← fase 2
   3. orden + tarifas de Skydropx  ← fase 3
   y por cada envío, bien o mal: POST a /pedido-aviso (resultado)

Sin respuesta de n8n en 4 s → la tienda manda el correo de respaldo
```

**Netlify (código, en este repo):**

| Archivo | Qué hace | Fase |
|---|---|---|
| `_avisos.mjs` (nuevo) | `avisarPedido()`: arma y manda el aviso. Nunca lanza | 1 |
| `despachado.mjs` (nuevo) | La página del botón «Ya lo despaché» | 1 |
| `resumen-despachos.mjs` (nuevo, diario) | El resumen de las 8:00 a. m. | 1 |
| `pedido-aviso.mjs` (nuevo, con clave) | n8n deja aquí el resultado de cada envío y las respuestas de los botones | 1 (resultado) · 2 (botones) |
| `crear-pago.mjs`, `_cierre.mjs`, `registrar-venta.mjs` | Una llamada a `avisarPedido()` en cada uno | 1 |
| `envio-estado.mjs` | Al primer evento de la guía marca `despachadoEn` | 3 |

**n8n (lo construye la Sesión 3 cuando se apruebe):**

- Flujo nuevo «Zephora · Avisos de pedido», aparte del de la hoja.
- Flujo nuevo «Zephora · Botones de pedido», sin disparador propio.
- Un solo nodo nuevo dentro del bot (fase 2).
- Flujo «Zephora · Vigía» para los errores: hoy ningún flujo de Zephora lo tiene.
- **Nunca un segundo disparador de WhatsApp:** reescribe el webhook de la app
  y el bot deja de recibir, sin error. Los flujos nuevos solo envían.

## 3 · Qué datos viajan

Un solo POST por venta:

```json
{
  "evento": "pago_aprobado | contraentrega_confirmada | venta_manual",
  "referencia": "ZC-261107-28AEB010",
  "cuando": "2026-11-07T15:02:11Z",
  "propietario": { "para": "57…", "plantilla": "pedido_nuevo_tienda", "variables": ["…"],
                   "enlaceDespachado": "ZC-….firma", "detalle": null },
  "clienta":     { "para": "57…", "plantilla": "pedido_confirmado", "variables": ["…"],
                   "botones": { "ok": "ZC_OK:ZC-…", "corregir": "ZC_CORREGIR:ZC-…" } },
  "envio": { "crearOrden": true, "pagado": true, "total": 240000,
             "destino": { "nombre": "…", "celular": "…", "correo": "…", "direccion": "…",
                          "adicional": "…", "barrio": "…", "ciudad": "…", "depto": "…" },
             "paquete": { "peso": 1, "largo": 19, "ancho": 19, "alto": 5, "contenido": "…", "declarado": 0 } }
}
```

- **Celular y dirección sí viajan** (la hoja no los lleva). Salen del pedido
  guardado, igual que en el correo de tienda.
- **El número del propietario** sale de `WHATSAPP_PROPIETARIO`. El bot ya tiene
  escrito un número en dos nodos; debe quedar en un solo sitio.
- **Celular de la clienta:** el checkout exige 10 dígitos que empiecen por 3;
  se le antepone 57. En ventas manuales el teléfono es texto libre: se acepta
  `3XXXXXXXXX` o `573XXXXXXXXX`. Si no es válido, `clienta.para` va vacío y el
  aviso al propietario lo dice.
- **Las variables las arma el repo.** Cada una es una sola línea, sin
  tabulaciones, y lo que falte va como «—». Cada una tiene su tope (§ 4).
- **La dedicatoria nunca se recorta:** se escribe a mano tal cual. Si la
  dedicatoria, las indicaciones o las piezas no caben, esa variable dice
  «sigue en el mensaje siguiente» y sale además `pedido_nuevo_detalle`.
- **`clienta` solo va si el pedido tiene la marca de aceptación** del § 10.
  Una venta manual no la tiene: a esa clienta no se le escribe.
- **Datos personales en n8n:** el flujo de avisos no guarda las ejecuciones
  correctas, solo las fallidas. Zona horaria `America/Bogota`.

## 4 · Las plantillas

**Para la etapa 1 se usa `pedido_nuevo_aviso`** (6 variables, ya en revisión
en Meta), no `pedido_nuevo_tienda`. Las de abajo son las del diseño completo,
y `actualizacion_envio` todavía no existe en la cuenta real.

Ocho, todas de categoría **Utilidad** e idioma **Español (`es`)**. Las somete
el propietario con el perfil «Martin Daza» en el Administrador de WhatsApp del
portafolio viejo → Plantillas de mensajes. Meta tarda hasta 24 horas. Los
ejemplos de cada variable (obligatorios al someter) están en el § 14.

| Plantilla | Para quién | Fase |
|---|---|---|
| `pedido_nuevo_tienda` | Propietario | 1 |
| `pedido_nuevo_detalle` | Propietario, solo si no cabe | 1 |
| `pendientes_despacho` | Propietario, 8:00 a. m. | 1 |
| `pedido_confirmado` | Clienta, pago aprobado | 2 |
| `pedido_contraentrega` | Clienta, contraentrega | 2 |
| `pedido_corregir_datos` | Propietario | 2 |
| `tarifas_envio` | Propietario | 3 |
| `actualizacion_envio` | Clienta (ya aprobada desde el 18-sep) | 3 |

**`pedido_nuevo_tienda`** — la hoja de despacho de `textoTienda()`:

```
Pedido nuevo {{1}} · {{2}} · Total {{3}}

Empacar: {{4}}

Para: {{5}} · Cel. {{6}}
Dirección: {{7}}
Barrio: {{8}}
Ciudad: {{9}}
Indicaciones: {{10}}
Dedicatoria (va a mano): {{11}}

Revisa el pedido y despáchalo hoy.
```

`{{2}}` es «PAGADO en línea», «ADDI aprobado», «SISTECRÉDITO aprobado» o
«CONTRAENTREGA: COBRAR $135.000». Botón de **enlace** «Ya lo despaché» (§ 5).
Si Meta la rechaza por tener 11 variables, se unen barrio con dirección y
total con estado.

**`pedido_nuevo_detalle`:**

```
Continuación del pedido {{1}}.

Piezas que faltaban: {{2}}
Indicaciones completas: {{3}}
Dedicatoria completa (va escrita a mano): {{4}}

Fin del pedido.
```

**`pendientes_despacho`:**

```
Buenos días. Pedidos confirmados sin despachar hace más de 24 horas: {{1}}

{{2}}

Contraentregas sin confirmar: {{3}}
Avisos que no salieron: {{4}}

Revísalos hoy.
```

**`pedido_confirmado`** (el texto del propietario, sin cambios):

```
¡Hola {{1}}! ✨ Gracias por tu compra en Zephora Charms 💖 Tu pedido {{2}} ya está confirmado y en preparación. En cuanto lo despachemos te enviamos la guía por este mismo chat ✨
```

**`pedido_contraentrega`**, con botones de respuesta rápida **[Sí, todo está
bien]** y **[Corregir datos]**:

```
¡Hola {{1}}! ✨ Gracias por tu compra en Zephora Charms 💖 Tu pedido {{2}} ya está confirmado y en preparación. Para despacharlo, confirma por favor tus datos: {{3}}, {{4}}. Pagarás {{5}} al recibir (incluye el envío contraentrega). En cuanto lo despachemos te enviamos la guía por este mismo chat ✨
```

El barrio va dentro de `{{3}}`, para que una clienta sin barrio no lea «…, —,
Bogotá». Sugerencia: «ya está **registrado**» en vez de «confirmado», porque
la misma frase le pide confirmar (pregunta 9).

**`pedido_corregir_datos`:**

```
La clienta {{1}} quiere corregir los datos del pedido {{2}}. Su celular es {{3}}. Escríbele por WhatsApp y ajusta la dirección antes de despachar.
```

**`tarifas_envio`**, con botón de enlace «Abrir Skydropx»:

```
Orden lista en Skydropx para el pedido {{1}} ({{2}}).

Tarifas de hoy: {{3}}

Valor a recaudar: {{4}}

Entra a Skydropx, abre Preparar órdenes, elige la transportadora y paga la guía.
```

## 5 · El botón «Ya lo despaché»: enlace, no respuesta rápida

**Decisión de diseño: botón de enlace.** Una respuesta rápida entra por el
único webhook del número, que es el del bot, y obligaría a tocar el bot desde
la primera fase. Con enlace, la fase 1 no toca el bot. Se decide antes de
someter la plantilla, porque el tipo de botón no se cambia después.

- La dirección es `https://zephoracharms.com/despachado/<referencia>.<firma>`.
  La firma la genera la tienda con `AVISOS_KEY`; sin ella la página no abre.
- **Abrir el enlace no marca nada.** Muestra la referencia, el nombre y la
  ciudad, y un botón «Sí, ya lo despaché». Solo ese botón marca el pedido.
  Así una vista previa del enlace no lo da por despachado.
- Tocarlo dos veces no cambia nada.
- Si el propietario prefiere la respuesta rápida (pregunta 3): el código sería
  `ZC_DESP:<ref>` y la fase 1 pasaría a incluir el cambio del § 6 en el bot,
  con sus condiciones.

## 6 · Los botones de la contraentrega y el bot (fase 2)

**Qué llega.** Al tocar un botón de plantilla llega un mensaje de tipo
`button` con el código que se puso al enviar: `ZC_OK:<ref>` o
`ZC_CORREGIR:<ref>`. Hoy el bot no lo lee: lo trata como una nota de voz.

**Dónde se ataja.** Un solo nodo nuevo en el bot, justo después de «Solo
mensajes de clientas» y antes del buffer, de la espera de 30 s y de «Atiende
un humano?»:

```
«Solo mensajes de clientas»
        ↓
NUEVO «Es boton de pedido?»   (tipo button y código que empieza por ZC_)
   ├─ sí → flujo «Zephora · Botones de pedido»
   └─ no → «Es imagen?»  (todo lo de hoy, igual)
```

| Botón | Qué pasa |
|---|---|
| «Sí, todo está bien» | `/pedido-aviso` (confirmar) → el pedido queda con `datosConfirmadosEn` → se le responde «¡Listo! Ya estamos preparando tu pedido 💖» → arranca Skydropx (fase 3) |
| «Corregir datos» | `/pedido-aviso` (corregir) → `datosPorCorregir` → se le pide que cuente qué dato corregir → **el bot se calla 12 h en ese chat** (`humano_hasta`) → al propietario le llega `pedido_corregir_datos` |

- **`/pedido-aviso` comprueba quién tocó:** tiene que ser el celular de ese
  pedido. Un código con la referencia de otra persona no hace nada.
- Un botón tocado dos veces no se responde otra vez.
- Las respuestas a la clienta son texto libre: ella acaba de escribir, la
  ventana de 24 h está abierta y no cuestan.
- **Corrige una persona.** El propietario lee el chat en la app de WhatsApp
  Business, responde ahí y ajusta la dirección al completar la orden en
  Skydropx. En esta versión la dirección guardada en la tienda queda con la
  vieja y una nota. Una página para corregirla en la tienda queda para después.
- **Sin respuesta:** el pedido sale en el resumen de las 8:00 a. m. como
  «contraentrega sin confirmar».

**Condiciones para tocar el bot** (son de la Sesión 3):

- Publicar el bot puede alterar el webhook en Meta, y para repararlo hay que
  entrar a la app `AGENTE CLAUDE`. Por eso antes hace falta el **registro de
  desarrollador** del propietario (o tener a mano el perfil «Zephora Charms 1»).
- Se publica en una hora tranquila, con el propietario presente, y se prueba
  con un WhatsApp real.
- `BH · 4 WhatsApp entrante` sigue con la credencial de disparo de Zephora: si
  alguien lo publica así, se lleva el webhook. Le toca a Bendito Hogar.

## 7 · Skydropx (etapa 2)

**Lo que dijo el propietario el 15-nov:** todo sale por Skydropx, también la
contraentrega con su recaudo; la contraentrega va con Coordinadora y lo pagado
con Inter Rapidísimo; y acepta que la guía se cree sola cuando las reglas
estén claras.

### 7.1 · Lo que necesita de la tienda

El aviso de la hoja no trae celular ni dirección, y no debe traerlos: es un
espejo de inventario y ese flujo guarda sus ejecuciones. La propuesta más
pequeña:

- **`pedido-envio.mjs` (nuevo, con clave).** n8n recibe la referencia por el
  aviso de la hoja y le pide a la tienda los datos del envío. Es el patrón de
  `envio-estado`. Responde el destino, el paquete y las reglas ya resueltas:
  valor declarado, si lleva recaudo y si lleva protección. Los números los
  pone el repo, no n8n.
- **El mismo endpoint guarda** en el pedido el id de la orden y de la guía.
  Con eso el pedido queda marcado como despachado.
- **No se toca el camino del cobro:** `crear-pago` y `_cierre` no cambian.
- Solo entrega datos de un pedido confirmado. Uno pendiente de pago, anulado o
  de prueba responde que no. Una venta manual sin dirección lo dice.
- Variable nueva: `PEDIDO_ENVIO_KEY`. Funciones: 38 → 39.
- Pruebas (`pruebas/pedido-envio.js`): sin clave, 401; referencia inexistente,
  404; todo dato de entrega que escribió la clienta viaja; el valor declarado
  sale según el medio de pago; un pedido sin confirmar no entrega nada.

**Contrato de la respuesta** (lista de la Sesión 3 del 15-nov, contrastada con
`POST /api/v1/orders` de Colombia y con lo que hoy pide `checkout.html`):

| Campo | De dónde sale hoy |
|---|---|
| `referencia`, `estado` (confirmado / pendiente / anulado / prueba), `pago` (`wompi` / `contraentrega` / `addi` / `sistecredito` / `manual`), `total` | El pedido guardado (`_pedidos.mjs`) |
| `nombre` (nombre + apellido), `celular` (10 dígitos), `correo` | Checkout; los tres son obligatorios |
| `direccion`, `detalles` (= `adicional`), `barrio`, `ciudad`, `departamento` | Checkout; `barrio` y `adicional` son opcionales |
| `indicaciones` | `notas` del checkout (hasta 400 caracteres) |
| `codigo_postal` | **El checkout no lo pide.** Ver abajo |
| `piezas` (nombre, cantidad, precio) | El pedido; van como `products` de la orden |
| `declarado`, `recaudo`, `proteccion` | Reglas del repo: 46000 si es pagado; en contraentrega `declarado` va vacío y lo calcula n8n después de cotizar, porque depende del flete |
| `direccion_confirmada` | Nuevo campo del pedido, `false` por defecto. Hoy nadie lo marca, así que la contraentrega queda a mano |

El mismo endpoint, con `POST`, guarda `skydropx_orden_id` y
`skydropx_guia_id` en el pedido (`marcar()` de `_pedidos.mjs`).

**Indicaciones:** Skydropx imprime 70 caracteres. La respuesta trae el texto
completo y un `indicaciones_cortas` de hasta 70. Si la clienta escribió más,
también trae `indicaciones_recortadas: true`, y la guía no se compra sola: el
propietario ve el texto entero en el correo de tienda.

**Código postal, el punto delicado.** Skydropx Colombia cotiza por código
postal, y el checkout no lo pide. Pedírselo a la clienta es un campo más
donde se cae la compra: casi nadie se lo sabe. Por eso la propuesta es una
tabla del repo, `assets/codigos-postales.json`, con el código principal de
cada uno de los 314 municipios que ya ofrece `assets/colombia.json`, sacado del
listado oficial de 4-72. `pedido-envio` responde ese código y
`codigo_postal_origen: "municipio"`. Si la clienta eligió «Otro municipio»
escrito a mano, responde `codigo_postal: null` y la guía no se compra sola.
**Falta comprobar** (Sesión 3, con una cotización de solo lectura) que
Skydropx da la misma tarifa con el código principal del municipio que con el
del barrio exacto, al menos en Bogotá, Medellín y una ciudad intermedia. Si
la tarifa cambia, el paso B solo compra sola cuando el código salga del barrio,
y lo demás queda en el paso A.

La alternativa es que la tienda empuje los datos (`_avisos.mjs`, § 2). Queda
para cuando se retomen los mensajes a la clienta.

### 7.2 · Paso A: orden precargada; el propietario elige y paga

- `POST /api/v1/orders` deja la orden en «Preparar órdenes» con la referencia
  `ZC-…`. No compra nada.
- `POST /api/v1/quotations`, atada a la orden, trae las tarifas. Al
  propietario le llega `tarifas_envio` con la transportadora habitual primero
  y, al lado, la más barata con la diferencia en pesos.
- En este paso el flujo **nunca** llama a las cuatro rutas que compran la
  guía (`/api/v1/shipments`, `/api/v2/shipments`, `/api/v1/rate/shipments`,
  `/api/v2/rate/shipments`).
- La contraentrega también se precarga: él confirma la dirección con la
  clienta, como hoy, antes de pagar la guía.

### 7.3 · Paso B: la guía se crea sola, con sus reglas

Reglas dichas por el propietario el 15-nov:

| Regla | Valor |
|---|---|
| Transportadora habitual | Contraentrega → Coordinadora · pagado → Inter Rapidísimo |
| Cambiar de transportadora | Solo si la otra sale $5.000 o más barata |
| Valor declarado, pedido pagado | $46.000 |
| Contraentrega | «Contra entrega» encendido e «Incluir costo del envío» marcado |
| Valor declarado, contraentrega | El que haga que declarado + flete quede igual o un poco por debajo del total del checkout |
| Protección Plus | Solo en contraentrega. **Hoy el panel la tiene en «Automáticamente para todos los envíos»** (lo vio la Sesión 3 el 15-nov): hay que pasarla a «Tomando la decisión en cada envío», o se cobra también en los pagados |
| Tope de precio por guía | $25.000. Por encima no se compra sola |
| Indicaciones de entrega | Van en «Detalles de la dirección» o en «Referencia» |
| Saldo | Siempre habrá |

Cálculo de la contraentrega, con su ejemplo: total del checkout $61.000 y
flete $13.825 → declara $47.000 → recauda $60.825. Para automatizarlo: se
cotiza, se pone declarado = total − flete redondeado hacia abajo, se vuelve a
cotizar y se sigue solo si el recaudo no pasa del total. **Nunca se le cobra a
la clienta más de lo que vio en el checkout.**

**Cuándo NO se compra sola** y le llega el aviso para decidir:

- El flete pasa de $25.000.
- La ciudad es un «Otro municipio» escrito a mano, o no hay código postal.
- Las indicaciones de entrega pasan de 70 caracteres.
- La transportadora habitual no cotiza.
- El recaudo calculado pasa del total.
- Es una contraentrega: se compra sola solo cuando conste que la dirección
  quedó confirmada. Hoy esa confirmación es a mano, así que al principio el
  paso B aplica solo a pedidos pagados.

Después de comprar, n8n revisa si Skydropx rechazó la Protección Plus y, si la
rechazó, le avisa.

### 7.4 · Verificaciones previas

Revisadas por la Sesión 3 en el panel el 15-nov, solo leyendo:

- **Automatización «Crear guía automática»: no hay ninguna.** ✓
- **Credencial de la API:** «Public API · Producción», vigente y sin
  vencimiento; el panel abre en `pro.skydropx.com`. ✓ En n8n existe «Skydropx
  API»; falta una llamada de solo lectura que confirme que es esa y que
  responde.
- **Dirección de origen:** «Autoenvio Fontibon», predeterminada y activa, con
  sucursal de Inter 225905. ✓
- **Paquete:** «paquete habitual» de 19 × 19 × 5 cm y 1 kg, contenido
  «brazalete». ✓
- **Protección Plus en automático para todos los envíos** ✗: choca con la
  regla del propietario (§ 7.3).
- **El webhook «Zephora envio-estado» de Skydropx marca «Falla de
  notificación»**, porque el flujo `ze4dI8GW96yfKGyd` está apagado desde
  septiembre. No hace daño; se decide si se borra o se reactiva cuando se
  retomen los avisos a la clienta.
- **`actualizacion_envio` solo existe en la cuenta de prueba de WhatsApp.**
  Para avisarle a la clienta el estado del envío hay que crearla en la real.
  Esos avisos son mensajes a clientas: dependen del texto de aceptación del
  § 10.
- Un envío real de prueba, para confirmar que la guía queda atada a la orden.

### 7.5 · Decisión abierta: joyas y contraentrega

Las condiciones de contraentrega de Skydropx excluyen «Metales como oro,
plata, platino» y «Dinero, joyas y elementos lujosos». Hoy le funciona, pero
si un paquete se pierde o lo retienen, esas condiciones pueden dejarlo sin
reclamo. Es decisión del propietario.

## 8 · Red de seguridad

**Fallar hacia adelante.** `avisarPedido()` nunca lanza y espera 4 segundos
como máximo. Sin `AVISOS_WEBHOOK` no manda nada y la tienda vende igual.

**Nunca en silencio.**

- Cada intento deja una línea en el log y un campo `avisos` en el pedido.
- **n8n no responde en 4 s:** la tienda manda en el acto un correo «⚠ NO SALIÓ
  EL WHATSAPP · {ref}» con la hoja de despacho, a `CORREO_TIENDA` y a
  `CORREO_ALERTAS`. El respaldo lo manda la tienda porque n8n no tiene
  credencial de correo.
- **n8n recibe pero Meta rechaza:** n8n lo reporta a `/pedido-aviso` y escribe
  una fila en la pestaña «Avisos fallidos» de la hoja.
- **Meta acepta y falla después** (número sin WhatsApp): ese fallo llega al
  bot. En la fase 2 su rama de fallos lo reporta también a `/pedido-aviso`.
- **Skydropx no responde:** el pedido ya quedó avisado. Tras dos reintentos se
  reporta, y el propietario arma la guía a mano.
- **No se repite:** el pedido recuerda que ya se avisó, y n8n lleva la tabla
  «Avisos Zephora» (`referencia|evento|destino`).
- El correo de tienda de hoy **se mantiene** tal cual.

**Resumen diario, 8:00 a. m.** (`resumen-despachos.mjs`, `0 13 * * *` UTC). Lo
arma la tienda: pedidos confirmados sin `despachadoEn` y con más de 24 horas,
con referencia, nombre, ciudad, total y días; aparte, las contraentregas sin
confirmar y los avisos que no salieron. Va por WhatsApp y **también por
correo**, para no depender de WhatsApp ni de n8n. Es lo que habría mostrado el
pedido de Yuly el 8-nov.

Un pedido pasa a «despachado» cuando el propietario toca «Ya lo despaché» o
cuando Skydropx reporta el primer evento de su guía. Solo cuentan los pedidos
desde `AVISOS_DESDE`, para no listar todo el historial el primer día.

## 9 · Costo

**Etapa 1:** una plantilla por compra, unos $3. Con 30 a 40 pedidos al mes,
entre $90 y $120 al mes. Lo de abajo es el costo del diseño completo.

Tarifas de Meta para Colombia, leídas el 14-nov-2026: **$2,95 por plantilla de
utilidad** (USD 0,0008). Marketing cuesta $46,02.

| Caso | Mensajes pagos | Costo |
|---|---|---|
| Pedido pagado en línea | 2, o 3 con tarifas | $6 a $9 |
| Pedido contraentrega | 3, o 4 si pide corregir | $9 a $12 |
| Avisos de estado del envío | hasta 6 más | hasta $18 |
| Resumen diario | 1 al día | unos $90 al mes |

**Con 30 a 40 pedidos al mes: entre $450 y $1.150 al mes.** Las respuestas de
texto libre a los botones caben en los 1.000 mensajes gratis del número. Si
Meta clasificara como marketing las plantillas del propietario, serían unos
$3.200 más al mes; se sabe al someterlas.

**Lo que sí puede frenar todo es el medio de pago de la cuenta de WhatsApp:**
las plantillas se cobran una por una y hasta hoy el número casi solo envía
respuestas gratis del bot.

## 10 · Permiso de la clienta, privacidad y checkout

**Dejar el celular no basta.** La política de WhatsApp Business exige que la
persona haya aceptado recibir mensajes del negocio, nombrándolo, y no hay
excepción para los mensajes de utilidad. La política de privacidad y el
checkout ya mencionan el WhatsApp, pero como aviso, no como aceptación.

**Textos propuestos** (reemplazan los de la primera versión):

- Checkout, bajo el campo del celular: «Al hacer tu pedido aceptas que Zephora
  Charms te escriba por WhatsApp a este número para confirmarlo y avisarte del
  envío.»
- Checkout, nota de contraentrega: «Pagas en efectivo al mensajero. Antes de
  despachar, Zephora Charms te escribe por WhatsApp para confirmar tu
  dirección.»
- Política (`gen_paginas.py`), en «Gestionar tu pedido»: «Al hacer un pedido
  aceptas que Zephora Charms te escriba por WhatsApp al celular que nos dejas:
  la confirmación del pedido y de tus datos de entrega, y los avisos del
  envío. Son mensajes sobre tu compra, no publicidad.»
- Política, en transportadoras: agregar «y Skydropx, la plataforma con la que
  generamos las guías».

**Cómo se respeta en el código:** el pedido que se crea con ese texto ya
publicado queda con una marca de aceptación. `avisarPedido()` solo le escribe
a la clienta si el pedido la tiene. Así no se le escribe a quien compró antes
del cambio ni a una venta manual. Es independiente de la casilla de novedades
(`optin`), que es para publicidad.

## 11 · Variables nuevas

| Variable (Netlify) | Para qué |
|---|---|
| `AVISOS_WEBHOOK` | URL del flujo de n8n. Sin ella, nada sale |
| `AVISOS_TOKEN` | Cabecera `X-Zephora-Token` hacia n8n |
| `AVISOS_KEY` | Clave con que n8n llama a `/pedido-aviso` y con que se firma el enlace de despacho |
| `WHATSAPP_PROPIETARIO` | Número del propietario, `57XXXXXXXXXX` |
| `CORREO_ALERTAS` | Buzón de respaldo que el propietario sí lea |
| `AVISOS_DESDE` | Fecha desde la que cuenta el resumen diario |
| `AVISOS_CLIENTAS` | Interruptor de la fase 2: mensajes a clientas solo con `on` |
| `AVISOS_SKYDROPX` | Interruptor de la fase 3: orden y tarifas solo con `on` |

En n8n faltan dos credenciales de cabecera, que crea el propietario: la del
webhook de entrada (`AVISOS_TOKEN`) y la de `/pedido-aviso` (`AVISOS_KEY`). Las
de WhatsApp y Skydropx ya existen. Las medidas del paquete no son secretas:
van en el código.

## 12 · Pruebas que se escribirían

`pruebas/avisos.js`, `pedido-aviso.js`, `despachado.js` y
`resumen-despachos.js`, al estilo de `hoja.js` y `envio-estado.js`, sumadas a
`correr.sh`:

- Se avisa una vez en cada camino, y **no** con pago pendiente o rechazado.
- Un reintento de la pasarela no manda un segundo aviso.
- **Todo dato que la clienta escribió viaja:** los campos salen de lo que
  acepta `crear-pago`, como en `correo-tienda.js`, sin nombrarlos a mano.
- Contraentrega dice «COBRAR $total»; pago aprobado dice «PAGADO».
- Celular a `57XXXXXXXXXX`; uno inválido deja a la clienta sin mensaje y lo
  dice en el aviso al propietario.
- Ninguna variable trae salto de línea ni va vacía, y ninguna pasa su tope.
- La dedicatoria larga no se recorta: sale `pedido_nuevo_detalle`.
- Sin la marca de aceptación no hay mensaje a la clienta; una `MAN-` tampoco.
- n8n caído, lento o con error: la venta termina bien, queda la línea en el
  log y sale el correo de respaldo.
- Sin `AVISOS_WEBHOOK` no se manda nada. Sin `AVISOS_CLIENTAS=on` solo sale el
  aviso del propietario. Sin `AVISOS_SKYDROPX=on` no se pide orden.
- `/pedido-aviso`: 401 sin clave; confirmar y corregir solo si quien tocó es
  el celular del pedido; repetir no cambia nada; referencia inexistente, 404.
- `/despachado`: sin firma válida no abre; abrir no marca; confirmar marca una
  sola vez.
- Resumen: lista lo de más de 24 h sin despachar; deja fuera lo despachado, lo
  anulado, las pruebas y lo anterior a `AVISOS_DESDE`.
- `ESTADO.md` § Al desplegar: 38 → 42 funciones.

## 13 · Lo que no se pudo confirmar

| Dato | Cómo se confirma |
|---|---|
| Que una variable no admita saltos de línea, y su largo máximo | Con la primera prueba de envío |
| Que Meta acepte 11 variables en `pedido_nuevo_tienda` | Al someterla |
| Que Meta acepte como utilidad un resumen al número del propietario | Al someter `pendientes_despacho` |
| Que el medio de pago sea obligatorio para plantillas | En la configuración de pagos de la cuenta de WhatsApp |
| Que el nodo de WhatsApp de n8n admita el código del botón | Al construir; el plan B es un nodo HTTP |
| Servidor de la API de Skydropx y vigencia de su credencial | Una llamada de prueba |
| Formato del código postal en la cotización | Ambiente de pruebas de Skydropx |
| Que el envío conserve la relación con la orden al terminarlo en el panel | Un envío real de prueba; de esto depende el aviso de estado |
| Contraentrega por API, comisiones y la exclusión de joyas | El propietario y soporte de Skydropx |
| Webhooks de Skydropx activos en la cuenta | Conexiones → Webhooks |

## 14 · Ejemplos para someter las plantillas

| Plantilla | Variables, en orden |
|---|---|
| `pedido_nuevo_tienda` | `ZC-261107-28AEB010` · `PAGADO en línea` · `$240.000` · `Torre Eiffel y Cámara · Groot Bebé · Clip Infinito con Corazón` · `Yuly González` · `3001234567` · `Cra 12 # 34-56, apto 301` · `Cañaveral` · `Floridablanca, Santander` · `Dejar en portería` · `Para mi mamá, con todo mi amor` |
| `pedido_nuevo_detalle` | `ZC-261107-28AEB010` · `Letra V · Sol y Luna con Cristales` · `Entregar en el local 12 del centro comercial, preguntar por Marta` · `Feliz cumpleaños, mi amor. Que cada dije te recuerde un momento nuestro.` |
| `pendientes_despacho` | `2` · `ZC-261107-28AEB010 · Yuly González · Floridablanca · $240.000 · 8 días` · `ZC-261110-DC8E9386` · `ninguno` |
| `pedido_confirmado` | `Valentina` · `ZC-261112-E8029B81` |
| `pedido_contraentrega` | `Kaleth` · `ZC-261110-DC8E9386` · `Calle 45 # 12-30, apto 502, barrio Chapinero` · `Bogotá D.C.` · `$135.000` |
| `pedido_corregir_datos` | `Kaleth Abril` · `ZC-261110-DC8E9386` · `3001234567` |
| `tarifas_envio` | `ZC-261112-B19F5179` · `Bogotá D.C.` · `Inter Rapidísimo $8.806 (2 días) · Coordinadora $11.200 (3 días)` · `no aplica, ya está pagado` |

Topes por variable de `pedido_nuevo_tienda`: referencia 20, cobro 45, total 9,
piezas 330, nombre 45, celular 12, dirección 110, barrio 40, ciudad 45,
indicaciones 90, dedicatoria 90. Con todo al tope, el cuerpo queda apenas por
debajo de los 1024 caracteres de Meta.

## 15 · Etapas

1. **Aviso al celular del propietario por cada compra.** En producción desde
   el 15-nov, solo n8n, sin código de la tienda y sin despliegue. Falta que
   la primera compra real confirme el recorrido completo.
2. **Skydropx, paso A:** orden precargada y tarifas. Código de la tienda
   (`pedido-envio`) y flujo de n8n.
3. **Skydropx, paso B:** la guía se crea sola con las reglas del § 7.3,
   primero solo en pedidos pagados.
4. **Aparcado:** mensajes a la clienta, botones, resumen diario, botón de
   despacho y correo de respaldo.

Nada de la tienda se despliega sin el «deploy» del propietario, y ningún
flujo que escriba a clientas se activa sin su aprobación.

## 16 · Lo que falta del propietario

**Etapa 1 (su aviso, ya en producción)**

1. Con la primera compra real: decir si le llegó el WhatsApp.
2. Hacer «Verificar cuenta» en la facturación de WhatsApp, que Meta lo pide.
3. Sin construir nada: que el correo de pedidos le suene en el celular, para
   lo que no pasa por la hoja.
4. Revisar que los pedidos pagados del 5 al 13-nov estén despachados.
5. ¿Quiere que las ventas manuales `MAN-` también le avisen?

**Etapa 2 (Skydropx)**

6. Aprobar la etapa 2 y su orden: primero la orden precargada, después la
   guía sola, al principio solo en pedidos pagados. Lleva código de la
   tienda (`pedido-envio` y la tabla de códigos postales) y su «deploy».
7. Confirmar el redondeo del valor declarado en contraentrega (a miles hacia
   abajo, como en su ejemplo de $47.000).
8. Protección Plus: aprobar pasarla a «Tomando la decisión en cada envío»
   (hoy está en automático para todos).
9. Aprobar el texto de `tarifas_envio`, la plantilla que le avisa las
   tarifas en el paso A.
10. Decidir sobre la exclusión de joyas en la contraentrega (§ 7.5).
11. Si quiere avisos de estado del envío a la clienta: crear
    `actualizacion_envio` en la cuenta real y aprobar el texto de aceptación
    del § 10.

Ya resuelto con la Sesión 3: la plantilla aprobada, la prueba en su celular,
la publicación de los dos flujos, el número de los avisos, el medio de pago de
WhatsApp, cómo despacha la contraentrega, el valor declarado, el umbral de
$5.000 y el tope de $25.000. En el panel de Skydropx (15-nov): no hay
automatizaciones, la credencial está vigente, el origen «Autoenvio Fontibon»
está activo y el paquete es 19 × 19 × 5 cm, 1 kg.
