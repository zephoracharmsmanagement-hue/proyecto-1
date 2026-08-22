#!/usr/bin/env python3
"""Borra el sello del proveedor de las fotos donde no toque la pieza.

    python3 herramientas/quitar_sello.py            # informa, no escribe
    python3 herramientas/quitar_sello.py --aplicar

Media carpeta son capturas de fichas de proveedor, y ~30 llevan encima un sello
rojo «S925 / Real Sterling Silver» que la tienda no puso. Una no se nota;
treinta en la misma rejilla dicen bastante fuerte que las fotos no son de la
tienda.

Cambiar esas fotos por otras limpias sale caro: cuando la que llega es más
pequeña, quitar el sello cuesta resolución, y ese cambio ya se revirtió una vez
(el osito, 225 px estirados a 440). Borrar el sello de la foto buena no cuesta
nada — **cuando el sello no se superpone a la pieza**, que es lo que este script
comprueba antes de tocar nada.

**Cómo distingue el sello de una pieza roja.** Por rojo no vale: Deadpool, Iron
Man, el moño de Minnie y la manzana de Blancanieves son rojos de verdad, y
pintarlos encima sería mucho peor que el sello. Lo que separa al sello es que es
una **isla**: un trozo suelto, rodeado de fondo por todos lados, sin contacto con
el cuerpo de la pieza. El rojo del producto siempre cuelga del cuerpo plateado.
Así que se buscan las partes conexas de la imagen, se toma la mayor como la
pieza, y solo se consideran sello las islas separadas y con tinte rojo.

Donde el sello sí pisa la pieza no se toca y se informa: ahí hace falta una foto
nueva, no un retoque.
"""
import pathlib
import sys

from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ASSETS = RAIZ / "assets"
SALIDA = pathlib.Path(__file__).resolve().parent / "salida"

ESCALA = 220        # las partes conexas se buscan aquí; el relleno va a resolución real
MARGEN = 5          # píxeles de aire alrededor del sello al rellenar
MIN_ISLA = 25       # más pequeño que esto es ruido de compresión
MAX_ISLA = 0.09     # una isla mayor que el 9% del cuadro no es un sello
FORMA = (0.45, 2.2)  # el sello es una insignia redonda: ancho/alto cerca de 1


