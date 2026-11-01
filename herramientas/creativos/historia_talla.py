"""Historia «¿Qué talla es la mía?». Fuente: guía de tallas de index.html (origin/main 2026-10-31):
muñeca ajustada sin apretar + 2 cm (espacio que ocupan los charms); tallas 17-21; cambio de talla 5 días hábiles."""
import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lote_final.py')).read().split("if __name__ == '__main__':")[0])
c = Lienzo('9x16')
y = c.centro(c.top + 10, '¿Qué talla', ITAL(96), ORO)
y = c.centro(y - 8, 'es la mía?', ITAL(96), ORO)
L = 290
img, m = celda('pulsera-corona-pave', L); c.pegar(img, ((c.W - L) // 2, y + 30), m)
y += 30 + L + 50
d = ImageDraw.Draw(c.im)
for n, t1, t2 in [(1, 'Mide tu muñeca', 'Ajustada, sin apretar. Con cinta métrica, o con una tira de papel y una regla.'),
                  (2, 'Súmale 2 cm', 'Es el espacio que ocupan tus charms para que cierre cómoda.'),
                  (3, 'Esa es tu talla', 'Ejemplo: muñeca de 16 cm → talla 18.')]:
    d.ellipse([110, y, 176, y + 66], fill=ORO + (255,))
    d.text((143, y + 33), str(n), font=BOLD(40), fill=FONDO + (255,), anchor='mm')
    c.txt((206, y + 2), t1, SANSB(42), ancla='la', glow=False)
    # texto de apoyo partido a mano en líneas cortas
    f = SANS(30); palabras, linea, yy = t2.split(), '', y + 58
    for w in palabras:
        if d.textlength((linea + ' ' + w).strip(), font=f) > 760:
            c.txt((206, yy), linea, f, SUAVE, ancla='la', glow=False); yy += 40; linea = w
        else:
            linea = (linea + ' ' + w).strip()
    c.txt((206, yy), linea, f, SUAVE, ancla='la', glow=False)
    y = yy + 70
c.pildora(y + 20, 'Tallas de 17 a 21', SANSB(34), relleno=PLUM, color=BLANCO)
c.centro(y + 80, '¿No te quedó? Tienes 5 días hábiles para cambiarla.', SANS(30), SUAVE, glow=False)
c.firma()
os.makedirs(BASE + '/historias', exist_ok=True)
p = BASE + '/historias/T-que-talla-es-la-mia.jpg'; c.im.convert('RGB').save(p, quality=94); print(p)
