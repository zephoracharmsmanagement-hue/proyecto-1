# Zephora Charms

Sitio de [zephoracharms.com](https://zephoracharms.com/) — joyería con significado: charms en Plata 925 y brazaletes con baño de plata, compatibles con Pandora. Envíos a toda Colombia.

## Estructura

| Archivo | Qué es |
|---|---|
| `index.html` | La tienda: markup, estilos y scripts. Sin build ni dependencias. |
| `legal.css` | Estilos de las cinco páginas de información, que la comparten. |
| `preguntas-frecuentes.html` | FAQ desplegable, con datos estructurados `FAQPage`. |
| `envios-y-devoluciones.html` | Cobertura, costos, retracto (5 días hábiles) y garantía. |
| `politica-de-privacidad.html` | Tratamiento de datos según Ley 1581 de 2012. |
| `terminos-y-condiciones.html` | Condiciones de compra según Ley 1480 de 2011. |
| `politica-de-cookies.html` | Qué instala el sitio y cómo desactivarlo. |
| `assets/stock.json` | El inventario que lee la página: unidades por charm y tallas por brazalete. |
| `assets/` | Las imágenes del sitio. |
| `skills-lock.json` | Skills instaladas en el proyecto (fuente + hash). |
| `.claude/skills/` | Agent Skills disponibles al trabajar en este repo. |

Las cinco páginas de información **no se editan a mano**: las genera
`herramientas/gen_paginas.py` desde un shell común, para que cabecera, pie y
`<head>` no se desincronicen entre sí. Se toca el generador y se ejecuta:

```
python3 herramientas/gen_paginas.py
```

El responsable se identifica como **Zephora Charms, NIT 1.019.151.696-3, tienda
virtual con operación en Bogotá D.C.**

Los canales publicados son WhatsApp +57 301 899 0672 y `zephoracharms@gmail.com`.

> **Pendiente:** por decisión del propietario no se publica domicilio. El artículo
> 50 de la Ley 1480 de 2011 pide una *dirección de notificación judicial* en
> comercio electrónico, así que ese punto queda descubierto; las políticas señalan
> WhatsApp y el correo como canales oficiales de notificación al consumidor.

Las imágenes vivían incrustadas en el HTML como data URIs en base64, lo que hacía el archivo portable pero pesado: 2.5 MB, de los cuales 2.4 MB eran imágenes. Peor todavía, `loading="lazy"` no hace nada sobre un data URI —los bytes ya viajan dentro del HTML—, así que cada visitante descargaba las 109 imágenes antes de ver nada.

Ahora son archivos externos y el HTML pesa 115 KB. El navegador pide solo la imagen del hero al cargar y el resto conforme aparecen en pantalla.

## Tallas y capacidad

La calculadora de `index.html#talla` no adivina: aplica las reglas del negocio.
El cliente escribe su muñeca ajustada y se calcula el **margen** para cada talla.

```
margen = talla − muñeca
```

| Margen | Qué pasa | Capacidad |
|---|---|---|
| ≥ 3 cm | Llena completa, cae suelta. La ideal si va a usar muranos | 15–20 charms |
| 2 a 3 cm | **La recomendada.** Llena completa, justa y cómoda | 15–20 charms |
| 1 a 2 cm | Sirve con pocos charms; si la llena más, aprieta | 5–8 charms |
| < 1 cm | No recomendable: apretada aun sin charms, o no cierra | — |

Son tramos, no igualdades: una muñeca de 16,5 cm da márgenes fraccionarios.

**Los +2 cm no son sobrante.** Al llenarse de charms, el grosor de las piezas se
come unos 2 cm del diámetro interior útil de la cadena. Ese es el argumento que la
página explica y que evita la mitad de las consultas de talla.

## Familias de pieza

Cada charm lleva `familia` en `assets/stock.json` —dato, no código, para poder
corregir una clasificación sin tocar el HTML—. De ahí salen las dos medidas que
muestra la ficha de producto, que son distintas: lo que **mide** la pieza y lo que
**ocupa** de cadena, que es lo que determina cuántos charms caben.

| Familia | Piezas | Mide | Ocupa |
|---|---:|---|---|
| `pasador` | 79 | 0,8–1,2 cm | 8–10 mm |
| `colgante` | 24 | 1,5–2,5 cm de largo | 4–6 mm en el aro |
| `murano` | 4 | 0,9–1,1 cm | 9–11 mm |
| `clip` | 4 | 0,5–0,9 cm | 4–6 mm |
| `cadena` | 3 | — | 4–5 mm por aro |

Son **promedios por familia**, y la ficha lo dice: no hay medición pieza a pieza.

> **Materiales — no mezclar.** Los charms son **Plata 925**; solo los **brazaletes**
> son latón con baño de plata y e-coating. Ambos, libres de níquel y plomo.
> Describir un charm como enchapado es publicidad engañosa sobre el producto que
> más margen deja. Hay una comprobación por `grep` en la verificación para eso.

## Envío

Tarifa plana nacional, sin cotizar por ciudad:

| Forma de pago | Envío |
|---|---|
| Anticipado | $15.000 |
| Contraentrega | $25.000 — la transportadora cobra por recaudar |
| Cualquiera, desde $180.000 de mercancía | Gratis |

El costo **se suma al total** que ve la clienta, así que lo que muestra la página
es lo que paga. El umbral de envío gratis se mide sobre la mercancía y no sobre el
total: si contara el total, el propio envío ayudaría a alcanzarlo.

Al cambiar estas tarifas hay que tocar `ENVIO` en `index.html` **y** la copia en
tres sitios que las repiten: la barra de avisos, la franja de beneficios y la de
garantías, más `envios-y-devoluciones.html` y `preguntas-frecuentes.html`.

## Inventario

`assets/stock.json` se regenera desde el Excel cuando cambia el stock. **No vive
dentro de `index.html` a propósito:** actualizar disponibilidad no debe requerir
tocar código. Sus claves son los mismos `id` que usa `DATA`.

```json
"ariel":                { "tipo": "charm",   "precio": 85000, "stock": 2 },
"pulsera-corazon-liso": { "tipo": "pulsera", "precio": 58000,
                          "tallas": { "17": 2, "18": 2, "19": 2, "20": 2 } }
```

Qué hace la página con eso:

| Situación | Qué ve la clienta |
|---|---|
| Charm con 0 unidades | Foto en gris, etiqueta "Agotado", botón bloqueado y enlace **Pedir por encargo** que abre WhatsApp |
| Charm con 1 o 2 | Etiqueta "Última unidad" / "Últimas 2". Nunca se inventa urgencia con stock mayor |
| Charm ya en el carrito al tope | No se puede agregar otra vez |
| Brazalete | Selector de talla (17–21 cm); **sin talla no entra al carrito** |
| Talla sin unidades | Se muestra tachada, no se esconde: la clienta ve que la talla existe |
| Brazalete sin ninguna talla | Agotado, con opción de encargo |

**Si `stock.json` no carga, la página funciona como antes de existir:** todo
agregable, sin etiquetas y sin talla obligatoria. La venta nunca se bloquea por
un fallo de red — se comprueba renombrando el archivo.

El conteo es a mano, así que la página **nunca promete disponibilidad**: junto al
total dice "Disponibilidad referencial — te confirmamos por WhatsApp antes de que
pagues", con la fecha del último conteo.

### Piezas sin foto

Tres charms con stock esperan fotografía: **Cenicienta**, **Corazón Mamá e Hija**
y **Stitch Plateado**. En vez de esconderlos —serían ventas perdidas de
inventario que sí existe— sus tarjetas llevan un marcador con el monograma de la
pieza y el rótulo "Foto en camino", y se pueden pedir con normalidad.

Stitch Plateado tenía además una foto equivocada: mostraba `stitch-azul.webp`,
que era copia byte a byte de `stitch.webp`, o sea el Stitch azul esmaltado. Ese
archivo se borró: enseñar el azul para vender el plateado induce a error.

Para enchufar una foto: se guarda en `assets/` y en la tarjeta se cambia

```html
<div class="pc-img pc-img--nofoto"><span class="nofoto-m" aria-hidden="true">C</span><span class="nofoto-t">Foto en camino</span>
```

por el `<div class="pc-img"><img …>` que usan las demás. El carrito toma la
miniatura sola desde `imgDe()`, no hay que tocar nada más.

### Las letras

Las 27 iniciales (A–Z más Ñ, `letra-a` … `letra-ñ`, con eñe literal en la clave)
no son 27 tarjetas: son una grilla compacta dentro de una sola tarjeta. Comparten
la foto `charms-de-letras-pave.webp`, que es de donde salió la tarjeta única que
había antes.

## Despliegue

**Se arrastra la carpeta del proyecto, no `index.html` suelto.** Ese archivo ya no es autocontenido: sin `assets/` al lado las imágenes salen rotas y el sitio pierde la disponibilidad (`assets/stock.json`), sin `legal.css` las cinco páginas de información salen sin estilos, y los enlaces del pie quedan en 404.

Netlify publica la raíz de lo que se suelte, así que la carpeta debe tener `index.html` en su primer nivel y `assets/` junto a él.

Para que despliegue solo en cada push, se conecta este repo en *Site configuration → Build & deploy*. Sin build command, y el directorio de publicación es la raíz.

> El sitio de producción `zephoracharms.com` lo sirve el proyecto **`fanciful-trifle-64ca74`**, no los que se llaman `zephoracharms` ni `zephora-charms` —esos dos solo tienen URL `.netlify.app`. Desplegar en el proyecto equivocado "funciona" sin cambiar nada de lo que ve el público.

## Medición

Meta Pixel `2130673404542988` (dataset "zephora charms pixel 1"). Eventos que dispara la página:

| Evento | Cuándo |
|---|---|
| `PageView` | Carga de la página |
| `ViewContent` | Carga del catálogo, y al abrir una categoría desde las tarjetas |
| `AddToCart` | Se agrega un charm, o se elige el brazalete base |
| `InitiateCheckout` | **Cualquier clic que lleve a WhatsApp,** etiquetado por sección en `content_name` |
| `Lead` | Se envía el pedido armado por WhatsApp (además del `InitiateCheckout`) |

`InitiateCheckout` es la conversión a optimizar en campañas: el checkout ocurre en
WhatsApp, fuera del sitio, así que el salto al chat es lo último medible. `Lead`
queda como señal de mayor intención —lleva `value` y `num_items` del pedido real—,
útil para optimizar por valor cuando el volumen lo permita.

Cada enlace a WhatsApp lleva un `data-wa` con su origen (`hero`, `asesoria-regalo`,
`pie`), que viaja en `content_name` para poder separar en Events Manager qué botón
trae las conversiones.

Abrir el detalle del pedido ya no dispara `InitiateCheckout`: ese evento pasó a
marcar el salto a WhatsApp, y mantener ambos habría inflado la cuenta.

Al tocar el pixel, verificar con **Events Manager → Probar eventos** antes de dar por bueno el cambio.

## Historial

Cada versión del sitio es un commit. Para ver qué cambió entre dos:

```
git log --oneline -- index.html
git diff <commit-anterior> <commit> -- index.html
```

Desde que las imágenes salieron a `assets/`, los diffs de `index.html` son legibles: cambiar una foto ya no ensucia el diff con miles de caracteres de base64, solo cambia el archivo binario correspondiente.
