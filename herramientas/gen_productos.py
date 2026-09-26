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
import subprocess
import sys
import urllib.parse

from gen_colecciones import RAIZ, INDEX, COLECCIONES, bloques, tarjetas, arregla_nav

SITIO = 'https://zephoracharms.com/'
MAX_RELACIONADAS = 8
MAX_BRAZALETES = 4

# Ids que tienda.js crea él mismo; no tienen que venir en el HTML.
IDS_DINAMICOS = {'fx-gal', 'fx-pts', 'sin-res'}
# Ids de la ficha de producto que tienda.js usa SOLO tras comprobar que
# existen (el selector de paquetes no existe en un brazalete, por ejemplo).
# Si se agrega aquí uno que se use sin comprobar, la página se queda sin
# carrito en silencio: cada uno de estos va con su `if(el)` en tienda.js.
IDS_OPCIONALES = {'pq-mas', 'pq-faltan', 'pp-estrellas', 'pp-vendidas', 'pp-compra', 'pp-agotado',
                  'pp-encargo', 'pp-desc', 'rp-resumen', 'rp-lista', 'rp-form', 'rp-escribir'}


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
    return ids - IDS_DINAMICOS - IDS_OPCIONALES


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
    # Foto propia de la inicial si existe (catalogo.json ya la apunta); si no,
    # la del grupo. `?v=` con la fecha en que entraron, por la caché de una
    # semana de las .webp (netlify.toml).
    if cat['fotos'][pid] != img.split('/')[-1].split('?')[0]:
        img = 'assets/%s?v=20260925' % cat['fotos'][pid]
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
    <!-- El orden de la ficha es el de automatizaciones/tienda/ENCARGO-FICHA.md:
         estrellas, disponibilidad real, paquetes, botones, Addi, beneficios,
         acordeones. Estrellas, disponibilidad y «N compraron este mes» los
         escribe tienda.js con datos reales (reseñas aprobadas, disponibilidad,
         pedidos); si no hay dato, no se muestra nada: nunca un número fijo. -->
    <div class="pp-info">
      <a class="pp-estrellas estrellas" id="pp-estrellas" href="#resenas-pieza" hidden></a>
      <p class="fx-est" id="pp-est" aria-live="polite"></p>
      <p class="pp-vendidas" id="pp-vendidas" hidden></p>
{bloque_compra}
      <ul class="pp-bens">
{beneficios}
      </ul>
{acordeones}
    </div>
  </div>
</section>
{bloque_letras}
{talla}

<!-- 2 · CERCANAS. Tarjetas de index.html por data-id. -->
<section class="sec"{id_rel}>
  <div class="wrap">
    <span class="eyebrow">{rel_eyebrow}</span>
    <h2>{rel_titulo}</h2>
    {rel_sub}
    <div class="grid">
{tarjetas_rel}
    </div>
  </div>
</section>
{bloque_brazaletes}

<!-- 3 · RESEÑAS DE ESTA PIEZA (las aprobadas, con su promedio real) y el
     formulario para dejar una. Luego la prueba social general y los videos de
     clientas, los mismos bloques de index.html. Los videos no descargan nada
     hasta entrar en pantalla (IntersectionObserver de tienda.js). -->
{bloque_resenas}

{resenas}

{historia}

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


# ── Paquetes: todos los números salen de calcular() ─────────────────────────

