#!/usr/bin/env python3
"""Genera una página por producto: producto-<id>.html, una por cada pieza de
assets/catalogo.json (charms, iniciales y brazaletes).

── Para qué ──

Para que el píxel mida por pieza. La página lleva `<body data-producto="id">`
y tienda.js manda al cargar un ViewContent con content_type 'product' y
content_ids [id]. El id es el MISMO de catalogo.json, que es el que usará el
catálogo de Meta: el retargeting dinámico empata sin ningún mapeo.

── Por qué URLs planas en la raíz y no /producto/<id> ──

tienda.js construye rutas relativas en tiempo de ejecución —fetch de
assets/stock.json, location.href='checkout.html', las fotos de la galería—
que este generador no puede reescribir. En una subcarpeta se romperían sin dar
error: sin inventario, sin galería y con el botón de pagar llevando a un 404.
`<base href="/">` las arreglaría, pero convierte cada href="#seccion" en un
salto a la portada. Planas, igual que coleccion-marvel.html y kits.html.

── Por qué se genera ──

Misma razón que gen_colecciones.py, del que se reutiliza la extracción: el
andamiaje del carrito y las tarjetas salen de index.html, que sigue siendo la
única fuente. La tarjeta de la pieza ES el bloque principal de la página —con
su botón, sus marcas de agotado y su panel de tallas—, así que tienda.js la
maneja igual que en la portada sin una línea nueva de lógica de carrito.

── Cómo se usa ──

    python herramientas/gen_productos.py                      # muestra qué haría
    python herramientas/gen_productos.py --escribir           # escribe las 135
    python herramientas/gen_productos.py --solo a,b --escribir   # solo esas

Se para con error, sin escribir nada, si a alguna página le faltan los dos
fbq('init'), zcEvId, algún id que tienda.js usa sin comprobar, si repite un id,
o si el precio que muestra la tarjeta no es el de catalogo.json.
"""
import html as H
import json
import re
import sys
import urllib.parse

from gen_colecciones import RAIZ, INDEX, COLECCIONES, bloques, tarjetas, arregla_nav

SITIO = 'https://zephoracharms.com/'
MAX_RELACIONADAS = 8
MAX_BRAZALETES = 4

# Ids que tienda.js crea él mismo; no tienen que venir en el HTML.
IDS_DINAMICOS = {'fx-gal', 'fx-pts', 'sin-res'}


def archivo_de(pid):
    return 'producto-%s.html' % pid


def href_de(pid):
    """El enlace, con la ñ de letra-ñ codificada."""
    return urllib.parse.quote(archivo_de(pid))


def cop(n):
    """Mismo formato que cop() de tienda.js y _precios.js: $86.000."""
    return '$' + format(int(round(n)), ',').replace(',', '.')


def ids_que_exige_tiendajs():
    t = (RAIZ / 'tienda.js').read_text(encoding='utf-8')
    ids = set(re.findall(r"\$\('#([\w-]+)'\)", t)) | set(re.findall(r"getElementById\('([\w-]+)'\)", t))
    return ids - IDS_DINAMICOS


def unidades(item):
    """stock.json guarda las unidades de DOS formas: charm `stock`, brazalete
    `tallas`. Un `item.get('stock') or 0` deja las 18 pulseras en cero sin dar
    ningún error."""
    if item is None:
        return None
    if 'tallas' in item:
        return sum(item['tallas'].values())
    return item.get('stock', 0)


# ── La tarjeta principal ────────────────────────────────────────────────────

def tarjeta_principal(html, pid, cat):
    """La tarjeta de la pieza, agrandada: nombre en <h1> y foto sin carga
    diferida (es lo primero que se ve)."""
    if pid.startswith('letra-'):
        t = tarjeta_inicial(html, pid, cat)
    else:
        t = tarjetas(html, [pid])[0]   # ya sin pc--top, el ancho de carrusel
    t = re.sub(r'class="pc( |")', r'class="pc pc--pp\1', t, count=1)
    t = t.replace('<h3 class="pc-name">', '<h1 class="pc-name">', 1).replace('</h3>', '</h1>', 1)
    # En su propia página, el nombre no se enlaza a sí mismo.
    t = re.sub(r'<h1 class="pc-name"><a href="[^"]*">(.*?)</a></h1>', r'<h1 class="pc-name">\1</h1>', t, count=1)
    t = t.replace(' loading="lazy"', ' fetchpriority="high"', 1)
    return t


