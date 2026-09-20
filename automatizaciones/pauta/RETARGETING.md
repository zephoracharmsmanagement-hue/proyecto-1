# Retargeting · Recuperación de checkout — análisis de toda su historia

Leído de la API el 2026-09-20 vía MCP de Meta Ads, cuenta `1583713932705268`.
Corrige varios datos de `CLAUDE.md` que estaban viejos.

## Qué dice la historia completa

Campaña `120247672148980534`, creada el 14 de agosto. **No lleva $0 gastados ni
0 impresiones** —eso era cierto cuando se escribió—. Entregó, y toda su entrega
cabe en cuatro días:

| Día | Impresiones | Alcance | Clics | CPM | Gasto | LPV |
|---|---|---|---|---|---|---|
| 7 sep | 119 | 64 | 4 | $44.672 | $5.316 | 3 |
| 8 sep | 137 | 75 | 3 | $45.168 | $6.188 | 2 |
| 9 sep | 191 | 91 | 3 | $31.325 | $5.983 | 3 |
| 10 sep | 51 | 33 | 0 | $35.784 | $1.825 | 0 |
| **Total** | **498** | **135** | **10** | **$38.779** | **$19.312** | **8** |

Compras: **0**. Estado actual: PAUSED, $5.000 COP/día.

Sin errores de entrega pendientes (`ads_get_errors` devuelve vacío): el fallo de
segmentación por lugar #1870194 está resuelto.

## La conclusión principal: no fracasó, nunca se midió

**8 visitas a la página.** Con la conversión real del sitio, cero compras en 8
visitas es exactamente lo que se espera aunque la campaña sea buena. No prueba
nada. Pausarla por «no vende» es leer un resultado que no existe.

Lo que sí prueba el dato es otra cosa, y es cara: **CPM de $38.779 contra
$5.002 de la campaña principal — 7,75 veces más por el mismo par de ojos.** Con
frecuencia de 3,69 sobre 135 personas. Eso no es un problema de creativo: es un
público tan chico que Meta agota el inventario barato y sube a pujar.

## Datos de `CLAUDE.md` que ya están desactualizados

| Dice | Es |
|---|---|
| Retargeting ACTIVA, $10.000/día, $0 gastados, 0 impresiones | PAUSED, $5.000/día, $19.312 gastados, 498 impresiones |
| Campaña principal $15.000/día | $20.000/día |
| «~55 checkouts/mes» | **383 `InitiateCheckout` en 28 días** |
| «134 `AddToCart` en 30 días» | **1.329 `AddToCart` en 28 días** |
| Público de 180d: pendiente de crear | **Creado el 4 de septiembre** (`120247983120420534`), ACTIVE, `operation_status_code: 200` |

El público que este repo recomendaba construir —ventana 180 días, `InitiateCheckout`
**o** `AddToCart`, excluyendo `Purchase`, sobre el píxel viejo— ya existe y está
sano. Su lookalike (`120247983125040534`) **sigue en `433`**: ni con 180 días la
semilla alcanza para construirlo.

## El hallazgo que no estábamos buscando

Volumen del píxel viejo `2130673404542988`, últimos 28 días:

| Evento | 28 días |
|---|---|
| PageView | 5.260 |
| ViewContent | 5.038 |
| AddToCart | 1.329 |
| InitiateCheckout | 383 |
| **AddPaymentInfo** | **31** |
| **Purchase** | **9** |

Dos embudos, y el segundo es el caro:

- `AddToCart` → `InitiateCheckout`: 1.329 → 383 (**29%**). Normal.
- `InitiateCheckout` → `AddPaymentInfo`: 383 → 31 (**8%**). Malo, pero es donde
  la gente compara precio y envío.
- **`AddPaymentInfo` → `Purchase`: 31 → 9 (29%). Dos de cada tres personas que
  ya metieron los datos de pago no terminan.**

Ese último paso es el que hay que mirar antes que cualquier anuncio. Quien llega
ahí ya decidió comprar; si se cae, se cae por algo del flujo de Wompi, no por
falta de persuasión. **Vale más que los 30 ganchos de la matriz**: recuperar esos
22 pedidos al mes, con ~$110.386 de utilidad neta por venta de 2 dijes, son
~$2,4M mensuales que hoy se pierden después de que la clienta dijo que sí.

(Nota: este conteo es del píxel del navegador. El `Purchase` de servidor que
manda `wompi-webhook.mjs` va al píxel **nuevo** `1029982529813994`, así que
parte de la brecha puede ser atribución partida entre los dos píxeles, no
abandono real. Hay que confirmarlo contra los pedidos reales antes de dar la
cifra por buena — pero aunque sea la mitad, sigue siendo el problema más caro
del embudo.)

## Qué hacer con el retargeting

**No relanzarlo como está.** Tres cambios, en este orden:

1. **Cambiar el público** al de 180d (`120247983120420534`). Es el mismo motivo
   por el que se creó y ya está listo. Con 1.329 `AddToCart` y 383
   `InitiateCheckout` en 28 días —no 134 y 55—, seis meses de acumulación dan un
   público de otro orden de magnitud. Eso es lo que baja el CPM de $38.779.
2. **Dejar de optimizar por `Purchase`.** El píxel viejo registró **9 compras en
   28 días**. Meta necesita ~50 conversiones semanales por conjunto para salir de
   aprendizaje; con 9 al mes nunca sale, y una campaña en aprendizaje permanente
   entrega caro y errático. Optimizar por `AddToCart` o `InitiateCheckout`, que
   sí tienen volumen, hasta que el píxel nuevo esté compartido con la cuenta.
3. **Presupuesto mínimo, y medir por costo por resultado.** $5.000/día sobre un
   público sano da suficientes impresiones para decidir en una semana. El umbral:
   si el costo por checkout supera los $1.731 de la campaña principal, el dinero
   rinde más en la principal.

**Lo que no arregla el retargeting:** si dos de cada tres personas que llegan a
`AddPaymentInfo` no terminan, traerlas de vuelta con un anuncio las devuelve al
mismo punto donde se cayeron. Primero el paso de pago, después la pauta.

## Contexto que apareció de paso

El conjunto **«Amor y Amistad · Videos UGC»** (`120248103650580534`, creado el 13
de septiembre, dentro de la campaña principal) lleva **$28.814, CTR 7,70%, 25
`AddToCart`, 10 `InitiateCheckout` y 1 `Purchase`** — el doble de CTR que el
conjunto viejo (4,17%). Recordar Copia 4 antes de escalarlo: el CTR no decide,
decide el costo por resultado. Con 10 checkouts a $2.881 cada uno contra $1.704
del conjunto viejo, hoy va perdiendo; pero 10 resultados son muy pocos para
concluir. Dejarlo correr hasta ~30 antes de juzgarlo.
