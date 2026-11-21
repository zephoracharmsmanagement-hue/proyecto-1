#!/usr/bin/env python3
"""Escribe el precio de cada tarjeta de index.html desde assets/catalogo.json.

Las tarjetas de la portada están escritas a mano y los generadores las copian
(gen_colecciones.py, gen_productos.py). Con una oferta de temporada el precio
de una tarjeta ya no es un número: es la lista tachada, lo que se cobra y el
porcentaje. Escribir eso a mano en 130 tarjetas es pedir que una se quede con
el precio viejo, así que lo pone esto:

    python3 herramientas/extraer_catalogo.py     # tienda.js → catalogo.json
    python3 herramientas/precios_tarjetas.py     # catalogo.json → index.html
    python3 herramientas/gen_colecciones.py --escribir
    python3 herramientas/gen_productos.py --escribir

Es idempotente. El marcado es el mismo que arma `precioHTML()` en tienda.js,
que vuelve a pintar las tarjetas al cargar: así, el día que vence la oferta, la
página muestra el precio de lista aunque nadie haya regenerado nada.

Solo tachado y porcentaje: ni «antes» ni «precio anterior» (2026-11-20).
"""
import json
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
INDEX = RAIZ / 'index.html'
CATALOGO = RAIZ / 'assets' / 'catalogo.json'


def cop(n):
    return '$' + format(int(round(n)), ',').replace(',', '.')


def precio_html(cat, pid):
    """El precio de `pid` como se muestra: con oferta, lista tachada + precio +
    porcentaje; sin ella, el número solo. Igual que precioHTML() de tienda.js."""
    hoy = cat['precios'][pid]
    lista = cat.get('lista', cat['precios'])[pid]
    oferta = cat['reglas'].get('oferta')
    if not oferta or lista == hoy:
        return cop(hoy)
    pct = oferta['brazaletes'] if pid in cat['pulseras'] else oferta['charms']
    return ('<s class="pr-lista">%s</s> <b class="pr-hoy">%s</b> <em class="pr-off">−%d&nbsp;%%</em>'
            % (cop(lista), cop(hoy), pct))


def pieza_de(cat, data_id):
    """La pieza cuyo precio muestra una tarjeta: ella misma, o la primera talla
    si es la tarjeta de un modelo de anillo."""
    if data_id in cat['precios']:
        return data_id
    tallas = [k for k in cat['precios'] if re.match(re.escape(data_id) + r'-t\d+$', k)]
    return tallas[0] if tallas else None


def main():
    cat = json.loads(CATALOGO.read_text(encoding='utf-8'))
    html = INDEX.read_bytes().decode('utf-8')
    n = 0

    def una(m):
        nonlocal n
        tarjeta, data_id = m.group(0), m.group(1)
        if data_id == 'letras':
            letras = [k for k in cat['precios'] if k.startswith('letra-')]
            nueva, k = re.subn(r'(<p class="pc-meta">)\d+ iniciales · .*? cada una(</p>)',
                               lambda x: '%s%d iniciales · %s cada una%s' % (
                                   x.group(1), len(letras), precio_html(cat, letras[0]), x.group(2)),
                               tarjeta, count=1)
            if not k:
                sys.exit('La tarjeta «letras» no tiene la línea «N iniciales · … cada una».')
            n += 1
            return nueva
        pid = pieza_de(cat, data_id)
        if pid is None:
            return tarjeta
        nueva, k = re.subn(r'<span class="pc-price">.*?</span>',
                           lambda _: '<span class="pc-price">%s</span>' % precio_html(cat, pid),
                           tarjeta, count=1)
        n += k
        return nueva

    nuevo = re.sub(r'<article class="pc[^"]*" data-id="([^"]+)"[\s\S]*?</article>', una, html)

    # El rótulo de cada nivel de brazaletes («Nivel $79.200») es el precio de
    # sus tarjetas: se toma de la primera.
    def nivel(m):
        nonlocal n
        primera = re.search(r'<article class="pc[^"]*" data-id="([^"]+)"', m.group(3))
        if not primera or primera.group(1) not in cat['precios']:
            sys.exit('Un nivel de brazaletes no tiene una primera tarjeta con precio.')
        n += 1
        return m.group(1) + precio_html(cat, primera.group(1)) + m.group(2) + m.group(3)
    nuevo = re.sub(r'(<span class="tier-price">).*?(</span><span class="tier-count">)([\s\S]*?<article [^>]*>)',
                   nivel, nuevo)
    if nuevo != html:
        INDEX.write_bytes(nuevo.encode('utf-8'))
    print('index.html: %d tarjetas con su precio de catalogo.json%s' % (n, '' if nuevo != html else ' (sin cambios)'))


if __name__ == '__main__':
    main()
