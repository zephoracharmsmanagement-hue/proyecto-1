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


def resolucion_efectiva(im):
    """Cuánto detalle real trae, más allá del tamaño declarado.

    Una imagen ampliada desde 220 px pierde casi nada al bajarla a la mitad y
    volver a subirla; una nítida sí pierde. Ese residuo es la medida.
    """
    g = im.convert("L")
    W, H = g.size
    mitad = g.resize((max(1, W // 2), max(1, H // 2)), Image.LANCZOS)
    mitad = mitad.resize((W, H), Image.LANCZOS)
    a, b = g.tobytes(), mitad.tobytes()
    return sum(abs(x - y) for x, y in zip(a, b)) / len(a)


def a_lienzo(im):
    """Encaja la foto en un cuadrado de LADO px sobre su propio color de fondo."""
    im = im.convert("RGB")
    W, H = im.size
    k = max(4, min(W, H) // 20)
    esquinas = [im.crop((0, 0, k, k)), im.crop((W - k, 0, W, k)),
                im.crop((0, H - k, k, H)), im.crop((W - k, H - k, W, H))]
    px = b"".join(e.tobytes() for e in esquinas)
    fondo = tuple(sum(px[i::3]) // (len(px) // 3) for i in range(3))

    im.thumbnail((LADO, LADO), Image.LANCZOS)
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
        im_n = Image.open(nueva)
        im_v = Image.open(vieja)
        det_n, det_v = resolucion_efectiva(im_n), resolucion_efectiva(im_v)
        lienzo = a_lienzo(im_n)

        tmp = SALIDA / f"{ident}.webp"
        kb, q = comprime(lienzo, tmp)

        nota = ""
        if det_n < det_v * 0.85:
            nota = "  <-- OJO: la nueva trae MENOS detalle que la que ya está"
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
