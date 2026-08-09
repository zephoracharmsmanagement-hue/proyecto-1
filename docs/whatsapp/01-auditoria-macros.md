# Auditoría de macros contra el inventario real

**Fecha:** 2026-08-09 · **Fuente de verdad:** `index.html` → `data/inventario.json`
**Alcance:** las 12 macros de Instagram DM + WhatsApp, cifra por cifra contra el motor de precios del sitio (`index.html:985-1075`).

Este documento es la Fase 1 en la parte que no depende del historial de WhatsApp. Lo que sigue no son opiniones de redacción: cada punto se verificó contra el código que le calcula el total a la clienta.

---

## Resumen

| | Hallazgos |
|---|---|
| 🔴 Corregir antes de volver a enviarlas | 3 |
| 🟠 Decisión del negocio, bloquean la Fase 2 | 3 |
| 🟡 Precisión / oportunidad perdida | 4 |
| ✅ Verificado correcto | 9 |

La buena noticia primero: **el 80% de las cifras de las macros están correctas**, incluidos los tres números que más fácil se desactualizan (escala de descuentos, umbral de envío gratis y precio del Empaque Premium). La revisión que hiciste al alinearlas con la página nueva funcionó. Lo que queda son tres errores concretos y un conflicto que ya habías detectado tú.

---

## ✅ Verificado correcto

Contra `index.html`, línea por línea:

| Afirmación en las macros | Código | Estado |
|---|---|---|
| 2 charms → 8% OFF | `ESC=[0,0,.08,...]` | ✅ |
| 3 charms → 15% OFF | `ESC[3]=.15` | ✅ |
| 4 o más → 20% OFF | `ESC[4]=.20`, `Math.min(n,4)` | ✅ |
| Brazalete 30% OFF con 3 charms | `descB=(base&&nC>=3)?brutoB*.30:0` | ✅ |
| Envío gratis desde $180.000 | `LIBRE=180000` | ✅ |
| Brazaletes desde $58.000 | 8 modelos en ese nivel | ✅ |
| Clip separador $68.000 | los 4 clips cuestan $68.000 | ✅ |
| Cadena de seguridad $65.000 | las 3 cadenas cuestan $65.000 | ✅ |
| Empaque Premium $40.000 | `pack.checked?40000:0` | ✅ |
| Garantía 30 días | sección Confianza | ✅ |
| Charms 925 / brazaletes baño de plata | sellos `pc-mark` del catálogo | ✅ |
| Talla = muñeca + 2 cm | `index.html:435` | ✅ |

La regla de materiales que pusiste como encabezado —charms 925, brazaletes baño de plata— coincide **exactamente** con lo que declara el sitio en cada tarjeta de producto. Esa consistencia es la que evita la devolución por decepción, y ya la tienes.

---

## 🔴 1 · "Charms desde $65.000" es incorrecto — el charm más barato es $72.000

**Dónde:** macros 2, 4, 6 y 8.

El inventario tiene 86 piezas en la sección de charms, pero no todas son charms:

| Tipo | Cantidad | Desde |
|---|---|---|
| Charms decorativos | 79 | **$72.000** |
| Clips separadores | 4 | $68.000 |
| Cadenas de seguridad | 3 | **$65.000** |

Las tres piezas de $65.000 son **Cadenas de Seguridad** (Love Forever, Hamsa y Ojo, Luna y Sol). No son charms: son el accesorio que evita que la pulsera se caiga.

La macro 4 lo tiene bien —lista el clip y la cadena aparte, con sus precios reales— pero en su propio paso 2 dice "charms desde $65.000", contradiciéndose sola.

**El costo real:** una clienta que pregunta "¿cuál es el charm más barato?" espera $65.000 y se le ofrece uno de $72.000. Son $7.000 de diferencia sobre una expectativa que tú creaste. Es poco dinero y mucha confianza.

**Corrección:**

> 💎 **Charms** en Plata 925: desde **$72.000**
> ⛓️ **Accesorios** (clips y cadenas de seguridad): desde **$65.000**

Separarlos además te abre una venta: mucha clienta no sabe que la cadena de seguridad existe hasta que se le cae la pulsera.

---

## 🔴 2 · "Combo desde $206.350" se arma con tres cadenas de seguridad

**Dónde:** macros 1, 6 y 11 — y también la página (`index.html:418`).

Ese número es real: el armador lo calcula. Pero así:

```
Brazalete más barato          $58.000  − 30%  =  $40.600
3 × Cadena de Seguridad      $195.000  − 15%  = $165.750
                                      TOTAL   = $206.350
```

