#!/usr/bin/env python3
"""Genera las páginas de colección de zephoracharms.com.

Son las páginas a las que apunta la pauta: alguien ve un anuncio de Spider-Man
y aterriza en una página que habla de Spider-Man, no en la portada general
donde tiene que buscar. Cada una trae el catálogo acotado a su colección más
todo el material de confianza —tallas, videos, reseñas, pagos y envío—, porque
ahí es donde llega tráfico frío que no conoce la tienda.

── Por qué se generan y no se escriben a mano ──

El andamiaje interactivo (carrito, ficha de producto, buscador, dock) vive en
`tienda.js`, que accede sin protección a unos sesenta elementos por `id`. Una
página de colección a la que le falte uno rompe el carrito **sin dar ningún
error visible**: la clienta agrega y no pasa nada. Copiar ese bloque a mano en
cada página nueva es justo el patrón que `CLAUDE.md` marca como el error más
caro de este repo.

Así que nada se copia a mano: **todo se extrae de `index.html`**, que sigue
siendo la única fuente. Las tarjetas de producto también, buscadas por su
`data-id`, para que una foto o un precio corregidos en la portada lleguen solos
a las colecciones. Si `index.html` cambia el andamiaje, se vuelve a correr esto
y las colecciones siguen el cambio.

── Cómo se usa ──

    python3 herramientas/gen_colecciones.py            # muestra qué haría
    python3 herramientas/gen_colecciones.py --escribir # escribe los archivos

Los precios que se muestran NO se escriben aquí: se calculan con `calcular()`
de `netlify/functions/_precios.js`, por la regla del repo —un número de precio
que no se puede reproducir con `calcular()` no se escribe—. Ver
`precios_de_combo()`.
"""
import json
import pathlib
import re
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
INDEX = RAIZ / 'index.html'

# ── Las colecciones ─────────────────────────────────────────────────────────
#
# `grupo` es el que ya usa `assets/catalogo.json` (lo escribe
# herramientas/extraer_catalogo.py desde index.html), así que una pieza nueva
# entra sola en su colección sin tocar este archivo. `base` es el brazalete que
# se propone como combo: tiene que ser uno con unidades de verdad.
COLECCIONES = [
    {
        'archivo': 'coleccion-marvel.html',
        'grupo': 'Marvel',
        'titulo': 'Colección Marvel',
        'eyebrow': 'Colección',
        'lema': 'Los héroes, en plata 925',
        'entrada': (
            'Quince piezas de Marvel en Plata Esterlina 925 verificada, montadas '
            'sobre la Pulsera Avengers. Cada charm cuenta algo: el escudo, el '
            'martillo, la telaraña. Se arma pieza por pieza y se paga en línea o '
            'contraentrega.'
        ),
        'base': 'pulsera-avengers',
        'og': 'assets/pulsera-armada-con-muranos-camaleon-verde-y-atrapa.jpg',
        # La misma foto del banner de la portada. Quien llega de un anuncio de
        # esta coleccion tiene que ver la pieza antes que ningun texto: sin
        # imagen sobre el pliegue, el anuncio ensena algo y la pagina no se lo
        # confirma.
        'foto': 'assets/avengers-marmol.webp',
        'foto_alt': 'Pulsera Zephora con charms de la coleccion Avengers sobre marmol negro',
        'foto_w': 1600, 'foto_h': 893,
    },
    {
        'archivo': 'coleccion-simbolos.html',
        'grupo': 'Símbolos',
        'titulo': 'Colección Símbolos',
        'eyebrow': 'Colección',
        'lema': 'Lo que llevas contigo, en plata 925',
        'entrada': (
            'Fe, amor, viajes, mascotas y buena suerte en Plata Esterlina 925 '
            'verificada. Cada charm guarda una historia: la tuya o la de alguien '
            'a quien quieres regalársela. Se arma pieza por pieza y se paga en '
            'línea o contraentrega.'
        ),
        'base': 'pulsera-corazon-liso',
        'og': 'assets/pulsera-zephora-completa-con-charms-de-virgen-pati.jpg',
        'foto': 'assets/pulsera-zephora-completa-con-charms-de-virgen-pati.jpg',
        'foto_alt': 'Pulsera Zephora completa con charms de virgen, patica de perro y muranos azules',
        'foto_w': 720, 'foto_h': 900,
        # Vertical: a lo ancho mediría más de una pantalla. Se recorta.
        'foto_clase': ' col-foto--vertical',
    },
]


# ── Extracción de index.html ────────────────────────────────────────────────

def _entre(html, inicio, fin, desde=0):
    """El trozo de html entre dos marcas, marcas incluidas."""
    a = html.index(inicio, desde)
    b = html.index(fin, a) + len(fin)
    return html[a:b]


def bloques(html):
    """Los trozos compartidos de index.html, tal cual están ahí.

    Si alguna marca deja de existir, `index` lanza ValueError y el generador se
    cae en vez de escribir una página a la que le falte el carrito. Es a
    propósito: el fallo tiene que ser ruidoso — una página de colección sin
    andamiaje no da error en el navegador, solo deja de vender.
    """
    b = {}
    # <head>: de <meta charset> hasta la hoja de estilos. El bloque incluye los
    # fbq('init', …) del único píxel, 2005297310144764 desde el 2026-11-10.
    # Ver CLAUDE.md § Píxeles.
    # Hasta el <link> de la hoja, SIN incluirlo: la plantilla pone el suyo, y
    # con los dos la página salía enlazando tienda.css dos veces.
    b['head'] = _entre(html, '<link rel="preconnect" href="https://fonts.googleapis.com">',
                       '<link rel="stylesheet" href="tienda.css">')
    b['head'] = b['head'][:b['head'].rindex('<link rel="stylesheet"')].rstrip()
    b['ann'] = _entre(html, '<div class="ann"', '</div>\n</div>')
    b['header'] = _entre(html, '<header class="top">', '</header>')
    b['talla'] = _entre(html, '<section class="talla-sec" id="talla">', '</section>')
    b['historia'] = _entre(html, '<section class="story" id="historia">', '</section>')
    b['resenas'] = _entre(html, '<section class="social" id="reseñas">', '</section>')
    b['pagos'] = _entre(html, '<section class="pe wrap" id="pagos">', '</section>')
    b['confianza'] = _entre(html, '<section class="trust-sec">', '</section>')
    b['footer'] = _entre(html, '<footer class="foot">', '</footer>')
    # Todo el andamiaje interactivo de una vez: veil, carrito, aviso, dock,
    # ficha de producto y el visor de fotos con su script.
    b['chrome'] = _entre(html, '<div class="veil" id="veil"></div>', '</body>')
    b['chrome'] = b['chrome'][:b['chrome'].index('</body>')]
    return b


def tarjetas(html, ids):
    """Las tarjetas <article class="pc"> de index.html, por data-id.

    Se extraen del HTML real y no se reconstruyen: la tarjeta lleva la foto con
    su versión de caché, las medidas, el alt y las marcas de agotado, y
    reescribir todo eso aquí sería una segunda copia que se desincroniza.
    """
    out, faltan = [], []
    for pid in ids:
        m = re.search(r'<article class="pc[^"]*" data-id="%s"[ >]' % re.escape(pid), html)
        if not m:
            faltan.append(pid)
            continue
        a = m.start()
        # La tarjeta termina en su </article>; no hay <article> anidados.
        b = html.index('</article>', a) + len('</article>')
        # `pc--top` es la variante del carrusel de destacados de la portada. En
        # la rejilla de una colección estorba: fija un ancho de carrusel.
        out.append(html[a:b].replace('class="pc pc--top"', 'class="pc"'))
    if faltan:
        raise SystemExit('No se encontró la tarjeta de: ' + ', '.join(faltan)
                         + '\nRevisa que la pieza exista en index.html.')
    return out


# ── Precios, calculados nunca escritos ──────────────────────────────────────

