# Estado del proyecto

Documento de traspaso. Si estás retomando esto en una sesión nueva, empieza por
aquí y sigue con el [`README.md`](README.md), que documenta cómo funciona el
sitio; este archivo cuenta **en qué punto está y qué decisiones no hay que
deshacer sin querer**.

Rama de trabajo: **`claude/ecommerce-landing-page-elivwb`**, que se empuja
también a **`claude/install-frontend-design-skill-8t655e`** — esa segunda es la
rama por defecto del repo y la que Netlify publica. Los dos push van juntos en
cada entrega; si solo se empuja la primera, el sitio no se entera.

Para ver qué se hizo y por qué, `git log`: los mensajes de commit explican el
razonamiento, no solo el cambio.

---

## 🔴 Lo primero: producción está congelada

**Se acabaron los minutos de build de Netlify.** El último despliegue es del
commit `cdd8865`; desde entonces hay **cinco commits construidos, probados y
empujados que nadie ha visto**, incluida la reforma del carrito y el correo de
confirmación.

Ese es el bloqueador número uno: hasta resolverlo, nada de lo que se programe
llega al público.

Antes de pagar o mudarse, **conviene dudar del diagnóstico**: los builds de este
sitio tardan 8–16 segundos, y 300 minutos gratis son unas 1.800 construcciones.
Si se agotaron, o el mes venía cargado o hay otro proyecto en el mismo equipo
quemándolos. Está en *Team settings → Usage*. Mudarse sin saber qué los consumió
es llevarse el problema puesto.

Las cuatro salidas, evaluadas:

| Opción | Veredicto |
|---|---|
| **GitHub Actions + Netlify CLI** | **La recomendada.** Los minutos se gastan cuando construye Netlify; si el paquete se arma en Actions y se sube hecho, no cuenta minutos. El repo es público, así que Actions es gratis e ilimitado. Cero migración: mismo dominio, mismas llaves, misma URL de webhook. Y de paso las pruebas corren antes de publicar. Necesita un `NETLIFY_AUTH_TOKEN` en los secrets de GitHub |
| **Netlify Pro** | Funciona y no tiene riesgo, pero ~$19/mes (unos 80.000 pesos) es más que el margen de un brazalete, para lo poco que se le exige a la plataforma |
| **Cloudflare Pages** | Gratis y permite comercio, pero cuesta una migración: reescribir las dos funciones (`onRequest`, variables por `context.env`), traducir `netlify.toml` a `_redirects`/`_headers`, mover el DNS y **actualizar en Wompi la URL de eventos y la de retorno**. Más volver a probar el circuito de pago con otro pago real |
| **Vercel** | **Descartada.** Su plan gratuito prohíbe el uso comercial en los términos, y esto es una tienda que cobra. Para estar en regla haría falta Pro (~$20/mes), o sea que no es la opción gratis que parece |

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

### 5 · Piezas sueltas que el propietario pidió y están bloqueadas

| Qué | Qué falta |
|---|---|
| **Empaque Premium destacado** en el carrito (marco, badge «Recomendado para regalo», miniatura) | La **foto real del empaque**. Sin ella no hay miniatura, y poner una imagen de catálogo sería vender algo que no es lo que se manda. Nota aparte: el problema del bump probablemente no es el diseño sino el precio — $40.000 sobre un brazalete de $58.000 es un 69% adicional; antes de rediseñarlo conviene probar bajarlo |
| **Logos de medios de pago** al pie del carrito | Los **archivos oficiales** de cada marca. Visa, Mastercard, Nequi, Bancolombia y Daviplata son marcas registradas con guías de uso; no se dibujan aproximaciones |
| Micro-leyenda de confianza | Se pidió «Garantía de Satisfacción». **No se puso a propósito**: bajo la Ley 1480 lo que se anuncia obliga, y la tienda ya ofrece retracto de 5 días hábiles, que es concreto y verificable. La redacción sostenible es *«Pago procesado por Wompi (Bancolombia) · Retracto de 5 días hábiles»* |

### 6 · «A veces se borran las joyas» — reportado, no reproducido

El propietario reportó que a veces la selección desaparece en el checkout y hay
que recargar para que vuelva. **No se logró reproducir**: ir y volver entre
tienda y checkout no lo dispara.

Como no se reprodujo, no está confirmado que esté arreglado. Lo que sí se
blindó, que son las tres causas plausibles:

- **El primer render ya no puede borrar el carrito.** Antes, si `recuperar()`
  fallaba por lo que fuera, el `render()` inmediato guardaba un carrito vacío
  encima del bueno — y el síntoma sería exactamente ese. Ahora solo se guarda
  cuando hay algo, o cuando se vació deliberadamente.
- **Volver atrás y avanzar** relee el carrito (`pageshow`), en vez de dejar una
  pantalla restaurada de caché que miente.
- **Dos pestañas** se sincronizan por el evento `storage`.

Si vuelve a pasar, lo que hace falta es **qué se hizo justo antes**.

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
| El **envío gratis es solo del pago anticipado** | La contraentrega cuesta comisión de recaudo y riesgo de devolución: regalarle el envío es subsidiar la opción más cara. Lo delicado no es la regla sino no prometerla y quitarla al final — por eso cada opción muestra su costo antes de elegir, y quien ya pasó el umbral con contraentrega ve por qué y un botón que aplica el cambio |
| **No hay salida a WhatsApp en el carrito** | A esa altura la clienta ya decidió comprar; una opción de menor compromiso pegada al botón de pagar se come checkouts terminados en vez de sumar pedidos. WhatsApp sigue en el resto de la página y en el checkout **si el pago falla**, que es donde rescata una venta en vez de robarla |
| Los **medios de pago anunciados son los que Wompi tiene habilitados** | Se sacan de `accepted_payment_methods` de su API. Prometer uno que la pasarela no ofrece se descubre con la clienta ya decidida, buscando un botón que no existe. Por eso Addi salió del checkout y quedó como opción por WhatsApp |
| Los **correos no pueden tumbar una venta** | Sin `RESEND_API_KEY` no se manda nada y el pedido sigue; si Resend falla, se registra y el cobro continúa. Perder un comprobante es molesto; perder una compra cobrada porque el proveedor de correo estaba lento, no |
| El **«Pago recibido» sale del webhook**, no de `gracias.html` | La clienta puede cerrar el navegador antes de volver, y el pago fue bueno igual |
| La comprobación de inventario **falla hacia adelante** | Solo bloquea con un dato claro de que no hay. Si `stock.json` no se puede leer, la venta pasa: una lectura fallida no puede costar una compra buena |
| La **verificación del comercio en Wompi** también falla hacia adelante | Solo bloquea con un 404 explícito. Existe porque una llave mal transcrita mandaba a todas las clientas a una pantalla de error sin retorno |

---

## Cómo comprobar que nada se rompió

```sh
./pruebas/correr.sh
```

Cinco baterías en un navegador real: los bugs de la auditoría inicial;
disponibilidad y tallas; la calculadora, la ficha y el buscador; que el servidor
cobre lo mismo que promete la página en 40 carritos al azar; y la compra
completa de punta a punta, ejecutando las funciones de Netlify reales dentro de
Node. Sale con código 1 si algo queda en rojo. Detalle en
[`pruebas/README.md`](pruebas/README.md), incluidas dos comprobaciones de texto
por `grep` que no están automatizadas.

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

**Ya no se arrastra nada.** El repo está conectado a Netlify y cada push a
`claude/install-frontend-design-skill-8t655e` publica — cuando hay minutos de
build, ver el bloqueador de arriba. `netlify.toml` trae publicación, funciones,
redirecciones y cabeceras.

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