def tarjeta_inicial(html, pid, cat):
    """Las 27 iniciales comparten una sola tarjeta en la portada («letras»), así
    que la suya se arma con la foto y el sello de esa tarjeta y el nombre y el
    precio de catalogo.json. El botón es el mismo `data-add` que ya maneja
    tienda.js para cualquier charm."""
    m = re.search(r'<article class="pc[^"]*" data-id="letras"[\s\S]*?</article>', html)
    if not m:
        raise SystemExit('No se encontró la tarjeta «letras» en index.html.')
    letras = m.group(0)
    img = re.search(r'<img src="([^"]+)"', letras).group(1)
    sello = re.search(r'<span class="pc-mark[^"]*">[^<]*</span>', letras).group(0)
    n = H.escape(cat['nombres'][pid])
    return ('<article class="pc" data-id="%s" data-g="Letras">\n'
            '<div class="pc-img"><img src="%s" alt="%s" width="440" height="440" loading="lazy" decoding="async">%s</div>\n'
            '<div class="pc-body"><h3 class="pc-name">%s</h3><p class="pc-meta">Inicial</p>\n'
            '<div class="pc-foot"><span class="pc-price">%s</span><button class="pc-add" type="button" '
            'data-add="%s" aria-label="Agregar %s">Agregar</button></div></div></article>'
            % (pid, img, n, sello, n, cop(cat['precios'][pid]), pid, n))


# ── Lo que acompaña a la pieza ──────────────────────────────────────────────

def relacionadas(pid, tipo, grupo, cat, stock):
    """Hasta 8 piezas cercanas: las de su colección, primero las que tienen
    unidades. Sin hermanas (o para una inicial), los destacados de la tienda."""
    if tipo == 'brazalete':
        pool = [p for p in cat['pulseras'] if p != pid]
    elif tipo == 'charm':
        pool = [p for p, g in cat['grupos'].items() if g == grupo and p != pid]
    else:
        pool = []
    if not pool:
        pool = [p for p in cat['destacados'] if p != pid]
    pool = [p for p in pool if p != 'letras' and not p.startswith('letra-')]
    pool.sort(key=lambda p: (unidades(stock.get(p)) or 0) <= 0)   # estable: con unidades primero
    return pool[:MAX_RELACIONADAS]


def brazaletes_con_talla(stock, cat):
    return [p for p in cat['pulseras'] if (unidades(stock.get(p)) or 0) > 0][:MAX_BRAZALETES]


def migas(tipo, grupo, nombre):
    col = {c['grupo']: c['archivo'] for c in COLECCIONES}
    if tipo == 'brazalete':
        paso = ('Brazaletes', col.get('Brazaletes', 'index.html#brazaletes'))
    elif tipo == 'inicial':
        paso = ('Iniciales', 'index.html#charms')
    else:
        paso = (grupo or 'Charms', col.get(grupo, 'index.html#charms'))
    return ('<nav class="migas wrap" aria-label="Estás en">\n  <ol>\n'
            '    <li><a href="index.html">Inicio</a></li>\n'
            '    <li><a href="%s">%s</a></li>\n'
            '    <li aria-current="page">%s</li>\n  </ol>\n</nav>'
            % (paso[1], H.escape(paso[0]), H.escape(nombre)))


# ── La página ───────────────────────────────────────────────────────────────

