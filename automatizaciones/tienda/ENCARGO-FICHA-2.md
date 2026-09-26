# Ficha de producto, segunda parte — bloques con video, reseñas, carrito y menú

Pedido del propietario el 2026-09-26. Complementa `ENCARGO-FICHA.md` (va después
de él; orden en `ORDEN.md`). Lo construye la sesión que edita la tienda.

## 1. Cuatro bloques con video, debajo de la guía de tallas

Van entre la **guía de tallas** y los **relacionados**. Cada bloque: medio a un
lado (foto o video en bucle, silenciado, `playsinline`, con póster) y texto al
otro; en el celular, apilados. Los videos **no se comitean** (regla del repo:
cuestan créditos y quedan para siempre en git): se alojan fuera
(p. ej. Netlify Blobs vía una función, o el CDN que ya use el sitio) y se
enlazan. Máximo ~3 MB por video, 720p, 6-10 s, sin audio.

Los textos son **los mismos en todas las fichas**; lo que cambia según el tipo
de pieza está marcado. Negritas tal cual.

### Bloque 1 · ✦ Plata 925 que puedes comprobar
**Medio:** la foto macro del sello S925.

> Cada charm lleva grabado el sello **S925**: la marca de la **Plata Esterlina
> 925**. **Búscalo con tus propios ojos** apenas la recibas; está ahí para que no
> tengas que creernos.

*En la ficha de un brazalete*, en lugar del texto anterior:
> Tus charms llevan el sello **S925**. El brazalete, en **baño de plata**, es la
> base que cambia contigo: **ábrelo, suma y combina** cuando quieras.

### Bloque 2 · ♡ Para llevarla todos los días
**Medio:** video de la luciérnaga con el brazalete.

> La Plata 925 es de los metales **mejor tolerados por la piel**, hecha para
> **usarse a diario**. Si con el tiempo se oscurece, es natural en la plata real:
> **un paño le devuelve el brillo** en segundos.

- **Condición:** «**libre de níquel**» e «**hipoalergénica**» solo se agregan si
  el proveedor entrega certificado escrito de la aleación. Sin certificado, no se
  escriben: es una promesa de salud.
- *En la ficha de un brazalete* este bloque **no dice nada de piel ni
  hipoalergénico** (es baño de plata, otra base metálica). Texto alterno:
  > **Liviano y cómodo** para el día a día. Guárdalo seco y lejos de perfumes
  > para que el **baño conserve su brillo** por más tiempo.

### Bloque 3 · ✧ Tu historia, un charm a la vez
**Medio:** video de las joyas pasando.

> Combina héroes, iniciales y símbolos en **un solo brazalete**. Desde el tercer
> charm **el brazalete baja 30%**, y **llevando 4, pagas 3**.

Botón bajo el texto: **«Arma tu pulsera»** (abre el armador). Los dos
beneficios salen de `reglas` (`descuentoBrazalete`, `escalaCharms`): si cambian
las reglas, el texto cambia solo. «Llevando 4, pagas 3» solo es exacto cuando
los 4 charms valen lo mismo; si se prefiere exactitud total, «**25% menos
llevando 4**».

### Bloque 4 · ✦ Llega lista para regalar
**Medio:** video del unboxing.

> Tu pedido llega en **su caja**, con **paño para limpiar la plata** y una
> **dedicatoria escrita a mano** con las palabras que tú elijas. Solo falta
> entregarla… o quedártela.

- **Confirmar con el propietario** qué trae hoy el empaque. Nada de «caja de
  lujo rígida» ni «bolsa de microfibra» si no es exactamente eso.

Botón bajo el texto: **«Agregar al carrito»** (mismo que arriba). Es otro de los
llamados a la acción constantes.

## 2. Error: a veces no se ven las fotos en el carrito

**Síntoma:** al agregar charms desde la ficha, algunas filas del carrito salen
sin foto.

