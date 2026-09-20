# Maletas 2 y 6 — Dolores y Objeciones · Zephora Charms

Extraído el 2026-09-20. **No se procesó ningún documento subido** (no llegaron).
Todo lo de aquí sale de cuatro fuentes internas verificables:

| Fuente | Qué aporta | Fuerza |
|---|---|---|
| 28 macros de IG/WhatsApp (`insumos/macros/macros-originales.md`, rama `sephora-whatsapp-response-system-682wvv`) | Objeciones reales, en el orden en que llegan al chat | **Alta** — salieron de conversaciones |
| Auditoría de macros (`docs/whatsapp/01-auditoria-macros.md`) | Dónde la promesa y el producto no coinciden | Alta |
| 23 preguntas de `preguntas-frecuentes.html` | Objeciones que la marca ya reconoce | Media — redactadas por la marca |
| Píxel `2130673404542988`, 28 días (API de Meta) | Dónde se cae la gente de verdad | **Máxima — es comportamiento, no opinión** |

**Nomenclatura:** `[V]` verificado con fuente · `[H]` hipótesis a validar.
Ninguna cita está inventada. Donde no hay palabras de clienta, se dice.

---

## Advertencia que cambia la lectura de todo lo que sigue

**Las macros son de agosto y sus precios ya no existen.** Anunciaban brazalete
desde **$58.000** y charms desde **$72.000**. El catálogo de hoy:

| | Macros (ago) | Hoy (`catalogo.json`) | Variación |
|---|---|---|---|
| Brazalete más barato | $58.000 | **$118.000** | +103% |
| Charm más barato | $72.000 | **$75.000** | +4% |

**El brazalete se duplicó.** Toda objeción de precio recogida en agosto hay que
leerla sabiendo que hoy el producto de entrada cuesta el doble. Es el hallazgo
más importante de este análisis y no estaba escrito en ningún sitio.

---

# MALETA 2 · Dolores detectados

Ordenados por evidencia, no por intuición.

## D1 · «Ya me estafaron comprando por internet» `[V]`

> «Tenía un poquito de duda de pedir por internet, pero superó totalmente lo
> que esperaba.»
> — Adriana M., Bogotá (reseña en `index.html`)

Es la única reseña que nombra un dolor, y lo nombra **antes** de la compra. La
desconfianza no es al producto: es al canal. La macro 7 lo confirma desde el
otro lado — la auditoría anota que decir «no tenemos sede física» *«en tráfico
frío activa la sospecha de dropshipping»*.

**Traducción comercial:** el miedo no es «¿será bonita?». Es «¿existe esta
gente?».

## D2 · «Pago y desaparecen» — el dolor más caro, y no es una opinión `[V]`

Comportamiento del píxel, 28 días:

| Paso | Volumen | Pasa al siguiente |
|---|---|---|
| AddToCart | 1.329 | 29% |
| InitiateCheckout | 383 | 8% |
| **AddPaymentInfo** | **31** | **29%** |
| Purchase | 9 | — |

**Dos de cada tres personas que ya escribieron los datos de la tarjeta no
terminan.** Quien llega ahí ya decidió comprar y ya confió. Se cae después.

A ~$110.386 de utilidad por venta de 2 dijes, son ~22 pedidos/mes perdidos
después del sí. **Vale más que cualquier cambio de copy.**

> Salvedad: el `Purchase` de servidor va al píxel nuevo, así que parte de la
> brecha puede ser atribución partida, no abandono. **Confirmar contra los
> pedidos reales de Wompi antes de actuar.** Aunque sea la mitad, sigue siendo
> el problema más caro del embudo.

## D3 · «No sé qué talla pedir, así que mejor no contesto» `[V]`

La auditoría de macros es explícita y la macro 9 se creó solo para esto:

> «La talla es la objeción silenciosa número uno en pulseras — la clienta que
> no sabe qué pedir **simplemente no responde más**.»

Dolor sin queja: no genera reclamo, genera silencio. Por eso no aparece en
ninguna reseña y es invisible sin este documento.

## D4 · «Pagué joyería y me llegó bisutería» `[V]`

La regla que encabeza las 28 macros existe por este miedo:

