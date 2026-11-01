"""Lote de 5 anuncios de foto de Zephora Charms en 1:1, 4:5 y 9:16.

Solo promociones y medios de pago que la tienda cobra hoy (verificado 2026-10-21):
  · Paga 3, lleva 1 gratis (con 4 piezas, la de menor valor sale gratis) — calcular():
      Corona Pavé + Atrapasueños + Esfera Azul + Flor Azul: lista $328.000 → $246.000
      Corona Pavé + V + Luciérnaga + Atrapasueños: $250.000 (Addi 3 × $83.334)
      Corazón Liso + Trébol + Herradura + Pulpo Azul: lista $348.000 → $270.000 (Addi 3 × $90.000)
  · Addi: «sin interés» solo de $50.000 a $600.000 (tienda.js, pintarCuotasAddi).
  · Sistecrédito: con el cupo de la clienta, desde $50.000; sin prometer cuotas ni interés (ESTADO.md).
  · Envío gratis pagando en línea. Brazaletes desde $78.000 (stock.json).
Existencias (hoja «Inventario de movimientos», 2026-10-21): todas las piezas mostradas con 3 o más.
Fotos: reales (muñeca y caja del propietario, portadas de los videos de producto, cuadro del video
de una clienta en assets/historia-2.mp4). Nada generado con IA."""
import math
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
F = AQUI + '/fonts/'                                   # bajar con: bash herramientas/creativos/fuentes.sh
REPO = RAIZ + '/assets/'
# Fotos del propietario y salidas: fuera de git (material-sin-publicar/ está en .gitignore)
MATERIAL = RAIZ + '/material-sin-publicar/creativos/'
BASE = MATERIAL + 'salida'
OUT = BASE + '/lote'
os.makedirs(OUT, exist_ok=True)

ORO, BLANCO, GRIS, FONDO, PLUM = (226, 196, 140), (255, 255, 255), (172, 162, 168), (22, 17, 22), (92, 61, 99)
SUAVE = (226, 216, 221)
FORMATOS = {'1x1': (1080, 1080), '4x5': (1080, 1350), '9x16': (1080, 1920)}

MUNECA = Image.open(MATERIAL + 'muneca-v-luciernaga-atrapasuenos.jpg').convert('RGB')      # 1080x1920
CAJA = Image.open(MATERIAL + 'caja-a-luciernaga-atrapasuenos.jpg').convert('RGB')        # 1080x1350
CLIENTA = Image.open(MATERIAL + 'clienta-historia2-11s.png').convert('RGB')  # 720x1280


def fuente(n, t, var=None):
    f = ImageFont.truetype(F + n, max(10, round(t)))
    if var:
        f.set_variation_by_name(var)
    return f


ITAL = lambda t: fuente('PlayfairDisplay-Italic[wght].ttf', t, b'Medium Italic')
BOLD = lambda t: fuente('PlayfairDisplay[wght].ttf', t, b'Bold')
SANS = lambda t: fuente('Lato-Regular.ttf', t)
SANSB = lambda t: fuente('Lato-Bold.ttf', t)
FIRMA = lambda t: fuente('CormorantGaramond[wght].ttf', t, b'Medium')


