#!/usr/bin/env python3
"""Saca de index.html la tabla de precios y las reglas de cobro.

El servidor que firma los pagos no puede confiar en el total que le manda el
navegador: quien sepa abrir la consola lo cambia. Tiene que recalcularlo, y para
eso necesita los mismos precios y las mismas reglas que la página.

Duplicarlos a mano es pedir que se desincronicen —se sube un precio en el HTML,
se olvida en el servidor, y Wompi empieza a cobrar de menos—. Así que se
extraen de la única fuente que existe, `index.html`, y `pruebas/precios.js`
comprueba que lo extraído siga coincidiendo con lo que hace el navegador.

    python3 herramientas/extraer_catalogo.py

Escribe `netlify/functions/catalogo.json`. Hay que correrlo cada vez que cambie
un precio, una escala de descuento o una tarifa de envío.
"""
import json
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
FUENTE = RAIZ / 'index.html'
DESTINO = RAIZ / 'netlify' / 'functions' / 'catalogo.json'


def saca(patron, texto, que):
    """Un único grupo, o un error que dice qué se rompió."""
    m = re.search(patron, texto)
    if not m:
        sys.exit(
            f'No se encontró {que} en index.html.\n'
            f'  Buscaba: {patron}\n'
            '  Si se renombró o se reescribió esa línea, hay que ajustar este '
            'extractor: el servidor cobraría con datos viejos.'
        )
    return m.group(1)


def main():
    html = FUENTE.read_text(encoding='utf-8')

    data = json.loads(saca(r'const DATA=(\{.*?\});\n', html, 'la tabla DATA'))

    # ESC=[0,0,.08,.15,.20] — descuento por cantidad de charms. JSON no admite
    # el «.08» sin cero delante que sí acepta JavaScript.
    esc_txt = saca(r'const ESC=\[([^\]]+)\];', html, 'la escala de descuento ESC')
    esc = [float(x.strip()) for x in esc_txt.split(',')]

    libre = int(saca(r'LIBRE\s*=\s*(\d+)', html, 'el umbral de envío gratis LIBRE'))
    envio_txt = saca(r'const ENVIO=\{([^}]+)\}', html, 'las tarifas de envío ENVIO')
    envio = {
        k.strip(): int(v)
        for k, v in (par.split(':') for par in envio_txt.split(','))
    }

    # El empaque de regalo aparece en el cálculo como número suelto.
    pack = int(saca(r"getElementById\('pack'\)\.checked\?(\d+):0", html,
                    'el precio del empaque de regalo'))

    # El 30% del brazalete y el mínimo de charms que lo activa.
    desc_b = saca(r'const descB=\(base&&nC>=(\d+)\)\?brutoB\*\.(\d+):0', html,
                  'el descuento del brazalete')
    min_charms = int(desc_b)
    pct_b = float('.' + re.search(r'brutoB\*\.(\d+)', html).group(1))

    catalogo = {
        '_': ('Generado por herramientas/extraer_catalogo.py desde index.html. '
              'No editar a mano: el próximo extractor lo pisa.'),
        'precios': {
            **{c['id']: c['p'] for c in data['charms']},
            **{p['id']: p['p'] for p in data['pulseras']},
        },
        'nombres': {
            **{c['id']: c['n'] for c in data['charms']},
            **{p['id']: p['n'] for p in data['pulseras']},
        },
        'pulseras': [p['id'] for p in data['pulseras']],
        'reglas': {
            'escalaCharms': esc,
            'descuentoBrazalete': pct_b,
            'minCharmsParaDescuento': min_charms,
            'empaque': pack,
            'envioGratisDesde': libre,
            'envio': envio,
        },
    }

    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(
        json.dumps(catalogo, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    n = len(catalogo['precios'])
    print(f'{DESTINO.relative_to(RAIZ)}: {n} piezas con precio')
    print(f'  escala de charms {esc} · brazalete −{pct_b:.0%} desde {min_charms} charms')
    tarifas = ' · '.join(f'{k} ${v:,}'.replace(',', '.') for k, v in envio.items())
    print(f'  empaque ${pack:,}'.replace(',', '.') + f' · envío {tarifas}'
          + f' · gratis desde ${libre:,}'.replace(',', '.'))


if __name__ == '__main__':
    main()
