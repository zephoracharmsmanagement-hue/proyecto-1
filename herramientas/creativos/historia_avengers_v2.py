"""Historia «Paga 4, lleva 2 gratis» · versión estudio, con las fotos de catálogo en alta (assets/hd, 1200 px,
sin grabados de marca visibles en estas seis). Las joyas se recortan del fondo blanco (relleno desde el borde,
así el plateado claro de la pieza no se pierde) y se componen sobre fondo crema con sombra suave. Sin Kie.
Precio (calcular(), origin/main 768572a, PROMO [[4,1],[6,2]]): Pulsera Avengers + Capitán América + Iron Man +
Groot + Mjolnir + Escudo = $380.000 (lista $553.000). Addi 3 × $126.667 sin interés (≤ $600.000).
Existencias 31-oct: Capitán 9, Iron Man 6, Mjolnir 6, Groot 4, Escudo 4, Pulsera Avengers tallas 18-20."""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageChops
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lote_final.py')).read().split('class Lienzo')[0])
HD = REPO + 'hd/'
W, H = 1080, 1920
TINTA, CIRUELA, ORO_OSC = (42, 31, 46), (92, 61, 99), (150, 112, 52)

def recortar(id_, semillas=(), casi_blanco=False, piso=0.0, modo='sinsat'):
    im = Image.open(HD + id_ + '.webp').convert('RGB')
    # fondo = blanco conectado al borde (no el plateado de la pieza)
    marca = im.copy()
    for xy in [(0, 0), (im.width - 1, 0), (0, im.height - 1), (im.width - 1, im.height - 1)] + list(semillas):
        ImageDraw.floodfill(marca, xy, (255, 0, 255), thresh=40)
    r, g, b = marca.split()
    fondo = ImageChops.multiply(ImageChops.invert(g).point(lambda v: 255 if v > 250 else 0), r.point(lambda v: 255 if v > 250 else 0))
    alfa = ImageChops.invert(fondo).filter(ImageFilter.GaussianBlur(1.2))
    if casi_blanco:   # reflejos de estudio que trae la foto del proveedor (bajo el cierre)
        r0, g0, b0 = im.split()
        mn = ImageChops.darker(ImageChops.darker(r0, g0), b0)
        alfa = ImageChops.multiply(alfa, mn.point(lambda v: 0 if v > 236 else 255).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1)))
    alfa = alfa.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))   # sin halo blanco
    out = im.convert('RGBA'); out.putalpha(alfa)
    out = out.crop(out.getbbox())
    if casi_blanco:   # el reflejo gris claro bajo el cierre: franja inferior, tonos sin color
        px, (w, h) = out.load(), out.size
        for y in range(int(h * 0.80), h):
            for x in range(int(w * 0.18), int(w * 0.52)):
                r_, g_, b_, a_ = px[x, y]
                if a_ and min(r_, g_, b_) > 175 and max(r_, g_, b_) - min(r_, g_, b_) < 16:
                    px[x, y] = (r_, g_, b_, 0)
        out = out.crop(out.getbbox())
    if piso:   # sombra o reflejo de estudio bajo la pieza: franja inferior, tonos sin color
        px, (w, h) = out.load(), out.size
        for y in range(int(h * (1 - piso)), h):
            for x in range(w):
                r_, g_, b_, a_ = px[x, y]
                if not a_:
                    continue
                gris = max(r_, g_, b_) - min(r_, g_, b_) < 22
                if modo == 'todo' or (gris and (modo == 'sinsat' or min(r_, g_, b_) > 190)):
                    px[x, y] = (r_, g_, b_, 0)
        a = out.split()[3].filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))  # quita motas sueltas
        out.putalpha(a)
        out = out.crop(out.getbbox())
    return out

