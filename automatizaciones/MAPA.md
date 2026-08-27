# Mapa de automatizaciones — qué hay, qué falta, qué se puede hacer hoy

Verificado contra las herramientas reales el **2026-08-23**, no supuesto. Cada
fila de «se puede» trae **por qué** se puede o no, porque en este proyecto el
limitante casi nunca es la idea.

**El hallazgo que ordena todo:** n8n tiene **dos credenciales** —Header Auth y
una cuenta de servicio de Google— y las credenciales gestionadas de n8n **no
están disponibles** en esta instancia (`available: false`). Así que toda
automatización que necesite un servicio nuevo está bloqueada por **una
autorización que solo puede dar el propietario**, no por trabajo de
programación. Eso reordena la lista entera.

---

## 1 · Lo que ya está funcionando

| Pieza | Dónde | Estado |
|---|---|---|
| **Cobro con Wompi** | `crear-pago.mjs`, `wompi-webhook.mjs` | En producción. Firma de eventos verificada; el total lo calcula el servidor |
| **Reserva de inventario** | `_inventario.mjs` | En producción, con compare-and-swap sobre Blobs. Confirmado con `"reserva":"reservado"` |
| **Registro de pedidos** | `_pedidos.mjs` + Blobs | Tres copias independientes: registro, log y correo |
| **Comprobante a la clienta** | `_correo.js` | Resend. No puede tumbar una venta |
| **Hoja de despacho a la tienda** | `_correo.js` | Plantilla aparte del recibo. Costó un pedido descubrir que hacía falta |
| **Rescate de checkouts abandonados** | `rescate.mjs` | Diario 9:00 COL. Avisa a la tienda, **no le escribe a la clienta** |
| **Hoja de inventario en Google Sheets** | n8n `K1J4pHYfvd6QuAq8` | **Activo.** Una fila por pieza vendida + existencias |
| **Píxel del sitio** | `index.html` | `PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`, `Lead`, `Contact` |
| **`Purchase` de servidor (CAPI)** | `wompi-webhook.mjs` → `_meta.js` | Manda al píxel nuevo. Falta confirmar que no se duplique |
| **Disponibilidad real** | `disponibilidad.mjs` | Traída el 2026-08-21. Conteo menos apartado, calculado en el servidor |
| **12 baterías de pruebas** | `pruebas/` | Incluyen pruebas de **forma del código**, no solo de comportamiento |
| **Campañas de Meta** | cuenta `1583713932705268` | Diagnosticadas; 2 anuncios pausados por costo por resultado |
| **Motor de contenido** | `automatizaciones/contenido/` | Especificado y con contrato para Remotion. **Sin construir** |

---

## 2 · Lo que se puede construir **hoy**, sin pedirle nada a nadie

Todo lo de esta sección usa solo lo que ya está conectado: código del repo,
Blobs, Resend y la cuenta de servicio de Google que n8n ya tiene.

### 2.1 · Lista de espera de lo agotado — **la de más impacto**

**El problema, con números.** Hay **24 referencias en cero**, y 14 de ellas son
letras del abecedario (F G H I P Q R T U W X Y Z Ñ). Comprarlas cuesta ~$73.000
y habilita ~$1.064.000 de utilidad. Esa decisión **hoy se toma a ciegas.**

**Y lo peor es que el dato ya pasa por delante y se tira.** Cuando una pieza
está agotada, la ficha ofrece *«Pedir por encargo»* y manda a WhatsApp
(`dataset.wa = 'encargo'`, `index.html:1851`). O sea: **alguien ya está
levantando la mano por una pieza que no existe**, y eso se disuelve en una
conversación que nadie cuenta.

Capturarlo —correo o celular, y qué pieza— convierte la decisión de reposición
más cara del negocio en un número. Es **permanente y pasivo**: no hay que
publicar nada ni pedirle nada a nadie, funciona solo mientras la tienda esté
arriba.

> Ojo con la ley: se pide el dato **para avisar de esa pieza**, esa es la
> finalidad y hay que escribirla. No es una lista de correo.

### 2.2 · Aviso de stock crítico

**59 referencias están en 1–2 unidades.** Hoy nadie se entera de que algo se
está acabando hasta que se acabó — y agotarse es peor que no tener: la clienta
ya se decidió y se va con las manos vacías.

Un correo semanal con lo que bajó de 3, ordenado por margen (charms 87,9% antes
que pulseras 70,7%), usando lo que ya calcula `disponibilidad`. Resend y Blobs
ya están puestos; no hace falta nada nuevo.

### 2.3 · Vigilante de fallos silenciosos

Es la automatización más en el espíritu de este repo. `ESTADO.md` lo dice sin
rodeos: **los tres problemas que más caro salieron no dieron ningún error.** La
tienda cobraba, los correos salían, y todo estaba mal.

Una comprobación diaria que grite cuando algo no cuadra:

- ¿`disponibilidad` responde, y con `fuente: conteo-menos-apartado`? Si dice
  `solo-conteo`, Blobs se cayó y la tienda vende sin apartar.
- ¿Hay pedidos atascados en `esperando-pago` más de lo razonable?
- ¿El despliegue sigue reportando **10 functions** y los pesos esperados?
- ¿`stock.json` lleva mucho sin recontarse contra lo vendido?

