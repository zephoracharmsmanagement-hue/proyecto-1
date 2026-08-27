# Conversión — recuperar carritos con permiso y cerrar por WhatsApp

Plan de las dos automatizaciones que el propietario marcó como viables ahora,
del 2026-08-23. Antes de escribir código: qué existe ya, qué falta de verdad, y
en qué orden se construye sin arriesgar dinero ni la paciencia de una clienta.

**Van en el mismo documento porque comparten fundación.** Las dos necesitan la
misma app de WhatsApp Business, la misma plantilla aprobada por Meta, y —esto es
lo que no era obvio hasta revisar el código— el mismo endpoint nuevo para
reanudar un pago. Construir esa base una vez evita que las dos sesiones que las
toquen la reconstruyan cada una por su lado, que es justo el patrón que ya costó
caro en este repo (`ESTADO.md` § *Ramas abiertas*).

---

## Lo que ya verifiqué en el código, no en la documentación

Cinco hechos que cambian el plan, comprobados contra el repo real y no contra lo
que decían los documentos:

1. **El campo de autorización ya existe y ya viaja hasta el registro.**
   `checkout.html` tiene el checkbox `optin` («Quiero recibir novedades y ofertas
   por WhatsApp o correo»), sin marcar por defecto, y `_pedidos.mjs` lo guarda en
   `cliente.optin`. Es exactamente el campo que separa a quién se le puede
   escribir por algo que no sea el pedido.

2. **El rescate de abandonados ya existe, y ya distingue quién autorizó.**
   `rescate.mjs` corre a diario, filtra `estado === 'esperando-pago'` (que es
   justo «llegó hasta Wompi y no pagó» — `crear-pago.mjs` pone ese estado antes
   de mandar a la pasarela), y **ya marca visualmente** en el correo a la tienda
   quién tiene `optin === true`. Lo único que falta para la automatización 1 no
   es construir el rescate: es que, para quien autorizó, el aviso deje de ser
   solo «la tienda recibe un enlace para escribir a mano» y pase a **mandar el
   mensaje ella misma**.

3. **No existe hoy manera de reanudar un pago desde un enlace.** El checkout es
   puramente `localStorage` (`zephora.carrito.v1`), sin lectura de parámetros de
   URL. Y la reserva de inventario original **caduca a los 30 minutos**
   (`_inventario.mjs`, `VIGENCIA_MS`), así que para cuando el rescate se dispara
   —mínimo 2 horas después— las unidades que se apartaron ya se liberaron. Un
   enlace que diga «tu carrito sigue igual» sin volver a comprobar stock estaría
   mintiendo. **Pero es barato de arreglar**: la firma que exige Wompi
   (`SHA256(referencia + centavos + moneda + secreto)`, en `crear-pago.mjs`) se
   calcula al vuelo y no se guarda en ningún lado, así que un endpoint de
   «reanudar» solo tiene que releer el registro, **volver a comprobar
   inventario y reservar**, y regenerar la firma — es componer piezas que ya
   existen, no inventar cobro nuevo.

4. **La rama `sephora-whatsapp-response-system-682wvv` no se puede fusionar, y
   no es solo por el motivo de siempre.** Tiene su propio `index.html`, su
   propia carpeta `data/` (el repo actual usa `assets/`), y **ni `netlify.toml`
   ni funciones** — se despliega arrastrando una carpeta a Netlify, un modelo
   completamente distinto al actual. Es de antes de que existiera el checkout con
   Wompi. **Lo que sí vale de ahí es el contenido, no el código**: 28 macros
   auditadas contra inventario real y un system prompt ya pensado para esto. Se
   trae como referencia de tono, nunca como archivo.

5. **n8n solo tiene dos credenciales** (Header Auth, cuenta de servicio de
   Google) y **cero** de WhatsApp o de un modelo de lenguaje. Las dos
   automatizaciones están bloqueadas en el arranque por credenciales que
   **solo el propietario puede crear** — no es trabajo de programación pendiente.

---

