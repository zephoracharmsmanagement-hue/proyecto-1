# Encargo: los brazaletes vuelven a baño de plata, con pisos nuevos

Pégale esto a la sesión de terminal. Está verificado contra el repo el
2026-09-22 (HEAD `319cbde`). Rama de trabajo:
`claude/zephoracharms-conversion-funnel-nom9ph`. Arranca con `git fetch --all`.

---

## Qué cambia

**Material.** Los **charms siguen siendo Plata Esterlina 925 y no se tocan.**
Solo los **18 brazaletes** vuelven a **baño de plata sobre base de latón de
calidad joyería, con capa protectora e-coating** — exactamente como estaban
antes del commit `8e234d9`.

**Precios.** Tres pisos nuevos: **$78.000 · $82.000 · $88.000**.

## Lo primero, porque es lo que puede romper todo

**No cambies un solo precio por su número. Cámbialos por `id`.** Los tres
pisos nuevos coinciden exactamente con precios que ya tienen 30 charms:

| Piso nuevo | Charms que YA valen eso |
|---|---|
| $78.000 | 5 charms (los 4 clips + `corazon-mama-e-hija`) |
| $82.000 | **22 charms** |
| $88.000 | 3 charms (`corazon-de-filigrana`, `elefantito-rosa`, `corazon-arbol-de-la-vida`) |

Un `sed` de `82000` toca 22 charms que no deben moverse. La verificación
tampoco puede ser por número: contar cuántas piezas valen $82.000 no distingue
un brazalete de un charm. **Verifica por `id`.**

Mapeo exacto, 18 ids:

```
118000 -> 78000   pulsera-avengers · pulsera-corazon-con-diamante ·
                  pulsera-corazon-liso · pulsera-clasica-cierre-barril ·
                  pulsera-corazon-pave-pequeno · pulsera-copo-de-nieve ·
                  pulsera-trebol-verde · pulsera-rosa-clasica
138000 -> 82000   pulsera-corona-con-cristales · pulsera-corazon-pave ·
                  pulsera-corona-pave · pulsera-mano-de-hamsa ·
                  pulsera-corazon-luminoso · pulsera-mickey-mouse-pave
158000 -> 88000   pulsera-sol-con-cadena-seguridad ·
                  pulsera-corazon-rosado-con-cadena ·
                  pulsera-candado-rosa-con-cadena · pulsera-mono-rosa-con-cadena
```

## El atajo que ahorra la mitad del trabajo

El cambio a 925 fue **un solo commit, `8e234d9`**, y tocó 14 archivos. El texto
anterior —el de baño de plata— **está íntegro en git**, no hay que reescribirlo:

```
git show 8e234d9^:preguntas-frecuentes.html
git show 8e234d9 --stat
```

Así que la parte de **material es una reversión asistida por git**, no una
redacción nueva. Eso importa porque el texto viejo era preciso («latón de
calidad joyería», «baño de plata certificado», «capa protectora e-coating») y
reinventarlo a mano es donde se cuelan las afirmaciones falsas.

**Pero `8e234d9` cambió material Y precios juntos.** Revertir el commit entero
dejaría los precios en 68/78/88, que **no** es lo que se quiere. El orden
correcto:

1. Revertir **solo la parte de material** archivo por archivo, usando
   `git show 8e234d9^:<archivo>` como referencia.
2. Aplicar los precios nuevos **por id**, encima.

Los archivos de `8e234d9` son el punto de partida, pero **la lista de hoy es más
larga**: `kits.html`, `assets/kits.json` y `gen_colecciones.py` nacieron
*después* de ese commit y también afirman 925 en los brazaletes.

## Dónde vive cada cosa

### Precio (4 sitios, y los 4 tienen que coincidir)

- `tienda.js` — `const DATA={…}` (línea 12). Es la fuente.
- `index.html` — 18 `.pc-price` en las tarjetas **más los 3 `.tier-price` de
  las cabeceras de nivel** (líneas 333, 362, 385). Es fácil olvidar las
  cabeceras: dirían «Nivel $118.000» sobre tarjetas de $78.000.