> «Nunca decir "todo es 925" [...] eso hoy sería falso y es **exactamente lo que
> hace que una clienta se sienta engañada al recibir el pedido**.»

Charms 925 con sello; brazaletes con baño de plata. La mezcla es real y el
dolor es la decepción al abrir la caja.

## D5 · «Se me puso negra» `[V]`

La auditoría corrigió una promesa imposible: *«No se oscurecen con el uso
normal»* —toda plata 925 se oxida—. El FAQ le dedica dos preguntas
(«¿Se pone negra o se oxida?», «¿Cómo cuido mi pulsera?»).

Dolor de segunda compra: no mata la primera venta, mata la recompra y la
recomendación.

## D6 · «Me da alergia el metal barato» `[V]`

FAQ: *«¿Tienen níquel o causan alergia?»*. Pregunta de salud, no de estética —
por eso desactiva la compra entera, no solo una pieza.

## D7 · «Se me va a caer y pierdo un charm de $95.000» `[V]`

FAQ: *«¿Los charms se pueden salir o caer?»*. La auditoría lo convierte en
oportunidad: *«mucha clienta no sabe que la cadena de seguridad existe hasta
que se le cae la pulsera»*.

Dolor económico compuesto: no pierde una pulsera, pierde una pieza cara de una
pulsera que sigue incompleta.

## D8 · «Tengo Pandora y no quiero botar lo que ya compré» `[V]`

FAQ: *«¿Sirven con mi pulsera Pandora?»*. La macro 2 está marcada en el propio
archivo como **«la macro más delicada»**.

No es un dolor de Zephora: es miedo a perder una inversión previa. Quien ya
tiene Pandora tiene dinero hundido y **compra más** si se le resuelve.

## D9 · «Está caro» — hoy pesa el doble que en agosto `[V]`

La macro 2 tenía una respuesta buena (*«Pandora cobra la marca. Nosotros
cobramos la joya»*) sobre un brazalete de $58.000. **Ese argumento se sostenía
en una brecha de 4,5× contra Pandora ($260.000 vs $58.000). Hoy la brecha es de
2,2× ($260.000 vs $118.000) y el guion no se ha reescrito.**

## D10 · «Anuncian un precio que no existe» `[V]`

Dos hallazgos 🔴 de la auditoría, ambos del mismo tipo:

- «Charms desde $65.000» → el más barato era $72.000. *«Son $7.000 de
  diferencia sobre una expectativa que tú creaste. Es poco dinero y mucha
  confianza.»*
- «Combo desde $206.350» → armado con tres cadenas de seguridad, no con charms.
  *«$17.850 de diferencia [...] Ese momento —sentir que el precio anunciado no
  existe— es donde se pierden las ventas de tráfico frío.»*

**Dolor autoinfligido.** Es el único de la lista que se arregla sin comprar
nada ni convencer a nadie.

## D11 · «¿Y si no le gusta?» — dolor del que regala `[H]`

> Hipótesis. Fundada en tres señales: la reseña de Sebastián G. (*«Se lo regalé
> a una persona súper especial»*), la macro 2 cerrando con *«¿Buscas algo para
> ti o para regalar?»*, y el FAQ preguntando por empaque de regalo. **No hay
> cita de nadie expresando este miedo.** Validar antes de construir campaña.

---

# MALETA 6 · Objeciones de compra

Ordenadas por el momento del embudo en que aparecen.

## Barreras LÓGICAS

