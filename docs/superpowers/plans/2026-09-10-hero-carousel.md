# Carrusel de banner panorámico para el hero — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el hero de dos columnas de `index.html` por un banner panorámico de ancho completo con auto-rotación entre fotos, manteniendo fijos el CTA, el sello social y la línea de precio.

**Architecture:** Reutiliza el mecanismo de rotación 100% CSS que ya usa el ticker de avisos (`.ann`, keyframes con `animation-delay` escalonado) en vez de un carrusel en JavaScript. Las fotos se apilan con el truco de grid `grid-area:1/1` (mismo que `.ann-track`). El único JavaScript nuevo es el botón de pausa (toggle de una clase).

**Tech Stack:** HTML/CSS/JS vanilla sin build (el sitio no tiene bundler ni framework — `netlify.toml` publica el repo tal cual). Sin test runner: la verificación de cada tarea es estructural (balance de etiquetas, conteo de clases, ausencia de IDs duplicados vía un script `node -e` inline) más revisión manual del código, porque el navegador headless no funciona en este entorno (ver memoria `windows_headless_browser_unavailable`).

**Spec:** `docs/superpowers/specs/2026-09-10-hero-carousel-design.md`

## Global Constraints

- Rama: `claude/zephora-empaque-hero`. No fusionar a `main` (Netlify sin créditos de despliegue — cualquier push a `main` con cambios de `.html` dispara un deploy real).
- Solo se toca `index.html` (y los assets nuevos en `assets/`). No tocar `netlify/functions/`, checkout, ni ninguna otra sección de la página.
- Auto-rotación: 5 segundos por slide, mecanismo 100% CSS (sin librería de carrusel).
- Botón de pausa obligatorio (decisión de accesibilidad ya tomada — a diferencia de `.ann`, que no lo tiene).
- Respetar `prefers-reduced-motion` igual que `.ann` (bloque `@media(prefers-reduced-motion:reduce)` ya existente cerca de la línea 966).
- El botón CTA ("Armar mi pulsera" → `#brazaletes`), el sello de Instagram/estrellas/contador, y la línea de ayuda de precio quedan fijos, fuera de las slides — no se duplican por slide.
- Fotos nuevas: formato horizontal ancho, mínimo 16:9, ideal 2:1 o más panorámico, máxima resolución que Flow permita, charms centrados en el encuadre (no pegados a un extremo).
- Cada commit lleva el pie de atribución ya usado en esta rama (`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` + línea de sesión).

---

## Task 1: Guardar el asset de Avengers en el repo

El usuario ya generó esta foto en Flow (charms preservados fielmente, sin texto quemado, fondo de mármol negro). Falta llevarla del equipo del usuario al repo.

**Files:**
- Create: `assets/avengers-marmol.webp`

**Interfaces:**
- Produces: la ruta `assets/avengers-marmol.webp`, que las Tasks 2 y 3 referencian como `src` de imagen.

- [ ] **Step 1: Pedir al usuario la ruta local del archivo**

Preguntar dónde quedó guardado el archivo que exportó desde Flow (ej.
`C:\Users\Martin\Downloads\avengers.png` o similar). No asumir una ruta.

- [ ] **Step 2: Copiar el archivo al repo con el nombre y formato correctos**

Si el archivo no es `.webp`, convertir mantendo la mayor calidad posible.
Ejemplo si PowerShell tiene disponible un conversor (ajustar la ruta de
origen a la que dé el usuario):

```powershell
# Si ya es .webp, copiar tal cual:
Copy-Item "<ruta-que-dio-el-usuario>" "C:\Users\Martin\projects\proyecto-1\assets\avengers-marmol.webp"
```

Si hace falta convertir de PNG/JPG a WebP y no hay herramienta de
conversión disponible en el entorno, dejar el archivo en su formato
original con la extensión correspondiente (ej. `assets/avengers-marmol.png`)
y usar esa ruta en las Tasks 2/3 — no bloquear la tarea por la conversión,
el sitio ya sirve `.jpg`/`.png` en otras partes si hace falta.

- [ ] **Step 3: Verificar las dimensiones reales del archivo**

```bash
cd /c/Users/Martin/projects/proyecto-1 && file assets/avengers-marmol.webp
```

Anotar el ancho×alto real que reporte — se usa como `width`/`height` exactos
en el `<img>` de la Task 2 (evita layout shift). Si la proporción no es al
menos 16:9 horizontal, avisar al usuario antes de continuar — no cuadra con
la especificación del banner y probablemente haya que volver a generarla o
recortarla.

