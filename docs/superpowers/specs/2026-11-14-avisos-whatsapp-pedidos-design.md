# Avisos por WhatsApp de cada pedido y guía de Skydropx precargada — diseño

**Fecha:** 2026-11-14. **Rama:** `claude/avisos-whatsapp-diseno`. **Estado:** diseño
para aprobación del propietario. No hay código de funciones en esta rama.

Las partes marcadas **«pendiente de la Sesión 3»** dependen de su nota
`sesion3-avisos-whatsapp-insumos-2026-11-14.md` (n8n, WhatsApp y Skydropx), que
no había llegado al escribir esto.

## 0 · Qué pasó con el pedido ZC-261107-28AEB010

**El correo de tienda sí salió y sí llegó.** En la bandeja de
`zephoracharms@gmail.com` están, del 7-nov y en Recibidos:

- «Pedido ZC-261107-28AEB010 · $240.000 · en línea · ✎ DEDICATORIA»
- «PAGADO · ZC-261107-28AEB010 · $240.000 — despachar · ✎ DEDICATORIA»
- «Transacción APROBADA en Zephora Charms» (el de Wompi)

No es un fallo de código: el aviso existió y nadie lo vio, porque ese buzón no
se revisa a diario. El arreglo es de canal, que es lo que pide el encargo.
(El correo dice $240.000; el encargo, $255.000. Conviene confirmar la cifra.)

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
| `_pedidos.mjs` | El pedido completo guardado por referencia (`leer`, `marcar`, `listar`) | No tiene ningún campo de «despachado» |
| `envio-estado.mjs` + `_envios.mjs` | Avisos de estado de envío a la clienta, con clave y anti-duplicados | Sin activar; la tabla guía → referencia se llena a mano |
| `rescate.mjs`, `posventa.mjs` | El patrón de función diaria (`config.schedule`) | — |

Los tres puntos de disparo, que son los mismos de la hoja:

1. **Contraentrega:** `crear-pago.mjs`, bloque `pedido.pago === 'contraentrega'`, después de `anotarVenta`.
2. **Pago en línea, Addi y Sistecrédito:** `_cierre.mjs` → `cerrarPago()`, rama aprobada, junto a `anotarVenta` y `pagoTienda`. Nunca antes de la aprobación.
3. **Venta manual `MAN-`:** `registrar-venta.mjs`, después de `anotarVenta`.

## 2 · Reparto: qué hace la tienda y qué hace n8n

La misma regla de la spec del 18-sep: **el repo decide cuándo, a quién y con qué
texto; n8n hace la plomería con Meta y Skydropx.**

```
Venta confirmada (3 caminos)
   ↓
[Netlify · _avisos.mjs · avisarPedido()]
   arma las variables de cada plantilla, normaliza el celular,
   anota el intento en el pedido y en el log
   ↓  POST a AVISOS_WEBHOOK (cabecera X-Zephora-Token, 4 s de espera)
[n8n · «Zephora · Avisos de pedido»]
   ├─ plantilla al PROPIETARIO (hoja de despacho)
   ├─ plantilla a la CLIENTA (confirmación; con botones si es contraentrega)
   ├─ si es pago aprobado: cotización en Skydropx → tarifas al propietario
   └─ por cada envío, bien o mal: POST a /pedido-aviso (resultado)
   ↓
[Netlify · pedido-aviso.mjs]  deja en el pedido si salió o no cada mensaje

Clienta toca un botón → entra al número de la tienda
   ↓
[n8n · filtro ANTES del bot]  reconoce el botón por su código (ZC_OK / ZC_CORREGIR)
   ├─ «Sí, todo está bien» → /pedido-aviso (confirmar) → cotización Skydropx
   └─ «Corregir datos»     → /pedido-aviso (corregir)  → aviso al propietario
```

**Netlify (código, en este repo):**

- `_avisos.mjs` (nuevo): `avisarPedido({ referencia, evento, pedido })`. Se llama
  en los tres puntos. Nunca lanza.
- `pedido-aviso.mjs` (nuevo, con clave): lo llama n8n para dejar el resultado de
  cada envío, la respuesta de los botones y el «despachado».
- `resumen-despachos.mjs` (nuevo, diario): el resumen de las 8:00 a. m.
- Cambios de una línea en `crear-pago.mjs`, `_cierre.mjs` y `registrar-venta.mjs`.
- `envio-estado.mjs`: al primer evento de Skydropx marca `despachadoEn`.

**n8n (pendiente de la Sesión 3 en el cómo):** enviar las plantillas, atajar los
botones antes del bot `74TjEtDnn940jh9k`, llamar a Skydropx y llenar sola la
tabla guía → referencia que hoy se llena a mano.

