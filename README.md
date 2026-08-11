# Zephora Charms

Sitio de [zephoracharms.com](https://zephoracharms.com/) — joyería con significado: charms en Plata 925 y brazaletes con baño de plata, compatibles con Pandora. Envíos a toda Colombia.

## Estructura

> **¿Retomando el proyecto?** Empieza por [`ESTADO.md`](ESTADO.md): en qué punto
> está, qué queda pendiente y qué decisiones no conviene deshacer sin querer.

| Archivo | Qué es |
|---|---|
| `ESTADO.md` | Dónde va el proyecto, pendientes y decisiones tomadas. |
| `index.html` | La tienda: markup, estilos y scripts. Sin build ni dependencias. |
| `checkout.html` | El checkout en tres pasos: datos, entrega y pago. |
| `gracias.html` | A donde vuelve la clienta desde Wompi; consulta el estado real del pago. |
| `netlify/functions/` | Las dos funciones de servidor: firmar el cobro y recibir el aviso de Wompi. |
| `netlify.toml` | Despliegue: publica el repo y monta las funciones. |
| `assets/catalogo.json` | Precios y reglas de cobro. Lo generan, no se edita. |
| `assets/colombia.json` | Departamentos y municipios del selector de envío. |
| `legal.css` | Estilos de las cinco páginas de información, que la comparten. |
| `preguntas-frecuentes.html` | FAQ desplegable, con datos estructurados `FAQPage`. |
| `envios-y-devoluciones.html` | Cobertura, costos, retracto (5 días hábiles) y garantía. |
| `politica-de-privacidad.html` | Tratamiento de datos según Ley 1581 de 2012. |
| `terminos-y-condiciones.html` | Condiciones de compra según Ley 1480 de 2011. |
| `politica-de-cookies.html` | Qué instala el sitio y cómo desactivarlo. |
| `assets/stock.json` | El inventario que lee la página: unidades por charm y tallas por brazalete. |
| `assets/` | Las imágenes del sitio. |
| `pruebas/` | Baterías Playwright que comprueban lo acordado. `./pruebas/correr.sh` |
| `herramientas/` | `gen_paginas.py` (páginas de información) y `extraer_catalogo.py` (precios). |
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

## Cobrar en la web

La clienta arma la pulsera en `index.html`, el carrito se guarda en
`localStorage` y `checkout.html` lo recoge para pedir datos de envío y cobrar.
Hay dos vías: **Wompi** (Nequi, Bancolombia, PSE, Daviplata, tarjetas, Addi) y
**contraentrega**, que no toca la pasarela.

### Por qué hace falta un servidor

Wompi acepta un cobro si viene firmado:
`SHA256(referencia + monto_en_centavos + moneda + secreto_de_integridad)`.

Ese secreto no puede estar en el HTML. Quien lo lea puede firmar un pedido de
$300.000 como $1.000 y Wompi lo aceptará sin objetar nada: la firma garantiza
que el monto no cambió en el camino, no que sea el correcto. Por eso el total
lo calcula `netlify/functions/crear-pago.js`, que solo acepta del navegador
**qué** se pidió —una lista de identificadores— y nunca **cuánto**.

Lo mismo con el cobro confirmado. La página de gracias no sirve como prueba de
pago: la clienta puede cerrar el navegador antes de que la redirección ocurra y
el pago habrá sido bueno igual. Quien decide es el webhook, que Wompi llama por
su cuenta y reintenta si falla — y que hay que verificar, porque su URL es
pública y cualquiera puede inventarse un POST diciendo «pagado».

### Variables de entorno

En *Site configuration → Environment variables*. **Ninguna va al repo.**

| Variable | De dónde sale | Para qué |
|---|---|---|
| `WOMPI_LLAVE_PUBLICA` | Wompi → Ajustes → Llaves API | Abrir el checkout. Es la única que puede ser pública |
| `WOMPI_INTEGRIDAD` | íd. (`prod_integrity_…`) | Firmar el monto |
| `WOMPI_EVENTOS` | íd. (`prod_events_…`) | Verificar que el webhook viene de Wompi |
| `URL_SITIO` | `https://zephoracharms.com` | Construir la URL de regreso |
| `RESEND_API_KEY` | [resend.com](https://resend.com) → API Keys | Mandar los correos de pedido |
| `CORREO_DESDE` | `Zephora Charms <pedidos@zephoracharms.com>` | Remitente |
| `CORREO_TIENDA` | `zephoracharms@gmail.com` | Copia interna de cada pedido |
| `PEDIDOS_WEBHOOK` | opcional | A dónde avisar de cada pedido y cada pago |

En el panel de Wompi, la **URL de eventos** apunta a
`https://zephoracharms.com/.netlify/functions/wompi-webhook`.

> **Las que son secretas hay que marcarlas como secretas.** Netlify trae una
> casilla *Secret* por variable. Sin marcarla, el valor se devuelve en texto
> plano por la API y se ve sin enmascarar en el panel; marcada, vuelve como
> `****`. Van marcadas `WOMPI_INTEGRIDAD`, `WOMPI_EVENTOS` y `RESEND_API_KEY`.
> `WOMPI_LLAVE_PUBLICA` y `URL_SITIO` no lo necesitan: son públicas por diseño
> —la primera viaja al navegador—.
>
> Importa sobre todo con `WOMPI_EVENTOS`, que es el secreto con el que
> `wompi-webhook.js` verifica la firma de cada aviso. Quien lo tenga puede
> firmar un «ya te pagaron» que pase la verificación: exactamente el ataque que
> esa verificación existe para impedir.
>
> Ojo al marcarla desde la API: una variable secreta **no admite el contexto
> `all`**, necesita un valor por contexto. Intentar el cambio con `all` devuelve
> 422 y lo aplica a medias —expande los contextos pero deja `is_secret` en
> `false`—. Desde el panel no pasa; hacerlo ahí.

> **Copiar las llaves con el botón de copiar, nunca leyéndolas de la pantalla.**
> Pasó: la llave pública se transcribió con un `1` (uno) donde el panel tenía
> una `l` (ele minúscula). Un carácter, y el checkout entero moría con «No se
> pudo cargar la información del undefined» — un mensaje que no apunta a nada.
>
> Antes de dar por buena una llave, se comprueba con la API pública de Wompi,
> que no necesita firma ni secreto:
>
> ```
> curl https://production.wompi.co/v1/merchants/<llave-pública>
> ```
>
> Con `name` y `accepted_payment_methods` en la respuesta, la llave sirve.
> Con `NOT_FOUND_ERROR`, no existe — y da igual lo bien que esté el código.
> Los secretos de integridad y eventos no se pueden verificar así: si están mal
> transcritos, el síntoma aparece más tarde, como transacción declinada por
> firma inválida.

Mientras falten `WOMPI_LLAVE_PUBLICA` o `WOMPI_INTEGRIDAD`, el pago en línea
responde 503 con un mensaje que manda a contraentrega o a WhatsApp. El sitio no
se cae: se queda vendiendo como antes.

### Los correos del pedido

Se mandan tres, todos por [Resend](https://resend.com) (el plan gratuito cubre
de sobra el volumen de la tienda):

| Cuándo | A quién | Qué dice |
|---|---|---|
| Al confirmar el pedido | La clienta | Comprobante con piezas, tallas, dirección y total. Contraentrega dice «Pedido confirmado»; pago en línea, «Recibimos tu pedido» |
| Al confirmar el pedido | `CORREO_TIENDA` | La misma ficha, con la forma de pago en el asunto y `reply_to` a la clienta |
| Al aprobar el pago | La clienta | «Pago recibido». Sale del **webhook**, no de la página de gracias: la clienta puede cerrar el navegador antes de volver y el pago fue bueno igual |

Para que el remitente sea `@zephoracharms.com` hay que verificar el dominio en
Resend, que pide unos registros DNS. Se pueden añadir en Netlify → *Domains*.
Sin verificar, Resend solo deja mandar desde su dominio de pruebas.

**Nada de esto puede tumbar una venta.** Sin `RESEND_API_KEY` no se manda
correo y el pedido sigue igual; si Resend falla o tarda, se registra el error y
el cobro continúa. Perder un comprobante es molesto; perder una compra cobrada
porque el proveedor de correo estaba lento, no se perdona.

### El envío gratis es solo del pago anticipado

La contraentrega le cuesta a la tienda la comisión de recaudo de la
transportadora y el riesgo de que el paquete se devuelva sin cobrar, así que
ahí el envío se cobra siempre, pase de $180.000 o no.

Lo delicado no es la regla, es **no prometerla y quitarla al final**. Por eso:

- Cada forma de pago muestra lo que le costaría el envío a *ese* carrito, antes
  de elegir.
- Quien ya pasó el umbral con contraentrega ve por qué su envío no es gratis,
  con el ahorro en pesos y un botón que aplica el cambio.
- Quien no ha llegado lee «con pago anticipado» en el mensaje de progreso.

La regla sale de `LIBRE_SOLO_ANTICIPADO` en `index.html`, la copia el extractor
y la aplican las tres calculadoras.

### Al cambiar un precio

Los precios viven en `index.html` y de ahí los saca el extractor. Después de
tocarlos hay que regenerar el catálogo que usa el servidor:

```
python3 herramientas/extraer_catalogo.py
```

Si se olvida, `pruebas/precios.js` lo detecta: compara el total que muestra la
página contra el que cobraría el servidor en 40 carritos al azar.

## Despliegue

> Desde que existen las funciones, **el despliegue va por Git**, no arrastrando
> la carpeta: Netlify Drop no monta `netlify/functions/`, así que un sitio
> soltado a mano se queda sin cobrar. Se conecta el repo una vez y cada push
> publica; `netlify.toml` ya trae la configuración.

Lo que sigue vale para el sitio estático, y es lo que aplicaba antes:

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
| `InitiateCheckout` | Se entra a `checkout.html`, y también en cualquier clic que lleve a WhatsApp |
| `AddPaymentInfo` | Se llega al paso 3, el de elegir cómo pagar |
| `Purchase` | Wompi confirma el pago como aprobado, o se registra un pedido contraentrega |
| `Lead` | Se envía el pedido armado por WhatsApp |

**`Purchase` es la conversión a optimizar** desde que existe el checkout: ahora
la venta se cierra dentro del sitio y hay un evento que lo dice, con su `value`
real. `InitiateCheckout` y `AddPaymentInfo` sirven para ver dónde se cae el
embudo entre entrar a pagar y pagar.

`Purchase` se dispara en dos sitios y por dos motivos distintos:

- **Wompi**: en `gracias.html`, y solo si al consultar la transacción el estado
  es `APPROVED`. No se dispara con un parámetro de la URL — eso le regalaría a
  cualquiera una página de "pagado" y ensuciaría la cuenta.
- **Contraentrega**: al registrar el pedido, con `content_name: 'Contraentrega'`
  para poder separarlo. Todavía no hay plata cobrada, pero sí un pedido real que
  se despacha; contarlo como venta es lo que hace comparable el embudo.

`Lead` queda para el pedido que se cierra por WhatsApp, que sigue existiendo.

### `Purchase` también desde el servidor (Conversions API)

El `Purchase` del navegador tiene un agujero: **solo se dispara si la clienta
vuelve al sitio** después de pagar, y volver es opcional. Puede cerrar el
navegador, quedarse sin datos, o pagar por PSE desde la app del banco y no
regresar. Ese pago fue bueno y Meta no lo veía — el mismo motivo por el que el
correo de confirmación sale del webhook y no de `gracias.html`.

Desde `netlify/functions/_capi.js`, **`wompi-webhook.js` manda el mismo
`Purchase` a la Conversions API** en cuanto Wompi confirma el pago como
`APPROVED`. Los dos eventos describen el mismo hecho, así que se deduplican con
`event_id`, que en las dos puntas es la referencia del pedido; `gracias.html` la
pasa como `eventID` en su `fbq('track', …)`. **Si se toca una punta sin la otra,
Meta cuenta el doble de compras** — `pruebas/capi.js` lo comprueba leyendo el
HTML precisamente por eso.

`checkout.html` manda las cookies `_fbp` y `_fbc` con el pedido, y `crear-pago`
las guarda junto a los datos de la clienta —ya hasheados— en el almacén
`atribucion` de Netlify Blobs. El webhook las recoge y las borra. Sin ese paso
el evento de servidor llegaría sin atribución, y como suele llegar antes que el
del navegador, sería el que Meta conserva: peor que no mandarlo.

Hace falta `META_CAPI_TOKEN` en el entorno. Sin él no se manda nada y se
registra `capi_sin-token` en el log; la venta sigue igual. Contraentrega no pasa
por aquí: su `Purchase` sigue siendo solo el del navegador.

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
