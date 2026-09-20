# Estado del proyecto

Documento de traspaso. Si estás retomando esto en una sesión nueva, empieza por
aquí y sigue con el [`README.md`](README.md), que documenta cómo funciona el
sitio; este archivo cuenta **en qué punto está y qué decisiones no hay que
deshacer sin querer**.

## 🚧 ENCARGO ABIERTO — la web completa, en bucle, hasta que convierta

**Reclamación de trabajo (regla 4 de `CLAUDE.md`), abierta el 2026-09-19.**
El propietario encarga **rehacer el sitio entero hasta que quede profesional y
convertidor**, trabajando en bucle: revisar, arreglar, desplegar, volver a
mirar. No es una tarea con final escrito — es un ciclo.

**Rama de trabajo:** `claude/zephoracharms-conversion-funnel-nom9ph`
**Alcance:** todo el frente de tienda. Por eso, **regla 1 de `CLAUDE.md` en
pleno**: una sola sesión toca la tienda mientras este encargo esté abierto.
Otra sesión en paralelo sobre `index.html`, `tienda.js`, `tienda.css` o
`herramientas/gen_colecciones.py` duplicará trabajo.

### Lo primero que hay que entender: qué NO detectan las pruebas

Este es el aprendizaje más caro de la jornada del 2026-09-19, y vale más que
cualquier lista de tareas. **Tres fallos reales llegaron a producción con la
suite en verde y el despliegue limpio:**

1. **Una página que nadie enlazaba.** `coleccion-marvel.html` estuvo un día
   desplegada sin que ninguna otra página apuntara a ella. Respondía 200.
2. **Enlaces que no hacían nada.** En `kits.html`, cuatro de los seis enlaces
   del menú eran anclas a secciones que solo existen en la portada, y los dos
   logotipos apuntaban a `#top` —el principio de la propia página—, así que no
   había forma de volver al inicio. HTML válido, cero errores.
3. **Secciones sin un solo estilo.** Las de la primera página de colección
   salieron crudas porque usé clases que no existían en `tienda.css`. Las
   pruebas de datos pasaban: el carrito calculaba bien.

Los tres los encontró **una persona mirando el sitio**, no una batería. La
regla que sale de aquí, y que este encargo necesita porque va a producir muchas
páginas:

> **Ningún cambio visual se da por bueno sin verlo renderizado**, y ninguna
> página nueva sin comprobar (a) quién la enlaza, (b) que sus enlaces lleven a
> algún sitio, y (c) que sus secciones tengan estilos.

En el entorno de ejecución remota se puede levantar `python3 -m http.server` y
mirar con Playwright (`pruebas/node_modules` ya lo trae). **La red hacia
`zephoracharms.com` está bloqueada por política**, así que contra producción no
se puede verificar desde aquí: eso lo hace el propietario.

### Qué está en el aire hoy

Último despliegue: `6aaeb1e2`, commit `1570d5a`, 2026-09-19 16:01 UTC.

- **Todo el catálogo es Plata Esterlina 925 con sello S925 grabado**, brazaletes
  incluidos, y los tres niveles de brazalete valen **$118.000 / $138.000 /
  $158.000**. Ver la entrada del 2026-09-18.
- **`tienda.css` y `tienda.js`** — el CSS y el motor del carrito salieron de
  `index.html`. Los comparten la portada y todas las páginas generadas.
- **`coleccion-marvel.html`** — 15 piezas, generada.
- **`kits.html`** — cuatro kits con la escalera de descuento aplicada a cada
  uno. **Sin descuento propio**: decisión del propietario, y por eso
  `_precios.js` no se tocó.
- **Franja de atajos** en la portada: Kits · Marvel · Brazaletes · Charms.
- **El bot de WhatsApp** al día en material y sin precios escritos a mano.

### Lo que falta, por orden de impacto

1. **La prueba de compra real de punta a punta.** Comprar un brazalete a
   $118.000 y confirmar que Wompi cobra exactamente eso. **Arrastra desde el
   2026-09-18 y solo la puede hacer el propietario.** Hasta que no esté hecha,
   el cambio de precios no está confirmado contra dinero real.
2. ~~**La página de kits no avisa si una pieza se agotó.**~~ **Resuelto
   2026-09-20.** Cada paso de la escalera (`.kit-paso`) ya trae en
   `data-piezas` los ids que necesita (generador: `gen_colecciones.py`), y
   `tienda.js` los revisa contra el mismo `agotado()` que usa el resto del
   sitio en cuanto carga `stock.json`. Si algún id falta, ese paso —solo ese,
   no el kit entero— se convierte en un enlace a WhatsApp con `waEncargo()`
   (el mismo patrón que ya existe para charms sueltos), en vez de prometer un
   carrito que el checkout rechazaría. Si la pieza agotada es el brazalete
   base, los cuatro pasos caen porque todos lo incluyen — no hizo falta
   caso especial. Probado a mano con Playwright vaciando temporalmente
   `stock.json` (nunca comiteado así): un charm agotado bloquea solo el paso
   que lo necesita, el brazalete agotado bloquea los cuatro. Sigue siendo
   conteo estático de build, no lo apartado en vivo —igual que el resto de
   `tienda.js`—, así que puede tardar hasta el próximo build en reflejar una
   venta que agote justo en ese momento.
3. **Creativo nuevo para la pauta.** Dos argumentos verdaderos que no están en
   ningún anuncio: todo es Plata 925 con sello, y **con brazalete el tercer dije
   cuesta $32.050 en vez de $95.000**. Los seis anuncios activos no mencionan
   precio ni material, así que no hubo que pausar ninguno.
4. **Reponer inventario.** Sigue siendo el cuello de botella real del negocio,
   no la pauta: faltan 14 letras que nunca se compraron. Ver `CLAUDE.md`.
5. **Las secciones que faltan:** Brazaletes, Destacados y «Para regalar».
   Símbolos es la mejor colección temática que nadie ha pedido —21 de 29 piezas
   con 3+ unidades—. **Disney, Zodiaco, Pixar y Profesiones NO se pueden hacer
   todavía**: tienen 1, 0, 0 y 0 piezas con inventario suficiente. Una página de
   agotados convierte peor que no tenerla.
6. **`anular-venta.mjs` no corrige el `Purchase` que ya salió a Meta** —
   § Pendientes 7, baja prioridad.
7. ~~**Los pasos de la escalera de kits armaban el carrito con dijes elegidos
   por el sistema, no por la clienta.**~~ **Resuelto 2026-09-20, a pedido
   directo del propietario tras verlo en su celular** (ver captura de
   `kits.html`): pedía «brazalete + 2 dijes» y la tienda le ponía dos dijes
   cualquiera en el carrito sin que él los hubiera tocado. El enlace de cada
   paso ya solo pone el brazalete (`p=`); los dijes del kit van en `sug=` y
   **nunca entran solos al carrito** — `tienda.js` los resalta en el
   catálogo (borde rosa + etiqueta «Sugerido»), abre el catálogo completo y,
   si comparten categoría (el caso normal), filtra a esa categoría con el
   mismo `aplicarFiltro()` que ya usan las tarjetas de la portada — si no,
   el filtrado se salta y queda «Todos», nunca oculta piezas. Un aviso
   arriba del catálogo (`.sug-banner`) explica qué está pasando. El
   descuento que se gana al agregarlos se ve en el resumen del carrito que
   **ya existía** (`#row-save`, `#desc-nota`) — no hubo que inventar una
   segunda forma de mostrarlo. Probado de punta a punta con Playwright:
   aterrizar con `sug=spider-man,esfera-telarana-spider-man,mascara-spider-man-roja`
   filtra a Marvel, resalta los tres, y agregarlos uno por uno con clics
   normales de "Agregar" llega exactamente a $324.850 / ahorras $78.150 —
   los mismos números que muestra kits.html para "3 dijes". `k=` en el
   enlace es solo el nombre del kit para ese aviso; se arma con nodos de
   texto, no `innerHTML`, porque viene de la URL.

### Trampas que ya se pagaron — no redescubrirlas

- **`tienda.js` da por hecho el diseño de la portada.** Accede sin protección a
  unos 60 elementos por `id`, y antes también al carrusel del hero por clase.
  Una página generada a la que le falte uno **se queda sin carrito entero**: las
  tarjetas se ven, se tocan, y no pasa nada. Por eso las páginas generadas
  llevan contenedores vacíos al final del HTML. **Al hacer una página nueva,
  mirar la consola del navegador.**
- **La cabecera que se copia de `index.html` trae enlaces relativos a esa
  página.** `arregla_nav()` en el generador lo resuelve: un ancla se respeta si
  esa sección existe aquí, y si no, se reescribe hacia `index.html`.
- **El precio vive en cuatro sitios** —`DATA` en `tienda.js`, las tarjetas de
  `index.html`, los encabezados de nivel, y `stock.json`— y de ahí sale
  `catalogo.json`, que es lo que lee el servidor al cobrar. **Cambiar precios
  por `id`, NUNCA por número:** ocho charms valen exactamente lo mismo que un
  brazalete, y un buscar-y-reemplazar por cifra les cambia el precio sin dar
  ningún error.
- **Al tocar `tienda.js` hay que correr `extraer_catalogo.py`.** Si no, el
  servidor cobra con datos viejos. El extractor se para con un error en vez de
  escribir un catálogo a medias; eso ya salvó una.
- **`generado` de `stock.json` es un interruptor, no una fecha.** Cambiarlo
  pone a cero lo vendido de todo el catálogo.
- **Un número de precio que no se pueda reproducir con `calcular()` no se
  escribe.** Ni en una página, ni en un documento, ni en un guion.
- **El prompt del bot de WhatsApp está escrito SIN TILDES.** Buscar «baño» o
  «latón» devuelve cero y hace creer que está limpio.
- **Solo `main` despliega**, y cada despliegue son ~15 créditos. Un push que
  solo cambia `.md` se salta el despliegue (regla `ignore` de `netlify.toml`),
  así que documentar es gratis. **Volver a la rama después de empujar `main`**:
  ya pasó quedarse en `main` y commitear ahí sin querer.
- **`regresion` y `dudas` fallan en el entorno remoto** por elementos que no se
  hacen visibles, no por el código. Se comprobó con `git stash` contra `main`.
  Todo lo demás tiene que estar en verde.

### Cómo trabajar en bucle

La skill `/loop` de Claude Code repite un encargo por intervalos o se
autorregula. Para este frente, un ciclo que funciona:

1. **Mirar** una página renderizada (Playwright, celular a 390px primero: por
   ahí entra casi toda la venta).
2. **Elegir un fallo concreto** — algo que confunda, mienta o no lleve a
   ninguna parte. No refactorizar por gusto.
3. **Arreglarlo en el generador** si la página es generada, nunca en el HTML
   de salida: la próxima corrida lo pisa.
4. **Suite completa** (`bash pruebas/correr.sh`) y volver a mirar el render.
5. **Desplegar junto con otros cambios**, no de a uno: son ~15 créditos cada
   vez.
6. **Anotar aquí** lo aprendido, sobre todo lo que las pruebas no detectan.

**Qué significa «convertidor» en este sitio, con datos y no con opinión:** de
quien aterriza, el 35% agrega al carrito —eso está sano—; de ahí a iniciar
checkout cae al 31%, y esa es la fuga real. El cuello no es el configurador.
Medir siempre en checkouts, nunca en clics: el anuncio con mejor CTR de la
cuenta (15,43%) fue de los peores en conversión.

---

## Kits, atajos en la portada y la colección enlazada — 2026-09-19

**Está en el aire.** Despliegue `6aaeaf8fbcc64e0008b25006`, commit `4caad3c`,
publicado a las 15:52:06 UTC, 22 segundos de construcción, sin errores. 8
archivos nuevos —3 páginas generadas, entre ellas `kits.html`—, 16 funciones,
14 redirecciones y 7 reglas de cabecera. El escaneo de secretos revisó 268
archivos y no encontró ninguno.

**Salió junto con el trabajo de la otra sesión** (`envio-estado`, PR #1): su
rama ya había mezclado la nuestra, y al actualizar contra `main` no hubo un
solo conflicto. Aun así se comprobó a mano lo que un merge limpio puede borrar
en silencio —**los dos `fbq('init')` en las cuatro páginas, las cabeceras
`no-cache` de `tienda.css` y `tienda.js`, y los 135 precios cuadrados entre
`tienda.js`, `catalogo.json` y `stock.json`**—, porque limpio no significa
correcto. Su batería de envío-estado quedó en verde también.

### `kits.html` — cuatro kits, y la escalera aplicada a cada uno

La página a la que apunta la pauta. Cada kit muestra el mismo conjunto a 1, 2,
3 y 4 dijes con lo que cuesta en cada escalón, así el descuento progresivo se
ve aplicado sobre lo que la clienta mira y no como una regla abstracta en otra
sección. **El escalón de 3 va marcado**: es donde entra el 30% del brazalete
además de la escala por cantidad, y el descuento salta de ~5% a ~20%.

| Kit | 1 dije | 2 | 3 | 4 |
|---|---|---|---|---|
| Spider-Man | $213.000 | $292.800 | **$324.850** | $367.600 |
| Vengadores | $213.000 | $292.800 | **$324.850** | $367.600 |
| Fe y Protección | $204.000 | $276.240 | **$308.700** | $343.600 |
| Azul Profundo | $220.000 | $288.880 | **$315.900** | $351.600 |

**DECISIÓN DEL PROPIETARIO: los kits NO llevan descuento propio.** Se evaluó
añadir uno —incluso con los números sobre la mesa, que daban margen de sobra— y
se descartó a favor de enseñar la escalera que ya existe. La consecuencia buena
es que **`_precios.js` no se tocó**: el archivo que firma el cobro quedó igual,
y ningún kit puede prometer un número que el checkout no vaya a cobrar, porque
cada precio sale de `calcular()`.

Un kit es **un enlace con el carrito ya armado** (`?p=`), el mismo formato que
ya usan el rescate y el bot de WhatsApp. El brazalete va **sin talla** a
propósito: la elige la clienta.

> **Por qué el kit no se definió como «exactamente estas piezas».** Con esa
> regla, añadir un quinto dije habría hecho perder el descuento y **subir el
> total $108.000 por un dije de $95.000** — añadir una pieza costaría más que la
> pieza. Se calculó antes de escribir nada. Si algún día se retoma el descuento
> propio de kit, la regla tiene que ser «el carrito **contiene** el kit».

`assets/kits.json` es dato editable a mano: añadir un kit no es tocar código.

### Los atajos, y una página que estuvo un día huérfana

**`coleccion-marvel.html` se desplegó el 2026-09-18 sin que ninguna página del
sitio la enlazara.** Solo se llegaba por el anuncio. La suite pasó y el
despliegue salió limpio: **ni las pruebas ni Netlify detectan una página
inalcanzable**. Al publicar una página nueva, comprobar a mano quién la enlaza.

Se añadió una franja de cuatro atajos bajo la barra de beneficios —Kits,
Marvel, Brazaletes, Charms— y la tarjeta de categoría de Marvel ahora lleva a su
página. **Hubo que quitarle el `data-cat`**: el manejador de `tienda.js`
intercepta las tarjetas que lo llevan, así que con él puesto el clic nunca
habría salido de la portada.

> **Las tarjetas de categoría SÍ filtran**, por `data-cat` desde `tienda.js`. El
> `href="#charms"` es solo el respaldo sin JavaScript. Queda escrito porque en
> la conversación se afirmó lo contrario —que las seis hacían lo mismo— y era
> falso: se leyó el HTML sin leer el manejador.

Tres conteos que estaban desactualizados y ahora salen del catálogo: Marvel
decía 9 charms y son 15, Símbolos decía 31 y son 29, y el atajo de Charms dice
117, no 135 —135 es el catálogo entero, con los 18 brazaletes dentro—.

También se corrigió que las páginas generadas enlazaban `tienda.css` **dos
veces**: el bloque extraído de `index.html` ya terminaba en ese `<link>` y la
plantilla ponía otro. No rompía nada, pero lo iba a heredar cada colección
nueva.

### Qué falta

1. **La prueba de compra real de punta a punta** sigue pendiente desde el
   despliegue anterior: un brazalete a $118.000, mirando que Wompi cobre eso.
   La red hacia el sitio está bloqueada por política en el entorno remoto, así
   que esto solo se puede hacer desde fuera.
2. **La página de kits no avisa si una pieza se agotó.** `disponibilidad.mjs`
   protege el cobro, pero con la pauta apuntando ahí y **3-4 kits de stock de
   cada uno**, se va a notar rápido.
3. **Creativo nuevo para la pauta:** todo el catálogo es Plata 925 con sello, y
   el tercer dije cuesta $32.050 en vez de $95.000. Ninguna de las dos cosas
   está dicha en ningún anuncio.

## Plata 925 en todo, precios nuevos de brazalete y la primera colección — 2026-09-18

**Está en el aire.** Despliegue `6aad81721f0dd1000817b2be`, commit `3193789`,
publicado a las 18:23:04 UTC, 20 segundos de construcción, sin errores. 19
archivos nuevos, 14 funciones desplegadas, 12 redirecciones y **7 reglas de
cabecera** (eran 5: las dos nuevas son el `no-cache` de `tienda.css` y
`tienda.js`). El escaneo de secretos revisó 261 archivos y no encontró ninguno.

### Lo que cambió, en ocho commits

| | |
|---|---|
| `b8ab95c` | Anota el hueco de `anular-venta.mjs` con Meta CAPI (§ Pendientes 7) |
| `93389ed` | Saca el CSS y el motor del carrito de `index.html` a `tienda.css` y `tienda.js` |
| `ebdb9e8` | `coleccion-marvel.html`, primera página de colección, generada |
| `59d2c90` | Estilos de las páginas de colección |
| `9650110` | Arregla el extractor de catálogo, que la extracción dejó sin fuente |
| `8e234d9` | **Brazaletes a Plata 925 y precios a $118.000 / $138.000 / $158.000** |
| `1d3b1e9` | Corrige el apunte de Addi: sí se acepta, fuera de la pasarela |
| `3193789` | Foto de la Pulsera Avengers en la portada de la colección |

### Los brazaletes son Plata 925, no baño

**Decisión del propietario con confirmación del proveedor (2026-09-18):** todo
el catálogo es Plata Esterlina 925 legítima **con sello S925 grabado**,
brazaletes incluidos. Lo anterior era un error de información del proveedor, no
de la tienda. **No lo deshagas:** el sitio decía lo contrario de forma explícita
y deliberada —`terminos-y-condiciones.html` llegaba a afirmar «No son plata
maciza»— y esa redacción conservadora era correcta con la información de
entonces.

El costo no cambió: sigue rondando los $18.000 por brazalete.

Se corrigió en diez sitios: `index.html` (título, descripciones, datos
estructurados, barra de beneficios, sección de brazaletes y las 18 etiquetas de
tarjeta), la ficha de producto y el carrito (`tienda.js`), el resumen del
checkout, los términos, las tres respuestas de las FAQ **y sus datos
estructurados**, `disponibilidad.mjs` y el prompt del asesor. Las páginas
legales se cambiaron en `gen_paginas.py`, no en el HTML: la próxima corrida las
habría pisado.

**Y en el bot de WhatsApp, que es lo que no se ve desde el repo.** El prompt del
workflow `74TjEtDnn940jh9k` decía que los brazaletes eran baño de plata **e
instruía al modelo a corregir a la clienta** («nunca llames plata a secas a un
brazalete: es publicidad enganosa»). Actualizado y publicado el mismo día,
versión `71db6652`. Se cambió también el aviso de oxidación: ahora dice que la
plata sí se oxida, brazaletes incluidos, **y que eso no da lugar a devolución**
— sin esa frase, el primer brazalete que se oscurezca trae un reclamo de
garantía que antes no existía.

> **Trampa al auditar el prompt del bot:** está escrito **sin tildes**. Buscar
> «baño» o «latón» devuelve cero y hace creer que está limpio. Hay que buscar
> «bano» y «laton».

### Precios de brazalete: $118.000 / $138.000 / $158.000

Desde $68.000, $78.000 y $88.000. **El encargo original citaba $58.000 /
$68.000 / $78.000**, que son los precios de antes del alza del 2026-09-13:
ejecutarlo literal habría dejado un nivel sin tocar y otro con el precio del
vecino.

**La trampa que hay que recordar para el próximo cambio de precios: ocho charms
valen exactamente lo mismo que un brazalete** —los cuatro clips y Corazón Mamá
e Hija a $78.000, y Corazón de Filigrana, Elefantito Rosa y Corazón Árbol de la
Vida a $88.000—. Un buscar-y-reemplazar por cifra les cambia el precio **sin dar
ningún error**. Se cambió por `id`, y se comprobó: 0 charms tocados.

El precio vive en cuatro sitios y los cuatro quedaron cuadrados —la tabla `DATA`
de `tienda.js`, las tarjetas de `index.html`, los tres encabezados de nivel y
`stock.json`—, comprobado pieza por pieza: 135 piezas, 0 desajustes. `generado`
de `stock.json` no se tocó: es un interruptor, no una fecha.

Los seis casos de compra, navegador contra servidor: 1 charm $95.000 · brazalete
nivel 1 $118.000 · nivel 2 $138.000 · nivel 3 $158.000 · brazalete + 3 charms
$324.850 · + 4 charms $367.600. Contraentrega suma $20.000 en todos.

**El argumento de venta se hizo más fuerte, no más débil:** con el brazalete más
caro, el 30% pesa más. Con la Pulsera Avengers **el tercer charm cuesta $32.050**
en vez de $95.000. Ese número no está en ningún anuncio todavía.

### El motor salió de index.html, y eso rompió el extractor

`index.html` era un solo archivo de 3.474 líneas con todo el CSS y el JS dentro.
Ahora viven en `tienda.css` y `tienda.js`, que comparten `index.html` y las
páginas de colección. Fue extracción pura, sin cambiar lógica.

**Lo que se llevó por delante:** `extraer_catalogo.py` leía la tabla `DATA` de
`index.html` y dejó de encontrarla. Es decir, la tubería que mantiene al
servidor cobrando lo mismo que muestra la página quedó cortada. **Se paró con un
error en vez de escribir un catálogo a medias**, que es justo para lo que estaba
escrita así. Ahora lee de las dos fuentes: `tienda.js` para `DATA` y las reglas,
`index.html` para las tarjetas.

**Al tocar `tienda.js`, acordarse de correr el extractor.** Si no, el servidor
cobra con los datos viejos.

### La primera página de colección — `coleccion-marvel.html`

A esto apunta la pauta: quien hace clic en un anuncio de Marvel aterriza en una
página de Marvel, no en la portada. Trae el catálogo acotado a las 15 piezas del
grupo, el brazalete base, y todo el material de confianza —tallas, videos,
reseñas, pagos y envío— porque ahí llega tráfico frío.

**No se escribe a mano: la genera `herramientas/gen_colecciones.py`** extrayendo
de `index.html` el andamiaje del carrito y las tarjetas por `data-id`. Añadir una
colección son ~10 líneas en la lista `COLECCIONES`; como los grupos ya viven en
`catalogo.json`, una pieza nueva entra sola en la suya.

Tres cosas que salieron de construirla y no hay que redescubrir:

1. **`tienda.js` da por hecho el diseño de la portada.** Accede sin protección a
   ~60 elementos por `id`, y además al carrusel del hero por clase. Sin ese
   carrusel, la página se quedaba **sin carrito entero** —las tarjetas se veían,
   se tocaban, y no pasaba nada—. Se le puso guarda. **Al hacer la siguiente
   colección, mirar la consola del navegador**: pueden quedar más supuestos así.
2. **Las páginas generadas necesitan contenedores vacíos** (`#q`, `#q-x`,
   `#full-cat`, `#resto-grid`, `#filters`, `#rail-top`, `#letras-grid`…) solo
   para que el script no reviente. Van ocultos al final del HTML, comentados.
3. **Las secciones nuevas salieron sin un solo estilo** y nadie lo detectó: las
   pruebas de datos pasaban porque el carrito calculaba bien. Lo cazó mirar la
   página renderizada. **Un cambio visual no se da por bueno sin verlo.**

### Qué falta comprobar, y no se pudo desde la sesión

La red hacia `zephoracharms.com` está **bloqueada por política** en el entorno de
ejecución remota, así que esto se verificó por el conector de Netlify y no
contra el sitio vivo. Queda pendiente, desde una terminal o un navegador:

1. **Una compra real de punta a punta**, con un brazalete, mirando que el total
   de la pasarela sea el de la página.
2. **Que el bot de WhatsApp siga recibiendo.** n8n toca la configuración del
   webhook en Meta al publicar y ya se ha quedado en blanco sin avisar. Si no
   responde: `GET /1868981540432885/subscribed_apps`.
3. **Que los mensajes sigan llegando a la app de WhatsApp Business**, no solo al
   bot (coexistencia).
4. **La página de colección en un celular de verdad.**

### Lo siguiente, y es de pauta

Los seis anuncios activos **no mencionan precio ni material**, así que no hubo
que pausar ninguno y no se pausó: reactivar reinicia el aprendizaje, y el de
mármol lleva 10.389 impresiones acumuladas. Lo que sí queda pendiente es
**creativo nuevo**: que todo sea Plata 925 con sello grabado es un argumento que
la tienda no tenía, y el tercer charm a $32.050 tampoco está dicho en ningún
lado.

## Endpoint de confirmación de envío por WhatsApp (Skydropx) — fusionado el 2026-09-18

**PR #1**, merge commit `07a2ea9`. Código completo y revisado (5 revisiones de
tarea + revisión final de toda la rama, con una corrección aplicada y su
re-revisión) — ver `docs/superpowers/plans/2026-09-18-envio-estado-skydropx.md`
para el detalle de esa revisión, incluida la lista de decisiones tomadas.