def calcular_paquetes(pedidos):
    """Totales de los paquetes 1–4 de cada página, con calcular() de verdad y en
    una sola corrida de node para las 135. Nunca una tabla escrita a mano: si el
    precio y el cobro se separan, esto cambia solo y pruebas/paginas.js compara
    lo publicado contra calcular() otra vez.

    `pedidos` es una lista de {pid, base, ref}: con `base` el paquete es
    brazalete + N charms de `ref`; sin ella, N unidades de `pid`."""
    guion = '''
const {calcular} = require('./netlify/functions/_precios.js');
const cat = require('./assets/catalogo.json');
const pedidos = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const out = {};
for (const p of pedidos) {
  out[p.pid] = [1, 2, 3, 4].map(n => {
    const charms = Array(n).fill(p.ref || p.pid);
    const c = calcular({ base: p.base ? { id: p.base, talla: null } : null, charms, pago: 'anticipado' });
    const lista = (p.base ? cat.precios[p.base] : 0) + n * cat.precios[p.ref || p.pid];
    return { n, total: c.total, lista, ahorro: lista - c.total };
  });
}
console.log(JSON.stringify(out));
'''
    r = subprocess.run(['node', '-e', guion], cwd=RAIZ, input=json.dumps(pedidos),
                       capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        raise SystemExit('calcular() falló al armar los paquetes:\n' + r.stderr)
    return json.loads(r.stdout)


def charm_de_referencia(cat, stock):
    """Para el paquete de un brazalete hace falta el precio de «un charm». Se
    toma el precio más común entre los charms con unidades, y se dice en la
    página con qué precio se calculó: un total sin esa aclaración prometería
    un número que con otros charms no sale."""
    precios = {}
    for p, v in cat['precios'].items():
        if p in cat['pulseras'] or (unidades(stock.get(p)) or 0) <= 0:
            continue
        precios.setdefault(v, []).append(p)
    v = max(precios, key=lambda k: (len(precios[k]), k))
    return precios[v][0], v


WA = 'https://wa.me/573018990672?text='
WA_ADDI = WA + 'Hola%2C%20Zephora%20Charms.%20Quiero%20pagar%20mi%20pedido%20a%20cuotas%20con%20Addi.'


def fila_paquete(p, rotulo, radio, marcado):
    tachado = '<s>%s</s> ' % cop(p['lista']) if p['ahorro'] > 0 else ''
    ahorro = '<span class="pq-a">Ahorras %s</span>' % cop(p['ahorro']) if p['ahorro'] > 0 else ''
    entrada = ('<input type="radio" name="pq" value="%d"%s>' % (p['n'], ' checked' if marcado else '')) if radio else ''
    tag = 'label' if radio else 'div'
    return ('        <%s class="pq-o%s">%s<span class="pq-n">%s</span>'
            '<span class="pq-p">%s<b data-total="%d">%s</b></span>%s</%s>'
            % (tag, ' pq-o--best' if p['n'] == 4 else '', entrada, rotulo, tachado, p['total'],
               cop(p['total']), ahorro, tag))


def bloque_compra(pid, tipo, nombre, precio, paquetes, hay, ref_precio, completar, cat):
    """Selector de paquetes, botones, Addi y suscripción. Todo el bloque se
    esconde si la pieza está agotada (lo decide tienda.js con la disponibilidad
    real, y aquí con el conteo de stock.json para quien no tiene JavaScript)."""
    if tipo == 'brazalete':
        filas = '\n'.join(fila_paquete(p, 'Brazalete + %d charm%s' % (p['n'], 's' if p['n'] > 1 else ''), False, False)
                          for p in paquetes)
        selector = ('      <div class="pq pq--b">\n        <p class="pq-t">Arma tu pulsera: el descuento sube con cada charm</p>\n'
                    + filas + '\n        <p class="pq-nota">Desde 3 charms el brazalete baja 30%%. Totales calculados con '
                    'charms de %s, con pago en línea; con otros charms cambia el total, y el descuento se aplica '
                    'solo en el carrito.</p>\n      </div>' % cop(ref_precio))
        botones = ('      <div class="pp-cta"><button class="btn" type="button" data-comprar="%s">Comprar ahora</button></div>\n'
                   '      <p class="pp-nota-t">Elige tu talla en la pieza de arriba para agregarla al carrito.</p>' % pid)
    else:
        cuatro_por_tres = paquetes[3]['total'] == 3 * precio
        rotulos = ['Compra 1', 'Compra 2', 'Compra 3', 'Lleva 4, paga 3' if cuatro_por_tres else 'Compra 4']
        filas = '\n'.join(fila_paquete(p, rotulos[i], True, hay and p['n'] == 2) for i, p in enumerate(paquetes))
        minis = '\n'.join(
            '          <div class="pq-it"><img src="assets/%s" alt="" width="56" height="56" loading="lazy" decoding="async">'
            '<span>%s<small>%s</small></span><button type="button" class="pq-add" data-add="%s">Agregar</button></div>'
            % (cat['fotos'][c], H.escape(cat['nombres'][c]), cop(cat['precios'][c]), c) for c in completar)
        selector = ('      <fieldset class="pq">\n        <legend class="pq-t">Elige cuántos charms llevas</legend>\n'
                    + filas + '\n        <p class="pq-nota">El descuento se aplica solo en el carrito, con cualquier '
                    'combinación de charms. Totales con charms de este mismo precio y pago en línea.</p>\n'
                    '        <div class="pq-mas" id="pq-mas" hidden>\n          <p class="pq-mas-t">Completa tu paquete: '
                    'elige <b id="pq-faltan">1 charm</b> más</p>\n' + minis + '\n        </div>\n      </fieldset>')
        botones = ('      <div class="pp-cta">\n        <button class="btn btn--ghost" type="button" data-add="%s">Agregar al carrito</button>\n'
                   '        <button class="btn" type="button" data-comprar="%s">Comprar ahora</button>\n      </div>' % (pid, pid))
    oculto = '' if hay else ' hidden'
    return ('      <div class="pp-compra" id="pp-compra"%s>\n%s\n%s\n'
            '        <p class="pp-addi">También a cuotas con Addi: <a data-wa="pagos" href="%s">pregúntanos por WhatsApp</a></p>\n'
            '        <p class="pp-susc"><a href="#" data-susc>Suscríbete y llévate un charm de regalo</a> en tu primera compra de 2 charms o más.</p>\n'
            '      </div>\n'
            '      <p class="pp-agotado" id="pp-agotado"%s>Esta pieza está agotada. <a data-wa="encargo" id="pp-encargo" href="%s">Pídela por encargo por WhatsApp</a> y te avisamos cuando vuelva.</p>'
            % (oculto, selector, botones, WA_ADDI, '' if not hay else ' hidden',
               WA + urllib.parse.quote('Hola, Zephora Charms. Vi en la página que «%s» está agotado. '
                                        '¿Me pueden avisar cuándo vuelve o pedirlo por encargo?' % nombre)))


ICONO = {
    'envio': '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/>',
    'contra': '<rect x="3" y="6" width="18" height="12" rx="1.5"/><circle cx="12" cy="12" r="2.6"/>',
    'sello': '<path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.8z"/>',
    'regalo': '<rect x="3.5" y="9" width="17" height="11" rx="1"/><path d="M12 9v11M3.5 13h17M12 9C10 5 6.5 5.5 7.5 8c.6 1.4 4.5 1 4.5 1s3.9.4 4.5-1C17.5 5.5 14 5 12 9"/>',
    'cambio': '<path d="M4 9h13l-3-3M20 15H7l3 3"/>',
}


def beneficios(tipo, cat):
    """Solo lo que es cierto hoy, con las mismas palabras que ya usa el sitio
    (preguntas-frecuentes.html, envios-y-devoluciones.html)."""
    material = ('Baño de plata con capa e-coating' if tipo == 'brazalete'
                else 'Plata Esterlina 925 con sello grabado')
    items = [('envio', 'Envío gratis pagando en línea'),
             # Confirmado por el propietario el 2026-09-26. Sin hora de corte no se
             # promete «pide hoy y llega mañana»: se cuenta desde el despacho,
             # igual que la tabla de envios-y-devoluciones.html.
             ('envio', 'Bogotá: llega en 1 día hábil desde el despacho'),
             ('contra', 'Pago contraentrega (+%s)' % cop(cat['reglas']['envio']['contraentrega'])),
             ('sello', material),
             ('regalo', 'Empaque de regalo incluido'),
             ('cambio', 'Cambio de talla o retracto en 5 días hábiles')]
    return '\n'.join('        <li><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" '
                     'stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">%s</svg>%s</li>' % (ICONO[k], H.escape(t))
                     for k, t in items)


def acordeones(tipo, meta, grupo, cat):
    """Descripción · Materiales · Envíos · Contraentrega · Cuidados. Los textos
    salen de lo que el sitio ya publica en preguntas-frecuentes.html; no se
    inventa ni se amplía una promesa aquí. La ficha técnica (#pp-specs) y la
    descripción por familia (#pp-desc) las escribe tienda.js desde el mismo
    specsDe()/FAMILIAS que la ficha emergente."""
    contra = cop(cat['reglas']['envio']['contraentrega'])
    if tipo == 'brazalete':
        cuidado = ('El baño de los brazaletes no se oxida solo gracias al e-coating, pero puede perder brillo si se '
                   'expone a humedad, perfumes, cremas o sudor.')
    else:
        cuidado = ('La Plata 925 de los charms sí se oxida con el tiempo al contacto con el aire. Es la naturaleza de '
                   'la plata, no un defecto, y el brillo se recupera con un paño de joyería.')
    secciones = [
        ('Descripción', '<p>%s.</p><p id="pp-desc"></p>' % (
            H.escape('Brazalete %s' % meta.lower()) if tipo == 'brazalete' else 'Colección %s' % H.escape(grupo)), True),
        ('Materiales', '<dl class="fx-specs" id="pp-specs"></dl>', False),
        ('Envíos gratis', '<p>Envío <b>gratis</b> a toda Colombia pagando en línea. Enviamos por Inter Rapidísimo, y los '
                          'tiempos se cuentan en días hábiles desde que despachamos: Bogotá 1 día; municipios cercanos '
                          'a Bogotá 1 – 2; ciudades principales 2 – 4; resto del país 3 – 6. Te mandamos el número de '
                          'guía por WhatsApp o correo.</p>', False),
        ('Contraentrega', '<p>También puedes pagar al recibir, en efectivo al mensajero. El envío contraentrega cuesta '
                          '%s: lo cobra la transportadora al recaudar.</p>' % contra, False),
        ('Consejos y cuidados', '<p>%s</p><p>Guárdala en su bolsa cuando no la uses, quítatela para bañarte, nadar o '
                                'hacer ejercicio, y evita el contacto con perfumes y cremas. Para limpiarla, un paño '
                                'suave y seco.</p>' % cuidado, False),
    ]
    return '\n'.join('      <details class="pp-acc"%s><summary>%s</summary><div class="pp-acc-in">%s</div></details>'
                     % (' open' if abierto else '', t, c) for t, c, abierto in secciones)


BLOQUE_RESENAS = '''<section class="sec" id="resenas-pieza">
  <div class="wrap">
    <span class="eyebrow">Reseñas</span>
    <h2>Opiniones de {nombre}</h2>
    <div class="rp-resumen estrellas" id="rp-resumen"></div>
    <div class="rp-lista" id="rp-lista"><p class="rp-vacio">Todavía no hay reseñas publicadas de esta pieza.</p></div>
    <details class="rp-escribir" id="rp-escribir">
      <summary>Escribir una reseña</summary>
      <form class="rp-form" id="rp-form" novalidate>
        <fieldset class="rp-est"><legend>Tu calificación</legend>
          <label><input type="radio" name="estrellas" value="5">5</label><label><input type="radio" name="estrellas" value="4">4</label><label><input type="radio" name="estrellas" value="3">3</label><label><input type="radio" name="estrellas" value="2">2</label><label><input type="radio" name="estrellas" value="1">1</label>
        </fieldset>
        <label>Tu reseña<textarea name="texto" rows="4" maxlength="800" required></textarea></label>
        <div class="rp-dos"><label>Nombre<input name="nombre" maxlength="40" required autocomplete="given-name"></label>
        <label>Ciudad<input name="ciudad" maxlength="40" autocomplete="address-level2"></label></div>
        <input type="text" name="web" class="susc-trampa" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="btn" type="submit">Enviar reseña</button>
        <p class="rp-nota">Revisamos cada reseña antes de publicarla. Publicamos también las de pocas estrellas.</p>
        <p class="rp-msg" aria-live="polite"></p>
      </form>
    </details>
  </div>
</section>'''


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


def generar(pid, html, cat, stock, b, exigidos, paquetes, ref):
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
    pq = paquetes[pid]
    rel_sub = ''
    if tipo == 'brazalete':
        rel_eyebrow, rel_titulo, id_rel = 'Brazaletes', 'Más brazaletes', ' id="brazaletes"'
        bloque_b = ''
    else:
        # La venta cruzada dice el ahorro de llevar dos, calculado, no prometido.
        rel_sub = ('<p class="col-sub">Juntos rinden más: llevando dos charms de %s ahorras %s, y el descuento '
                   'sigue subiendo con cada uno.</p>' % (cop(precio), cop(pq[1]['ahorro']))) if pq[1]['ahorro'] > 0 else ''
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
        tarjeta='    ' + tarjeta, id_rel=id_rel, rel_sub=rel_sub,
        bloque_compra=bloque_compra(pid, tipo, nombre, precio, pq, hay, ref[1],
                                    [c for c in (rel + cat['destacados'])
                                     if c != pid and c in cat['precios'] and c not in cat['pulseras']
                                     and not c.startswith('letra-') and (unidades(stock.get(c)) or 0) > 0][:6], cat),
        beneficios=beneficios(tipo, cat), acordeones=acordeones(tipo, meta, grupo, cat),
        bloque_resenas=BLOQUE_RESENAS.format(nombre=H.escape(nombre)),
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
    ref = charm_de_referencia(cat, stock)
    paquetes = calcular_paquetes([
        {'pid': p, 'base': p, 'ref': ref[0]} if p in cat['pulseras'] else {'pid': p} for p in todos])
    salida, cuenta = [], {}
    for pid in todos:
        pagina, tipo = generar(pid, html, cat, stock, b, exigidos, paquetes, ref)
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
