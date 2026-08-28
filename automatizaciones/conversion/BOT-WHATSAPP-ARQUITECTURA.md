# Arquitectura del bot de WhatsApp — n8n, nodos, flujo

Este documento describe cómo se construye el bot que cierra ventas por WhatsApp. **No es código** — es la arquitectura de nodos, decisiones de diseño, y qué hace cada pieza. Cuando lleguen las credenciales, esto es el plano.

Sigue la **guía de mejores prácticas de n8n para chatbots** (verificada contra su documentación oficial, no de memoria).

---

## 0 · El workflow ya existe — qué falta para encenderlo

**Construido el 2026-08-28**: `Zephora · Asesora de WhatsApp`, id **`74TjEtDnn940jh9k`**,
en el proyecto personal de n8n. **Sin publicar**, y no se publica hasta tener lo de
abajo y correr el banco de conversaciones (§ 8).

### Las tres credenciales, en n8n → Credentials → Add

Son tres, no dos: **WhatsApp necesita dos credenciales distintas** porque el nodo
que escucha y el que responde autentican de forma diferente.

| # | Nombre exacto | Tipo en n8n | Qué lleva | De dónde sale |
|---|---|---|---|---|
| 1 | `WhatsApp Zephora (Trigger)` | **WhatsApp Trigger API** (`whatsAppTriggerApi`) | Client ID y Client Secret | Meta for Developers → tu app → Configuración → Básica |
| 2 | `WhatsApp Zephora (Envío)` | **WhatsApp API** (`whatsAppApi`) | Access token permanente | Meta → tu app → WhatsApp → Configuración de la API |
| 3 | `Anthropic Zephora` | **Anthropic API** (`anthropicApi`) | API key | console.anthropic.com → API Keys |

> **El trigger NO lleva «verify token».** n8n registra la suscripción del webhook
> al activar el workflow y verifica el reto de Meta contra el id del propio nodo.
> Si Meta pide un verify token a mano, es ese id — nunca una cadena inventada.

### Y un dato que no es una credencial

El nodo **Responder por WhatsApp** tiene un `placeholder` en **Phone Number ID**.
Es el identificador interno del número, no el `+57 301 899 0672`: sale de
**WhatsApp Manager → Números de teléfono**, en la fila del número.

### Al activar, comprobar la coexistencia

Activar el workflow apunta el webhook de Meta a n8n. **Justo después, mandar un
WhatsApp al número desde otro teléfono y confirmar que sigue llegando a la app
de WhatsApp Business además de al bot.** Si dejara de llegar, el canal manual
—que es como esta tienda cierra las ventas hoy— se habría apagado sin dar
ningún error.

### El modelo

`claude-opus-5`, puesto como id en el nodo de Claude. Es el más capaz; si el
volumen de conversación hace que el coste pese, `claude-sonnet-5` es la
alternativa —cuesta bastante menos por token— y esa decisión es del propietario,
no del código. Se cambia en un campo del nodo, sin tocar nada más.

---

## 1 · Visión general del flujo

```
Mensaje WhatsApp
    ↓
[Trigger: WhatsApp Business Cloud]
    ↓
[AI Agent]
    ├─ Herramienta: disponibilidad (qué hay)
    ├─ Herramienta: armar-carrito (genera enlace)
    └─ Memoria: por número de clienta
    ↓
¿Respuesta con dinero?
    ├─ NO → Responde directo
    └─ SÍ → Interpola desde herramienta, nunca crudo del modelo
    ↓
[Nodo WhatsApp Business Cloud: enviar]
    ↓
Mensaje a WhatsApp
```

---

## 2 · Los nodos, en orden

### 2.1 · Disparador: WhatsApp Business Cloud (Trigger)

**Qué hace:** Escucha mensajes entrantes del número de WhatsApp Business verificado.

**Configuración:**
- **Credential:** WhatsApp Business Cloud (aún no existe, la traerá el propietario)
- **Evento:** `messages` (mensaje de texto entrante)
- **Extrae:**
  - `messages[0].from` → número de clienta (ej: `573001234567`)
  - `messages[0].text.body` → texto del mensaje

**Por qué este nodo, no un webhook genérico:**
- n8n maneja autenticación y validación de webhook de Meta
- Expone variables tipadas que el AI Agent usa después
- Reintento automático si falla