**Alcance:** `docs/superpowers/specs/2026-09-18-skydropx-whatsapp-design.md`,
`docs/superpowers/plans/2026-09-18-envio-estado-skydropx.md`, y un endpoint
nuevo y aislado: `netlify/functions/_envios.mjs` + `envio-estado.mjs` +
`pruebas/envio-estado.js`, más dos líneas en `netlify.toml` (ruta
`/envio-estado` y bloqueo de `/docs/*`) y una en `pruebas/correr.sh` y
`pruebas/README.md`. **No toca** `index.html`, el checkout, ni ningún otro
archivo de `netlify/functions/`.

**Qué es:** automatización nueva, disjunta del bot de ventas de
`automatizaciones/conversion/BOT-WHATSAPP-ARQUITECTURA.md` (frente aparte, sin
relación de código). Cuando Skydropx marca un envío como despachado o cambia
de estado, un flujo de n8n (correo → HTTP → WhatsApp) le avisa a la clienta.
Skydropx es solo panel web, sin API — el diseño completo, incluida la
autenticación del endpoint nuevo y la plantilla para Meta, está en la spec.

**Lo que falta para que sirva de algo en producción, y no es código:**
correos de muestra de Skydropx (uno por cada uno de sus seis tipos de evento,
para escribir el nodo de n8n que los reconoce), aprobación de la plantilla
`actualizacion_envio` en Meta, y poner `ENVIO_ESTADO_KEY` en Netlify + como
credencial Header Auth en n8n. Todo del propietario — ver § 7 de la spec.

## Precios, envío gratis y tanda nueva de videos — 2026-09-13

Aprobado por el propietario, mezclado a `main` (`522e375`, avance rápido) y
**desplegado el 2026-09-13**.

**Está en el aire.** Despliegue `6aa6ff72bdfc8c000871da6d`, publicado a las
19:54:47 UTC, 20 segundos de construcción, sin errores. 32 archivos nuevos
—4 páginas y 28 recursos—, 14 funciones desplegadas, 12 redirecciones y 5
reglas de cabecera sin fallos. El escaneo de secretos revisó 256 archivos y no
encontró ninguno.

### Lo que se publicó, en once commits

| | |
|---|---|
| `bdd498a` | Envío gratis siempre y +$10.000 en las 135 piezas |
| `d8a26e1` | Tanda nueva de videos — cierra el vencimiento del 19-sep |
| `f70e953` | Retirado el Empaque Premium de Regalo |
| `af3c7e9` | El peso real en el comentario del observer de videos |
| `6915850` | Reseñas reales de las clientas · medios de pago con ficha |
| `5b30ce8` | Logotipo de Addi |
| `aa2e564` | Nequi, Daviplata, PSE, Visa, Mastercard |
| `28f3b8b` | Bancolombia — el cuadro de medios de pago queda completo |
| `e9501a5`+`8d978a5` | Mezcla con el mapa de fotos de WhatsApp de la otra sesión |
| `522e375` | Versiona portadas de video y logotipos contra la caché |

Todo en un solo despliegue: son ~15 créditos cualquiera que sea el tamaño, así
que juntarlos era lo correcto (§ *Al desplegar*).

**La suite antes de mezclar: 551 comprobaciones en verde.** En rojo solo
`regresion` y `dudas`, que fallan **igual en `main` sin tocar nada** —se
comprobó con `git stash`— por elementos que no se hacen visibles en el entorno
de ejecución remota, no por este cambio. `checkout` completo en verde, que era
el que no se podía dar por bueno a ciegas.

### La mezcla con lo de la otra sesión, que salió limpia y no lo era

Mientras esto se preparaba, otra sesión metió **ocho commits en `main`**: el
mapa de fotos por pieza para que el bot de WhatsApp mande la imagen en el chat.
Tocaron tres de los archivos de aquí —`catalogo.json`, el extractor y
`_precios.js`— y **git mezcló sin un solo conflicto**. Eso no significa que
estuviera bien, que es justo lo que avisa `CLAUDE.md`.

Lo que había que comprobar a mano, y se comprobó:

- El extractor conserva las dos cosas: saca el mapa de fotos **y** ya no busca
  el precio del empaque. Corre y da 135 piezas con precio y foto.
- `_precios.js` exporta `fotos` (lo necesita `disponibilidad.mjs`) y sigue
  forzando `empaque` a `false`.
- **Los dos `fbq('init', …)` siguen en los tres HTML.** Es la comprobación que
  `CLAUDE.md` pide explícitamente: una mezcla descuidada borra el píxel nuevo
  —y con él el `Purchase` de servidor— sin que nada dé error.
- El `catalogo.json` que produjo el merge textual **no era el que sale del
  extractor**. Regenerado, cambiaban 40 líneas.

### Un defecto que salió de ahí y se arregló

Esas 40 líneas no eran un dato distinto: eran las 27 letras en otro orden. El
código nuevo recorría un `set` de Python, y el orden de un `set` cambia entre
ejecuciones. O sea que **regenerar el catálogo sin tocar nada producía un diff
de 40 líneas**.

No es cosmético: el extractor pisa ese archivo cada vez que se mueve un precio,
y si su salida no es reproducible, ese ruido tapa el cambio de verdad —que es
exactamente el cambio que hay que poder revisar antes de cobrar—. Ahora recorre
`data['charms']` en su orden, y dos corridas seguidas, o con otra
`PYTHONHASHSEED`, dan el mismo archivo byte a byte.

### Por qué se tocó el precio

El checkout perdía el **89% entre `InitiateCheckout` y `AddPaymentInfo`** (360 →
40 en 30 días). La causa no era el precio de la joya sino **el choque del envío
en el último paso**: el carrito típico se quedaba en ~$152.000 y el envío gratis
empezaba en $180.000, así que casi nadie lo alcanzaba y el total crecía
$15.000–$25.000 justo al ir a pagar.

Los tres cambios van juntos y no se pueden separar sin romper la cuenta:

| Qué | Antes | Ahora |
|---|---|---|
| `reglas.envioGratisDesde` | 180000 | **0** — gratis siempre |
| `reglas.envio.contraentrega` | 25000 | **20000** |
| `reglas.envio.anticipado` | 15000 | 15000 — *ya no se cobra*, pero es el costo real que asume la tienda |
| Precio de las 135 piezas | — | **+$10.000 cada una**, sin excepciones |

`envioGratisSoloAnticipado` **sigue en `true`**: la contraentrega paga envío
siempre, porque ahí la transportadora cobra el recaudo y el paquete puede
devolverse sin cobrar.

Los $10.000 absorben el envío que la tienda ahora regala. Con márgenes del 88%
en charms y del 71% en pulseras cabe de sobra. Los precios se editan **en
`index.html`** —única fuente— y de ahí los copia
`herramientas/extraer_catalogo.py` a `assets/catalogo.json`; `assets/stock.json`
se sincroniza aparte y quedó **135/135 cuadrado pieza por pieza**.

### La trampa que había en el camino

Con umbral 0, las dos barras de «cuánto te falta para el envío gratis»
**dividían por cero**: `subtotal/0`. En `index.html` y en `checkout.html`. Con
carrito vacío eso es `0/0` = `NaN` y el ancho de la barra queda roto en mitad
del paso de pago. Las dos se esconden ahora mientras el umbral sea 0, y los
textos que citaban «$180.000» solo aparecen si vuelve a haber umbral. **Si algún
día se restablece un mínimo, basta con subir `envioGratisDesde` y la barra
reaparece sola** — no hay nada más que tocar.

### Qué se verificó antes de dar esto por bueno

- **`netlify/functions/_precios.js` no tiene ningún número escrito a mano**: lee
  precios, escalas y tarifas de `catalogo.json` por `require`. Si cliente y
  servidor calcularan distinto, el checkout rechazaría el pedido sin avisar y la
  venta se perdería en silencio.
- **Los 6 casos de compra del encargo**, navegador contra servidor, idénticos:

  | Carrito | Anticipado | Contraentrega |
  |---|---|---|
  | 1 charm | $95.000 | $115.000 |
  | 1 pulsera sola | $68.000 | $88.000 |
  | pulsera + 3 charms | $282.200 | $302.200 |

- **Los 40 carritos al azar** de `pruebas/precios.js`, también idénticos.
- **Las 16 baterías en verde**, con la salvedad de `dudas`, que ya fallaba
  igual en `main` sin tocar nada (`fill` sobre un elemento invisible — no es de
  este cambio).

### Tres pruebas estaban clavadas a la tabla de precios vieja

Se pusieron rojas **con el sitio perfectamente sano**, que es el peor tipo de
rojo porque enseña a ignorarlo. Se arreglaron leyendo el dato en vez de
repetirlo:

- `pruebas/_pieza.js` buscaba «un brazalete de $58.000»; ahora coge el más
  barato con unidades.
- `pruebas/stock.js` comparaba contra `257350` y `55650` escritos a mano; ahora
  contra lo que devuelve `calcular()`.
- `pruebas/precios.js` afirmaba «por debajo del umbral cada forma de pago paga
  su tarifa», que con umbral 0 ya no existe; ahora comprueba la regla de verdad
  y **detecta sola** si algún día vuelve un umbral.

**Regla que sale de aquí:** una prueba que repite una cifra del catálogo se
rompe el día que cambia un precio. La cifra se lee de `catalogo.json` o de
`calcular()`, nunca se copia.

### Se retiró el Empaque Premium de Regalo

**Decisión del propietario (2026-09-13):** confunde por su precio y **nunca lo
pidió nadie**. Confirma la hipótesis que este mismo documento dejó anotada hace
semanas —«$40.000 sobre un brazalete de $58.000 son un 69% adicional; el bump no
convierte por precio y no por diseño»—: no era un problema de diseño y no había
que rediseñarlo otra vez.

Se retiró de los seis sitios donde vivía: la sección `#empaque-destacado` de la
portada (borrada entera, con su CSS), la casilla del carrito, el order bump del
paso de pago, el renglón del resumen, el cálculo de las tres calculadoras y la
respuesta de la FAQ. `reglas.empaque` ya no existe en `catalogo.json` y el
extractor dejó de buscarlo.

**Lo que se queda:** el empaque de regalo normal, que siempre fue gratis y sigue
yendo en todos los pedidos. Y la **dedicatoria escrita a mano**, que estaba
atada al Premium y ahora se ofrece a todo el mundo sin cobrar: no cuesta
inventario ni logística —la tarjeta ya va en la caja— y es el dato que dice qué
pedido es un regalo, que le sirve al bot de WhatsApp.

#### La trampa del retiro, que es la parte que importa

Quitar la interfaz no basta. `empaque:true` sobrevive en tres sitios que nadie
controla desde el repo:

1. El **localStorage** de cualquier clienta que lo marcó — el carrito se guarda
   una semana.
2. Los **enlaces de recuperación ya enviados**, que llevan `&e=1`.
3. Los **pedidos pendientes** guardados con su línea de empaque, que
   `reanudar.mjs` reconstruye.

Sin interfaz que lo muestre ni casilla que lo quite, heredarlo sería **cobrar
$40.000 que la clienta no puede ver en ninguna línea ni quitar de ninguna
forma**. Así que no se borró el campo: se **fuerza a `false` en cada puerta de
entrada** —las dos lecturas del checkout, la de `index.html`, `reanudar.mjs` y,
la última y la que de verdad manda, `leerPedido()` en `_precios.js`—. Un cuerpo
manipulado que mande `empaque:true` al servidor cobra exactamente lo mismo:
comprobado.

`pruebas/checkout.js § 2bb` existe para eso y no se borra: compara el total de
un carrito guardado con `empaque:true` contra el mismo carrito sin él, y hace lo
propio con un enlace `&e=1`.

**Regla general, que vale para el próximo retiro:** quitar algo que se cobraba
no es borrar su interfaz, es **cerrar todas las puertas por las que ese dato
todavía puede llegar**. El dato viejo vive en navegadores y correos que ya
salieron, y ahí no llega ningún despliegue.

### Tanda nueva de videos

Los tres `.mov` del propietario reemplazan a los tres de la tanda del 12 de
septiembre, con la misma receta de arriba (720px, CRF 30, `-an`, faststart):
**47,6 MB → 4,5 MB**, 13,5 s · 11,6 s · 9,3 s.

1. Clienta abre su regalo y luce el brazalete con charms de corazón, mariposa y
   piedra azul.
2. Charm de cristal azul recién sacado de la caja, montado en la pulsera.
3. Brazalete Zephora con charms de Marvel en muñeca masculina.

**Esto cierra el vencimiento del 19 de septiembre**: el video con la fecha
quemada ya no está en el sitio.

**El video 1 vuelve a abrir con una caja de Pandora**, igual que el anterior, y
**el propietario decidió otra vez publicarlo completo (2026-09-13)**. No lo
"arregles" por tu cuenta. Lo que sí se cambió, y es decisión de esta sesión: la
**portada** ya no es el logo de Pandora a pantalla completa sino el brazalete
Zephora en la muñeca —la portada es el fotograma que se ve sin que nadie le dé
play, así que era la superficie más expuesta de todas—. Las portadas 1 y 3 se
sacan del segundo 9,4 y del 6,5 respectivamente, no del segundo 1 de la receta:
en esos videos el producto no aparece hasta después.

**Los textos de Instagram de esta tanda no se han escrito.**

## Videos de clientas — publicado el 2026-09-12

**Está en el aire.** Despliegue `6aa5dafe092f3b00082bd52f`, commit `1ac3445`.
Verificado contra el sitio vivo: los tres `.mp4` y sus portadas responden 200
con el tipo correcto, los dos `fbq('init')` siguen ahí, y checkout y la página
de gracias responden 200. Llena el hueco que había quedado reservado en
«Guardamos momentos».

**Qué trae:** carrusel de tres videos verticales de clientas en `#historia`,
más el reemplazo de la foto del banner de marca (la anterior tenía errores de
producto) y del video del novio (versión con cierre de logo).

