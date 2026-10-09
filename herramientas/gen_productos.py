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
import os
import re
import sys
import urllib.parse

from gen_colecciones import RAIZ, INDEX, COLECCIONES, bloques, tarjetas, arregla_nav, vitrina

SITIO = 'https://zephoracharms.com/'
MAX_RELACIONADAS = 8
MAX_BRAZALETES = 4

# Ids que tienda.js crea él mismo; no tienen que venir en el HTML.
IDS_DINAMICOS = {'fx-gal', 'fx-pts', 'sin-res'}
# Ids de la ficha de producto que tienda.js usa SOLO tras comprobar que
# existen (las estrellas no existen sin reseñas, por ejemplo).
# Si se agrega aquí uno que se use sin comprobar, la página se queda sin
# carrito en silencio: cada uno de estos va con su `if(el)` en tienda.js.
IDS_OPCIONALES = {'pq-mas', 'b-mas', 'b-mas-wrap', 'pp-estrellas', 'pp-vendidas', 'pp-compra', 'pp-agotado',
                  'pp-encargo', 'pp-desc', 'rp-resumen', 'rp-lista', 'rp-form', 'rp-escribir',
                  # Solo en la portada (EN_PORTADA) y en coleccion-mas-vendidos.html.
                  'charms', 'mv-aviso', 'mv-relleno', 'mv-relleno-sec', 'mv-vendidas'}


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
    # La cuota de Addi bajo el precio (pedido del propietario, 2026-10-08). Mismos
    # topes que el carrito (pintarCuotasAddi en tienda.js): de $50.000 a $600.000
    # es «sin interés»; la cuota se redondea hacia arriba al peso.
    precio = cat['precios'][pid]
    if 50000 <= precio <= 600000:
        cuota = cop(-(-precio // 3))
        t = t.replace('</div></div></article>',
                      '</div>\n<p class="pp-cuotas">o hasta 3 cuotas de <b>%s</b> sin interés con '
                      '<img class="addi-logo" src="assets/pagos/addi.webp?v=20260913" alt="Addi" width="183" '
                      'height="70" decoding="async"></p></div></article>' % cuota, 1)
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
        img = 'assets/%s?v=20261009' % cat['fotos'][pid]
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
      <a class="pp-estrellas estrellas" id="pp-estrellas" href="#reseñas" hidden></a>
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
{bloques_media}

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

<!-- 3 · RESEÑAS: una sola sección, «Lo que dicen nuestras clientas», el
     carrusel de index.html con todas las reseñas de la tienda y, debajo, el
     formulario para reseñar esta pieza (pedido del propietario, 2026-10-02:
     antes iba además una lista «Todas las reseñas de la tienda», repetida).
     Los videos de clientas no descargan nada hasta entrar en pantalla
     (IntersectionObserver de tienda.js). -->
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
{addi_script}
</body>
</html>
'''

BLOQUE_BRAZALETES = '''
<!-- 3 · LA BASE. Un charm necesita brazalete; estos tienen tallas con unidades. -->
<section class="sec" id="brazaletes">
  <div class="wrap">
    <span class="eyebrow">La base</span>
    <h2>Llévalo en un brazalete</h2>
    <p class="col-sub">El brazalete cuenta como una pieza más: con 4 piezas la de menor valor te sale gratis.</p>
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


# Medios de pago, sutiles, encima de la línea de Addi (pedido del propietario,
# 2026-09-26). Los mismos archivos oficiales que ya usa la sección de pagos de
# la portada (assets/pagos/, misma versión de caché).
PAGOS = ('        <p class="pp-pagos" aria-label="Medios de pago">' + ''.join(
    '<img src="assets/pagos/%s.webp?v=20260913" alt="%s" height="18" loading="lazy" decoding="async">' % (f, n)
    for f, n in [('visa', 'Visa'), ('mastercard', 'Mastercard'), ('pse', 'PSE'), ('nequi', 'Nequi'),
                 ('daviplata', 'Daviplata'), ('bancolombia', 'Bancolombia'), ('addi', 'Addi')]) + '</p>\n')

WA = 'https://wa.me/573018990672?text='
# Widget de Addi (manual de Addi, «Instalación del Addi Widget»): calcula solo
# la cuota mínima para el precio de la pieza. Desde 2026-10-07 Addi se paga en
# el checkout (integración propia), así que el «pregúntanos por WhatsApp» que
# iba aquí sobra. El script se carga una vez por página, al final (ADDI_SCRIPT).
#
# Solo en el dominio de la tienda y en las vistas previas de Netlify: el CDN de
# Addi rechaza otros orígenes (CORS) y su widget llena la consola de errores
# («reading 'isProxied'»). Pasó en las pruebas de GitHub, que sirven el sitio
# desde localhost: la consola limpia es una de las cosas que vigilan.
ADDI_SLUG = 'zephoracharms-ecommerce'
ADDI_SCRIPT = ('<script>/(^|\\.)zephoracharms\\.com$|\\.netlify\\.app$/.test(location.hostname)'
               '&&document.head.appendChild(Object.assign(document.createElement("script"),'
               '{src:"https://s3.amazonaws.com/widgets.addi.com/bundle.min.js",defer:true}))</script>')


# La promo («paga 3, lleva 1 gratis · paga 5, lleva 2», 2026-10-04) en un solo recuadro, junto al precio (pedido del
# propietario, 2026-10-02). Reemplaza al selector de paquetes «Compra 1 / 2 /
# 3 / Lleva 4», que con la escalera vieja obligaba a comparar cuatro totales.
# Es el mismo recuadro de la portada (#promo en index.html).
PROMO_CAJA = (
    '      <div class="promo-caja">\n'
    '        <p class="promo-caja-t">✨ PROMOCIÓN ACTIVA: <b>Paga 3 y llévate 1&nbsp;gratis.</b></p>\n'
    '        <p class="promo-caja-x">Mezcla charms y brazaletes: con 4 piezas la de menor valor te sale '
    'totalmente <b>GRATIS</b>, y con 7 piezas te salen <b>2 gratis</b>. <span>(Se aplica automáticamente).</span></p>\n'
    '      </div>')


def bloque_compra(pid, tipo, nombre, hay, primeras, precio):
    """Recuadro de la promo, botones, vitrina, medios de pago y suscripción.
    Todo el bloque se esconde si la pieza está agotada (lo decide tienda.js con
    la disponibilidad real, y aquí con el conteo de stock.json para quien no
    tiene JavaScript).

    La vitrina (pedido del propietario, 2026-09-26) va en TODAS las fichas,
    debajo de los botones: la clienta suma piezas de cualquier colección sin
    salir de la página, que es justo lo que pide la promo. En los
    charms antes se abría al elegir 2, 3 o 4 en el selector de paquetes, que ya
    no existe; ahora está siempre. Sin pestaña de brazaletes en la ficha de un
    brazalete: el carrito lleva uno solo, y ofrecer otro ahí lo cambiaría."""
    if tipo == 'brazalete':
        botones = ('      <div class="pp-cta"><button class="btn" type="button" data-comprar="%s">Comprar ahora</button></div>\n'
                   '      <p class="pp-nota-t">Elige tu talla en la pieza de arriba para agregarla al carrito.</p>\n'
                   '      <div class="pq-mas pq-mas--b">\n        <p class="pq-mas-t">Elige los charms de tu pulsera aquí mismo</p>\n'
                   '        %s\n      </div>' % (pid, vitrina(primeras, 'Más pedidos', sin=pid, brazaletes=False)))
    else:
        botones = ('      <div class="pp-cta">\n        <button class="btn btn--ghost" type="button" data-add="%s">Agregar al carrito</button>\n'
                   '        <button class="btn" type="button" data-comprar="%s">Comprar ahora</button>\n      </div>\n'
                   '      <div class="pq-mas" id="pq-mas">\n        <p class="pq-mas-t">Completa tu set: con 4 piezas, '
                   'la de menor valor es <b>GRATIS</b></p>\n        %s\n      </div>'
                   % (pid, pid, vitrina(primeras, 'Relacionados', sin=pid)))
    selector = PROMO_CAJA
    oculto = '' if hay else ' hidden'
    return ('      <div class="pp-compra" id="pp-compra"%s>\n%s\n%s\n'
            '        <div class="pp-pago">\n%s'
            '        <div class="pp-addi"><addi-widget price="%d" ally-slug="%s"></addi-widget></div>\n'
            '        </div>\n'
            '        <p class="pp-susc"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" '
            'stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">%s</svg><span><a href="#" data-susc>Suscríbete y '
            'llévate de regalo el charm de tu inicial</a> en tu primera compra de 2 charms o más.</span></p>\n'
            '      </div>\n'
            '      <p class="pp-agotado" id="pp-agotado"%s>Esta pieza está agotada. <a data-wa="encargo" id="pp-encargo" href="%s">Pídela por encargo por WhatsApp</a> y te avisamos cuando vuelva.</p>'
            % (oculto, selector, botones, PAGOS, precio, ADDI_SLUG, ICONO['regalo'], '' if not hay else ' hidden',
               WA + urllib.parse.quote('Hola, Zephora Charms. Vi en la página que «%s» está agotado. '
                                        '¿Me pueden avisar cuándo vuelve o pedirlo por encargo?' % nombre)))


ICONO = {
    'envio': '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/>',
    'rapido': '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.8 1.8M9.5 2.5h5"/>',
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
             ('rapido', 'Bogotá: llega en 1 día hábil desde el despacho'),
             ('contra', 'Pago contraentrega (+%s)' % cop(cat['reglas']['envio']['contraentrega'])),
             ('sello', material),
             ('regalo', 'Empaque de regalo: caja, paño y dedicatoria escrita a mano'),
             ('cambio', 'Cambio de talla o retracto en 5 días hábiles')]
    return '\n'.join('        <li><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" '
                     'stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">%s</svg>%s</li>' % (ICONO[k], H.escape(t))
                     for k, t in items)


# Lo que la foto sola no explica (pedido del propietario, 2026-10-09: la foto del
# Camaleón muestra dos camaleones y se puede leer como dos piezas). Solo hechos
# que dio el propietario; sin inventar de qué color llega.
NOTAS_PIEZA = {
    'camaleon-verde': 'Cambia de color con la temperatura. En la foto ves <b>la misma pieza en sus dos '
                      'tonos</b>: recibes un solo charm.',
}


def acordeones(tipo, meta, grupo, cat, pid=None):
    """Descripción · Materiales · Envíos · Contraentrega · Cuidados. Los textos
    salen de lo que el sitio ya publica en preguntas-frecuentes.html; no se
    inventa ni se amplía una promesa aquí. La ficha técnica (#pp-specs) y la
    descripción por familia (#pp-desc) las escribe tienda.js desde el mismo
    specsDe()/FAMILIAS que la ficha emergente."""
    contra = cop(cat['reglas']['envio']['contraentrega'])
    # Texto del propietario (2026-09-26): el anterior «sí se oxida» asustaba.
    # En los brazaletes cambia solo el primer párrafo: son baño de plata con
    # e-coating, no Plata 925, y decir lo contrario ya costó una corrección.
    if tipo == 'brazalete':
        cuidado = ('El baño de plata de tu brazalete lleva una capa protectora e-coating que lo cuida de la '
                   'oxidación. Con el tiempo puede perder algo de brillo por la humedad, los perfumes o las cremas, '
                   'y se lo devuelves frotándolo con un paño suave.')
    else:
        cuidado = ('La Plata Ley 925 es un metal precioso genuino que experimenta un proceso natural de '
                   'oscurecimiento u opacidad con el tiempo debido al contacto con el aire y la piel. Esto es una '
                   'característica propia de la plata auténtica (no un defecto) y se soluciona fácilmente frotando '
                   'tu joya con un paño de limpieza suave para devolverle su brillo original.')
    consejos = ('<p>Para conservar tu joya como el primer día:</p><ul class="pp-lista">'
                '<li><b>Úsala con cuidado:</b> póntela después de aplicar perfumes, cremas, lociones o maquillaje.</li>'
                '<li><b>Evita la humedad:</b> quítatela antes de bañarte, nadar en la piscina o el mar, o hacer ejercicio.</li>'
                '<li><b>Guardado ideal:</b> guárdala en su caja, en un lugar seco, cuando no la uses.</li>'
                '<li><b>Limpieza:</b> límpiala frotándola suavemente con un paño seco para joyería.</li></ul>')
    secciones = [
        ('Descripción', '<p>%s.</p>%s<p id="pp-desc"></p>' % (
            H.escape('Brazalete %s' % meta.lower()) if tipo == 'brazalete' else 'Colección %s' % H.escape(grupo),
            '<p class="pp-nota">%s</p>' % NOTAS_PIEZA[pid] if pid in NOTAS_PIEZA else ''), True),
        ('Materiales', '<dl class="fx-specs" id="pp-specs"></dl>', False),
        ('Envíos gratis', '<p>Envío <b>gratis</b> a toda Colombia pagando en línea. Enviamos por Inter Rapidísimo, y los '
                          'tiempos se cuentan en días hábiles desde que despachamos: Bogotá 1 día; municipios cercanos '
                          'a Bogotá 1 – 2; ciudades principales 2 – 4; resto del país 3 – 6. Te mandamos el número de '
                          'guía por WhatsApp o correo.</p>', False),
        ('Contraentrega', '<p>También puedes pagar al recibir, en efectivo al mensajero. El envío contraentrega cuesta '
                          '%s: lo cobra la transportadora al recaudar.</p>' % contra, False),
        ('Consejos y cuidados', '<p>%s</p>%s' % (cuidado, consejos), False),
    ]
    return '\n'.join('      <details class="pp-acc"%s><summary>%s</summary><div class="pp-acc-in">%s</div></details>'
                     % (' open' if abierto else '', t, c) for t, c, abierto in secciones)




def bloques_media(pid, tipo, hay, cat, arma_href=None):
    """Los cuatro bloques con foto o video, entre la guía de tallas y las
    relacionadas (ENCARGO-FICHA-2 § 1). Textos del propietario, iguales en
    todas las fichas salvo lo marcado para brazaletes —que son baño de plata,
    nunca «plata»—. Níquel y empaque, confirmados por el propietario el
    2026-09-26.

    Los videos no están en git: se sirven desde Netlify Blobs en /media/
    (netlify/functions/media.mjs). Solo viaja la portada (preload="none"); el
    mismo observer de los videos de clientas los arranca al verse."""
    r = cat['reglas']
    es_b = tipo == 'brazalete'

    if es_b:
        t1 = ('Tus charms llevan el sello <b>S925</b>. El brazalete, en <b>baño de plata</b>, es la base que '
              'cambia contigo: <b>ábrelo, suma y combina</b> cuando quieras.')
        t2 = ('Brazalete en baño de plata <b>hipoalergénico y libre de níquel</b>, liviano y cómodo para '
              '<b>usarlo a diario</b>. Guárdalo seco y lejos de perfumes para que el <b>baño conserve su '
              'brillo</b> por más tiempo.')
    else:
        t1 = ('Cada charm lleva grabado el sello <b>S925</b>: la marca de la <b>Plata Esterlina 925</b>. '
              '<b>Búscalo con tus propios ojos</b> apenas la recibas; está ahí para que no tengas que creernos.')
        t2 = ('Plata 925 <b>hipoalergénica y libre de níquel</b>, hecha para <b>usarse a diario</b>, incluso '
              'en piel sensible. Si con el tiempo se oscurece, es natural en la plata real: <b>un paño le '
              'devuelve el brillo</b> en segundos.')
    t3 = ('Combina héroes, iniciales y símbolos en <b>un solo brazalete</b>. Mezcla charms y brazaletes: '
          '<b>con %d piezas, la de menor valor te sale gratis</b>, y con %d te salen 2.'
          % (r['promo']['tramos'][0][0], r['promo']['tramos'][-1][0]))
    t4 = ('Tu pedido llega en <b>su caja</b>, con <b>paño para limpiar la plata</b> y una <b>dedicatoria '
          'escrita a mano</b> con las palabras que tú elijas. Solo falta entregarla… o quedártela.')

    # Fuera de una ficha (kits.html, Más vendidos) no hay pieza propia: el
    # botón de armar lleva a donde se arma en esa página y no hay «Agregar».
    arma = '<a class="btn btn--ghost" href="%s">Arma tu pulsera</a>' % (
        arma_href or ('#pp-compra' if hay else 'index.html#brazaletes'))
    if not pid or not hay:
        agregar = ''
    elif es_b:
        agregar = '<button class="btn" type="button" data-comprar="%s">Elige tu talla</button>' % pid
    else:
        agregar = '<button class="btn" type="button" data-add="%s">Agregar al carrito</button>' % pid

    def video(nombre, alto):
        return ('<video class="bv-v" muted loop playsinline preload="none" controlslist="nodownload noplaybackrate noremoteplayback" disablepictureinpicture disableremoteplayback width="720" height="%d" '
                'poster="assets/%s.webp" aria-hidden="true"><source src="media/%s.mp4" type="video/mp4"></video>'
                % (alto, nombre, nombre))

    bloques = [
        ('✦', 'Plata 925 que puedes comprobar',
         '<img src="assets/bloque-s925.webp" alt="Sello S925 grabado en un charm de Zephora" width="720" '
         'height="720" loading="lazy" decoding="async">', t1, ''),
        ('♡', 'Para llevarla todos los días', video('bloque-diario-v1', 960), t2, ''),
        ('✧', 'Tu historia, un charm a la vez', video('bloque-historia-v1', 714), t3, arma),
        ('✦', 'Llega lista para regalar', video('bloque-regalo-v1', 960), t4, agregar),
    ]
    return ('<section class="sec bv" aria-label="Por qué Zephora">\n  <div class="wrap bv-in">\n' + '\n'.join(
        '    <article class="bv-b">\n      <div class="bv-m">%s</div>\n      <div class="bv-t"><h2><span '
        'aria-hidden="true">%s</span> %s</h2><p>%s</p>%s</div>\n    </article>'
        % (m, s, H.escape(t), p, ('<div class="bv-cta">%s</div>' % b) if b else '')
        for s, t, m, p, b in bloques) + '\n  </div>\n</section>')


# El formulario para reseñar la pieza de la ficha. Va dentro de «Lo que dicen
# nuestras clientas» (el bloque `resenas` de index.html), debajo del carrusel:
# desde el 2026-10-02 es la única sección de reseñas de la ficha.
FORM_RESENA = '''    <details class="rp-escribir" id="rp-escribir">
      <summary>Escribir una reseña de {nombre}</summary>
      <form class="rp-form" id="rp-form" novalidate>
        <fieldset class="rp-est"><legend>Tu calificación</legend>
          <label><input type="radio" name="estrellas" value="5">5</label><label><input type="radio" name="estrellas" value="4">4</label><label><input type="radio" name="estrellas" value="3">3</label><label><input type="radio" name="estrellas" value="2">2</label><label><input type="radio" name="estrellas" value="1">1</label>
        </fieldset>
        <label>Tu reseña<textarea name="texto" rows="4" maxlength="800" required></textarea></label>
        <div class="rp-dos"><label>Nombre<input name="nombre" maxlength="40" required autocomplete="given-name"></label>
        <label>Ciudad<input name="ciudad" maxlength="40" autocomplete="address-level2"></label></div>
        <div class="rp-dos"><label>Fotos (opcional, hasta 3)<input type="file" name="fotos" accept="image/*" multiple></label>
        <label>Video (opcional, hasta 20 s)<input type="file" name="video" accept="video/*"></label></div>
        <input type="text" name="web" class="susc-trampa" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="btn" type="submit">Enviar reseña</button>
        <p class="rp-nota">Revisamos cada reseña antes de publicarla. Publicamos también las de pocas estrellas.</p>
        <p class="rp-msg" aria-live="polite"></p>
      </form>
    </details>
'''


def resenas_con_formulario(bloque, nombre):
    """El carrusel de reseñas de index.html con el formulario debajo, antes
    del pie de Instagram."""
    ancla = '    <p class="social-n">'
    if bloque.count(ancla) != 1:
        raise SystemExit('No encontré el pie de la sección de reseñas en index.html (%s).' % ancla.strip())
    return bloque.replace(ancla, FORM_RESENA.format(nombre=nombre) + ancla)


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
    # Para compartir (WhatsApp, Facebook) va la de 1200 px de assets/hd/ si existe.
    hd = re.sub(r'^assets/', 'assets/hd/', foto)
    imagen = SITIO + (hd if os.path.exists(os.path.join(RAIZ, hd.split('?')[0])) else foto)
    canon = SITIO + href_de(pid)
    hay = (unidades(stock.get(pid)) or 0) > 0

    rel = relacionadas(pid, tipo, grupo, cat, stock)
    rel_sub = ''
    if tipo == 'brazalete':
        rel_eyebrow, rel_titulo, id_rel = 'Brazaletes', 'Más brazaletes', ' id="brazaletes"'
        bloque_b = ''
    else:
        rel_sub = '<p class="col-sub">Juntos rinden más: con 4 piezas la de menor valor te sale gratis.</p>'
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
        bloque_compra=bloque_compra(pid, tipo, nombre, hay,
                                    list(dict.fromkeys(
                                        c for c in (rel + cat['destacados'] + list(cat['precios']))
                                        if c != pid and c in cat['precios'] and c not in cat['pulseras']
                                        and not c.startswith('letra-') and (unidades(stock.get(c)) or 0) > 0))[:16],
                                    precio),
        beneficios=beneficios(tipo, cat), acordeones=acordeones(tipo, meta, grupo, cat, pid),
        bloque_letras=tira_letras(pid, cat) if tipo == 'inicial' else '', rel_eyebrow=H.escape(rel_eyebrow),
        rel_titulo=H.escape(rel_titulo),
        tarjetas_rel='\n'.join('      ' + t for t in tarjetas(html, rel)),
        resenas=resenas_con_formulario(b['resenas'], H.escape(nombre)), historia=b['historia'],
        bloque_brazaletes=bloque_b, talla=b['talla'], confianza=b['confianza'], addi_script=ADDI_SCRIPT,
        bloques_media=bloques_media(pid, tipo, hay, cat),
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
