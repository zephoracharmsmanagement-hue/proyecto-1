# Análisis del plan de contenido orgánico (borrador de Gemini)

Fecha: 2026-09-07. Contraste hecho contra el código y los datos reales del
repo, no contra el recuerdo: `assets/stock.json`, `netlify/functions/`,
[`BRIEF.md`](BRIEF.md), [`CONTRATO-REMOTION.md`](CONTRATO-REMOTION.md) y
[`../MAPA.md`](../MAPA.md).

**Veredicto en una línea:** el diagnóstico es correcto —el orgánico es el
frente con mejor retorno ahora mismo, porque la pauta está bloqueada por el
portafolio y el inventario es el cuello de botella— pero la arquitectura
propuesta produce **video mudo a escala**, que es exactamente el producto que
no funciona en TikTok y Reels, y lo hace **sobre un catálogo que no da para
esa cadencia**. Se salva reencuadrando dos decisiones: la frecuencia y el
motor de render.

---

## 1 · Lo que el plan acierta

No es cortesía; son puntos que hay que conservar al reescribirlo.

1. **Elige el frente correcto.** La cuenta publicitaria `1583713932705268`
   no pertenece a ningún portafolio, así que optimiza a ciegas por
   `InitiateCheckout` y no puede usar catálogo ni CAPI. El orgánico es el
   único canal que hoy no depende de esa puerta cerrada.
2. **Google Sheets como calendario editorial es mejor idea que la que había
   en el brief.** Es el único punto donde este plan mejora lo ya
   especificado — ver § 5.
3. **Validar inventario antes de renderizar** es el instinto correcto. El
   umbral que propone está mal (§ 3.3), pero la idea de que el motor no
   proponga lo que no se puede vender es justo la red de seguridad que el
   brief llama «el fallo mudo» de este sistema.
4. **Pilares rotativos** para no repetirse es correcto y hay que conservarlo.
   El reparto propuesto (calidad / exhibición / venta) es razonable.
5. **El discurso de materiales** (charms en plata 925, brazaletes con baño de
   plata) no es un detalle de copy: es lo que separa una promesa cumplible de
   una que se paga con la clienta. Hay que subirlo de «guía» a **validación
   dura** (§ 6.4).
6. **El modelo híbrido para el video de ventas** —que la máquina lo deje en
   borrador y el audio se ponga a mano en la app— es la conclusión correcta.
   El error es aplicarla a 1 de 3 videos en vez de a los 3.

---

## 2 · El error de fondo: el plan optimiza el eslabón que no es el cuello de botella

El plan asume que el limitante es **producir video**. No lo es. Los limitantes
reales, en orden:

| # | Limitante | Dato |
|---|---|---|
| 1 | **Inventario vendible** | 46 de 129 referencias tienen 3 o más unidades (25 en cero, 58 en 1–2, recomputado hoy sobre `stock.json`) |
| 2 | **Tiempo de cámara del propietario** | Es una persona. 90 videos al mes son ~45 horas de grabación y montaje aunque el guion llegue escrito |
| 3 | **Audio en tendencia** | Se elige dentro de TikTok o CapCut. Ninguna API lo entrega |
| 4 | Producir el archivo de video | Lo único que el plan automatiza |

Automatizar el #4 sin tocar 1–3 no multiplica la producción: multiplica los
**renders**. Y un render sin audio en tendencia y sin pieza vendible detrás no
es contenido, es inventario de archivos MP4.

---

## 3 · Los cuatro errores que costarían dinero o la cuenta

### 3.1 · 3 videos diarios no cabe en el catálogo — la aritmética no da

Con la regla de elegibilidad del brief (**3 unidades o más**) y un
enfriamiento de 21 días por pieza, la capacidad máxima de contenido **anclado
a producto** es:

```
46 piezas elegibles ÷ 21 días de enfriamiento ≈ 2,2 videos de producto por día
```

