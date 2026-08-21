#!/usr/bin/env python3
"""Mete fotos nuevas en `assets/` con el formato que usa la tienda.

    python3 herramientas/entrar_fotos.py <carpeta-con-las-fotos-nuevas>
    python3 herramientas/entrar_fotos.py <carpeta> --aplicar

Sin `--aplicar` no escribe nada: enseña la comparación y para. Es a propósito
—una foto mal emparejada reemplaza en silencio a la buena, y el error solo se
ve en producción—.

Qué resuelve, en orden de veces que ya mordió:

1. **Nombres sucios.** Una foto que llegó por chat vino como
   `stitch-azul.webp⁠.webp`: extensión duplicada y un U+2060 invisible en
   medio. La página no la habría encontrado nunca y la tarjeta habría seguido
   diciendo "Foto en camino" sin que nada fallara. Aquí el nombre se limpia de
   caracteres invisibles y de extensiones repetidas, y si aun así no coincide
   con ninguna pieza del catálogo, el archivo se reporta y no entra.

2. **Peso.** El estándar del sitio es 440x440 y ~13 KB. Una foto de 1080 px
   pintada a 440 cuadruplica la descarga en un móvil, que es donde compra casi
   todo el mundo aquí. Todo lo que entra se reescala y se recomprime buscando
   ese tamaño.

3. **Reemplazos que empeoran.** Antes de escribir compara la nueva contra la
   que ya está: si la nueva tiene menos resolución efectiva, avisa. Traer una
   foto peor es más fácil de lo que parece cuando el original vino de una
   captura.

Deja `herramientas/salida/comparacion.png` —antes y después, lado a lado— para
mirar el resultado antes de hacer commit.
"""
import pathlib
import re
import shutil
import sys
import unicodedata

from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ASSETS = RAIZ / "assets"
SALIDA = pathlib.Path(__file__).resolve().parent / "salida"

LADO = 440          # el lado que usa la rejilla del catálogo
OBJETIVO_KB = 14.0  # techo blando; el resto del catálogo va entre 6,5 y 26,5
LLENADO = 0.90      # cuánto del cuadro ocupa la pieza; la mediana del catálogo

# Caracteres que no se ven pero rompen la ruta: word-joiner, zero-width y demás.
INVISIBLES = re.compile(r"[​-‏ -‮⁠-⁤﻿]")


def limpia_nombre(nombre):
    """Devuelve (id, avisos) a partir del nombre de archivo tal como llegó."""
    avisos = []
    n = unicodedata.normalize("NFC", nombre)
    if INVISIBLES.search(n):
        avisos.append("traía caracteres invisibles en el nombre")
        n = INVISIBLES.sub("", n)
    # `foto.webp.webp` o `foto.jpg.webp` -> `foto`
    tallo = n
    while True:
        nuevo = re.sub(r"\.(webp|jpe?g|png)$", "", tallo, flags=re.I)
        if nuevo == tallo:
            break
        tallo = nuevo
    if tallo != re.sub(r"\.(webp|jpe?g|png)$", "", n, flags=re.I):
        avisos.append("traía la extensión duplicada")
    # `camaleon verde (1)` -> `camaleon-verde`
    tallo = re.sub(r"\s*\(\d+\)\s*$", "", tallo).strip()
    tallo = re.sub(r"[\s_]+", "-", tallo).lower()
    return tallo, avisos


