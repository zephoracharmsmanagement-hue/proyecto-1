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

    # ESC=[0,0,.08,.15,.20] — descuento por cantidad de charms. JSON no admite
    # el «.08» sin cero delante que sí acepta JavaScript.
    esc_txt = saca(r'const ESC=\[([^\]]+)\];', motor, 'la escala de descuento ESC', 'tienda.js')
    esc = [float(x.strip()) for x in esc_txt.split(',')]

    libre = int(saca(r'LIBRE\s*=\s*(\d+)', motor, 'el umbral de envío gratis LIBRE', 'tienda.js'))
    solo_ant = saca(r'const LIBRE_SOLO_ANTICIPADO=(true|false);', motor,
                    'la regla LIBRE_SOLO_ANTICIPADO', 'tienda.js') == 'true'
    envio_txt = saca(r'const ENVIO=\{([^}]+)\}', motor, 'las tarifas de envío ENVIO', 'tienda.js')
    envio = {
        k.strip(): int(v)
        for k, v in (par.split(':') for par in envio_txt.split(','))
    }

    # El 30% del brazalete y el mínimo de charms que lo activa.
    desc_b = saca(r'const descB=\(base&&nC>=(\d+)\)\?brutoB\*\.(\d+):0', motor,
                  'el descuento del brazalete', 'tienda.js')
    min_charms = int(desc_b)
    pct_b = float('.' + re.search(r'brutoB\*\.(\d+)', motor).group(1))

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

    catalogo = {
        '_': ('Generado por herramientas/extraer_catalogo.py desde index.html. '
              'No editar a mano: el próximo extractor lo pisa. Lo leen '
              'checkout.html (por fetch) y netlify/functions/_precios.js '
              '(por require).'),
        'precios': {
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
            'escalaCharms': esc,
            'descuentoBrazalete': pct_b,
            'minCharmsParaDescuento': min_charms,
            'envioGratisDesde': libre,
            'envioGratisSoloAnticipado': solo_ant,
            'envio': envio,
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
    print(f'  escala de charms {esc} · brazalete −{pct_b:.0%} desde {min_charms} charms')
    tarifas = ' · '.join(f'{k} ${v:,}'.replace(',', '.') for k, v in envio.items())
    print(f'  envío {tarifas}'
          + f' · gratis desde ${libre:,}'.replace(',', '.'))


if __name__ == '__main__':
    main()