## 3 · Qué datos viajan

Un solo POST por venta, con la referencia como llave para descartar duplicados:

```json
{
  "evento": "pago_aprobado | contraentrega_confirmada | venta_manual",
  "referencia": "ZC-261107-28AEB010",
  "cuando": "2026-11-07T15:02:11Z",
  "propietario": { "para": "57…", "plantilla": "pedido_nuevo_tienda", "variables": ["…"] },
  "clienta":     { "para": "57…", "plantilla": "pedido_confirmado", "variables": ["…"],
                   "botones": { "ok": "ZC_OK:ZC-…", "corregir": "ZC_CORREGIR:ZC-…" } },
  "envio": { "cotizar": true, "recaudo": 0, "destino": { "nombre": "…", "celular": "…",
             "direccion": "…", "adicional": "…", "barrio": "…", "ciudad": "…", "depto": "…" },
             "paquete": { "peso": 0, "largo": 0, "ancho": 0, "alto": 0 } }
}
```

- **Celular y dirección sí viajan aquí** (la hoja no los lleva). Salen del
  pedido guardado, igual que en el correo de tienda.
- **El número del propietario** sale de `WHATSAPP_PROPIETARIO`, nunca del código.
- **Celular de la clienta:** el checkout ya exige 10 dígitos que empiecen por 3;
  se le antepone 57. En ventas manuales el teléfono es texto libre: se limpia y
  se acepta `3XXXXXXXXX` o `573XXXXXXXXX`. Si no es válido, `clienta.para` va
  vacío y el aviso al propietario dice «⚠ celular no válido: no se le escribió
  a la clienta».
- **Las variables las arma el repo**, no n8n. Meta no admite saltos de línea,
  tabulaciones ni variables vacías: cada variable es una sola línea y lo que
  falte va como «—». Un pedido con muchas piezas se corta con «… y N más (ver
  correo)» para no pasar del límite del cuerpo.
- **Datos personales en n8n:** el flujo no debe guardar las ejecuciones
  correctas, o debe purgarlas en pocos días (ajuste del flujo; pendiente de la
  Sesión 3).

## 4 · Los mensajes (borrador; texto final pendiente de la Sesión 3)

Todas son plantillas de **utilidad**, en español. El propietario las somete en
WhatsApp Manager. Sin plantillas aprobadas, nada sale.

**`pedido_nuevo_tienda` — al propietario.** La hoja de despacho de
`textoTienda()`, en campos fijos:

```
Pedido nuevo {{1}} · {{2}} · {{3}}
Empacar: {{4}}
Para: {{5}} · Cel. {{6}}
Dirección: {{7}}
Ciudad: {{8}}
Indicaciones: {{9}}
Dedicatoria: {{10}}
Revísalo y despáchalo.            [Ya lo despaché]
```

`{{2}}` es «PAGADO en línea», «ADDI aprobado», «SISTECRÉDITO aprobado» o
«CONTRAENTREGA: COBRAR $135.000».

**`pedido_confirmado` — a la clienta, pago aprobado.** El texto del encargo:
«¡Hola {{1}}! ✨ Gracias por tu compra en Zephora Charms 💖 Tu pedido {{2}} ya
está confirmado y en preparación. En cuanto lo despachemos te enviamos la guía
por este mismo chat ✨».

**`pedido_contraentrega` — a la clienta, contraentrega.** Lo anterior más:
«Para despacharlo, confirma por favor tus datos: {{3}}, {{4}}. Pagarás {{5}} al
recibir (incluye el envío contraentrega).» Botones: **[Sí, todo está bien]**
**[Corregir datos]**.

**`tarifas_envio` — al propietario.** Las tarifas de Skydropx (transportadora,
precio, días) y cómo terminar la guía. Pendiente de la Sesión 3.

**`pendientes_despacho` — al propietario, 8:00 a. m.** Ver § 7.

**Venta manual `MAN-`:** solo aviso al propietario. A la clienta no se le
escribe: ya está hablando con la tienda en ese chat y el registro no guarda su
dirección. (Pregunta 6.)

**Costo por pedido:** 2 mensajes en pago en línea (propietario + clienta) y
hasta 3 con las tarifas; en contraentrega, uno más si hay corrección. Precio
por mensaje en Colombia: pendiente de la Sesión 3.

## 5 · Botones de la contraentrega

- Cada botón lleva un código con la referencia (`ZC_OK:<ref>`,
  `ZC_CORREGIR:<ref>`), así la respuesta se reconoce sin leer el texto.