Es decir: **3 videos diarios de producto ya excede la capacidad del catálogo
antes de escribir una línea de código**. Y ese cálculo es optimista, porque
supone que las 46 aguantan la rotación sin bajar de 3 unidades — justo lo
contrario de lo que pasa si el contenido funciona.

Bajar el umbral a `stock > 0` para que quepan 90 videos (que es lo que el plan
propone, § 3.3) resuelve la aritmética **agotando el catálogo más rápido**. Un
Reel que funciona sobre una pieza con 1 unidad es el peor resultado posible:
gasta la grabación, gasta el alcance y termina en «se agotó», que es peor que
no haber publicado — la clienta ya se había decidido.

### 3.2 · Un motor de render por API entrega video mudo, que es la mitad del producto

Templated.io, Shotstack y JSON2Video hacen bien lo que prometen: convertir
JSON en MP4. El problema es qué MP4.

- **Salen mudos o con música de librería.** El audio en tendencia solo se
  consigue dentro de TikTok y CapCut. En video corto el audio es la mitad de
  la viralidad, así que el motor entrega justo la parte que no decide y omite
  la que sí. Esta decisión ya está tomada y razonada en
  [`BRIEF.md`](BRIEF.md) § *Decisión 1*; el plan la deshace sin saber que
  existía.
- **Imagen fija con paneo es la forma reconocible del contenido de bajo
  esfuerzo.** Publicar 90 al mes desde la misma plantilla es el patrón que las
  plataformas despriorizan por contenido no original. El propio plan reconoce
  el riesgo («evitar penalizaciones por contenido repetitivo») y lo intenta
  resolver con pilares — pero el pilar cambia el guion, no la forma, y lo que
  se desprioriza es la forma.
- **Cuesta plata a este volumen.** Las capas gratuitas de los tres son de
  desarrollo: con marca de agua, con minutos contados, o ambas. 90 renders
  mensuales están en plan de pago en cualquiera de las tres (verificar precio
  vigente antes de decidir; el punto no es la cifra, es que deja de ser
  gratis justo al entrar en producción).
- **Y duplica trabajo que ya se está haciendo.** Hay otra sesión construyendo
  **Remotion** con contrato escrito ([`CONTRATO-REMOTION.md`](CONTRATO-REMOTION.md)):
  gratis hasta 3 personas, determinista, y lo que se versiona es el componente
  React en vez del MP4 —que se va a `.gitignore` como cualquier salida de
  build—. Meter un tercer camino de render es exactamente el fallo que este
  repo ya pagó una vez: dos sesiones construyeron cada una su rescate de
  carritos, git no dio ningún conflicto, y el resultado en producción habrían
  sido dos correos a la misma clienta.

**Remotion y estos servicios resuelven el mismo problema; solo uno está ya
pagado, versionado y en marcha.**

### 3.3 · «Stock activo mayor a cero» es el umbral equivocado y además está mal leído

Dos errores encadenados:

**El umbral.** Debe ser **3 o más unidades**, no mayor que cero (§ 3.1).

**La lectura.** `stock.json` guarda las unidades en **dos formas distintas**:

```jsonc
{ "tipo": "charm",   "precio": 76000, "stock": 3 }              // charm
{ "tipo": "pulsera", "precio": 64571, "tallas": { "18": 2, "20": 1 } }  // pulsera
```

Un lector que haga `item.stock || 0` devuelve **cero para las 18 pulseras**, y
el motor deja de proponerlas para siempre **sin dar ningún error**. Es el
patrón de fallo silencioso que más caro ha salido en este repo.

Y hay una tercera capa: **`stock.json` no sabe lo apartado** por un pago en
curso desde el último conteo (`generado: 2026-08-16`, conteo del 2026-08-01).
Eso ya está resuelto y **no hay que construirlo**:
`netlify/functions/disponibilidad.mjs` devuelve el catálogo con `disponible`
calculado en el servidor, conteo menos apartado. El motor lee de ahí, nunca
del JSON crudo.