class Lienzo:
    """Canvas de un formato: tamaño, zona segura y escala tipográfica."""

    def __init__(self, fmt, fondo=None):
        self.fmt = fmt
        self.W, self.H = FORMATOS[fmt]
        self.top = 250 if fmt == '9x16' else 44           # 9:16 deja libre lo que tapa la interfaz
        self.bot = self.H - (330 if fmt == '9x16' else 34)
        self.s = 0.86 if fmt == '1x1' else 1.0
        self.im = (fondo or Image.new('RGB', (self.W, self.H), FONDO)).convert('RGBA')

    def txt(self, xy, s, f, color=BLANCO, ancla='ma', glow=True):
        if glow:
            sh = Image.new('RGBA', self.im.size, (0, 0, 0, 0))
            ImageDraw.Draw(sh).text((xy[0] + 2, xy[1] + 3), s, font=f, fill=(0, 0, 0, 190), anchor=ancla, features=['-liga'])
            self.im = Image.alpha_composite(self.im, sh.filter(ImageFilter.GaussianBlur(7)))
        ImageDraw.Draw(self.im).text(xy, s, font=f, fill=color + (255,), anchor=ancla, features=['-liga'])

    def centro(self, y, s, f, color=BLANCO, glow=True):
        self.txt((self.W // 2, y), s, f, color, 'ma', glow)
        a, d = f.getmetrics()
        return y + a + d

    def sombra(self, y0, y1, alfa, hacia='abajo'):
        capa = Image.new('RGBA', self.im.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(capa)
        for y in range(max(0, y0), min(self.H, y1)):
            t = (y - y0) / max(1, y1 - y0)
            d.line([(0, y), (self.W, y)], fill=(8, 5, 8, round(alfa * (t if hacia == 'abajo' else 1 - t))))
        self.im = Image.alpha_composite(self.im, capa)

    def pildora(self, cy, texto, f, relleno=ORO, color=FONDO, pad=(32, 14)):
        d = ImageDraw.Draw(self.im)
        w = d.textlength(texto, font=f)
        a, de = f.getmetrics()
        h = a + de
        x0 = (self.W - w) / 2 - pad[0]
        d.rounded_rectangle([x0, cy - h / 2 - pad[1], x0 + w + 2 * pad[0], cy + h / 2 + pad[1]], radius=(h + 2 * pad[1]) // 2, fill=relleno + (255,))
        d.text((self.W / 2, cy), texto, font=f, fill=color + (255,), anchor='mm', features=['-liga'])

    def tachado(self, y, texto, f):
        d = ImageDraw.Draw(self.im)
        w = d.textlength(texto, font=f)
        a, de = f.getmetrics()
        d.text((self.W / 2, y), texto, font=f, fill=GRIS + (255,), anchor='ma')
        ym = y + a * 0.62
        d.line([(self.W / 2 - w / 2 - 6, ym), (self.W / 2 + w / 2 + 6, ym)], fill=GRIS + (255,), width=3)
        return y + a + de

    def flecha(self, p0, p1, ancho=4):
        d = ImageDraw.Draw(self.im)
        d.line([p0, p1], fill=BLANCO + (255,), width=ancho)
        a = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
        for k in (-1, 1):
            d.line([p1, (p1[0] - 22 * math.cos(a + k * 0.45), p1[1] - 22 * math.sin(a + k * 0.45))], fill=BLANCO + (255,), width=ancho)

    def firma(self):
        self.txt((self.W // 2, self.bot - 56), 'Zephora Charms', FIRMA(50 * self.s), glow=True)

    def pegar(self, img, xy, mascara=None):
        self.im.paste(img, (int(xy[0]), int(xy[1])), mascara)

    def guardar(self, nombre):
        p = f'{OUT}/{nombre}-{self.fmt}.jpg'
        self.im.convert('RGB').save(p, quality=94, subsampling=0)
        return p


def recorte(src, caja, W, H):
    return src.crop(caja).resize((W, H), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.6, 50, 2))


def banda(src, caja, W, H, y):
    """Franja de la foto a todo el ancho; arriba y abajo, la misma foto desenfocada y oscura."""
    fondo = src.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(45))
    fondo = Image.blend(fondo, Image.new('RGB', (W, H), (8, 6, 8)), 0.55)
    t = src.crop(caja)
    t = t.resize((W, round(t.height * W / t.width)), Image.LANCZOS)
    m = Image.new('L', t.size, 255)
    d = ImageDraw.Draw(m)
    for i in range(110):
        a = round(255 * i / 110)
        d.line([(0, i), (W, i)], fill=a)
        d.line([(0, t.height - 1 - i), (W, t.height - 1 - i)], fill=a)
    fondo.paste(t, (0, y), m)
    return fondo, y + t.height


# Joya en la portada de su video (440x550): centro y radio del recorte, ubicados a mano.
CENTROS = {'atrapasuenos-azul': (240, 340, 140), 'esfera-azul-con-cristales': (280, 285, 130),
           'flor-azul-con-cristales': (234, 264, 120), 'pulsera-corona-pave': (225, 330, 200),
           'pulsera-corazon-liso': (225, 320, 200), 'luciernaga-you-are-my-light': (215, 250, 140)}


def mascara_redonda(lado, r=22):
    m = Image.new('L', (lado, lado), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, lado - 1, lado - 1], radius=r, fill=255)
    return m


def celda(id_, lado):
    im = Image.open(f'{REPO}vid-{id_}.webp').convert('RGB')
    cx, cy, r = CENTROS[id_]
    c = im.crop((cx - r, cy - r, cx + r, cy + r)).resize((lado, lado), Image.LANCZOS)
    return c.filter(ImageFilter.UnsharpMask(1.2, 40, 2)), mascara_redonda(lado)


def logo(archivo, alto):
    lg = Image.open(REPO + 'pagos/' + archivo).convert('RGBA')
    return lg.resize((round(lg.width * alto / lg.height), alto), Image.LANCZOS)


# ── V1 · AHORRO: «Elige 4 piezas, paga solo 3», con el precio de lista tachado ──
def v1(fmt):
    c = Lienzo(fmt)
    s = c.s
    y = c.centro(c.top + 6, 'Elige 4 piezas,', ITAL(84 * s), ORO)
    y = c.centro(y - 8, 'paga solo 3', BOLD(78 * s))
    piezas = [('pulsera-corona-pave', 'Brazalete Corona Pavé'), ('atrapasuenos-azul', 'Atrapasueños Azul'),
              ('esfera-azul-con-cristales', 'Esfera Azul'), ('flor-azul-con-cristales', 'Flor Azul')]
    precio_alto = round(250 * s)
    zona = (y + 24, c.bot - 70 - precio_alto)
    G, etiqueta = 20, 44 * s
    if fmt == '1x1':                                    # una fila de 4
        L = min((c.W - 120 - 3 * G) // 4, int(zona[1] - zona[0] - etiqueta))
        x0, filas, cols = (c.W - (4 * L + 3 * G)) // 2, 1, 4
    else:                                               # 2 × 2
        L = int(min((c.W - 200 - G) / 2, (zona[1] - zona[0] - 2 * etiqueta - G) / 2))
        x0, filas, cols = (c.W - (2 * L + G)) // 2, 2, 2
    alto_grid = filas * (L + etiqueta) + (filas - 1) * G
    y0 = zona[0] + max(0, (zona[1] - zona[0] - alto_grid) // 2)
    for i, (id_, nombre) in enumerate(piezas):
        img, m = celda(id_, L)
        x = x0 + (i % cols) * (L + G)
        yy = y0 + (i // cols) * (L + etiqueta + G)
        c.pegar(img, (x, yy), m)
        c.txt((x + L / 2, yy + L + 8), nombre, SANS(25 * s), SUAVE, glow=False)
    yp = c.bot - 70 - precio_alto + 16
    yp = c.tachado(yp, 'Valen $328.000', SANS(36 * s))
    yp = c.centro(yp - 4, 'Pagas $246.000', BOLD(70 * s))
    c.centro(yp + 6, 'La de menor valor sale gratis · Envío gratis pagando en línea', SANS(26 * s), SUAVE, glow=False)
    c.firma()
    return c.guardar('V1-ahorro-elige-4-paga-3')


# ── V2 · CUOTAS: Addi y Sistecrédito en una sola franja discreta ──
def v2(fmt):
    W, H = FORMATOS[fmt]
    if fmt == '4x5':
        c = Lienzo(fmt, recorte(MUNECA, (0, 820, 880, 1920), W, H))
        c.sombra(0, 260, 150, 'arriba'); c.sombra(660, H, 252)
        y = 860
    elif fmt == '1x1':
        c = Lienzo(fmt, recorte(MUNECA, (0, 840, 1080, 1920), W, H))
        c.sombra(500, H, 252)
        y = 650
    else:
        fondo, fin = banda(MUNECA, (0, 820, 1080, 1920), W, H, 380)
        c = Lienzo(fmt, fondo)
        c.sombra(1040, H, 252)
        y = 1172
    s = c.s
    y = c.centro(y, 'Llévala hoy,', ITAL(84 * s), ORO)
    y = c.centro(y - 10, 'págala a cuotas', BOLD(70 * s))
    # franja de medios de pago: discreta, blanca, logos chicos
    alto = round(40 * s)
    a, sc = logo('addi.webp', alto), logo('sistecredito.webp', alto)
    f = SANS(28 * s)
    d = ImageDraw.Draw(c.im)
    t1 = 'con'
    sep = ' o '
    w = d.textlength(t1, font=f) + 14 + a.width + d.textlength(sep, font=f) + sc.width
    x0 = (c.W - w) / 2
    cy = y + 22 + alto / 2 + 14
    d.rounded_rectangle([x0 - 28, cy - alto / 2 - 14, x0 + w + 28, cy + alto / 2 + 14], radius=alto, fill=(255, 255, 255, 238))
    d.text((x0, cy), t1, font=f, fill=FONDO + (255,), anchor='lm')
    x = x0 + d.textlength(t1, font=f) + 14
    c.im.alpha_composite(a, (int(x), int(cy - alto / 2))); x += a.width
    d.text((x, cy), sep, font=f, fill=FONDO + (255,), anchor='lm'); x += d.textlength(sep, font=f)
    c.im.alpha_composite(sc, (int(x), int(cy - alto / 2)))
    y = cy + alto / 2 + 30
    y = c.centro(y, 'Addi: hasta 3 cuotas sin interés · Sistecrédito: con tu cupo', SANS(27 * s), SUAVE, glow=False)
    if fmt == '4x5':
        c.centro(y + 4, 'Brazalete Corona Pavé + estos 3 charms: $250.000 (paga 3, lleva 1 gratis)', SANS(23 * s), GRIS, glow=False)
    c.firma()
    return c.guardar('V2-cuotas-addi-sistecredito')


# ── V3 · CÓMO FUNCIONA: «Así se arma, en 3 pasos» (ángulo nuevo) ──
def v3(fmt):
    c = Lienzo(fmt)
    s = c.s
    y = c.centro(c.top + 6, 'Así se arma', ITAL(84 * s), ORO)
    y = c.centro(y - 8, 'en 3 pasos', BOLD(70 * s))
    caja_tile = CAJA.crop((430, 500, 1040, 1110))
    pasos = [('pulsera-corazon-liso', 'Elige tu brazalete', 'Desde $78.000'),
             ('atrapasuenos-azul', 'Súmale tus charms', 'Plata 925 con sello'),
             (None, 'Te llega lista', 'Caja y dedicatoria a mano')]
    pie = round(150 * s)
    zona = (y + 30, c.bot - 70 - pie)
    if fmt == '1x1':                                    # tres columnas
        G = 30
        L = min((c.W - 100 - 2 * G) // 3, int(zona[1] - zona[0] - 130 * s))
        x0 = (c.W - (3 * L + 2 * G)) // 2
        for i, (id_, t1, t2) in enumerate(pasos):
            img, m = celda(id_, L) if id_ else (caja_tile.resize((L, L), Image.LANCZOS), mascara_redonda(L))
            x = x0 + i * (L + G)
            c.pegar(img, (x, zona[0]), m)
            d = ImageDraw.Draw(c.im)
            d.ellipse([x + 12, zona[0] + 12, x + 64, zona[0] + 64], fill=ORO + (255,))
            d.text((x + 38, zona[0] + 38), str(i + 1), font=BOLD(34), fill=FONDO + (255,), anchor='mm')
            c.txt((x + L / 2, zona[0] + L + 14), t1, SANSB(30 * s), glow=False)
            c.txt((x + L / 2, zona[0] + L + 54 * s), t2, SANS(25 * s), SUAVE, glow=False)
    else:                                               # tres filas: foto a la izquierda, texto a la derecha
        G = 26
        L = int(min(330, (zona[1] - zona[0] - 2 * G) / 3))
        alto = 3 * L + 2 * G
        y0 = zona[0] + (zona[1] - zona[0] - alto) // 2
        x_img = 150
        for i, (id_, t1, t2) in enumerate(pasos):
            img, m = celda(id_, L) if id_ else (caja_tile.resize((L, L), Image.LANCZOS), mascara_redonda(L))
            yy = y0 + i * (L + G)
            c.pegar(img, (x_img, yy), m)
            d = ImageDraw.Draw(c.im)
            d.ellipse([x_img - 44, yy + L / 2 - 30, x_img + 16, yy + L / 2 + 30], fill=ORO + (255,))
            d.text((x_img - 14, yy + L / 2), str(i + 1), font=BOLD(38), fill=FONDO + (255,), anchor='mm')
            xt = x_img + L + 40
            c.txt((xt, yy + L / 2 - 40), t1, SANSB(40), ancla='la', glow=False)
            c.txt((xt, yy + L / 2 + 14), t2, SANS(31), SUAVE, ancla='la', glow=False)
    c.pildora(c.bot - 70 - pie + 70 * s, 'Con 4 piezas, la de menor valor sale gratis', SANSB(31 * s), relleno=PLUM, color=BLANCO)
    c.firma()
    return c.guardar('V3-asi-se-arma-3-pasos')


# ── V4 · REGALO RESUELTO ──
def v4(fmt):
    W, H = FORMATOS[fmt]
    y_banda = {'1x1': 250, '4x5': 360, '9x16': 560}[fmt]
    fondo, fin = banda(CAJA, (0, 470, 1080, 1130), W, H, y_banda)
    c = Lienzo(fmt, fondo)
    s = c.s
    c.sombra(0, y_banda + 80, 160, 'arriba')
    y = c.centro(c.top + 6, 'Tú eliges los charms.', ITAL(76 * s), ORO)
    y = c.centro(y + 2, 'Nosotros lo dejamos listo', BOLD(54 * s))
    c.centro(y - 6, 'para regalar', BOLD(54 * s))
    c.sombra(fin - 160, H, 220)
    y = max(fin - 40, c.bot - 70 - round(190 * s)) if fmt != '1x1' else c.bot - 70 - round(118 * s)
    y = c.centro(y, 'Caja de regalo · Dedicatoria escrita a mano', SANSB(34 * s))
    y = c.centro(y + 4, 'Envío gratis pagando en línea', SANSB(34 * s))
    if fmt != '1x1':
        c.centro(y + 8, 'Charms en Plata 925 con sello', SANS(28), SUAVE, glow=False)
    c.firma()
    return c.guardar('V4-regalo-resuelto')


# ── V5 · PRUEBA SOCIAL: foto real de una clienta, «Arma una igual» ──
def v5(fmt):
    W, H = FORMATOS[fmt]
    caja = {'4x5': (0, 120, 720, 1020), '1x1': (0, 250, 720, 970), '9x16': (22, 0, 697, 1200)}[fmt]
    esc = W / (caja[2] - caja[0])
    c = Lienzo(fmt, recorte(CLIENTA, caja, W, H))
    s = c.s
    c.sombra(0, c.top + 280, 215, 'arriba')
    c.sombra(c.bot - round(330 * s), H, 245)
    c.pildora(c.top + 30, 'FOTO REAL DE UNA CLIENTA', SANSB(27 * s), relleno=BLANCO, color=FONDO, pad=(24, 11))
    c.centro(c.top + 70, 'Arma una igual', ITAL(84 * s), ORO)
    k = esc / 1.5 * (0.62 if fmt == '1x1' else 1)
    for (sx, sy), (dx, dy), nombre in [((200, 710), (-50, 115), 'Trébol'), ((400, 687), (10, 130), 'Herradura'),
                                       ((553, 553), (100, 110), 'Pulpo Azul')]:
        tip = ((sx - caja[0]) * esc, (sy - caja[1]) * esc)
        ini = (tip[0] + dx * k, tip[1] + dy * k)
        c.flecha(ini, tip)
        c.txt((ini[0], ini[1] + 10), nombre, SANSB(32 * s))
    if fmt == '1x1':
        y = c.bot - 70 - round(118 * s)
    else:
        y = c.bot - 70 - round(190 * s)
        y = c.tachado(y, 'Valen $348.000', SANS(34 * s))
    y = c.centro(y - 2, 'Con brazalete Corazón Liso: $270.000', BOLD(46 * s))
    c.centro(y + 6, 'o 3 cuotas de $90.000 sin interés con Addi', SANS(30 * s), SUAVE)
    c.firma()
    return c.guardar('V5-clienta-arma-una-igual')


if __name__ == '__main__':
    for fn in (v1, v2, v3, v4, v5):
        for fmt in FORMATOS:
            print(fn(fmt))
