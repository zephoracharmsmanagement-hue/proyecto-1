# API del endpoint `/reanudar` — cómo lo usan ambas automatizaciones

El endpoint `/reanudar` es el destino común de ambas automatizaciones: donde redirige el correo de recuperación de carritos abandonados, y donde llevará el bot de WhatsApp a la clienta cuando decida comprar.

**No toca dinero. No firma nada. No llama a Wompi.** Solo revalida stock y arma un carrito en la URL para que el checkout existente haga su trabajo.

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
https://zephora-charms.netlify.app/reanudar?ref=abc123
```

```
# Por WhatsApp (en un enlace que el bot arma)
Retoma tu pedido acá: https://zephora-charms.netlify.app/reanudar?ref=xyz789
```

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
| 1 | `crear-pago.mjs` | Genera `ref` corto (UUID truncado), lo guarda en Blobs |
| 2 | `_pedidos.mjs` | Lee / escribe / marca en Blobs usando `ref` como clave |
| 3 | Correo automático (`_correo.js`) | Incluye `ref` en la URL del enlace |
| 4 | Bot de WhatsApp (n8n, paso 7 del plan) | Genera `ref` nuevo o reutiliza uno antiguo, arma el enlace |
| 5 | `reanudar.mjs` | Lee el `ref`, marca que se actuó |

**Casos especiales:**

- **No reusar `ref` de un pedido ya pagado.** Una vez que `estado === 'pagado'`, ese pedido no vuelve a rescatarse.
- **Un `ref` por intento de pago.** Wompi genera su propio ID de transacción, pero el nuestro marca qué se intentó cobrar y con qué inventario reservado.

---

## 6 · Cómo lo usa el bot de WhatsApp (fase 7)

El bot corre en n8n y sigue este flujo:

```
Mensaje WhatsApp
  ↓
AI Agent (decide qué hacer)
  ↓
¿Clienta eligió piezas?
  ├─ NO → Responde la pregunta, nada más
  └─ SÍ ↓
      Llama disponibilidad.mjs (verifica stock real)
      ↓
      Llama un nuevo endpoint "armar carrito" (genera ref + p=...)
      ↓
      Arma el enlace de reanudar
      ↓
      "Retoma aquí 👉 https://...reanudar?ref=XYZ"
      ↓
      Clienta toca el enlace
      ↓
      /reanudar?ref=XYZ redirige a /checkout.html?p=...
      ↓
      Checkout hace su trabajo (precio, firma, Wompi, todo)
```

**Reglas del bot que dependen de este endpoint:**

1. **Nunca inventa existencia.** Llama a `disponibilidad.mjs`, recibe números de verdad.
2. **Nunca inventa precio.** Llama a un endpoint que usa `_precios.js`, recibe lo que el servidor cobra.
3. **Nunca manda un `ref` que ya está pagado.** Antes de armar el enlace, comprueba que `estado !== 'pagado'`.
4. **Nunca promete que el carrito «sigue igual».** El mensaje dice claramente «retoma aquí» — no promete nada, deja que `/reanudar` lo compruebe.

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

## 11 · Un minuto antes de que el bot lo use

Checklist para el equipo que arme el bot en n8n:

- [ ] Leer esta documentación completa
- [ ] Entender que `/reanudar` NO llama a Wompi — eso es responsabilidad del checkout
- [ ] Entender que `p=...` viaja en URL — no es sensible, es solo la selección
- [ ] Probar un enlace a mano en local/staging antes de armar el nodo de WhatsApp
- [ ] Recordar que el `ref` caduca a 7 días — no armar enlaces para hace dos semanas
- [ ] Si las respuestas del bot llevan dinero, siempre de `_precios.js` o `disponibilidad.mjs`, nunca del modelo

