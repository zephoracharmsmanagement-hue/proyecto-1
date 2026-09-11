# Carrusel de banner panorámico para el hero — diseño

## Contexto

Cuarta y última idea de una crítica de un competidor de joyería fina (Juli & Co)
que se ha ido implementando en fases sobre `index.html`, todas en la rama
`claude/zephora-empaque-hero` (commiteada y pusheada, sin fusionar a `main`
porque Netlify está sin créditos de despliegue):

1. Sección de empaque premium destacado (`#empaque-destacado`).
2. Sección de autoridad técnica de Plata 925 (`#plata-925`).
3. Reducción de densidad promocional (movió `#promo`, recortó `.bens`).
4. **Este documento**: reemplazar el hero de dos columnas por un banner
   panorámico de ancho completo con carrusel de auto-rotación.

El hero actual (`index.html`, sección `<section class="hero wrap">`) es un
layout fijo de dos columnas: texto a la izquierda (eyebrow, `h1`, subtítulo,
badges de Instagram/estrellas/contador, botón CTA, línea de ayuda de precio),
una sola foto vertical 9:16 a la derecha. El usuario vio el hero de Juli & Co
(banner de ancho completo, foto de fondo con texto superpuesto) y pidió ese
formato, agregando el requisito de que rote entre varias fotos cada 5
segundos.

## Precedente ya existente en el sitio: `.ann`

El ticker de avisos superior (`<div class="ann">`, cerca de la línea 974)
**ya resuelve rotación automática con CSS puro**, sin JavaScript: tres
`.ann-slide` con `animation:annf 15s infinite` y `animation-delay` escalonado
(0s, -10s, -5s), más un `@keyframes annf` que hace fade in/hold/fade out.
Respeta `prefers-reduced-motion` mostrando solo el primer slide fijo. Este
diseño reutiliza esa misma técnica para el banner del hero, con una salvedad
de accesibilidad añadida (ver más abajo).

## Estructura HTML

Reemplaza:
```html
<section class="hero wrap">
  <div class="hero-in"> … dos columnas … </div>
</section>
```

Por:
```html
<section class="hbanner">
  <div class="hbanner-track">
    <div class="hbanner-slide">
      <img class="hbanner-img" src="assets/hero-marca-ancho.webp" alt="Pulsera Zephora armada con charms en Plata 925" fetchpriority="high" decoding="async" width="1600" height="800">
      <div class="hbanner-copy">
        <span class="eyebrow">Joyería con significado · Colombia</span>
        <h1>Diseña una historia<br><i>tan única como tú</i></h1>
      </div>
    </div>
    <div class="hbanner-slide">
      <img class="hbanner-img" src="assets/avengers-marmol.webp" alt="Pulsera Zephora con charms de la colección Avengers sobre mármol negro" decoding="async" width="1600" height="800">
      <div class="hbanner-copy">
        <span class="eyebrow">Colección nueva</span>
        <h1>Llegó la colección<br><i>de los Avengers</i></h1>
        <p class="hbanner-sub">Lleva el poder de tus héroes favoritos contigo.</p>
      </div>
    </div>
  </div>

  <button class="hbanner-pause" type="button" aria-label="Pausar rotación de fotos" aria-pressed="false">
    <svg …/> <!-- ícono pausa/play, togglea con JS -->
  </button>

  <div class="hbanner-fixed">
    <p class="hero-badges"> … igual que hoy: IG verificado, estrellas, "+2.400 pulseras creadas" … </p>
    <div class="hero-cta">
      <a class="btn btn--pagar btn--big" href="#brazaletes">Armar mi pulsera</a>
    </div>
    <p class="hero-hint">El precio se calcula solo mientras eliges, con la promo ya incluida. Pagas aquí mismo con Nequi, PSE, Bancolombia o tarjeta.</p>
  </div>
</section>
```

**Qué se mantiene sin cambios**: el botón CTA (mismo destino `#brazaletes`),
el badge de Instagram/estrellas/contador, la línea de ayuda de precio — todo
vive en `.hbanner-fixed`, fuera de las slides, visible sin importar cuál foto
esté activa. Esto fue una decisión explícita del usuario para no duplicar
CTAs por slide.