Es decir: **un brazalete y tres cadenas de seguridad**. Nadie compra tres cadenas de seguridad para una sola pulsera.

El piso realista, con charms de verdad:

| Canasta | Total |
|---|---|
| Brazalete + 3 cadenas *(lo que anuncias)* | $206.350 |
| Brazalete + 3 clips | $214.000 |
| **Brazalete + 3 charms más económicos** | **$224.200** |
| Brazalete + 3 charms Disney/Marvel | $257.350 |

**El costo real:** $17.850 de diferencia entre lo que anuncias y lo más barato que la clienta puede armar de verdad. Ella llega al chat con $206.350 en la cabeza y el número no le cuadra. Ese momento —sentir que el precio anunciado no existe— es donde se pierden las ventas de tráfico frío.

**Recomendación:** anunciar **"desde $224.200"**. Pierdes $17.850 de gancho y ganas que la cifra sobreviva al primer contacto con la calculadora. Si prefieres conservar el número bajo, hay que cambiar el armador para que las cadenas y clips no cuenten para el mínimo de la promo — pero eso es una decisión de producto, y por eso está en la lista de bloqueantes de abajo.

> Nota: este mismo error está publicado en la web. Si decides el cambio, se corrige en los dos lados a la vez.

---

## 🔴 3 · "Brazalete + 3 charms" oculta que la promo es 3 **o más**, y que los descuentos se acumulan

**Dónde:** macros 1, 4, 6 y 11.

El código dice `nC>=3`, no `nC===3`. Y los dos descuentos **se suman**: con 4 charms la clienta obtiene 20% en charms *y* 30% en el brazalete, simultáneamente.

Todas las macros dicen "brazalete + 3 charms", que se lee como *exactamente tres*. Estás describiendo tu mejor oferta como si fuera peor de lo que es.

**Corrección para la macro 6:**

> 🔥 **PROMO DE LA SEMANA:** con **3 charms o más**, el brazalete baja **30%**
> ✨ Y el descuento por cantidad **se suma**: con 4 charms llevas 20% en los charms *y* 30% en el brazalete.

Esto convierte el tramo de 3→4 charms en el argumento de venta más rentable que tienes, y hoy no lo estás usando.

---

## 🟠 Tres decisiones que necesito de ti — bloquean la Fase 2

No puedo redactar macros de stock, envíos ni cierre sin estas respuestas, porque cada una cambia lo que la respuesta puede prometer.

### A · Tarifas de envío: $15.000/$25.000 vs. "se cotiza por ciudad"

Ya lo detectaste tú en la macro 5, y confirmo que el conflicto es real: `index.html:1049-1055` muestra literalmente **"Se cotiza por ciudad"** cuando el total no llega a $180.000.

Son dos promesas distintas para la misma clienta, y las ve las dos: una en el chat, otra en la web desde la que acaba de armar el pedido.

**Mi recomendación: tarifas fijas.** Un número cerrado elimina la fricción justo antes del cierre; "se cotiza" obliga a un mensaje más y da tiempo a arrepentirse. Si me confirmas que $15.000 y $25.000 son las reales, actualizo `index.html` para que las muestre y las macros quedan alineadas sin tocar nada más.

### B · ¿Dónde vive el stock?

Revisé los siete atributos de datos del catálogo (`data-id`, `data-g`, `data-add`, `data-cg`, `data-base`, `data-f`, `data-cf`) y **ninguno indica disponibilidad**. Los 86 charms se muestran siempre comprables. Tu Fase 1 pide identificar qué debe actualizarse en tiempo real, y la respuesta honesta es: **hoy el stock no existe como dato en ninguna parte del sistema.**

Necesito saber dónde está la verdad —un Excel, un cuaderno, la memoria de quien despacha— porque define si las macros pueden **afirmar** disponibilidad o deben **verificarla** antes de confirmar. Una macro que promete un charm agotado hace más daño que una que dice "déjame confirmarte en un momento".

### C · La web promete "sin bots"

Literal, en `index.html:934`: *"Nuestro equipo te responde de forma personal, sin bots."*

Si la Fase 3 termina en un bot autónomo, esa línea queda falsa — y está en la sección de Confianza, justo donde la clienta decide. Tres salidas:

1. **La IA redacta, una persona aprueba y envía.** *(recomendada)* La promesa se mantiene literalmente cierta, ganas la velocidad, y ninguna respuesta con un precio inventado sale sin que alguien la vea.
2. El bot atiende solo fuera de horario y lo declara al saludar.
3. Se ajusta el copy del sitio.

