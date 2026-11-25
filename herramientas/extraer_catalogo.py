#!/usr/bin/env python3
"""Saca de la tienda la tabla de precios y las reglas de cobro.

El servidor que firma los pagos no puede confiar en el total que le manda el
navegador: quien sepa abrir la consola lo cambia. Tiene que recalcularlo, y para
eso necesita los mismos precios y las mismas reglas que la página.

Duplicarlos a mano es pedir que se desincronicen —se sube un precio en el HTML,
se olvida en el servidor, y Wompi empieza a cobrar de menos—. Así que se
extraen de la única fuente que existe, y `pruebas/precios.js` comprueba que lo
extraído siga coincidiendo con lo que hace el navegador.

Esa fuente son **dos archivos desde que el motor salió del HTML** (ver
ESTADO.md § extracción a tienda.css/tienda.js):

  · `tienda.js`  — la tabla DATA y las reglas de cobro (ESC, LIBRE, ENVIO, el
                   descuento por brazalete). Es lo que ejecuta el navegador.
  · `index.html` — las tarjetas del catálogo, de donde salen los grupos, las
                   fotos y los destacados. La rejilla sigue escrita a mano ahí.

Antes las dos cosas vivían en index.html. Cuando el motor se extrajo, este
script dejó de encontrar DATA y **se paró con un error en vez de escribir un
catálogo a medias** — que es exactamente lo que tenía que hacer: un
catalogo.json incompleto es el servidor cobrando con datos viejos.

    python3 herramientas/extraer_catalogo.py

Escribe `assets/catalogo.json`, un solo archivo con dos lectores: checkout.html
lo pide por fetch para mostrar el resumen, y las funciones de Netlify lo cargan
por require para calcular lo que se cobra. Un único archivo a propósito —dos
copias del mismo catálogo son dos copias que se desincronizan—.

Hay que correrlo cada vez que cambie un precio, una escala de descuento o una
tarifa de envío.
"""
import json
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
TARJETAS = RAIZ / 'index.html'
MOTOR = RAIZ / 'tienda.js'
DESTINO = RAIZ / 'assets' / 'catalogo.json'


def saca(patron, texto, que, archivo):
    """Un único grupo, o un error que dice qué se rompió y dónde."""
    m = re.search(patron, texto)
    if not m:
        sys.exit(
            f'No se encontró {que} en {archivo}.\n'
            f'  Buscaba: {patron}\n'
            '  Si se renombró o se reescribió esa línea, hay que ajustar este '
            'extractor: el servidor cobraría con datos viejos.'
        )
    return m.group(1)