- **Se atajan antes del bot:** el primer nodo del flujo del bot desvía todo
  mensaje de tipo botón cuyo código empiece por `ZC_`. El bot no los ve.
  (El cómo exacto: pendiente de la Sesión 3.)
- **«Sí, todo está bien»:** n8n llama a `/pedido-aviso` con `confirmar`; el
  pedido queda con `datosConfirmadosEn`; se responde «¡Listo! Ya lo
  preparamos» y arranca la cotización de Skydropx.
- **«Corregir datos»:** el pedido queda con `datosPorCorregir`; se le dice a la
  clienta que una persona le escribe, y al propietario le llega «{nombre}
  quiere corregir los datos de {ref}». Lo que ella escriba después no puede
  contestarlo el bot como si fuera una venta (pendiente de la Sesión 3).
- **Sin respuesta:** el pedido aparece en el resumen de las 8:00 a. m. como
  «contraentrega sin confirmar».
- Una referencia que no existe, o un botón tocado dos veces, no hace nada
  nuevo y no rompe nada.

## 6 · Skydropx: cotización, no compra

- **Cuándo:** pago en línea, al aprobarse. Contraentrega, solo tras «Sí, todo
  está bien» o cuando el propietario corrigió los datos.
- **Qué:** cotización con origen (la tienda), destino (datos del pedido),
  paquete estándar y, en contraentrega, el valor a recaudar.
- **Hasta dónde:** nunca se compra la guía. Al propietario le llegan las
  tarifas y él elige y paga en Skydropx.
- **Relación con el pedido:** la referencia `ZC-`/`MAN-` viaja en la
  cotización, y n8n guarda sola la fila guía → referencia. Así los avisos de
  estado de la spec del 18-sep le llegan a la clienta correcta sin el paso
  manual.
- **Pendiente de la Sesión 3:** qué llamada de la API sirve (cotización o
  envío sin etiqueta), si conserva la referencia cuando el propietario termina
  en el panel, y cómo se declara el recaudo contraentrega.

## 7 · Red de seguridad

**Fallar hacia adelante.** `avisarPedido()` nunca lanza y espera como máximo
4 segundos. Sin `AVISOS_WEBHOOK` no manda nada y la tienda vende igual. Una
venta jamás se cae por WhatsApp, n8n o Skydropx.

**Nunca en silencio.**

- Cada intento deja una línea en el log (`evento: aviso_whatsapp`, referencia,
  resultado) y un campo `avisos` en el pedido.
- **Si n8n no responde:** la tienda manda en el acto un correo «⚠ NO SALIÓ EL
  WHATSAPP · {ref}» con la hoja de despacho, a `CORREO_TIENDA` y a
  `CORREO_ALERTAS` (un buzón que el propietario sí lea).
- **Si n8n recibe pero Meta rechaza** (plantilla pausada, número inválido): n8n
  lo reporta a `/pedido-aviso` y además escribe una fila en la hoja «Avisos
  fallidos».
- **No se repite:** los reintentos de Wompi no mandan dos avisos; el pedido
  recuerda que ya se avisó.
- El correo de tienda de hoy **se mantiene** tal cual.

**Resumen diario, 8:00 a. m.** (`resumen-despachos.mjs`, `0 13 * * *` UTC).
Recorre los pedidos confirmados sin `despachadoEn` y con más de 24 horas, y le
manda al propietario la lista: referencia, nombre, ciudad, total y días de
espera; aparte, las contraentregas sin confirmar y los pedidos cuyo aviso no
salió. Va también por correo. No depende de que el aviso del momento haya
funcionado: es lo que habría mostrado el pedido de Yuly el 8-nov.

Un pedido pasa a «despachado» de dos formas: el propietario toca **[Ya lo
despaché]** en el aviso, o Skydropx reporta el primer evento de su guía.
Para no listar todo el historial el primer día, solo cuentan los pedidos desde
`AVISOS_DESDE`.

## 8 · Variables nuevas

| Variable (Netlify) | Para qué |
|---|---|
| `AVISOS_WEBHOOK` | URL del flujo de n8n. Sin ella, nada sale |
| `AVISOS_TOKEN` | Cabecera `X-Zephora-Token` hacia n8n |
| `AVISOS_KEY` | Clave con que n8n llama a `/pedido-aviso` |
| `WHATSAPP_PROPIETARIO` | Número del propietario, `57XXXXXXXXXX` |
| `AVISOS_CLIENTAS` | Interruptor: los mensajes a clientas salen solo con `on` |
| `CORREO_ALERTAS` | Buzón de respaldo que el propietario sí lea |
| `AVISOS_DESDE` | Fecha desde la que cuenta el resumen diario |

