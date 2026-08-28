# API del endpoint `/reanudar` — cómo lo usan ambas automatizaciones

El endpoint `/reanudar` es el destino del **correo de recuperación de carritos
abandonados**: la clienta llegó al final del checkout, se fue sin pagar, y este
enlace la devuelve a su pedido armado.

**No toca dinero. No firma nada. No llama a Wompi.** Solo revalida stock y arma
un carrito en la URL para que el checkout existente haga su trabajo.

> **El bot de WhatsApp no usa este endpoint** — usa `/armar-carrito`, que no
> escribe nada. El porqué está en el § 6, y no es un detalle: si el bot acuñara
> referencias, el rescate del día siguiente sacaría una lista de checkouts
> abandonados que nunca existieron.

---

## 1 · Propósito

Cuando una clienta abandona un checkout y llega mínimo 2 horas después (por correo o por WhatsApp), las unidades que se apartaron ya se liberaron — la reserva en `_inventario.mjs` caduca a los 30 minutos.

Este endpoint:
1. Lee el pedido del registro guardado en Blobs
2. Revalida qué queda de verdad en inventario
3. Recorta la selección a lo disponible
4. Marca que se actuó sobre ese pedido (para evitar duplicar correos)
5. Redirige al checkout con el carrito cargado en la URL

---

## 2 · Cómo llamarlo

**HTTP GET**

```
GET /reanudar?ref=REFERENCIA_CORTA
```

### Parámetros

| Param | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `ref` | string (0-40 chars) | Sí | Referencia alfanumérica corta de un pedido guardado. Viene del registro en Blobs. |

### Ejemplos de llamada

```
https://zephoracharms.com/reanudar?ref=ZC-260828-87F31F89
```

La referencia es la que acuñó `crear-pago.mjs` al crear el pedido, con el formato
`ZC-AAMMDD-XXXXXXXX`. Se recorta a 40 caracteres antes de buscarla.

---

## 3 · Respuestas

### 3.1 · Caso exitoso: carrito retomado, igual o ajustado

**Status HTTP 302** (redirección permanente)  
**Header `Location`:**

```
/checkout.html?p=PIEZAS&reanudar=ESTADO&ref=REF
```

Ejemplos reales:

```
# Carrito igual a lo registrado — sin cambios de inventario
/checkout.html?p=letra-e@19,charm-abc*2&reanudar=igual&ref=abc123

# Carrito ajustado — algo se agotó entre medias
/checkout.html?p=letra-e@19,charm-abc&reanudar=ajustado&ref=abc123
```

**La página `checkout.html` lee estos parámetros y:**
- Carga el carrito en `localStorage` desde `p=...`
- Muestra un aviso visual con el estado (`igual` o `ajustado`)
- Si es `ajustado`, explica qué cambió sin esconderlo
- Limpia la URL para que recargar no reimponga el enlace

---

### 3.2 · Referencia no existe o no se puede leer

**Status HTTP 302**  
**Header `Location`:**

```
/index.html?reanudar=no-encontrado
```

**Razones posibles:**
- El `ref` no existe en Blobs
- Blobs no responde (timeout, error 500)

**Decisión de arquitectura:** No se distingue entre ambas. Quien viene de un correo con ganas de comprar necesita acabar en un sitio donde pueda comprar, nunca en una pantalla rota. La tienda es ese lugar.

---

### 3.3 · Pedido ya pagado

**Status HTTP 302**  
**Header `Location`:**

```
/gracias.html?ref=REFERENCIA
```

**Por qué existe este caso:** Un correo reenviado, o abierto dos veces desde el celular de una misma clienta, no puede terminar en una segunda pasarela. Antes que cualquier otra comprobación, se valida que el pedido no haya pasado ya a `estado: 'pagado'` o `estado: 'confirmado'`.

---

### 3.4 · Pedido vencido (más de 7 días)

**Status HTTP 302**  
**Header `Location`:**

```
/index.html?reanudar=vencido
```

La ventana de rescate es de 7 días. Pasada esa ventana, los precios y el inventario pueden haber cambiado tanto que no tiene sentido prometer que el carrito de hace una semana «sigue igual».

---

### 3.5 · Carrito completamente agotado

**Status HTTP 302**  
**Header `Location`:**

```
/index.html?reanudar=agotado
```

Todas las piezas que la clienta pedía ahora están en cero. No hay nada que rescatar.