PAGINA = '''<!DOCTYPE html>
<html lang="es-CO">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{titulo}</title>
<meta name="description" content="{desc}">
<link rel="icon" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iNCIgZmlsbD0iIzJBMUYyRSIvPjx0ZXh0IHg9IjE2IiB5PSIyMyIgZm9udC1mYW1pbHk9Ikdlb3JnaWEsc2VyaWYiIGZvbnQtc2l6ZT0iMTkiIGZpbGw9IiNGNkYzRjQiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlo8L3RleHQ+PC9zdmc+">
<meta name="theme-color" content="#2A1F2E">
<link rel="canonical" href="{canon}">
<meta property="og:type" content="product">
<meta property="og:locale" content="es_CO">
<meta property="og:site_name" content="Zephora Charms">
<meta property="og:title" content="{titulo}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canon}">
<meta property="og:image" content="{imagen}">
<meta property="product:price:amount" content="{precio}">
<meta property="product:price:currency" content="COP">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{titulo}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{imagen}">
<script type="application/ld+json">{jsonld}</script>
{head}
<link rel="stylesheet" href="tienda.css">
</head>
<body data-producto="{pid}">

{ann}

{header}

{migas}

<!-- 1 · LA PIEZA. Es su tarjeta de index.html, agrandada: el botón, el panel de
     tallas y las marcas de agotado los maneja tienda.js igual que en la
     portada. Disponibilidad y ficha técnica las escribe tienda.js
     (pintarPagina), con el mismo texto de material que la ficha emergente. -->
<section class="pp wrap" id="top">
  <div class="pp-in">
{tarjeta}
    <div class="pp-info">
      <p class="fx-est" id="pp-est" aria-live="polite"></p>
      <dl class="fx-specs" id="pp-specs"></dl>
      <p class="pp-envio">Envío <b>GRATIS</b> a toda Colombia pagando en línea · contraentrega disponible</p>
    </div>
  </div>
</section>
{bloque_letras}
<!-- PRUEBA SOCIAL, justo debajo de la pieza: reseñas y los videos de
     clientas, los mismos bloques de index.html (se actualizan solos al
     regenerar). Los videos no descargan nada hasta entrar en pantalla: los
     arranca el IntersectionObserver de tienda.js. -->
{resenas}

{historia}

<!-- 2 · CERCANAS. Tarjetas de index.html por data-id. -->
<section class="sec"{id_rel}>
  <div class="wrap">
    <span class="eyebrow">{rel_eyebrow}</span>
    <h2>{rel_titulo}</h2>
    <div class="grid">
{tarjetas_rel}
    </div>
  </div>
</section>
{bloque_brazaletes}
{talla}

{confianza}

{pagos}

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

BLOQUE_BRAZALETES = '''
<!-- 3 · LA BASE. Un charm necesita brazalete; estos tienen tallas con unidades. -->
<section class="sec" id="brazaletes">
  <div class="wrap">
    <span class="eyebrow">La base</span>
    <h2>Llévalo en un brazalete</h2>
    <p class="col-sub">Con brazalete y tres charms, el brazalete baja un 30%. El descuento se aplica solo en el carrito.</p>
    <div class="grid">
{tarjetas}
    </div>
  </div>
