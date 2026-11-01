"""3 historias de Instagram para el 2026-10-31, en 9:16.
Existencias (hoja «Inventario de movimientos», 31-oct): Atrapasueños 7, Esfera Azul 5, Flor Azul 4,
Sol y Luna 4, Pulpo 4, Herradura 4, Trébol 3, Corazón Liso 4+. Sin Luciérnaga (quedó en 1).
Precios con calcular() de origin/main 768572a (PROMO [[4,1],[6,2]]):
  Atrapasueños + Esfera + Flor + Sol y Luna = $246.000 (lista $328.000, una gratis)
  Corazón Liso + Trébol + Herradura + Pulpo = $270.000 (lista $348.000)"""
import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lote_final.py')).read().split("if __name__ == '__main__':")[0])
CENTROS.update({'sol-y-luna-con-cristales': (231, 330, 130)})
OUT2 = BASE + '/historias-31oct'
os.makedirs(OUT2, exist_ok=True)

def guardar(c, n):
    p = f'{OUT2}/{n}.jpg'; c.im.convert('RGB').save(p, quality=94, subsampling=0); print(p)

# H1 · Quincena + promo
c = Lienzo('9x16')
y = c.centro(c.top + 10, 'Llegó la quincena', ITAL(88), ORO)
y = c.centro(y, 'y tu pulsera lo sabe', BOLD(58))
L, G = 380, 24
x0 = (c.W - 2 * L - G) // 2
for i, (id_, n) in enumerate([('atrapasuenos-azul', 'Atrapasueños'), ('esfera-azul-con-cristales', 'Esfera Azul'),
                              ('flor-azul-con-cristales', 'Flor Azul'), ('sol-y-luna-con-cristales', 'Sol y Luna')]):
    img, m = celda(id_, L); x = x0 + (i % 2) * (L + G); yy = y + 40 + (i // 2) * (L + 60)
    c.pegar(img, (x, yy), m); c.txt((x + L / 2, yy + L + 10), n, SANS(30), SUAVE, glow=False)
y = y + 40 + 2 * (L + 60) + 10
y = c.tachado(y, 'Los 4: $328.000', SANS(38))
y = c.centro(y, 'Pagas $246.000', BOLD(80))
c.centro(y + 6, 'Lleva 4, paga 3 · Envío gratis pagando en línea', SANS(30), SUAVE, glow=False)
guardar(c, 'H1-quincena-lleva-4-paga-3')

# H2 · Encuesta (espacio libre para el sticker de encuesta)
c = Lienzo('9x16')
y = c.centro(c.top + 10, '¿Cuál le pones', ITAL(92), ORO)
y = c.centro(y - 6, 'a tu pulsera?', ITAL(92), ORO)
L, G = 470, 20
x0 = (c.W - 2 * L - G) // 2
for i, (id_, n) in enumerate([('atrapasuenos-azul', 'Atrapasueños Azul'), ('esfera-azul-con-cristales', 'Esfera Azul')]):
    img, m = celda(id_, L); x = x0 + i * (L + G)
    c.pegar(img, (x, y + 50), m); c.txt((x + L / 2, y + 50 + L + 14), n, SANSB(36), glow=False)
c.centro(c.bot - 300, 'Vota aquí abajo', SANS(32), GRIS, glow=False)
c.centro(c.bot - 56, 'Charms en Plata 925 con sello', SANS(28), SUAVE, glow=False)
guardar(c, 'H2-encuesta-cual-le-pones')

# H3 · Clienta real + enlace (espacio libre para el sticker de enlace)
caja = (22, 0, 697, 1200); esc = 1080 / (caja[2] - caja[0])
c = Lienzo('9x16', recorte(CLIENTA, caja, 1080, 1920))
c.sombra(0, c.top + 300, 215, 'arriba'); c.sombra(1220, 1920, 252)
c.pildora(c.top + 30, 'FOTO REAL DE UNA CLIENTA', SANSB(27), relleno=BLANCO, color=FONDO, pad=(24, 11))
c.centro(c.top + 70, 'Así la armó ella', ITAL(86), ORO)
for (sx, sy), (dx, dy), n in [((200, 710), (-50, 115), 'Trébol'), ((400, 687), (10, 130), 'Herradura'), ((553, 553), (100, 110), 'Pulpo Azul')]:
    tip = ((sx - caja[0]) * esc, (sy - caja[1]) * esc); ini = (tip[0] + dx, tip[1] + dy)
    c.flecha(ini, tip); c.txt((ini[0], ini[1] + 10), n, SANSB(34))
y = c.tachado(1372, 'Valen $348.000', SANS(36))
y = c.centro(y, 'Con brazalete Corazón Liso: $270.000', BOLD(48))
c.centro(y + 8, 'Toca el enlace y arma la tuya', SANS(34), SUAVE)
guardar(c, 'H3-clienta-arma-la-tuya')