### Cómo se preparan los videos — receta, no improvisación

Los originales del celular pesaban 16–22 MB cada uno (1080×1920, más de 1 MB
por segundo). **No se suben así.** FFmpeg no está instalado en el sistema; se
usa aislado sin tocar Windows:

```bash
npm install ffmpeg-static      # dentro de una carpeta temporal, no del repo
node -e "console.log(require('ffmpeg-static'))"   # da la ruta al binario
```

Y por cada video:

```bash
ffmpeg -i ORIGEN.mov -vf scale=720:-2 -c:v libx264 -preset slow -crf 30 \
  -profile:v main -pix_fmt yuv420p -movflags +faststart -an assets/NOMBRE.mp4
ffmpeg -ss 1 -i ORIGEN.mov -frames:v 1 -vf scale=720:-2 assets/NOMBRE-portada.webp
```

`-an` quita la pista de audio: los videos llevan solo música de fondo y se
reproducen silenciados, así que el audio era peso muerto. Resultado: **57,7 MB
→ 5,4 MB los tres**, con portadas de 185 KB en total.

**Por qué no hay `autoplay` en el HTML.** Aun comprimidos, los videos pesan
dieciocho veces el resto de la página. Con `preload="none"` solo viaja la
portada; un `IntersectionObserver` los arranca cuando la sección entra en
pantalla y los pausa al salir. Quien nunca baje hasta ahí no gasta un byte en
video. **Si alguien agrega `autoplay` al `<video>`, deshace esto sin que se
note**, porque en escritorio con buena conexión se ve igual.

`muted` y `playsinline` tampoco son estilo: los navegadores de celular solo
reproducen solos los videos silenciados, y sin `playsinline` iOS abre el video
a pantalla completa.

### Dos decisiones del propietario, tomadas con la información delante

1. **El primer video muestra una caja de Pandora**, abierta en el segundo 3 con
   un brazalete de Zephora dentro, mientras el texto dice «sorpréndela con un
   brazalete de Zephora Charms». Se advirtió el riesgo de marca —es más visible
   que las fotos que `TRIAJE-FOTOS.md` obligó a recomponer— y **el propietario
   decidió publicarlo completo el 2026-09-12**. No es un descuido: no lo
   "arregles" por tu cuenta. Si se quiere revertir, la versión limpia se saca
   cortando los primeros 4,8 segundos:
   `ffmpeg -ss 4.8 -i ORIGEN.mov ...` (mismos parámetros de arriba) → 10,8 s.
2. **Ese mismo video lleva quemado «Éste 19 de Septiembre».** Caduca. Después
   del 19 hay que sacarlo o reemplazarlo, o la página de inicio queda anunciando
   una fecha pasada.

### Pendiente

- ~~**Antes del 19 de septiembre:** sacar o reemplazar el primer video, por la
  fecha quemada.~~ **Resuelto el 2026-09-13**: la tanda nueva reemplaza los tres
  videos y ninguno lleva fecha quemada.
- Los textos de Instagram para estos tres videos se redactaron en sesión y
  **no están en el repo**. Los tres son **pilar 1** del
  `CALENDARIO-EDITORIAL.md` —POV, alcance, cierre en perfil— así que van sin
  escalera de precios y con comentario disparador. No publicarlos seguidos:
  la doctrina prohíbe rachas de un solo pilar en las dos direcciones.

## Segunda tanda de la landing — publicado el 2026-09-11

Despliegue `6aa47c76f24f7a000822ee58`, commit `3459846`. Verificado contra el
sitio vivo: los dos `fbq('init')` intactos, y checkout, `stock.json` y la
página de gracias responden 200.

- **Se corrigió un desborde horizontal en celular** que hacía que la página se
  deslizara a la derecha hacia un vacío blanco. **La causa fue un arreglo mal
  colocado:** el `min-width:0` de `.plata-in` había quedado dentro de
  `@media(min-width:700px)`, así que solo aplicaba en escritorio. En celular la
  rejilla seguía dimensionándose al ancho mínimo del carrusel (~814px). Ahora
  está en la regla base. **Lección: los arreglos de este tipo van en la regla
  base salvo que haya una razón para lo contrario** — el bug de rejilla existe
  en todos los anchos, no solo donde se vio primero.
- **La calculadora de talla es desplegable.** Buena parte de las clientas ya
  sabe su talla. El menú y dos enlaces más apuntan a `#talla`, así que un
  script corto la abre al llegar por ahí: caer en una calculadora cerrada
  después de pedir «Tallas» sería peor que no tener el enlace.
- **La franja que decía «Armar mi pulsera» ahora ofrece el agente con IA por
  WhatsApp**, y el botón flotante quedó solo con el ícono. Quitar ese botón no
  dejó huérfano el catálogo: hay otros 20 enlaces a brazaletes y charms.

**El cambio con más consecuencia no se ve:** los clics a WhatsApp ya no cuentan
todos como `InitiateCheckout`. El evento se declara por enlace con
`data-wa-evento`: el banner del agente y el botón flotante mandan `Contact`,
y sin ese atributo se conserva `InitiateCheckout` para los enlaces de compra
real —carrito y encargos—. **Por qué importa:** `InitiateCheckout` es el evento
con el que optimiza la pauta. Contar consultas ahí le enseña a Meta a buscar
gente que pregunta en vez de gente que compra, y con WhatsApp en el lugar del
botón principal eso habría pasado con casi todos los clics de la página.
**Al agregar un enlace nuevo a `wa.me`, decidir cuál de los dos eventos le
corresponde.**

## Poda de la landing — publicado el 2026-09-11

**Está en el aire.** Despliegue `6aa427aa9dde3c0009facc35`, commit `975ee38`,
publicado 16:09 UTC. Verificado contra el sitio vivo, no solo contra el panel:
los dos `fbq('init')` siguen ahí, el checkout responde 200 y `stock.json`
carga. Solo cambió `index.html`.

El origen fue una crítica de un competidor de joyería fina (Juli & Co) y,
después, la conducta real de compra. Lo que se hizo, y el porqué, para que
nadie lo deshaga sin saber:

- **El banner del hero solo lleva prueba social encima de la foto.** El botón
  y la línea de medios de pago bajaron a una franja propia después de los
  beneficios: encima de la imagen obligaban a un degradado que se comía media
  foto en celular, que es por donde más se compra.
- **Fuera «Cómo funciona».** No por estética: la clienta no sigue el paso a
  paso, compra el charm suelto o el brazalete suelto. En su lugar subió el
  descuento progresivo, que explica el precio justo antes de los catálogos.
- **Fuera la tarjeta «Promo de la semana».** Repetía lo que la escalera ya
  dice —el nivel 3 anuncia el −30% del brazalete— y el envío gratis ya vive en
  el ticker superior.
- **Brazaletes en carrusel.** Eran 18 modelos en tres parrillas apiladas y es
  la categoría que menos se vende. Los filtros siguen funcionando: esconden
  tarjetas y el carrusel deja de darles columna.
- **El catálogo completo de charms arranca cerrado.** Son 86 piezas.
- **En Plata 925, un carrusel con las cinco piezas que tienen segunda vista**
  (las declaradas en `FOTOS`). Se cruza a la segunda foto al pasar el cursor.
  **Si se quiere ampliar, el cuello de botella es fotográfico, no de código:**
  solo esas cinco tienen segunda toma.

**Tres trampas que costaron una ronda cada una y no hay que redescubrir:**

1. **Un hijo de rejilla no baja de su ancho mínimo de contenido.** El carrusel
   de Plata 925 aplastó la columna de texto hasta partir el título palabra por
   palabra, en escritorio. Se arregla con `min-width:0` en los hijos de
   `.plata-in`. Apareció en una captura del propietario, no en las
   comprobaciones estructurales — que no ven nada renderizado.
2. **El `.rail` sangra 16px a cada lado** para llegar al borde de la pantalla
   en celular. Dentro de una columna de escritorio eso se sale del contenedor;
   ahí hay que cancelarlo.
3. **Las flechas del carrusel estaban atadas por `id`** a una sola instancia.
   Ahora recorren cada `.rail-wrap`. Al agregar un carrusel nuevo, no hacen
   falta ids.

**Dos cosas pendientes, a propósito:**

- ~~El hueco donde iba la foto de «Guardamos momentos» está reservado para un
  **carrusel de video UGC**~~ — **hecho el 2026-09-12**, ver el bloque de
  trabajo en curso al principio de este documento.
- **El botón flotante de WhatsApp lleva `data-wa="flotante"`** por una razón
  concreta: el listener cuenta *todo* clic a `wa.me` como `InitiateCheckout`,
  que es el evento con el que optimiza la pauta. Un botón siempre visible se
  toca de forma casual. Si la señal se ensucia, la etiqueta permite separarlo
  en Meta o excluirlo del tracking con una línea. Nota aparte: el repo ya
  documentaba que WhatsApp salió del hero porque traía preguntas que la página
  responde y no terminaban en pedido — se repone por decisión del propietario,
  sabiendo eso.

## Mercancía nueva y rediseño del hero — cerrado el 2026-09-11

Las dos sesiones que trabajaban en paralelo cerraron y todo está en `main`.
El reclamo que vivía aquí se borra; queda el resultado y la regla que salió de
la jornada, más abajo.

**Lo que entró:**

- **29 unidades de letra.** Doce iniciales que nunca se habían comprado pasan de
  cero a dos —F G H I P R T U W X Y Z— y C, J, M y N suben a tres. **Ñ y Q son
  las únicas que siguen en cero**: no entraron en el pedido.
- **La pulsera Avengers vuelve** con 8 unidades en cada talla (18, 19, 20). Es
  además la base que le faltaba al set de Marvel: la otra clásica solo existe en
  20 y 21.
- **22 charms de reposición** y **seis referencias nuevas** —Groot Bebé, Casco
  Iron Man, Máscara Un Gran Poder, Esfera Telaraña Spider-Man, Spider-Man Pavé y
  Máscara Spider-Man Roja—, todas a $85.000, con foto.
- **El rediseño del hero** de la otra sesión, con su carrusel panorámico y la
  regla `ignore` de `netlify.toml` que se salta el despliegue cuando el push solo
  cambia documentación.

**Tres cosas que se aprendieron y no hay que volver a descubrir:**

1. **`generado` de `stock.json` no es una fecha, es un interruptor.** Cambiarlo
   pone a cero el contador de lo vendido de *todo* el catálogo, porque
   `_inventario.mjs` asume que un `generado` nuevo es un recuento físico que ya
   descuenta lo vendido. Para **sumar** mercancía no se toca. Solo se cambia
   cuando de verdad se recuenta todo.
2. **La rejilla del catálogo está escrita a mano.** Son 82 `<article class="pc">`
   en `index.html`; `DATA` solo lleva los precios. Una pieza añadida solo a `DATA`
   tiene precio y **no existe para la clienta**. Cada alta son tres sitios: `DATA`,
   la tarjeta y `stock.json` — y después `extraer_catalogo.py`, o el servidor cobra
   sin ella.
3. **Una foto de hero pesa lo que se le deje pesar.** El carrusel llegó con 922 KB
   a 2752 px de ancho, con `fetchpriority="high"`, para pintarse a 390 px en el
   móvil por donde entra casi toda la venta. A 1600 px y calidad 84 son 295 KB sin
   diferencia visible en escritorio.

**Pendiente inmediato:** el despliegue está construido y **esperando tras el
candado** (`Unlock deploys` en el panel). Cuando se suelte, publica de una vez
esto, el rediseño del hero y los dos commits de septiembre que Netlify saltó por
falta de créditos. Justo después hay que mirar la lista de despliegues: si un
commit que tocó `.html`, `netlify.toml` o `netlify/functions/` sale como
**saltado**, la regla `ignore` está mal.
### El deploy no lo hace una sesión — lo hace `main`

Esta confusión ya costó créditos, así que queda escrita. **Netlify no sabe qué
sesión, terminal o computador empujó.** Está conectado al repositorio y publica
cuando algo llega a `main`. No existe «desplegar desde este chat»: existe
«llegó algo a `main`».

De ahí sale la única regla que controla el gasto:

> **Empujar a una rama `claude/*` cuesta cero. Solo llegar a `main` publica, y
> cada publicación son ~15 créditos.**

Con eso, dos sesiones en paralelo no cuestan más que una. Pueden trabajar y
empujar cuanto quieran a sus ramas; lo que se junta es **la mezcla**, que se
hace una sola vez, cuando todas las ramas vivas están listas, y sale en un
único deploy. Lo caro nunca fue trabajar en paralelo: fue mezclar de a poco.

**Repartir por archivo, no por tema.** Dos tareas que suenan distintas acaban
en el mismo archivo —ver la sección de reparto entre sesiones, más abajo—. El
reparto de esta jornada salió de mirar *dónde vive cada cosa*: el inventario
está en `assets/stock.json` y el catálogo en `const DATA=` dentro de
`index.html`, así que reponer unidades y rehacer la página no se pisan aunque
ambas suenen a «tocar la tienda».

**Antes de cerrar una rama, actualizarla contra `main`.** `git fetch --all` y
`git merge origin/main` **dentro de la rama propia**, nunca al revés. Una rama
que salió de un punto viejo arrastra versiones anteriores de `ESTADO.md`,
`CLAUDE.md` y del `<head>` con el doble píxel; mezclarla sin actualizar revierte
trabajo **sin dar ningún conflicto ni error**. Es el fallo que este repo ya pagó
tres veces.

**Y el candado del panel: puesto el 2026-09-11.** Hasta esa fecha no había
ninguno —`Auto publishing is on`— y con los créditos recién recargados eso
significaba que cualquier push a `main` salía al aire sin preguntar.
El botón está en la misma página de Deploys: **`Lock to stop auto publishing`**
cuando no lo está, y **`Unlock deploys`** cuando sí. Ese texto es la forma rápida
de saber en qué estado se está —y la única, porque **el conector de Netlify no
expone este dato**: devuelve el despliegue vivo y las URL, no el auto-publish.
Una sesión no puede comprobarlo por su cuenta; hay que mirar el panel.

Con el candado, un push a `main` **sí construye** pero no publica: el despliegue
queda listo y se suelta con un clic. Es lo que conviene mientras haya varias
sesiones abiertas —protege del push accidental sin dejar `main` y producción
separados en silencio—. Quitar el candado publica lo último que haya quedado
esperando, así que se quita cuando se ha decidido publicar, no antes.
## 🚧 Trabajo en curso — rediseño landing inspirado en crítica de competidor · 2026-09-10

**Reclamación de trabajo, según la regla 4 de `CLAUDE.md` § *Cómo se reparte el
trabajo entre sesiones*.** Se borra cuando esta rama se mezcle.

**Rama:** `claude/zephora-empaque-hero`
**Alcance:** solo `index.html` — dos secciones nuevas entre `#historia` y
`#reseñas`, en este orden:
1. `#plata-925` — desarrolla el bullet de "Plata Esterlina 925 verificada"
   (que se queda igual en la barra de beneficios) en una sección de
   autoridad técnica. Habla solo de **charms** (plata esterlina sólida),
   nunca de brazaletes (que son latón con baño de plata — línea ~1032 de
   `index.html`, no confundir los dos). No compara con Pandora ni nombra
   réplicas — ver `automatizaciones/contenido/TRIAJE-FOTOS.md` línea 211,
   "Compatible con charms Pandora" sigue sin resolver, no se tocó aquí.
2. `#empaque-destacado` — sube el bloque de Empaque Premium (antes solo un
   checkbox de 46px dentro del carrito) a un bloque visual a mitad de página.
3. `#promo` (descuento progresivo) — **se movió**, no se creó: antes iba
   justo después de `#beneficios` (la segunda cosa que se veía en toda la
   página); ahora va después de `#empaque-destacado`, tras las secciones de
   confianza. El mecanismo de descuento no cambió, solo la posición.
4. `.bens` (barra de beneficios) — de 6 bullets a 4. Se quitaron
   "Compatibles con charms Pandora" (duplicado del hero) y "Envío a toda
   Colombia" (duplicado del ticker superior `.ann`) — la info sigue en el
   sitio, solo dejó de repetirse. Grid de desktop ajustado de 3 a 4 columnas
   para que no quede una fila coja.
5. `#hero` (antes dos columnas) — ahora banner panorámico de ancho completo
   con 2 fotos (Avengers + marca) rotando cada 5s, mismo mecanismo 100% CSS
   que `.ann`, con botón de pausa. Spec y plan en
   `docs/superpowers/specs/2026-09-10-hero-carousel-design.md` y
   `docs/superpowers/plans/2026-09-10-hero-carousel.md`. El asset viejo
   (`pulsera-zephora-armada-con-charms-en-plata-925.webp`, vertical 502×900)
   ya no se usa en el hero, pero **sigue en uso en `#plata-925`** — no
   borrarlo.

No toca `netlify/functions/`, checkout, ni el checkbox real del carrito
(`#pack`), que sigue siendo el mecanismo de compra.

**Las 4 ideas de la crítica de Juli & Co ya están implementadas** en esta
rama (empaque, autoridad Plata 925, densidad, y ahora el hero). Falta
revisión visual del usuario antes de considerar la fusión a `main`.

**⚠️ Esta sesión NO fusiona a `main`.** Los créditos de Netlify se recargaron
el 2026-09-11 y el auto-publish sigue encendido — cualquier push a `main`
ahora sí publica solo. Hay otra sesión trabajando en paralelo en
`claude/charming-sagan-l4q2eq` (mercancía nueva: `assets/stock.json`,
`assets/*.webp`, `herramientas/entrada/`); el reparto es por archivo, no por
tema, y la mezcla a `main` la hace esa sesión, en un solo paso, cuando ambas
ramas estén listas. Esta rama queda commiteada, empujada y actualizada contra
`main` (`git merge origin/main`, sin conflictos), lista para esa mezcla —
pero sin empujar más desde aquí.

## 🚧 Trabajo en curso — contenido orgánico · 2026-09-07

**Reclamación de trabajo, según la regla 4 de `CLAUDE.md` § *Cómo se reparte el
trabajo entre sesiones*.** Se borra cuando esta rama se mezcle.

**Rama:** `claude/zephora-charm-content-strategy-ktc7fi`
**Alcance:** solo documentación de contenido y `netlify.toml`. **No toca
`netlify/functions/`, ni el checkout, ni `index.html`.**

Qué trae:

| Archivo | Qué es |
|---|---|
| `automatizaciones/contenido/CALENDARIO-EDITORIAL.md` | Doctrina editorial: frecuencia por red, cuatro pilares, calendario quincenal de Amor y Amistad y ocho guiones listos para grabar. Precios del guion 5/6 corregidos y verificables |
| `automatizaciones/contenido/BRIEF-FLOW.md` | Encargo para la sesión de Flow: presupuesto de créditos, triaje de «pauta meta 2026», las tres formas de hacer video, y la frontera de qué no puede generar |
| `automatizaciones/contenido/TRIAJE-FOTOS.md` | Censo de las 35 fotos de la carpeta, con el hallazgo de riesgo de marca Pandora |
| `automatizaciones/contenido/COSTOS-FLOW.md` | Registro real de créditos gastados en Flow, generación por generación |
| `automatizaciones/contenido/ANALISIS-PLAN-GEMINI.md` | Contraste de un plan externo de contenido contra los datos reales del repo |
| `automatizaciones/contenido/verificar-precios-guiones.js` | Corre cada precio de los guiones contra `calcular()`; falla nombrando el que se descuadre |
| `CLAUDE.md` | Tres hallazgos enlazados desde la sección de contenido |
| `netlify.toml` | Regla `ignore` para no desplegar cuando el push solo cambia `.md` |

### La sesión de estrategia se cierra — el trabajo sigue desde la terminal

**2026-09-08.** La sesión de estrategia (en la nube, Opus) **termina aquí**. Todo
lo que decidió está escrito en esta rama; **nada quedó solo en un chat**. No hay
que reabrirla: cuesta más que la sesión local y no sabe nada que no esté en
estos archivos.