**Slide 1** reusa el copy de marca actual tal cual, **pero necesita foto
nueva**: el asset actual del hero (`pulsera-zephora-armada-con-charms-en-plata-925.webp`)
es vertical 9:16 a 502×900px — ni la proporción ni la resolución le sirven a
un banner panorámico. No se puede recortar decentemente de vertical a ancho
sin perder la mayoría del encuadre. Antes de implementar, hace falta generar
una foto nueva para este slide siguiendo la misma especificación de imagen
de más abajo (formato ancho, método de referencia en Flow con esta misma
pulsera). **Esto es una dependencia de contenido, no de código** — bloquea
terminar el slide 1 hasta que exista esa foto, igual que el slide 2 ya
depende de la foto de Avengers que el usuario ya generó.

**Slide 2** es la foto de Avengers ya generada en Flow (charms preservados
fielmente tras corregir el prompt — ver hilo de la conversación), con el
copy indicado arriba. Un tercer slide queda abierto para cuando el usuario
lo defina; no se bloquea este diseño por su ausencia.

## Rotación — CSS puro, igual que `.ann`

```css
.hbanner-track{display:grid}
.hbanner-slide{grid-area:1/1;opacity:0;animation:hbf 10s infinite}
.hbanner-slide:nth-child(1){animation-delay:0s}
.hbanner-slide:nth-child(2){animation-delay:-5s}
@keyframes hbf{0%{opacity:0}4%,46%{opacity:1}50%,100%{opacity:0}}
```

Con 2 slides de 5s cada uno, el ciclo total es 10s. Los porcentajes del
`@keyframes` **están calculados a mano para 2 slides** — igual que `.ann` lo
está para 3. Si se agrega un tercer slide más adelante, hay que recalcular
`animation-delay` y los porcentajes del keyframe (ciclo pasaría a 15s, cada
tramo a 1/3 del keyframe). Dejar un comentario en el CSS señalándolo, para
que quien edite después no lo pise en silencio.

`.hbanner-pause` togglea una clase `.paused` en `.hbanner-track`:
```css
.hbanner-track.paused .hbanner-slide{animation-play-state:paused}
```

Y en `@media(prefers-reduced-motion:reduce)`, igual que `.ann`:
```css
.hbanner-slide{animation:none;opacity:0}
.hbanner-slide:first-child{opacity:1}
```

## Accesibilidad — botón de pausa

A diferencia de `.ann` (que no tiene botón, solo `prefers-reduced-motion`),
este banner sí lleva un botón de pausa visible, porque es un elemento mucho
más grande y prominente que el ticker de texto — decisión explícita del
usuario para cumplir mejor con el criterio de accesibilidad sobre contenido
que se mueve solo por más de 5 segundos.

JS (vanilla, sin dependencias, mismo estilo que el resto del sitio):
```js
const hbTrack = document.querySelector('.hbanner-track');
const hbPause = document.querySelector('.hbanner-pause');
hbPause.addEventListener('click', () => {
  const paused = hbTrack.classList.toggle('paused');
  hbPause.setAttribute('aria-pressed', paused);
});
```

## Rendimiento

Solo la imagen del primer slide lleva `fetchpriority="high"` (igual que hoy
el hero). Las siguientes no compiten por ancho de banda en la carga inicial;
no se marcan `loading="lazy"` en la segunda (está justo debajo del fold
inicial, no tan lejos como para diferir su carga), pero tampoco se les da
prioridad alta.

## Especificación de imagen (actualiza la guía anterior)

El formato cambió de vertical 9:16 (layout de dos columnas) a **horizontal
ancho**, porque ahora es un banner de fondo completo:

- **Proporción: mínimo 16:9, ideal más panorámico (2:1 o más)**.
- **Resolución: la más alta que Flow permita.**
- **Composición**: charms centrados en el encuadre, no pegados a un extremo,
  para que el recorte por `object-fit:cover` funcione tanto en desktop
  (banner ancho y bajo) como en mobile (recorte más alto y angosto).

## Fuera de alcance

- No se decide el contenido de un tercer slide — se agrega cuando el usuario
  lo defina, con el ajuste de keyframes correspondiente.
- No se toca `.bens` (barra de beneficios) ni ninguna otra sección — el
  cambio es exclusivamente el hero.
- No se resuelve un sistema de slides "abierto"/data-driven — el usuario
  pidió explícitamente una lista corta y fija por ahora, no una arquitectura
  para escalar a muchos slides.