- `assets/catalogo.json` y `assets/stock.json` — **no se editan a mano.** Salen
  de `python3 herramientas/extraer_catalogo.py`. Córrelo *después* de tocar
  `tienda.js` e `index.html`; lee de los dos.
- `netlify/functions/_precios.js` los consume: **es lo que firma el cobro de
  Wompi.** Si `catalogo.json` no se regenera, la página muestra $78.000 y el
  checkout cobra $118.000.

### Material (los charms NO se tocan — ese es el riesgo de hoy)

De las **148 apariciones de «Plata 925»**, la enorme mayoría son los sellos
`.pc-mark` de las tarjetas de **charm**, que siguen siendo verdad. Un
buscar-y-reemplazar global le quita la afirmación correcta a 117 charms. El
discriminador está a mano:

- `index.html` — **`pc-mark--b` es el de brazalete: 18, y son exactamente esos
  18.** Los 91 `pc-mark` a secas de `index.html` son charms y no se tocan.
- `tienda.js` — la ficha bifurca en `if(esB)`: **línea 439** brazalete,
  **línea 442** charm. Y en el carrito, **línea 488** brazalete
  (`'Brazalete · Plata 925'`), **493** charm.
- `checkout.html` — **línea 713** brazalete, **719** charm. Mismo patrón.
- `netlify/functions/disponibilidad.mjs` — **línea 123** brazalete,
  **línea 137** charm. Es lo que lee el asesor de WhatsApp.
- `preguntas-frecuentes.html` y `terminos-y-condiciones.html` — **generados**
  por `herramientas/gen_paginas.py` (líneas 188, 199-200, 359-373, 559, 565).
  **Edita el generador y regenera**, no el HTML.
- `kits.html` — **generado** por `herramientas/gen_colecciones.py` (líneas 505,
  513, 518, 534, 639).
- `coleccion-marvel.html` — mismo generador (líneas 57, 59, 246).
- `assets/kits.json` — dos kits dicen «Plata Esterlina 925» del **brazalete** en
  su `entrada`/`lema`. Este sí es a mano: lo edita una persona.
- `automatizaciones/prompts/asesor-whatsapp.md` — **ojo: está escrito SIN
  TILDES.** Buscar «baño» o «latón» devuelve 0 y parece que no hay nada. Busca
  `bano`, `laton`, `925`.
- `pruebas/dudas.js` y `pruebas/disponibilidad.js` — las guardas afirman 925 en
  brazaletes. **Inviértelas**, no las borres: son justo lo que impide que esto
  se vuelva a torcer en silencio.

## Tres textos que no son un reemplazo de palabra

No basta con cambiar «925» por «baño» — el párrafo entero dice otra cosa:

1. **`preguntas-frecuentes.html`, «¿De qué material…?»** — hoy termina en
   **«No son baño de plata: son plata.»** Es una negación explícita que se
   convierte en mentira explícita. Y está **duplicada en el JSON-LD `FAQPage`**
   de la línea 27, que es lo que Google indexa y muestra en resultados. Los dos
   sitios, o queda publicado en el buscador.
2. **«¿Se pone negra o se oxida?»** — hoy afirma que se oxida «tanto en los
   charms como en los brazaletes». El baño no se oxida igual: se desgasta. El
   texto viejo lo decía bien y distinguía los dos casos.
3. **«¿Tienen níquel o causan alergia?»** — hoy funda lo hipoalergénico en que
   todo es 925. Con base de latón la afirmación depende del baño y de la base,
   no de la plata. El texto viejo lo redactaba así y es el que hay que
   restaurar; **no inventes una versión nueva de esta**, que es la única de las
   tres con consecuencia sanitaria.

Y **`terminos-y-condiciones.html` es un documento contractual**, no marketing:
describe el material en la cláusula de producto (líneas 46, 57-58). El propio
sitio cita la Ley 1480 de 2011 en la garantía. Un contrato que declara plata
donde hay baño es exactamente lo que esa ley sanciona. Que no se quede de
último.