def _mascara(im, lado=200):
    """Mapa de qué es producto y qué es lienzo, a baja resolución.

    El fondo se toma de las cuatro esquinas: sirve igual con el blanco del
    catálogo que con los fondos rosa o gris que traen las capturas.
    """
    im = im.convert("RGB").resize((lado, lado), Image.LANCZOS)
    k = max(2, lado // 20)
    W = H = lado
    px = b"".join(e.tobytes() for e in (
        im.crop((0, 0, k, k)), im.crop((W - k, 0, W, k)),
        im.crop((0, H - k, k, H)), im.crop((W - k, H - k, W, H))))
    fondo = tuple(sum(px[i::3]) // (len(px) // 3) for i in range(3))
    d = im.tobytes()
    return [(d[i * 3] - fondo[0]) ** 2 + (d[i * 3 + 1] - fondo[1]) ** 2
            + (d[i * 3 + 2] - fondo[2]) ** 2 > 900 for i in range(lado * lado)], lado


def pixeles_de_producto(ruta):
    """Cuántos píxeles del original ocupa de verdad la pieza.

    No es el tamaño del archivo ni la caja que abarca todo lo que no es fondo:
    es el lado del **trozo contiguo más grande**. Esa distinción es la que
    importa, porque media carpeta son capturas de fichas de proveedor con tres
    paneles en un mismo cuadro. Ahí la caja abarca los tres y da una cifra
    enorme, mientras la pieza que se va a ver ocupa un tercio.

    Con esto la regla que costó una reversión —una subida de 225 px estirada a
    440 se ve borrosa, y quitarle el sello no compensa— deja de ser un juicio y
    pasa a ser una comparación: producto contra producto, en los originales,
    antes de tocar nada.

    Dónde se queda corta, para que nadie confíe de más: cuando los paneles del
    collage traen su propio fondo de color, el panel entero cuenta como una
    sola pieza y la cifra de la foto vieja sale inflada. Entonces avisa de una
    pérdida que no existe. Por eso el aviso manda a mirar la hoja de
    comparación y no bloquea nada: mide, no decide. Tampoco ve el desenfoque
    —cuenta píxeles—, así que una foto ampliada antes de mandarla pasa igual.
    """
    im = Image.open(ruta)
    orig = max(im.size)
    m, lado = _mascara(im)

    # Componentes conexas por union-find; nos quedamos con la mayor.
    padre = list(range(lado * lado))

    def raiz(a):
        while padre[a] != a:
            padre[a] = padre[padre[a]]
            a = padre[a]
        return a

    for y in range(lado):
        for x in range(lado):
            i = y * lado + x
            if not m[i]:
                continue
            for j in (i - 1 if x else -1, i - lado if y else -1):
                if j >= 0 and m[j]:
                    ra, rb = raiz(i), raiz(j)
                    if ra != rb:
                        padre[ra] = rb

    cajas = {}
    for y in range(lado):
        for x in range(lado):
            i = y * lado + x
            if not m[i]:
                continue
            r = raiz(i)
            c = cajas.get(r)
            cajas[r] = (min(c[0], x), min(c[1], y), max(c[2], x), max(c[3], y),
                        c[4] + 1) if c else (x, y, x, y, 1)
    if not cajas:
        return orig
    x0, y0, x1, y1, _ = max(cajas.values(), key=lambda c: c[4])
    # de vuelta a la escala del original
    return int(max(x1 - x0, y1 - y0) / lado * orig)


def a_lienzo(ruta):
    """Encaja la foto en el cuadrado de LADO px con el encuadre del catálogo.

    No basta con reducir: las fuentes traen su propio margen, y conservarlo
    deja la pieza pequeña. En una rejilla eso se ve —la tarjeta nueva parece
    encogida al lado de las vecinas— aunque la foto sea mejor. El catálogo
    tiene la pieza al 90% del cuadro (entre 82% y 98%), así que se recorta al
    producto y se reescala a esa proporción.
    """
    im = Image.open(ruta).convert("RGB")
    m, lado = _mascara(im)

    # La caja no se saca del primer píxel que se aparta del fondo: la sombra
    # difusa bajo la pieza cuenta como sujeto y estira la caja hacia abajo, con
    # lo que la pieza acaba reducida para caber y sale más pequeña que sus
    # vecinas en la rejilla. Se descartan las filas y columnas con muy pocos
    # píxeles de sujeto, que es justo lo que es una sombra.
    filas = [sum(m[y * lado:(y + 1) * lado]) for y in range(lado)]
    cols = [sum(m[y * lado + x] for y in range(lado)) for x in range(lado)]
    umbral_f = max(filas) * 0.06
    umbral_c = max(cols) * 0.06
    ys = [y for y, v in enumerate(filas) if v > umbral_f]
    xs = [x for x, v in enumerate(cols) if v > umbral_c]

    W, H = im.size
    k = max(4, min(W, H) // 20)
    px = b"".join(e.tobytes() for e in (
        im.crop((0, 0, k, k)), im.crop((W - k, 0, W, k)),
        im.crop((0, H - k, k, H)), im.crop((W - k, H - k, W, H))))
    fondo = tuple(sum(px[i::3]) // (len(px) // 3) for i in range(3))

    if xs:
        im = im.crop((int(min(xs) / lado * W), int(min(ys) / lado * H),
                      min(W, int(max(xs) / lado * W) + 1),
                      min(H, int(max(ys) / lado * H) + 1)))

    objetivo = int(LADO * LLENADO)
    im.thumbnail((objetivo, objetivo), Image.LANCZOS)
    lienzo = Image.new("RGB", (LADO, LADO), fondo)
    lienzo.paste(im, ((LADO - im.width) // 2, (LADO - im.height) // 2))
    return lienzo


def comprime(im, destino):
    """Guarda como webp buscando quedar cerca de OBJETIVO_KB sin bajar de q=72."""
    for q in (86, 82, 78, 74, 72):
        im.save(destino, "webp", quality=q, method=6)
        if destino.stat().st_size / 1024 <= OBJETIVO_KB:
            break
    return destino.stat().st_size / 1024, q


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    entrada = pathlib.Path(sys.argv[1])
    aplicar = "--aplicar" in sys.argv
    if not entrada.is_dir():
        sys.exit(f"No es una carpeta: {entrada}")

    conocidos = {p.stem: p for p in ASSETS.glob("*.webp")}
    entrantes = sorted(p for p in entrada.iterdir()
                       if p.suffix.lower() in (".webp", ".jpg", ".jpeg", ".png"))
    if not entrantes:
        sys.exit(f"No hay imágenes en {entrada}")

    parejas, sueltas = [], []
    for p in entrantes:
        ident, avisos = limpia_nombre(p.name)
        if ident in conocidos:
            parejas.append((p, ident, conocidos[ident], avisos))
        else:
            sueltas.append((p, ident, avisos))

    print(f"{len(entrantes)} imágenes entrantes · {len(parejas)} emparejadas "
          f"· {len(sueltas)} sin pareja\n")

    SALIDA.mkdir(exist_ok=True)
    filas = []
    for nueva, ident, vieja, avisos in parejas:
        im_v = Image.open(vieja)
        lienzo = a_lienzo(nueva)
        det_n = pixeles_de_producto(nueva)
        det_v = pixeles_de_producto(vieja)

        tmp = SALIDA / f"{ident}.webp"
        kb, q = comprime(lienzo, tmp)

        nota = ""
        if det_n < det_v * 0.95:
            nota = (f"  <-- OJO: el producto viene con MENOS píxeles que "
                    f"el actual ({det_n} contra {det_v})")
        elif det_n < LADO:
            nota = (f"  <-- el producto trae {det_n} px para pintar {LADO}; "
                    f"mejora sobre el actual ({det_v}) pero mirar la hoja")
        for a in avisos:
            nota += f"  <-- {a}"
        print(f"  {ident:<42} {im_v.size[0]}x{im_v.size[1]} "
              f"{vieja.stat().st_size/1024:5.1f}KB  ->  {LADO}x{LADO} "
              f"{kb:5.1f}KB q{q}{nota}")
        filas.append((ident, im_v.copy(), lienzo))

        if aplicar:
            shutil.copyfile(tmp, vieja)

    if sueltas:
        print("\nSin pareja en el catálogo — no entran hasta resolver el nombre:")
        for p, ident, avisos in sueltas:
            extra = f"  ({'; '.join(avisos)})" if avisos else ""
            print(f"  {p.name}   -> buscó el id '{ident}'{extra}")

    if filas:
        hoja = Image.new("RGB", (2 * LADO + 30, len(filas) * (LADO + 10)),
                         (250, 250, 252))
        for i, (_, v, n) in enumerate(filas):
            y = i * (LADO + 10)
            hoja.paste(v.convert("RGB").resize((LADO, LADO), Image.LANCZOS), (0, y))
            hoja.paste(n, (LADO + 30, y))
        hoja.save(SALIDA / "comparacion.png")
        print(f"\nAntes/después: {SALIDA / 'comparacion.png'}")

    if not aplicar:
        print("\nNo se escribió nada. Repite con --aplicar cuando la "
              "comparación se vea bien.")


if __name__ == "__main__":
    main()