### 3.4 · El plan no mide nada

No hay una sola métrica de cierre en las seis secciones. Este proyecto ya
aprendió esa lección con dinero real: **Copia 4 tenía el mejor CTR de toda la
cuenta (15,43%) y era de los peores en conversión** — juzgarla por CTR habría
escalado justo el anuncio que peor rendía.

Un Reel con 40.000 vistas y cero checkouts es **peor** que uno con 3.000 y
seis, porque consume el tiempo de cámara que habría producido el segundo. La
señal que ordena qué grabar después es **checkouts por paquete**, no alcance.
Vistas y guardados se anotan como diagnóstico —muchas vistas y cero checkouts
señala que falla la oferta, no el gancho— pero no ordenan la lista.

---

## 4 · Errores menores, pero que hacen perder semanas

| Punto del plan | Qué falla |
|---|---|
| **Imágenes desde Google Drive** | Los enlaces de Drive no son URL públicas directas estables para un renderizador. Y las fotos reales ya viven en `assets/` (130 archivos) servidas por Netlify. Drive añadiría una **segunda fuente de verdad** para las mismas fotos |
| **«Conectar las APIs oficiales de TikTok e Instagram»** como paso 2 | Es el ítem de plazo más largo y está puesto al principio. IG Reels necesita `instagram_content_publish` y **App Review** (semanas), FB Reels es **otra integración distinta**, y TikTok con app sin auditar **solo publica sin difusión** — publica, pero no lo ve nadie. Construir sobre eso ahora es construir sobre una puerta cerrada |
| **Sin puerta de aprobación** | La columna «estados» insinúa un flujo, pero no hay regla. En este repo **nada se publica sin que el propietario apruebe**. Debe ser estado explícito: `propuesto → aprobado → grabado → publicado` |
| **Sin regla sobre imagen generada** | Falta la única regla innegociable del frente visual: cuando hay producto de por medio, **la foto es la real y la IA solo pone el fondo**. Una imagen totalmente generada solo vale para sondeo, nunca como oferta — la tienda cobra de verdad |
| **Sin contabilidad de costo** | Faltan los tres costos reales: render por API (§ 3.2), ~15 créditos por despliegue de Netlify, y —si el CTA manda a WhatsApp— que desde el 1 de agosto de 2026 se cobran por token las respuestas del agente de IA y desde el 1 de octubre también los mensajes de servicio dentro de la ventana de 24 h. El bot no es gratis por estar en una conversación activa |
| **Materiales como «guía»** | Escribirlo en el prompt no basta: un modelo que redacte libre acabará llamando 925 a una pulsera bañada. Tiene que salir del campo `tipo` de la pieza, no de la redacción (§ 6.4) |

Sobre el ajuste de la foto de perfil (isotipo «Z» centrado, sin texto): correcto
y ya hecho. Nada que objetar.

---

## 5 · Lo único donde este plan mejora lo que ya había: Google Sheets

El brief pone los paquetes en una **Data Table de n8n** («Paquetes Zephora»).
Gemini propone **Google Sheets**, y para el calendario tiene razón, por dos
motivos comprobables:

1. **La credencial ya existe.** n8n tiene conectada una cuenta de servicio de
   Google y ya la usa el workflow *Zephora · Hoja de Inventario*
   (`K1J4pHYfvd6QuAq8`, activo). Las credenciales gestionadas de esa instancia
   están **no disponibles** (`available: false`), así que cualquier servicio
   nuevo está bloqueado por una autorización — y Sheets **no lo está**.
2. **El propietario puede aprobar desde el teléfono.** Una Data Table de n8n
   se edita entrando a n8n; una hoja se edita en el bus. La puerta de
   aprobación solo funciona si aprobar cuesta diez segundos.

