# Estado del proyecto

Documento de traspaso. Si estás retomando esto en una sesión nueva, empieza por
aquí y sigue con el [`README.md`](README.md), que documenta cómo funciona el
sitio; este archivo cuenta **en qué punto está y qué decisiones no hay que
deshacer sin querer**.

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

### Lo que falta y solo se puede hacer desde los paneles

1. **GitHub → Settings → Branches → Default branch → `main`.**
2. **Netlify → Site configuration → Build & deploy → Branch to deploy → `main`.**
   Hasta que esto se cambie, **el sitio se sigue publicando desde
   `claude/install-frontend-design-skill-8t655e`** y lo que se empuje a `main`
   no sale al aire.
3. Cuando las dos estén hechas, borrar las ramas `claude/*` ya fusionadas.

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

Al cierre de esta sesión, la rama publicada
(`claude/install-frontend-design-skill-8t655e`) está al día y todo lo que
describe este documento vive ahí. **Pero hay tres ramas de otras sesiones sin
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

**Lo que sigue sin reemplazo**, porque no llegó o porque el que llegó era peor:

- `escudo-capitan-america` y `corazon-arbol-de-la-vida` — nadie mandó una.
- `atrapasuenos-azul` — la que llegó viene a 158×318 y la actual tiene la pieza
  a 386×329. Quitarle el «8/9» costaría nitidez, que es exactamente el cambio
  que se revirtió con el osito. Se queda hasta que aparezca una grande.
- El **sello S925 sigue en ~30 fotos**. Una no se nota; treinta en la misma
  rejilla dicen bastante fuerte que las fotos no son de la tienda. Es la
  decisión grande que queda abierta.
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

**Bloqueado en:** n8n no tiene **ninguna credencial** (`list_credentials`
devuelve 0). Hay que conectar Google Sheets ahí —es un OAuth que solo puede
autorizar el propietario— y crear la hoja. Hasta entonces el workflow no se puede
construir: el nodo necesita una credencial para poder siquiera elegir la hoja.

**Lo que falta, en orden:** conectar Google en n8n → crear la hoja con las dos
pestañas → construir el workflow → poner `HOJA_WEBHOOK` y `HOJA_TOKEN` en Netlify
→ el paso de recuento físico → `stock.json`.

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
| **Empaque Premium destacado** en el carrito (marco, badge «Recomendado para regalo», miniatura) | La **foto real del empaque**. Sin ella no hay miniatura, y poner una imagen de catálogo sería vender algo que no es lo que se manda. Nota aparte: el problema del bump probablemente no es el diseño sino el precio — $40.000 sobre un brazalete de $58.000 es un 69% adicional; antes de rediseñarlo conviene probar bajarlo |
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
| Las pruebas **no clavan datos del catálogo**: los leen de `stock.json` o los miden en pantalla | Al retirar tres piezas duplicadas, dos baterías se pusieron rojas con la página en lo cierto: una esperaba «77 tarjetas» y otra nombraba `elsa` entre los agotados. Un número o un id escrito a mano convierte cada cambio de catálogo en una falla falsa, y las fallas falsas enseñan a ignorar el rojo. Lo que hay que comprobar es la regla —que al limpiar la búsqueda vuelvan **todas**, que un agotado salga en gris y bloqueado—, no una cifra concreta |
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

En la salida de cualquier despliegue hay que confirmar que diga **9 functions**
(`crear-pago`, `wompi-webhook`, `_correo`, `_precios`, `_inventario`, `_meta`,
`_pedidos`, `_hoja`, `rescate`);
si no salen, el sitio queda sin cobrar y hay que restaurar el despliegue
anterior.

> **Este número sube cada vez que se añade un módulo a `netlify/functions/`, y
> hay que actualizarlo aquí el mismo día.** Eran 8 hasta que entró `_hoja.mjs`.
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