- [ ] **Step 4: Confirmar que el archivo quedó trackeado por git**

```bash
cd /c/Users/Martin/projects/proyecto-1 && git status --short assets/avengers-marmol.webp
```

Expected: aparece como `??` (nuevo, sin trackear todavía — se añade al
commit de la Task 2, no aquí solo, para que la imagen entre junto con el
código que la usa).

---

## Task 2: Reemplazar el hero de dos columnas por el banner de una foto (Avengers)

Sin animación todavía — con un solo slide no hace falta rotar. Deja el
banner panorámico funcionando y revisable antes de sumarle la segunda foto.

**Files:**
- Modify: `index.html:182-198` (bloque CSS `.hero*`, se reemplaza por `.hbanner*`)
- Modify: `index.html:910-912` y `index.html:935` (overrides de `.hero*` dentro del media query desktop, se reemplazan por `.hbanner*`)
- Modify: `index.html:1014-1036` (sección `<!-- 1 · HERO -->`, se reemplaza el markup)

**Interfaces:**
- Consumes: `assets/avengers-marmol.webp` (o la ruta que haya quedado tras la Task 1), ancho×alto real anotado en la Task 1.
- Produces: clases `.hbanner`, `.hbanner-track`, `.hbanner-slide`, `.hbanner-img`, `.hbanner-copy`, `.hbanner-sub`, `.hbanner-fixed` — que la Task 3 reutiliza para el segundo slide y la rotación.

- [ ] **Step 1: Reemplazar el bloque CSS del hero (líneas 182-198)**

Buscar y reemplazar:
```css
.hero{padding:22px 0 34px}
.hero-in{display:grid;gap:22px}
.hero-img img{width:100%;max-height:46dvh;object-fit:cover;object-position:center 72%;border-radius:3px}
.hero h1{font-size:clamp(34px,8.8vw,64px);line-height:1.06;margin:10px 0 14px}
.hero h1 i{font-style:italic;color:var(--plum)}
.hero-sub{max-width:48ch;color:#584a5c;margin:0 0 14px;font-size:16.5px}
.hero-badges{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:0 0 22px;font-size:13.5px}
.hero-badges .stars{margin:0}
.hero-badges .dot{color:var(--silver)}
.hero-badge-n{color:#6d6070}
.hero-badges a{text-decoration:none;font-weight:400}
.hero-cta{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.hero-hint{font-size:13px;color:#6d6070;margin:0}
.hero-hint a{color:var(--plum)}
```

Por:
```css
/* 1 · hero banner — reemplaza el layout de dos columnas por un banner de
   ancho completo con foto de fondo. Rotación (cuando haya 2+ slides) usa
   el mismo truco 100% CSS que .ann: grid-area:1/1 + keyframes de opacity,
   ver Task 3. Con un solo slide no hace falta animación. */
.hbanner{position:relative;overflow:hidden;height:56dvh;min-height:340px}
.hbanner-track{display:grid;height:100%}
.hbanner-slide{grid-area:1/1;position:relative}
.hbanner-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center}
.hbanner-copy{position:relative;z-index:1;max-width:var(--w);margin:0 auto;padding:28px 16px 0}
.hbanner-copy .eyebrow{color:#fff}
.hbanner-copy h1{font-size:clamp(30px,8vw,52px);line-height:1.08;margin:8px 0 10px;color:#fff}
.hbanner-copy h1 i{font-style:italic;color:var(--rose-soft)}
.hbanner-sub{max-width:40ch;color:#f0e8ef;margin:0;font-size:14.5px}
.hbanner-fixed{position:absolute;left:0;right:0;bottom:0;z-index:2;
  background:linear-gradient(to top, rgba(42,31,46,.82), rgba(42,31,46,0) 85%);
  padding:40px 16px 18px}
.hbanner-fixed-in{max-width:var(--w);margin:0 auto}
.hbanner-fixed .hero-badges{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:0 0 16px;font-size:13.5px;color:#fff}
.hbanner-fixed .hero-badges .stars{margin:0}
.hbanner-fixed .hero-badges .dot{color:#cbb9c9}
.hbanner-fixed .hero-badge-n{color:#e7dfe4}
.hbanner-fixed .hero-badges a{text-decoration:none;font-weight:400;color:#fff}
.hbanner-fixed .hero-cta{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.hbanner-fixed .hero-hint{font-size:13px;color:#e7dfe4;margin:0}
.hbanner-fixed .hero-hint a{color:#fff;text-decoration:underline}
```

