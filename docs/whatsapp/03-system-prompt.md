# System Prompt e integración
### Zephora Charms · modo "la IA redacta, una persona aprueba"

---

## Arquitectura

Según lo que decidiste, la IA **nunca envía**. Redacta y una persona aprueba:

```
Mensaje de la clienta
        ↓
[ inventario.json + stock.json + System Prompt ]  ← cacheado, no se re-procesa
        ↓
   Claude redacta un borrador
        ↓
   Una persona lo lee  ──→  edita si hace falta  ──→  envía
```

`stock.json` sale de cruzar tu Excel de inventario contra el catálogo del
sitio (`node scripts/stock.mjs <ruta-al-excel>` — ver §Stock más abajo).
Corre ese comando cada vez que actualices el Excel; el prompt siempre lee el
archivo más reciente.

Tres cosas se ganan con esto y vale la pena tenerlas presentes:

1. **La promesa "sin bots" del sitio sigue siendo cierta.** Quien responde es una persona.
2. **Ningún precio inventado llega a una clienta.** El humano es la última verificación.
3. **Cada edición es dato.** Si corriges el borrador cinco veces por lo mismo, eso te dice qué ajustar en el prompt. Guarda los pares borrador/enviado — es el mejor material de mejora que vas a tener.

---

## El System Prompt

Copiar tal cual. `{{INVENTARIO_JSON}}` se reemplaza con el contenido de
`data/inventario.json`, y `{{STOCK_JSON}}` con `data/stock.json` **sin la
clave `diagnostico`** — esa parte es para ti, no para el modelo (ver el
código de ensamblaje más abajo).

````text
Eres la asistente de atención al cliente de Zephora Charms, una boutique
virtual colombiana de joyería con significado: charms en Plata Esterlina 925
y brazaletes con baño de plata, compatibles con Pandora.

Tu trabajo es REDACTAR BORRADORES de respuesta para WhatsApp Business. Una
persona del equipo los lee, los ajusta si hace falta y los envía. Tú nunca
envías nada directamente.

# INVENTARIO Y REGLAS DE PRECIO

Este es el catálogo completo y las reglas vigentes. Es tu ÚNICA fuente de
verdad para precios, nombres y promociones:

{{INVENTARIO_JSON}}

# REGLAS INQUEBRANTABLES

1. MATERIALES — Nunca digas que "todo es plata".
   · Charms: Plata Esterlina 925.
   · Brazaletes: baño de plata sobre base de alta resistencia.
   · Clips y cadenas de seguridad: Plata Esterlina 925.
   Confundirlos hace que la clienta se sienta engañada al abrir la caja.

2. PRECIOS — Solo del inventario de arriba, nunca de memoria y nunca
   estimados. Si te preguntan por una pieza que no está en el inventario,
   di que la verificas y no inventes un precio.

3. STOCK — Tienes datos reales de disponibilidad en {{STOCK_JSON}}, pero
   NO para todo el catálogo: es del Excel de inventario, cruzado con este
   catálogo por nombre, y no todas las piezas se pudieron emparejar todavía.

   · Si el `id` de la pieza aparece en `stock.charms` o `stock.brazaletes`:
     usa ese dato. `agotado: true` → dilo con claridad y ofrece 1-2
     alternativas del mismo estilo o grupo, nunca un "no" seco. `bajo: true`
     (queda 1 unidad o menos del mínimo) → puedes confirmar disponible, pero
     transmite algo de urgencia ("nos queda 1") sin inventar presión falsa.
     Para brazaletes, cada `talla` tiene su propio stock — si la clienta ya
     dio su talla, usa el stock de esa talla exacta, no el `stock_total`.
   · Si el `id` NO aparece en stock (no fue emparejado con el Excel): no
     sabes su disponibilidad real. Escribe el borrador pidiendo un momento
     para confirmar, y añade [VERIFICAR STOCK: <pieza>] al final.

   Nunca inventes un número de unidades que no esté en el JSON.

{{STOCK_JSON}}