def _fondo(im):
    W, H = im.size
    k = max(2, min(W, H) // 20)
    px = b"".join(e.tobytes() for e in (
        im.crop((0, 0, k, k)), im.crop((W - k, 0, W, k)),
        im.crop((0, H - k, k, H)), im.crop((W - k, H - k, W, H))))
    return tuple(sum(px[i::3]) // (len(px) // 3) for i in range(3))


def _islas(im):
    """Devuelve (partes, lado). Cada parte: lista de índices que la forman."""
    ch = im.convert("RGB").resize((ESCALA, ESCALA), Image.LANCZOS)
    bg = _fondo(ch)
    d = ch.tobytes()
    n = ESCALA * ESCALA
    m = [(d[i * 3] - bg[0]) ** 2 + (d[i * 3 + 1] - bg[1]) ** 2
         + (d[i * 3 + 2] - bg[2]) ** 2 > 700 for i in range(n)]

    padre = list(range(n))

    def raiz(a):
        while padre[a] != a:
            padre[a] = padre[padre[a]]
            a = padre[a]
        return a

    for y in range(ESCALA):
        for x in range(ESCALA):
            i = y * ESCALA + x
            if not m[i]:
                continue
            # 8-conectividad: el borde punteado del sello se parte con 4
            for dx, dy in ((-1, 0), (0, -1), (-1, -1), (1, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < ESCALA and 0 <= ny < ESCALA:
                    j = ny * ESCALA + nx
                    if m[j]:
                        ra, rb = raiz(i), raiz(j)
                        if ra != rb:
                            padre[ra] = rb

    partes = {}
    for i in range(n):
        if m[i]:
            partes.setdefault(raiz(i), []).append(i)
    return partes, d


def busca_sello(ruta):
    """(caja del sello en píxeles del original, motivo) — caja None si no hay."""
    im = Image.open(ruta).convert("RGB")
    W, H = im.size
    partes, d = _islas(im)
    if not partes:
        return None, "sin sujeto"

    pieza = max(partes.values(), key=len)
    candidatas = []
    for ids in partes.values():
        if ids is pieza or not (MIN_ISLA <= len(ids) <= MAX_ISLA * ESCALA * ESCALA):
            continue
        # ¿tiene tinte rojo? el sello es un rojo apagado, no gris
        rojo = sum(1 for i in ids if d[i * 3] - d[i * 3 + 1] > 8
                   and d[i * 3] - d[i * 3 + 2] > 8)
        if rojo < len(ids) * 0.30:
            continue
        # El sello es una insignia redonda. Sin esta guarda, en las fotos que
        # no son producto-sobre-blanco —el creativo con la mano de la modelo—
        # se colaba como "sello" una franja de piel de 21x127 px, y borrarla
        # habría destrozado la foto. Un rojo alargado no es un sello.
        xs = [i % ESCALA for i in ids]
        ys = [i // ESCALA for i in ids]
        forma = (max(xs) - min(xs) + 1) / (max(ys) - min(ys) + 1)
        if not (FORMA[0] <= forma <= FORMA[1]):
            continue
        candidatas.append(ids)

    if not candidatas:
        return None, "no lleva sello suelto"

    ids = max(candidatas, key=len)
    xs = [i % ESCALA for i in ids]
    ys = [i // ESCALA for i in ids]
    caja = (int(min(xs) / ESCALA * W), int(min(ys) / ESCALA * H),
            int(max(xs) / ESCALA * W) + 1, int(max(ys) / ESCALA * H) + 1)

    # ¿la caja se come parte de la pieza? Se mide en la escala de trabajo.
    sx0, sy0 = min(xs) - 2, min(ys) - 2
    sx1, sy1 = max(xs) + 2, max(ys) + 2
    dentro = sum(1 for i in pieza
                 if sx0 <= i % ESCALA <= sx1 and sy0 <= i // ESCALA <= sy1)
    if dentro > 6:
        return None, f"el sello pisa la pieza ({dentro} px) — hace falta foto nueva"
    return caja, "limpiable"


def limpia(ruta, caja, destino):
    """Rellena la caja tomando, en cada fila, el fondo de esa misma fila."""
    im = Image.open(ruta).convert("RGB")
    W, H = im.size
    d = im.load()
    x0 = max(0, caja[0] - MARGEN)
    y0 = max(0, caja[1] - MARGEN)
    x1 = min(W - 1, caja[2] + MARGEN)
    y1 = min(H - 1, caja[3] + MARGEN)
    for y in range(y0, y1 + 1):
        ref = ([d[x, y] for x in range(max(0, x0 - 16), x0)]
               + [d[x, y] for x in range(x1 + 1, min(W, x1 + 17))])
        if not ref:
            continue
        c = tuple(sorted(v[i] for v in ref)[len(ref) // 2] for i in range(3))
        for x in range(x0, x1 + 1):
            d[x, y] = c
    im.save(destino, "webp", quality=86, method=6)
    return (x0, y0, x1, y1)


def main():
    aplicar = "--aplicar" in sys.argv
    SALIDA.mkdir(exist_ok=True)
    limpiables, pisan, limpias = [], [], 0

    for p in sorted(ASSETS.glob("*.webp")):
        caja, motivo = busca_sello(p)
        if caja:
            limpiables.append((p, caja))
        elif "pisa" in motivo:
            pisan.append((p, motivo))
        else:
            limpias += 1

    print(f"{len(list(ASSETS.glob('*.webp')))} fotos · "
          f"{len(limpiables)} con sello borrable · {len(pisan)} con sello sobre la pieza · "
          f"{limpias} sin isla de sello\n")
    print("  («sin isla de sello» no es «limpia»: si el sello toca la pieza no\n"
          "   forma isla y cae aquí. Ese caso necesita foto nueva, no retoque.)\n")

    antes = []
    for p, caja in limpiables:
        antes.append(Image.open(p).convert("RGB").resize((300, 300), Image.LANCZOS))
        destino = (p if aplicar else SALIDA / p.name)
        real = limpia(p, caja, destino)
        print(f"  {p.stem:<36} sello en {caja}  relleno {real}")

    if pisan:
        print("\nNo se tocan — el sello se superpone a la pieza:")
        for p, motivo in pisan:
            print(f"  {p.stem:<36} {motivo}")

    if antes:
        hoja = Image.new("RGB", (600, len(antes) * 310), (250, 250, 252))
        for i, (p, _) in enumerate(limpiables):
            hoja.paste(antes[i], (0, i * 310))
            fin = Image.open(p if aplicar else SALIDA / p.name).convert("RGB")
            hoja.paste(fin.resize((300, 300), Image.LANCZOS), (300, i * 310))
        hoja.save(SALIDA / "sellos.png")
        print(f"\nAntes/después: {SALIDA / 'sellos.png'}")

    if not aplicar:
        print("\nNo se tocó assets/. Repite con --aplicar cuando se vea bien.")


if __name__ == "__main__":
    main()