---

## 🟡 Precisión y oportunidades

### 4 · "Cada charm lleva su sello S925 grabado" (macro 3)

Es la única afirmación de las macros que **no puedo verificar desde el repositorio** — es un hecho físico del producto. Y la macro invita a la clienta a comprobarlo: *"lo puedes revisar apenas lo recibas"*.

Si hay una sola referencia sin sello visible, esa frase se convierte en la prueba de que la engañaste. Confírmalo con tu proveedor pieza por pieza antes de seguir usándola, o suavízala a "con certificación de Plata 925".

Lo demás de esa macro está muy bien resuelto. El cambio que hiciste —de *"no se oscurecen"* a *"si pierde brillo, un paño la deja como nueva"*— es correcto químicamente: toda la plata 925 se oxida, y prometer lo contrario garantiza reclamos.

### 5 · "Pandora desde $260.000" (macro 2)

Dato externo, no verificable desde aquí y volátil. Ponle fecha de revisión trimestral. Si Pandora baja de precio y tu macro sigue citando $260.000, la comparación se vuelve atacable justo en tu argumento más delicado.

El resto de esa macro está bien construido: convertir la diferencia de material del brazalete en el argumento *"invierte donde está el significado"* es la manera correcta de manejarlo. Y la compatibilidad con Pandora es real y verificable.

### 6 · Los accesorios cuentan para la promo y no lo estás diciendo

Consecuencia técnica del punto 1: clips y cadenas viven en `DATA.charms`, así que **suman para el mínimo de 3 y para la escala de descuentos**.

Entonces esto es cierto y hoy no lo dices:

> Y si le sumas la **cadena de seguridad** ($65.000), cuenta como pieza para la promo — o sea que se te activa el 30% del brazalete *y* además la pulsera queda asegurada 💜

Es un upsell que ya está pagado en el código.

### 7 · Macro 9 (talla): promete algo que no existe

Cierra con *"Yo te confirmo el modelo disponible"*, pero no hay dato de talla en ningún lado del catálogo — ni de stock (ver bloqueante B). Hoy esa macro escribe un cheque que el sistema no puede cobrar.

Tu diagnóstico de fondo es correcto: la talla es la objeción silenciosa que hace que dejen de responder. Por eso conviene resolverla bien.

### 8 · Macro 12: falta el horario

El campo `[horario]` sigue sin llenar. Es el dato que más se nota vacío, porque aparece justo cuando la clienta ya está esperando.

---

## Qué debe consultarse en vivo y qué puede ir fijo

Cruce de las macros contra el inventario, que es lo que pedía la Fase 1:

| Dato | Frecuencia | Fuente |
|---|---|---|
| Precio de un charm específico | **Cada mención** | `data/inventario.json` |
| Disponibilidad | **Cada mención** | ⚠️ No existe — bloqueante B |
| Total de un pedido armado | **Cada cotización** | Motor de precios (`reglas`) |
| ¿Aplica envío gratis? | **Cada cotización** | `total >= 180000` post-descuento |
| Promo de la semana | Semanal | `reglas.promo_brazalete` |
| Escala de descuentos | Al cambiar el sitio | `reglas.descuento_por_charms` |
| Comparación con Pandora | Trimestral | Manual |
| Materiales, garantía, talla | Fijo | Macros |

**El patrón:** todo lo que lleva un signo de peso debe salir de `inventario.json`, nunca escribirse a mano en una macro. Por eso el archivo se regenera con `node scripts/inventario.mjs` desde `index.html`: cambias un precio en el sitio y las respuestas quedan al día solas.

Los precios en texto plano dentro de las macros son deuda: cada uno es un número que algún día será mentira. En la Fase 2 los reemplazo por marcadores (`{{charm.precio}}`) que se resuelven contra el JSON al momento de responder.

---

## Lo que falta para cerrar la Fase 1

El **export de WhatsApp Business** (Ajustes → Chats → Exportar chat, *sin* archivos multimedia, en `insumos/whatsapp/`). Sin él quedan pendientes las tres piezas que dependen de conversaciones reales:

- Tono de voz medido — no inferido de las macros, que son el tono *pretendido*, no el que usas cuando respondes a las 9 de la noche
- Las 10 preguntas más recurrentes **por frecuencia real**, no por intuición
- Qué estrategias de venta cruzada y seguimiento **efectivamente cerraron** ventas

Ese último punto es el que más valor tiene y el único imposible de sustituir: las macros dicen qué ofreces, el historial dice qué funcionó.