**Causa probable** (`tienda.js` l. 140): `imgDe(id)` no sabe dónde está la
foto; la **busca en la página**, en la tarjeta `.pc[data-id=…]`. Si esa tarjeta
no está en el DOM de la página actual —en `kits.html`, en
`coleccion-marvel.html`, o en tarjetas que se pintan después («ver más»)—
devuelve `''`. En `fila()` eso da un monograma, pero en la tira de sugeridos
(l. 737) queda un `<img src="">` roto.

**Arreglo:** que `imgDe()` lea de un mapa `id → foto` salido de
`assets/catalogo.json` (ya tiene `fotos`, y la foto principal de cada pieza),
no del DOM. Nunca un `<img>` con `src` vacío: si no hay foto, el monograma.
Prueba: agregar al carrito desde la ficha en las tres páginas, con piezas que no
estén pintadas en la portada.

## 3. Reseñas: fotos y videos, y todas visibles en cualquier ficha

Amplía la sección de reseñas de `ENCARGO-FICHA.md`.

- **Multimedia:** hasta 3 fotos y 1 video por reseña. Las fotos se reducen en el
  navegador a ~1600 px antes de subir. Límite práctico: una función de Netlify
  acepta ~6 MB por petición, así que el **video va con un tope de ~20 s y
  comprimido**, o se sube directo a un almacenamiento externo (requiere cuenta;
  **pendiente del propietario**). Todo pasa por moderación antes de publicarse.
- **Todas las reseñas en todas las fichas:** la sección muestra primero las de
  esta pieza y después **todas las de la tienda**, con un filtro «Esta pieza /
  Todas». Las estrellas y el promedio de arriba de la ficha dicen de dónde salen:
  «4,9 · 38 reseñas de la tienda» cuando no son de esa pieza. El dato
  estructurado para Google (`AggregateRating`) va **solo con las reseñas de esa
  pieza**: Google penaliza mezclar.
- Chulo de verificación solo con pedido real (ya especificado).

## 4. Relacionados: tocar una joya abre su ficha

Hoy tocar una tarjeta del carrusel de la ficha no hace nada. Al tocarla, la
**ficha se reemplaza por la de esa joya** en el mismo panel, sin cambiar de
página; sube al inicio del panel. El botón atrás del navegador (o un «← Volver
a [pieza anterior]») regresa a la ficha anterior. El botón «+» de la tarjeta
sigue agregando directo al carrito sin abrir nada.

## 5. Menú: «Categorías» desplegable, con «Más vendidos»

Menú actual: Kits · Promo · Categorías · Brazaletes · Charms · Tallas · Pagos y
envío.

- **Categorías** se vuelve desplegable (clic/toque, no solo hover; en el celular,
  un acordeón dentro del menú). Dentro, las colecciones que ya existen en
  `catalogo.json` → `grupos` (Marvel, Disney, Pixar, Letras, Zodiaco, Profesiones,
  Muranos, Símbolos, Clips y cadenas…), cada una lleva a su filtro o página.
- **Nueva colección «Más vendidos»**, primera de la lista: piezas ordenadas por
  **unidades vendidas reales** (contador de Blobs, `_inventario.mjs`, más las
  ventas manuales de `registrar-venta`), y **solo las que tengan 3 unidades o
  más** (`disponibilidad.mjs`). Con pocas ventas el ranking es ruidoso: mientras
  haya menos de ~30 ventas registradas, mostrar las 12 con más ventas y, para
  completar, las de más stock de las colecciones que más venden; **no** llamar
  «más vendido» a una pieza que no ha vendido.

## Pruebas mínimas

- Los 4 bloques se ven en fichas de charm y de brazalete con el texto que
  corresponde a cada uno, y los videos no bloquean la carga (póster primero).
- Carrito sin fotos rotas desde las tres páginas.
- Una reseña con 3 fotos pasa por moderación y se ve en todas las fichas; el
  `AggregateRating` de cada ficha cuenta solo las suyas.
- Tocar un relacionado cambia la ficha sin recargar; atrás vuelve.
- «Más vendidos» no muestra piezas con menos de 3 unidades.