**Regla de memoria:**
```
sessionKey = messages[0].from
```
Así el bot recuerda la conversación por número de teléfono, sin mezclar clientas.

---

### 2.2 · Núcleo: AI Agent

**Qué hace:** Orquesta herramientas, mantiene contexto, decide qué responder.

**Por qué AI Agent y no un "Call Model" genérico:**
- AI Agent da manejo automático de herramientas (llama función → ve resultado → decide si llamar otra)
- Memoria integrada (sin tener que guardar/cargar manualmente)
- Mejor para conversaciones con lógica ramificada

**Configuración:**

| Campo | Valor | Notas |
|---|---|---|
| **Model** | `claude-3-5-sonnet-20241022` | O el modelo que el propietario elija. Debe tener tool use. |
| **Session ID** | `{{ $node["WhatsApp Trigger"].json.messages[0].from }}` | Número de teléfono. Cada clienta = sesión distinta. |
| **System Prompt** | [Ver sección 2.2.1] | Incluye instrucciones de tono, guardrails, nunca inventar. |
| **Tools** | [Ver sección 2.3] | Las 3 herramientas que llamará. |

#### 2.2.1 · System Prompt (guardrails, no una copia de ChatGPT)

```
Eres la asistente de ventas de Zephora Charms, una tienda de pulseras con charms.

NUNCA hagas estas cosas:
- Inventar existencia: si no tienes la respuesta de la herramienta disponibilidad(), 
  no adivines.
- Inventar precio: siempre interpola desde la herramienta armar-carrito, nunca 
  escribe el número como texto.
- Confirmar talla que no existe: ofrece solo las que la herramienta devuelve.
- Improvisar política: si no sé de algo (cambios, envío, garantía), digo 
  "déjame contactar con el equipo" — nunca invento regla.

CUANDO VENDAN:
1. Pregunta qué pulsera (base).
2. Ofrece las tallas que hay en stock.
3. Pregunta qué charms quiere.
4. Llama armar-carrito con la selección final.
5. Manda el enlace tal como la herramienta lo genera, sin cambios.
6. "Retoma tu pedido acá 👉 [URL]" — eso es todo.

SI CAMBIA DE OPINIÓN MID-CONVERSACIÓN:
- El carrito siempre refleja lo ÚLTIMO, no acumula todo lo que dijo.

TONO:
- Cálida, cercana, sin pretensiones.
- Respuestas cortas (máximo 3 líneas).
- Emojis solo si la clienta los usa.
```

---

### 2.3 · Las herramientas que el Agent llama

Tres herramientas HTTP que el Agent puede invocar automáticamente.

#### 2.3.1 · Herramienta: Disponibilidad

**Llama:** `https://zephoracharms.com/.netlify/functions/disponibilidad`

**Método:** GET, sin parámetros. Devuelve el catálogo **entero** con la
disponibilidad ya restada — no se le pregunta por piezas sueltas.

Es deliberado: son 129 referencias, caben de sobra en una respuesta, y así el
Agent tiene el catálogo completo en contexto en vez de ir preguntando pieza por
pieza y gastar un turno en cada una.

**Respuesta:**

```json
{
  "generado": "2026-08-28T14:02:11.004Z",
  "fuente": "conteo-menos-apartado",
  "reglas": { "escalaCharms": [0, 0, 0.08, 0.15, 0.2], "envioGratisDesde": 180000, "…": "…" },
  "aviso": "Disponibilidad referencial: conteo manual menos lo apartado por pagos en curso.",
  "piezas": [
    { "id": "letra-a", "nombre": "Letra A", "tipo": "charm", "precio": 76000,
      "familia": "letras", "material": "Plata Esterlina 925",
      "disponible": 3, "agotado": false }
  ],
  "brazaletes": [
    { "id": "pulsera-copo-de-nieve", "nombre": "Pulsera Copo de Nieve", "tipo": "brazalete",
      "precio": 114000, "material": "baño de plata sobre base de alta resistencia",
      "tallas": { "17": 0, "18": 2, "19": 1 }, "agotado": false }
  ]
}
```

**Dos campos que el prompt tiene que mirar sí o sí:**

- **`fuente`** — con `'solo-conteo'` no se pudo leer lo apartado por pagos en
  curso. Entonces **`disponible` viene en `null`**, no con el conteo en bruto: es
  a propósito, un número inventado por un fallo de red es peor que no tener
  número. El bot dice «déjame confirmarlo», no adivina.