En n8n, como credenciales (ya existen): «WhatsApp Zephora (Envío)»,
«WhatsApp Zephora (Trigger)», «Skydropx API» y «Skydropx Webhook (entrada)».
Las medidas del paquete y la dirección de origen no son secretas: van en el
código, cuando el propietario las dé.

## 9 · Pruebas que se escribirían

`pruebas/avisos.js`, `pruebas/pedido-aviso.js` y `pruebas/resumen-despachos.js`,
al estilo de `hoja.js` y `envio-estado.js`, sumadas a `correr.sh`:

- Se avisa una vez en cada camino, y **no** con pago pendiente o rechazado.
- Un reintento de la pasarela no manda un segundo aviso.
- **Todo dato que la clienta escribió viaja:** la prueba saca los campos de lo
  que acepta `crear-pago`, como `correo-tienda.js`, sin nombrarlos a mano.
- Contraentrega dice «COBRAR $total»; pago aprobado dice «PAGADO».
- Celular a `57XXXXXXXXXX`; uno inválido deja a la clienta sin mensaje y avisa
  al propietario.
- Ninguna variable trae salto de línea ni va vacía; un pedido largo se corta.
- n8n caído, lento o con error: la venta termina bien, queda la línea en el
  log y sale el correo de respaldo.
- Sin `AVISOS_WEBHOOK` no se manda nada. Sin `AVISOS_CLIENTAS=on` solo sale el
  aviso del propietario.
- `/pedido-aviso`: 401 sin clave; confirmar, corregir y despachado marcan el
  pedido; repetir no cambia nada; referencia inexistente da 404.
- Resumen: lista lo de más de 24 h sin despachar; deja fuera lo despachado, lo
  anulado, las pruebas y lo anterior a `AVISOS_DESDE`; sin pendientes no envía.
- `ESTADO.md` § Al desplegar: 38 → 40 funciones (41 con el resumen).

## 10 · Privacidad y checkout

**Ya lo dicen, en lo esencial.** La política incluye entre las finalidades
«Gestionar tu pedido: confirmarlo, prepararlo, despacharlo y hacerle
seguimiento» y «Coordinar la entrega con la transportadora y, si aplica, el
pago contraentrega», y nombra a Meta (WhatsApp Business), n8n, Resend y las
transportadoras. El checkout dice «Por WhatsApp y correo te llega el número de
guía» y, en contraentrega, «Confirmamos disponibilidad por WhatsApp antes de
despachar».

**Texto propuesto, para que quede explícito:**

- Checkout, bajo el campo del celular: «Te escribiremos por WhatsApp a este
  número para confirmar tu pedido y avisarte del envío.»
- Checkout, nota de contraentrega: «Pagas en efectivo al mensajero. Antes de
  despachar te pedimos confirmar tu dirección por WhatsApp.»
- Política (`gen_paginas.py`), en «Gestionar tu pedido»: «Para eso te
  escribimos por WhatsApp al celular que nos dejas: la confirmación del pedido
  y de tus datos de entrega, y los avisos del envío. Son mensajes sobre tu
  compra, no publicidad.»
- Política, en transportadoras: agregar «y Skydropx, la plataforma con la que
  generamos las guías».

Son mensajes de la propia compra: no dependen de la casilla de novedades
(`optin`), igual que el aviso de envío de la spec del 18-sep.

## 11 · Orden propuesto

1. **Aviso al propietario + resumen diario + respaldo.** Dos plantillas, sin
   tocar el bot. Es lo que resuelve el caso de Yuly.
2. **Mensajes a la clienta y botones.** Exige el filtro antes del bot.
3. **Cotización de Skydropx y avisos de estado.**

Cada fase se prueba primero al número del propietario; `AVISOS_CLIENTAS` queda
apagado hasta que él lo apruebe. Nada se despliega sin su «deploy».

## 12 · Preguntas para el propietario

1. Número de WhatsApp donde quiere recibir los avisos.
2. Peso y medidas del paquete estándar (o si sirve el «paquete habitual» que ya
   tiene en Skydropx), y la dirección de origen.
3. Un correo que sí lea a diario, para el respaldo.
4. ¿El total del pedido de Yuly fue $240.000 (lo que dice el correo) o $255.000?
5. ¿Aprueba el orden por fases, empezando por su aviso y el resumen diario?
6. Ventas manuales `MAN-`: ¿solo aviso a usted, o también mensaje a la clienta?
   ¿Y entran en el resumen de pendientes?
7. Cuando no haya nada pendiente, ¿prefiere silencio o un «todo al día»?
8. ¿Desde qué fecha cuenta el resumen (para no listar pedidos viejos)?