| # | Objeción | Fuente | ¿Resuelta hoy? |
|---|---|---|---|
| L1 | «¿Es plata de verdad o baño?» | Macro 3 completa | ✅ Bien. Sello S925 verificable a mano |
| L2 | «¿Qué talla pido?» | Macro 9, FAQ ×2 | ⚠️ Regla clara (muñeca + 2 cm), pero **llega tarde**: mata la conversación antes |
| L3 | «¿Sirve con mi Pandora?» | Macro 2, FAQ | ✅ Sí, y es **arma comercial**, no defensa |
| L4 | «¿Cuánto cuesta el envío?» | Macro 5, FAQ | 🔴 **Contradicción viva** (ver abajo) |
| L5 | «¿En cuántos días llega?» | Macro 5, FAQ | ✅ 1–6 días hábiles, Inter Rapidísimo con guía |
| L6 | «¿Puedo pagar contraentrega?» | Macro 5, FAQ | ✅ Sí, +$5.000 |
| L7 | «¿Puedo pagar a cuotas?» | Macro 5, `index.html` | ⚠️ Hasta 36 cuotas, **pero Addi se coordina por chat**, no desde el botón |
| L8 | «¿Emiten factura?» | FAQ | ⚠️ **No hay factura electrónica**, solo comprobante |
| L9 | «¿Puedo devolver?» | FAQ, Ley 1480 | ✅ Derecho legal de retracto |
| L10 | «¿Qué garantía tienen?» | Macro 3, FAQ | ⚠️ 30 días por defecto de fábrica — **es el mínimo del mercado** |
| L11 | «¿Cuántos charms caben?» | FAQ | ✅ |
| L12 | «¿Tienen níquel?» | FAQ | ✅ |
| L13 | «¿Envíos internacionales?» | FAQ | ✅ No. Cierra la duda rápido |
| L14 | «¿Venden al por mayor?» | FAQ | ✅ |

### 🔴 L4 — la contradicción que hay que resolver esta semana

La auditoría la marcó hace un mes y **sigue abierta**:

> «Estas macros dan tarifas fijas ($15.000 / $25.000), pero la página nueva dice
> *"se cotiza según tu ciudad"*. Son dos promesas distintas y la clienta puede
> notarlo.»

Hoy `catalogo.json` dice `envio: {anticipado: 15000, contraentrega: 20000}` y
`envioGratisDesde: 0` — es decir, **envío gratis siempre pagando anticipado**.
Ni las macros ni el «desde $180.000» de agosto describen eso.

**Envío gratis sin mínimo es el argumento comercial más fuerte que tienes hoy y
no lo está diciendo nadie.**

## Barreras EMOCIONALES

| # | Objeción | Qué dice de verdad | Fuente |
|---|---|---|---|
| E1 | «¿Esta tienda existe?» | Miedo a la estafa, no al producto | Adriana M. `[V]` |
| E2 | «¿Me va a llegar bisutería?» | Miedo a la decepción al abrir | Regla de materiales `[V]` |
| E3 | «¿Se va a ver barata puesta?» | Miedo social, no económico | Macro 2 `[H]` |
| E4 | «No sé qué charms me representan» | **Parálisis por significado**, no por precio | Macro 4 `[V]` |
| E5 | «¿Y si no le gusta?» | Miedo a quedar mal | `[H]` — sin cita |
| E6 | «Si compro estilo Pandora, ¿estoy comprando una copia?» | Miedo al juicio ajeno | Macro 2 `[H]` |

### E4 es la objeción subestimada

La macro 4 la resuelve sin nombrarla, y por eso funciona:

> «¿Ya tienes alguna pieza en mente, **o prefieres que te arme una
> propuesta?**»

Y la auditoría explica por qué esa variante gana: *«cerrar ofreciendo hacer el
trabajo por ella — más efectivo que preguntar si ya sabe qué quiere»*.

**La clienta no se traba por plata. Se traba porque le pediste que resuma su
vida en cuatro dijes.** El producto es su fortaleza y su fricción a la vez.

---

# Lo que falta para cerrar estas dos maletas

Ninguna de estas fuentes contiene a **quien no compró**. Las reseñas son de
quien compró y quedó feliz; las macros son las respuestas de la marca. Faltan:

1. **Chats de WhatsApp que murieron sin venta.** Ahí está D3 con palabras
   propias, y el verdadero peso de D9 con el precio nuevo.
2. **Comentarios y DMs de las publicaciones de pauta.** El tráfico frío objeta
   distinto al que ya te conoce.
3. **Las 22 personas al mes que abandonan en `AddPaymentInfo`** (D2). Si el
   rescate por WhatsApp ya las contacta, esa conversación es la fuente más
   valiosa que puede existir — y la más fácil de conseguir.

Sin eso, D11, E3, E5 y E6 se quedan en hipótesis. Con eso, las dos maletas
quedan completas.