- **`material`** — los charms son Plata Esterlina 925 y los brazaletes son **baño
  de plata**. Confundirlos es publicidad engañosa, y hay una prueba que lo vigila
  (`pruebas/disponibilidad.js` § 4).

**Cuándo el Agent la llama:** al empezar la conversación, y de nuevo si pasa
rato — la disponibilidad cambia con cada venta. La respuesta se cachea un minuto
del lado del servidor, así que preguntar seguido no golpea Blobs.

**Instrucción en el prompt:**
```
Si alguien pregunta por existencia, llama a disponibilidad() y responde con lo 
que devuelve. Si `fuente` es "solo-conteo", NO des números: di que lo confirmas 
y sigue la conversación. Los charms son Plata Esterlina 925; los brazaletes son 
baño de plata — nunca los llames plata a secas.
```

---

#### 2.3.2 · Herramienta: Armar Carrito

**Llama:** `https://zephoracharms.com/armar-carrito`

**Método:** POST

**Body** — la misma forma que acepta el checkout, a propósito:

```json
{
  "base": { "id": "pulsera-copo-de-nieve", "talla": "19" },
  "charms": ["letra-a", "letra-a", "letra-b"],
  "empaque": true,
  "pago": "anticipado"
}
```

**Respuesta (200):**

```json
{
  "enlace": "https://zephoracharms.com/checkout.html?p=pulsera-copo-de-nieve@19,letra-a*2,letra-b&e=1&via=wa",
  "total": 262840,
  "totalTexto": "$262.840",
  "subtotal": 262840,
  "descuento": 34200,
  "envio": 0,
  "envioGratis": true,
  "piezas": 4,
  "lineas": [
    { "nombre": "Brazalete Copo de Nieve", "talla": "19", "unidades": 1, "precio": "$114.000" }
  ],
  "disponibilidad": "real",
  "aviso": "Disponibilidad referencial: conteo manual menos lo apartado por pagos en curso."
}
```

**Qué devuelve:**
- `enlace` — URL al **checkout de siempre**, lista para mandar por WhatsApp
- `totalTexto` — ya formateado en pesos colombianos, para que el modelo no
  escriba `$262,840` (que aquí se lee como otra cifra)
- `lineas` — con **nombre legible**, para que el bot no traduzca identificadores
- `disponibilidad` — `'real'` o `'sin-lectura'`; con lo segundo, el bot matiza

**Errores, con el mismo contrato que usa el checkout:**

| Código | Cuándo | Qué hace el bot |
|---|---|---|
| `400` | Pieza desconocida, talla inválida, más de 60 charms, carrito vacío | Corrige y vuelve a preguntar |
| `409` + `agotado: true` | Se agotó algo (incluido lo apartado por un pago en curso) | Relata el mensaje tal cual y ofrece alternativas |

**Cuándo el Agent la llama:** después de que la clienta decide qué quiere, justo
antes de armar el mensaje con el enlace.

**Instrucción en el prompt:**
```
Cuando la clienta haya elegido sus piezas, llama a armar-carrito() con la 
selección. Usa `totalTexto` y `enlace` TAL CUAL vienen — no reformatees el 
precio ni reescribas la URL. Si responde 409, lee el mensaje de error a la 
clienta y ofrece alternativas; no insistas con la misma pieza.
```

---

#### 2.3.3 · Herramienta: Guardar Conversación (opcional, para debugging)

**Llama:** n8n Data Table `"Conversaciones Zephora"` (crear si no existe)

**Qué guarda:** Un registro por conversación con:
- Número de clienta
- Mensaje entrante
- Respuesta del bot
- Herramientas que llamó
- Timestamp

**Por qué existe:** Si el bot dice algo raro o no entiende, se puede revisar qué sucedió exactamente. En producción, útil para entrenar mejoras.

**Nota:** No es bloqueante — si falla, el bot sigue respondiendo de todas formas.

---

### 2.4 · Nodo de salida: WhatsApp Business Cloud

**Qué hace:** Envía la respuesta del AI Agent de vuelta al número que escribió.

**Configuración:**

| Campo | Valor |
|---|---|
| **Credential** | WhatsApp Business Cloud (misma que el trigger) |
| **To** | `{{ $node["WhatsApp Trigger"].json.messages[0].from }}` |
| **Message Type** | `text` (solo texto, sin plantilla) o `template` (si está dentro de 24h) |
| **Message Text** | `{{ $node["AI Agent"].json.text }}` |