- [ ] **Step 2: Reemplazar los overrides de desktop (líneas 910-912)**

Buscar:
```css
  .hero{padding:52px 0}
  .hero-in{grid-template-columns:1.05fr .95fr;gap:56px;align-items:center}
  .hero-img{order:2}
```

Reemplazar por:
```css
  .hbanner{height:78dvh}
  .hbanner-copy{padding:48px 16px 0}
```

- [ ] **Step 3: Quitar el override de `.hero-img img` en desktop (línea 935)**

Buscar `  .hero-img img{max-height:72dvh}` dentro del mismo bloque de media
query y borrar esa línea (ya no aplica — la altura del banner la controla
`.hbanner{height:78dvh}` del Step 2).

- [ ] **Step 4: Reemplazar el markup de la sección hero (líneas 1014-1036)**

Buscar:
```html
<!-- 1 · HERO -->
<section class="hero wrap">
  <div class="hero-in">
    <div>
      <span class="eyebrow">Joyería con significado · Colombia</span>
      <h1>Diseña una historia<br><i>tan única como tú</i></h1>
      <p class="hero-sub">Joyería personalizada con charms elaborados en Plata Esterlina 925 verificada y brazaletes con acabado de alta calidad en baño de plata, compatibles con Pandora.</p>
      <p class="hero-badges"><a class="foot-ig" href="https://instagram.com/zephora_charms">@zephora_charms<svg class="vf" viewBox="0 0 24 24" width="15" height="15" aria-label="Cuenta verificada"><circle cx="12" cy="12" r="11" fill="#1d9bf0"/><path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></a><span class="dot">·</span><span class="stars" aria-label="5 de 5 estrellas"><svg width="13" height="13" viewBox="0 0 24 24" fill="#B4657F"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z"/></svg><svg width="13" height="13" viewBox="0 0 24 24" fill="#B4657F"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z"/></svg><svg width="13" height="13" viewBox="0 0 24 24" fill="#B4657F"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z"/></svg><svg width="13" height="13" viewBox="0 0 24 24" fill="#B4657F"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z"/></svg><svg width="13" height="13" viewBox="0 0 24 24" fill="#B4657F"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z"/></svg></span><span class="hero-badge-n">+2.400 pulseras creadas</span></p>
            <!-- Un solo CTA, y lleva al armador. WhatsApp salió de aquí: como
           botón junto al principal traía sobre todo preguntas de cosas que la
           página ya responde —material, tallas, envíos—, consultas que hay que
           atender a mano y que no terminaban en pedido. Sigue en el pie, con
           el horario al lado, para quien de verdad quiera escribir. -->
      <div class="hero-cta">
        <a class="btn btn--pagar btn--big" href="#brazaletes">Armar mi pulsera</a>
      </div>
      <p class="hero-hint">El precio se calcula solo mientras eliges, con la promo ya incluida. Pagas aquí mismo con Nequi, PSE, Bancolombia o tarjeta.</p>
    </div>
    <div class="hero-img">
      <img src="assets/pulsera-zephora-armada-con-charms-en-plata-925.webp?v=20260822" alt="Pulsera Zephora armada con charms en plata 925" width="502" height="900" fetchpriority="high" decoding="async">
    </div>
  </div>
</section>
```

Reemplazar por (sustituir `ANCHO_REAL` y `ALTO_REAL` por las dimensiones
anotadas en la Task 1, Step 3; si el archivo terminó con otra extensión que
`.webp` — ver Task 1, Step 2 — ajustar también el `src="assets/avengers-marmol.webp"`
de abajo a la ruta real):