**Reparto recomendado:** la Data Table sigue siendo el registro técnico
(idempotencia, enfriamiento, `unidades_al_decidir`), y **Sheets es la interfaz
de aprobación** que el motor escribe y lee. No son dos fuentes de verdad si el
flujo es una sola dirección: motor → Sheets (propuesta), Sheets → motor (solo
la columna `estado` y el copy editado a mano).

---

## 6 · La estructura propuesta

Lo mismo que Gemini quería, reencuadrado para que no choque con el catálogo,
el audio ni el presupuesto.

### 6.1 · Cadencia: 3 publicaciones diarias, **una sola con cámara**

El objetivo de 3 al día se conserva. Lo que cambia es qué son:

| Franja | Pieza | Quién la hace | Audio |
|---|---|---|---|
| **1 · Reel principal** | Producto, guion del motor, montado en CapCut | Propietario (grabado por lotes) | **En tendencia**, elegido en la app |
| **2 · Pieza sin rodaje** | Carrusel o video de tipografía: guía de tallas, cómo armar tu pulsera, cuidado de la plata, novedades, tarjeta de precio | **Remotion, automático** | Mudo a propósito (se ve en silencio) |
| **3 · Historia** | Sondeo, encuesta, detrás de cámaras, respuesta a un comentario | Propietario, 30 segundos | Irrelevante |

Esto da los 3 diarios **sin pedir 90 grabaciones al mes**, y sin publicar 90
piezas de la misma forma —que es lo que dispara la despriorización por
contenido no original—. El Reel principal se graba **por lotes**: una sesión
semanal de 6–8 piezas cubre la semana entera.

Los pilares de Gemini se conservan, pero **rotan por semana en la franja 1**,
no por hora del día: educativo (925 verificada) → exhibición → venta.

### 6.2 · Arquitectura de datos

```
disponibilidad.mjs  ──►  motor n8n  ──►  Data Table «Paquetes Zephora»  ──►  Google Sheets
 (conteo − apartado)      (elige,          (registro técnico:              (calendario y
  ya en producción)        guiona)          enfriamiento, auditoría)        aprobación)
                                                   │
                                                   ▼
                                            Remotion (local)
                                     portada · b-roll · carrusel · pieza sin rodaje
                                                   │
                                                   ▼
                                       CapCut (audio) ──► publicar
```

Sin Drive, sin motor de render por API, sin `stock.json` leído a pelo.

### 6.3 · Qué hace el motor, exactamente

Por cada franja 1 del día siguiente:

1. Llama a `disponibilidad` y filtra `disponible >= 3`, contando
   `tipo === 'pulsera' ? suma(tallas) : stock`.
2. Descarta lo que salió en los últimos 21 días.
3. Ordena por margen (charms 87,9% antes que pulseras 70,7%) y, cuando haya
   dato, por checkouts producidos por pieza.
4. Escribe gancho, guion segundo a segundo, **lista de tomas en orden de
   rodaje** (no de montaje), subtítulos cronometrados y copy por red.
5. Guarda con `estado: propuesto`, `unidades_al_decidir` y
   `fuente_disponibilidad`.
6. Lo vuelca a la hoja para que el propietario apruebe.

Para la franja 2 no hace falta inventario: son piezas de marca.

### 6.4 · Las validaciones que tienen que ser código, no instrucciones

| Validación | Regla |
|---|---|
| **Elegibilidad** | `disponible >= 3`, leído de `disponibilidad.mjs`. Si `fuente_disponibilidad` es `solo-conteo`, el paquete **no se aprueba**: no se sabe qué hay |
| **Materiales** | Se deriva de `tipo`: `charm` → «plata esterlina 925»; `pulsera` → «baño de plata». El modelo redacta alrededor, **nunca decide el material** |
| **Precio** | Sale de `_precios.js` / `disponibilidad`, jamás del modelo. Misma regla que ya usa el asesor |
| **Imagen** | Con producto de por medio, la foto es la de `assets/`. La IA solo compone fondo. Imagen totalmente generada = solo sondeo, y se lee como pregunta |
| **Enfriamiento** | 21 días por pieza, aplicado en la Data Table, no en el prompt |