</section>
'''


def tira_letras(pid, cat):
    """Las 27 iniciales enlazadas entre sí. En la portada comparten una sola
    tarjeta con botones que agregan directo, así que sin esta tira ninguna
    página de inicial tendría quien la enlace salvo la de la A."""
    letras = [p for p in cat['precios'] if p.startswith('letra-')]
    items = ''.join(
        '<li><a href="%s"%s>%s</a></li>' % (href_de(p), ' aria-current="page"' if p == pid else '',
                                           H.escape(cat['nombres'][p].replace('Letra ', '')))
        for p in letras)
    return ('\n<nav class="pp-letras wrap" aria-label="Todas las iniciales">\n'
            '  <span class="eyebrow">Todas las iniciales</span>\n  <ul>%s</ul>\n</nav>\n' % items)


def jsonld(pid, nombre, imagen, precio, grupo, hay, canon):
    """Datos estructurados de producto. La disponibilidad es la del conteo de
    stock.json al generar, igual que el resto de tienda.js: no ve lo apartado
    en vivo."""
    d = {
        '@context': 'https://schema.org', '@type': 'Product',
        'name': nombre, 'sku': pid, 'image': imagen,
        'brand': {'@type': 'Brand', 'name': 'Zephora Charms'},
        'category': grupo,
        'offers': {'@type': 'Offer', 'price': precio, 'priceCurrency': 'COP', 'url': canon,
                   'availability': 'https://schema.org/' + ('InStock' if hay else 'OutOfStock')},
    }
    return json.dumps(d, ensure_ascii=False).replace('</', '<\\/')


def generar(pid, html, cat, stock, b, exigidos):
    tipo = ('brazalete' if pid in cat['pulseras']
            else 'inicial' if pid.startswith('letra-') else 'charm')
    grupo = {'brazalete': 'Brazaletes', 'inicial': 'Iniciales'}.get(tipo) or cat['grupos'].get(pid, 'Charms')
    nombre = cat['nombres'][pid]
    precio = cat['precios'][pid]

    tarjeta = tarjeta_principal(html, pid, cat)
    # El precio que ve la clienta tiene que ser el que cobra el servidor.
    visto = re.search(r'<span class="pc-price">([^<]*)</span>', tarjeta).group(1)
    if visto != cop(precio):
        raise SystemExit('%s: la tarjeta muestra %s y catalogo.json cobra %s.' % (pid, visto, cop(precio)))
    sello = re.search(r'<span class="pc-mark[^"]*">([^<]*)</span>', tarjeta).group(1)
    meta = re.search(r'<p class="pc-meta">([^<]*)</p>', tarjeta).group(1)
    foto = re.search(r'<img src="([^"]+)"', tarjeta).group(1)
    imagen = SITIO + foto
    canon = SITIO + href_de(pid)
    hay = (unidades(stock.get(pid)) or 0) > 0

    rel = relacionadas(pid, tipo, grupo, cat, stock)
    if tipo == 'brazalete':
        rel_eyebrow, rel_titulo, id_rel = 'Brazaletes', 'Más brazaletes', ' id="brazaletes"'
        bloque_b = ''
    else:
        mismo = tipo == 'charm' and any(cat['grupos'].get(p) == grupo for p in rel)
        rel_eyebrow = grupo if mismo else 'Zephora'
        rel_titulo = ('Más de %s' % grupo) if mismo else 'Las más pedidas'
        id_rel = ''
        bloque_b = BLOQUE_BRAZALETES.format(tarjetas='\n'.join(
            '      ' + t.replace('class="pc pc--top"', 'class="pc"')
            for t in tarjetas(html, brazaletes_con_talla(stock, cat))))

    titulo = '%s · %s · Zephora Charms' % (nombre, sello)
    desc = '%s · %s. %s. %s con envío gratis a toda Colombia pagando en línea, o contraentrega.' % (
        nombre, sello, meta, cop(precio))

    pagina = PAGINA.format(
        titulo=H.escape(titulo), desc=H.escape(desc), canon=canon, imagen=imagen, precio=precio,
        jsonld=jsonld(pid, nombre, imagen, precio, grupo, hay, canon), pid=pid,
        head=b['head'], ann=b['ann'], header=b['header'], migas=migas(tipo, grupo, nombre),
        tarjeta='    ' + tarjeta, id_rel=id_rel,
        bloque_letras=tira_letras(pid, cat) if tipo == 'inicial' else '', rel_eyebrow=H.escape(rel_eyebrow),
        rel_titulo=H.escape(rel_titulo),
        tarjetas_rel='\n'.join('      ' + t for t in tarjetas(html, rel)),
        resenas=b['resenas'], historia=b['historia'],
        bloque_brazaletes=bloque_b, talla=b['talla'], confianza=b['confianza'],
        pagos=b['pagos'], footer=b['footer'], chrome=b['chrome'],
    )
    pagina = arregla_nav(pagina)
    comprobar(pid, pagina, exigidos)
    return pagina, tipo


def comprobar(pid, pagina, exigidos):
    """Lo que las pruebas de datos no ven y deja la página sin carrito o sin
    medir, sin dar error en el navegador."""
    errores = []
    n_init = len(re.findall(r"fbq\('init',\s*'\d+'\)", pagina))
    if n_init != 2:
        errores.append("%d fbq('init') en vez de 2" % n_init)
    if 'window.zcEvId' not in pagina:
        errores.append('sin zcEvId (se pierde el eventID de deduplicación)')
    ids = re.findall(r'\sid="([^"]+)"', pagina)
    faltan = sorted(exigidos - set(ids))
    if faltan:
        errores.append('faltan ids que tienda.js usa: ' + ' '.join(faltan))
    rep = sorted({i for i in ids if ids.count(i) > 1})
    if rep:
        errores.append('ids repetidos: ' + ' '.join(rep))
    if 'data-producto="%s"' % pid not in pagina:
        errores.append('sin data-producto')
    if errores:
        raise SystemExit('%s:\n  - %s' % (archivo_de(pid), '\n  - '.join(errores)))


NO_INDEXAR = {'checkout.html', 'gracias.html', '404.html'}


def sitemap():
    """sitemap.xml con la URL canónica de cada página pública de la raíz, leída
    de su propio <link rel="canonical">: si una página cambia de canónica, el
    sitemap la sigue sin tocar esto. Sin canonical, se para: una página pública
    sin canónica es un fallo que conviene ver."""
    urls = []
    for f in sorted(RAIZ.glob('*.html')):
        if f.name in NO_INDEXAR:
            continue
        h = f.read_text(encoding='utf-8')
        if re.search(r'<meta name="robots" content="[^"]*noindex', h):
            continue
        m = re.search(r'<link rel="canonical" href="([^"]+)"', h)
        if not m:
            raise SystemExit('%s no tiene <link rel="canonical">; no se puede poner en el sitemap.' % f.name)
        urls.append(m.group(1))
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + ''.join('  <url><loc>%s</loc></url>\n' % H.escape(u) for u in urls)
           + '</urlset>\n')
    robots = ('User-agent: *\nDisallow: /checkout\nDisallow: /checkout.html\n'
              'Disallow: /gracias\nDisallow: /gracias.html\n\nSitemap: %ssitemap.xml\n' % SITIO)
    return xml, robots, len(urls)


def main():
    escribir = '--escribir' in sys.argv
    cat = json.loads((RAIZ / 'assets' / 'catalogo.json').read_text(encoding='utf-8'))
    stock = json.loads((RAIZ / 'assets' / 'stock.json').read_text(encoding='utf-8'))['items']
    html = INDEX.read_text(encoding='utf-8')
    b = bloques(html)
    exigidos = ids_que_exige_tiendajs()

    todos = list(cat['precios'])
    if '--solo' in sys.argv:
        pedidos = sys.argv[sys.argv.index('--solo') + 1].split(',')
        desconocidos = [p for p in pedidos if p not in cat['precios']]
        if desconocidos:
            raise SystemExit('No están en catalogo.json: ' + ', '.join(desconocidos))
        todos = pedidos

    # Primero se generan y comprueban TODAS; solo después se escribe. Una sola
    # página rota para la tanda entera en vez de dejar la mitad escrita.
    salida, cuenta = [], {}
    for pid in todos:
        pagina, tipo = generar(pid, html, cat, stock, b, exigidos)
        salida.append((pid, pagina))
        cuenta[tipo] = cuenta.get(tipo, 0) + 1

    for pid, pagina in salida:
        if escribir:
            (RAIZ / archivo_de(pid)).write_text(pagina, encoding='utf-8')
    print('%s %d páginas de producto (%s) · %d ids exigidos por tienda.js comprobados en cada una'
          % ('Escritas' if escribir else 'Se escribirían', len(salida),
             ', '.join('%d %s' % (v, k) for k, v in sorted(cuenta.items())), len(exigidos)))
    # El sitemap solo con la tanda completa: con --solo faltarían páginas.
    if '--solo' not in sys.argv and escribir:
        xml, robots, n = sitemap()
        (RAIZ / 'sitemap.xml').write_text(xml, encoding='utf-8', newline='\n')
        (RAIZ / 'robots.txt').write_text(robots, encoding='utf-8', newline='\n')
        print('sitemap.xml con %d URLs · robots.txt' % n)
    if not escribir:
        print('No se escribió nada. Repite con --escribir.')


if __name__ == '__main__':
    main()