No añade capacidad: **añade que las redes de seguridad avisen cuando se caen**,
que es la deuda que el propio documento reconoce haber contraído al elegir
«fallar hacia adelante».

### 2.4 · Reporte semanal del negocio

Ventas de la semana, piezas más vendidas, checkouts abandonados, stock crítico y
utilidad estimada por margen real. Todo sale de Blobs y `stock.json`.

**La parte de pauta va aparte:** los datos de Meta necesitan el token, y los
scripts de `meta/` corren en la máquina del propietario, no aquí.

### 2.5 · Copia de seguridad del registro de pedidos

Los pedidos viven en Blobs. La cuenta de servicio de Google **ya está conectada**
en n8n, así que volcarlos periódicamente a la hoja es camino abierto. Hoy la
única forma de leer un pedido es `netlify blobs:get` desde la terminal.

---

## 3 · Lo que necesita **una cosa del propietario** y luego es rápido

Ninguna de estas es trabajo de programación pendiente: es una autorización.

| Automatización | Qué falta exactamente | Cuánto cuesta |
|---|---|---|
| **`Purchase` de ventas por WhatsApp** | El workflow `h5U0fGHrW4hekjtp` **ya está construido**. Falta la credencial del token CAPI en n8n y una prueba con `test_event_code` | Minutos |
| **Marcar `Lead` como conversión personalizada** | **Verificado: la cuenta tiene cero conversiones personalizadas.** Se crea en Events Manager | Minutos |
| **Recuperar carritos con permiso + bot de WhatsApp que cierra la venta** | Las dos automatizaciones que el propietario eligió para ahora. Plan completo y verificado en [`conversion/BRIEF.md`](conversion/BRIEF.md). `rescate.mjs` ya distingue quién autorizó; falta el envío automático, el endpoint de reanudar pago, y para el bot: app de WhatsApp Business, plantilla aprobada y credencial de modelo en n8n. Los guiones y macros de la rama `sephora-whatsapp-response-system-682wvv` sirven como referencia de tono, no como código — es de antes del checkout con Wompi | Los 3 primeros pasos de la fundación compartida: ya. El resto, días una vez el propietario tramite lo de Meta |
| **Publicación automática a IG y FB Reels** | App de Meta y App Review. Son **dos integraciones distintas**, no una | Semanas (revisión de Meta) |
| **Reposición por rotación real** | Que se acumulen semanas de la hoja *Movimientos*. Hoy la recomendación es «subir todo a 4», que es regla pareja, no rotación | Tiempo, no trabajo |

---

## 4 · Lo que está bloqueado y **no depende de nadie aquí**

### El portafolio bloquea más de lo que se creía

`CLAUDE.md` ya decía que la cuenta `1583713932705268` no pertenece a ningún
portafolio y que por eso el píxel nuevo no se puede compartir. **Comprobado hoy
que eso bloquea también el catálogo:**

> `Ad account 1583713932705268 has no owning business, so its catalogs cannot be
> listed.`

Y no hay ningún catálogo creado en toda la cuenta (`total_count: 0`).

Consecuencia: **los anuncios dinámicos de catálogo no son una opción todavía.**
Son justo los que enseñan a cada persona la pieza exacta que miró, que en una
tienda de 129 referencias es de lo que mejor funciona. Quedan detrás de la misma
puerta que la CAPI: que el portafolio cumpla antigüedad y se reclame la cuenta.

**Esto sube la prioridad de la migración al portafolio**: no desbloquea una cosa,
desbloquea tres — optimizar por `Purchase`, el píxel nuevo, y el catálogo.

---

## 5 · El orden que yo seguiría

| # | Qué | Por qué ahí |
|---|---|---|
| 1 | **Lista de espera de lo agotado** | Convierte la decisión de $73.000 → $1.064.000 en dato. Pasivo y permanente. Cero dependencias |
| 2 | **Publicar el `Purchase` de WhatsApp** | Ya está construido. Es la credencial y ya |
| 3 | **Aviso de stock crítico** | 59 referencias a punto de agotarse sin que nadie lo sepa |
| 4 | **Vigilante de fallos silenciosos** | Paga la deuda de «fallar hacia adelante» antes de añadir más redes |
| 5 | **Reporte semanal** | Cuando 1 y 3 ya alimentan datos que valga la pena resumir |
| 6 | **Motor de contenido** (Fases 1–3) | Ver [`contenido/BRIEF.md`](contenido/BRIEF.md) |
| 7 | **Asesor de WhatsApp** | Cuando haya canal. La pieza difícil ya está hecha |

**Y una que no es automatización pero le gana a todas en retorno por hora:**
comprar las 14 letras. La lista de espera (#1) la convierte en decisión
informada, pero si la respuesta llega y sigue sin comprarse, la automatización
no sirvió de nada.

> **Recordatorio de coste:** cada despliegue de producción son ~15 créditos de
> ~66 del ciclo. Todo lo de la sección 2 toca `netlify/functions/`, así que
> conviene **agrupar varias piezas en un solo despliegue** en vez de publicar una
> por una.
