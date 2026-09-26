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
    # DOS fbq('init', …) — el viejo, con el que optimiza la campaña, y el nuevo,
    # que recibe el Purchase de servidor. Ver CLAUDE.md § Píxeles.
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
        tercer_charm=p['tercerCharm'], charm_solo=p['charmSolo'],
        pulsera_sola=p['pulseraSola'], dos=p['dos'], tres=p['tres'],
        ahorro_tres=p['ahorroTres'], contraentrega=p['contraentrega'],
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
# Lo que la página enseña es la escalera que la tienda YA aplica: el mismo kit
# a 1, 2, 3 y 4 dijes. El salto que importa es del segundo al tercero —de ~5% a
# ~20%— porque ahí entra el 30% del brazalete además de la escala por cantidad.
# A ese escalón apunta la pauta, y por eso va marcado.
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


def vitrina(primeras, titulo='Relacionados', sin='', brazaletes=True):
    """El hueco del carrusel con pestañas que llena tienda.js (ver «Vitrina»
    allí). Aquí solo van las piezas de la primera pestaña, en orden; las demás
    salen en vivo de assets/catalogo.json, así que ni un nombre ni un precio se
    copia en el HTML."""
    return ('<div class="vit" data-vit="%s" data-vit-t="%s"%s%s>'
            '<div class="vit-tabs" role="tablist" aria-label="Elige una colección"></div>'
            '<div class="vit-rail" role="list"></div>'
            '<p class="vit-desliza">Toca una colección y desliza para ver más</p></div>'
            % (','.join(primeras), titulo, ' data-vit-sin="%s"' % sin if sin else '',
               '' if brazaletes else ' data-vit-b="0"'))


TARJETA_KIT = '''    <article class="kit" id="kit-{id}">
      <div class="kit-head">
        <span class="eyebrow">{eyebrow}</span>
        <h3>{nombre}</h3>
        <p class="kit-lema">{lema}</p>
        <p class="kit-entrada">{entrada}</p>
      </div>
      <div class="kit-piezas">{fotos}</div>
      <p class="kit-tercer">Con brazalete, <b>el tercer dije cuesta {tercer_dije}</b> en vez de {tercer_lista}.</p>
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
<title>Kits Zephora · Dijes de Plata 925 y brazalete, con descuento por cantidad</title>
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

<!-- LA ESCALERA, explicada una vez arriba y luego aplicada kit por kit. No es
     una promoción aparte: es el descuento que la tienda ya aplica sola. -->
<section class="kits-esc wrap">
  <h2>El descuento sube con cada dije</h2>
  <p class="col-sub">No hay códigos ni letra pequeña: se aplica solo al armar. Son dos
  descuentos que se suman — la escala por cantidad de dijes, y un <b>30% en el
  brazalete</b> a partir del tercero. Por eso el tercer dije es el que más baja el precio.</p>
  <div class="kits-esc-fila">
    <div class="kits-esc-p"><span>1 dije</span><b>—</b></div>
    <div class="kits-esc-p"><span>2 dijes</span><b>8%</b></div>
    <div class="kits-esc-p kits-esc-p--best"><span>3 dijes</span><b>15% <i>+ 30% brazalete</i></b></div>
    <div class="kits-esc-p"><span>4 o más</span><b>25% <i>+ 30% brazalete</i></b></div>
  </div>
</section>

<section class="kits wrap">
{tarjetas}
</section>

<section class="col-resto wrap">
  <h2>¿Prefieres armarla tú?</h2>
  <p class="col-sub">Los kits son un punto de partida, no una caja cerrada: puedes
  cambiar cualquier pieza en el carrito, o empezar de cero con las {n_catalogo} del catálogo.</p>
  <a class="btn btn--ghost" href="index.html#charms">Ver el catálogo completo</a>
</section>

{talla}

{resenas}

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
            mejor = (p['n'] == 3)
            filas.append(PASO_KIT.format(
                clase=' kit-paso--best' if mejor else '',
                piezas=','.join(p['piezas']),
                n=p['n'], s='s' if p['n'] > 1 else '',
                total=p['totalTexto'],
                lista=p['listaTexto'] if p['dto'] > 0 else '',
                marca=('El mejor salto · ahorras %s' % p['ahorro']) if mejor
                      else ('ahorras %s' % p['ahorro'] if p['dto'] > 0 else 'precio de lista'),
            ))

        tercero = pasos[2]
        tarjetas_html.append(TARJETA_KIT.format(
            id=k['id'], eyebrow=k['eyebrow'], nombre=k['nombre'],
            lema=k['lema'], entrada=k['entrada'],
            fotos=''.join(miniaturas),
            tercer_dije=tercero['esteDije'], tercer_lista=tercero['listaDije'],
            pasos='\n'.join(filas),
            base=k['base'], base_nombre=nombres[k['base']].replace('Pulsera ', ''),
            vitrina=vitrina(k['charms'], 'De este kit', brazaletes=False),
        ))

    b = bloques(html)
    n_catalogo = len(cat['precios'])
    desc = ('Kits con dijes en Plata Esterlina 925 con sello grabado y brazalete con '
            'baño de plata de alta calidad. '
            'El descuento sube con cada dije y se aplica solo: hasta 25% en dijes '
            'y 30% en el brazalete. Envío gratis a toda Colombia.')

    pagina = PAGINA_KITS.format(
        head=b['head'], ann=b['ann'], header=b['header'], talla=b['talla'],
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
    pagina = (cabeza + MV_CUERPO + PAGINA_KITS[fin:]).format(
        head=b['head'], ann=b['ann'], header=b['header'], talla=b['talla'],
        resenas=b['resenas'], pagos=b['pagos'], confianza=b['confianza'],
        footer=b['footer'], chrome=b['chrome'], desc=desc)
    pagina = arregla_nav(pagina)
    destino = RAIZ / 'coleccion-mas-vendidos.html'
    if escribir:
        destino.write_text(pagina, encoding='utf-8')
        print('  escrito  coleccion-mas-vendidos.html  (%d KB)' % (len(pagina) // 1024))
    else:
        print('  se escribiría  coleccion-mas-vendidos.html  (%d KB)' % (len(pagina) // 1024))


def main():
    escribir = '--escribir' in sys.argv
    html = INDEX.read_text(encoding='utf-8')
    print('Colecciones desde index.html:')
    for col in COLECCIONES:
        generar(col, html, escribir)
    print('\nKits:')
    generar_kits(html, escribir)
    print('\nMás vendidos:')
    generar_mas_vendidos(html, escribir)
    if not escribir:
        print('\nNo se escribió nada. Repite con --escribir.')


if __name__ == '__main__':
    main()
