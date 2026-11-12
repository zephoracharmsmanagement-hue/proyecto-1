"""Historias de Instagram en estilo «estudio»: fotos de catálogo (assets/hd, 1200 px) recortadas del fondo
blanco y compuestas sobre fondo crema con sombra propia. Una por función; `python3 historias_estudio.py`
genera todas en material-sin-publicar/creativos/salida/historias-AAAA-MM-DD/.

Reglas (ver LEEME.md): precios con calcular() al generar; piezas con 3+ unidades en la hoja «Inventario de
movimientos» → Existencias; fotos de catálogo revisadas a mano contra grabados de marca antes de entrar aquí.

Revisión del 2026-11-12 (hoja, conteos hasta ese día):
  Avengers: pulsera 18:4 · 19:7 · 20:1; Capitán 6, Wolverine 5, Deadpool 5, Mjolnir 4, Spider-Man Pavé 4.
  Zodiaco: los 12 signos con 3 (llegada del 1-nov). Fe: Virgen Aparecida 5, Virgen de Fátima 3,
  Corazón Árbol de la Vida 3; brazalete Corazón Abierto 9. Encuesta: Sulley 6, Mike 4.
  Clienta: Trébol 3, Herradura 4, Pulpo 4, Corazón Liso 6.
  Fotos sin grabados de marca: todas las anteriores (las Vírgenes y el zodiaco muestran el sello S925).
"""
import datetime
import json
import os
import subprocess

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
HD = RAIZ + '/assets/hd/'
F = AQUI + '/fonts/'
MATERIAL = RAIZ + '/material-sin-publicar/creativos/'
OUT = MATERIAL + 'salida/historias-' + datetime.date.today().isoformat()
os.makedirs(OUT, exist_ok=True)

W, H = 1080, 1920
TINTA, CIRUELA, ORO_OSC, GRIS = (42, 31, 46), (92, 61, 99), (150, 112, 52), (140, 128, 134)
TOP, BOT = 250, 1590            # zona que no tapa la interfaz de historias


def fuente(n, t, var=None):
    f = ImageFont.truetype(F + n, round(t))
    if var:
        f.set_variation_by_name(var)
    return f


ITAL = lambda t: fuente('PlayfairDisplay-Italic[wght].ttf', t, b'Medium Italic')
BOLD = lambda t: fuente('PlayfairDisplay[wght].ttf', t, b'Bold')
SANS = lambda t: fuente('Lato-Regular.ttf', t)
SANSB = lambda t: fuente('Lato-Bold.ttf', t)
FIRMA = lambda t: fuente('CormorantGaramond[wght].ttf', t, b'Medium')


# ── precios: siempre de calcular() ──
def calcular(base, charms):
    js = ("const {calcular}=require('./netlify/functions/_precios.js');"
          f"const x=calcular({{base:{json.dumps({'id': base, 'talla': '19'} if base else None)},"
          f"charms:{json.dumps(charms)},pago:'anticipado'}});console.log(JSON.stringify({{total:x.total,gratis:x.gratis}}))")
    return json.loads(subprocess.check_output(['node', '-e', js], cwd=RAIZ))


def lista(base, charms):
    """Precio de lista: la suma de cada pieza sola, también desde calcular()."""
    return sum(calcular(None, [c])['total'] for c in charms) + (calcular(base, [])['total'] if base else 0)


def cop(n):
    return '$' + f'{n:,}'.replace(',', '.')


# ── recorte de la joya ──
def recortar(id_, semillas=(), piso=0.0, modo='claro', reflejo_cierre=False):
    """Fondo = blanco conectado al borde (no el plateado de la pieza); sin halo; sin sombra de estudio."""
    im = Image.open(HD + id_ + '.webp').convert('RGB')
    marca = im.copy()
    for xy in [(0, 0), (im.width - 1, 0), (0, im.height - 1), (im.width - 1, im.height - 1)] + list(semillas):
        ImageDraw.floodfill(marca, xy, (255, 0, 255), thresh=40)
    r, g, b = marca.split()
    fondo = ImageChops.multiply(ImageChops.invert(g).point(lambda v: 255 if v > 250 else 0), r.point(lambda v: 255 if v > 250 else 0))
    alfa = ImageChops.invert(fondo).filter(ImageFilter.GaussianBlur(1.2))
    alfa = alfa.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert('RGBA'); out.putalpha(alfa)
    out = out.crop(out.getbbox())
    px, (w, h) = out.load(), out.size
    zonas = []
    if piso:
        zonas.append((0, w, int(h * (1 - piso)), h, modo))
    if reflejo_cierre:                      # reflejo bajo el cierre de un brazalete
        zonas.append((int(w * 0.18), int(w * 0.52), int(h * 0.80), h, 'claro'))
    for x0, x1, y0, y1, m in zonas:
        for y in range(y0, y1):
            for x in range(x0, x1):
                r_, g_, b_, a_ = px[x, y]
                if not a_:
                    continue
                gris = max(r_, g_, b_) - min(r_, g_, b_) < 22
                if m == 'todo' or (gris and (m == 'sinsat' or min(r_, g_, b_) > 190)):
                    px[x, y] = (r_, g_, b_, 0)
    if zonas:
        a = out.split()[3].filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
        out.putalpha(a)
        out = out.crop(out.getbbox())
    return out


