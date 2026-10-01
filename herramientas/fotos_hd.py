"""Versión nítida (880 px) de las fotos mejoradas en Flow, para las galerías.

    python herramientas/fotos_hd.py

La rejilla del catálogo usa assets/<foto>.webp a 440 px y ~14 KB, y así se
queda: es lo que baja cada tarjeta. Pero la galería de la página de la pieza y
la de la ficha enseñan la foto grande, a todo el ancho del celular, y ahí 440
px en una pantalla de doble densidad se ve blanda (lo notó el propietario,
2026-10-01, con la Pulsera Corazón Pavé). Esto deja assets/hd/<foto>.webp a
880 px, con el mismo encuadre que la de 440 (entrar_fotos.a_lienzo), y
tienda.js la usa solo en las galerías (lista FOTOS_HD).

Fuente: material-sin-publicar/fotos-mejoradas-blanco (las de Flow con el fondo
ya llevado a blanco). Lilo & Stitch solo está en fotos-mejoradas, con el fondo
gris: se le sube el punto blanco igual que a las demás. (Quedó fuera en
septiembre por el «PANDORA» de la argolla; el propietario tiene el permiso de
la marca.)
"""
import pathlib, sys
from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / 'herramientas'))
import entrar_fotos as ef

REPO = RAIZ if (RAIZ / 'material-sin-publicar').exists() else pathlib.Path(r'C:\Users\Martin\projects\proyecto-1')
BLANCO = REPO / 'material-sin-publicar' / 'fotos-mejoradas-blanco'
GRIS = REPO / 'material-sin-publicar' / 'fotos-mejoradas'
HD = RAIZ / 'assets' / 'hd'
LADO = 880


def a_blanco(ruta, destino):
    """Sube el punto blanco: el gris del fondo (sacado de las esquinas) pasa a
    255 y el resto se escala igual, sin tocar el tono de la pieza."""
    im = Image.open(ruta).convert('RGB')
    W, H = im.size; k = max(4, min(W, H) // 20)
    esq = [im.crop(c).resize((1, 1), Image.BOX).getpixel((0, 0)) for c in
           ((0, 0, k, k), (W - k, 0, W, k), (0, H - k, k, H), (W - k, H - k, W, H))]
    fondo = [sum(e[i] for e in esq) / 4 for i in range(3)]
    canales = [c.point(lambda v, f=fondo[i]: min(255, round(v * 255 / f))) for i, c in enumerate(im.split())]
    Image.merge('RGB', canales).save(destino, quality=95)
    return destino


def main():
    HD.mkdir(exist_ok=True)
    fuentes = {p.stem: p for p in BLANCO.glob('*.jpg')}
    for p in GRIS.glob('*.jpg'):
        if p.stem not in fuentes:
            fuentes[p.stem] = a_blanco(p, HD / f'_{p.stem}.jpg')
    ef.LADO = LADO
    hechas = []
    for stem, ruta in sorted(fuentes.items()):
        if not (RAIZ / 'assets' / f'{stem}.webp').exists():
            print(f'✗ {stem}: no hay assets/{stem}.webp con ese nombre, no entra'); continue
        lienzo = ef.a_lienzo(ruta)
        dest = HD / f'{stem}.webp'
        for q in (82, 78, 74):
            lienzo.save(dest, 'webp', quality=q, method=6)
            if dest.stat().st_size <= 60 * 1024: break
        hechas.append(stem)
        print(f'{stem:34s} {dest.stat().st_size / 1024:5.1f} KB  q={q}')
    for t in HD.glob('_*.jpg'): t.unlink()
    print(len(hechas), 'fotos en assets/hd')
    print('FOTOS_HD:', ' '.join(hechas))


if __name__ == '__main__':
    main()