---

## 4 · El formato de `p=...` (el carrito codificado en URL)

Ambas automatizaciones usan este formato cuando arman el enlace. También lo lee el sitio (`delEnlace()` en `index.html`, `carritoDeUrl()` en `checkout.html`).

**Sintaxis:**

```
p=id1,id2*cantidad@talla,id3*cantidad
```

**Ejemplos reales:**

| Formato | Significa |
|---|---|
| `p=charm-inicial-a` | Un charm de inicial A, cantidad 1 (se omite `*1`) |
| `p=charm-inicial-a*3` | Tres charms de inicial A |
| `p=pulsera-corazon@19` | Una pulsera de corazón, talla 19 |
| `p=pulsera-corazon@19,charm-inicial-a*2` | Brazalete + 2 charms |
| `p=charm-a,charm-b,charm-c` | Tres charms distintos, uno de cada |

**Validaciones que hace el checkout:**

- Si un `id` no existe en el catálogo, se ignora
- Si un charm tiene `@talla`, se descarta (los charms no tienen talla)
- Si una pulsera no tiene `@talla` pero sí `*cantidad`, se descarta

---

## 5 · La vida del `ref` — quién lo genera, dónde se guarda

| Paso | Quién | Qué hace |
|---|---|---|
| 1 | `crear-pago.mjs` | Genera la referencia (`ZC-AAMMDD-XXXXXXXX`) y guarda el pedido en Blobs |
| 2 | `_pedidos.mjs` | Lee / escribe / marca en Blobs usando la referencia como clave |
| 3 | `rescate.mjs` → `_correo.js` | Incluye la referencia en la URL del enlace de recuperación |
| 4 | `reanudar.mjs` | Lee la referencia, revalida stock, marca `reanadadoEn` |

**Una sola pieza acuña referencias: `crear-pago`.**

Es a propósito, y es la razón por la que **el bot de WhatsApp no usa este
endpoint**. Un `ref` solo existe cuando alguien llegó al final del checkout con
todos sus datos y se fue sin pagar. Si el bot pudiera acuñar referencias:

- Cada conversación dejaría un pedido en `esperando-pago`, y `rescatables()`
  —que filtra exactamente por ese estado— sacaría al día siguiente una lista de
  checkouts abandonados que nunca existieron.
- El registro no se podría construir de todas formas: `leerCliente()` exige
  nombre, apellido, documento, celular, correo, departamento, ciudad y
  dirección, y el bot tiene un número de teléfono.

El bot usa **`/armar-carrito`**, que no escribe nada y devuelve un enlace directo
a `checkout.html?p=…`. Ver
[`BOT-WHATSAPP-ARQUITECTURA.md`](BOT-WHATSAPP-ARQUITECTURA.md) § 3.

**Casos especiales:**

- **Una referencia pagada no se rescata.** Con `estado === 'pagado'` o
  `'confirmado'`, `/reanudar` manda a `gracias.html` y no arma ningún cobro.
- **Una referencia por intento de pago.** Wompi genera su propio ID de
  transacción; el nuestro marca qué se intentó cobrar y con qué inventario
  apartado.

---

## 6 · Quién llama a este endpoint, y quién no

**Lo llama el correo de recuperación.** `rescate.mjs` corre cada mañana, arma la
lista de checkouts abandonados y, para quien autorizó comunicaciones, manda un
correo con `…/reanudar?ref=REFERENCIA`.

**No lo llama el bot de WhatsApp.** El bot usa `/armar-carrito`, que no escribe
nada y devuelve un enlace directo a `checkout.html?p=…`. Los dos caminos acaban
en el mismo sitio —el checkout de siempre, con el carrito puesto por la URL— pero
solo uno de ellos parte de un pedido que existe:

```
Checkout abandonado (existe registro)      Conversación de WhatsApp (no existe nada)
  rescate.mjs → correo                       AI Agent → /armar-carrito
       ↓                                          ↓
  /reanudar?ref=ZC-…                          (no escribe, no acuña ref)
       ↓ revalida stock                            ↓
  /checkout.html?p=…&reanudar=…             /checkout.html?p=…&via=wa
       ↓                                          ↓
       └──────────── crear-pago: recalcula, aparta, firma, cobra ────────────┘
```

**Las reglas que comparten los dos caminos:**