def main():
    html = TARJETAS.read_text(encoding='utf-8')
    motor = MOTOR.read_text(encoding='utf-8')

    data = json.loads(saca(r'const DATA=(\{.*?\});\n', motor, 'la tabla DATA', 'tienda.js'))

    # PROMO={tramos:[[4,1],[6,2]]} — «Paga 3, lleva 1 gratis · paga 4, lleva 2
    # gratis» desde el 2026-10-04: con 4 piezas (brazalete o charm) sale gratis
    # la más barata, con 6 las dos más baratas, y de ahí no pasa. Antes fueron
    # «lleva 4, paga 3» cíclica y la escalera ESC con el 30% del brazalete.
    promo_txt = saca(r'const PROMO=(\{.*?\});', motor, 'la promoción PROMO', 'tienda.js')
    promo = json.loads(re.sub(r'(\w+):', r'"\1":', promo_txt))
    t = promo.get('tramos') if isinstance(promo, dict) else None
    if (set(promo) != {'tramos'} or not t or any(len(x) != 2 for x in t)
            or [x[0] for x in t] != sorted({x[0] for x in t}) or [x[1] for x in t] != sorted({x[1] for x in t})
            or any(not 0 < x[1] < x[0] for x in t)):
        sys.exit('PROMO en tienda.js no tiene la forma {tramos:[[piezas,gratis],…]} creciente: %r' % promo)

    # OFERTA={nombre,hasta,charms,brazaletes} o null (Black Friday, 2026-11-20).
    # DATA trae el precio de LISTA; con oferta, `precios` lleva lista − % y
    # `lista` el de lista, y es _precios.js quien decide por la fecha cuál de
    # los dos cobra. Sin oferta los dos son iguales y `reglas.oferta` no existe.
    oferta_txt = saca(r'const OFERTA=(\{.*?\}|null);', motor, 'la oferta OFERTA', 'tienda.js')
    oferta = json.loads(re.sub(r'([{,])(\w+):', r'\1"\2":', oferta_txt))
    if oferta is not None:
        if (set(oferta) != {'nombre', 'hasta', 'charms', 'brazaletes'}
                or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', str(oferta['hasta']))
                or any(not (isinstance(oferta[k], int) and 0 <= oferta[k] < 100) for k in ('charms', 'brazaletes'))):
            sys.exit('OFERTA en tienda.js no tiene la forma {nombre,hasta:"AAAA-MM-DD",charms:%%,brazaletes:%%}: %r' % oferta)

    def con_oferta(p, pct):
        # El mismo redondeo que tienda.js: Math.round(lista*(100-pct)/100).
        # Se exige que dé entero exacto: un precio con decimales se redondea
        # distinto en Python y en JavaScript, y eso es cobrar otro número.
        if p * (100 - pct) % 100:
            sys.exit('El %d %% sobre %d no da un precio entero.' % (pct, p))
        return p * (100 - pct) // 100
    pct_c = oferta['charms'] if oferta else 0
    pct_b = oferta['brazaletes'] if oferta else 0

    envio_txt = saca(r'const ENVIO=\{([^}]+)\}', motor, 'las tarifas de envío ENVIO', 'tienda.js')
    envio = {
        k.strip(): int(v)
        for k, v in (par.split(':') for par in envio_txt.split(','))
    }
    gratis_desde = int(saca(r'const ENVIO_GRATIS_DESDE=(\d+);', motor,
                            'la regla ENVIO_GRATIS_DESDE', 'tienda.js'))
    esp = re.search(r'const ENVIO_ESPECIAL=\{precio:(\d+), departamentos:(\[[^\]]*\])\};', motor)
    if not esp:
        sys.exit('No encontré ENVIO_ESPECIAL en tienda.js')
    especial = {'precio': int(esp.group(1)), 'departamentos': json.loads(esp.group(2))}


    # data-g en cada tarjeta lleva la categoría; .pc--top marca los destacados.
    grupos = {
        m.group(1): m.group(2)
        for m in re.finditer(r'<article class="pc[^"]*" data-id="([^"]+)" data-g="([^"]+)"', html)
    }
    destacados = re.findall(r'<article class="pc pc--top[^"]*" data-id="([^"]+)"', html)

    # La foto de cada pieza. El nombre del archivo NO se puede deducir del id:
    # `lilo-stitch` se ilustra con `lilo-y-stitch.webp`, `walle` con
    # `wall-e.webp` y `jack-sally` con `jack-y-sally.webp`. Un `f'{id}.webp'`
    # da 404 en esos tres y nadie se entera hasta que el bot de WhatsApp
    # intenta mandar la foto. Así que se lee del mismo sitio donde la tienda
    # la muestra: el <img> de la tarjeta.
    #
    # Las 27 letras no tienen tarjeta propia —comparten una sola, con un
    # selector de inicial dentro— así que todas heredan la foto del grupo.
    fotos = {}
    for m in re.finditer(
            r'<article class="pc[^"]*" data-id="([^"]+)"[^>]*>\s*'
            r'<div class="pc-img"><img src="assets/([^"?]+)', html):
        pieza, archivo = m.group(1), m.group(2)
        if pieza == 'letras':
            continue
        fotos[pieza] = archivo
    letras = saca(r'<article class="pc pc--letras" data-id="letras"[^>]*>\s*'
                  r'<div class="pc-img"><img src="assets/([^"?]+)', html,
                  'la foto de la tarjeta de letras', 'index.html')

    # En el orden de DATA, no sobre un set: el orden de un set de Python cambia
    # entre ejecuciones, así que regenerar el catálogo sin tocar nada movía las
    # 27 letras de sitio y dejaba un diff de 40 líneas que no cambia ni un dato.
    # El extractor pisa este archivo cada vez que se toca un precio; si su
    # salida no es reproducible, ese ruido tapa el cambio de verdad.
    #
    # Desde el 2026-09-25 cada inicial puede tener su foto propia,
    # `assets/letra-<x>.webp` (las metió entrar_fotos.py). La que no la tenga
    # —hoy Ñ y Q— sigue con la foto del grupo.
    carpeta = pathlib.Path(__file__).resolve().parent.parent / 'assets'
    for c in data['charms']:
        if c['id'].startswith('letra-'):
            propia = c['id'] + '.webp'
            fotos[c['id']] = propia if (carpeta / propia).exists() else letras

    # Los anillos (2026-11-01): una tarjeta por modelo, y cada talla es una
    # pieza propia (`anillo-<modelo>-t<talla>`) que hereda la foto del modelo.
    # La tarjeta del modelo no es una pieza: no tiene precio y sale de fotos.
    for c in data['charms']:
        m = re.match(r'(anillo-.+)-t\d+$', c['id'])
        if m and m.group(1) in fotos:
            fotos[c['id']] = fotos[m.group(1)]
            grupos[c['id']] = 'Anillos'
    for modelo in [k for k in fotos if k.startswith('anillo-') and not re.search(r'-t\d+$', k)]:
        del fotos[modelo]

    catalogo = {
        '_': ('Generado por herramientas/extraer_catalogo.py desde index.html. '
              'No editar a mano: el próximo extractor lo pisa. Lo leen '
              'checkout.html (por fetch) y netlify/functions/_precios.js '
              '(por require).'),
        # Lo que se cobra MIENTRAS la oferta esté vigente (sin oferta, la
        # lista). Quien cobra no lee esto a ciegas: _precios.js mira la fecha.
        'precios': {
            **{c['id']: con_oferta(c['p'], pct_c) for c in data['charms']},
            **{p['id']: con_oferta(p['p'], pct_b) for p in data['pulseras']},
        },
        # El precio de lista: el que se muestra tachado durante la oferta y el
        # que se cobra cuando vence.
        'lista': {
            **{c['id']: c['p'] for c in data['charms']},
            **{p['id']: p['p'] for p in data['pulseras']},
        },
        'nombres': {
            **{c['id']: c['n'] for c in data['charms']},
            **{p['id']: p['n'] for p in data['pulseras']},
        },
        'pulseras': [p['id'] for p in data['pulseras']],
        # La categoría de cada charm —Disney, Marvel, Zodiaco…— y cuáles son
        # destacados. Vivían solo en los atributos de las tarjetas del catálogo,
        # así que el checkout no tenía forma de saber qué se parece a qué. Se
        # extraen igual que los precios: de index.html, que es la única fuente,
        # para que sugerir "algo parecido" no acabe siendo una segunda lista
        # que se desincroniza del catálogo real.
        'grupos': grupos,
        'destacados': destacados,
        # id → nombre de archivo dentro de assets/. Lo lee disponibilidad.mjs
        # para armar la URL que el bot de WhatsApp le manda a la clienta.
        'fotos': fotos,
        'reglas': {
            'promo': promo,
            # Zona nacional: lo que paga 1 pieza según el pago, y desde cuántas
            # piezas el envío es gratis en las dos modalidades.
            'envio': envio,
            'envioGratisDesdePiezas': gratis_desde,
            # Destinos especiales: precio fijo, sin gratis y sin contraentrega.
            'envioEspecial': especial,
            **({'oferta': oferta} if oferta else {}),
        },
    }

    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(
        json.dumps(catalogo, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    sin_foto = sorted(set(catalogo['precios']) - set(fotos))
    if sin_foto:
        sys.exit(
            'Estas piezas se quedaron sin foto: ' + ', '.join(sin_foto) + '\n'
            '  El bot de WhatsApp manda la foto al responder, y una pieza sin '
            'foto lo deja mudo justo cuando la clienta pidió verla.\n'
            '  Revisar que la tarjeta de esa pieza en index.html tenga su '
            '<img src="assets/...">.'
        )

    n = len(catalogo['precios'])
    print(f'{DESTINO.relative_to(RAIZ)}: {n} piezas con precio y foto')
    print('  promo: ' + ' · '.join(f'{p} piezas → {g} gratis' for p, g in promo['tramos']) + ' (las más baratas; tope)')
    tarifas = ' · '.join(f'{k} ${v:,}'.replace(',', '.') for k, v in envio.items())
    print(f'  envío {tarifas} · gratis desde {gratis_desde} piezas'
          + f" · destinos especiales ${especial['precio']:,}".replace(',', '.'))


if __name__ == '__main__':
    main()