## Lo que cambió en WhatsApp Business API justo este año — verificado ahora

Esto no estaba en el repo y decide buena parte del diseño:

- **La ventana de 24 horas sigue siendo la regla central.** Un mensaje del
  negocio dentro de las 24 horas desde el último mensaje de la clienta es libre
  en formato; **fuera de esa ventana, Meta exige una plantilla pre-aprobada**.
  Para la automatización 1 esto es directo: el rescate se dispara **horas o
  días** después de que la clienta abandonó el checkout —nunca escribió por
  WhatsApp, así que no hay ventana abierta—. **El mensaje de recuperación por
  WhatsApp necesita una plantilla de marketing aprobada por Meta**, con el costo
  por mensaje que eso implica. El correo no tiene esa fricción: Resend ya está
  conectado, sin plantilla que aprobar, sin costo por envío.
- **Dos cambios de facturación entraron a regir este mismo año.** Desde el 1 de
  agosto de 2026, Meta empezó a cobrar por las respuestas de un agente de IA
  («Meta Business Agent») dentro de la conversación, por token. Y desde el 1 de
  octubre de 2026 —en semanas, al momento de escribir esto— los mensajes de
  servicio y utilidad **dentro** de la ventana de 24 horas también empiezan a
  costar. El bot de la automatización 2 no va a ser gratis solo por responder
  dentro de una conversación activa: hay que presupuestarlo, no darlo por hecho.