def precios_de_combo(base, charms):
    """Corre `calcular()` de verdad y devuelve los totales del combo.

    Regla del repo (CLAUDE.md § Contenido orgánico): un número de precio que no
    se pueda reproducir con `calcular()` no se escribe. Ya pasó una vez que un
    documento afirmaba estar «verificado corriendo calcular()» y ninguno de sus
    tres números se reproducía. Así que aquí no se escribe ninguno: se piden.
    """
    guion = '''
const {calcular, cop} = require('./netlify/functions/_precios.js');
const base = %s, charms = %s;
const con = n => calcular({base, charms: charms.slice(0, n), pago: 'anticipado'});
const solo = calcular({base: null, charms: charms.slice(0, 1), pago: 'anticipado'});
const sola = calcular({base, charms: [], pago: 'anticipado'});
const dos = con(2), tres = con(3);
console.log(JSON.stringify({
  charmSolo: cop(solo.total),
  pulseraSola: cop(sola.total),
  dos: cop(dos.total),
  tres: cop(tres.total),
  ahorroTres: cop(tres.descuento),
  ahorroDos: cop(dos.descuento),
  tercerCharm: cop(tres.total - dos.total),
  contraentrega: cop(calcular({base, charms: charms.slice(0, 3), pago: 'contraentrega'}).total),
}));
''' % (json.dumps(base), json.dumps(charms[:3]))
    r = subprocess.run(['node', '-e', guion], cwd=RAIZ, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit('calcular() falló:\n' + r.stderr)
    p = json.loads(r.stdout)
    # La nota de envío bajo el combo. Desde el 2026-11-20 la contraentrega no
    # paga envío con 2 piezas o más, así que el combo cuesta lo mismo de las dos
    # formas; si la regla cambia y vuelve a costar distinto, se dice cuánto.
    p['contraentrega'] = ('Precios con envío gratis, pagando en línea o contraentrega.'
                          if p['contraentrega'] == p['tres'] else
                          'Precios con pago anticipado y envío gratis. Contraentrega: %s '
                          '(el envío lo cobra la transportadora al recaudar).' % p['contraentrega'])
    return p


# ── Los escalones del combo ─────────────────────────────────────────────────
#
# Eran <div>: en Clarity (2026-11-20) las clientas tocaban «Brazalete solo
# $78.000» en la página de Marvel y no pasaba nada. Ahora cada escalón lleva a
# algo (tienda.js, «Escalones y atajos»): el del brazalete pide su talla en su
# tarjeta; los de charms llevan a las piezas con un aviso corto de qué hacer.

def escalones(base, p, ir='#piezas'):
    return '''  <div class="col-escalera">
    <button type="button" class="col-paso" data-elegir-base="{base}" data-aviso="Elige tu talla: es la medida de tu muñeca más 2 cm."><span class="col-paso-n">Brazalete solo</span><b>{sola}</b><span class="col-paso-ir">Elegir talla</span></button>
    <button type="button" class="col-paso" data-ir="{ir}" data-aviso="Elige 2 charms y agrégalos: con el brazalete son 3 piezas."><span class="col-paso-n">+ 2 charms</span><b>{dos}</b><span class="col-paso-ir">Elegir mis 2 charms</span></button>
    <button type="button" class="col-paso col-paso--best" data-ir="{ir}" data-aviso="Elige 3 charms: con el brazalete son 4 piezas y la de menor valor te sale gratis."><span class="col-paso-n">+ 3 charms · 4 piezas</span><b>{tres}</b>
      <span class="col-paso-ahorro">una GRATIS · ahorras {ahorro}</span><span class="col-paso-ir">Elegir mis 3 charms</span></button>
  </div>'''.format(base=base, ir=ir, sola=p['pulseraSola'], dos=p['dos'], tres=p['tres'], ahorro=p['ahorroTres'])


# ── La página ───────────────────────────────────────────────────────────────

PAGINA = '''<!DOCTYPE html>
<html lang="es-CO">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
{redir}<title>{titulo} · Zephora Charms</title>
<meta name="description" content="{desc}">
<link rel="icon" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iNCIgZmlsbD0iIzJBMUYyRSIvPjx0ZXh0IHg9IjE2IiB5PSIyMyIgZm9udC1mYW1pbHk9Ikdlb3JnaWEsc2VyaWYiIGZvbnQtc2l6ZT0iMTkiIGZpbGw9IiNGNkYzRjQiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlo8L3RleHQ+PC9zdmc+">
<meta name="theme-color" content="#2A1F2E">
<link rel="canonical" href="https://zephoracharms.com/{archivo}">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_CO">
<meta property="og:site_name" content="Zephora Charms">
<meta property="og:title" content="{titulo} · Zephora Charms">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="https://zephoracharms.com/{archivo}">
<meta property="og:image" content="https://zephoracharms.com/{og}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{titulo} · Zephora Charms">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="https://zephoracharms.com/{og}">
{head}
<link rel="stylesheet" href="tienda.css">
<script src="/assets/clarity.js" defer></script>
</head>
<body>

{ann}

{header}

<!-- 1 · PORTADA DE LA COLECCIÓN — a esto apunta la pauta. Quien llega viene de
     un anuncio de esta colección, así que lo primero que ve es la colección,
     no el catálogo entero. -->
<section class="col-hero wrap" id="top">
  <img class="col-foto{foto_clase}" src="{foto}" alt="{foto_alt}" width="{foto_w}" height="{foto_h}"
       fetchpriority="high" decoding="async">
  <span class="eyebrow">{eyebrow}</span>
  <h1>{lema}</h1>
  <p class="col-entrada">{entrada}</p>
  <div class="col-cta">
    <a class="btn" href="#piezas">Ver las {n_piezas} piezas</a>
    <a class="btn btn--ghost" href="#combo">Armar el combo</a>
  </div>
  <p class="col-envio">Envío <b>GRATIS</b> a toda Colombia pagando en línea · contraentrega disponible</p>
</section>

<!-- 2 · EL COMBO. Los precios salen de calcular(), no están escritos: los
     escribe el generador corriendo el mismo código que firma el cobro. -->
<section class="col-combo wrap" id="combo">
  <h2>El combo de la colección</h2>
  <p class="col-sub">Brazalete + 3 charms son <b>4 piezas</b>: pagas 3 y la de menor valor te
  sale <b>gratis</b>. Con 6 piezas son 2 gratis. Se aplica solo en el carrito.</p>
{escalera}
  <p class="col-nota">{contraentrega}</p>
</section>

<!-- 3 · LAS PIEZAS. Las tarjetas salen de index.html por data-id: misma foto,
     mismo precio, mismas marcas de agotado. -->
<section class="sec" id="piezas">
  <div class="wrap">
    <span class="eyebrow">{eyebrow}</span>
    <h2>{titulo}</h2>
    <p class="col-sub">{n_piezas} piezas. Todas en Plata Esterlina 925 verificada.</p>
    <div class="grid">
{tarjetas_charms}
    </div>
  </div>
</section>

<!-- 4 · EL BRAZALETE BASE. Va aparte porque es la decisión distinta: aquí se
     elige talla, y de la talla depende cuántos charms caben. -->
<section class="sec" id="brazaletes">
  <div class="wrap">
    <span class="eyebrow">La base</span>
    <h2>El brazalete de la colección</h2>
    <p class="col-sub">Elige tu talla. Si no la sabes, la calculadora de abajo la saca de la medida de tu muñeca.</p>
    <!-- #b-filters lo exige tienda.js (le cuelga un listener sin comprobar que
         exista). Vacío aquí: una sola base no necesita filtros. -->
    <div class="filters" id="b-filters" hidden></div>
    <div class="grid grid--base">
{tarjeta_base}
    </div>
  </div>
</section>

{talla}

{historia}

{resenas}

{pagos}

{confianza}

<!-- 5 · SALIDA AL CATÁLOGO COMPLETO. Quien llegó por Spider-Man y quiere otra
     cosa no se puede quedar sin salida: es venta que ya está en la página. -->
<section class="col-resto wrap">
  <h2>¿Buscabas otra cosa?</h2>
  <p class="col-sub">Hay {n_catalogo} charms más en el catálogo completo: {otras}.</p>
  <a class="btn btn--ghost" href="index.html#charms">Ver el catálogo completo</a>
</section>

{footer}

<!-- Contenedores que tienda.js exige por id. Van vacíos y ocultos: esta página
     no muestra el catálogo completo ni la rejilla de iniciales, pero el script
     les cuelga listeners sin comprobar que existan, y sin ellos el carrito se
     cae entero antes de llegar a la primera tarjeta. -->
<div hidden>
  <button type="button" id="ver-todos"></button>
  <button type="button" id="more-btn"></button>
  <span id="count"></span>
  <div id="rail-top"></div>
  <div id="full-cat" hidden>
    <div class="filters" id="filters"></div>
    <!-- El buscador del catálogo completo. Sin #q y #q-x, tienda.js lanza
         «Cannot read properties of null» al arrancar y el carrito queda mudo:
         las tarjetas se ven, se pueden tocar, y no pasa nada. Comprobado. -->
    <input type="search" id="q" aria-hidden="true" tabindex="-1">
    <button type="button" id="q-x" hidden></button>
    <div class="grid" id="resto-grid"></div>
  </div>
  <!-- La rejilla de iniciales. tienda.js sí comprueba que exista antes de
       pintarla, pero se incluye para no depender de esa guarda. -->
  <div class="letras-grid" id="letras-grid" role="group" aria-label="Elegir inicial"></div>
</div>

{chrome}
</body>
</html>
'''


def arregla_nav(pagina):
    """Deja usables, fuera de la portada, los enlaces que se copian de ella.

    La cabecera, el pie y el aviso del carrito vienen de `index.html`, y sus
    enlaces son **anclas** a secciones que solo existen allí. En `kits.html`
    eso dejaba cuatro enlaces del menú sin hacer nada, el botón «Ver charms»
    del aviso igual, y el logotipo apuntando a `#top` —el principio de la
    propia página—, así que **no había forma de volver a la portada**. Lo
    reportó el propietario mirando el sitio ya desplegado: ni las pruebas ni el
    despliegue detectan un ancla que no lleva a ninguna parte.

    La regla vale para toda la página y no solo para el menú: un ancla se
    respeta si esa sección existe de verdad aquí, y si no, se reescribe hacia
    la portada. Así se corrige sola en cualquier página nueva.
    """
    def destino(m):
        ancla = m.group(1)
        if ('id="%s"' % ancla) in pagina:
            return m.group(0)
        return 'href="index.html#%s"' % ancla

    pagina = re.sub(r'href="#([^"]+)"', destino, pagina)

    # Los dos logotipos —cabecera y pie— vuelven a la portada. Es la salida que
    # la gente busca por costumbre, y `#top` aquí no sale de la página.
    return pagina.replace('<a class="brand" href="#top">',
                          '<a class="brand" href="index.html">')


def generar(col, html, escribir):
    cat = json.loads((RAIZ / 'assets' / 'catalogo.json').read_text(encoding='utf-8'))
    grupos = cat['grupos']

    ids = [pid for pid, g in grupos.items() if g == col['grupo']]
    if not ids:
        raise SystemExit('El grupo «%s» no tiene piezas en catalogo.json.' % col['grupo'])

    b = bloques(html)
    p = precios_de_combo({'id': col['base'], 'talla': None}, ids)

    # El catálogo completo menos esta colección: el número que se le ofrece a
    # quien quiere otra cosa. Sale del catálogo, no escrito a mano.
    n_catalogo = len(cat['precios']) - len(ids) - len(cat['pulseras'])

    # Las demás colecciones, del catálogo y sin la propia: escrita a mano, la
    # lista de la página de Símbolos habría ofrecido «símbolos».
    vistos = []
    for g in grupos.values():
        g = 'iniciales' if g == 'Letras' else g
        if g != col['grupo'] and g not in vistos:
            vistos.append(g)
    otras = ', '.join(vistos[:-1]) + ' e ' + vistos[-1] if vistos[-1][0] in 'iI' else ', '.join(vistos[:-1]) + ' y ' + vistos[-1]

    desc = col['entrada'][:300]
    pagina = PAGINA.format(
        archivo=col['archivo'], titulo=col['titulo'], eyebrow=col['eyebrow'],
        lema=col['lema'], entrada=col['entrada'], desc=desc, og=col['og'],
        head=b['head'], ann=b['ann'], header=b['header'], talla=b['talla'],
        historia=b['historia'], resenas=b['resenas'], pagos=b['pagos'],
        confianza=b['confianza'], footer=b['footer'], chrome=b['chrome'],
        n_piezas=len(ids), n_catalogo=n_catalogo, otras=otras,
        foto=col['foto'], foto_alt=col['foto_alt'], foto_clase=col.get('foto_clase', ''),
        foto_w=col['foto_w'], foto_h=col['foto_h'],
        tarjetas_charms='\n'.join('      ' + t for t in tarjetas(html, ids)),
        tarjeta_base='\n'.join('      ' + t for t in tarjetas(html, [col['base']])),
        escalera=escalones(col['base'], p), redir=redireccion_de_anuncio(col['archivo']),
        tercer_charm=p['tercerCharm'], charm_solo=p['charmSolo'],
        pulsera_sola=p['pulseraSola'], dos=p['dos'], tres=p['tres'],
        ahorro_tres=p['ahorroTres'], ahorro_dos=p['ahorroDos'], contraentrega=p['contraentrega'],
    )

    pagina = arregla_nav(pagina)

    destino = RAIZ / col['archivo']
    if escribir:
        destino.write_text(pagina, encoding='utf-8')
        print('  escrito  %s  (%d piezas, %d KB)'
              % (col['archivo'], len(ids), len(pagina) // 1024))
    else:
        print('  se escribiría  %s  (%d piezas, %d KB)'
              % (col['archivo'], len(ids), len(pagina) // 1024))
        print('     combo: brazalete %s · +2 %s · +3 %s · tercer charm %s'
              % (p['pulseraSola'], p['dos'], p['tres'], p['tercerCharm']))



# ══ KITS ═══════════════════════════════════════════════════════════════════
#
# Un kit no es un producto nuevo: es una selección de piezas que ya existen.
# **No tiene precio propio ni descuento propio** — el precio sale de
# calcular(), el mismo código que firma el cobro, así que un kit no puede
# prometer un número que el checkout no vaya a cobrar.
#
# Lo que la página enseña es la promo que la tienda YA aplica, «paga 3, lleva
# 1 gratis» (desde el 2026-10-04): el mismo kit a 1, 2, 3 y 4 dijes. Con
# brazalete + 3 dijes (4 piezas) la de menor valor sale gratis: ese es el paso
# marcado. (Las 2 gratis llegan con 6 piezas; un kit tiene 5.)
#
# **El enlace NO arma el carrito por la clienta.** Antes cada paso ponía el
# brazalete Y los N dijes directamente en el carrito (`?p=base,charm1,charm2`)
# — el propietario lo detectó en carne propia: pidió «brazalete + 2 dijes» y
# la tienda le eligió los dos dijes por su cuenta, sin que él los hubiera
# tocado. Ahora el enlace solo pone el brazalete y **sugiere** los dijes
# (`sug=`): `index.html` los resalta en el catálogo y ella decide agregarlos,
# cambiarlos por otros o ignorarlos — viendo el descuento subir en el propio
# resumen del carrito (`#row-save`, `#desc-nota`), que ya existe ahí y no hubo
# que inventar nada nuevo para mostrarlo.

KITS_JSON = RAIZ / 'assets' / 'kits.json'


def escalera(base, charms):
    """El kit a 1, 2, 3 y 4 dijes, con calcular() de verdad.

    Devuelve también el costo del dije que se añade en cada escalón, que es el
    argumento de venta más fuerte que la tienda tiene programado y que no
    aparecía en ningún sitio: con brazalete, el tercer dije cuesta cerca de un
    tercio de su precio de lista.
    """
    guion = """
const {calcular, cop} = require('./netlify/functions/_precios.js');
const cat = require('./assets/catalogo.json');
const base = %s, charms = %s;
const pasos = [];
let previo = 0;
for (let i = 1; i <= charms.length; i++) {
  const sel = charms.slice(0, i);
  const c = calcular({ base: { id: base, talla: null }, charms: sel, pago: 'anticipado' });
  const lista = cat.precios[base] + sel.reduce((s, id) => s + cat.precios[id], 0);
  pasos.push({
    n: i,
    total: c.total, totalTexto: cop(c.total),
    lista, listaTexto: cop(lista),
    dto: Math.round((1 - c.total / lista) * 100),
    ahorro: cop(lista - c.total),
    /* Lo que cuesta EL dije que se acaba de sumar, ya con el descuento que
       arrastra al resto del carrito. En el tercero es donde sorprende. */
    esteDije: cop(c.total - previo),
    listaDije: cop(cat.precios[charms[i - 1]]),
    piezas: [base].concat(sel),
  });
  previo = c.total;
}
console.log(JSON.stringify(pasos));
""" % (json.dumps(base), json.dumps(charms))
    r = subprocess.run(['node', '-e', guion], cwd=RAIZ, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit('calcular() falló al armar la escalera:\n' + r.stderr)
    return json.loads(r.stdout)


def vitrina(primeras, titulo='Relacionados', sin='', brazaletes=True, solo=False):
    """El hueco del carrusel con pestañas que llena tienda.js (ver «Vitrina»
    allí). Aquí solo van las piezas de la primera pestaña, en orden; las demás
    salen en vivo de assets/catalogo.json, así que ni un nombre ni un precio se
    copia en el HTML."""
    return ('<div class="vit" data-vit="%s" data-vit-t="%s"%s%s%s>'
            '<div class="vit-tabs" role="tablist" aria-label="Elige una colección"></div>'
            '<div class="vit-rail" role="list"></div>'
            '<p class="vit-desliza">Toca una colección y desliza para ver más</p></div>'
            % (','.join(primeras), titulo, ' data-vit-sin="%s"' % sin if sin else '',
               '' if brazaletes else ' data-vit-b="0"',
               # Solo la primera pestaña: en una página de campaña no se ofrecen
               # otras colecciones (tienda.js, data-vit-solo).
               ' data-vit-solo="1"' if solo else ''))


TARJETA_KIT = '''    <article class="kit" id="kit-{id}">
      <div class="kit-head">
        <span class="eyebrow">{eyebrow}</span>
        <h3>{nombre}</h3>
        <p class="kit-lema">{lema}</p>
        <p class="kit-entrada">{entrada}</p>
        <a class="kit-ir" href="kit-{id}.html">Ver la página de este kit →</a>
      </div>
      <div class="kit-piezas">{fotos}</div>
      <p class="kit-tercer">Brazalete + 3 dijes son 4 piezas: <b>pagas 3 y la de menor valor te sale gratis</b>; ahorras {ahorro_cuatro}.</p>
      <div class="kit-escalera">
{pasos}
      </div>
      <div class="kit-arma">
        <p class="kit-arma-t"><b>1</b> Elige la talla de tu brazalete {base_nombre}</p>
        <div class="kit-tallas tallas-row" data-para="{base}"></div>
        <p class="kit-arma-ayuda">Mide tu muñeca y súmale 2 cm. <a href="#talla">¿Qué talla es la mía?</a></p>
        <p class="kit-arma-t"><b>2</b> Elige tus charms: los del kit o los que más te gusten</p>
        {vitrina}
      </div>
      <p class="kit-nota">Toca un paso para poner sus charms en tu carrito, o elígelos uno a uno aquí
      mismo. El descuento se aplica solo. Envío gratis pagando en línea.</p>
    </article>
'''

PASO_KIT = ('        <button type="button" class="kit-paso{clase}" data-kit-piezas="{piezas}">'
            '<span class="kit-paso-n">Brazalete + {n} dije{s}</span>'
            '<span class="kit-paso-p"><b>{total}</b>'
            '<s>{lista}</s></span>'
            '<span class="kit-paso-d">{marca}</span></button>')

PAGINA_KITS = '''<!DOCTYPE html>
<html lang="es-CO">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kits Zephora · Dijes de Plata 925 y brazalete · Paga 3, lleva 1 gratis</title>
<meta name="description" content="{desc}">
<link rel="icon" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iNCIgZmlsbD0iIzJBMUYyRSIvPjx0ZXh0IHg9IjE2IiB5PSIyMyIgZm9udC1mYW1pbHk9Ikdlb3JnaWEsc2VyaWYiIGZvbnQtc2l6ZT0iMTkiIGZpbGw9IiNGNkYzRjQiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlo8L3RleHQ+PC9zdmc+">
<meta name="theme-color" content="#2A1F2E">
<link rel="canonical" href="https://zephoracharms.com/kits.html">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_CO">
<meta property="og:site_name" content="Zephora Charms">
<meta property="og:title" content="Kits Zephora · Dijes de Plata 925 y brazalete">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="https://zephoracharms.com/kits.html">
<meta property="og:image" content="https://zephoracharms.com/assets/avengers-marmol.webp">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Kits Zephora · Dijes de Plata 925 y brazalete">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="https://zephoracharms.com/assets/avengers-marmol.webp">
{head}
<link rel="stylesheet" href="tienda.css">
<script src="/assets/clarity.js" defer></script>
</head>
<body>

{ann}

{header}

<section class="col-hero wrap" id="top">
  <span class="eyebrow">Kits</span>
  <h1>Armados, y con el descuento puesto</h1>
  <p class="col-entrada">Combinaciones que tienen sentido juntas, con el precio ya
  calculado en cada paso. Los dijes en Plata Esterlina 925 verificada; el brazalete,
  con acabado en baño de plata.</p>
</section>

<!-- LA PROMO, dicha una vez arriba y luego aplicada kit por kit. No es una
     promoción aparte: es la que la tienda ya aplica sola, la misma del
     recuadro de la portada y de las fichas. -->
<section class="kits-esc wrap">
  <div class="promo-caja">
    <p class="promo-caja-t">✨ PROMOCIÓN ACTIVA: <b>Paga 3 y llévate 1&nbsp;gratis.</b></p>
    <p class="promo-caja-x">El brazalete cuenta como una pieza: con brazalete + 3 dijes, el de menor valor te sale totalmente <b>GRATIS</b>; con 6 piezas, 2 gratis. <span>(Se aplica automáticamente).</span></p>
  </div>
</section>

<section class="kits wrap" id="kits">
{tarjetas}
</section>

<section class="col-resto wrap">
  <h2>¿Prefieres armarla tú?</h2>
  <p class="col-sub">Los kits son un punto de partida, no una caja cerrada: puedes
  cambiar cualquier pieza en el carrito, o empezar de cero con las {n_catalogo} del catálogo.</p>
  <a class="btn btn--ghost" href="index.html#charms">Ver el catálogo completo</a>
</section>

{talla}

<!-- Lo mismo que se ve al bajar en una ficha (pedido del propietario,
     2026-09-27): los bloques con foto y video, las reseñas de la tienda y los
     videos de clientas. Salen de gen_productos.py, no se copian a mano. -->
{bloques_media}


{resenas}

{historia}

{pagos}

{confianza}

{footer}

<!-- Contenedores que tienda.js exige por id. Ver gen_colecciones.py. -->
<div hidden>
  <button type="button" id="ver-todos"></button>
  <button type="button" id="more-btn"></button>
  <span id="count"></span>
  <div id="rail-top"></div>
  <div class="filters" id="b-filters"></div>
  <div id="full-cat" hidden>
    <div class="filters" id="filters"></div>
    <input type="search" id="q" aria-hidden="true" tabindex="-1">
    <button type="button" id="q-x" hidden></button>
    <div class="grid" id="resto-grid"></div>
  </div>
  <div class="letras-grid" id="letras-grid" role="group" aria-label="Elegir inicial"></div>
</div>

{chrome}
</body>
</html>
'''


def generar_kits(html, escribir):
    cat = json.loads((RAIZ / 'assets' / 'catalogo.json').read_text(encoding='utf-8'))
    kits = json.loads(KITS_JSON.read_text(encoding='utf-8'))['kits']
    promo = cat['reglas']['promo']
    fotos = cat['fotos']
    nombres = cat['nombres']

    tarjetas_html = []
    for k in kits:
        pasos = escalera(k['base'], k['charms'])

        # Las fotos de las piezas de verdad, no un montaje: cada una existe ya.
        miniaturas = []
        for pid in [k['base']] + k['charms']:
            if pid not in fotos:
                raise SystemExit('La pieza %s no tiene foto en catalogo.json.' % pid)
            miniaturas.append(
                '<img src="assets/%s" alt="%s" width="80" height="80" loading="lazy" decoding="async">'
                % (fotos[pid], nombres[pid].replace('"', '')))

        filas = []
        for p in pasos:
            pz = p['n'] + 1
            gratis = 0
            for piezas_t, gratis_t in promo['tramos']:
                if pz >= piezas_t:
                    gratis = gratis_t
            mejor = (p['n'] == 3)   # brazalete + 3 = 4 piezas: la primera gratis
            filas.append(PASO_KIT.format(
                clase=' kit-paso--best' if mejor else '',
                piezas=','.join(p['piezas']),
                n=p['n'], s='s' if p['n'] > 1 else '',
                total=p['totalTexto'],
                lista=p['listaTexto'] if p['dto'] > 0 else '',
                marca=('%d piezas: %s · ahorras %s' % (pz, 'una GRATIS' if gratis == 1 else '%d GRATIS' % gratis, p['ahorro']))
                      if gratis else 'precio de lista',
            ))

        tercero = pasos[2]
        tarjetas_html.append(TARJETA_KIT.format(
            id=k['id'], eyebrow=k['eyebrow'], nombre=k['nombre'],
            lema=k['lema'], entrada=k['entrada'],
            fotos=''.join(miniaturas),
            ahorro_cuatro=pasos[2]['ahorro'],
            pasos='\n'.join(filas),
            base=k['base'], base_nombre=nombres[k['base']].replace('Pulsera ', ''),
            # El brazalete del kit va primero en su vitrina, como un charm más: con su foto,
            # su video (la ficha) y «Elegir talla» (pedido del propietario, 2026-10-31).
            vitrina=vitrina([k['base']] + k['charms'], 'De este kit'),
        ))

    b = bloques(html)
    n_catalogo = len(cat['precios'])
    desc = ('Kits con dijes en Plata Esterlina 925 con sello grabado y brazalete con '
            'baño de plata de alta calidad. '
            'Paga 3 y llévate 1 gratis (paga 4 y llévate 2): la de menor valor sale gratis, y se aplica solo. '
            'Envío gratis a toda Colombia.')

    from gen_productos import bloques_media   # aquí: gen_productos importa este módulo
    pagina = PAGINA_KITS.format(
        head=b['head'], ann=b['ann'], header=b['header'], talla=b['talla'],
        bloques_media=bloques_media(None, 'charm', False, cat, arma_href='#kits'),
        historia=b['historia'],
        resenas=b['resenas'], pagos=b['pagos'], confianza=b['confianza'],
        footer=b['footer'], chrome=b['chrome'],
        tarjetas=''.join(tarjetas_html), n_catalogo=n_catalogo, desc=desc,
    )

    pagina = arregla_nav(pagina)

    destino = RAIZ / 'kits.html'
    if escribir:
        destino.write_text(pagina, encoding='utf-8')
        print('  escrito  kits.html  (%d kits, %d KB)' % (len(kits), len(pagina) // 1024))
    else:
        print('  se escribiría  kits.html  (%d kits, %d KB)' % (len(kits), len(pagina) // 1024))
    for k in kits:
        e = escalera(k['base'], k['charms'])
        print('     %-22s %s' % (k['nombre'],
              ' · '.join('%dd %s (-%d%%)' % (p['n'], p['totalTexto'], p['dto']) for p in e)))


# ══ UNA PÁGINA POR KIT ═════════════════════════════════════════════════════
#
# kit-<id>.html: a donde llegan los anuncios (pedido del propietario,
# 2026-10-30: «una página solamente para cada kit, especializada para
# conversión»). Arriba, la misma foto del anuncio —la clienta ve lo que tocó—
# con el precio de la colección completa y un botón que la pone en el carrito;
# debajo, la tarjeta del kit de siempre (escalera, talla, vitrina) y, al final,
# «Colecciones populares» con los demás kits. El precio sale de escalera(),
# o sea de calcular(): ninguna cifra se escribe a mano, tampoco aquí.
#
# El botón grande usa el mismo `data-kit-piezas` que los pasos de la escalera:
# pone los charms y pide la talla del brazalete (tienda.js); si alguna pieza se
# agotó, tienda.js lo cambia por «las disponibles» y dice cuál falta.

HERO_KIT = '''<section class="kp-hero wrap" id="top">
  <div class="kp-foto">{foto}</div>
  <div class="kp-txt">
    <span class="eyebrow">{eyebrow}</span>
    <h1>{nombre}</h1>
    <p class="kp-lema">{lema}</p>
    <p class="kp-precio">Brazalete + {n} charms: <b>{total}</b> <s>{lista}</s></p>
    <p class="kp-gratis">{gratis} · ahorras {ahorro}</p>
    <button type="button" class="btn kp-cta" data-kit-piezas="{piezas}" data-kit-ir="kit-{id}">Lo quiero completo</button>
    <p class="kp-agotadas" hidden></p>
    <a class="kp-ver" href="#kit-{id}">o elige pieza por pieza, y tu talla</a>
    <ul class="kp-confia">
      <li>Charms en Plata 925 con sello grabado</li>
      <li>Envío gratis pagando en línea</li>
      <li>Llega en su caja, con paño y dedicatoria</li>
    </ul>
  </div>
</section>
'''

TARJETA_POP = ('    <a class="kp-pop-it" href="kit-{id}.html">{foto}'
               '<span class="kp-pop-n">{nombre}</span><span class="kp-pop-l">{lema}</span>'
               '<span class="kp-pop-p"><b>{total}</b> <s>{lista}</s></span></a>')


def foto_kit(k, fotos, nombres, clase):
    """La foto del anuncio si la hay; si no, las piezas del kit."""
    p = k.get('pagina') or {}
    if p.get('imagen'):
        # La de arriba (kp-img) es la imagen principal: va primero. Las de «Colecciones
        # populares» están al final de la página: perezosas, para no competir con ella.
        prio = ' fetchpriority="high"' if clase == 'kp-img' else ' loading="lazy"'
        return ('<img class="%s" src="assets/%s" alt="%s" width="1080" height="1350"%s decoding="async">'
                % (clase, p['imagen'], p.get('alt', k['nombre']).replace('"', ''), prio))
    return ('<span class="%s %s--piezas">%s</span>' % (clase, clase, ''.join(
        '<img src="assets/%s" alt="" width="120" height="120" loading="lazy" decoding="async">' % fotos[pid]
        for pid in [k['base']] + k['charms'])))


def generar_paginas_kit(html, escribir):
    cat = json.loads((RAIZ / 'assets' / 'catalogo.json').read_text(encoding='utf-8'))
    kits = json.loads(KITS_JSON.read_text(encoding='utf-8'))['kits']
    promo = cat['reglas']['promo']
    fotos, nombres = cat['fotos'], cat['nombres']
    completo = {k['id']: escalera(k['base'], k['charms'])[-1] for k in kits}
    b = bloques(html)
    from gen_productos import bloques_media

    ini = PAGINA_KITS.index('<section class="col-hero wrap" id="top">')
    fin = PAGINA_KITS.index('<section class="col-resto wrap">')
    for k in kits:
        # Kit pautado (kits.json, pagina.campana; 2026-11-20): el kit primero,
        # luego solo sus relacionadas, y ninguna salida a otras categorías.
        campana = bool((k.get('pagina') or {}).get('campana'))
        pasos = escalera(k['base'], k['charms'])
        todo = pasos[-1]
        pz = len(k['charms']) + 1
        gratis = 0
        for piezas_t, gratis_t in promo['tramos']:
            if pz >= piezas_t:
                gratis = gratis_t
        hero = HERO_KIT.format(
            foto=foto_kit(k, fotos, nombres, 'kp-img'), eyebrow=k['eyebrow'], nombre=k['nombre'],
            lema=k['lema'], n=len(k['charms']), total=todo['totalTexto'], lista=todo['listaTexto'],
            gratis=('%d piezas: %s' % (pz, 'una te sale GRATIS' if gratis == 1 else '%d te salen GRATIS' % gratis))
                   if gratis else 'Precio de lista',
            ahorro=todo['ahorro'], piezas=','.join(todo['piezas']), id=k['id'])

        miniaturas = ''.join(
            '<img src="assets/%s" alt="%s" width="80" height="80" loading="lazy" decoding="async">'
            % (fotos[pid], nombres[pid].replace('"', '')) for pid in [k['base']] + k['charms'])
        filas = []
        for p in pasos:
            n_pz = p['n'] + 1
            g = 0
            for piezas_t, gratis_t in promo['tramos']:
                if n_pz >= piezas_t:
                    g = gratis_t
            filas.append(PASO_KIT.format(
                clase=' kit-paso--best' if p['n'] in (3, 5) else '',
                piezas=','.join(p['piezas']), n=p['n'], s='s' if p['n'] > 1 else '',
                total=p['totalTexto'], lista=p['listaTexto'] if p['dto'] > 0 else '',
                marca=('%d piezas: %s · ahorras %s' % (n_pz, 'una GRATIS' if g == 1 else '%d GRATIS' % g, p['ahorro']))
                      if g else 'precio de lista'))
        tarjeta = TARJETA_KIT.format(
            id=k['id'], eyebrow=k['eyebrow'], nombre=k['nombre'], lema=k['lema'], entrada=k['entrada'],
            fotos=miniaturas, ahorro_cuatro=pasos[2]['ahorro'], pasos='\n'.join(filas),
            base=k['base'], base_nombre=nombres[k['base']].replace('Pulsera ', ''),
            vitrina=vitrina([k['base']] + k['charms'], 'De esta colección', solo=campana))
        # En su propia página, el enlace «ver la página de este kit» sobra.
        tarjeta = tarjeta.replace('        <a class="kit-ir" href="kit-%s.html">Ver la página de este kit →</a>\n' % k['id'], '')

        otros = [o for o in kits if o['id'] != k['id']]
        otros.sort(key=lambda o: not (o.get('pagina') or {}).get('popular'))
        pop = '\n'.join(TARJETA_POP.format(
            id=o['id'], foto=foto_kit(o, fotos, nombres, 'kp-pop-img'), nombre=o['nombre'], lema=o['lema'],
            total=completo[o['id']]['totalTexto'], lista=completo[o['id']]['listaTexto']) for o in otros[:4])

        if campana:
            pop_html = relacionadas_kit(k, cat, html)
        else:
            pop_html = ('<section class="kp-pop wrap" aria-label="Colecciones populares">\n  <h2>Colecciones populares</h2>\n'
                        + '  <div class="kp-pop-grid">\n' + pop + '\n  </div>\n'
                        + '  <a class="btn btn--ghost" href="kits.html">Ver todos los kits</a>\n</section>\n\n')
        cuerpo = (hero
                  + '\n<section class="kits-esc wrap">\n  <div class="promo-caja">\n'
                  + '    <p class="promo-caja-t">✨ PROMOCIÓN ACTIVA: <b>Paga 3 y llévate 1&nbsp;gratis · paga 4 y llévate 2.</b></p>\n'
                  + '    <p class="promo-caja-x">El brazalete cuenta como una pieza: con 4 piezas, la de menor valor te sale '
                  + '<b>GRATIS</b>; con 6, las 2 de menor valor. <span>(Se aplica automáticamente).</span></p>\n  </div>\n</section>\n\n'
                  + '<section class="kits wrap kp-kit">\n' + tarjeta + '</section>\n\n'
                  + pop_html)
        url = 'https://zephoracharms.com/kit-%s.html' % k['id']
        imagen = 'https://zephoracharms.com/assets/' + ((k.get('pagina') or {}).get('imagen') or 'avengers-marmol.webp')
        titulo = '%s · %s · Zephora Charms' % (k['nombre'], k['lema'])
        desc = ('%s: %s Brazalete + %d charms por %s (en vez de %s). Paga 3, lleva 1 gratis · paga 4, lleva 2. '
                'Envío gratis a toda Colombia.' % (k['nombre'], k['entrada'], len(k['charms']),
                                                    todo['totalTexto'], todo['listaTexto']))
        cabeza = PAGINA_KITS[:ini]
        cabeza = re.sub(r'<title>[^<]*</title>', '<title>%s</title>' % titulo, cabeza)
        cabeza = cabeza.replace('https://zephoracharms.com/kits.html', url)
        cabeza = cabeza.replace('Kits Zephora · Dijes de Plata 925 y brazalete', titulo)
        cabeza = cabeza.replace('https://zephoracharms.com/assets/avengers-marmol.webp', imagen)
        if campana:
            # Sin «¿Prefieres armarla tú? → catálogo completo» y sin la historia
            # de la marca: después del kit y sus relacionadas, solo lo que ayuda
            # a decidir (tallas, fotos, reseñas, pagos).
            cabeza = cabeza.replace('<body>', '<body class="pag-campana" data-campana="kit-%s" data-vacio="#kit-%s">'
                                    % (k['id'], k['id']))
            cola = PAGINA_KITS[PAGINA_KITS.index('{talla}'):]
        else:
            cola = PAGINA_KITS[fin:]
        pagina = (cabeza.replace('{', '{{').replace('}', '}}')
                  .replace('{{head}}', '{head}').replace('{{ann}}', '{ann}').replace('{{header}}', '{header}')
                  .replace('{{desc}}', '{desc}')
                  + cuerpo.replace('{', '{{').replace('}', '}}')
                  + cola).format(
            head=b['head'], ann=b['ann'], header=b['header'], talla=b['talla'],
            bloques_media=bloques_media(None, 'charm', False, cat, arma_href='#kit-' + k['id']),
            historia='' if campana else b['historia'], resenas=b['resenas'], pagos=b['pagos'],
            confianza=b['confianza'], footer=pie_campana(k['nombre']) if campana else b['footer'],
            chrome=b['chrome'], n_catalogo=len(cat['precios']), desc=desc.replace('"', ''))
        pagina = arregla_nav(pagina)
        if campana:
            pagina = solo_tema(pagina, k['nombre'], '#kit-' + k['id'])
        destino = RAIZ / ('kit-%s.html' % k['id'])
        if escribir:
            destino.write_text(pagina, encoding='utf-8')
        print('  %s  %-24s %s (lista %s)' % ('escrito ' if escribir else 'se escribiría', destino.name,
                                             todo['totalTexto'], todo['listaTexto']))


MV_CUERPO = '''<section class="col-hero wrap" id="top">
  <span class="eyebrow">Más vendidos</span>
  <h1>Las piezas que más se llevan</h1>
  <p class="col-entrada">Ordenadas por unidades vendidas de verdad, contadas de los pedidos
  de la tienda. Solo aparecen las que tienen 3 unidades o más disponibles.</p>
</section>

<!-- Lo llena tienda.js («Más vendidos») desde netlify/functions/mas-vendidos:
     ventas reales, nunca un número fijo. El sello «Más vendido» solo va en
     piezas que vendieron; el relleno, mientras haya pocas ventas, va aparte. -->
<section class="mv wrap" aria-label="Más vendidos">
  <p class="mv-aviso" id="mv-aviso" hidden></p>
  <div class="mv-grid" id="mv-vendidas" role="list"><p class="mv-cargando">Cargando las ventas…</p></div>
</section>

<section class="mv wrap" id="mv-relleno-sec" hidden>
  <h2>De las colecciones favoritas</h2>
  <p class="col-sub">Mientras juntamos más ventas, estas son las piezas con más unidades
  disponibles de las colecciones que más se venden.</p>
  <div class="mv-grid" id="mv-relleno" role="list"></div>
</section>

<section class="col-resto wrap">
  <h2>¿Buscas algo en particular?</h2>
  <p class="col-sub">Todo el catálogo, por colección, con disponibilidad al día.</p>
  <a class="btn btn--ghost" href="index.html#charms">Ver el catálogo completo</a>
</section>

'''


def generar_mas_vendidos(html, escribir):
    """coleccion-mas-vendidos.html (ENCARGO-FICHA-2 § 5). La carcasa es la de
    kits.html —cabecera, pie y bloques de la portada—; el contenido lo pinta
    tienda.js con las ventas reales, así que la página no se queda vieja
    entre despliegues."""
    ini = PAGINA_KITS.index('<section class="col-hero wrap" id="top">')
    fin = PAGINA_KITS.index('{talla}')
    cabeza = re.sub(r'<title>[^<]*</title>', '<title>Más vendidos · Zephora Charms</title>', PAGINA_KITS[:ini])
    cabeza = cabeza.replace('https://zephoracharms.com/kits.html', 'https://zephoracharms.com/coleccion-mas-vendidos.html')
    cabeza = cabeza.replace('Kits Zephora · Dijes de Plata 925 y brazalete', 'Más vendidos · Zephora Charms')
    assert 'kits.html' not in cabeza and 'Kits Zephora' not in cabeza
    b = bloques(html)
    desc = ('Las piezas de Zephora que más se venden, contadas de pedidos reales: charms en Plata '
            'Esterlina 925 y brazaletes con baño de plata, con 3 unidades o más disponibles.')
    from gen_productos import bloques_media
    cat = json.loads((RAIZ / 'assets' / 'catalogo.json').read_text(encoding='utf-8'))
    pagina = (cabeza + MV_CUERPO + PAGINA_KITS[fin:]).format(
        head=b['head'], ann=b['ann'], header=b['header'], talla=b['talla'],
        bloques_media=bloques_media(None, 'charm', False, cat, arma_href='kits.html'),
        historia=b['historia'],
        resenas=b['resenas'], pagos=b['pagos'], confianza=b['confianza'],
        footer=b['footer'], chrome=b['chrome'], desc=desc)
    pagina = arregla_nav(pagina)
    destino = RAIZ / 'coleccion-mas-vendidos.html'
    if escribir:
        destino.write_text(pagina, encoding='utf-8')
        print('  escrito  coleccion-mas-vendidos.html  (%d KB)' % (len(pagina) // 1024))
    else:
        print('  se escribiría  coleccion-mas-vendidos.html  (%d KB)' % (len(pagina) // 1024))


# ══ PÁGINAS DE CAMPAÑA ═════════════════════════════════════════════════════
#
# Pedido del propietario (2026-11-20), tras ver en Clarity que quien llegaba de
# un anuncio de Marvel se perdía: «que salgan esas 5 primero pero que tambien
# salga todo lo relacionado pero que en esa pagina solo sea marvel».
#
# Una página por tema pautado, armada desde assets/campanas.json —una campaña
# nueva es solo configuración—, con las mismas tarjetas y el mismo andamiaje de
# la portada (todo sale de index.html, como el resto de este archivo):
#
#   1. En el primer pantallazo del celular, las piezas del anuncio, en fila,
#      con foto, precio y «Agregar». Las agotadas bajan al final (tienda.js).
#   2. El brazalete del tema y el combo, con cada escalón tocable.
#   3. El resto de piezas del tema.
#   4. Tallas, reseñas, pagos y confianza.
#
# Solo el tema: la cabecera queda sin menú ni buscador (body.pag-campana), el
# pie es corto y ningún enlace lleva a otra categoría. Se quedan el carrito,
# el botón del regalo y WhatsApp. Tocar la foto o el nombre de una pieza abre
# su ficha ahí mismo, sin ir a la página de la pieza (tienda.js).

CAMPANAS_JSON = RAIZ / 'assets' / 'campanas.json'
WA_NUMERO = '573018990672'

PAGINA_CAMPANA = '''<!DOCTYPE html>
<html lang="es-CO">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{titulo} · {eyebrow} · Zephora Charms</title>
<meta name="description" content="{desc}">
<link rel="icon" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iNCIgZmlsbD0iIzJBMUYyRSIvPjx0ZXh0IHg9IjE2IiB5PSIyMyIgZm9udC1mYW1pbHk9Ikdlb3JnaWEsc2VyaWYiIGZvbnQtc2l6ZT0iMTkiIGZpbGw9IiNGNkYzRjQiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlo8L3RleHQ+PC9zdmc+">
<meta name="theme-color" content="#2A1F2E">
<link rel="canonical" href="https://zephoracharms.com/{archivo}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_CO">
<meta property="og:site_name" content="Zephora Charms">
<meta property="og:title" content="{titulo} · Zephora Charms">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="https://zephoracharms.com/{archivo}">
<meta property="og:image" content="https://zephoracharms.com/{og}">
<meta name="twitter:card" content="summary_large_image">
{head}
<link rel="stylesheet" href="tienda.css">
<script src="/assets/clarity.js" defer></script>
</head>
<body class="pag-campana" data-campana="{id}" data-vacio="#destacadas">

{ann}

{header}

<section class="cp-hero wrap" id="top">
  <span class="eyebrow">{eyebrow}</span>
  <h1>{titulo}</h1>
  <p>{texto}</p>
</section>

<!-- 1 · LAS DEL ANUNCIO, en el primer pantallazo. -->
<section class="cp-sec wrap" id="destacadas" aria-label="Las del anuncio">
  <div class="cp-dest" data-agotadas-final data-agotadas-a="#piezas .grid">
{tarjetas_dest}
  </div>
</section>

<!-- 2 · EL BRAZALETE Y EL COMBO, con cada escalón tocable. -->
<section class="cp-sec wrap" id="combo">
  <span class="eyebrow">La base</span>
  <h2>El brazalete de la colección</h2>
  <p class="col-sub">Brazalete + 3 charms son <b>4 piezas</b>: pagas 3 y la de menor valor te
  sale <b>gratis</b>. Con 6 piezas son 2 gratis. Se aplica solo en el carrito.</p>
  <!-- #b-filters lo exige tienda.js. Vacío: una sola base. Fuera de .cp-base:
       dentro ocupaba una columna de la rejilla en computador. -->
  <div class="filters" id="b-filters" hidden></div>
  <div class="cp-base">
    <div class="grid grid--base" id="brazaletes">
{tarjeta_base}
    </div>
    <div>
{escalera}
      <p class="col-nota">{contraentrega}</p>
    </div>
  </div>
</section>

<!-- 3 · EL RESTO DEL TEMA. -->
<section class="cp-sec wrap" id="piezas">
  <span class="eyebrow">{eyebrow}</span>
  <h2>Toda la colección</h2>
  <p class="col-sub">{n_resto} piezas más, en Plata Esterlina 925 verificada.</p>
  <div class="grid" data-agotadas-final>
{tarjetas_resto}
  </div>
</section>

{talla}

{resenas}

{pagos}

{confianza}

{pie}

<!-- Contenedores que tienda.js exige por id. Ver PAGINA. -->
<div hidden>
  <button type="button" id="ver-todos"></button>
  <button type="button" id="more-btn"></button>
  <span id="count"></span>
  <div id="rail-top"></div>
  <div id="full-cat" hidden>
    <div class="filters" id="filters"></div>
    <input type="search" id="q" aria-hidden="true" tabindex="-1">
    <button type="button" id="q-x" hidden></button>
    <div class="grid" id="resto-grid"></div>
  </div>
  <div class="letras-grid" id="letras-grid" role="group" aria-label="Elegir inicial"></div>
</div>

{chrome}
</body>
</html>
'''

# El glifo oficial de WhatsApp, relleno: el mismo del .wa-float original de la
# portada (antes de 7845d30). El de trazo se veía raro (propietario, 2026-11-20).
WA_ICONO = ('<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2zm5.8 14.17c-.25.69-1.44 1.32-1.99 1.4-.53.08-1.2.11-1.94-.12-.45-.14-1.02-.33-1.76-.65-3.1-1.34-5.12-4.46-5.28-4.67-.15-.21-1.26-1.67-1.26-3.19s.8-2.27 1.08-2.58c.28-.31.61-.39.82-.39.2 0 .41 0 .59.01.19.01.44-.07.69.53.25.6.86 2.12.94 2.27.08.15.13.33.03.54-.1.21-.15.33-.29.51-.15.17-.31.39-.44.52-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.03 1.12 1 2.06 1.31 2.35 1.46.29.15.46.13.63-.08.17-.21.73-.85.92-1.15.19-.29.39-.24.65-.15.26.1 1.66.78 1.94.93.29.15.48.22.55.34.07.13.07.72-.18 1.41z"/></svg>')


def wa_href(tema):
    from urllib.parse import quote
    return 'https://wa.me/%s?text=%s' % (WA_NUMERO, quote(
        'Hola, Zephora Charms. Vengo de la página de %s y tengo una duda.' % tema))


def solo_tema(pagina, tema, salida='#destacadas'):
    """Que ningún enlace saque de la campaña.

    La cabecera, el aviso y el carrito vienen de la portada. Sus anclas a
    secciones que aquí no existen llevan a la sección principal de la campaña
    (no a la portada, como en las demás páginas); el logotipo vuelve arriba de
    esta misma página; el aviso de la promo lleva al combo; y en la cabecera,
    en lugar del menú (que queda oculto por CSS), va WhatsApp.
    """
    # El menú de la cabecera (categorías, kits, más vendidos…) se vacía: no
    # basta con esconderlo por CSS, un enlace que existe se termina tocando.
    # Los contenedores se quedan porque tienda.js los busca por id.
    pagina = re.sub(r'(<nav class="tnav">).*?(</nav>)', r'\1\2', pagina, count=1, flags=re.S)
    pagina = re.sub(r'(<nav class="menu-panel"[^>]*>).*?(</nav>)', r'\1\2', pagina, count=1, flags=re.S)

    def destino(m):
        ancla = m.group(1)
        return m.group(0) if ('id="%s"' % ancla) in pagina else 'href="%s"' % salida
    pagina = re.sub(r'href="#([^"]+)"', destino, pagina)
    pagina = re.sub(r'href="index\.html#([^"]+)"',
                    lambda m: 'href="#%s"' % m.group(1) if ('id="%s"' % m.group(1)) in pagina else 'href="%s"' % salida,
                    pagina)
    pagina = pagina.replace('<a class="ann-slide" href="#destacadas"', '<a class="ann-slide" href="#combo"')
    # «Ver la página completa de la pieza», en la ficha: llevaría a una página
    # con todo el menú. Se oculta por CSS (tienda.js le sigue poniendo href).
    pagina = pagina.replace('<a class="fx-pag" id="fx-pag" href="index.html">', '<a class="fx-pag" id="fx-pag" href="#top" hidden>')
    # El logotipo sí vuelve a la portada, como en toda la tienda (pedido del
    # propietario, 2026-11-20): un logo que no responde es otro clic muerto.
    # Es la única salida a propósito.
    pagina = pagina.replace('<a class="brand" href="#top">', '<a class="brand" href="index.html">')
    # WhatsApp: el ícono flotante, abajo a la derecha (el regalo va a la
    # izquierda). El propietario pidió que volviera (2026-11-20); en el resto
    # de la tienda se quitó el 2026-10-02. Sin botón en la cabecera: con los
    # dos, uno sobraba.
    flotante = ('<a class="cp-wa-float" data-wa="flotante" data-wa-evento="Contact" href="%s" target="_blank" '
                'rel="noopener" aria-label="Escríbenos por WhatsApp">%s</a>\n' % (wa_href(tema), WA_ICONO))
    return pagina.replace('</body>', flotante + '</body>', 1)


def generar_campana(c, html, escribir):
    cat = json.loads((RAIZ / 'assets' / 'catalogo.json').read_text(encoding='utf-8'))
    grupos = cat['grupos']
    tema = [pid for pid, g in grupos.items() if g == c['grupo']]
    fuera = [d for d in c['destacados'] if grupos.get(d) != c['grupo']]
    if fuera:
        raise SystemExit('Campaña %s: %s no es del grupo %s. Solo el tema.' % (c['id'], ', '.join(fuera), c['grupo']))
    resto = [pid for pid in tema if pid not in c['destacados']]
    # Una destacada agotada no ocupa el primer pantallazo: tienda.js la muda al
    # final de «Toda la colección» con las existencias en vivo. Aquí solo se
    # avisa con el último conteo (stock.json no sabe lo vendido después).
    stock = json.loads((RAIZ / 'assets' / 'stock.json').read_text(encoding='utf-8'))['items']
    for d in c['destacados']:
        it = stock.get(d) or {}
        if (sum(it['tallas'].values()) if it.get('tallas') else it.get('stock', 0)) <= 0:
            print('  AVISO  %s: «%s» está en 0 en el último conteo; en la página baja al final.' % (c['archivo'], d))
    b = bloques(html)
    p = precios_de_combo({'id': c['base'], 'talla': None}, c['destacados'] + resto)
    desc = '%s: %s' % (c['titulo'], c['texto'])
    pagina = PAGINA_CAMPANA.format(
        id=c['id'], archivo=c['archivo'], eyebrow=c['eyebrow'], titulo=c['titulo'], texto=c['texto'],
        desc=desc.replace('"', ''), og=c.get('og', 'assets/avengers-marmol.webp'),
        head=b['head'], ann=b['ann'], header=b['header'], talla=b['talla'],
        resenas=b['resenas'], pagos=b['pagos'], confianza=b['confianza'], chrome=b['chrome'],
        tarjetas_dest='\n'.join('    ' + t for t in tarjetas(html, c['destacados'])),
        tarjeta_base='\n'.join('      ' + t for t in tarjetas(html, [c['base']])),
        tarjetas_resto='\n'.join('    ' + t for t in tarjetas(html, resto)),
        n_resto=len(resto), escalera=escalones(c['base'], p, '#piezas'),
        contraentrega=p['contraentrega'], pie=pie_campana(c['eyebrow']),
    )
    pagina = solo_tema(pagina, c['eyebrow'])
    destino = RAIZ / c['archivo']
    if escribir:
        destino.write_text(pagina, encoding='utf-8')
    print('  %s  %s  (%d destacadas + %d del tema, %d KB)' % ('escrito ' if escribir else 'se escribiría',
          c['archivo'], len(c['destacados']), len(resto), len(pagina) // 1024))


def redireccion_de_anuncio(archivo):
    """Manda a su página de campaña a quien llega a «archivo» desde un anuncio.

    El enlace de un anuncio hecho desde una publicación no se puede cambiar
    sin rehacerlo, y rehacerlo pierde sus reacciones y comentarios. Así que el
    anuncio sigue apuntando a la colección y esta, solo si la visita trae el
    utm_content de ese anuncio (campanas.json: «desde» y «anuncios»), la pasa
    a la campaña conservando utm y fbclid. Va lo primero del <head>, antes del
    píxel: la colección no llega a pintarse ni a contar un PageView de más.

    Con «desde_meta» pasa también cualquier visita con fbclid: los anuncios
    armados desde una publicación de Instagram no llevan utm (BF 4, el de
    Marvel, 2026-11-20), y lo único que traen es el fbclid que Meta le pone a
    todo clic, sea de anuncio o de publicación normal.
    """
    campanas = json.loads(CAMPANAS_JSON.read_text(encoding='utf-8'))['campanas']
    reglas = {}
    meta = ''
    for c in campanas:
        if c.get('desde') == archivo:
            if c.get('desde_meta'):
                if meta:
                    raise SystemExit('Dos campañas con desde_meta para %s: solo puede haber una.' % archivo)
                meta = c['archivo']
            for ad in c.get('anuncios') or []:
                if not re.fullmatch(r'[0-9]+', ad):
                    raise SystemExit('Campaña %s: id de anuncio inválido: %r' % (c['id'], ad))
                reglas[ad] = c['archivo']
    if not reglas and not meta:
        return ''
    return ('<script>/* Visita de un anuncio con página de campaña: ver gen_colecciones.py */'
            '(function(){try{var q=new URLSearchParams(location.search),m=%s,'
            'd=m[q.get("utm_content")]||(q.get("fbclid")?%s:"");'
            'if(d)location.replace(d+location.search)}catch(e){}})()</script>\n' % (json.dumps(reglas), json.dumps(meta)))


def generar_campanas(html, escribir):
    for c in json.loads(CAMPANAS_JSON.read_text(encoding='utf-8'))['campanas']:
        generar_campana(c, html, escribir)


def pie_campana(tema):
    """El pie de una página de campaña: WhatsApp y lo legal, sin el menú de
    categorías del pie de la portada."""
    return ('<footer class="cp-foot">\n  <div class="wrap">\n'
            '    <span class="brand">Zephora <em>Charms</em></span>\n'
            '    <p>¿Dudas con tu pedido? <a data-wa="pie" data-wa-evento="Contact" href="%s">Escríbenos por WhatsApp</a>'
            ' · +57 301 899 0672</p>\n'
            '    <ul>\n'
            '      <li><a href="envios-y-devoluciones.html">Envíos y devoluciones</a></li>\n'
            '      <li><a href="politica-de-privacidad.html">Política de privacidad</a></li>\n'
            '      <li><a href="terminos-y-condiciones.html">Términos y condiciones</a></li>\n'
            '    </ul>\n'
            # #year lo exige tienda.js: sin él el script se cae y el carrito queda mudo.
            '    <p>© 2024–<span id="year">2026</span> Zephora Charms</p>\n  </div>\n</footer>' % wa_href(tema))


def relacionadas_kit(k, cat, html):
    """Las piezas del mismo tema que el kit, sin las del kit. Salen de
    kits.json (pagina.relacionadas): un grupo de catalogo.json o una lista de
    ids. Van en lugar de «Colecciones populares», que llevaba a otros kits."""
    rel = (k.get('pagina') or {}).get('relacionadas') or {}
    propias = set([k['base']] + k['charms'])
    if rel.get('grupo'):
        ids = [pid for pid, g in cat['grupos'].items() if g == rel['grupo']]
    else:
        ids = list(rel.get('ids') or [])
    faltan = [pid for pid in ids if pid not in cat['precios']]
    if faltan:
        raise SystemExit('Kit %s: relacionadas que no existen en el catálogo: %s' % (k['id'], ', '.join(faltan)))
    ids = [pid for pid in ids if pid not in propias]
    if not ids:
        return ''
    return ('<section class="cp-sec wrap" id="relacionadas">\n'
            '  <span class="eyebrow">%s</span>\n  <h2>Combinan con este kit</h2>\n'
            '  <p class="col-sub">%d piezas más del mismo tema, en Plata Esterlina 925 verificada.</p>\n'
            '  <div class="grid" data-agotadas-final>\n%s\n  </div>\n</section>\n\n'
            % (k['nombre'], len(ids), '\n'.join('    ' + t for t in tarjetas(html, ids))))


def main():
    escribir = '--escribir' in sys.argv
    html = INDEX.read_text(encoding='utf-8')
    print('Colecciones desde index.html:')
    for col in COLECCIONES:
        generar(col, html, escribir)
    print('\nKits:')
    generar_kits(html, escribir)
    print('\nUna página por kit:')
    generar_paginas_kit(html, escribir)
    print('\nMás vendidos:')
    generar_mas_vendidos(html, escribir)
    print('\nCampañas:')
    generar_campanas(html, escribir)
    if not escribir:
        print('\nNo se escribió nada. Repite con --escribir.')


if __name__ == '__main__':
    main()
