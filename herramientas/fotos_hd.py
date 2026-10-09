"""Fotos de producto nítidas y con el mismo encuadre (2026-10-09).

    python herramientas/fotos_hd.py

Deja, para cada foto de catalogo.json:
  assets/hd/<foto>.webp   1200 px — galería de la ficha y de la página (tienda.js, hdDe)
  assets/<foto>.webp       600 px — rejilla, carrito, vitrina (lo que baja cada tarjeta)

Todas cuadradas, fondo blanco, centradas y con el lado largo de la joya en el
90 % del cuadro (pedido del propietario: «las joyas más grandes en el cuadro,
90 %»). Antes eran de 440 px, con la joya a tamaños distintos y dos corridas.
Reemplaza a la versión de 880 px que solo cubría las 41 fotos de Flow.

De dónde sale cada una, en este orden:
  1. material-sin-publicar/fotos-mejoradas-blanco/<foto>.jpg (Flow, 1024 px):
     detalle real, se recorta y centra aquí mismo, sin IA.
  2. material-sin-publicar/fotos-mejoradas/<foto>.jpg (Flow con fondo gris):
     se lleva el gris a blanco subiendo el punto blanco.
  3. material-sin-publicar/fotos-hd/salida/<foto>.webp: la de 440 centrada y
     ampliada ×2 con Recraft Crisp Upscale de Kie (herramientas/fotos_kie.py),
     que no redibuja la joya. Revisadas una por una el 2026-10-09, sellos S925
     con zoom incluidos.
Si no hay ninguna, la foto se deja como está y se avisa.
"""
import json, pathlib, sys
from PIL import Image, ImageDraw, ImageFilter

RAIZ = pathlib.Path(__file__).resolve().parent.parent
REPO = RAIZ if (RAIZ / 'material-sin-publicar').exists() else pathlib.Path(r'C:\Users\Martin\projects\proyecto-1')
MSP = REPO / 'material-sin-publicar'
BLANCO, GRIS, KIE = MSP / 'fotos-mejoradas-blanco', MSP / 'fotos-mejoradas', MSP / 'fotos-hd' / 'salida'
ASSETS, HD = RAIZ / 'assets', RAIZ / 'assets' / 'hd'
OCUPA = 0.90
LADO_HD, LADO_REJILLA = 1200, 600


def fondo_blanco(im, tol=28):
    """Blanco puro solo en el fondo que toca el borde (relleno desde los bordes):
    los brillos plateados dentro de la joya no se tocan."""
    im = im.convert('RGB')
    marca = (255, 0, 255)
    t = im.copy(); w, h = t.size
    for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        if t.getpixel(xy) != marca:
            ImageDraw.floodfill(t, xy, marca, thresh=tol)
    m = Image.new('L', (w, h), 0)
    mp, tp = m.load(), t.load()
    for y in range(h):
        for x in range(w):
            if tp[x, y] == marca:
                mp[x, y] = 255
    m = m.filter(ImageFilter.GaussianBlur(0.8))
    return Image.composite(Image.new('RGB', (w, h), (255, 255, 255)), im, m), m


def centrar(im, lado):
    """Recorta la joya y la centra con el lado largo al OCUPA del cuadro."""
    limpio, mfondo = fondo_blanco(im)
    caja = Image.eval(mfondo, lambda v: 255 - v).point(lambda v: 255 if v > 128 else 0).getbbox()
    if not caja:
        raise ValueError('no se encontró la joya')
    x0, y0, x1, y1 = caja
    pieza = limpio.crop(caja)
    c = int(max(x1 - x0, y1 - y0) / OCUPA)
    lienzo = Image.new('RGB', (c, c), (255, 255, 255))
    lienzo.paste(pieza, ((c - (x1 - x0)) // 2, (c - (y1 - y0)) // 2))
    return lienzo.resize((lado, lado), Image.LANCZOS)


def a_blanco(im):
    """Fondo gris de Flow → blanco subiendo el punto blanco (sin tocar el tono)."""
    W, H = im.size; k = max(4, min(W, H) // 20)
    esq = [im.crop(c).resize((1, 1), Image.BOX).getpixel((0, 0)) for c in
           ((0, 0, k, k), (W - k, 0, W, k), (0, H - k, k, H), (W - k, H - k, W, H))]
    f = [sum(e[i] for e in esq) / 4 for i in range(3)]
    return Image.merge('RGB', [c.point(lambda v, g=f[i]: min(255, round(v * 255 / g))) for i, c in enumerate(im.split())])


def guardar(im, destino, limite_kb):
    for q in (86, 82, 78, 74, 70):
        im.save(destino, 'webp', quality=q, method=6)
        if destino.stat().st_size <= limite_kb * 1024:
            break
    return q


def main():
    cat = json.load(open(ASSETS / 'catalogo.json', encoding='utf-8'))
    HD.mkdir(exist_ok=True)
    fotos = sorted(set(cat['fotos'].values()))
    origen = {'flow': 0, 'flow-gris': 0, 'kie': 0}
    faltan = []
    for archivo in fotos:
        stem = pathlib.Path(archivo).stem
        if (BLANCO / f'{stem}.jpg').exists():
            grande = centrar(Image.open(BLANCO / f'{stem}.jpg').convert('RGB'), LADO_HD); origen['flow'] += 1
        elif (GRIS / f'{stem}.jpg').exists():
            grande = centrar(a_blanco(Image.open(GRIS / f'{stem}.jpg').convert('RGB')), LADO_HD); origen['flow-gris'] += 1
        elif (KIE / f'{stem}.webp').exists():
            grande = Image.open(KIE / f'{stem}.webp').convert('RGB'); origen['kie'] += 1
            if grande.size != (LADO_HD, LADO_HD):
                grande = grande.resize((LADO_HD, LADO_HD), Image.LANCZOS)
        else:
            faltan.append(archivo); continue
        q1 = guardar(grande, HD / f'{stem}.webp', 110)
        q2 = guardar(grande.resize((LADO_REJILLA, LADO_REJILLA), Image.LANCZOS), ASSETS / f'{stem}.webp', 38)
        print(f'{stem:40s} hd {(HD / (stem + ".webp")).stat().st_size // 1024:4d} KB q{q1} · '
              f'rejilla {(ASSETS / (stem + ".webp")).stat().st_size // 1024:3d} KB q{q2}')
    viejas = [p.name for p in HD.glob('*.webp') if p.stem not in {pathlib.Path(f).stem for f in fotos}]
    print('\nfuentes:', origen, '· sin fuente:', faltan, '· en assets/hd que ya no son de producto:', viejas)


if __name__ == '__main__':
    sys.exit(main())
