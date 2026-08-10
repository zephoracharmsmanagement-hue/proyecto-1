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

### 4 · Pasarela de pago — cobrando

**El sitio cobra.** Se hizo un pago real de prueba por Wompi y quedó aprobado.
El repo está conectado a Netlify, las funciones desplegadas y las llaves
puestas. Lo que queda de esta línea de trabajo:

- **Correo.** Está escrito y probado, pero **falta configurar Resend**: sin
  `RESEND_API_KEY` no sale ningún correo (y nada se rompe). Hay que crear la
  cuenta, verificar `zephoracharms.com` por DNS en Netlify, y poner las tres
  variables del README.
- **Addi.** El propietario tiene cuenta propia pero Wompi no lo tiene
  habilitado para este comercio, así que no aparece en la pasarela. Hoy se
  ofrece por WhatsApp desde la sección de medios de pago, con `data-wa="pagos"`
  para poder medir cuántas lo piden. Si Wompi lo activa, solo hay que devolver
  el chip al checkout: cero código nuevo.

> **La llave pública se transcribió mal una vez** (un `1` donde iba una `l`) y
> costó una hora de diagnóstico, porque el error que da Wompi —«No se pudo
> cargar la información del undefined»— no apunta a nada. Antes de dar una
> llave por buena: `curl https://production.wompi.co/v1/merchants/<llave>`.

### 4b · Lo que quedó del bloqueador de inventario

El servidor ya **comprueba inventario antes de cobrar**: rechaza con 409 lo
agotado, lo que pide más unidades de las que hay, y las tallas sin existencias
—con un mensaje que dice qué se agotó y qué tallas sí quedan, y el checkout
lleva a corregir la selección o a pedirlo por encargo—. Eso cierra el caso
corriente: pagar algo que se acabó hace rato.

**Lo que sigue abierto es la carrera.** Dos clientas que compran la última
unidad en el mismo minuto pasan las dos, porque `assets/stock.json` es un
archivo que se lee, no un almacén que se reserve. Ahí toca devolver dinero, que
bajo la Ley 1480 no es solo una molestia.

Para cerrarlo hace falta estado: reservar unidades al iniciar el pago,
liberarlas si el pago no llega, y descontarlas al aprobarse. **Netlify Blobs**
sirve para eso sin montar una base de datos. Es la siguiente pieza de fondo si
el volumen sube; hoy el riesgo se limita a las piezas de 1–2 unidades pagadas
en línea, y la confirmación por WhatsApp antes de despachar sigue siendo la red
de seguridad.

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