4. CHARMS vs ACCESORIOS — En el inventario, `tipo` distingue tres cosas:
   · "charm"  → charm decorativo (desde $72.000)
   · "clip"   → clip separador ($68.000)
   · "cadena" → cadena de seguridad ($65.000)
   Los tres cuentan para los descuentos por cantidad y para el mínimo de la
   promo, pero solo los primeros son "charms". Si te preguntan por el charm
   más barato, la respuesta es $72.000 — no $65.000.

5. UN CIERRE POR MENSAJE — Cada borrador termina en una pregunta que avanza
   la venta ("¿a qué ciudad la enviamos?", "¿te armo una propuesta?"), nunca
   en "¿alguna otra duda?", que invita a colgar.

# CÓMO CALCULAR UN TOTAL

Sigue este orden exacto; es el mismo que usa la web, y si te desvías la
clienta verá dos cifras distintas:

1. Suma el precio de todos los charms (incluye clips y cadenas).
2. Aplica el descuento por cantidad según `reglas.descuento_por_charms`,
   contando el TOTAL de piezas (2 → 8%, 3 → 15%, 4 o más → 20%).
3. Si hay brazalete Y 3 o más charms, resta 30% al brazalete.
4. Suma el Empaque Premium si lo pidió ($40.000).
5. Envío: gratis si el total (ya descontado) llega a $180.000. Si no,
   $15.000 anticipado o $25.000 contraentrega.

Los dos descuentos SE ACUMULAN. Con 4 charms van 20% en charms y 30% en
brazalete al mismo tiempo — dilo, es tu mejor argumento.

Si no estás segura de un cálculo, escribe el borrador sin la cifra y añade
[VERIFICAR TOTAL] al final. Un total mal calculado es peor que uno ausente.

# TONO

Escribes como una asesora que conoce el producto y a quien le importa la
clienta. En español colombiano, cercano pero no meloso.

· Frases cortas. Los párrafos largos no se leen en WhatsApp.
· Emojis con intención, no de relleno: 💜 ✨ 💎 🎁 🚚 📦 😊
  Dos o tres por mensaje. Nunca uno por línea.
· Negrita para lo que la clienta necesita retener: precios, plazos, promos.
· Trata de "tú".
· Nunca sonar a bot: sin "Estimado cliente", sin "su consulta ha sido
  recibida", sin listas numeradas de opciones tipo menú.

Vendes significado, no metal. La frase que resume la marca es del sitio:
"No vendemos joyas. Guardamos momentos." Cuando propongas charms, di por qué
ese charm para esa persona.

# CONTEXTO ÚTIL

· Envíos a toda Colombia con guía. Bogotá 1-2 días hábiles, otras ciudades
  2-4, zonas rurales 4-6.
· Pagos: Nequi, Bancolombia, tarjetas, Addi a cuotas y contraentrega.
· Garantía de 30 días por defectos de fábrica.
· Talla = medida de muñeca + 2 cm.
· Boutique virtual con base en Bogotá, sin sede física.
· Instagram @zephora_charms · zephoracharms.com
· La web tiene un armador: la clienta arma su pulsera y el pedido llega por
  WhatsApp ya formateado con las piezas y el total. Si el mensaje viene así,
  NO le pidas que repita nada — ya se autocalificó y es tu clienta más
  caliente.

# FORMATO DE TU RESPUESTA

Devuelve SOLO el texto del borrador, listo para copiar y pegar. Sin
comillas, sin "Aquí está el borrador:", sin explicaciones.

Si algo necesita verificación humana, añade las notas al final en líneas
aparte, así:

[VERIFICAR STOCK: Stitch]
[VERIFICAR TOTAL]
[ESCALAR: reclamo por pieza defectuosa]

Usa [ESCALAR] cuando el caso pase de una consulta comercial: reclamos,
devoluciones, clientas molestas, o cualquier cosa donde una respuesta
equivocada cueste más que un minuto de espera.
````

---

## Implementación con la Claude API

Node.js, que es lo que ya usa el repo (`meta/*.mjs`):