**Regla crítica:** Nunca interpolar variables de modelo directo aquí. Si la respuesta lleva dinero, el modelo ya lo interpoló desde la herramienta (`armar-carrito`).

---

## 3 · El endpoint `/armar-carrito` — **hecho 2026-08-28**

`netlify/functions/armar-carrito.mjs`, con `pruebas/armar-carrito.js` en verde.

**Qué hace:** recibe base + charms + empaque + pago, valida con el **mismo
lector** que usa `crear-pago` (`leerPedido`), comprueba inventario dos veces,
calcula el total con `calcular()`, y devuelve un enlace a `checkout.html`.

### Lo que NO hace, que es la decisión importante

**No escribe nada.** No guarda registro, no genera referencia, no aparta
inventario, no habla con Wompi.

El plan original decía que guardara el pedido en Blobs con estado
`esperando-pago` y devolviera un enlace de `/reanudar?ref=…`. Se descartó al
verificarlo contra el código, por tres razones:

- **Envenenaría el rescate.** `rescatables()` en `rescate.mjs` filtra
  exactamente `estado === 'esperando-pago'`. Cada conversación de WhatsApp en la
  que el bot armara un carrito dejaría un checkout abandonado que nunca existió,
  y a la mañana siguiente el propietario recibiría una lista de pedidos que nadie
  empezó. Peor: si ese registro fantasma llevara `optin`, saldría un **correo
  automático de recuperación por una compra imaginaria**.
- **El registro no se puede construir.** `leerCliente()` exige nombre, apellido,
  documento, celular, correo, departamento, ciudad y dirección. El bot tiene un
  dato: un número de teléfono.
- **Duplicaría estado que ya tiene dueño.** `/reanudar` existe para resucitar un
  checkout abandonado de verdad.

Es la misma decisión que ya se tomó en `reanudar.mjs`: **un solo sitio donde se
decide cuánto se cobra.** El enlace lleva al checkout de siempre, la clienta pone
sus datos, y `crear-pago` recalcula, aparta, firma y cobra.

### Dos comprobaciones de inventario, no una

- `comprobarInventario()` mira `stock.json` —el último conteo a mano— y trae los
  mensajes en español que la clienta va a leer.
- `disponibles()` mira además **lo apartado por pagos en curso**. Es la que caza
  que la última unidad la esté pagando alguien ahora mismo, que por WhatsApp
  duele más: en el checkout lo corrige una pantalla, aquí hay una persona a la
  que ya se le dijo que sí.

Si no se puede leer lo apartado, se responde igual con `disponibilidad:
'sin-lectura'` — el precio es bueno, la disponibilidad es la del último conteo.
Lo que no pasa nunca es devolver un enlace con un precio inventado.

### El escritor de la URL es uno solo

`_carrito.mjs` tiene la función que escribe `?p=…`, y la usan **las dos**
funciones (`reanudar` y `armar-carrito`). Las páginas ya tienen cada una su copia
del lector y eso no se puede evitar; lo que sí se evita es una segunda copia del
escritor, porque `pruebas/reanudar.js` § 3 comprueba su salida contra la
expresión regular real de los dos HTML. Con un escritor, esa prueba cubre los
cuatro sitios; con dos, cubriría uno y el otro podría separarse en silencio.

---

## 4 · Memoria y sesiones

El AI Agent de n8n guarda memoria automáticamente usando el `sessionKey`.

**Cómo funciona:**

```
Clienta: "¿Tienes pulsera de corazón?"
Bot: "Sí, en tallas 19 y 20. ¿Cuál prefieres?"

← Bot recuerda: "sesión 573001234567 está hablando de pulsera-corazon"

Clienta: "La de 19. Y dos iniciales A."
Bot: "Perfecto. Tu pedido: pulsera + 2 charms iniciales A = $187.450"

← Bot recuerda toda la conversación sin que haya que guardarla a mano
```

**Límite:** n8n guarda memoria mientras la sesión esté activa. Cuando cierren el chat (24 horas sin mensajes), se limpia. Eso es **por diseño** — no queremos guardar datos de gente para siempre.

---

## 5 · Casos de uso principales

### Caso 1: Consulta simple (sin compra)