Fuentes: [SleekFlow — WhatsApp Business API pricing 2026/2027](https://sleekflow.io/en-us/blog/whatsapp-business-price),
[Blueticks — WhatsApp Business API Pricing 2026](https://blueticks.co/blog/whatsapp-business-api-pricing-2026),
[n8n — WhatsApp Business Cloud credentials](https://docs.n8n.io/integrations/builtin/credentials/whatsapp).

---

## Automatización 1 — recuperar, solo a quien autorizó

**Lo que pidió el propietario, tal cual:** de los carritos que llegan hasta
Wompi y desisten, recuperar automáticamente solo a quienes marcaron el opt-in.
A quien no lo marcó, seguir sin escribirle un automático — eso ya lo hace bien
`rescate.mjs` hoy, avisando a la tienda para que una persona decida.

### Fase A — correo automático, sin ninguna dependencia nueva

Extiende `rescate.mjs` (o una función hermana) para que, de la lista de
`rescatables()`, separe dos grupos:

| Grupo | Qué pasa |
|---|---|
| `optin === true` | **Correo automático a la clienta**, con Resend —ya conectado—, ofreciendo retomar el pedido. Sin esperar a nadie. |
| `optin !== true` | Sigue exactamente igual que hoy: solo aviso a la tienda, la persona decide si escribe. |

**No manda a un enlace roto.** El correo apunta al endpoint de «reanudar»
(§ Fundación compartida) que revalida stock antes de mostrar nada — nunca
promete que el carrito «sigue armado» sin comprobarlo primero, porque ya se
sabe que la reserva original caducó.

**Se puede construir ya**, sin esperar a WhatsApp Business ni a ninguna
credencial nueva.

### Fase B — WhatsApp automático

Mismo filtro, mismo endpoint de reanudación, pero por WhatsApp en vez de
correo. Espera a que exista la app de WhatsApp Business (necesaria también para
la automatización 2) y a que Meta apruebe una plantilla de marketing para el
mensaje de recuperación — ese trámite no lo acelera el código.

### Reglas que no se pueden romper aquí

- **Nunca a quien no marcó `optin`.** Es la línea que ya traza la Ley 1581 en
  este repo y el propietario la repitió sin que se le preguntara.
- **Nunca dos veces por el mismo pedido.** `rescate.mjs` ya lo resuelve con
  `rescateAvisado`; el envío automático usa el mismo campo.
- **Nunca prometer que el carrito sigue igual.** El endpoint de reanudación
  vuelve a comprobar inventario. Si algo se agotó entre medias, el mensaje lo
  dice, no lo esconde.

---

## Automatización 2 — el agente de WhatsApp que cierra la venta

Esta es la que el propietario marcó como la que **no admite errores**, y esa
frase es la que decide toda la arquitectura, no un detalle de implementación.

### La regla de fondo, heredada del resto del repo

`disponibilidad.mjs` ya lo dice de frente en su propio código: pedirle a un
modelo que haga aritmética de inventario «es lo que los modelos hacen mal y con
toda seguridad». La misma regla aplica aquí, elevada: **el modelo nunca calcula
un precio, nunca inventa una existencia, y nunca genera un monto que se le
manda a Wompi.** El modelo conversa, entiende intención y decide qué función
llamar. Los números siempre salen de `_precios.js`, `disponibilidad.mjs` y
`crear-pago.mjs` — el mismo código que ya cobra en el sitio, no una copia que se
pueda desincronizar.

Esto no es una preferencia de estilo: es la única forma de que «no se admiten
errores» sea una promesa verificable y no una esperanza.

### Camino de menor riesgo primero: el bot no genera el cobro, lo prepara

La decisión de diseño que más baja el riesgo del v1: **el bot no manda el link
de pago de Wompi directamente.** Manda un enlace al checkout de la web **con la
selección ya cargada**, y el checkout existente —con su validación, su
recálculo de precio en el servidor y su widget de Wompi ya probado en
producción— hace el resto exactamente como lo hace hoy con cualquier clienta.

Esto necesita una pieza nueva y pequeña que no toca dinero: que `index.html` lea
la selección desde la URL (por ejemplo `?piezas=letra-e:1,pulsera-corazon-liso:19`)
y la cargue en `localStorage` antes de pintar la página. Es la misma clase de
cambio de bajo riesgo que ya existe para «Pedir por encargo»: arma un enlace,
no mueve dinero.

**Solo en una fase posterior**, con el bot en producción, probado, y el
endpoint de reanudación de la automatización 1 ya maduro, tiene sentido que el
bot ofrezca el link de pago de Wompi directo para quien ya es clienta conocida.
Hacerlo desde el primer día es exactamente el tipo de atajo que la frase «no se
admiten errores» prohíbe.

### Arquitectura recomendada (verificada contra la guía propia de n8n)

Consulté la guía de mejores prácticas de n8n para flujos de chatbot antes de
proponer esto, no de memoria:

- **Nodo WhatsApp Business Cloud** como disparador y como respuesta —n8n
  recomienda explícitamente no mezclar el canal de entrada con uno distinto de
  salida—.
- **Nodo AI Agent**, no un nodo genérico de «llamar al modelo»: es el que da
  orquestación de herramientas y memoria.
- **Memoria por sesión**, con la clave de sesión igual al número de la clienta
  (`nodeJson(whatsAppTrigger, 'messages.0.from')`), para que el bot recuerde la
  conversación sin mezclar clientas.
- **Herramientas HTTP** que llaman a `disponibilidad.mjs` para existencias y
  precio, y a un endpoint nuevo de «armar carrito» (que reutiliza `_precios.js`
  para calcular, nunca deja que el modelo escriba la cifra) para preparar el
  enlace prellenado del párrafo anterior.
- **Ninguna respuesta del modelo se manda cruda a la clienta cuando lleva un
  número de dinero.** Precio, descuento, costo de envío: siempre interpolados
  desde el resultado de la herramienta, no generados por el modelo como texto.

### Lo que hay que tener resuelto antes de escribir el primer nodo

1. **Número de WhatsApp Business verificado y app en Meta for Developers.**
   Trámite del propietario, no del código.
2. **Plantilla aprobada** para cualquier mensaje que el bot mande fuera de la
   ventana de 24 horas (por ejemplo, si retoma una conversación al día
   siguiente).
3. **Credencial del modelo en n8n.** Hoy no existe ninguna.
4. **Presupuesto real**, con los cambios de agosto y octubre de 2026 ya en la
   cuenta — no es gratis por estar «dentro de la conversación».

### Antes de producción: el banco de conversaciones de prueba

Dado que esta pieza no admite errores, no basta con probarla a mano un rato.
Siguiendo el mismo principio que ya usa `pruebas/` en este repo —comprobar el
comportamiento, no solo que algo «se vea bien»—: un guion de conversaciones que
se corre contra el bot antes de cada cambio, con casos que ya se sabe que
importan porque le pasaron a otras piezas de esta tienda:

- Pregunta el precio de una pieza agotada → tiene que decir que está agotada,
  no inventar que hay.
- Pide una talla que no existe en esa pulsera → ofrece las que sí hay, nunca
  confirma la que no.
- Cambia de opinión a mitad de conversación → el carrito que arma refleja lo
  último, no acumula lo que ya descartó.
- Intenta que el bot le confirme un precio distinto al real (el equivalente por
  chat de alterar el monto en el navegador, que `crear-pago.mjs` ya bloquea del
  lado del servidor) → el bot no puede ceder, porque de todas formas el
  servidor recalcula al final, pero **decirle que sí puede** ya rompió la
  confianza aunque el cobro salga bien.
- Se pone grosera o pide algo fuera de tema → el bot no improvisa una política
  de la tienda que no existe.

---

## Fundación compartida — construir en este orden

| # | Qué | Para quién | Depende de |
|---|---|---|---|
| 1 | Filtrar `rescatables()` por `optin` y mandar correo automático (Fase A) | Automatización 1 | Nada nuevo — Resend ya conectado |
| 2 | Endpoint «reanudar pedido»: releer registro, revalidar stock, re-reservar, refirmar | Las dos | Nada nuevo — compone `_pedidos.mjs` + `_inventario.mjs` + `crear-pago.mjs` |
| 3 | Carrito prellenado por URL en `index.html` | Automatización 2 (y mejora el `#2` de arriba) | Nada nuevo — solo lectura de `location.search` |
| 4 | App de WhatsApp Business + plantilla de marketing aprobada | Las dos | **El propietario**: cuenta verificada, trámite con Meta |
| 5 | Credencial del modelo en n8n | Automatización 2 | **El propietario** |
| 6 | WhatsApp automático para quien autorizó (Fase B) | Automatización 1 | `#2` + `#4` |
| 7 | El bot en n8n, primero contra un número de pruebas | Automatización 2 | `#3` + `#4` + `#5` |
| 8 | Banco de conversaciones de prueba, en verde, antes de tocar el número real | Automatización 2 | `#7` |

**Los pasos 1, 2 y 3 no dependen de nada que el propietario tenga que tramitar.**
Son los que se pueden construir esta semana. Del 4 en adelante, el ritmo lo
marca Meta, no el código.

---

## Sobre la pregunta de si hay una skill que ayude

Busqué en el marketplace de Claude Code con las palabras de este trabajo —bot
de WhatsApp, agente de soporte, comercio conversacional, checkout— **dos veces,
con términos distintos, y no hay ninguna instalable hoy.** No es que exista y no
se vea: la búsqueda no devolvió resultados.

Lo más parecido que sí existe y que ya se usó para armar este plan es que el
conector de n8n trae su propia guía de mejores prácticas para construir flujos
de tipo *chatbot* —la que se citó arriba— y eso hizo el diseño mejor de lo que habría
salido a ojo.

**Mi recomendación, no un hallazgo:** vale la pena crear una skill propia
—`skill-creator` está pensado exactamente para esto— pero **después**, no
antes, de que el flujo del paso 7 esté corriendo contra el número de pruebas
durante unos días. Una skill escrita antes de tener un bot real fija reglas
sobre un diseño que todavía no se probó contra una clienta de verdad; una
escrita después de la primera semana captura lo que realmente hizo falta
—los guardrails del banco de pruebas de arriba, el tono que use, cómo maneja el
«no sé»— y sirve para que la próxima sesión que toque el bot no tenga que
redescubrirlo. Es el mismo principio que ya sigue este repo con `ESTADO.md`:
documentar lo aprendido, no lo planeado.
