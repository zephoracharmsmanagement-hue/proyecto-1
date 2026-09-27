#!/usr/bin/env python3
"""Publica el catálogo en PDF que el bot de WhatsApp le manda a las clientas.

    python3 herramientas/catalogo_pdf.py RUTA/AL/Catalogo.pdf

Escribe dos archivos:

  assets/catalogo-zephora-charms.pdf    el que se publica y manda el bot
  assets/catalogo-zephora-charms.json   sus precios, pieza por pieza

── Por qué el segundo archivo ──

Un PDF es una copia congelada, y en este proyecto las copias congeladas ya
fallaron varias veces delante de clientas sin dar ningún error: un envío
cobrado de palabra siendo gratis, Addi negado, el material de los brazaletes
dicho al revés dos veces. Este catálogo trae 120 precios; el día que uno cambie
en la tienda, el PDF sigue diciendo el viejo.

Así que al publicarlo se extrae de su propio texto qué pieza lista y a qué
precio, y `pruebas/catalogo-pdf.js` lo contrasta contra `assets/catalogo.json`
—el mismo archivo con el que el servidor cobra— en cada corrida. Si no
cuadran, la prueba se pone en rojo y hay que regenerar el catálogo. Por eso los
dos archivos salen SIEMPRE juntos de este script: reemplazar el PDF a mano deja
el JSON describiendo otro documento.

── Por qué se comprime ──

El original pesa ~15 MB: 98 fotos de producto guardadas en PNG, sin pérdida.
Una clienta lo abre con los datos del celular, desde WhatsApp. Las fotos pasan a
JPEG a la misma resolución; el texto, que es vectorial, no se toca.

── Lo que NO arregla ──

El catálogo lista las piezas que tenían unidades el día que se generó, con las
tallas de ese día. El inventario se mueve solo: una pieza del PDF puede estar
agotada hoy. Eso no lo vigila la prueba —cambia a diario y la pondría en rojo
sin razón—; lo resuelve el bot, que confirma con `disponibilidad` antes de
cerrar cualquier venta.
"""
import io
import json
import pathlib
import re
import sys
import unicodedata
from datetime import date

try:
    import pymupdf
    from PIL import Image
except ImportError:
    sys.exit('Falta pymupdf o Pillow.  pip install pymupdf pillow')

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SALIDA_PDF = RAIZ / 'assets' / 'catalogo-zephora-charms.pdf'
SALIDA_JSON = RAIZ / 'assets' / 'catalogo-zephora-charms.json'
CALIDAD_JPEG = 82


def plano(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', s.replace('–', '-').replace('—', '-')).strip().lower()


def comprimir(origen):
    doc = pymupdf.open(origen)
    vistas = set()
    for pagina in doc:
        for img in pagina.get_images(full=True):
            xref, smask = img[0], img[1]
            if xref in vistas:
                continue
            vistas.add(xref)
            if smask:
                # Con transparencia, JPEG pintaría un recuadro. Se deja como está.
                continue
            crudo = doc.extract_image(xref)['image']
            foto = Image.open(io.BytesIO(crudo)).convert('RGB')
            buf = io.BytesIO()
            foto.save(buf, 'JPEG', quality=CALIDAD_JPEG, optimize=True, progressive=True)
            if buf.tell() < len(crudo):
                pagina.replace_image(xref, stream=buf.getvalue())
    return doc


def texto_corrido(doc):
    """El texto del PDF en una sola línea. Los nombres largos se parten en dos
    renglones —«Esfera Telaraña Spider-» / «Man»—, así que se unen: sin espacio
    si el renglón acaba en guion, con espacio si no."""
    partes = []
    for pagina in doc:
        for linea in pagina.get_text().split('\n'):
            linea = linea.strip()
            if not linea:
                continue
            if partes and partes[-1].endswith('-'):
                partes[-1] += linea
            else:
                partes.append(linea)
    return ' '.join(partes)


def precios_del_pdf(doc, cat):
    """Qué piezas del catálogo aparecen en el PDF y a qué precio. Se busca cada
    nombre de `catalogo.json` seguido de su precio —con las tallas de por medio
    en los brazaletes— en vez de adivinar nombres del PDF: un nombre que no esté
    en el catálogo no se puede contrastar con nada."""
    corrido = plano(texto_corrido(doc))
    encontrados = {}
    for pid, nombre in cat['nombres'].items():
        if pid.startswith('letra-'):
            continue
        patron = (r'(?<![\w-])' + re.escape(plano(nombre)) +
                  r'(?: tallas disponibles:[^$]*?)? \$([\d.]+)')
        m = re.search(patron, corrido)
        if m:
            encontrados[pid] = int(m.group(1).replace('.', ''))

    # Las iniciales van en una rejilla aparte: «A $86.000 B $86.000 …», bajo el
    # título «Letras».
    seccion = re.search(r'letras \d+ disponibles(.*?)zephora charms - \d+', corrido)
    if seccion:
        for letra, precio in re.findall(r'(?<![\w$.])([a-zñ]) \$([\d.]+)', seccion.group(1)):
            pid = 'letra-' + letra
            if pid in cat['nombres']:
                encontrados[pid] = int(precio.replace('.', ''))

    vigentes = re.search(r'precios vigentes desde el (\d+) de (\w+) de (\d{4})', corrido)
    return encontrados, (vigentes.group(0) if vigentes else None)


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__.split('\n\n')[1])
    origen = pathlib.Path(sys.argv[1])
    cat = json.loads((RAIZ / 'assets' / 'catalogo.json').read_text(encoding='utf-8'))

    doc = comprimir(origen)
    precios, vigentes = precios_del_pdf(doc, cat)
    if not precios:
        sys.exit('No se encontró ningún precio en el PDF: ¿es el catálogo?')

    doc.save(SALIDA_PDF, garbage=4, deflate=True, clean=True)
    SALIDA_JSON.write_text(json.dumps({
        '_': ('Generado por herramientas/catalogo_pdf.py junto con '
              'catalogo-zephora-charms.pdf: son los precios que ESE PDF dice, '
              'para que pruebas/catalogo-pdf.js los contraste con catalogo.json. '
              'No editar a mano.'),
        'publicado': date.today().isoformat(),
        'vigentes': vigentes,
        'precios': dict(sorted(precios.items())),
    }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    antes = origen.stat().st_size / 1e6
    despues = SALIDA_PDF.stat().st_size / 1e6
    print(f'{SALIDA_PDF.relative_to(RAIZ)}: {antes:.1f} MB → {despues:.1f} MB')
    print(f'{SALIDA_JSON.relative_to(RAIZ)}: {len(precios)} piezas con precio · {vigentes}')
    distintos = {p: (v, cat['precios'][p]) for p, v in precios.items() if cat['precios'][p] != v}
    if distintos:
        print('OJO — precios del PDF que NO cuadran con catalogo.json:')
        for p, (v, real) in distintos.items():
            print(f'  {cat["nombres"][p]}: el PDF dice ${v:,} y la tienda cobra ${real:,}')
        sys.exit(1)


if __name__ == '__main__':
    main()