```
Clienta: "¿Tienes pulseras de corazón?"
         ↓
Agent llama disponibilidad(["pulsera-corazon-*"])
         ↓
Agent: "Sí, tengo en tallas 19 y 20. ¿Cuál te gustaría?"
```

Sin herramientas de venta, solo conversación.

---

### Caso 2: Compra completa

```
Clienta: "Pulsera de corazón en 19 y dos iniciales A"
         ↓
Agent: Valida con disponibilidad(["pulsera-corazon|19", "charm-inicial-a"])
       ↓ Llama armar-carrito({base, charms})
       ↓ Recibe {enlace, totalTexto, lineas}
       ↓
Agent: "Tu pedido: pulsera + 2 iniciales A = $187.450
         Termínalo aquí 👉 https://…/checkout.html?p=…&via=wa"
```

El enlace lleva al checkout de siempre. De ahí en adelante el pedido sigue el
camino de cualquiera: la clienta pone sus datos y `crear-pago` recalcula,
aparta, firma y cobra. El bot no genera ningún cobro.

---

### Caso 3: Cambio de opinión mid-conversación

```
Clienta: "Dos iniciales A"
         ↓
Clienta: "Espera, mejor una A y una B"
         ↓
Agent: Actualiza la sesión (memoria)
       ↓ Llama armar-carrito({base, charms: ["A", "B"]})
       ↓
Agent: "Bien. Ahora: pulsera + 1 A + 1 B = $156.200 COP
         https://..."
```

No acumula "A + A + B". El carrito siempre es la decisión final.

---

### Caso 4: Pieza agotada

```
Clienta: "¿Tienes inicial Z?"
         ↓
Agent llama disponibilidad(["charm-inicial-z"])
       ↓ Respuesta: {} (vacío, no existe)
       ↓
Agent: "No tenemos inicial Z disponible en este momento.
        Tengo A, B, C... ¿alguna de estas?"
```

Nunca dice "voy a suponerla". Dice exactamente lo que hay.

---

## 6 · Guardrails del modelo — lo que NUNCA puede hacer

### No puede inventar existencia

```
❌ MALO:
Clienta: "¿Tienes la inicial Z?"
Bot: "Sí, tengo. Serían $77.450"

✅ BIEN:
Bot: llama disponibilidad(["charm-inicial-z"])
     → respuesta: {} (no existe)
Bot: "No tenemos inicial Z. Ofrezco A, B, C..."
```

### No puede inventar precio

```
❌ MALO:
Bot: "Pulsera de corazón + 2 iniciales = $150.000"
     (el bot escribió el número)

✅ BIEN:
Bot: llama armar-carrito({base, charms})
     → respuesta: {totalTexto: "$187.450", enlace: "https://…"}
Bot: "Tu pedido = $187.450
      https://…"
```

`totalTexto` viene ya formateado a propósito: si el modelo formatea el número,
acaba escribiendo `$187,450`, que en Colombia se lee como ciento ochenta y siete
pesos con cuarenta y cinco centavos.

### No puede confirmar talla que no existe

```
❌ MALO:
Clienta: "Pulsera de corazón en talla 47"
Bot: "Listo, talla 47 confirmada"
     (47 no existe)

✅ BIEN:
Bot: llama disponibilidad(["pulsera-corazon|47"])
     → respuesta: {} (no existe)
Bot: "Esa talla no la tengo. Ofrezco 19, 20, 21..."
```

### No puede improvisar política

```
❌ MALO:
Clienta: "¿Hacen descuento por 3 pulseras?"
Bot: "Claro, 20% de descuento"
     (política que no existe)

✅ BIEN:
Bot: "Buena pregunta. Déjame contactar con el equipo
      para ver si puedo hacer algo especial."
```

---

## 7 · Testing antes de producción (banco de conversaciones)

Antes de que el bot toque el número real, hay que probar contra **casos que ya le pasaron a otras piezas de esta tienda.**

**Formato de test:** Archivo `automatizaciones/conversion/BOT-TESTS.md` con conversaciones de prueba.

**Ejemplo:**

```
Test 1: Consulta + venta exitosa
├─ Entrada: "Hola, ¿pulsera de corazón?"
├─ Esperado: Bot ofrece tallas disponibles
└─ ✅ PASA

Test 2: Pieza agotada
├─ Entrada: "¿Tienes inicial Z?"
├─ Esperado: Bot dice "no disponible" + ofrece alternativas
└─ ✅ PASA

Test 3: Cambio de opinión
├─ Entrada: "Dos A... espera, una A y una B"
├─ Esperado: Carrito final tiene A + B, no A + A + B
└─ ✅ PASA
```