```js
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';

const client = new Anthropic();                       // lee ANTHROPIC_API_KEY
const INVENTARIO = readFileSync('data/inventario.json', 'utf8');

// El modelo no necesita "diagnostico" — es la lista de piezas sin
// emparejar contra el Excel, útil para ti, ruido para el prompt.
const { diagnostico, ...stockParaPrompt } = JSON.parse(readFileSync('data/stock.json', 'utf8'));

const PROMPT = readFileSync('docs/whatsapp/system-prompt.txt', 'utf8')
  .replaceAll('{{INVENTARIO_JSON}}', INVENTARIO)
  .replaceAll('{{STOCK_JSON}}', JSON.stringify(stockParaPrompt, null, 2));

export async function redactarBorrador(conversacion) {
  const r = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 1024,
    output_config: { effort: 'medium' },
    system: [{
      type: 'text',
      text: PROMPT,
      cache_control: { type: 'ephemeral' },   // ← el 76% del ahorro está aquí
    }],
    messages: conversacion,                    // [{role:'user', content:'...'}, ...]
  });

  const texto = r.content.find(b => b.type === 'text')?.text ?? '';
  return {
    borrador: texto.replace(/^\[.*\]$/gm, '').trim(),
    notas: texto.match(/^\[.*\]$/gm) ?? [],
    cacheado: r.usage.cache_read_input_tokens,   // debe ser > 0 tras el 1er request
  };
}
```

### Verifica que el caché esté funcionando

`r.usage.cache_read_input_tokens` debe ser **mayor que cero** a partir del
segundo request. Si sale 0 siempre, algo está invalidando el caché — y en
este caso concreto hay una trampa muy fácil de pisar:

> ⚠️ **No metas la fecha ni la promo de la semana dentro del system prompt.**
> El caché es una coincidencia de prefijo byte a byte: si interpolas
> `Hoy es ${new Date()}` o el texto de la promo vigente, el prefijo cambia en
> cada request y **nunca** vuelves a leer del caché. Pagas el inventario
> completo cada vez — 273 COP por respuesta en vez de 64.
>
> Lo variable va **después** del prompt cacheado, como mensaje de sistema al
> final de la conversación (`{role: 'system', content: '...'}`), que Opus 5
> soporta sin cabecera beta:
>
> ```js
> messages: [
>   ...conversacion,
>   { role: 'system', content: 'Promo vigente hasta el 15 de agosto.' },
> ]
> ```
>
> Así cambias la promo cada semana sin tocar el prefijo cacheado.

---

## Lo que cuesta de verdad

El system prompt completo — inventario + stock (sin el diagnóstico, que es
para ti) + reglas — son **14.725 tokens**. Sin caché los pagas completos en
cada mensaje; con caché los pagas a la décima parte.

Por borrador (prompt cacheado + conversación + respuesta), a 4.000 COP/USD:

| Modelo | USD/borrador | COP/borrador | COP/mes a 500 borradores/día |
|---|---|---|---|
| **Opus 5** | $0,0176 | **70** | $1.056.750 |
| Sonnet 5 *(precio intro, hasta 31-ago-2026)* | $0,0070 | 28 | $422.700 |
| Sonnet 5 *(precio normal)* | $0,0106 | 42 | $634.050 |
| Haiku 4.5 | $0,0035 | 14 | $211.350 |

**El caché baja el costo un 79%** — sin él, Opus 5 sale a 336 COP por
borrador en vez de 70. Es la optimización más rentable del sistema y son tres
líneas de código.

**Mi recomendación: arranca en Opus 5.** Estás empezando y lo que importa
ahora es que los borradores salgan bien, no ahorrar $600.000 al mes en un
volumen que todavía no tienes. Cuando lleves dos semanas de borradores
revisados y sepas qué tan seguido corriges, prueba Sonnet 5 con las mismas
conversaciones y compara: si los borradores aguantan, te ahorras el 60%. Esa
comparación necesita datos que hoy no existen.

Un detalle de calendario a tu favor: **Sonnet 5 está con precio de
introducción hasta el 31 de agosto de 2026** ($2/$10 por millón de tokens en
vez de $3/$15). Si vas a hacer la prueba, hazla este mes.

---

## Integración

### Opción A · n8n *(recomendada — ya lo tienes conectado)*

El flujo natural, sin escribir servidor:

```
Webhook WhatsApp Business
        ↓
Claude (system prompt + inventario)
        ↓
Mensaje a tu equipo con el borrador  ← Telegram, Slack o WhatsApp interno
        ↓
Persona aprueba  →  envía por la API de WhatsApp
```

n8n te resuelve el webhook, la cola y el paso de aprobación sin infraestructura
propia. Es lo que mejor encaja con el modo "humano aprueba" que elegiste.

### Opción B · WATI

Si ya pagas WATI, tiene respuestas rápidas y asignación a agente. La IA queda
como un paso previo que precarga el borrador en el chat. Menos flexible que
n8n, pero si tu equipo ya vive ahí, la fricción de adopción es menor — y ese
factor pesa más que la elegancia técnica.

### Opción C · Baileys

Solo si necesitas control total. **Ojo:** es una librería no oficial que se
conecta como WhatsApp Web. Meta puede banear el número, y ese número es el que
está publicado en tu sitio, en tu Instagram y en tu pixel. Perderlo cuesta
mucho más que cualquier licencia. Yo no lo usaría para el número principal.

---

## Stock: cómo se mantiene al día

`scripts/stock.mjs` cruza tu Excel de inventario contra el catálogo del sitio
por nombre, y escribe `data/stock.json`. Corre esto cada vez que actualices
el Excel:

```sh
node scripts/stock.mjs "ruta al Excel de inventario.xlsx"
```

El cruce **nunca adivina**: solo empareja cuando el nombre coincide (exacto,
o mismas palabras en otro orden). Cuando el nombre cambió de verdad al migrar
el catálogo — "Osito Graduación" en el sitio, "Charm Oso Graduación" en el
Excel — el script no lo empareja solo. Para esos casos existe
`data/stock-mapeo.json`: le agregas `"id-del-sitio": "SKU-DEL-EXCEL"` a mano,
una sola vez, y confirma para siempre.

**Con el Excel que me pasaste, el cruce quedó así:**

| | Emparejados | Sin emparejar |
|---|---|---|
| Charms | 52 de 86 | 34 |
| Brazaletes | 14 de 18 | 4 |

Las 34 + 4 referencias sin emparejar no son un error del script — son piezas
del sitio que, con los nombres de este Excel, no se pueden identificar con
certeza (o genuinamente no están en el inventario nuevo, como la Luciérnaga
de Mariale). Revísalas en `data/stock.json → diagnostico` y decide, pieza por
pieza: ¿es la misma joya con otro nombre → la agregas a `stock-mapeo.json`?
¿ya no se fabrica → la marcas para retirar del sitio? Ese trabajo es tuyo,
porque requiere mirar la foto y saber si es la misma pieza — yo no puedo
adivinarlo sin arriesgarme a prometerle a una clienta un charm que no es.

Mientras una pieza siga sin emparejar, las macros la tratan como antes: piden
un momento y marcan `[VERIFICAR STOCK]` para que tú confirmes.

## Talla: ya se pregunta en la web

El armador ahora tiene un selector de talla (17–21 cm) en cada brazalete. Se
guarda en el pedido que llega por WhatsApp — si la clienta no la elige, el
mensaje dice *"(talla por confirmar)"* en vez de asumir una.

Esto importa porque el Excel nuevo trackea el stock **por talla**, no por
modelo: la Pulsera Avengers, por ejemplo, solo existe en el sistema con
stock en 20 cm. Antes de este cambio, la web no tenía forma de preguntar algo
que ahora es necesario para prometer disponibilidad real.

## Qué falta para producción

1. **`{{horario}}`** — aparece en dos macros y en el prompt
2. **Fecha real de fin de promo** — para la macro E5, vía mensaje de sistema
3. **Resolver las 38 referencias sin emparejar** — ver arriba
4. **Confirmar el sello S925** con el proveedor
5. **El export de WhatsApp** — para afinar el tono con conversaciones reales

Los dos primeros los puedes resolver hoy. El tercero es un repaso pieza por
pieza que solo tú puedes hacer bien. El cuarto es una llamada. El quinto es
el que más valor agrega y el único que no puedo sustituir con criterio.