def brazalete(id_):
    im = Image.open(HD + id_ + '.webp')
    c = (im.width // 2, im.height // 2)
    return recortar(id_, [(c[0], c[1] - 20), (c[0] + 200, c[1]), (c[0] - 250, c[1])], reflejo_cierre=True)


class Historia:
    def __init__(self):
        fondo = Image.new('RGB', (W, H), (226, 214, 204))
        luz = Image.new('L', (W, H), 0)
        ImageDraw.Draw(luz).ellipse([-200, 300, W + 200, 1500], fill=255)
        fondo = Image.composite(Image.new('RGB', (W, H), (246, 240, 234)), fondo, luz.filter(ImageFilter.GaussianBlur(260)))
        self.c = fondo.convert('RGBA')
        self.d = ImageDraw.Draw(self.c)

    def poner(self, pieza, cx, cy, alto=None, ancho=None):
        if ancho:
            p = pieza.resize((ancho, round(pieza.height * ancho / pieza.width)), Image.LANCZOS)
        else:
            p = pieza.resize((round(pieza.width * alto / pieza.height), alto), Image.LANCZOS)
        x, y = int(cx - p.width / 2), int(cy - p.height / 2)
        s = Image.new('RGBA', self.c.size, (0, 0, 0, 0))
        s.paste((60, 40, 50, 255), (x + 10, y + 22), p.split()[3].point(lambda v: v * 0.38))
        self.c.alpha_composite(s.filter(ImageFilter.GaussianBlur(16)))
        self.c.alpha_composite(p, (x, y))
        self.d = ImageDraw.Draw(self.c)

    def t(self, y, s, f, color=TINTA, x=W / 2, ancla='mt'):
        self.d.text((x, y), s, font=f, fill=color + (255,), anchor=ancla, features=['-liga'])

    def tachado(self, y, s, f):
        w = self.d.textlength(s, font=f)
        self.t(y, s, f, GRIS)
        a, _ = f.getmetrics()
        self.d.line([(W / 2 - w / 2 - 6, y + a * 0.62), (W / 2 + w / 2 + 6, y + a * 0.62)], fill=GRIS + (255,), width=3)

    def pildora(self, cy, s, f, fondo=CIRUELA, color=(255, 255, 255)):
        w = self.d.textlength(s, font=f)
        a, de = f.getmetrics()
        h = a + de + 26
        self.d.rounded_rectangle([W / 2 - w / 2 - 30, cy - h / 2, W / 2 + w / 2 + 30, cy + h / 2], radius=h // 2, fill=fondo + (255,))
        self.d.text((W / 2, cy), s, font=f, fill=color + (255,), anchor='mm', features=['-liga'])

    def firma(self, y=1530):
        self.t(y, 'Zephora Charms', FIRMA(52))

    def guardar(self, nombre):
        p = f'{OUT}/{nombre}.jpg'
        self.c.convert('RGB').save(p, quality=95)
        print(p)


# ── 1 · Avengers: paga 4, lleva 2 gratis ──
def avengers():
    base = 'pulsera-avengers'
    heroes = [('capitan-america', 'Capitán América', 240, 0.10, 'sinsat'), ('wolverine', 'Wolverine', 245, 0.08, 'claro'),
              ('deadpool', 'Deadpool', 245, 0.08, 'claro'), ('mjolnir-martillo-de-thor', 'Mjolnir', 255, 0.06, 'claro'),
              ('spider-man-pave', 'Spider-Man Pavé', 255, 0.05, 'claro')]
    ids = [h[0] for h in heroes]
    p, l = calcular(base, ids), lista(base, ids)
    assert len(p['gratis']) == 2, p
    h = Historia()
    h.t(262, 'Paga 4,', ITAL(104), ORO_OSC)
    h.t(380, 'lleva 2 gratis', BOLD(92))
    h.t(506, 'Arma tu pulsera Avengers', SANS(34), CIRUELA)
    h.poner(brazalete(base), W / 2, 720, alto=330)
    for (id_, n, alto, piso, modo), x in zip(heroes, [140, 335, 540, 745, 940]):
        h.poner(recortar(id_, piso=piso, modo=modo), x, 1035, alto=alto)
        h.t(1185, n, SANSB(25), x=x)
    y = 1248
    h.tachado(y, f'Pulsera + 5 héroes: {cop(l)}', SANS(36))
    h.t(y + 44, f'Pagas {cop(p["total"])}', BOLD(88))
    h.pildora(y + 180, 'La pulsera y un héroe te salen gratis', SANSB(32))
    h.t(y + 224, f'o 3 cuotas de {cop(-(-p["total"] // 3))} sin interés con Addi', SANS(28), CIRUELA)
    h.firma()
    h.guardar('1-avengers-paga-4-lleva-2')


# ── 2 · Zodiaco: llegaron los 12 signos ──
def zodiaco():
    signos = ['aries', 'tauro', 'geminis', 'cancer', 'leo', 'virgo', 'libra', 'escorpio', 'sagitario', 'capricornio', 'acuario', 'piscis']
    nombres = ['Aries', 'Tauro', 'Géminis', 'Cáncer', 'Leo', 'Virgo', 'Libra', 'Escorpio', 'Sagitario', 'Capricornio', 'Acuario', 'Piscis']
    precios = {s: calcular(None, [s])['total'] for s in signos}
    assert len(set(precios.values())) == 1, precios
    h = Historia()
    h.t(262, 'Llegaron', ITAL(96), ORO_OSC)
    h.t(370, 'los 12 signos', BOLD(86))
    h.t(486, '¿Cuál es el tuyo?', SANS(36), CIRUELA)
    for i, (s, n) in enumerate(zip(signos, nombres)):
        x = 175 + (i % 4) * 243
        y = 660 + (i // 4) * 262
        h.poner(recortar(s), x, y, alto=205)
        h.t(y + 120, n, SANSB(27), x=x)
    h.pildora(1430, f'Plata 925 con sello · {cop(precios["leo"])} cada uno', SANSB(32))
    h.t(1478, 'Fíjate: el S925 va grabado en cada charm', SANS(28), CIRUELA)
    h.firma(1525)
    h.guardar('2-zodiaco-llegaron-los-12')


# ── 3 · Fe: regálale su Virgen ──
def fe():
    base = 'pulsera-corazon-abierto'
    piezas = [('virgen-aparecida', 'Virgen Aparecida'), ('virgen-de-fatima', 'Virgen de Fátima'), ('corazon-arbol-de-la-vida', 'Árbol de la Vida')]
    ids = [x for x, _ in piezas]
    p, l = calcular(base, ids), lista(base, ids)
    assert base in p['gratis'], p
    h = Historia()
    h.t(262, 'Regálale', ITAL(104), ORO_OSC)
    h.t(378, 'su Virgen', BOLD(92))
    h.t(500, 'Fe que la acompaña todos los días', SANS(34), CIRUELA)
    h.poner(brazalete(base), W / 2, 700, alto=300)
    for (id_, n), x, alto in zip(piezas, [250, 540, 830], [360, 360, 250]):
        h.poner(recortar(id_, piso=0.05, modo='claro'), x, 1040, alto=alto)
        h.t(1240, n, SANSB(27), x=x)
    y = 1290
    h.tachado(y, f'Brazalete Corazón Abierto + 3 charms: {cop(l)}', SANS(32))
    h.t(y + 40, f'Pagas {cop(p["total"])}', BOLD(84))
    h.pildora(y + 168, 'El brazalete te sale gratis', SANSB(32))
    h.firma(1525)
    h.guardar('3-fe-regalale-su-virgen')


# ── 4 · Encuesta: ¿Sulley o Mike? ──
def encuesta():
    h = Historia()
    h.t(262, '¿Equipo Sulley', ITAL(92), ORO_OSC)
    h.t(370, 'o equipo Mike?', BOLD(86))
    h.poner(recortar('sulley', piso=0.06, modo='claro'), 300, 820, alto=480)
    h.poner(recortar('mike-wazowski', piso=0.06, modo='claro'), 790, 820, alto=480)
    h.t(1090, 'Sulley', SANSB(40), x=300)
    h.t(1090, 'Mike', SANSB(40), x=790)
    h.t(1170, 'Vota aquí abajo', SANS(30), GRIS)
    h.t(1470, 'Charms en Plata 925 con sello', SANS(28), CIRUELA)
    h.firma(1525)
    h.guardar('4-encuesta-sulley-o-mike')


# ── 5 · ¿Qué talla es la mía? (guía de tallas de index.html) ──
def talla():
    h = Historia()
    h.t(262, '¿Qué talla', ITAL(100), ORO_OSC)
    h.t(380, 'es la mía?', BOLD(90))
    h.poner(brazalete('pulsera-corazon-abierto'), W / 2, 650, alto=270)
    y = 850
    pasos = [('Mide tu muñeca', ['Ajustada, sin apretar. Con cinta métrica,', 'o con una tira de papel y una regla.']),
             ('Súmale 2 cm', ['Es el espacio que ocupan tus charms', 'para que cierre cómoda.']),
             ('Esa es tu talla', ['Ejemplo: muñeca de 16 cm → talla 18.'])]
    for i, (t1, lineas) in enumerate(pasos, 1):
        h.d.ellipse([110, y, 176, y + 66], fill=ORO_OSC + (255,))
        h.t(y + 33, str(i), BOLD(40), (255, 255, 255), x=143, ancla='mm')
        h.t(y + 2, t1, SANSB(42), x=206, ancla='la')
        for j, ln in enumerate(lineas):
            h.t(y + 60 + j * 40, ln, SANS(31), CIRUELA, x=206, ancla='la')
        y += 92 + 40 * len(lineas)
    h.pildora(y + 30, 'Tallas de 17 a 21', SANSB(34))
    h.t(y + 82, '¿No te quedó? Tienes 5 días hábiles para cambiarla.', SANS(29), CIRUELA)
    h.firma(1530)
    h.guardar('5-que-talla-es-la-mia')


# ── 6 · Clienta real (cuadro de assets/historia-2.mp4) ──
def clienta():
    cuadro = MATERIAL + 'clienta-historia2-11s.png'
    if not os.path.exists(cuadro):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '11', '-i', RAIZ + '/assets/historia-2.mp4', '-frames:v', '1', cuadro], check=True)
    base, ids = 'pulsera-corazon-liso', ['trebol-verde-giratorio', 'caballo-herradura', 'pulpo-azul-cristal']
    p, l = calcular(base, ids), lista(base, ids)
    im = Image.open(cuadro).convert('RGB').crop((22, 0, 697, 1200)).resize((W, H), Image.LANCZOS)
    c = im.convert('RGBA')
    capa = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    for y in range(0, 560):
        d.line([(0, y), (W, y)], fill=(12, 8, 12, round(215 * (1 - y / 560))))
    for y in range(1220, H):
        d.line([(0, y), (W, y)], fill=(12, 8, 12, round(250 * min(1, (y - 1220) / 260))))
    c = Image.alpha_composite(c, capa)
    h = Historia(); h.c = c; h.d = ImageDraw.Draw(c)
    h.pildora(TOP + 30, 'FOTO REAL DE UNA CLIENTA', SANSB(27), fondo=(255, 255, 255), color=TINTA)
    h.t(TOP + 76, 'Así la armó ella', ITAL(86), (226, 196, 140))
    esc = W / 675
    for (sx, sy), (dx, dy), n in [((200, 710), (-50, 115), 'Trébol'), ((400, 687), (10, 130), 'Herradura'), ((553, 553), (100, 110), 'Pulpo Azul')]:
        tip = ((sx - 22) * esc, sy * esc); ini = (tip[0] + dx, tip[1] + dy)
        h.d.line([ini, tip], fill=(255, 255, 255, 255), width=4)
        h.t(ini[1] + 10, n, SANSB(34), (255, 255, 255), x=ini[0])
    h.tachado(1372, f'Valen {cop(l)}', SANS(36))
    h.t(1414, f'Con brazalete Corazón Liso: {cop(p["total"])}', BOLD(48), (255, 255, 255))
    h.t(1490, 'Toca el enlace y arma la tuya', SANS(34), (226, 216, 221))
    h.guardar('6-clienta-asi-la-armo')


if __name__ == '__main__':
    for f in (avengers, zodiaco, fe, encuesta, talla, clienta):
        f()