```html
<!-- 1 · HERO BANNER — antes esto era un layout fijo de dos columnas con una
     sola foto vertical. Ahora es un banner de ancho completo; con un solo
     slide no hay animación (llega en la Task 3, cuando se agregue la
     segunda foto). El CTA, el sello de Instagram/estrellas y la línea de
     precio están en .hbanner-fixed, fuera de la foto, para que no
     desaparezcan si el día de mañana hay más de un slide. -->
<section class="hbanner">
  <div class="hbanner-track">
    <div class="hbanner-slide">
      <img class="hbanner-img" src="assets/avengers-marmol.webp" alt="Pulsera Zephora con charms de la colección Avengers sobre mármol negro" width="ANCHO_REAL" height="ALTO_REAL" fetchpriority="high" decoding="async">
      <div class="hbanner-copy">
        <span class="eyebrow">Colección nueva</span>
        <h1>Llegó la colección<br><i>de los Avengers</i></h1>
        <p class="hbanner-sub">Lleva el poder de tus héroes favoritos contigo.</p>
      </div>
    </div>
  </div>

  <div class="hbanner-fixed">
    <div class="hbanner-fixed-in">
      <p class="hero-badges"><a class="foot-ig" href="https://instagram.com/zephora_charms">@zephora_charms<svg class="vf" viewBox="0 0 24 24" width="15" height="15" aria-label="Cuenta verificada"><circle cx="12" cy="12" r="11" fill="#1d9bf0"/><path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></a><span class="dot">·</span><span class="stars" aria-label="5 de 5 estrellas"><svg width="13" height="13" viewBox="0 0 24 24" fill="#B4657F"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z"/></svg><svg width="13" height="13" viewBox="0 0 24 24" fill="#B4657F"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z"/></svg><svg width="13" height="13" viewBox="0 0 24 24" fill="#B4657F"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z"/></svg><svg width="13" height="13" viewBox="0 0 24 24" fill="#B4657F"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z"/></svg><svg width="13" height="13" viewBox="0 0 24 24" fill="#B4657F"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z"/></svg></span><span class="hero-badge-n">+2.400 pulseras creadas</span></p>
      <div class="hero-cta">
        <a class="btn btn--pagar btn--big" href="#brazaletes">Armar mi pulsera</a>
      </div>
      <p class="hero-hint">El precio se calcula solo mientras eliges, con la promo ya incluida. Pagas aquí mismo con Nequi, PSE, Bancolombia o tarjeta.</p>
    </div>
  </div>
</section>
```

- [ ] **Step 5: Verificación estructural**

```bash
cd /c/Users/Martin/projects/proyecto-1 && node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const secOpen = (html.match(/<section/g)||[]).length;
const secClose = (html.match(/<\/section>/g)||[]).length;
console.log('sections', secOpen, secClose);
console.log('old .hero wrap gone:', !html.includes('class=\"hero wrap\"'));
console.log('hbanner slides:', (html.match(/class=\"hbanner-slide\"/g)||[]).length);
console.log('h1 present:', /<h1>/.test(html));
const ids = [...html.matchAll(/(?<!data-)\bid=\"([^\"]+)\"/g)].map(m=>m[1]);
const seen={}; ids.forEach(i=>seen[i]=(seen[i]||0)+1);
console.log('dup ids:', Object.entries(seen).filter(([k,v])=>v>1).map(([k,v])=>k+':'+v).join(', ')||'none');
"
```

Expected: sections balanceados (mismo número open/close), `old .hero wrap
gone: true`, `hbanner slides: 1`, `h1 present: true`, `dup ids: none`.

- [ ] **Step 6: Revisión manual del diff**

```bash
cd /c/Users/Martin/projects/proyecto-1 && git diff --stat && git diff index.html
```

Confirmar a ojo: no quedó ningún `.hero-img`, `.hero-in` o `.hero h1`
huérfano en el CSS: `grep -n "\.hero-img\|\.hero-in\|\.hero h1\|\.hero-sub{" index.html`
no debe devolver nada (las clases `.hero-badges`, `.hero-cta`, `.hero-hint`
sí deben seguir existiendo — se reutilizan dentro de `.hbanner-fixed`).

- [ ] **Step 7: Commit**

```bash
cd /c/Users/Martin/projects/proyecto-1 && git add index.html assets/avengers-marmol.webp && git commit -m "$(cat <<'EOF'
Reemplaza el hero de dos columnas por banner panorámico (slide único)

Primer paso del carrusel: banner de ancho completo con la foto de la
colección Avengers, sin animación todavía (un solo slide no la
necesita). El CTA, el sello de Instagram/estrellas y la línea de precio
pasan a .hbanner-fixed, superpuestos sobre la foto con un scrim para
legibilidad, en vez de vivir en una columna de texto aparte.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013NCtYFTZA7CaUPPeLq8Wyv
EOF
)" && git push origin claude/zephora-empaque-hero
```

---

## Task 3: Agregar el segundo slide (marca), rotación y botón de pausa

