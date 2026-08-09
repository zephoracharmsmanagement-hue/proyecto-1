# Estado del proyecto

Documento de traspaso. Si estás retomando esto en una sesión nueva, empieza por
aquí y sigue con el [`README.md`](README.md), que documenta cómo funciona el
sitio; este archivo cuenta **en qué punto está y qué decisiones no hay que
deshacer sin querer**.

Rama de trabajo: **`claude/ecommerce-landing-whatsapp-o5qhez`**.
El sitio está desplegable: sirviendo la carpeta aislada no da una sola respuesta
4xx. Para ver qué se hizo y por qué, `git log` — los mensajes de commit explican
el razonamiento, no solo el cambio.

---

## Pendientes

### 1 · Tres fotos de producto

Faltan por conseguir. Las tarjetas **ya existen y se venden**, con un marcador
"Foto en camino" en lugar de la imagen:

| Pieza | Archivo que espera |
|---|---|
| Cenicienta | `assets/cenicienta.webp` |
| Corazón Mamá e Hija | `assets/corazon-mama-e-hija.webp` |
| Stitch Plateado | `assets/stitch-azul.webp` |

Cómo enchufar cada una: la sección *Piezas sin foto* del README.

> Ojo con la tercera. `stitch-azul` **es el Stitch plateado**, no el azul. La foto
> que tenía era copia byte a byte de `stitch.webp` —el azul esmaltado, que es otra
> pieza— y se borró. Necesita la foto del plateado de orejas rosadas.

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

### 4 · Pasarela de pago — construida, falta conectarla

El checkout existe y está probado: `checkout.html` (datos → entrega → pago),
con dos vías — **Wompi** y **contraentrega** — y dos funciones de servidor que
firman el cobro y reciben la confirmación. El propietario confirmó que maneja
la pasarela de Wompi. Para que cobre de verdad faltan tres pasos de panel,
descritos en la sección *Cobrar en la web* del README:

1. Conectar este repo a Netlify (el despliegue por Drop no monta las funciones).
2. Poner las variables `WOMPI_LLAVE_PUBLICA`, `WOMPI_INTEGRIDAD`, `WOMPI_EVENTOS`
   y `URL_SITIO` en el entorno del sitio. **Ninguna va al repo.**
3. En el panel de Wompi, apuntar la URL de eventos a
   `/.netlify/functions/wompi-webhook`.

Mientras falten las variables, el pago en línea responde 503 con un mensaje que
manda a contraentrega o a WhatsApp; el sitio sigue vendiendo como hoy.

**El bloqueador del inventario sigue vigente, atenuado pero no resuelto.**
`assets/stock.json` se genera a mano. El servidor valida catálogo y precios,
pero **no descuenta stock**: dos clientas aún pueden pagar la última unidad el
mismo día. Los topes del navegador lo hacen improbable, no imposible. Mientras
el pedido contraentrega se confirme por WhatsApp antes de despachar (como hoy),
el riesgo queda contenido en los pagos anticipados de piezas con 1–2 unidades —
que es justo donde la página ya muestra «Última unidad». Si el volumen crece,
lo correcto es un almacén de stock con estado; está anotado, no construido.

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
| El **total a cobrar lo calcula el servidor**, nunca el navegador | El monto que viaja por el cliente se puede alterar desde la consola. `crear-pago` solo acepta identificadores y recalcula; `pruebas/precios.js` vigila que ambas calculadoras coincidan |
| Al cambiar un precio, **correr `herramientas/extraer_catalogo.py`** | El checkout y el servidor leen `assets/catalogo.json`, que se genera desde index.html. Si se olvida, la batería `precios` sale en rojo |
| El **webhook de Wompi verifica la firma** de cada evento | Su URL es pública: sin verificación, cualquiera manda un POST diciendo «pagado» |
| `Purchase` **solo con estado APPROVED consultado a la API** de Wompi | Dispararlo por un parámetro de URL regalaría una página de «pagado» y ensuciaría la optimización de campañas |

---

## Cómo comprobar que nada se rompió

```sh
./pruebas/correr.sh
```

Tres baterías en un navegador real: los cuatro bugs de la auditoría inicial,
disponibilidad y tallas, y la calculadora, la ficha y el buscador. Sale con código
1 si algo queda en rojo. Detalle en [`pruebas/README.md`](pruebas/README.md),
incluidas dos comprobaciones de texto por `grep` que no están automatizadas.

Si una prueba falla, **mira primero si el error está en la prueba**: ya pasó dos
veces que la aserción estaba mal y la página tenía razón.

---

## Al desplegar

Se arrastra a Netlify Drop **la carpeta completa**, no `index.html` suelto. La
carpeta se arma copiando solo lo que el sitio necesita:

```
index.html · legal.css · las 5 páginas de información · assets/
```

`pruebas/`, `herramientas/`, `meta/` y este archivo **no van** al despliegue.

> El dominio `zephoracharms.com` lo sirve el proyecto de Netlify
> **`fanciful-trifle-64ca74`**. Los proyectos llamados `zephoracharms` y
> `zephora-charms` solo tienen URL `.netlify.app`: desplegar en el equivocado
> "funciona" sin cambiar nada de lo que ve el público.

Al tocar el píxel, verificar en **Events Manager → Probar eventos** antes de dar
el cambio por bueno.
