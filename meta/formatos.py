"""Adapta un creativo a los tres formatos que Meta entrega, sin recortar nada.

Sucesor de scratchpad/reformatear.py, que solo sabía ensanchar. Estos creativos
vienen en 4:5 y el problema es el contrario: alargarlos para Historias y Reels.

  python3 meta/formatos.py assets/ads/*.jpg

── Por qué no se recorta nunca ──

Meta encaja la imagen en el espacio de cada ubicación recortando por el lado
que sobra. En estos creativos, por los bordes es justo por donde va lo que
vende: el logo arriba, la promoción abajo. Recortar cuesta la oferta.

Así que se hace al revés: la imagen entra entera y lo que crece es el lienzo.

── La zona segura, que es lo que de verdad se estaba perdiendo ──

En Historias y Reels, Meta dibuja su propia interfaz *encima* del creativo: el
nombre de perfil y «Patrocinado» ocupan el 14% de arriba, y el botón de llamada
a la acción el 20% de abajo. Una imagen que llega al borde no se recorta ahí —
se TAPA, que es peor, porque el anunciante la ve completa en la vista previa y
nunca se entera.

Por eso en 9:16 la imagen no se centra en el lienzo: se centra en el 66% que
queda libre entre esas dos franjas.

── Cómo se rellena lo que sobra ──

Muestreando el borde de la propia imagen:

  - Borde plano (seda, degradado suave, fondo liso): color promedio. El empalme
    es invisible y parece un marco decidido a propósito.
  - Borde con textura: espejo de la orilla y desenfoque fuerte. No inventa
    contenido, prolonga el que ya está.
"""

from PIL import Image, ImageFilter, ImageStat
import os
import sys

DESTINO_POR_DEFECTO = 'assets/ads/formatos'

# 4:5 es el formato de Feed que más alto ocupa en el celular. 9:16 es Historias
# y Reels. 1:1 va de respaldo para todo lo demás.
FORMATOS = {
    '4x5':  (1080, 1350),
    '9x16': (1080, 1920),
    '1x1':  (1080, 1080),
}

# Franjas que la interfaz de Meta pinta encima en Historias/Reels.
SEGURO_ARRIBA = 0.14
SEGURO_ABAJO = 0.20

# Debajo de esta desviación estándar el borde se considera plano y se rellena
# con color liso sin que se note el empalme.
UMBRAL_UNIFORME = 18


def analiza_borde(im, lado):
    """Color promedio y desviación de la línea de píxeles de un borde."""
    w, h = im.size
    caja = {
        'izq':    (2, 0, 3, h),
        'der':    (w - 3, 0, w - 2, h),
        'arriba': (0, 2, w, 3),
        'abajo':  (0, h - 3, w, h - 2),
    }[lado]
    est = ImageStat.Stat(im.crop(caja))
    return tuple(round(c) for c in est.mean[:3]), sum(est.stddev[:3]) / 3


def relleno(im, lado, ancho, alto):
    """Un bloque para tapar el hueco de un lado, sacado de ese mismo borde."""
    color, desv = analiza_borde(im, lado)
    if desv < UMBRAL_UNIFORME:
        return Image.new('RGB', (ancho, alto), color)

    w, h = im.size
    horizontal = lado in ('izq', 'der')
    muestra = min(ancho if horizontal else alto, (w if horizontal else h) // 2)
    cajas = {
        'izq':    (0, 0, muestra, h),
        'der':    (w - muestra, 0, w, h),
        'arriba': (0, 0, w, muestra),
        'abajo':  (0, h - muestra, w, h),
    }
    trozo = im.crop(cajas[lado]).transpose(
        Image.FLIP_LEFT_RIGHT if horizontal else Image.FLIP_TOP_BOTTOM)
    grosor = ancho if horizontal else alto
    return trozo.resize((ancho, alto), Image.LANCZOS).filter(
        ImageFilter.GaussianBlur(radius=max(12, grosor // 6)))


def componer(original, tw, th, respetar_zona_segura):
    """Mete la imagen completa en un lienzo tw x th y rellena lo que sobre."""
    if respetar_zona_segura:
        # La imagen no se centra en el lienzo: se centra en lo que la interfaz
        # de Meta deja libre.
        techo = round(th * SEGURO_ARRIBA)
        suelo = round(th * (1 - SEGURO_ABAJO))
    else:
        techo, suelo = 0, th

    disponible_alto = suelo - techo
    escala = min(tw / original.width, disponible_alto / original.height)
    escalada = original.resize(
        (max(1, round(original.width * escala)),
         max(1, round(original.height * escala))), Image.LANCZOS)

    w, h = escalada.size
    x = (tw - w) // 2
    y = techo + (disponible_alto - h) // 2

    lienzo = Image.new('RGB', (tw, th))
    lienzo.paste(escalada, (x, y))

    if x > 0:
        lienzo.paste(relleno(escalada, 'izq', x, h), (0, y))
        lienzo.paste(relleno(escalada, 'der', tw - w - x, h), (x + w, y))
    if y > 0:
        lienzo.paste(relleno(escalada, 'arriba', tw, y), (0, 0))
    if y + h < th:
        lienzo.paste(relleno(escalada, 'abajo', tw, th - y - h), (0, y + h))

    return lienzo


def procesar(ruta, destino):
    original = Image.open(ruta).convert('RGB')
    base = os.path.splitext(os.path.basename(ruta))[0]
    proporcion = original.width / original.height

    for etiqueta, (tw, th) in FORMATOS.items():
        # La zona segura solo existe donde Meta pinta interfaz encima.
        salida = componer(original, tw, th, respetar_zona_segura=(etiqueta == '9x16'))
        archivo = os.path.join(destino, f'{base}__{etiqueta}.jpg')
        salida.save(archivo, 'JPEG', quality=92, optimize=True)
        print(f'  {etiqueta:<5} {tw}x{th}  →  {archivo}')

    print(f'{base}: origen {original.width}x{original.height} '
          f'(proporción {proporcion:.2f})')


if __name__ == '__main__':
    archivos = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not archivos:
        print(__doc__)
        sys.exit(1)

    destino = DESTINO_POR_DEFECTO
    for a in sys.argv[1:]:
        if a.startswith('--destino='):
            destino = a.split('=', 1)[1]

    os.makedirs(destino, exist_ok=True)
    for ruta in archivos:
        procesar(ruta, destino)
