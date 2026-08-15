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
| **Plan pago de Netlify** | **Lo que se hizo.** Desbloquea de inmediato y da margen de sobra (~66 despliegues). Es suscripción mensual, se cancela cuando se quiera y volver a Free no rompe nada: el dominio propio y las funciones ya corrían en el plan gratuito. Si se cancela, poner el recordatorio el mismo día |
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

### 1 · Una foto de producto

Falta **una sola**: la del Stitch Plateado, en `assets/stitch-azul.webp`. La
tarjeta ya existe y se vende, con un marcador "Foto en camino" en lugar de la
imagen. Cómo enchufarla: la sección *Piezas sin foto* del README.

> Ojo con el nombre del archivo. `stitch-azul` **es el Stitch plateado**, no el
> azul. La foto que tenía era copia byte a byte de `stitch.webp` —el azul
> esmaltado, que es otra pieza— y se borró. Necesita la del plateado de orejas
> rosadas.

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
  quedó verificado por DNS y las tres variables están puestas: `RESEND_API_KEY`
  (marcada como secreta), `CORREO_DESDE` y `CORREO_TIENDA`. Falta la
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

### Los dos fallos silenciosos que costó dejarlo funcionando

Vale la pena leerlos antes de tocar esta pieza, porque los dos fueron invisibles:

1. **Las funciones eran v1.** Netlify solo inyecta `NETLIFY_BLOBS_CONTEXT` en
   v2, así que `getStore()` lanzaba y todo caía al camino de emergencia.
2. **Después, la librería no entraba en el bundle.** El `require` estaba dentro
   de un `try` para que un paquete ausente no tumbara la función — y el
   rastreador de dependencias de Netlify no ve un require escondido en el cuerpo
   de una función, así que nunca la empaquetaba. La protección causó el fallo
   que pretendía sobrevivir.

Las dos veces la tienda cobró, salieron los correos y viajó el `Purchase`; las
dos veces la reserva no existía. **Falla hacia adelante es lo correcto para no
perder ventas, pero convierte cada error en algo que solo se ve leyendo el log.**

Por eso `pruebas/inventario.js` § 6 comprueba **la forma del código** y no solo
su comportamiento: que las funciones exporten el handler v2, y que el import de
`@netlify/blobs` sea estático. Ninguna prueba de comportamiento las habría
cazado, porque en local siempre se usa el almacén falso.

### 5 · Piezas sueltas que el propietario pidió y están bloqueadas

| Qué | Qué falta |
|---|---|
| **Empaque Premium destacado** en el carrito (marco, badge «Recomendado para regalo», miniatura) | La **foto real del empaque**. Sin ella no hay miniatura, y poner una imagen de catálogo sería vender algo que no es lo que se manda. Nota aparte: el problema del bump probablemente no es el diseño sino el precio — $40.000 sobre un brazalete de $58.000 es un 69% adicional; antes de rediseñarlo conviene probar bajarlo |
| **Logos de medios de pago** al pie del carrito | Los **archivos oficiales** de cada marca. Visa, Mastercard, Nequi, Bancolombia y Daviplata son marcas registradas con guías de uso; no se dibujan aproximaciones |
| Micro-leyenda de confianza | **Hecha y cerrada.** Bajo el botón de pagar del carrito sale *«Pago procesado por Wompi (Bancolombia)»*, la misma frase que el pie del checkout. **Lo del retracto se descartó por decisión del propietario**, que lo resolvió por otra vía: no va en la leyenda ni en la página, y no hay nada más que hacer ahí. (Había además un motivo para no ponerlo: la política de devoluciones recoge la excepción del artículo 47 para bienes claramente personalizados, y el titular de la tienda es «Personalización total») |

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
| **No hay salida a WhatsApp en el carrito** | A esa altura la clienta ya decidió comprar; una opción de menor compromiso pegada al botón de pagar se come checkouts terminados en vez de sumar pedidos. WhatsApp sigue en el resto de la página y en el checkout **si el pago falla**, que es donde rescata una venta en vez de robarla |
| Los **medios de pago anunciados son los que Wompi tiene habilitados** | Se sacan de `accepted_payment_methods` de su API. Prometer uno que la pasarela no ofrece se descubre con la clienta ya decidida, buscando un botón que no existe. Por eso Addi salió del checkout y quedó como opción por WhatsApp |
| Los **correos no pueden tumbar una venta** | Sin `RESEND_API_KEY` no se manda nada y el pedido sigue; si Resend falla, se registra y el cobro continúa. Perder un comprobante es molesto; perder una compra cobrada porque el proveedor de correo estaba lento, no |
| El **«Pago recibido» sale del webhook**, no de `gracias.html` | La clienta puede cerrar el navegador antes de volver, y el pago fue bueno igual |
| La comprobación de inventario **falla hacia adelante** | Solo bloquea con un dato claro de que no hay. Si `stock.json` no se puede leer, la venta pasa: una lectura fallida no puede costar una compra buena |
| `crear-pago` y `wompi-webhook` son **funciones v2** (`export default`, en `.mjs`) | No es estilo: Netlify solo inyecta `NETLIFY_BLOBS_CONTEXT` en v2, y sin esa variable `getStore()` lanza y la reserva de inventario se cae al camino de emergencia — la tienda vende, nada se rompe, y no se aparta nada. Ya pasó: estuvo así en producción una jornada entera y se detectó leyendo el log, no porque algo fallara. `pruebas/inventario.js` § 6 lo vigila. Los módulos auxiliares siguen en CommonJS porque no hacía falta tocarlos |
| Ahora **sí hay `package.json` en la raíz** | `pruebas/package.json` explica que no lo había a propósito, para que Netlify no instalara dependencias. Esa decisión se tomó con cero dependencias; la reserva necesita `@netlify/blobs` **dentro de las funciones**, y sin declararla el bundler no la incluye, las funciones se caen al arrancar y el sitio deja de cobrar. Sigue sin haber comando de build (`command = ""`): lo único que cambia es que Netlify instala esa dependencia antes de empaquetar |
| Las pruebas **no clavan datos del catálogo**: los leen de `stock.json` o los miden en pantalla | Al retirar tres piezas duplicadas, dos baterías se pusieron rojas con la página en lo cierto: una esperaba «77 tarjetas» y otra nombraba `elsa` entre los agotados. Un número o un id escrito a mano convierte cada cambio de catálogo en una falla falsa, y las fallas falsas enseñan a ignorar el rojo. Lo que hay que comprobar es la regla —que al limpiar la búsqueda vuelvan **todas**, que un agotado salga en gris y bloqueado—, no una cifra concreta |
| La reserva de inventario **se prueba con latencia** | `pruebas/inventario.js` mete demora en el almacén falso para que las dos lecturas ocurran antes de cualquier escritura. Sin eso, las dos operaciones corren una tras otra, la prueba pasa, y no ha probado nada — el mismo error que dio verde a un pago que no cobraba |
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

**Ya no se arrastra nada.** El repo está conectado a Netlify y cada push a
`claude/install-frontend-design-skill-8t655e` publica. `netlify.toml` trae
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

En la salida de cualquier despliegue hay que confirmar que diga **7 functions**
(`crear-pago`, `wompi-webhook`, `_correo`, `_precios`, `_inventario`, `_meta`,
`_pedidos`);
si no salen, el sitio queda sin cobrar y hay que restaurar el despliegue
anterior.

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