### 6.5 · Delación del fallo mudo

El fallo silencioso de este motor es **proponer piezas que no se pueden
vender**: seguiría generando paquetes preciosos y nadie se enteraría hasta que
una clienta lo pidiera. Dos avisos, siguiendo la regla del repo de que toda
red de seguridad traiga cómo se nota que falló:

- Si `unidades_al_decidir` empieza a salir 0 o 1, la lectura de disponibilidad
  se cayó y está fallando hacia adelante.
- Si el pool elegible baja de 10 referencias, el motor **avisa en vez de bajar
  el listón**. Nunca relaja el mínimo de 3 por su cuenta.

### 6.6 · Medición

Un **enlace medido por paquete** (UTM con el id del paquete) que cierra en
checkout. `netlify/functions/_atribucion.mjs` ya está en producción guardando
las señales del navegador por referencia de pedido: es el punto de enganche.

Ojo con el píxel: hay **dos a propósito**. Un evento de contenido mandado al
equivocado no da error, simplemente no aparece donde se lo busca.

Y paciencia con la muestra: la campaña principal produce ~55 checkouts al mes.
Comparar dos Reels con tres checkouts cada uno no es un resultado, es ruido.

---

## 7 · Orden de construcción

| # | Qué | Por qué ahí |
|---|---|---|
| 0 | **Sondeo de las 14 letras** (F G H I P Q R T U W X Y Z Ñ) | **No necesita el motor y le gana en retorno a todo lo demás.** Una historia con las iniciales y «¿cuál te falta?» responde en 24 h y gratis si comprar ~$73.000 de letras para habilitar ~$1.064.000 de utilidad es apuesta o dato. Hoy se decide a ciegas |
| 1 | Hoja de calendario + Data Table «Paquetes Zephora» | El sitio donde caen los paquetes antes de que exista quien los llene |
| 2 | Motor: elegir pieza → guion → `propuesto` | Ya sirve solo: el propietario aprueba, graba y publica a mano |
| 3 | Portadas con Remotion | Lo que hace que el perfil se vea marca al entrar, que es lo que se pidió. Es imagen, no video |
| 4 | Piezas sin rodaje y carruseles (franja 2) | Sostienen la cadencia los días sin cámara |
| 5 | Enlace medido y atribución a checkouts | Cuando haya paquetes suficientes para comparar |
| 6 | Publicación automática a IG y FB Reels | Al final. **El App Review se puede tramitar en paralelo desde ya** porque tarda semanas — pero no se construye nada encima hasta que esté aprobado |

TikTok **se queda manual**, y no es una fase pendiente: es la decisión. Una app
sin auditar publica sin difusión, y el audio se elige dentro de la app de todas
formas.

---

## 8 · Registro de lo que se decidió NO hacer

Para que una sesión futura no lo reabra sin saber que se discutió:

1. **No se contrata motor de render por API** (Templated / Shotstack /
   JSON2Video). Entregan video mudo, cuestan por render a este volumen y
   duplican Remotion, que ya está en marcha, es gratis a este tamaño de
   equipo y se versiona como código.
2. **No se automatiza el Reel principal.** El audio en tendencia es la mitad
   del resultado y solo existe dentro de TikTok y CapCut.
3. **No se baja el umbral de 3 unidades** para que quepan más videos. Publicar
   lo que está a punto de agotarse es peor que no publicar.
4. **No se mueven las fotos a Google Drive.** Ya están en `assets/`, servidas
   con URL pública estable.
5. **No se comitean los videos.** ~15 créditos por despliegue y el historial de
   git se los queda para siempre. Lo que se versiona es el componente que
   produce el archivo, no el archivo.