**Cómo correr:** Antes de cambiar producción, lanzar los tests. Si alguno falla, diagnosticar qué sucedió antes de desplegar.

---

## 8 · Lo que falta para que esto funcione

| Cosa | Responsabilidad | Plazo |
|---|---|---|
| **App WhatsApp Business verificada** | Propietario | Semanas (trámite Meta) |
| **Número de WhatsApp** | Propietario | Junto con app |
| **Credencial en n8n** | Propietario | Minutos (una vez tenga app) |
| **Credencial del modelo** | Propietario | Minutos (token de Claude API) |
| **Endpoint `/armar-carrito`** | Nosotros (código) | ✅ hecho 2026-08-28 |
| **Workflow en n8n (nodos)** | Nosotros | Bloqueado por las credenciales de arriba |
| **Banco de conversaciones** | Nosotros | Cuando exista el bot contra el que correrlo |

---

## 9 · Checklist de implementación

### Código

- [x] `netlify/functions/armar-carrito.mjs` · **2026-08-28**, sin estado
- [x] `netlify/functions/_carrito.mjs` · el escritor de la URL, compartido
- [x] `pruebas/armar-carrito.js` · 40 comprobaciones, en verde
- [x] Ruta `/armar-carrito` en `netlify.toml`
- [ ] Banco de conversaciones de prueba (`BOT-TESTS.md`) — necesita el bot
- [ ] Desplegar · la cuenta de functions sube a **13**

### n8n (cuando lleguen credenciales)

- [ ] Crear data table `"Conversaciones Zephora"` (si no existe)
- [ ] Agregar nodo WhatsApp Business Cloud (trigger)
- [ ] Agregar nodo AI Agent con 3 herramientas
- [ ] Agregar nodo WhatsApp Business Cloud (salida)
- [ ] Configurar sesiones por número de teléfono
- [ ] Probar contra banco de conversaciones
- [ ] Publicar workflow (no activar hasta que el propietario diga)

### Propietario

- [ ] Registrar app WhatsApp Business en Meta
- [ ] Agregar credencial en n8n
- [ ] Agregar credencial de modelo en n8n
- [ ] Autorizar que el bot escriba a números reales
- [ ] Presupuesto: calcular costo mensual (tokens + mensajes)

---

## 10 · Diferencias con rescate automático (Fase A)

| Aspecto | Rescate (Fase A) | Bot (Fase 2) |
|---|---|---|
| **Disparador** | Cron (9:00 COL cada mañana) | Mensaje WhatsApp entrante |
| **Destinatario** | `cliente.correo` | `messages[0].from` (WhatsApp) |
| **Lógica** | Fija: "retoma tu pedido" | Conversacional: el bot decide qué decir |
| **Herramientas** | `rescate.mjs` (lista abandonados) | Agent (conversa + llama funciones) |
| **Almacenamiento** | No crea registro nuevo | Genera nuevo `ref` + estado |
| **Autorización** | Mira `cliente.optin` | N/A (si escriben, ya autorizaron) |

---

## 11 · Notas de seguridad

- **Las dos herramientas que el bot puede llamar son de solo lectura.**
  `/disponibilidad` y `/armar-carrito` no escriben nada: ni registro, ni reserva,
  ni cobro. Lo comprueba `pruebas/armar-carrito.js` § 6 sobre el código, no sobre
  el comportamiento — una prueba de comportamiento no cazaría una escritura
  añadida mañana.
- **Las respuestas con dinero no vienen del modelo.** Vienen de
  `armar-carrito`, que usa el mismo `calcular()` con el que cobra el checkout.
- **Los dos endpoints son públicos y no exponen nada nuevo.** Precios y
  disponibilidad ya están en la tienda; `/armar-carrito` no revela nada que no
  se pueda calcular desde `/disponibilidad`.
- **Sesión = conversación abierta por clienta.** A las 24 horas sin mensajes la
  memoria se limpia. Es por diseño: no queremos guardar datos de gente para
  siempre.
- **Números de teléfono.** El bot los usa como clave de sesión, no los guarda en
  el repo ni los manda a ningún sitio. Si algún día se manda un `Purchase` a
  Meta desde aquí, va hasheado con SHA-256 como ya hace `_meta.js`.