## Lo que hay que recalcular, no copiar

`ESTADO.md` (líneas 54, 76, 233, 261, 379) y
`automatizaciones/contenido/CALENDARIO-EDITORIAL.md` traen cifras del tipo «el
tercer dije cuesta X» calculadas **sobre el brazalete a $118.000**. Todas
cambian. Regla del repo, ya pagada una vez: **un número de precio en cualquier
documento tiene que poder reproducirse corriendo `calcular()`. Si no, no se
escribe.** Recalcúlalas; no las estimes.

## Comprobación antes de dar nada por bueno

```bash
python3 herramientas/extraer_catalogo.py          # tras tocar tienda.js e index.html
python3 herramientas/gen_paginas.py               # FAQ y términos
python3 herramientas/gen_colecciones.py           # kits y marvel
node pruebas/*.js                                 # regresion y dudas ya fallaban por entorno
```

Y una verificación cruzada explícita, por id, de los tres sitios:

- los 18 brazaletes valen 78/82/88 en `tienda.js`, `catalogo.json` y `stock.json`;
- **los 117 charms no cambiaron de precio** — compara contra `git show HEAD:tienda.js`;
- **los 117 charms siguen diciendo 925** — `grep -o 'class="pc-mark"' index.html | wc -l`
  tiene que seguir dando 91;
- ningún `pc-mark--b` dice 925;
- los 3 `.tier-price` dicen 78/82/88.

**Lo que las pruebas no atrapan** (las tres cosas que ya llegaron a producción
con la suite en verde): que una página quede huérfana, que un enlace no lleve a
ningún lado, y que una sección salga sin estilos. Abre la portada, los kits y la
FAQ y míralas antes de cerrar.

## Al desplegar

Solo **`main`** publica. Netlify se salta el despliegue si el push solo cambia
`*.md`, así que este archivo no cuesta créditos; el cambio de precios sí
(~15 créditos). Empuja a la rama, mezcla a `main`, y **vuelve a la rama después
de empujar** — ya pasó que un commit se quedó sin remoto por no hacerlo.

**La prueba que solo puede hacer el propietario:** comprar un brazalete de
$78.000 y confirmar que Wompi cobra exactamente $78.000. Es la única forma de
saber que `catalogo.json` se regeneró de verdad.

## Nota de margen

El costo por brazalete ronda los **$18.742**. A $78.000 el margen sigue en
~76%, y con el 30% de descuento por 3+ dijes el brazalete baja a $54.600, que
aún deja ~66%. **El cambio de precio no compromete la economía unitaria** — no
hace falta rehacer los cálculos de CAC.

## Lo que ya está resuelto y no hay que tocar

Las fotos llevaban encima un sello rojo «S925 / Real Sterling Silver» del
proveedor. **Se borró en 11 de 11** (`ESTADO.md`, `herramientas/quitar_sello.py`).
Si no se hubiera hecho, hoy habría fotos de brazalete afirmando 925 en la
imagen misma, donde ningún buscar-y-reemplazar llega. Está cerrado; solo
conviene no volver a subir fotos de proveedor con sello.

## Aviso: hay otra sesión trabajando en esta misma rama

Mientras se preparaba este encargo, otra sesión empujó cuatro commits a
`claude/zephoracharms-conversion-funnel-nom9ph` que tocan `tienda.js`,
`index.html`, `kits.html`, `tienda.css` y `gen_colecciones.py` — el menú ☰ y el
aviso de agotado en los kits. Los números de línea de arriba están
reverificados contra `319cbde`, pero **vuelve a comprobarlos con `grep` antes
de editar**: son una guía de dónde mirar, no coordenadas fijas.

La regla 1 de `CLAUDE.md` dice que una sola sesión toca la tienda. Este cambio
entra en `tienda.js`, `index.html` y los generadores, que es justo donde está
la otra. **Conviene que esa sesión termine y mezcle antes de empezar este
encargo**, o coordinarlo explícitamente — no por conflictos de git, sino
porque los dos cambios se pisan en los mismos archivos.
