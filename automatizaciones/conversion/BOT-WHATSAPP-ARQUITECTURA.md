# Arquitectura del bot de WhatsApp — n8n, nodos, flujo

Este documento describe cómo se construye el bot que cierra ventas por WhatsApp. **No es código** — es la arquitectura de nodos, decisiones de diseño, y qué hace cada pieza. Cuando lleguen las credenciales, esto es el plano.

Sigue la **guía de mejores prácticas de n8n para chatbots** (verificada contra su documentación oficial, no de memoria).

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

**Llama:** `https://zephora-charms.netlify.app/.netlify/functions/disponibilidad`

**Método:** POST

**Body:**

```json
{
  "skus": ["pulsera-corazon-liso", "pulsera-corazon-liso|19", "charm-inicial-a"]
}
```

**Respuesta esperada:**

```json
{
  "fuente": "conteo-menos-apartado",
  "piezas": {
    "charm-inicial-a": 5,
    "pulsera-corazon-liso": 0,
    "pulsera-corazon-liso|19": 2,
    "pulsera-corazon-liso|20": 1
  }
}
```

**Cuándo el Agent la llama:**
- "¿Tienes letra E?" → Agent llama con `["charm-inicial-e"]`
- "¿Y en talla 19?" → Agent llama con `["pulsera-...|19"]`
- Antes de armar carrito → valida que lo que va a ofrecer existe

**Instrucción en el prompt:**
```
Si alguien pregunta por existencia, llama a la herramienta disponibilidad().
Siempre dile lo que la herramienta devuelve, nunca adivines.
```

---

#### 2.3.2 · Herramienta: Armar Carrito

**Llama:** `https://zephora-charms.netlify.app/.netlify/functions/armar-carrito` (endpoint nuevo, ver sección 3)

**Método:** POST

**Body:**

```json
{
  "base": {
    "id": "pulsera-corazon-liso",
    "talla": "19"
  },
  "charms": ["charm-inicial-a", "charm-inicial-a", "charm-inicial-b"],
  "empaque": true,
  "pago": "anticipado"
}
```

**Respuesta esperada:**

```json
{
  "ref": "xyz789",
  "enlace": "https://zephora-charms.netlify.app/reanudar?ref=xyz789",
  "precio_total": 187450,
  "moneda": "COP",
  "piezas": 4
}
```

**Qué devuelve:**
- `ref`: Identificador que guardamos en Blobs (el mismo que luego leerá `/reanudar`)
- `enlace`: URL completa lista para enviar por WhatsApp
- `precio_total`: El precio real que el checkout cobrará (recalculado en servidor)
- `piezas`: Cantidad de unidades en el carrito (brazalete + charms)

**Cuándo el Agent la llama:**
- Después de que la clienta decide qué quiere (base + charms)
- Justo antes de armar el mensaje con el enlace

**Instrucción en el prompt:**
```
Cuando la clienta haya elegido brazalete y charms, llama a armar-carrito() 
con su selección. La respuesta trae el precio final, el enlace y cuántas 
piezas tiene el carrito. Usa esos datos en tu respuesta, nunca inventes.
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

## 3 · El nuevo endpoint: `/armar-carrito`

**Crear:** `netlify/functions/armar-carrito.mjs`

**Qué hace:**
1. Recibe base + charms + empaque + pago
2. Valida que existan en catálogo y haya stock
3. Llama `_precios.js` para calcular total (mismo que usa el checkout)
4. Genera un `ref` único
5. Guarda el registro en Blobs con estado `'esperando-pago'` (como lo hace `crear-pago.mjs`)
6. Devuelve `{ref, enlace, precio_total, moneda, piezas}`

**Por qué existe:**
- El bot no puede escribir en Blobs directamente
- El precio debe venir del servidor, recalculado en tiempo real
- El `ref` debe ser único y determinista (para dedup de Meta)

**Estructura del código:**

```javascript
export default async (req) => {
  const { base, charms, empaque, pago } = JSON.parse(req.body);
  
  // 1. Validar que existan en catálogo
  // 2. Validar stock con disponibilidad.mjs
  // 3. Calcular precio con _precios.js → _detallar()
  // 4. Generar ref único
  // 5. Guardar en Blobs
  // 6. Devolver { ref, enlace, precio_total, moneda, piezas }
};
```

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
       ↓ Recibe {ref, enlace, precio}
       ↓
Agent: "Tu pedido: pulsera + 2 iniciales A = $187.450 COP
         Retómalo aquí 👉 https://...reanudar?ref=xyz"
```

El enlace lleva directo al checkout. De ahí en adelante, la magia es del checkout (recalcula, firma, cobra).

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
     → respuesta: {precio_total: 187450}
Bot: "Tu pedido = $187.450 COP
      https://..."
```

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
| **Endpoint `/armar-carrito`** | Nosotros (código) | Esta sesión |
| **Workflow en n8n (nodos)** | Nosotros (código + n8n UI) | Esta sesión (antes de creds) |
| **Tests (conversaciones)** | Nosotros (código) | Esta sesión |

---

## 9 · Checklist de implementación

### Código (esta sesión)

- [ ] Crear `netlify/functions/armar-carrito.mjs`
- [ ] Tests unitarios de `armar-carrito` en `pruebas/`
- [ ] Documentar casos de uso en `BOT-TESTS.md`
- [ ] Desplegar (agregar 1 function más → 12 en total)

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

- **N8n solo puede leer `/disponibilidad` y `/armar-carrito`.** No puede tocar Wompi, no puede firmar pagos.
- **Todos los números van hasheados a Meta.** El bot no guarda teléfono en plain text.
- **Las respuestas con dinero no vienen del modelo.** Vienen de `armar-carrito`, que usa el mismo código que el checkout.
- **Sesión = conversación abierta por clienta.** Cuando pasan 24 horas sin mensajes, memoria se limpia.