def poner(lienzo, pieza, cx, cy, alto, sombra=True):
    p = pieza.resize((round(pieza.width * alto / pieza.height), alto), Image.LANCZOS)
    x, y = int(cx - p.width / 2), int(cy - p.height / 2)
    if sombra:
        s = Image.new('RGBA', lienzo.size, (0, 0, 0, 0))
        a = p.split()[3].point(lambda v: v * 0.38)
        s.paste((60, 40, 50, 255), (x + 10, y + 22), a)
        lienzo.alpha_composite(s.filter(ImageFilter.GaussianBlur(16)))
    lienzo.alpha_composite(p, (x, y))

# fondo crema con luz al centro
fondo = Image.new('RGB', (W, H), (226, 214, 204))
luz = Image.new('L', (W, H), 0); ImageDraw.Draw(luz).ellipse([-200, 300, W + 200, 1500], fill=255)
fondo = Image.composite(Image.new('RGB', (W, H), (246, 240, 234)), fondo, luz.filter(ImageFilter.GaussianBlur(260)))
c = fondo.convert('RGBA')
d = ImageDraw.Draw(c)

d.text((W / 2, 262), 'Paga 4,', font=ITAL(104), fill=ORO_OSC + (255,), anchor='mt')
d.text((W / 2, 380), 'lleva 2 gratis', font=BOLD(92), fill=TINTA + (255,), anchor='mt')
d.text((W / 2, 506), 'Arma tu pulsera Avengers', font=SANS(34), fill=CIRUELA + (255,), anchor='mt')

brz = Image.open(HD + 'pulsera-avengers.webp')
poner(c, recortar('pulsera-avengers', [(brz.width // 2, brz.height // 2 - 20), (brz.width // 2 + 200, brz.height // 2), (brz.width // 2 - 250, brz.height // 2)], casi_blanco=True), W / 2, 720, 330)
heroes = [('capitan-america', 'Capitán América', 240, 0.10, 'sinsat'), ('iron-man', 'Iron Man', 240, 0.10, 'sinsat'),
          ('groot-bebe', 'Groot', 200, 0.075, 'todo'), ('mjolnir-martillo-de-thor', 'Mjolnir', 255, 0.06, 'claro'),
          ('escudo-capitan-america', 'Escudo', 245, 0.05, 'sinsat')]
xs = [140, 330, 540, 750, 945]
for (id_, n, alto, piso, modo), x in zip(heroes, xs):
    poner(c, recortar(id_, piso=piso, modo=modo), x, 1035, alto)
    d.text((x, 1185), n, font=SANSB(26), fill=TINTA + (255,), anchor='mt')

# bloque de precio
y = 1248
f = SANS(36); t = 'Pulsera + 5 héroes: $553.000'
w = d.textlength(t, font=f)
d.text((W / 2, y), t, font=f, fill=(140, 128, 134, 255), anchor='mt')
d.line([(W / 2 - w / 2 - 6, y + 24), (W / 2 + w / 2 + 6, y + 24)], fill=(140, 128, 134, 255), width=3)
d.text((W / 2, y + 44), 'Pagas $380.000', font=BOLD(88), fill=TINTA + (255,), anchor='mt')
pill = 'La pulsera y un héroe te salen gratis'
fw = d.textlength(pill, font=SANSB(32))
d.rounded_rectangle([W / 2 - fw / 2 - 30, y + 152, W / 2 + fw / 2 + 30, y + 208], radius=30, fill=CIRUELA + (255,))
d.text((W / 2, y + 180), pill, font=SANSB(32), fill=(255, 255, 255, 255), anchor='mm')
d.text((W / 2, y + 224), 'o 3 cuotas de $126.667 sin interés con Addi', font=SANS(28), fill=CIRUELA + (255,), anchor='mt')
d.text((W / 2, 1530), 'Zephora Charms', font=FIRMA(52), fill=TINTA + (255,), anchor='mt')
p = BASE + '/historias/P-avengers-paga-4-lleva-2-estudio.jpg'
c.convert('RGB').save(p, quality=95); print(p)