Lo demostró el propio flujo: la sesión de Flow leyó estos documentos, hizo el
triaje **y encontró un error de precios en el calendario**, sin que las dos
sesiones se hablaran ni una vez. **El repo ya es el canal; funciona.**

**Desde ahora, una sola sesión lleva contenido** —la de la terminal—, que es
además lo que pide la regla 1 de `CLAUDE.md`. Arranca así:

```bash
git fetch --all
git checkout claude/zephora-charm-content-strategy-ktc7fi
```

Y lee, en este orden: este bloque · `automatizaciones/contenido/BRIEF.md` ·
`CALENDARIO-EDITORIAL.md` · `BRIEF-FLOW.md` · `TRIAJE-FOTOS.md`.

**Lo siguiente que hay que hacer, por orden y sin gastar un crédito:**

1. ~~**Borrar el creativo «No es Pandora… pero todos creen que sí»**~~ — **hecho
   2026-09-08.** Movido (no borrado, por si hace falta de referencia) a
   `pauta meta 2026/NO USAR - riesgo de marca/`, fuera de la carpeta de
   trabajo. No vuelve a aparecer en ningún triaje futuro de esa carpeta.
2. ~~Recomponer el fondo del set `0bd627e3`~~ — **hecho, pero por un método
   distinto al planeado.** El recorte-y-pegado (`rembg` + `componer_fondo.py`,
   descrito en versiones anteriores de este punto) quedó **superado**: se veía
   antinatural, sin interacción real de luz entre la joya y el fondo. El
   propietario corrigió el alcance de la regla de oro — no es que la foto no
   se pueda tocar, es que **la forma y el diseño de la joya deben quedar
   idénticos**, la foto sí puede regenerarse.

   > **Método vigente desde 2026-09-08: imagen de referencia en Flow.** Se sube
   > la foto real de la pieza (ej. `662562d4-...jfif`) como referencia y se le
   > pide a Flow una fotografía profesional nueva, con instrucción explícita de
   > mantener diseño/forma/conteo de piedras idénticos. Resultado: fotos con
   > luz y sombra reales, publicables tal cual. Dos sets ya terminados y
   > aceptados por el propietario:
   > - **Set "fe y suerte"** (manos orando + virgen María + trébol + herradura
   >   / Corazón Liso) — 3 formatos en `pauta meta 2026/recompuestos/`.
   > - **Set "letra-a"** (esfera azul + flor azul + atrapasueños + letra-a /
   >   Corona Pavé) — resolución completa en `pauta meta 2026/fondos/`.
   >
   > Prompts usados y plantilla completa: ver el chat de la sesión de Flow o
   > pedir que se reconstruyan — misma estructura para cualquier set nuevo:
   > *"usa esta imagen de referencia... mantén diseño/forma/piedras idénticos
   > ... cambia el entorno a [fondo de marca]... NO incluir texto/logotipos/
   > otra marca."*
   >
   > **Pendiente con este método:** set "hamsa + gatito" (prompt ya escrito,
   > más delicado — pide excluir 2 de los 4 dijes de la referencia, revisar
   > con cuidado) y las 4-5 planchas de portada, una por pilar de contenido.
   >
   > Dos fotos que parecían necesitar trabajo y no: `762070262` (manos orando
   > sola) y `762650437` (bases de pulsera) ya estaban terminadas, sin Pandora.

2b. **Nuevo, no estaba en el plan original: video con joya en Flow —
   funciona, pero solo con un modelo específico.** El propietario probó subir
   la foto de referencia también en modo video ("Ingredientes"):

   | Modelo | Resultado con la pulsera de referencia |
   |---|---|
   | **Veo 3.1 Fast** | **Sostiene el diseño intacto.** Probado dos veces (acercamiento + cenital, 8s fijos, ~18-20 créditos c/u). Es el **único** autorizado para clips con joya |
   | Omni 1.1 Flash | **La desfiguró visiblemente.** Descartado para cualquier plano con producto — sigue sirviendo para b-roll sin joya, y es el único que permite bajar a 4s |

   Con esto quedan **tres formas de hacer video** fijadas en `BRIEF-FLOW.md`
   § *Las tres formas de hacer video*: (1) imagen en Flow, gratis; (2) video
   en Flow con Veo 3.1 Fast + referencia, con joya, ~20 créditos/clip; (3)
   grabación real del propietario, para TikTok. Detalle y créditos gastados
   (saldo verificado: 206 de 250) en `COSTOS-FLOW.md`.

   **Ya hecho con este método:** el plano de establecimiento de Amor y
   Amistad (prioridad 1 de `BRIEF-FLOW.md` § Tarea 2b), dos cortes, **con la
   pulsera incluida** — mejor de lo planeado originalmente (iba a ser solo
   ambiente vacío).

   **Siguiente pendiente, prompt ya escrito y listo para pegar:** el
   creativo de pauta con movimiento (prioridad 2 de Tarea 2b) — la pulsera
   girando sobre sí misma, estilo publicitario. Falta que el propietario lo
   genere en Flow (Ingredientes, Veo 3.1 Fast, 8s) y lo revise.
3. **Sesión de fotos de las nueve letras**, dos tomas cada una: catálogo sobre
   blanco (recortable) y estilo de vida. Desbloquea toda la rama de imagen.

   > **Resuelto 2026-09-08.** El propietario confirmó que la `letra-a` de
   > `662562d4` (y sus tres composiciones) **sigue siendo stock vigente**, no
   > un lote anterior. No cambia el plan: esa foto no sirve como catálogo
   > (ángulo, sobre la caja Pandora, parcialmente ocluida), así que **las
   > nueve letras siguen necesitando su sesión de fotos igual**. Lo único que
   > cambia es que ya hay una foto de contexto usable de `letra-a` mientras
   > tanto — no de catálogo, pero sí de «se ve así».
4. **Grabar los guiones 1 a 4**, y el 5 con los precios ya corregidos.
5. **Guion 8, la historia de sondeo de las 14 letras**, el viernes 19.

**Fechas que no se mueven:** Amor y Amistad es el **sábado 19 de septiembre**, y
las fechas límite de pedido son **10 sept** (resto del país), **14** (ciudades
principales) y **16** (Bogotá).

---

### Hay tres sesiones en contenido, y no pueden hablarse

Comprobado el 2026-09-08: **las sesiones no se alcanzan entre sí.** La de
estrategia corre en la nube y las otras en la máquina del propietario; el canal
entre sesiones no las conecta. Se intentó y falló. **El único canal compartido
es el repo**, que es justo lo que dice la regla 4 de `CLAUDE.md`.

| Sesión | Rama | Qué hace |
|---|---|---|
| Estrategia de contenido | `claude/zephora-charm-content-strategy-ktc7fi` | Doctrina editorial, guiones, encargo de Flow |
| Google Flow | trabaja sobre la rama de arriba | Triaje de «pauta meta 2026» e imagen |
| Automatización de contenido | `claude/social-content-automation-n1rh2j` | `ANALISIS-PLAN-GEMINI.md` + 8 líneas a `BRIEF.md` |

Las dos ramas **no chocan** —archivos distintos, merge limpio— y sus
conclusiones coinciden: la tercera sesión recontó el inventario por su cuenta y
le dio **25/58/46**, los mismos números que `CALENDARIO-EDITORIAL.md`. Eso
confirma que el **24/59/46 del `BRIEF.md` § 1.1 está desactualizado** y hay que
corregirlo al reconciliar.

Pero que no choquen es lo peligroso, no lo tranquilizador: es literalmente el
patrón que `CLAUDE.md` describe —«git no ve nada raro ahí»—. **Antes de escribir
en `automatizaciones/contenido/`, leer las dos ramas.**

### Resuelto el 2026-09-11 — esta rama sí se mezcla

Aquí decía que la rama no se mezclaba porque la cuenta no tenía créditos de
Netlify y cualquier push a `main` intentaba desplegar. **Las dos mitades de esa
frase cambiaron el 2026-09-11:** los créditos se recargaron, y el auto-publish
quedó bloqueado en el panel (`Lock to stop auto publishing`), así que un push a
`main` construye y **espera** en vez de publicar.

El plan que dejó escrito se cumplió tal cual: **se mezcla todo de una vez y sale
un único despliegue** —esta rama, la de la mercancía nueva y los dos commits de
septiembre que Netlify saltó por falta de créditos—. Ese despliegue sí se
construye (`netlify.toml` no es `.md`) y es justo el que instala la regla
`ignore`; desde ahí, los pushes de solo documentación se saltan solos.

**Queda una comprobación para después de publicar**, que es la delación que la
propia regla pide: si un commit que tocó `.html`, `netlify.toml` o
`netlify/functions/` aparece como **saltado** en la lista de despliegues, la
regla `ignore` está mal y hay que revisarla.

La sincronización entre sesiones de contenido sigue siendo sobre la rama
compartida, no sobre `main`, por lo que explica el párrafo de arriba.
---
## ⚠️ Consolidación de ramas — 2026-08-20

**El tronco es `main`.** Se creó consolidando las nueve ramas `claude/*` que
tenía el repo, ninguna de las cuales era un tronco: la que publicaba Netlify se
llamaba `claude/install-frontend-design-skill-8t655e`, por el nombre de la tarea
que la abrió.

No era cosmético. Sin tronco, tres sesiones construyeron en paralelo **lo mismo
dos veces**: el `Purchase` server-side, el rescate de carritos y el registro de
pedidos. Cada duplicado costó una reconciliación y en un caso estuvo a punto de
hacer que Meta contara el doble de compras.

`main` contiene todo lo de las ocho ramas fusionables. Queda fuera
`claude/sephora-whatsapp-response-system-682wvv` — ver abajo.

### Los paneles ya están cambiados — 2026-08-22

1. **GitHub → default branch → `main`. Hecho**: `git ls-remote --symref origin
   HEAD` devuelve `refs/heads/main`.
2. **Netlify → Branch to deploy → `main`. Hecho**: el despliegue de producción
   `6a88fa3a` (2026-08-22 01:24 UTC) sale de `main`, commit `c05b86c`, y es el
   que sirve `zephoracharms.com`.
3. Falta borrar las ramas `claude/*` ya fusionadas.

> **Y esto invierte la regla anterior: empujar a
> `claude/install-frontend-design-skill-8t655e` ya no publica nada.** Es lo
> primero que hay que saber al retomar, porque el documento decía lo contrario
> y una sesión dio por desplegado (`f903e06`) un trabajo que se quedó en esa
> rama sin llegar al aire. **Lo que sale a producción es lo que se empuja a
> `main`.** Antes de anunciar un despliegue, comprobarlo: el conector de
> Netlify da la rama y el commit del despliegue vivo, y desde una terminal con
> red vale `curl -s https://zephoracharms.com/checkout.html | grep …` buscando
> algo que solo exista en el cambio.

### La rama que no se fusionó

`claude/sephora-whatsapp-response-system-682wvv` tiene otro árbol de archivos
(`data/`, `docs/`, `scripts/`) y un `index.html` anterior al checkout: fusionarla
retrocedería la tienda. Lo que vale de ahí ya se rescató —el prompt del asesor,
en `automatizaciones/prompts/asesor-whatsapp.md`—. Lo que queda por minar son
las **28 macros de WhatsApp** en `docs/whatsapp/macros-para-copiar.md`, útiles
pero con cifras falsas hoy (Addi como medio de pago, precios viejos, envío
gratis mal aplicado). **No copiar de ahí sin contrastar contra `_precios.js`.**
Se deja como archivo histórico, no se borra.

