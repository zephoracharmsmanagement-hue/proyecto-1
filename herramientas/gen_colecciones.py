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
    # DOS fbq('init', …) — el viejo, con el que optimiza la campaña, y el nuevo,
    # que recibe el Purchase de servidor. Ver CLAUDE.md § Píxeles.
    b['head'] = _entre(html, '<link rel="preconnect" href="https://fonts.googleapis.com">',
                       '<link rel="stylesheet" href="tienda.css">')
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
  tercerCharm: cop(tres.total - dos.total),
  contraentrega: cop(calcular({base, charms: charms.slice(0, 3), pago: 'contraentrega'}).total),
}));
''' % (json.dumps(base), json.dumps(charms[:3]))
    r = subprocess.run(['node', '-e', guion], cwd=RAIZ, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit('calcular() falló:\n' + r.stderr)
    return json.loads(r.stdout)


# ── La página ───────────────────────────────────────────────────────────────

PAGINA = '''<!DOCTYPE html>
<html lang="es-CO">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{titulo} · Zephora Charms</title>
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
</head>
<body>

{ann}

{header}

<!-- 1 · PORTADA DE LA COLECCIÓN — a esto apunta la pauta. Quien llega viene de
     un anuncio de esta colección, así que lo primero que ve es la colección,
     no el catálogo entero. -->
<section class="col-hero wrap" id="top">
  <img class="col-foto" src="{foto}" alt="{foto_alt}" width="{foto_w}" height="{foto_h}"
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
  <p class="col-sub">Brazalete + 3 charms. El descuento por brazalete y la escala por
  cantidad se aplican juntos, así que <b>el tercer charm cuesta {tercer_charm}</b> en vez de {charm_solo}.</p>
  <div class="col-escalera">
    <div class="col-paso"><span class="col-paso-n">Brazalete solo</span><b>{pulsera_sola}</b></div>
    <div class="col-paso"><span class="col-paso-n">+ 2 charms</span><b>{dos}</b></div>
    <div class="col-paso col-paso--best"><span class="col-paso-n">+ 3 charms</span><b>{tres}</b>
      <span class="col-paso-ahorro">ahorras {ahorro_tres}</span></div>
  </div>
  <p class="col-nota">Precios con pago anticipado y envío gratis. Contraentrega: {contraentrega}
  (el envío lo cobra la transportadora al recaudar).</p>
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
  <p class="col-sub">Hay {n_catalogo} charms más en el catálogo completo: Disney, Pixar, zodiaco,
  profesiones, muranos, iniciales y símbolos.</p>
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

    desc = col['entrada'][:300]
    pagina = PAGINA.format(
        archivo=col['archivo'], titulo=col['titulo'], eyebrow=col['eyebrow'],
        lema=col['lema'], entrada=col['entrada'], desc=desc, og=col['og'],
        head=b['head'], ann=b['ann'], header=b['header'], talla=b['talla'],
        historia=b['historia'], resenas=b['resenas'], pagos=b['pagos'],
        confianza=b['confianza'], footer=b['footer'], chrome=b['chrome'],
        n_piezas=len(ids), n_catalogo=n_catalogo,
        foto=col['foto'], foto_alt=col['foto_alt'],
        foto_w=col['foto_w'], foto_h=col['foto_h'],
        tarjetas_charms='\n'.join('      ' + t for t in tarjetas(html, ids)),
        tarjeta_base='\n'.join('      ' + t for t in tarjetas(html, [col['base']])),
        tercer_charm=p['tercerCharm'], charm_solo=p['charmSolo'],
        pulsera_sola=p['pulseraSola'], dos=p['dos'], tres=p['tres'],
        ahorro_tres=p['ahorroTres'], contraentrega=p['contraentrega'],
    )

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


def main():
    escribir = '--escribir' in sys.argv
    html = INDEX.read_text(encoding='utf-8')
    print('Colecciones desde index.html:')
    for col in COLECCIONES:
        generar(col, html, escribir)
    if not escribir:
        print('\nNo se escribió nada. Repite con --escribir.')


if __name__ == '__main__':
    main()