**Bloqueada hasta que exista `assets/hero-marca-ancho.webp`** (o el nombre
que se le dé): el asset actual del hero viejo (`pulsera-zephora-armada-con-charms-en-plata-925.webp`,
502×900 vertical) no sirve para este banner — hace falta generar una foto
nueva en formato ancho con Flow, siguiendo el mismo método de referencia que
la de Avengers (ver spec, sección "Especificación de imagen"). No empezar
esta tarea sin esa foto.

**Files:**
- Modify: `index.html` (bloque CSS `.hbanner*` agregado en la Task 2 — se
  suman las reglas de rotación y el botón de pausa)
- Modify: `index.html` (sección `.hbanner` agregada en la Task 2 — se suma
  el segundo `.hbanner-slide` y el botón de pausa)
- Modify: `index.html` (bloque `<script>`, cerca de la línea 1978 donde se
  define `const $=s=>document.querySelector(s);` — se agrega el toggle)

**Interfaces:**
- Consumes: `assets/hero-marca-ancho.webp` (o la ruta real), clases
  `.hbanner`, `.hbanner-track`, `.hbanner-slide`, `.hbanner-copy` de la
  Task 2, helper `$` ya definido en el script.
- Produces: `.hbanner-pause` (botón), clase `.paused` togleada en
  `.hbanner-track`.

- [ ] **Step 1: Verificar las dimensiones del nuevo asset**

```bash
cd /c/Users/Martin/projects/proyecto-1 && file assets/hero-marca-ancho.webp
```

Anotar ancho×alto real, igual que se hizo con el de Avengers en la Task 1.

- [ ] **Step 2: Agregar el segundo `.hbanner-slide` al HTML**

Dentro de `.hbanner-track`, después del `.hbanner-slide` de Avengers,
agregar (sustituyendo `ANCHO_REAL`/`ALTO_REAL` por lo anotado en el Step 1):

```html
    <div class="hbanner-slide">
      <img class="hbanner-img" src="assets/hero-marca-ancho.webp" alt="Pulsera Zephora armada con charms en Plata 925" width="ANCHO_REAL" height="ALTO_REAL" decoding="async">
      <div class="hbanner-copy">
        <span class="eyebrow">Joyería con significado · Colombia</span>
        <h1>Diseña una historia<br><i>tan única como tú</i></h1>
        <p class="hbanner-sub">Joyería personalizada con charms elaborados en Plata Esterlina 925 verificada y brazaletes con acabado de alta calidad en baño de plata, compatibles con Pandora.</p>
      </div>
    </div>
```

Nota: esta foto va **segunda** en el DOM (después de la de Avengers), pero
la Task 2 ya dejó a Avengers como el slide que se ve primero al cargar
(`fetchpriority="high"`). El orden de aparición en la rotación lo define el
`animation-delay` del Step 3, no el orden del DOM — se decide ahí cuál
slide se ve primero.

- [ ] **Step 3: Agregar las reglas CSS de rotación**

Justo después de las reglas `.hbanner-sub{...}` agregadas en la Task 2,
insertar:

```css
/* Rotación 100% CSS, mismo mecanismo que .ann/.ann-slide. Los porcentajes
   de abajo están calculados a mano para 2 slides (5s cada uno, 10s de
   ciclo total). Si se agrega un tercer slide, hay que recalcular: ciclo
   pasa a 15s, cada tramo a 1/3 del keyframe, y sumar un tercer
   animation-delay — no se ajusta solo. */
.hbanner-slide{opacity:0;animation:hbf 10s infinite}
.hbanner-slide:nth-child(1){animation-delay:0s}
.hbanner-slide:nth-child(2){animation-delay:-5s}
@keyframes hbf{0%{opacity:0}4%,46%{opacity:1}50%,100%{opacity:0}}
.hbanner-track.paused .hbanner-slide{animation-play-state:paused}
```

- [ ] **Step 4: Agregar el botón de pausa al HTML**

Dentro de `<section class="hbanner">`, después de `</div>` que cierra
`.hbanner-track` y antes de `<div class="hbanner-fixed">`, agregar:

```html
  <button class="hbanner-pause" type="button" aria-label="Pausar rotación de fotos" aria-pressed="false">
    <svg class="ico-pause" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
    <svg class="ico-play" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
  </button>
```

- [ ] **Step 5: Agregar el CSS del botón de pausa**