> **Este repo se trabaja desde varias sesiones a la vez y ya ha habido pushes
> rechazados por historial divergente.** Antes de empujar, `git fetch` y mirar
> qué llegó: en una sola jornada entraron por otra sesión un `CLAUDE.md` y el
> doble píxel de Meta. Mezclar en vez de forzar.
>
> **Y mirar antes de mezclar, no solo antes de empujar** — ver
> *[Ramas abiertas de otras sesiones](#ramas-abiertas-de-otras-sesiones)*, más
> abajo. Hoy hay tres sin mezclar, y una trae una **segunda implementación
> completa del rescate de carritos** que ya está en producción por otro camino.

Para ver qué se hizo y por qué, `git log`: los mensajes de commit explican el
razonamiento, no solo el cambio.

---

## Ramas abiertas de otras sesiones

Al cierre de esta sesión, `main` —la rama que publica— está al día y todo lo
que describe este documento vive ahí. **Pero hay tres ramas de otras sesiones sin
mezclar**, y no son "unos commits pendientes": dos de ellas salieron de un punto
anterior al trabajo de esta jornada y **reconstruyeron por su cuenta piezas que
ya existen**. Mezclarlas a ciegas no da un conflicto de git — da dos sistemas
haciendo lo mismo, que es la clase de fallo mudo del que trata la sección de
abajo.

| Rama | Qué trae | Con qué choca |
|---|---|---|
| `claude/zephora-charms-automation-hub-5aihdu` | `recuperar-carritos.mjs` + `_pendientes.mjs`, `disponibilidad.mjs`, `_atribucion.mjs`, contratos y prompts en `automatizaciones/` | **Lo grave.** Salió de `e889bd7`, antes del registro de pedidos y del rescate. `_pendientes.mjs` es otro registro de pedidos —no tiene `_pedidos.mjs`— y `recuperar-carritos.mjs` es **otro rescate de abandonados**. En producción ya corre `rescate.mjs`. Mezclado tal cual, la tienda tendría dos cosas persiguiendo el mismo pedido y **dos correos por clienta** |
| `claude/revision-pantalla-pauta-cmv7uz` | En `index.html`: `eventID` propio en cada evento de navegador, `content_ids` en `ViewContent`, y evita que tocar "Pedir" dos veces cuente dos `Lead` | Salió de antes del **doble píxel**: su bloque `<head>` tiene un solo `fbq('init', …)`. Mezclarlo sin cuidado **borra el píxel nuevo** y con él el `Purchase` de servidor. El contenido vale —el `Lead` repetido es un problema real—; lo que hay que rehacer a mano es el bloque del `<head>` |
| `claude/sephora-whatsapp-response-system-682wvv` | Macros y system prompt para atender WhatsApp con otra IA, `docs/whatsapp/`, `scripts/` | Añade `data/stock.json` (el bueno está en la raíz) y su propio `package.json` + `package-lock.json` en la raíz, donde ya hay uno que existe por una razón concreta —ver la tabla de decisiones—. El grueso es documentación y no toca la tienda |

**El orden que menos duele:** primero la de WhatsApp (casi no toca código),
después la del píxel (un archivo, rehaciendo el `<head>` a mano), y la de
automatizaciones **la última y decidiendo pieza por pieza qué se queda** — no
merge directo. De esa rama lo que no está duplicado es `disponibilidad.mjs` y
`_atribucion.mjs`; el rescate y el registro de pedidos ya están resueltos aquí.

> **`disponibilidad.mjs` ya se trajo** (2026-08-21, rama
> `claude/zephora-charms-automation-rzbthc`): la función, el `disponibles()` de
> `_inventario.mjs` y `pruebas/disponibilidad.js`, con `git checkout` de esos
> tres archivos y nada más. Salió gratis porque `_precios.js` es idéntico en las
> dos ramas y `_inventario.mjs` allí es este mismo más 33 líneas — se comprobó
> con `git diff` antes de tocar nada. **No hay que volver a traerlo**, y lo que
> queda de esa rama sigue siendo `_atribucion.mjs` y nada más.

---

## Lo primero: el bloqueo de despliegues, y qué lo causó

Durante un tiempo producción estuvo congelada en el commit `cdd8865`, con seis
commits probados que nadie había visto. **El diagnóstico inicial era erróneo y
conviene dejar escrito el bueno**, porque el error se repite fácil.

No eran «minutos de build». Netlify cobra por **créditos**, y un despliegue de
producción cuesta **~15 créditos fijos, dure lo que dure**. Este sitio construye
en 8–16 segundos, así que el razonamiento «300 minutos son 1.800 builds» daba
una sensación de holgura que no existía: **el plan gratuito son ~20 despliegues
al mes**. Se hicieron 18 en dos semanas construyendo la pasarela y se fueron 270
de 300 créditos. Ancho de banda y ejecuciones no llegaron a 35 créditos entre
los dos: el consumo es de publicar, no de vender.

**Con el saldo en cero, Netlify bloquea los despliegues a nivel de cuenta.** Está
comprobado: con el sitio vinculado por CLI, `netlify deploy --build --prod`
devuelve `403 Forbidden`. El `link` funciona y el `deploy` no, que es la firma de
un bloqueo por saldo y no de un problema de credenciales.

De ahí sale la conclusión que más importa recordar: **construir fuera de Netlify
no esquiva el bloqueo.** No es una tarifa por operación que se pueda evitar
empaquetando en otro lado; es una puerta cerrada en la cuenta.

Las salidas, ya evaluadas:

| Opción | Veredicto |
|---|---|
| **Plan pago de Netlify** | **Lo que se hizo.** Desbloquea de inmediato y da margen de sobra (~66 despliegues). Es suscripción mensual, se cancela cuando se quiera y volver a Free no rompe nada: el dominio propio y las funciones ya corrían en el plan gratuito. **Es mensual y se sigue cobrando solo**: si se decide cancelar, el recordatorio va el mismo día que se decide, no "más adelante". Al cierre de esta sesión van **19 despliegues de los ~66** del ciclo |
| **GitHub Actions + Netlify CLI** | **Sigue valiendo, pero no por lo que se creía.** No ahorra créditos ni desbloquea nada — el 403 es de cuenta. Vale por otra razón: que las pruebas corran antes de publicar. Necesita un `NETLIFY_AUTH_TOKEN` en los secrets de GitHub |
| **Cloudflare Pages** | Gratis, permite comercio y no penaliza por despliegue (500/mes). Pero **no es «mudar el repositorio»**: es cirugía sobre la infraestructura de pagos. Ver el detalle abajo. Decisión meditada para más adelante, con la tienda estable — nunca bajo presión |
| **Vercel** | **Descartada.** Su plan gratuito prohíbe el uso comercial en los términos, y esto es una tienda que cobra |
| **Abrir otra cuenta gratuita** | **Descartada.** Es lo que los términos prohíben, y el modo de falla es mucho peor que el actual: quedarse sin créditos deja la tienda arriba cobrando; una suspensión la tumba sin aviso. Además no arregla nada, reinicia un reloj — y cada mudanza obliga a rehacer dominio, certificado, variables de Wompi y Resend, y la URL de eventos |

**Lo que costaría Cloudflare, para que la decisión sea informada.** El código usa
`crypto.createHash` síncrono (WebCrypto es asíncrono y contagia `await` a todos
sus llamadores), `crypto.timingSafeEqual` (no existe en workerd), `randomBytes`,
`Buffer` y `require()` de JSON; el flag `nodejs_compat` cubre buena parte, pero
queda pasar a ESM, cambiar `exports.handler` por `onRequest(context)` y
`process.env` por `context.env`. Y esas líneas no son cualquiera:
`crear-pago.js:49` es el hash de integridad de los cobros y
`wompi-webhook.js:39-49` la verificación de firma de los eventos. Más DNS,
traducir `netlify.toml` y **cambiar la URL de eventos en Wompi**, que falla en
silencio: el pago se aprueba, la clienta paga, la tienda no se entera.

**La disciplina que de verdad evita repetir esto: agrupar.** Los 18 despliegues
fueron ritmo de obra. Una tienda montada, tocando catálogo y precios, hace 2 o 3
al mes, y ahí el plan gratuito sobra. Varios commits en la rama salen en **un
solo despliegue** y cuestan 15 créditos, no 15 por commit.

---

## Pendientes

### 1 · Fotos de producto — cerrado

**Ya no falta ninguna.** Las 129 piezas del catálogo tienen foto; no queda ni
una tarjeta con el marcador "Foto en camino". El marcador y su CSS se dejan en
su sitio para la próxima pieza que entre sin imagen.

> Ojo con el nombre del archivo del Stitch. `stitch-azul` **es el plateado**, no
> el azul. La foto que tenía antes era copia byte a byte de `stitch.webp` —el
> azul esmaltado, que es otra pieza— y se borró.
>
> La que llegó venía como `stitch-azul.webp⁠.webp`: extensión duplicada y un
> **U+2060 invisible** en medio, cortesía de copiar el nombre desde un chat. La
> página no la habría encontrado nunca y la tarjeta habría seguido diciendo
> "Foto en camino" sin que nada fallara. Al subir una foto conviene comprobar el
> nombre con `ls -1b assets/`, que muestra los caracteres invisibles.
>
> Venía además a 1078×1046 y 58 KB, contra los 440×440 y ~13 KB del resto. Se
> reescaló: **10,8 KB**. Servir 1080 px para pintar 440 es cuadruplicar la
> descarga en un móvil, que es donde compra casi todo el mundo aquí.

**Las otras dos no faltaban: estaban guardadas con el nombre equivocado.** El
propietario detectó que el catálogo tenía tres piezas duplicadas bajo dos
nombres cada una, y al mirar las fotos quedó confirmado:

| Ficha retirada | Era en realidad | Se quedó |
|---|---|---|
| `elsa` | Cenicienta —moño con diadema y vestido turquesa, no la trenza de Elsa— | `cenicienta`, que ya tenía las 2 unidades |
| `nina-con-arcoiris` | El corazón con madre e hija y arcoíris de circonias | `corazon-mama-e-hija`, con sus 2 unidades |
| `tortuga-azul-grande` | La misma tortuga de cristal, otra foto | `tortuga-marina-cristal` |

En cada caso sobrevivió el id **con inventario**, y se le enchufó la foto que
estaba bajo el nombre equivocado. Las tres retiradas tenían stock 0, así que no
se dejó de vender nada.

> **El duplicado de Mamá e Hija estaba publicado a dos precios**: $68.000 en la
> ficha con inventario y $80.000 en la que tenía la foto. Lo confirmó el
> propietario: el bueno es **$68.000**. Merece decirse porque es la clase de
> cosa que un duplicado esconde — dos precios para la misma pieza, y la clienta
> comprando por el que encuentre primero.

#### Calidad de las fotos, no ausencia de fotos

Cerrado que no falte ninguna, lo que queda es de qué son. Casi ninguna está
borrosa: **están sucias**. Son capturas de fichas de proveedor, con lo que
traía la ficha dentro —collages de tres paneles donde la pieza ocupa un tercio
del cuadro, contadores de galería quemados en el píxel («8/8», «10/10»,
«8/9»), textos sobrepuestos («4pc/set», «REAL SHOT», logos de marca) y el
sello rojo «S925 / Real Sterling Silver»—.

De la revisión de las 108 salieron 18 con alguno de esos defectos. La tanda
del 2026-08-20 arregló 13. En esta entraron **7 reemplazos y una segunda
vista**, todos desde originales de 1200×1200 o más:

| Pieza | Qué tenía |
|---|---|
| `guantelete-del-infinito` | Collage de 3 piezas + logo Disney + sello + una línea negra suelta |
| `bola-rosa-con-flores` | Collage de 3 paneles; el charm medía **96×127 px reales** de los 440 |
| `mickey-mouse`, `stitch` | Sello S925 |
| `pulsera-avengers`, `pulsera-corona-pave`, `pulsera-corona-con-cristales` | Sello «Real Sterling Silver» |

El guantelete además gana segunda vista (`guantelete-del-infinito-2.webp`,
registrada en `FOTOS`): el collage que se retiró mostraba frente y dorso, y
perder el dorso habría sido perder información que el catálogo ya daba.

> **Cómo distingue el sello de una pieza roja**, que es donde estaba el riesgo:
> no por el color. Deadpool, Iron Man, el moño de Minnie y la manzana de
> Blancanieves son rojos de verdad, y pintarlos encima habría sido mucho peor
> que el sello. Lo que separa al sello es que es una **isla**: un trozo suelto
> rodeado de fondo, sin contacto con el cuerpo de la pieza. El rojo del producto
> siempre cuelga del cuerpo plateado.
>
> Hizo falta una segunda guarda. En el creativo de marketing con la mano de la
> modelo —`pulsera-zephora-armada-con-charms-en-plata-925`, que no es
> producto-sobre-blanco— se coló como «sello» una franja de piel de 21×127 px, y
> borrarla habría destrozado la foto. Se descarta por forma: el sello es una
> insignia redonda, y un rojo seis veces más alto que ancho no lo es.
>
> Y una advertencia de lectura: en el informe, **«sin isla de sello» no
> significa «limpia»**. Si el sello toca la pieza no forma isla y cae en ese
> montón. Por eso el recuento de los que sí lo tocan va aparte.

> **El sello se puede borrar sin cambiar la foto, cuando no toca la pieza.** Se
> hizo con `pulsera-copo-de-nieve`: el reemplazo que llegó venía a 225×225 —183
> px de pulsera contra los 349 de la que había—, así que en vez de cambiarla se
> le quitó el sello a la buena. El sello vivía sobre fondo liso en la esquina
> opuesta a la pulsera (10 px de plata dentro de la caja, y son antialias), y se
> rellenó tomando el color de fondo de cada fila. Conserva los 349 px.
>
> Sirve solo cuando el sello no se superpone a la pieza; hay que comprobarlo
> antes, no darlo por hecho. Donde valga, es mejor que cualquier reemplazo,
> porque no cuesta resolución.

#### El sello no era el único defecto: el fondo con panel

El propietario señaló piezas que el barrido del sello no tocaba —Sulley, Buzz,
Iron Man—, y tenía razón: **ese barrido buscaba una sola cosa.** El resto lo
había revisado a ojo y sobre miniaturas, que es donde no se ve ni el panel de
Sulley ni el texto grabado de Buzz.

De revisar las 111 **a resolución real** salió un defecto nuevo: varias
capturas no vienen sobre blanco sino sobre un **panel gris recortado dentro del
cuadro** (246 sobre 255). En la rejilla la tarjeta aparece con un recuadro más
oscuro que sus vecinas. Corregidas con `herramientas/blanquear_fondo.py`:
`sulley`, `gato-cheshire`, `bola-azul-con-flor-rosa`, `esfera-azul-con-cristales`.

> **Truco para verlo**: montar las fotos sobre un lienzo blanco puro. El panel
> se delata solo, y ninguna medición automática hizo falta. Al revés: dos de
> mis candidatos eran falsos. `torre-eiffel-y-camara` mide (254,254,252) contra
> 255 —uno a tres niveles, invisibles— y en `stitch-azul` lo que se tomaba por
> panel era la sombra de la pieza. Las dos guardas están en el script y cortan
> antes de escribir, no después.

**`pulsera-mickey-mouse-pave` queda fuera**: no tiene un panel plano sino un
degradado lila de foto de estudio con una tela al fondo. Blanquearlo la
destroza; necesita foto nueva.

#### Lo que NO se toca, y por qué

- **«PANDORA» grabado en la pieza** — se lee en `buzz-lightyear`, `spider-man`,
  `jack-y-sally`, `jasmine`, `wall-e`, `princesa-bella`, `dalmata-2`, `hulk` y
  `hulk-2`. Borrar el sello de un proveedor es quitar algo que se le añadió *a
  la foto*; borrar un grabado es cambiar *el producto que la clienta recibe*.
  Lo segundo falsea la ficha, así que es decisión del propietario y no un
  retoque. Encaja con el criterio que ya se aplicó al dejar fuera el creativo
  de pauta que nombraba a Pandora.
- **La insignia «Luminous»** de `pulsera-corazon-luminoso` y **las flechas** de
  `trebol-verde-giratorio`. Parecen añadidos sobrantes y no lo son: enseñan que
  el corazón brilla y que el trébol gira —lo que literalmente lo nombra—.
  Quitarlas borra la razón de comprarlos. Mismo criterio que el camaleón.

**Lo que sigue sin reemplazo**, porque no llegó o porque el que llegó era peor:

- `escudo-capitan-america` y `corazon-arbol-de-la-vida` — nadie mandó una.
- `atrapasuenos-azul` — la que llegó viene a 158×318 y la actual tiene la pieza
  a 386×329. Quitarle el «8/9» costaría nitidez, que es exactamente el cambio
  que se revirtió con el osito. Se queda hasta que aparezca una grande.
- El **sello del proveedor: resuelto en 11 de 11**. `herramientas/quitar_sello.py`
  hizo el barrido: quedaban 11 fotos con sello (no ~30 — la tanda del 20 se
  llevó el resto al cambiar 39 fotos). Ocho se limpiaron sin tocar la pieza,
  más `pulsera-copo-de-nieve` que se hizo antes a mano. **Las dos que había
  dado por imposibles no lo eran**: en `osito-con-rosa-y-corazon` y
  `pulsera-sol-con-cadena-seguridad` el sello está sobre blanco y lo que
  entraba en su caja era el halo del propio sello, no la pieza. Ya están
  limpias. La única que de verdad no se puede es `escudo-capitan-america`,
  donde el sello está pegado al segundo charm — y esa ya estaba en la lista
  por el logo de Disney.
- La foto que se ve **al compartir el sitio** por WhatsApp o Facebook
  (`og:image`) es `pulsera-armada-con-muranos-camaleon-verde-y-atrapa.jpg`:
  800×600, luz de casa, fondo de sala. Es la primera impresión en cada enlace
  compartido y en cada anuncio, y cambiarla rinde más que cualquiera de las de
  arriba.

> Meter fotos dejó de ser un `cp` a mano: `herramientas/entrar_fotos.py` limpia
> el nombre, lo empareja contra una pieza real, reescala a 440×440 al 90% de
> llenado —la mediana del catálogo; conservar el margen del original deja la
> tarjeta encogida al lado de sus vecinas— y compara los píxeles de producto
> del original contra los del actual. No escribe nada sin `--aplicar`.
>
> Dos cosas que ese script **no** puede decidir, y por eso enseña la hoja de
> antes/después en vez de bloquear: no ve el desenfoque, solo cuenta píxeles; y
> cuando los paneles de un collage traen fondo propio, el panel entero cuenta
> como pieza y la foto vieja sale inflada. Ahí avisa de una pérdida que no
> existe —pasó con `bola-rosa-con-flores`, que se comprobó a mano—.

#### Cambiar una foto no basta: hay que subir la versión de la URL

El despliegue del 22-08 salió correcto —las fotos limpias estaban en `main` y
Netlify las subió— y aun así el propietario abrió la tienda y **seguía viendo
los sellos**. No era su navegador: `netlify.toml` sirve `assets/*.webp` con
`max-age=604800`, y como el archivo conserva el nombre, quien haya entrado en la
última semana se queda con la copia vieja hasta siete días. Recargar del lado de
uno no lo arregla del lado de la clienta.

Lo único que salta una caché ya escrita es **cambiar la URL**, así que las 119
referencias de `index.html` y los cuatro constructores de `checkout.html` llevan
`?v=AAAAMMDD`. Comprobado en el navegador: 119 de 119 con versión, ninguna rota,
ningún 404, y ninguna petición sale ya sin versión.

> **Al cambiar una foto hay que subir esa versión.** Está escrito también en
> `netlify.toml`, junto a la cabecera que lo causa, porque es ahí donde se mira
> cuando algo no aparece. Si no se sube, el cambio no lo ve quien ya tenía la
> foto anterior — y esa es justo la gente que ya conoce la tienda.

#### La foto del empaque también depende de lo que va dentro

Otra sesión estableció que el Premium son **dos kits distintos** —brazalete y
charm— y escribió el texto desde el carrito para no prometer la caja que no es.
El mismo razonamiento vale para la imagen, y ahí quedaba el hueco: un pedido de
solo charms veía la foto con la bolsita guardapolvo y el brazalete dentro de la
caja.

Las dos fotos que mandó el propietario resultaron ser justo los dos kits, y se
distinguen por lo que el propio texto nombra: la del lazo rosa trae **bolsita
guardapolvo y folleto** —los dos del kit de brazalete—; la otra no tiene ninguna
de las dos y su caja es pequeña. Así que `empaque.webp` va con brazalete y
`empaque-charm.webp` con charms, y tanto el bump como la línea del resumen las
eligen desde el carrito.

> Si la correspondencia estuviera al revés, se cambia en dos sitios de
> `checkout.html` (`pintarBump` y `lineas`). Sale de mirar las fotos, no de que
> nadie lo confirmara.

#### Cuidado con lo que se sube a `assets/`: esa carpeta se publica

Al mezclar para desplegar aparecieron en `assets/` cinco
`WhatsApp Image 2026-08-22….jpeg` que **no son fotos de producto**: son capturas
de conversaciones con clientas —nombres de pila, un usuario de Instagram, fotos
suyas y sus mensajes—. Nada las enlazaba, pero **cada push a `main` publica**, y
habrían quedado accesibles en `zephoracharms.com/assets/…` para cualquiera que
probara la URL. No se desplegaron: están en `material-sin-publicar/`, fuera del
repo y recuperables del commit `bc826a3`.

Son buen material de prueba social —hay clientas contando que la pieza les
encantó—, pero eso se publica como testimonio recortado y con permiso, no como
captura de un chat con el nombre a la vista. Las reseñas de la portada ya siguen
ese formato.

**La regla para la próxima vez: `assets/` es carpeta pública.** El material en
bruto va a `material-sin-publicar/`, que está en `.gitignore`. Allí se movieron
también los dos originales del empaque (4 MB que se desplegaban sin usarse).

#### Fondo de estudio: recorte, no blanqueo

`pulsera-mickey-mouse-pave` era la última con fondo raro, y no se arreglaba
como las otras: no tiene un panel plano sino un **degradado lila con tela
blanca de atrezo**. Blanquear el lila dejaba la tela y sus sombras.

Lo que funcionó fue separar por componentes: la tela toca el borde de la foto y
la pulsera no, así que se distinguen sin mirar el color. Se borra el atrezo con
su halo, se lleva a blanco el lila y sus sombras, y se respeta todo lo que cae
dentro de la pieza dilatada.

> El intento anterior —recortar la pulsera con máscara y pegarla sobre blanco—
> salió pálida y fina: la máscara se comía los bordes oscuros que le dan cuerpo,
> y en la rejilla se notaba al lado de sus vecinas. Conviene recordarlo: en
> plata sobre fondo claro, recortar por umbral quita justo lo que define la
> pieza.

#### Fotos retocadas con IA — decisión del propietario

Las cinco piezas que no se podían limpiar por retoque se resolvieron con
imágenes pasadas por Gemini (`Gemini_Generated_Image_*.webp`):
`escudo-capitan-america`, `corazon-arbol-de-la-vida`, `atrapasuenos-azul`,
`osito-con-rosa-y-corazon` y `pulsera-sol-con-cadena-seguridad`.

Al compararlas contra la foto anterior aparecen diferencias de detalle —las
orejas del osito salen texturadas y no lisas, el cierre de la pulsera del sol
pasa de sol a sol con luna, el aro del escudo de calado a liso—. **Se planteó
al propietario y decidió publicarlas**: son sus piezas y sus fotos, considera
que son retoques de estudio que no se apartan del producto real, y asume el
riesgo. Queda anotado aquí para que la próxima sesión no lo replantee.

La línea que sí conviene mantener, y que no está en discusión, es la del
grabado: retocar la foto es una cosa y cambiar el producto que la clienta
recibe es otra. Donde una diferencia sea grande, se pregunta.

> De paso, el intento de comparar destapó que dos de esas cinco nunca fueron
> imposibles de limpiar. Si alguna vez se quiere volver a la foto original
> retocada en vez de la de Gemini, están en el commit `682ed97`.

#### Qué mandar para que la foto quede bien — medido, no supuesto

Los tamaños salen de medir la página en el navegador a los anchos y densidades
reales, no del CSS:

| Dónde se pinta | CSS px | En un móvil (DPR 3) pide | Archivo hoy |
|---|---|---|---|
| Tarjeta de la rejilla | 152–227 | 456–681 px | 440 ✓ |
| Ficha de producto | 330–352 | 990 px | 440 — **la estira 2,3×** |
| Miniatura de la galería | 40 | 120 px | de sobra |

Los **440×440 están bien elegidos para la rejilla** —456 pedidos contra 440
servidos, prácticamente exacto— y **cortos para la ficha**, que llegó después.
En escritorio la ficha estira 1,6×; en móvil, 2,3×.

**Manda siempre el original más grande que tengas, mínimo 1200 px de lado.**
No es para guardarlo así: es que reducir se puede y ampliar no. De los 27
archivos de la tanda del 2026-08-21, 20 venían entre 192 y 225 px y por eso no
entró ninguno — estirarlos a 440 los deja peor que lo que ya había.

Lo que hace que una foto sirva, por orden de veces que lo ha roto:

1. **Una pieza por foto.** El defecto más común no es el desenfoque sino el
   collage: la captura de la ficha del proveedor trae tres paneles, y la pieza
   acaba ocupando un tercio del cuadro. En `bola-rosa-con-flores` el charm
   medía 96×127 px reales de los 440 que se pintaban.
2. **Nada quemado encima.** Sellos «S925 / Real Sterling Silver», logos de
   marca, contadores de galería («8/8», «10/10»), textos tipo «4pc/set» o
   «REAL SHOT». No se pueden quitar después sin repintar la foto.
3. **Fondo liso, claro.** Blanco a ser posible. Los fondos rosa o lila rompen
   la rejilla aunque la pieza esté bien.
4. **La pieza llenando el cuadro.** El catálogo tiene una mediana del 90%. Si
   viene con mucho margen, `entrar_fotos.py` recorta y reencuadra sola, así que
   esto es lo menos crítico de los cuatro.

Lo que **no** importa, para no perder tiempo ahí: el formato (webp, jpg, png y
jfif entran igual, se convierten), el peso del original (se recomprime a ~14 KB)
y el nombre del archivo — el emparejamiento con la pieza se hace mirando la
imagen, no leyendo el nombre. Nombrarla con el id ayuda, pero `download (7).webp`
también sirve.

> Para la foto que se ve **al compartir el sitio** (`og:image`) la regla es otra:
> horizontal **1200×630**, no cuadrada, y con la pieza centrada porque WhatsApp
> y Facebook recortan los bordes.

**Si algún día se decide arreglar la ficha**, los originales de 1200×1200 de esta
tanda siguen en el historial, en `assets/webp2/` del commit `cb5c39c` de `main`.
Subir el catálogo entero de 440 a 880 lo llevaría de 1,8 MB a ~3,6 MB; como la
rejilla carga en diferido y la ficha abre de una en una, lo sensato sería una
copia grande solo para la ficha, no subir las 108.

### 2 · Domicilio

No se publica, por decisión del propietario. Queda anotado que el **artículo 50 de
la Ley 1480 de 2011** pide dirección de notificación judicial en comercio
electrónico; hoy las políticas señalan WhatsApp y el correo como canales oficiales
de notificación. Si algún día aparece una dirección, va en
`herramientas/gen_paginas.py` (no en los HTML: se regeneran).

### 3 · Factura electrónica

La página dice que no se emite y que se entrega comprobante digital. Es la
redacción que pidió el propietario. Conviene que lo valide un contador: con NIT
registrado, la obligación de facturar electrónicamente depende del régimen, y es
un texto público.

### 4 · Pasarela de pago — cobrando

**El sitio cobra.** Se hizo un pago real de prueba por Wompi y quedó aprobado.
El repo está conectado a Netlify, las funciones desplegadas y las llaves
puestas. Lo que queda de esta línea de trabajo:

- **Correo.** **Configurado.** La cuenta de Resend existe, `zephoracharms.com`
  quedó verificado por DNS. En Netlify están puestas **dos** de las tres:
  `RESEND_API_KEY` (marcada como secreta) y `CORREO_TIENDA`. **`CORREO_DESDE`
  no está**, y no hace falta: `_correo.js` cae a
  `Zephora Charms <pedidos@zephoracharms.com>`, que es el valor que se
  documentaba. Comprobado contra el panel el 2026-08-28. Falta la
  comprobación de punta a punta —ver abajo—.

  > `CORREO_TIENDA` faltaba y arreglaba **dos** cosas. La evidente: sin ella
  > `avisoTienda()` salía sin mandar nada y la tienda no recibía copia de ningún
  > pedido. La que no se ve: `_correo.js:156` la usa como `reply_to` del correo
  > a la clienta, así que sin ella las respuestas iban a
  > `pedidos@zephoracharms.com` —un buzón que no existe— y se perdían.
- **Addi.** **Corrección importante: no es cuestión de que Wompi «lo active».**
  Wompi confirmó que Addi **no hace parte de su pasarela**, así que la espera
  que estaba anotada aquí no lleva a ninguna parte. Integrarlo exige hacerlo
  por cuenta propia, contra Addi directamente, y eso es un frente nuevo
  —credenciales, su propio flujo de aprobación y su propio webhook—, no
  «devolver el chip al checkout».

  Aplazado a una etapa posterior por decisión del propietario. Mientras tanto
  se sigue ofreciendo por WhatsApp desde la sección de medios de pago, con
  `data-wa="pagos"` para medir cuántas lo piden — que además es el dato con el
  que decidir si vale la pena esa integración.

> **La llave pública se transcribió mal una vez** (un `1` donde iba una `l`) y
> costó una hora de diagnóstico, porque el error que da Wompi —«No se pudo
> cargar la información del undefined»— no apunta a nada. Antes de dar una
> llave por buena: `curl https://production.wompi.co/v1/merchants/<llave>`.

### 4a · `Purchase` a Meta desde el servidor — dos píxeles mientras se resuelve el negocio

**El código funciona; el bloqueo era del negocio de Meta, no del sitio.** El
píxel original (`2130673404542988`, "zephora charms pixel 1") corre en una
cuenta publicitaria (`1583713932705268`, la real, la que tiene la campaña) que
**no pertenece a ningún portafolio comercial** — quedó suelta en la capacidad
individual de la cuenta de Facebook. Sin portafolio dueño, nadie —ni la persona,
ni un usuario del sistema— puede generar un token de Conversions API para ese
píxel: Meta pide ser administrador o desarrollador *del portafolio comercial*
que lo posee, y ese píxel no tiene uno. Confirmado con datos, no solo con la
pantalla de error: `ads_get_dataset_details` de ese píxel muestra
`server_last_fired_time` en época cero — nunca en su vida recibió un evento de
servidor.

**La solución no fue arreglar el píxel viejo — fue crear uno nuevo donde sí hay
control.** `1029982529813994` ("zephora charms pixel web") vive dentro del
portafolio **"Zephora Charms"**, donde el usuario del sistema **"Netlify CAPI"**
ya es Admin. Con `META_CAPI_TOKEN` generado ahí, el `Purchase` de servidor por
fin sale.

**Por qué hay dos píxeles en el HTML y no uno.** Mover la cuenta publicitaria
real al portafolio (para que use el píxel nuevo directamente) o compartirle el
píxel nuevo choca con el mismo muro: Meta limita cuántos activos puede
mover/compartir un portafolio comercial "nuevo" hasta cumplir **varias
semanas** de antigüedad con sus políticas — probado por los tres caminos
(reclamar la cuenta, compartir con socio, conectar activo) y los tres dan el
mismo aviso. No hay atajo de interfaz; es una restricción de cuenta, igual que
fue el bloqueo de despliegues de Netlify más arriba.

Mientras tanto, `index.html`, `checkout.html` y `gracias.html` inicializan
**los dos píxeles** (`fbq('init', …)` dos veces): el viejo sigue recibiendo
exactamente lo mismo que hoy, así que **la campaña activa no pierde señal**; el
nuevo recibe lo mismo por navegador **y además** el `Purchase` de servidor
desde `wompi-webhook.mjs` (que apunta al nuevo vía `META_PIXEL_ID` en Netlify,
no por código — `_meta.js` ya leía esa variable con el viejo como default).

**Cuándo quitar el segundo píxel.** En cuanto pasen las semanas y se pueda
compartir `1029982529813994` con la cuenta publicitaria `1583713932705268` (o
reclamar la cuenta hacia el portafolio), conviene migrar del todo al nuevo y
sacar el `fbq('init', '2130673404542988')` de los tres HTML — dos píxeles
permanentes solo duplican datos sin necesidad. Revisar primero en Business
Settings → Cuentas publicitarias si ya deja reclamar una segunda cuenta.

**Lo que no hay que romper:** los dos lados —`_meta.js` y `gracias.html`—
mandan la referencia del pedido como identificador del evento (`event_id` /
`eventID`), y eso es lo único que impide que Meta cuente cada compra dos veces
dentro de un mismo píxel. `pruebas/meta.js` lo vigila.

Ya hecho, para no repetirlo:

1. ~~Generar el token~~ — hecho, con el píxel nuevo vía Events Manager →
   Configuración → Conversions API → *Generar token de acceso*, ya con permiso
   real. `META_CAPI_TOKEN` puesto en Netlify, marcada como secreta.
2. Falta: probar con `META_TEST_EVENT_CODE` (Events Manager → *Probar
   eventos*) y confirmar en Events Manager que el `Purchase` del píxel nuevo
   aparece **una sola vez** por compra, no dos — eso confirma que la
   deduplicación navegador/servidor funciona de verdad ahí. **Quitar la
   variable de prueba al terminar.**

### 4e · La hoja de despacho — por qué se perdió un pedido

**Costó un producto.** Una clienta pidió que se lo entregaran en un local
concreto y lo escribió en «Indicaciones para la entrega». El campo viajaba bien
—llegaba al servidor, se guardaba en el registro— pero **no se imprimía en
ningún correo**. El pedido salió sin la indicación y se perdió. La tienda acabó
leyendo los datos en el panel de Resend, que es el último sitio donde alguien
mira mientras empaca.

La causa: **el correo de la tienda era el recibo de la clienta con otro
título** — misma plantilla, mismos campos. Nunca imprimió `notas`,
`dedicatoria`, `documento` ni `correo`. Nada falló: la tienda cobró, los correos
salieron, no hubo un solo error. Otro fallo mudo, y de los caros.

Ahora los dos correos tienen plantillas separadas, porque tienen trabajos
distintos:

| Correo | Qué es |
|---|---|
| A la clienta (`plantilla`) | Un **comprobante**: qué compró y cuánto pagó |
| A la tienda (`plantillaTienda`) | Una **orden de trabajo**: qué meter en la caja, qué escribir a mano, qué poner en la guía |

La hoja de despacho abre con lo que se pierde si se lee en diagonal —
**indicaciones de entrega y dedicatoria, destacadas en rojo y antes que la
dirección**— y sigue con qué empacar (con talla y unidades), destinatario
completo con documento, dirección y cuentas. El **asunto** avisa `⚠ CON
INDICACIONES` / `✎ DEDICATORIA`, porque el correo se ve primero en una lista y
lo que no está ahí se empaca sin abrirlo.

**Y ahora la tienda se entera de que le pagaron.** El «Pago recibido» iba solo a
la clienta: con pago en línea, el único correo interno salía al **crear** el
pedido —antes de que existiera el pago— y la bandeja no distinguía lo cobrado de
lo abandonado. `wompi-webhook` manda ahora `pagoTienda()` al aprobarse, **con la
hoja completa otra vez**, indicaciones incluidas: quien empaca no debería tener
que buscar el correo anterior. Y el correo de creación con pago en línea dice
explícitamente *«sin confirmar todavía, no despachar aún»*.

> **`CORREO_TIENDA` ha faltado dos veces, y ahora ya no puede tumbar nada.** La
> primera dejó a la tienda sin copia de ningún pedido. La segunda tiró a la
> basura la hoja de despacho del pedido de prueba `ZC-260816-9561CFF4`: el
> comprobante de la clienta salió bien —Resend, la llave y el dominio estaban
> perfectos— y la copia interna no, con `{"tienda":{"enviado":false,"motivo":"sin
> CORREO_TIENDA"}}` en el log como única señal. «Falla hacia adelante» estaba mal
> aplicado ahí: no mandar el correo no salvaba ninguna venta, solo perdía el
> pedido. Ahora hay **destinatario por defecto** (`zephoracharms@gmail.com`, que
> ya iba en el pie de todos los correos, así que no es ningún secreto), el valor
> se pasa por `.trim()` —un espacio al pegarlo en Netlify se comportaba como
> ausencia— y el resultado dice `destinatarioPorDefecto` para que el log lo
> cuente. `rescate.mjs` usa el mismo camino: antes se rendía y los carritos
> abandonados del día no los veía nadie.
>
> Si vuelve a faltar, el sitio donde mirar es **Netlify → Site configuration →
> Environment variables**, y no basta con que la variable exista: sus **Scopes**
> tienen que incluir *Functions* y sus **deploy contexts**, *Production*. Una
> variable creada solo para *Builds* se ve en el panel y la función no la lee.

> **La regla que sostiene esto, y la prueba que la vigila.** Ningún dato que la
> clienta escriba puede quedarse sin imprimir. `pruebas/correo-tienda.js`
> comprueba la cadena entera y **sin nombrar los campos a mano**: saca la lista
> de lo que acepta `crear-pago`, y exige que cada valor aparezca en el HTML y en
> el texto plano; y saca los `name=` del formulario, y exige que todos estén
> dentro de `datos()`. El día que el checkout gane un campo y alguien olvide la
> plantilla, sale en rojo aquí — en vez de descubrirse con un paquete perdido.

### 4f · Hoja de inventario automática — a medias, esperando Google

**El hueco que cierra.** La tienda no tenía dónde ver cuánto le quedaba de nada.
`stock.json` dice lo que había el día del conteo y lo vendido desde entonces vive
en el almacén de Blobs, invisible. Se notó reponiendo después de las pruebas del
16 de agosto: hubo que **preguntarle al propietario de memoria** qué se había
vendido, porque no había dónde mirarlo. Una memoria no es un inventario.

**Diseño acordado:** Netlify → webhook de n8n → Google Sheets, con dos pestañas
(*Movimientos*, una fila por pieza vendida; *Existencias*, lo que queda). Solo
ventas cobradas. Y la reposición se hace apuntando el recuento físico en la hoja
y convirtiéndolo a `stock.json` con **un paso explícito**.

> **La hoja es un espejo, no un mando.** Lo que decide si se puede vender sigue
> siendo `stock.json` más el contador de Blobs. Si la hoja se volviera un
> inventario paralelo editable, habría dos sistemas afirmando cosas distintas
> sobre la misma pieza — y este repo ya sabe cómo acaba eso. Por lo mismo, el
> aviso lleva `quedan` **calculado dentro del mismo CAS que confirma la venta**
> (`confirmar()` en `_inventario.mjs`): la hoja *muestra* ese número, no lo
> deduce. Una hoja que hace su propia resta acaba discrepando del inventario que
> de verdad manda.

**Hecho y desplegado (lado Netlify):** `_hoja.mjs` manda un aviso por venta
cobrada. Contraentrega lo dispara `crear-pago` al confirmar; el pago en línea lo
dispara `wompi-webhook` al aprobarse —y no antes, porque hasta que Wompi aprueba
no ha salido nada del inventario, y apuntar ventas que se declinan infla lo
vendido y esconde existencias que sí están—. Vigilado por `pruebas/hoja.js`.

- Variables: `HOJA_WEBHOOK` (URL del webhook) y `HOJA_TOKEN` (opcional, viaja
  como cabecera `X-Zephora-Token`, **no en la URL**: las URLs quedan en logs e
  historiales). Sin `HOJA_WEBHOOK` no se manda nada y no pasa nada.
- Cada intento deja línea `hoja_inventario` en el log. No es adorno: un aviso
  perdido deja la hoja con **más existencias de las que hay**, que es la
  dirección peligrosa del error. Por eso la referencia va en el cuerpo — mejor
  reintentar y que n8n deduplique, que callarse.

**Ya no está bloqueado — el circuito está vivo (comprobado 2026-08-22).** Otra
sesión conectó una cuenta de servicio de Google y publicó el workflow
**«Zephora · Hoja de Inventario»** (`K1J4pHYfvd6QuAq8`, activo). `HOJA_WEBHOOK` y
`HOJA_TOKEN` están puestos en Netlify: el webhook recibe de verdad. Ha entrado
por ahí la venta del **19 de agosto** (`ZC-260819-DDCEF41D`, Letra E) y la del
**21** (`ZC-260821-A4C64EC2`, tres charms, $223.050).

> **Pero la pestaña *Movimientos* no se está escribiendo.** En las dos
> ejecuciones, el nodo «Agregar Fila a Movimientos» falla con
> `Multiple matches found` —un `paired_item_multiple_matches` de n8n: el nodo
> resuelve `$('Separar Movimientos').item` después de que «¿Ya está anotada?»
> haya colapsado varios ítems en uno—. *Existencias* sí se actualiza, así que
> **hay saldo pero no histórico**, que es justo lo que hacía falta para reponer
> por rotación en vez de «subir todo a 4».
>
> Y **la ejecución queda marcada como `success`**, porque el error se captura
> como dato y el flujo sigue. Otro fallo mudo de la colección: el sitio donde
> hay que mirarlo es el nodo, no el estado de la ejecución.

**Lo que falta, en orden:** arreglar el nodo de *Movimientos* → el paso de
recuento físico → `stock.json` con `herramientas/reponer.mjs`.

> **El agujero que no cubre nada de esto: la venta cerrada por WhatsApp.** Solo
> se apunta lo cobrado por la web. Una venta por chat no llega a la hoja, no
> toca el contador de reservas y no cambia `stock.json` — o sea que **la página
> sigue ofreciendo una pieza que ya no está, y la vendería**. Pasó el
> 2026-08-22 con el último brazalete Avengers. Mientras exista venta por
> WhatsApp, hay que bajar la pieza a mano en `stock.json` el mismo día.

### 4c · Dónde queda el registro de cada pedido

**Lo enseñó la primera venta real.** El detalle de qué se pidió vivía solo en el
correo a la tienda: si Resend falla, si cae en spam o si alguien lo borra, la
tienda cobró y no sabe qué despachar — el log solo decía «2 piezas, $159.440».
Hubo que reconstruir el pedido desde el total.

Ahora hay tres copias, y ninguna depende de las otras:

| Dónde | Qué trae |
|---|---|
| **Registro en Blobs** (`_pedidos.mjs`) | El pedido entero: piezas, tallas, dirección, cuentas, estado, transacción de Wompi |
| **Log de `crear-pago`** | El evento `pedido_creado` lleva ahora las `lineas` — lo que hay que empacar. Sin dirección ni contacto a propósito: eso no va en un log |
| **Correo a la tienda** | Como antes |

Se consulta desde la terminal, sin exponer ningún endpoint nuevo en un sitio
que cobra:

```sh
netlify blobs:get pedidos ZC-260812-35FCB0D5
```

(`netlify blobs --help` lista los subcomandos de la versión instalada.)

Dos decisiones de esa pieza:

- **Almacén y clave aparte del inventario.** El de inventario es una sola clave
  que todos los pedidos reescriben con CAS; meter ahí los pedidos añadiría
  contención a la pieza más delicada y la haría crecer sin límite.
- **El aviso de Wompi fusiona, no reescribe.** El evento no trae ni las piezas
  ni la dirección: si el estado se guardara encima, el registro perdería justo
  lo que sirve para despachar.

Guarda **datos personales** —nombre, teléfono, correo, dirección—, que es lo que
hace falta para enviar y lo mismo que ya viaja en el correo. Sujeto a la Ley
1581; conviene que la política de privacidad diga dónde se guardan. Del pago no
se guarda nada: la tarjeta no pasa por el sitio en ningún momento.

### 4d · Rescate de checkouts abandonados

Una clienta que escribió nombre, celular, correo y dirección, eligió sus piezas
y no llegó a pagar es la persona más caliente que tiene la tienda. Hasta ahora
se perdía en silencio: el pedido quedaba en `esperando-pago` y nadie volvía a
mirarlo. Con el registro de pedidos ya se pueden encontrar.

`rescate.mjs` corre **una vez al día a las 9:00 de Colombia** y le manda a
`CORREO_TIENDA` la lista, con un enlace de WhatsApp listo para tocar en cada
uno.

> **Avisa a la tienda; no le escribe a la clienta.** Es la decisión importante
> de esta pieza. Escribirle automáticamente a alguien que dejó sus datos **para
> comprar**, no para recibir mensajes, es terreno resbaladizo bajo la Ley 1581:
> la finalidad autorizada era la compra. Y en esta tienda la venta se cierra
> hablando, así que un mensaje del propietario, con su tono y respondiendo
> dudas, recupera más que un automático. Lo que se automatiza es *encontrarlos*,
> que es el trabajo que no se hace nunca.

La ventana tampoco es un capricho: **antes de 2 horas** la clienta puede seguir
en la pasarela, y escribirle es interrumpir una compra que iba a ocurrir sola;
**después de 7 días** el mensaje se lee como vigilancia y no como servicio.
Tampoco se avisa dos veces del mismo pedido — un correo que repite lo de ayer se
deja de abrir.

Si Resend falla, no se marca ninguno y mañana vuelven a salir: un fallo de
correo no puede hacer que se pierdan.

**Falta comprobar que Netlify dispare el `schedule`** — se ve en Functions →
`rescate`, o forzándolo desde el panel.

### 4b · Lo que quedó del bloqueador de inventario

El servidor ya **comprueba inventario antes de cobrar**: rechaza con 409 lo
agotado, lo que pide más unidades de las que hay, y las tallas sin existencias
—con un mensaje que dice qué se agotó y qué tallas sí quedan, y el checkout
lleva a corregir la selección o a pedirlo por encargo—. Eso cierra el caso
corriente: pagar algo que se acabó hace rato.

**La carrera ya está cerrada** (`netlify/functions/_inventario.js`). Dos
clientas que compraban la última unidad en el mismo minuto pasaban las dos,
porque `stock.json` es un archivo que se lee, no un almacén que se reserve.
Ahora `crear-pago` **aparta** las unidades a nombre de la referencia antes de
mandar a nadie a pagar; el webhook las **confirma** si el pago entra y las
**libera** si se declina, se anula o falla; y una reserva sin pagar caduca sola
a los 30 minutos, que es lo que tarda un checkout abandonado en devolver lo que
tenía cogido.

Tres decisiones de esa pieza que no conviene deshacer:

- **Compare-and-swap, no leer-restar-escribir.** La documentación de Blobs dice
  que no hay control de concurrencia y que gana la última escritura. Un
  `leer → restar → escribir` habría tenido exactamente el mismo defecto que
  estábamos arreglando, solo que más difícil de ver. Cada escritura va con
  `onlyIfMatch` sobre el etag leído: si alguien escribió en medio, `modified`
  vuelve en `false` y se reintenta sobre el estado nuevo.
- **Una sola clave para todo el inventario**, no una por pieza. Un pedido toca
  varias piezas y tiene que apartarlas todas o ninguna; con una clave, un solo
  CAS cubre el pedido entero y la atomicidad sale gratis. A cambio los pedidos
  concurrentes compiten por la misma clave, que al volumen de esta tienda es
  irrelevante y el reintento lo absorbe.
- **Consistencia fuerte.** Con la eventual, una reserva recién escrita puede
  tardar hasta un minuto en verse — justo la ventana de la carrera.

> **2026-09-17 · El hueco que quedaba: un pedido confirmado que se cancela
> después.** `confirmar()` mueve las unidades a `vendido` y borra la reserva —
> hasta ahí, perfecto. El problema aparece con un **contraentrega**: confirma
> al crearse, no al entregarse, porque se trata como venta en firme desde el
> primer momento (la alternativa, dejarlo caducando media hora como cualquier
> reserva, congelaría una pieza cara en un pedido que ya es real). Si la
> clienta cancela después de eso, `liberar()` no sirve — solo borra una
> *reserva pendiente*, y a esta altura la reserva ya no existe. Pasó el
> 2026-09-14: un contraentrega de 4 piezas (una pulsera Avengers y tres
> charms) canceló después de confirmado, y las cuatro quedaron bloqueadas para
> siempre — la tienda las tenía en la mano y las mostraba agotadas, entre ellas
> Corazón Mamá e Hija, que se quedó en cero sin que faltara ninguna unidad
> real.
>
> Se cierra con `anular(referencia, items)` en `_inventario.mjs`, simétrica a
> `confirmar()` pero al revés: resta de `vendido` en vez de sumar. No puede
> reconstruir sola qué había en el pedido —la reserva ya no está—, así que
> quien la llama tiene que traerlo; en la práctica sale de `lineas` en el
> registro de `_pedidos.mjs` (§ 4c), que ya es la fuente de qué llevaba un
> pedido. Es idempotente por una razón distinta a `confirmar()`: sin una
> reserva que la frene sola, correrla dos veces por error restaría dos veces
> de `vendido` — la misma sobreventa que toda esta pieza existe para evitar,
> por el lado de anular en vez de por el de vender. `estado.anuladas` es esa
> memoria, y se limpia junto con `vendido` cuando `stock.json` trae un conteo
> nuevo: pasado ese punto, ya no hay nada que esa marca deba seguir evitando.
>
> Se aplica con `herramientas/anular-venta.mjs <referencia> --aplicar` —mismo
> criterio que `reponer.mjs`, dry-run por defecto—, corriendo en la máquina de
> quien lo use, con un `NETLIFY_AUTH_TOKEN` personal en `.env`: no se expone
> un endpoint nuevo en un sitio que cobra para una operación que es una
> decisión humana, no algo que deba poder disparar una petición HTTP de
> cualquiera. Probado en `pruebas/inventario.js` § 1b — anular, repetir sin
> restar dos veces, y no bajar de cero si `items` trajera más de lo vendido.

Y sigue **fallando hacia adelante**, como todo lo demás: si Blobs no está
configurado, no responde, o el CAS no converge en seis intentos, la venta pasa
y queda registrado en el log con el motivo. La reserva es una red de seguridad,
no un peaje. En el log de `crear-pago`, el campo `reserva` del evento
`pedido_creado` dice si las unidades se apartaron de verdad — es lo primero que
hay que mirar si algún día aparece una sobreventa. **Confirmado funcionando en
producción** (`"reserva":"reservado"`).

> **Al reponer inventario, `vendido` se reinicia solo.** `stock.json` dice
> cuántas unidades hay; el almacén solo cuenta lo comprometido desde la última
> vez. Si al reponer una pieza a 5 se siguiera restando la que se vendió antes,
> la tienda ofrecería 4 — y el desfase crecería con cada venta hasta dejar de
> vender cosas que están en la mano, **sin dar ningún error**. La señal es el
> campo `generado` de `stock.json`: cuando cambia, lo vendido vuelve a cero
> porque el conteo nuevo ya lo descuenta. Las reservas en vuelo no se tocan.
> Queda un `inventario_repuesto` en el log cada vez que pasa.

### Los fallos silenciosos — el patrón que más caro salió

Los tres problemas que más tiempo consumieron en esta jornada **no dieron ningún
error**. La tienda cobraba, los correos salían, el `Purchase` viajaba, y en
pantalla no había nada raro:

1. **Las funciones eran v1.** Netlify solo inyecta `NETLIFY_BLOBS_CONTEXT` en
   v2, así que `getStore()` lanzaba y todo caía al camino de emergencia: se
   vendía sin apartar inventario.
2. **Después, la librería no entraba en el bundle.** El `require` estaba dentro
   de un `try` para que un paquete ausente no tumbara la función — y el
   rastreador de dependencias de Netlify no ve un require escondido en el cuerpo
   de una función, así que nunca la empaquetaba. La protección causó el fallo
   que pretendía sobrevivir. Mismo síntoma: cero.
3. **La foto con el nombre roto** (§ 1). Extensión duplicada y un **U+2060
   invisible** en medio: la página no habría encontrado nunca el archivo y la
   tarjeta habría seguido diciendo "Foto en camino" sin que nada fallara.

**El «falla hacia adelante» es la decisión correcta —ninguna de estas cosas debe
costar una venta— pero tiene un precio: convierte cada error en algo que solo se
ve leyendo un log.** Es el precio que se paga a cambio de no tumbar la tienda, y
hay que pagarlo a conciencia: cada red de seguridad que se añada tiene que traer
consigo **cómo se va a notar que se rompió**.

De ahí sale el cambio de método que conviene mantener: `pruebas/inventario.js`
§ 6 comprueba **la forma del código** y no solo su comportamiento — que las
funciones exporten el handler v2, y que el import de `@netlify/blobs` sea
estático. Ninguna prueba de comportamiento las habría cazado, porque en local
siempre se usa el almacén falso. Lo mismo vale para el nombre de un archivo:
`ls -1b assets/` enseña los caracteres invisibles.

**Antes de añadir la próxima red de seguridad, la pregunta es qué la delata
cuando falle** — un campo en el log como el `reserva` de `pedido_creado`, un
tamaño esperado en la salida del despliegue como los ~306 KB, o una prueba que
mire el mecanismo y no el resultado. Sin eso, la red nueva se cae sola y nadie
se entera hasta que alguien va a leer un log por otro motivo.

### 5 · Piezas sueltas que el propietario pidió y están bloqueadas

| Qué | Qué falta |
|---|---|
| **Empaque Premium destacado** en el carrito | **Hecho.** Llegó la foto real del empaque (`assets/empaque.webp`) y el bump dejó de ser una casilla de texto: lleva miniatura de 46 px, badge «Recomendado para regalo» y la línea «Bolsa, caja, saquito y tarjeta», con la misma gramática que una pieza del carrito. La descripción decía «Caja, bolsa y tarjeta» y se quedaba corta: el propietario confirmó que todo lo que sale en la foto es lo que recibe la clienta por los $40.000, y ahí va también el saquito. De las dos fotos de empaque se eligió la del lazo rosa: a 46 px la otra es una mancha blanca, y esta además enseña el saquito y la pieza dentro de la caja. En el resumen del checkout el empaque deja de ser la excepción sin foto —se le quitó el `l.id==='empaque'?null:`— y entra por el camino normal. Sigue en pie la nota del precio: el problema del bump probablemente no es el diseño sino que $40.000 sobre un brazalete de $58.000 es un 69% adicional; antes de rediseñarlo otra vez, probar bajarlo |
| **Logos de medios de pago** al pie del carrito | Los **archivos oficiales** de cada marca. Visa, Mastercard, Nequi, Bancolombia y Daviplata son marcas registradas con guías de uso; no se dibujan aproximaciones |
| Micro-leyenda de confianza | **Hecha y cerrada.** Bajo el botón de pagar del carrito sale *«Pago procesado por Wompi (Bancolombia)»*, la misma frase que el pie del checkout. **Lo del retracto se descartó por decisión del propietario**, que lo resolvió por otra vía: no va en la leyenda ni en la página, y no hay nada más que hacer ahí. (Había además un motivo para no ponerlo: la política de devoluciones recoge la excepción del artículo 47 para bienes claramente personalizados, y el titular de la tienda es «Personalización total») |

### 5b · Lo que está esperando algo del propietario

Ninguna de estas se puede resolver desde el repo: o se comprueban en un panel
al que solo entra él, o son decisiones de negocio que arrancan con él. Se
juntan aquí para que quien retome no las tenga que ir pescando por el
documento.

**Comprobaciones** (todo el código está desplegado; falta mirar que haya
quedado bien):

- [x] Que el despliegue diga el número correcto de functions. **Comprobado el
      2026-08-20**: el despliegue `c7942f0` reporta **9 functions** —las 8 de
      entonces más `_hoja`— y `crear-pago`/`wompi-webhook` pesan ~385 KB, o sea
      que `@netlify/blobs` entró. Ver *Al desplegar*.
- [x] **Que Netlify registre el `schedule` del rescate. Comprobado**: el
      despliegue lo reporta como `{"cron":"0 14 * * *","name":"rescate"}`, que
      son las 9:00 de Colombia. Queda ver una ejecución real con pedidos
      dentro. No hay que esperar a
      mañana: se fuerza desde Functions → `rescate` en el panel.
- [ ] Que el **`Purchase` salga una sola vez** por compra en Events Manager —
      es lo que confirma la deduplicación navegador/servidor— y **quitar
      `META_TEST_EVENT_CODE`** al terminar (§ 4a).
- [ ] **Despachar el pedido pendiente y reponer `stock.json`.** Al cambiar el
      campo `generado`, lo vendido vuelve a cero solo (§ 4b).

**Decisiones:**

- **Precio del Empaque Premium.** Los $40.000 sobre un brazalete de $58.000 son
  un 69% adicional; la hipótesis es que el bump no convierte por precio y no
  por diseño (§ 5).
- **Venta sugerida de brazalete.** Proponer el brazalete a quien lleva charms
  sueltos. Sin decidir: si va, dónde va y con qué texto. Cuidado con dónde —
  la tabla de decisiones ya explica por qué en el carrito no se mete nada que
  compita con el botón de pagar.
- **GitHub Actions como puerta de despliegue.** Hoy las pruebas avisan pero no
  bloquean. Convertirlas en puerta exige apagar el despliegue automático en
  Netlify y desplegar desde el flujo con un `NETLIFY_AUTH_TOKEN` (ver *Cómo
  comprobar que nada se rompió*).
- **Addi.** No lo activa Wompi: es integración propia contra Addi, un frente
  nuevo entero. Aplazado; mientras tanto se mide por WhatsApp con
  `data-wa="pagos"`, y ese dato es justamente con el que decidir (§ 4).

### 5c · Conversión: lo que se montó y por qué

Primer tramo del trabajo de conversión. La decisión de fondo la tomó el
propietario: **la venta se cierra en el checkout de la web, no por WhatsApp** —
por WhatsApp se estaban cayendo—. Todo lo de abajo sale de ahí.

- **El CTA del hero es «Armar mi pulsera», no WhatsApp.** Antes el botón grande
  sacaba a la clienta de la página hacia una conversación que hay que atender a
  mano. WhatsApp sigue, en secundario y como *asesoría*. Conserva su `data-wa`,
  así que la medición del salto al chat no cambió.
- **Venta cruzada al fijar el brazalete** (`#xs`). La promo «brazalete + 3
  charms = 30%» estaba anunciada arriba en una tarjeta y no en el momento de
  decidir. Ahora aparece al confirmar la talla y **se apaga sola al llegar a 3
  charms**, que es donde el 30% ya está activo. La cifra que muestra es el
  descuento que gana sobre lo que **ya lleva** —misma disciplina que
  `#desc-nota`—, nunca una rebaja del total: el charm que añada lo paga.
- **El envío gratis salió a la barra fija.** Falta y barra de progreso en el
  dock. Antes el umbral solo lo veía quien abría el detalle; el resto armaba sin
  saber que le faltaban $20.000 para no pagar envío.
- **Casilla de consentimiento en el checkout** (`#optin`), sin marcar y
  opcional. Es el requisito que faltaba para poder automatizar la recuperación
  de carritos escribiéndole **a la clienta**: bajo la Ley 1581 la finalidad que
  autorizó esos datos era la compra. Viaja con el pedido, la guarda el registro
  —que ya lleva fecha, o sea prueba de cuándo se dio— y el correo diario de
  `rescate` marca quién autorizó.

> **El permiso solo se concede con un booleano `true`.** `crear-pago` es un
> endpoint público: `optin: "false"`, `1` o `"no"` son valores que en JavaScript
> pasan por verdaderos y fabricarían una autorización que nadie dio.
> `pruebas/checkout.js` lo vigila.

**El fallo mudo de este tramo, para la colección:** el aviso de venta cruzada se
oculta con `[hidden]`, pero tenía `display:flex` propio y el display gana. Nació
visible y **vacío** antes de elegir brazalete, y no se iba al llegar a 3 charms.
Ni un error en consola. Lo cazó recorrer el flujo en el navegador, no las
pruebas que ya existían. Está resuelto con `.xs[hidden]{display:none}` —igual
que `.pc[hidden]` y `.tallas[hidden]`— y cubierto por `pruebas/regresion.js` § 6.

> **Y tres pruebas estaban clavadas al estilo en vez de a la regla.** Al pasar
> el CTA del hero a secundario, `regresion.js` seguía midiendo `a.btn--wa`: se
> fue a un botón verde a 1.900 px de scroll y dio «FUERA» con el hero intacto.
> Otra buscaba el píxel por `a.btn--wa[data-wa="hero"]` en vez de por `data-wa`.
> Y la nueva usaba `:not([disabled])` para las tallas cuando el bloqueo real de
> la página es `aria-disabled` — elegía una talla agotada y salía un rojo que no
> era del sitio. Las tres ahora apuntan a la regla: *el CTA principal cae sobre
> el pliegue*, *el salto a WhatsApp mide*, *la talla libre confirma*.

**Segundo tramo (22 de agosto).** Tres cosas más, todas dentro del checkout:

- **El catálogo completo ya no vive detrás de un botón**, y el paso de entrega
  sugiere piezas de las mismas categorías que las que ya lleva («Te puede
  interesar»). Nunca ofrece lo agotado —mandarla a un 409 en la pantalla de
  pago es el peor sitio para descubrirlo— ni las iniciales, que se eligen a
  propósito y no se sugieren.
- **El bump del Empaque Premium, en el paso de pago y antes de la casilla de
  términos.** Ese orden no es estético: aceptar los términos es la última
  puerta antes de pagar, y meter una oferta entre el consentimiento y el botón
  añade un artículo al pedido después de que la clienta ya aceptó.
  `pruebas/checkout.js` § 2b comprueba el orden, no solo que el bump exista.
  Va **sin foto a propósito** (§ 5) y diciendo lo que la página nunca decía:
  que el **empaque de regalo normal ya va incluido y sin costo**, y qué suma
  el Premium encima. Ver «+$40.000» sin saber qué se compra que no se tenga ya
  gratis explica su conversión mejor que la falta de foto.

  **El contenido lo dio el propietario el 2026-08-22, y son dos cajas
  distintas**, así que el texto se escribe desde el carrito y no está fijo en
  el HTML: prometer la caja que no es se descubre al abrir el paquete.

  | Lo que lleva el pedido | Lo que anuncia el bump |
  |---|---|
  | Brazalete o pulsera | Caja grande de dos piezas a la medida del brazalete, bolsita de tela guardapolvo, bolsa de regalo con cinta, folleto y la tarjeta con la dedicatoria |
  | Solo charms | Caja pequeña, bolsa de regalo y la tarjeta con la dedicatoria |

  > **De la lista del propietario se dejó fuera la «tarjeta de postventa»**, que
  > el empaque de brazalete sí trae. Las fotos de ese empaque enseñan que la
  > tarjeta es **de Pandora**: anunciarla aquí afirma que el pedido llega con
  > respaldo de posventa de otra marca, que es exactamente lo que se decidió no
  > decir con la foto (§ 1). No es un olvido; si algún día el empaque lleva
  > tarjeta propia, entra sola.

  Un precio y dos cajas: hoy los $40.000 cubren la que corresponda al pedido.
  Si el costo de las dos no es parecido, eso es una decisión de precio que no
  se toma desde el repo.
- **Validación en vivo en el paso 1.** Antes el error solo salía al pulsar
  «Continuar»: se podía escribir mal el correo arriba del todo y enterarse
  nueve campos más abajo. Ahora cada campo habla cuando la clienta termina con
  él, con tres reglas que separan el aviso útil del regaño:

  | Cuándo | Qué hace | Por qué |
  |---|---|---|
  | Al salir del campo (`blur`) | Marca si lo escrito está mal | Marcar «correo inválido» en la primera letra es regañar a quien va por la mitad |
  | Al salir de un campo **vacío** | No marca nada | Dejarlo para después es legítimo; de lo que falta ya avisa «Continuar» |
  | Mientras escribe, **ya marcado** | Quita el rojo en cuanto queda bien | Corregir y seguir viendo rojo es la otra forma de mentirle |

  Las reglas viven en un solo sitio (`REGLAS` en `checkout.html`): las usa el
  aviso en vivo y las usa el «Continuar», que sigue siendo la red de seguridad
  de lo que quedó vacío. Dos listas separadas acabarían diciendo cosas
  distintas del mismo campo. De paso, el campo mal llenado ahora lleva
  `aria-invalid` y su mensaje colgado con `aria-describedby`: el borde rojo
  solo existe para quien lo ve.

**Reseñas con foto de clienta — intentado y retirado (22 de agosto).** El
propietario pasó cinco capturas de historias con conversaciones de WhatsApp y
DM, todas autorizadas por las clientas y con nombre. De ahí salieron tres
reseñas nuevas más una cuarta, y la foto de una clienta que etiquetó a la
tienda. **Se publicaron y se quitaron el mismo día: la calidad no daba.**

Las fotos venían de chat, o sea comprimidas dos veces, y salían entre 379 y 646
px de ancho. En la captura de revisión pasaban; en la página, al lado de las
fotos de catálogo, se veían blandas. **Y eso se podía saber antes de
publicar:** estaban a la vista y se dieron por buenas igual. Para la próxima
tanda, el listón es el que ya tienen las reseñas viejas — foto que aguante los
~380 px de la tarjeta sin verse lavada—, y se compara contra una de esas antes
de montarla, no después.

Lo que sí quedó aprendido, y vale para las fotos que vengan:

- **La captura no se publica, se recorta.** El pantallazo trae la interfaz de
  WhatsApp, la foto de perfil de la clienta y, en una, la línea del `+57`. Lo
  autorizado es que salga su foto, no su conversación. Las cinco capturas se
  quitaron de `assets/` —donde estaban públicas— y viven solo en el historial.
- **Sin cita inventada.** Una de las clientas no escribió reseña: publicó la
  pulsera puesta y etiquetó a la tienda. Su foto fue bajo la línea que ya
  prometía eso («Etiquétanos y aparece aquí»), acreditada con su `@`, y no como
  una reseña con palabras que nadie dijo.
- **Dos clientas con el mismo nombre de pila no se distinguen inventándoles
  apellido.** Había ya una «Adriana M.» de Bogotá y llegó otra Adriana de
  Bogotá; la nueva entró sin inicial.
- La marcación de una tarjeta de reseña se saca de las que ya existen
  (estrellas, etiqueta «Foto de la clienta»), no se reescribe a mano.

> **El empaque de Pandora en las fotos de reseña sí va, y es decisión del
> propietario (2026-08-22): es el empaque que la tienda vende, con permiso.**
> Queda escrito para que otra sesión no lo lea como un descuido y lo quite. Lo
> que sigue en pie es la frontera del § 5c: el permiso es sobre el **empaque**,
> no sobre prometer **posventa** de otra marca — por eso la «tarjeta de
> postventa» sigue fuera del texto del bump.

### 6 · «A veces se borran las joyas» — cerrado

Ya no es un misterio, y **la causa no era la que se estaba persiguiendo**. La
pista que faltaba la dio el propietario: *«llega un momento en el que disminuye
mucho el área de selecciones»*, con una captura de la tienda en producción.

**Las joyas nunca se borraron.** En esa captura el resumen dice «3 charms ·
$255.000» mientras en pantalla solo asoma una pieza, cortada a la mitad. El dato
estaba íntegro; lo que se encogió fue la ventana por la que se veía.

La causa, en el carrito viejo:

```
.sheet-body{overflow-y:auto; flex:1 1 auto}   ← única zona con scroll
.sheet-tot {flex:0 0 auto}                     ← empaque, pago, subtotales,
                                                  total, dos botones y la nota
```

Todo el bloque de abajo era fijo. A medida que creció —y creció mucho al sumarle
las opciones de pago y el desglose— le comió la altura a la lista hasta dejarla
en unos 65 px: con cuatro piezas se veía una. En un teléfono, la clienta llegaba
a pagar $200.000 sin poder ver qué llevaba.

**Arreglado en `5858207`.** La hoja tiene ahora *una sola zona que rueda*
(`.sheet-scroll`) con la lista **y** los extras dentro; abajo queda fijo solo lo
que decide la compra: total y botón de pagar. Y `.sheet-body` lleva
`min-height:96px` para que la lista no pueda volver a colapsar.

> **La lección.** Las tres protecciones de persistencia que se escribieron antes
> —no guardar en el primer render, releer en `pageshow`, sincronizar por el
> evento `storage`— se construyeron sobre la hipótesis de que el carrito se
> estaba vaciando. Era falsa. Se quedan porque valen por sí solas, pero no eran
> esto. El síntoma que describió el usuario («desaparecen») se tradujo demasiado
> rápido a una causa técnica («se borra el estado») sin preguntar antes qué se
> veía en pantalla. Una captura habría ahorrado el rodeo entero.

**Confirmado en producción por el propietario.** El caso está cerrado.

### 7 · `anular-venta.mjs` no corrige el `Purchase` que ya salió a Meta — baja prioridad

**Detectado el 2026-09-18, al revisar el embudo real contra Meta Ads.**
`crear-pago.mjs` manda el `Purchase` de un pedido contraentrega **al crearse**,
no al confirmarse el pago (ver la cabecera de esa función y de `_meta.js`): es
una decisión ya tomada, no un bug, porque hay un pedido en firme que se
despacha. `anular-venta.mjs` sabe deshacer esa venta —devuelve el inventario y
marca el pedido `cancelado`— pero **no manda nada a Meta**: el `Purchase` que ya
salió se queda como si la venta hubiera ocurrido.

**Por qué es baja prioridad y no se arregla ahora:** el propietario confirma
que el rastreo real (vía Interrápidísimo y otras transportadoras) muestra que
la inmensa mayoría de los contraentrega sí se pagan, y en lo corrido solo hubo
**una cancelación, y ni siquiera llegó a enviarse** — cero devoluciones después
de despacho. Con ese historial, el sobreconteo es teórico, no un problema
medido. Además el evento va al pixel nuevo (`1029982529813994`), que **hoy no
alimenta ninguna campaña activa** — las campañas leen del pixel viejo
(`2130673404542988`). Importará más el día que el portafolio madure y se
comparta el pixel nuevo con la cuenta de anuncios (ver § Meta Ads de
`CLAUDE.md`).

**Si se retoma:** decidir el mecanismo antes de tocar código — no hay hoy forma
de saber, sin mirar la transportadora a mano, cuáles contraentrega se pagaron
de verdad, así que "esperar confirmación de pago" para mandar el `Purchase`
exigiría antes construir esa confirmación (integración con el rastreo, o un
paso manual). Alternativa más barata: que `anular-venta.mjs` mande una
corrección o un evento de reversa a Meta cuando se aplique — no investigado
todavía cuál soporta mejor la Conversions API de Meta.

---

## Decisiones que no hay que deshacer sin darse cuenta

| Decisión | Por qué |
|---|---|
| Los **charms son Plata 925**; solo los **brazaletes** son latón con baño de plata y e-coating | Describir un charm como enchapado es publicidad engañosa sobre el producto de más margen. Ya se coló una vez en un texto entregado y hubo que corregirlo antes de publicar. Hay un `grep` que lo vigila (ver `pruebas/README.md`) |
| La **Plata 925 sí se oxida** sola, y la página lo dice de frente | Prometer lo contrario fabrica un reclamo a los tres meses. Además vende mejor: la plata que se oscurece es la plata de verdad |
| El umbral de **envío gratis mide mercancía, no total** | Si contara el total, el propio envío ayudaría a alcanzarlo y un pedido de $156.400 saldría "gratis" por sumarle $25.000 de envío |
| **`InitiateCheckout`** en cada clic a WhatsApp; **`Lead`** solo en el pedido armado | El checkout ocurre fuera del sitio, así que el salto al chat es lo último medible. Abrir el detalle del pedido dejó de dispararlo para no contar doble |
| **`stock.json` es dato, no código** | Actualizar disponibilidad no debe obligar a tocar el HTML. Y si el fetch falla, la página vende como antes de que existiera: una caída de red no puede bloquear una venta |
| Las **cinco páginas de información no se editan a mano** | Las genera `herramientas/gen_paginas.py`. Editarlas directo las desincroniza entre sí y el próximo `python3 herramientas/gen_paginas.py` pisa el cambio |
| Las tres **piezas sin foto no están escondidas** | Tienen stock real: ocultarlas es dejar de vender inventario que existe, que es justo el problema que las trajo al catálogo |
| Los **agotados tampoco se esconden** | Salen en gris con "Pedir por encargo", que manda a WhatsApp con el nombre de la pieza. La venta no se pierde, se mueve al chat |
| Las etiquetas de urgencia solo con **1 o 2 unidades reales** | No se inventa escasez donde no la hay |
| El aviso del **siguiente tramo de descuento** dice lo que baja sobre lo que YA lleva, y nunca que el total baje | Porque el total no baja: el charm que añada lo paga. La cifra que se muestra —lo que aumenta el descuento sobre las piezas ya elegidas— es comprobable en el propio resumen del carrito. Prometer un ahorro que no existe es de la misma familia que inventar escasez, y se descubre en la pantalla de pago. `pruebas/precios.js` comprueba la cifra en los 40 carritos al azar |
| El **total a cobrar lo calcula el servidor**, nunca el navegador | El monto que viaja por el cliente se puede alterar desde la consola. `crear-pago` solo acepta identificadores y recalcula; `pruebas/precios.js` vigila que ambas calculadoras coincidan |
| Al cambiar un precio, **correr `herramientas/extraer_catalogo.py`** | El checkout y el servidor leen `assets/catalogo.json`, que se genera desde index.html. Si se olvida, la batería `precios` sale en rojo |
| El **webhook de Wompi verifica la firma** de cada evento | Su URL es pública: sin verificación, cualquiera manda un POST diciendo «pagado» |
| `Purchase` **solo con estado APPROVED consultado a la API** de Wompi | Dispararlo por un parámetro de URL regalaría una página de «pagado» y ensuciaría la optimización de campañas |
| El **envío gratis es solo del pago anticipado** | La contraentrega cuesta comisión de recaudo y riesgo de devolución: regalarle el envío es subsidiar la opción más cara. Lo delicado no es la regla sino no prometerla y quitarla al final — por eso cada opción muestra su costo antes de elegir, y quien ya pasó el umbral con contraentrega ve por qué y un botón que aplica el cambio |
| La **acción principal de la página es armar y comprar**; WhatsApp es asesoría | Decisión del propietario: por WhatsApp se estaban cayendo las ventas. Un CTA principal que saca a la clienta a un chat convierte la compra en una conversación que hay que atender a mano, y depende de que alguien responda. WhatsApp no se quita —rescata cuando hay dudas o el pago falla— pero deja de ser la vía por defecto. `pruebas/regresion.js` § 1 comprueba que el CTA principal caiga sobre el pliegue, sin nombrar su estilo |
| El aviso de venta cruzada **se apaga al llegar a 3 charms** | En 3 ya está activo el 30% del brazalete y el 15% de los charms: seguir empujando después es pedir por pedir, y un aviso que no se calla nunca se deja de leer. Y la cifra es siempre el descuento sobre lo que **ya lleva**, nunca una rebaja del total |
| La **autorización de comunicaciones va sin marcar y no condiciona la compra** | Una casilla premarcada no es consentimiento, y condicionar la venta a aceptarla tampoco. Es lo que separa poder escribirle después por una promo de solo poder responder por su pedido |
| **No hay salida a WhatsApp en el carrito** | A esa altura la clienta ya decidió comprar; una opción de menor compromiso pegada al botón de pagar se come checkouts terminados en vez de sumar pedidos. WhatsApp sigue en el resto de la página y en el checkout **si el pago falla**, que es donde rescata una venta en vez de robarla |
| Los **medios de pago anunciados son los que Wompi tiene habilitados** | Se sacan de `accepted_payment_methods` de su API. Prometer uno que la pasarela no ofrece se descubre con la clienta ya decidida, buscando un botón que no existe. Por eso Addi salió del checkout y quedó como opción por WhatsApp |
| El correo de la tienda es una **hoja de despacho**, no una copia del recibo | Los dos tienen trabajos distintos, y compartir plantilla costó un pedido: las indicaciones de entrega no se imprimían en ninguna parte. Lo que se lee al empacar abre por lo que se pierde si se lee en diagonal —indicaciones y dedicatoria— y lleva documento y unidades, que el recibo no necesita |
| **Ningún dato que la clienta escriba puede quedarse sin imprimir** | Es la regla, y `pruebas/correo-tienda.js` la comprueba sin nombrar campos: los saca de lo que acepta `crear-pago` y de los `name=` del formulario. Un campo nuevo queda vigilado solo; olvidar la plantilla sale en rojo en vez de descubrirse con un paquete perdido |
| Los **correos no pueden tumbar una venta** | Sin `RESEND_API_KEY` no se manda nada y el pedido sigue; si Resend falla, se registra y el cobro continúa. Perder un comprobante es molesto; perder una compra cobrada porque el proveedor de correo estaba lento, no |
| El **«Pago recibido» sale del webhook**, no de `gracias.html` | La clienta puede cerrar el navegador antes de volver, y el pago fue bueno igual |
| La comprobación de inventario **falla hacia adelante** | Solo bloquea con un dato claro de que no hay. Si `stock.json` no se puede leer, la venta pasa: una lectura fallida no puede costar una compra buena |
| `crear-pago` y `wompi-webhook` son **funciones v2** (`export default`, en `.mjs`) | No es estilo: Netlify solo inyecta `NETLIFY_BLOBS_CONTEXT` en v2, y sin esa variable `getStore()` lanza y la reserva de inventario se cae al camino de emergencia — la tienda vende, nada se rompe, y no se aparta nada. Ya pasó: estuvo así en producción una jornada entera y se detectó leyendo el log, no porque algo fallara. `pruebas/inventario.js` § 6 lo vigila. Los módulos auxiliares siguen en CommonJS porque no hacía falta tocarlos |
| Ahora **sí hay `package.json` en la raíz** | `pruebas/package.json` explica que no lo había a propósito, para que Netlify no instalara dependencias. Esa decisión se tomó con cero dependencias; la reserva necesita `@netlify/blobs` **dentro de las funciones**, y sin declararla el bundler no la incluye, las funciones se caen al arrancar y el sitio deja de cobrar. Sigue sin haber comando de build (`command = ""`): lo único que cambia es que Netlify instala esa dependencia antes de empaquetar |
| Las pruebas **no clavan datos del catálogo**: los leen de `stock.json` o los miden en pantalla | Al retirar tres piezas duplicadas, dos baterías se pusieron rojas con la página en lo cierto: una esperaba «77 tarjetas» y otra nombraba `elsa` entre los agotados. Un número o un id escrito a mano convierte cada cambio de catálogo en una falla falsa, y las fallas falsas enseñan a ignorar el rojo. Lo que hay que comprobar es la regla —que al limpiar la búsqueda vuelvan **todas**, que un agotado salga en gris y bloqueado—, no una cifra concreta. **Y vale para las piezas, no solo para las cifras:** seis baterías tenían clavado `pulsera-avengers` como brazalete de prueba, y al venderse su última unidad (2026-08-22) media suite se puso roja con el servidor haciendo lo correcto —rechazar un agotado—. Ahora la pieza se elige del inventario en `pruebas/_pieza.js` |
| La reserva de inventario **se prueba con latencia** | `pruebas/inventario.js` mete demora en el almacén falso para que las dos lecturas ocurran antes de cualquier escritura. Sin eso, las dos operaciones corren una tras otra, la prueba pasa, y no ha probado nada — el mismo error que dio verde a un pago que no cobraba |
| La **verificación del comercio en Wompi** también falla hacia adelante | Solo bloquea con un 404 explícito. Existe porque una llave mal transcrita mandaba a todas las clientas a una pantalla de error sin retorno |

---

## Cómo comprobar que nada se rompió

```sh
./pruebas/correr.sh
```

Diez baterías: los bugs de la auditoría inicial y la venta cruzada, en un
navegador real; disponibilidad y tallas; la calculadora, la ficha y el buscador;
que el servidor cobre lo mismo que promete la página en 40 carritos al azar; la
reserva de inventario, el registro de pedidos y el rescate de abandonados; que
la hoja de despacho imprima **todo** lo que la clienta escribió; el `Purchase` a
Meta; y la compra completa de punta a punta, ejecutando las funciones de Netlify
reales dentro de Node. Sale con código 1 si algo queda en rojo. Detalle en
[`pruebas/README.md`](pruebas/README.md), incluidas dos comprobaciones de texto
por `grep` que no están automatizadas.

Desde ahora **corren solas en cada push**, con GitHub Actions
(`.github/workflows/pruebas.yml`). El repo es público, así que esos minutos son
gratis e ilimitados y no tienen nada que ver con los créditos de Netlify.

Ojo con lo que ese flujo **no** hace: avisa, no bloquea. Netlify publica igual
cuando llega el push, porque el despliegue lo dispara el repositorio y no
Actions. Para que las pruebas fueran una puerta de verdad habría que apagar el
despliegue automático en Netlify y desplegar desde el flujo con un
`NETLIFY_AUTH_TOKEN` en los secrets de GitHub. Es una decisión del propietario y
no hace falta para tener el aviso.

Si una prueba falla, **mira primero si el error está en la prueba**. Ya pasó
cuatro veces, y las cuatro la página tenía razón:

- Una aserción esperaba 13 charms de Disney cuando en pantalla hay 15.
- Otra daba por hecho que dos charms de $85.000 suman $170.000, sin restar el
  descuento por cantidad.
- Los carritos generados pedían más unidades de las que hay en inventario, o no
  elegían talla —y «Elegir» en un brazalete no lo mete al carrito: abre el
  selector, y lo que confirma la pieza es tocar la talla—.
- Las fixtures pedían la talla 18 de `pulsera-avengers`, que solo tiene la 20.

**Pero una vez fue al revés y conviene recordarlo**: la batería del checkout dio
verde a un pago que en producción no cobraba. Comprobaba que los campos del
formulario estuvieran bien armados, pero no *por dónde viajaban* — iban por POST
y Wompi los lee de la URL. Una prueba que solo mira el contenido y no el
mecanismo puede estar certificando nada.

---

## Al desplegar

> **Último despliegue: `4e89afe` (2026-08-28, 12:18 UTC) — 14 functions, 12
> redirecciones, escaneo de secretos limpio.** Trajo la fundación de conversión:
> `reanudar`, `armar-carrito`, `_carrito`, el rescate que le escribe sola a quien
> autorizó, y el carrito por URL en las dos páginas. Comprobado en vivo:
> `/armar-carrito` responde `{"error":"Solo POST"}` y `/reanudar` sin `ref`
> redirige a la tienda.
>
> **Y una trampa que costó una ronda:** esa sesión clonó
> `claude/zephora-charms-automation-rzbthc`, cuyo `CLAUDE.md` era de cinco días
> antes y todavía decía que la rama publicada era
> `claude/install-frontend-design-skill-8t655e`. Se mezcló ahí, se anunció como
> desplegado, y no había salido nada al aire: `main` iba 70 commits por delante.
> **El contenedor clona un punto, no la verdad**: `git fetch --all` y mirar
> `origin/main` antes de dar por buena cualquier instrucción sobre ramas, aunque
> venga del propio `CLAUDE.md`.

**Ya no se arrastra nada.** El repo está conectado a Netlify y **cada push a
`main` publica** (antes era `claude/install-frontend-design-skill-8t655e`; ver
*Consolidación*, arriba: empujar ahí ya no saca nada al aire). `netlify.toml` trae
publicación, funciones, redirecciones y cabeceras.

Recordar que **cada publicación cuesta ~15 créditos**, así que conviene juntar
cambios en vez de empujar de a uno (ver el bloque de arriba).

También se puede publicar a mano con `npx netlify-cli deploy --prod`, pero
**mejor que sea el recurso de emergencia y no la costumbre.** El CLI sube *el
directorio donde uno está parado*, sin preguntar: ya pasó que un repo
descomprimido dejó una carpeta anidada dentro y se publicó **una copia completa
de la tienda** colgando de `/proyecto-1-claude-install-frontend-design-skill-8t655e/`.
Por esa ruta se saltaban todos los bloqueos —`/pruebas/`, `/herramientas/`,
`ESTADO.md`— porque las reglas apuntan a la raíz. El siguiente despliegue desde
git lo borró solo, porque cada despliegue es una instantánea completa.

En la salida de cualquier despliegue hay que confirmar que diga **14 functions**
(`crear-pago`, `wompi-webhook`, `_correo`, `_precios`, `_inventario`, `_meta`,
`_pedidos`, `_hoja`, `_atribucion`, `_carrito`, `rescate`, `disponibilidad`,
`reanudar`, `armar-carrito`);
si no salen, el sitio queda sin cobrar y hay que restaurar el despliegue
anterior.

> **Este número sube cada vez que se añade un módulo a `netlify/functions/`, y
> hay que actualizarlo aquí el mismo día.** Eran 8 hasta que entró `_hoja.mjs`,
> 9 hasta que la consolidación trajo `_atribucion.mjs` y `disponibilidad.mjs`
> —el despliegue `6a88fa3a` reportó 11—, y 14 desde que la fundación de
> conversión trajo `reanudar.mjs`, `armar-carrito.mjs` y `_carrito.mjs`.
> Una cifra vieja en esta comprobación es peor que no tenerla: la próxima
> persona ve «9» donde el documento pide «8», da por bueno el desajuste, y la
> comprobación deja de servir justo para lo que existe — detectar que las
> funciones no se empaquetaron y el sitio quedó sin cobrar.

Y que `crear-pago` y `wompi-webhook` pesen ~306 KB, no ~295 KB: esos ~11 KB de
diferencia son `@netlify/blobs` empaquetado. Si vuelven al tamaño de antes, la
dependencia no entró y la tienda está vendiendo sin reservar —seguirá cobrando,
porque eso falla hacia adelante, pero la carrera de la última unidad estaría
otra vez abierta y nadie se enteraría—.

**La comprobación que de verdad cierra el caso está en el log**, no en la
salida del despliegue: el evento `pedido_creado` de `crear-pago` trae un campo
`reserva`. `reservado` es lo bueno; `sin-almacen` significa que se está
vendiendo sin apartar nada.

Netlify Drop **no sirve** desde que existen las funciones: sube archivos
estáticos y no monta `netlify/functions/`, así que un sitio soltado a mano
queda sin cobrar. Si hace falta desplegar a mano, es con la CLI
(`netlify deploy --prod`), que sí las empaqueta.

> El dominio `zephoracharms.com` lo sirve el proyecto de Netlify
> **`fanciful-trifle-64ca74`**. Los proyectos llamados `zephoracharms` y
> `zephora-charms` solo tienen URL `.netlify.app`: desplegar en el equivocado
> "funciona" sin cambiar nada de lo que ve el público.

Las variables de entorno (llaves de Wompi, Resend) viven **solo** en Netlify,
nunca en el repo. La lista completa, en la sección *Cobrar en la web* del README.

Al tocar el píxel, verificar en **Events Manager → Probar eventos** antes de dar
el cambio por bueno.