1. **Nunca se inventa existencia.** El número sale de `disponibilidad.mjs` o de
   `disponibles()`, nunca del modelo ni de `stock.json` a secas.
2. **Nunca se inventa precio.** Sale de `calcular()` en `_precios.js`, el mismo
   con el que firma el cobro.
3. **Nunca se promete que el carrito «sigue igual».** `/reanudar` lo comprueba
   antes de decir nada; `/armar-carrito` lo comprueba al armarlo.
4. **Ninguno de los dos cobra.** El cobro se decide en un solo sitio,
   `crear-pago.mjs`.

---

## 7 · Logs y monitoreo

`reanudar.mjs` imprime logs en JSON para que n8n, Sentry o un dashboard lo vea:

```json
{ 
  "evento": "reanudar",
  "referencia": "abc123",
  "resultado": "igual" | "ajustado" | "ya-pagado" | "sin-registro" | "vencido" | "todo-agotado",
  "fuente": "real" | "sin-lectura",
  "piezas": 3
}
```

**Campos:**

- `resultado` · El estado final del intento
- `fuente` · Si `"sin-lectura"`, Blobs no respondió pero se devolvió el carrito igual (fallar hacia adelante)
- `piezas` · Cuántas unidades tiene el carrito final (base + charms)

---

## 8 · Cambios en `_pedidos.mjs` que afectan a `/reanudar`

Cada vez que el registro guardado cambie de estructura (nuevos campos, renombrados, etc.), `/reanudar` lo trae y lo convierte a carrito. Si un campo desaparece, `/reanudar` lo maneja sin romper — la función `carritoDe()` solo lee lo que necesita.

**Campos que `/reanudar` usa del registro:**

| Campo | Tipo | Notas |
|---|---|---|
| `lineas` | array | Arreglo de líneas: `{id, unidades, talla}`. Lo pasa a `carritoDe()` |
| `pago` | string | `'anticipado'` o `'contraentrega'`. Se preserva en el carrito |
| `estado` | string | `'pagado'`, `'confirmado'`, etc. Se comprueba **antes** de cualquier otra cosa |
| `creado` | ISO 8601 | Marca de tiempo. Se comprueba para vencer después de 7 días |

---

## 9 · Testing

`pruebas/reanudar.js` corre 26 comprobaciones:

- Carrito antiguo → carrito nuevo sin perder datos
- Pieza retirada del catálogo → se cae sin romper el resto
- Carrito con más unidades que las disponibles → se recorta
- Piezas agotadas → desaparecen
- Talla agotada → quita el brazalete
- Sin poder leer inventario → no se recorta a ciegas
- URL armada → pasa la validación de `index.html` y `checkout.html`
- No firma ni llama a Wompi (comprobación textual del código)
- Comprueba que antes de devolver a nadie a pagar, se valida que no esté ya pagado

Correr las pruebas:

```bash
npm test -- pruebas/reanudar.js
```

---

## 10 · Estructura del endpoint (implementación)

`netlify/functions/reanudar.mjs` es la única función que maneja estas rutas — se declara en `netlify.toml`:

```toml
[[redirects]]
from = "/reanudar"
to = "/.netlify/functions/reanudar"
status = 200
```

**Funciones internas que exporta para prueba:**

```javascript
export const _interno = { 
  carritoDe,      // De registro a carrito
  recortar,       // Ajustar a inventario real
  comoUrl,        // Carrito a formato URL
  DIAS_MAX        // Ventana de rescate (7 días)
};
```

Las pruebas llaman estas funciones directamente sin levantar Netlify ni tocar Blobs.

---

## 11 · Antes de tocar esta pieza

- [ ] `/reanudar` NO llama a Wompi — el cobro se decide solo en `crear-pago.mjs`
- [ ] `p=...` viaja en la URL: no es sensible, es solo la selección de piezas
- [ ] El escritor de `p=…` es **uno solo** (`_carrito.mjs`), compartido con
      `armar-carrito`. Si se duplica, `pruebas/reanudar.js` § 3 deja de cubrir
      las dos funciones y una puede separarse en silencio de lo que leen las
      páginas
- [ ] La referencia caduca a los 7 días (`DIAS_MAX`) — pasado eso manda a la
      tienda con `?reanudar=vencido`
- [ ] Un pedido ya pagado nunca vuelve a la pasarela: se comprueba **antes** que
      cualquier otra cosa
- [ ] Correr `./pruebas/correr.sh` antes de desplegar

