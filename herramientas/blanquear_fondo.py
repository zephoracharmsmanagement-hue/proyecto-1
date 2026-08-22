#!/usr/bin/env python3
"""Lleva a blanco puro el fondo de las fotos que traen un panel gris.

    python3 herramientas/blanquear_fondo.py <id> [<id> ...]            # informa
    python3 herramientas/blanquear_fondo.py <id> [<id> ...] --aplicar

Varias capturas de proveedor no vienen sobre blanco sino sobre un **panel gris
recortado dentro del cuadro** (típicamente 246 sobre 255). En una sola foto no
se nota; en la rejilla, la tarjeta aparece con un recuadro más oscuro que sus
vecinas y canta que la foto viene de otro sitio.

Se detecta mal por las esquinas —que suelen quedar fuera del panel— y por eso
esto se pasó en la primera revisión: hay que mirar el interior. La forma
rápida de verlo a ojo es montar las fotos sobre un lienzo blanco puro; el panel
se delata solo.

**Cómo se corrige sin estropear la pieza.** No es un ajuste de niveles global
—eso aclararía también el producto—. Se mide el color del panel y solo se
lleva a blanco lo que se le parece, con una rampa: lo idéntico al panel pasa a
blanco, lo que se aparta un poco se mezcla en proporción, y lo que se aparta
bastante (la pieza y su sombra propia) no se toca. Así no queda un borde duro
donde termina el relleno.

No sirve para fotos de estudio con degradado o atrezo —una tela, una superficie
de color—: ahí el «fondo» es parte de la composición y blanquearlo la destroza.
Esas necesitan foto nueva.
"""
import pathlib
import sys

from PIL import Image

ASSETS = pathlib.Path(__file__).resolve().parent.parent / "assets"
SALIDA = pathlib.Path(__file__).resolve().parent / "salida"


def color_del_panel(im):
    """El tono del panel, medido dentro del cuadro y no en las esquinas."""
    W, H = im.size
    d = im.load()
    # Rejilla por todo el cuadro, no unas filas fijas: el panel no llega
    # siempre al borde. En la Torre Eiffel va de x=80 a 360 y de y=40 a 440,
    # y muestrear solo los bordes lo daba por blanco.
    claros = []
    for y in range(2, H - 2, 5):
        for x in range(2, W - 2, 5):
            c = d[x, y]
            if min(c) > 200:
                claros.append(c)
    if not claros:
        return None
    # El panel son los claros que NO son blanco puro. Si pesan poco, no hay panel.
    panel = [c for c in claros if min(c) < 253]
    if len(panel) < len(claros) * 0.10:
        return tuple(sorted(v[i] for v in claros)[len(claros) // 2] for i in range(3))
    return tuple(sorted(v[i] for v in panel)[len(panel) // 2] for i in range(3))


def tiene_borde_recto(im, panel, minimo=0.30):
    """¿El panel es un rectángulo recortado, o solo un degradado de estudio?

    Es la distinción que importa y la que cuesta ver midiendo niveles. Un panel
    de proveedor es un recorte con **borde recto**: en la Torre Eiffel son dos
    niveles de diferencia y el recuadro se ve igual, porque el ojo detecta
    bordes mucho mejor que niveles absolutos. El degradado de una foto de
    estudio —la sombra bajo la bola roja, el fondo de Cenicienta— se aparta del
    blanco lo mismo o más, y no hay nada que corregir: es la propia foto.

    Se busca una transición que se repita en la misma x (o la misma y) a lo
    largo de al menos `minimo` del alto (o del ancho). Eso es una recta.
    """
    W, H = im.size
    d = im.load()
    def es_panel(c):
        return max(abs(c[i] - panel[i]) for i in range(3)) <= 4
    for eje in range(2):
        largo, cruce = (H, W) if eje == 0 else (W, H)
        cuenta = [0] * cruce
        for a in range(0, largo, 2):
            ant = None
            for b in range(cruce):
                c = d[b, a] if eje == 0 else d[a, b]
                if min(c) < 200:      # la pieza corta la línea; no cuenta
                    ant = None
                    continue
                aqui = es_panel(c)
                if ant is not None and aqui != ant:
                    cuenta[b] += 1
                ant = aqui
        if max(cuenta) >= (largo / 2) * minimo:
            return True
    return False


def blanquea(ruta, destino):
    """(panel, píxeles tocados). No escribe si el panel no da la talla."""
    im = Image.open(ruta).convert("RGB")
    panel = color_del_panel(im)
    # Lo que decide NO es cuánto se aparta el panel del blanco, sino que ocupe
    # media foto: un panel es un rectángulo con borde recto, y el ojo detecta
    # bordes mucho mejor que niveles. La Torre Eiffel mide (254,254,252) —dos
    # niveles— y el recuadro se ve perfectamente; darla por buena por «pequeña»
    # fue el error. Solo se salta lo que ya es blanco.
    if panel is None or min(panel) >= 254:
        return panel, 0
    if not tiene_borde_recto(im, panel):
        return panel, None

    W, H = im.size
    d = im.load()
    t1, t2 = 6.0, 26.0
    afectados = []
    for y in range(H):
        for x in range(W):
            r, g, b = d[x, y]
            dist = max(abs(r - panel[0]), abs(g - panel[1]), abs(b - panel[2]))
            if dist < t2:
                afectados.append((x, y, 1.0 if dist <= t1 else (t2 - dist) / (t2 - t1)))

    #  · En stitch-azul lo que se tomaba por panel era la sombra de la pieza. Un
    #    panel de verdad ocupa medio cuadro; una sombra, un rincón. Por eso el
    #    corte va aquí y no en un aviso: si no llega, no se escribe nada.
    if len(afectados) < 0.25 * W * H:
        return panel, -len(afectados)

    for x, y, k in afectados:
        r, g, b = d[x, y]
        d[x, y] = (round(r + (255 - r) * k), round(g + (255 - g) * k),
                   round(b + (255 - b) * k))
    im.save(destino, "webp", quality=86, method=6)
    return panel, len(afectados)


def main():
    ids = [a for a in sys.argv[1:] if not a.startswith("--")]
    aplicar = "--aplicar" in sys.argv
    if not ids:
        sys.exit(__doc__)
    SALIDA.mkdir(exist_ok=True)
    for i in ids:
        p = ASSETS / f"{i}.webp"
        if not p.exists():
            print(f"  {i:<34} no existe")
            continue
        destino = p if aplicar else SALIDA / p.name
        panel, tocados = blanquea(p, destino)
        if tocados is None:
            print(f"  {i:<34} panel {panel} — sin borde recto: es degradado de "
                  f"estudio, no recorte. NO se escribe")
        elif tocados < 0:
            print(f"  {i:<34} panel {panel} — solo {-tocados * 100 // (440 * 440)}% "
                  f"del cuadro: es sombra, no panel. NO se escribe")
        elif not tocados:
            print(f"  {i:<34} panel {panel} — ya está en blanco, no se toca")
        else:
            print(f"  {i:<34} panel {panel} -> blanco   "
                  f"({tocados * 100 // (440 * 440)}% del cuadro)")
    if not aplicar:
        print("\nNo se tocó assets/. Repite con --aplicar.")


if __name__ == "__main__":
    main()
