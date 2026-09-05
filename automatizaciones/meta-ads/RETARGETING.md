# Retargeting · Recuperación de checkout — diagnóstico y plan

Verificado contra la API el 2026-09-04. Complementa la § 7 de
[`PLAN-2026-09-02.md`](PLAN-2026-09-02.md), que trae el diagnóstico del error
de segmentación hecho desde la terminal.

- Campaña: `120247672148980534` — PAUSADA, `OUTCOME_SALES`
- Conjunto: `120247672150590534` — PAUSADO
- Público: `Zephora · Iniciaron checkout sin comprar (30d)` (`120247672124730534`)

---

## Volumen real del píxel viejo (`2130673404542988`), 30 días

| Evento | Conteo |
|---|---|
| PageView | 4.968 |
| ViewContent | 4.686 |
| AddToCart | 1.081 |
| **InitiateCheckout** | **360** |
| AddPaymentInfo | 40 |
| **Purchase** | **26** |
| Lead | 10 |

Fuente: `ads_get_dataset_stats`. Estos son eventos del sitio; no coinciden con
los 235 checkouts que reporta la campaña, que son los **atribuidos** a la
pauta.

### El píxel viejo sí recibe `Purchase`

Contra lo que podría suponerse por su falta de CAPI: `gracias.html`
inicializa **los dos píxeles** (líneas 21 y 24) y dispara
`fbq('track','Purchase')` **sin `trackSingle`**, así que el evento llega a
ambos. Son 26 al mes — solo de quien pagó **y volvió al sitio**. Quien paga
por PSE y cierra la pestaña no aparece; ese hueco lo tapa la CAPI del píxel
nuevo.

---

## Dos frenos, y el de la segmentación es el menor

### 1. El público es demasiado pequeño (corrige una nota anterior)

Una versión anterior de `CLAUDE.md` decía que, con el volumen real de
checkouts, el público «debería ser varias veces mayor de lo que se asumió» y
que valía reevaluarlo. **El dato lo desmiente:**

- Público = `InitiateCheckout` − `Purchase` en 30 días = **360 − 26 ≈ 334
  personas**, menos aún descontando repetidos.
- **Meta exige mínimo 1.000 personas** para que un público personalizado
  entregue.

Por eso `approximate_count_lower_bound` y `upper_bound` salen ambos en
**1.000**: es el piso que reporta la API, no una medición. El público figura
`delivery_status: ACTIVE` y `operation_status: 200 Normal`, así que **estar
"sano" no significa ser utilizable**: no cruza el mínimo.

La corrección del volumen de checkouts (235/mes, no 55) era real y sigue en
pie. Lo que no se sostuvo fue la conclusión que se sacó de ella sobre el
tamaño del público.

### 2. `Purchase` no tiene volumen para optimizar

La campaña usa `promoted_object` → píxel viejo, `custom_event_type: PURCHASE`,
`optimization_goal: OFFSITE_CONVERSIONS`.

**26 Purchase al mes ≈ 6 por semana.** Meta necesita del orden de **50
conversiones semanales por conjunto** para salir de fase de aprendizaje. Es un
octavo de lo necesario.

Consecuencia: arreglar solo la segmentación hace que la campaña **entregue**,
pero optimizando con una señal ocho veces más débil de lo que necesita.
Gastaría sin aprender.

---

## Los tres cambios que la hacen viable

Ninguno depende de resolver lo del portafolio.

### 1. Rehacer el público — el que de verdad desbloquea

Ventana a **180 días** e incluir **`AddToCart`** además de
`InitiateCheckout`. Con 1.081 AddToCart mensuales, el público pasa a miles y
cruza el mínimo con holgura. Mantener la exclusión de `Purchase`.

Los públicos personalizados **no se pueden editar** en su regla: hay que
**crear uno nuevo** y apuntar el conjunto a él. El viejo se deja o se borra
después.

Sin este cambio, la campaña no entrega aunque se arregle todo lo demás.

### 2. Corregir `location_types` (error #1870194)

En el conjunto `120247672150590534`:
`targeting.geo_locations.location_types` → de `["home"]` a
`["home","recent"]`.

Meta consolidó las opciones de ubicación y "solo residentes" quedó
descontinuada. Diagnosticado desde la terminal cruzando contra el conjunto de
Ventas, que sí entrega y usa `["home","recent"]`.

### 3. Bajar la optimización a `InitiateCheckout`

Mientras el píxel nuevo no esté compartido con la cuenta. Con 360 eventos
mensuales hay señal usable; con 26 `Purchase` no la hay. Se sube a `Purchase`
cuando la CAPI esté disponible para esta cuenta.

Es un trueque consciente: `InitiateCheckout` como objetivo de un retargeting
es peor en teoría —le pagas a Meta por traer gente que ya inició checkout para
que inicie otro—, pero es lo único que tiene volumen. Con presupuesto de
prueba ($5.000/día) y midiendo el resultado en pedidos reales, no en la
métrica de Meta.

---

## Dato de negocio que salió del diagnóstico

**Conversión checkout → pago: 26/360 = 7,2%**, muy por encima del ~2% que
necesita la economía unitaria para no perder plata (ver `CLAUDE.md` §
*Economía unitaria*).

Y es un **piso**, no el número real: no cuenta a quien paga por PSE sin volver
al sitio, ni las ventas cerradas por WhatsApp. Confirma que el techo del
negocio es inventario, no demanda ni presupuesto.