Junto a las reglas del Step 3:

```css
.hbanner-pause{position:absolute;top:14px;right:16px;z-index:3;width:34px;height:34px;
  border-radius:50%;border:1px solid rgba(255,255,255,.5);background:rgba(42,31,46,.45);
  color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}
.hbanner-pause .ico-play{display:none}
.hbanner-pause[aria-pressed="true"] .ico-pause{display:none}
.hbanner-pause[aria-pressed="true"] .ico-play{display:block}
```

- [ ] **Step 6: Agregar `prefers-reduced-motion` para el banner**

Buscar el bloque existente cerca de la línea 966:
```css
@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important;
    scroll-behavior:auto!important}
}
```

Este bloque ya fuerza `animation-duration:.01ms` a **todo**, incluido
`.hbanner-slide` — pero eso dejaría los slides parpadeando muy rápido en
vez de mostrar uno fijo. Igual que `.ann` resuelve esto con su propio
override específico (línea 96-98), agregar dentro del mismo bloque:

```css
  .hbanner-slide{animation:none;opacity:0}
  .hbanner-slide:first-child{opacity:1}
```

- [ ] **Step 7: Agregar el JS del botón de pausa**

Cerca de la línea 1978, justo después de `const $=s=>document.querySelector(s);`,
agregar:

```js
const hbTrack=$('.hbanner-track');
const hbPause=$('.hbanner-pause');
hbPause.addEventListener('click',()=>{
  const paused=hbTrack.classList.toggle('paused');
  hbPause.setAttribute('aria-pressed', paused ? 'true' : 'false');
});
```

- [ ] **Step 8: Verificación estructural**

```bash
cd /c/Users/Martin/projects/proyecto-1 && node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
console.log('hbanner slides:', (html.match(/class=\"hbanner-slide\"/g)||[]).length);
console.log('pause button:', html.includes('class=\"hbanner-pause\"'));
console.log('keyframe present:', /@keyframes hbf/.test(html));
console.log('reduced-motion override:', html.includes('.hbanner-slide{animation:none;opacity:0}'));
const secOpen = (html.match(/<section/g)||[]).length;
const secClose = (html.match(/<\/section>/g)||[]).length;
console.log('sections', secOpen, secClose);
"
```

Expected: `hbanner slides: 2`, `pause button: true`, `keyframe present:
true`, `reduced-motion override: true`, sections balanceados.

- [ ] **Step 9: Verificación manual del JS**

No hay navegador headless disponible en este entorno (ver memoria
`windows_headless_browser_unavailable` — no reintentar Playwright/Edge
headless). Verificar a ojo: `$('.hbanner-track')` y `$('.hbanner-pause')`
deben resolver a elementos que existen en el HTML ya escrito (confirmar con
`grep -n "class=\"hbanner-track\"\|class=\"hbanner-pause\"" index.html`).
Pedirle al usuario que abra la rama localmente y confirme visualmente: las
fotos rotan cada 5s, el botón pausa/reanuda, y con "reducir movimiento"
activado en el sistema operativo se queda fija la primera foto.

- [ ] **Step 10: Commit**

```bash
cd /c/Users/Martin/projects/proyecto-1 && git add index.html assets/hero-marca-ancho.webp && git commit -m "$(cat <<'EOF'
Agrega segundo slide, rotación automática y botón de pausa al hero

Completa el carrusel: dos slides (marca + Avengers) rotando cada 5s con
el mismo mecanismo 100% CSS que ya usa el ticker de avisos (.ann), más
un botón de pausa con JS mínimo — a diferencia del ticker, este banner
sí lo necesita por ser un elemento mucho más grande y prominente.
Respeta prefers-reduced-motion igual que el ticker.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013NCtYFTZA7CaUPPeLq8Wyv
EOF
)" && git push origin claude/zephora-empaque-hero
```

---

## Notas finales

- Este plan completa la cuarta y última idea del rediseño inspirado en la
  crítica de Juli & Co. Con la Task 3 terminada, las 4 ideas (empaque,
  autoridad Plata 925, densidad, hero) quedan implementadas en
  `claude/zephora-empaque-hero`, todas sin fusionar a `main` hasta que
  Netlify tenga créditos de despliegue de nuevo.
- Actualizar `ESTADO.md` al terminar la Task 3, sumando el hero a la lista
  de cambios que ya reclama esta rama (igual que se hizo tras cada tarea
  anterior).
