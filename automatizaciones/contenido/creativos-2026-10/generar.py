"""Creativos Marvel y Color (octubre 2026): escena de estudio con Kie y texto encima.

Kie (Nano Banana Edit) recibe la FOTO REAL de la pulsera y solo cambia el
fondo y la luz. Regla de oro de BRIEF-FLOW.md: «No se modifica la joya. Ni los
jumps, ni el brazalete.» Una imagen que cambie una pieza se descarta: por eso
el script deja al lado de cada resultado la foto real, para compararlas.

El texto (título, botón, marca) NO lo escribe la IA: lo pone `componer` con la
misma tipografía de los anuncios ganadores, y así las tildes salen bien.

    python generar.py --solo-componer      # prueba el texto sobre las fotos reales, sin Kie
    python generar.py marvel color         # genera con Kie (cobra créditos) y compone
    python generar.py marvel --intentos 2  # dos tiradas por formato (por defecto 1)

La clave se lee de KIE_API_KEY o de C:\\Users\\Martin\\anuncios-zephora\\.env y nunca
se imprime. Lo generado va a material-sin-publicar/ (fuera de git). El registro
evita volver a cobrar una tirada que ya salió bien.
"""
import io, json, os, sys, time, urllib.request
from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..', '..'))
SALIDA = os.path.join(RAIZ, 'material-sin-publicar', 'creativos-2026-10')
FUENTES = os.path.join(SALIDA, 'fuentes')
REG = os.path.join(SALIDA, 'registro.json')
KIE = 'https://api.kie.ai/api/v1'
MODELO = 'google/nano-banana-edit'
RAMA = 'claude/creativos-marvel-color'
REF_URL = ('https://raw.githubusercontent.com/zephoracharmsmanagement-hue/proyecto-1/'
           + RAMA + '/automatizaciones/contenido/creativos-2026-10/referencias/{}.jpg')
FORMATOS = {'feed': ('4:5', (1080, 1350)), 'historia': ('9:16', (1080, 1920))}

CREMA, TINTA, ROSA = (250, 244, 236), (43, 26, 36), (232, 160, 180)

REGLA = ('Use the attached photo as the exact product. Keep the bracelet and all charms identical '
         'to the reference: {piezas} Do not redraw, restyle, resize, add or remove any charm; keep '
         'every enamel color, stone and silver detail exactly as in the photo. ')
CIERRE = ('The bracelet lies flat, centered in the lower two thirds of the frame. Leave the top '
          'quarter of the image as empty {tono} background for a headline. No text, no letters, '
          'no logos added, no watermark, no extra bracelets, no hands.')

PIEZAS = {
    'marvel': {
        'ref': 'marvel',
        'prompt': REGLA.format(piezas=(
            'the same snake-chain bracelet with the Avengers logo clasp, and the same charms in the '
            'same order (baby Groot, Iron Man helmet, the hanging pavé Spider-Man, the red Spider-Man '
            'web bead, Captain America).'))
            + ('Replace only the setting: a luxury jewelry still life on polished black marble with '
               'fine gold veins, two deep plum velvet jewelry boxes softly out of focus behind it, and '
               'dark plum velvet curtains in the background. Soft studio spotlight from above, subtle '
               'reflection of the bracelet on the marble, rich contrast, high-end editorial product '
               'photography, macro lens look, shallow depth of field. ')
            + CIERRE.format(tono='dark'),
        'titulo': ['Arma tu equipo', 'de héroes'], 'boton': 'Regala a su héroe', 'oscuro': True,
    },
    'color': {
        'ref': 'color',
        'prompt': REGLA.format(piezas=(
            'the same snake-chain bracelet with the pavé heart clasp, and the same charms in the same '
            'order: the pink carousel, the blue dreamcatcher with three blue feathers, the heart with '
            'the hummingbird and multicolor stones, the green four-leaf clover pendant, and the '
            'multicolor heart dreamcatcher with pink feathers.'))
            + ('Replace only the setting: white Carrara marble surface with soft blush-pink silk '
               'draped behind, a few loose rose petals, bright soft window daylight, airy and luminous, '
               'the colored stones catching small sparkles of light, high-end editorial jewelry '
               'photography, macro lens look, shallow depth of field. ')
            + CIERRE.format(tono='light'),
        # «Colección Amuletos» (propietario, 2026-10-29): se vende por el significado
        # de las piezas, no por la piedra. Son circonias, no circones ni piedras
        # preciosas, y el trébol es otra piedra: el anuncio no nombra el material.
        'titulo': ['Amuletos para', 'tu buena suerte'], 'boton': 'Arma la tuya', 'oscuro': False,
    },
    'color-regalo': {
        'ref': 'color',
        'prompt': REGLA.format(piezas='the same bracelet with the pavé heart clasp and the same five charms in the same order.')
            + ('Replace only the setting: warm beige linen fabric, a torn-edge cream paper card beside '
               'the bracelet with blank space (no writing), soft late-afternoon golden light, cozy and '
               'intimate gift moment, editorial still life. ')
            + CIERRE.format(tono='light'),
        'titulo': ['Lista para', 'regalar'], 'boton': 'Arma la suya', 'oscuro': False,
    },
}


# ---------- Kie ----------

def clave():
    if os.environ.get('KIE_API_KEY'):
        return os.environ['KIE_API_KEY'].strip()
    for l in open(r'C:\Users\Martin\anuncios-zephora\.env', encoding='utf-8'):
        if l.startswith('KIE_API_KEY='):
            return l.split('=', 1)[1].strip().strip('"')
    raise SystemExit('No hay KIE_API_KEY')


def kie(metodo, ruta, k, cuerpo=None):
    req = urllib.request.Request(KIE + ruta, method=metodo,
                                 data=json.dumps(cuerpo).encode() if cuerpo else None,
                                 headers={'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(req, timeout=60))


def generar(pieza, relacion, k):
    d = kie('POST', '/jobs/createTask', k, {'model': MODELO, 'input': {
        'prompt': PIEZAS[pieza]['prompt'], 'image_urls': [REF_URL.format(PIEZAS[pieza]['ref'])],
        'output_format': 'png', 'image_size': relacion}})
    tarea = (d.get('data') or {}).get('taskId')
    if not tarea:
        raise RuntimeError('Kie no dio taskId: ' + str(d)[:300])
    for _ in range(120):
        time.sleep(5)
        e = kie('GET', '/jobs/recordInfo?taskId=' + tarea, k).get('data') or {}
        if e.get('state') == 'success':
            return tarea, json.loads(e['resultJson'])['resultUrls'][0], e.get('creditsConsumed')
        if e.get('state') == 'fail':
            raise RuntimeError('Kie falló: ' + str(e.get('failMsg')))
    raise RuntimeError('Kie no terminó en 10 minutos')


# ---------- Texto encima ----------

def fuente(nombre, tam, peso):
    os.makedirs(FUENTES, exist_ok=True)
    ruta = os.path.join(FUENTES, nombre + '.ttf')
    if not os.path.exists(ruta):
        url = {'PlayfairDisplay': 'ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf',
               'DMSans': 'ofl/dmsans/DMSans%5Bopsz,wght%5D.ttf'}[nombre]
        urllib.request.urlretrieve('https://raw.githubusercontent.com/google/fonts/main/' + url, ruta)
    f = ImageFont.truetype(ruta, tam)
    try:
        f.set_variation_by_axes([peso] if nombre == 'PlayfairDisplay' else [14, peso])
    except Exception:
        pass
    return f


def cubrir(im, W, H):
    w, h = im.size
    if w / h > W / H:
        nw = int(h * W / H); x = (w - nw) // 2; im = im.crop((x, 0, x + nw, h))
    else:
        nh = int(w * H / W); y = (h - nh) // 2; im = im.crop((0, y, w, y + nh))
    return im.resize((W, H), Image.LANCZOS)


def componer(base, pieza, W, H):
    p = PIEZAS[pieza]
    im = cubrir(base.convert('RGB'), W, H)
    d = ImageDraw.Draw(im)
    texto = CREMA if p['oscuro'] else TINTA
    tf = fuente('PlayfairDisplay', int(W * 0.095), 500)
    y = int(H * 0.06)
    for linea in p['titulo']:
        tw = d.textlength(linea, font=tf)
        d.text(((W - tw) / 2, y), linea, font=tf, fill=texto)
        y += int(W * 0.11)
    bf = fuente('DMSans', int(W * 0.042), 500)
    bw = d.textlength(p['boton'], font=bf) + int(W * 0.13); bh = int(W * 0.095)
    bx, by = (W - bw) / 2, H - bh - int(H * 0.085)
    d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=bh / 2, fill=ROSA, outline=TINTA, width=2)
    d.text((W / 2, by + bh / 2), p['boton'], font=bf, fill=TINTA, anchor='mm')
    mf = fuente('PlayfairDisplay', int(W * 0.036), 500)
    d.text((W / 2, H - int(H * 0.04)), 'Zephora Charms', font=mf, fill=texto, anchor='mm')
    return im


def guardar(im, ruta):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    im.save(ruta, quality=92)
    print('   ', os.path.relpath(ruta, RAIZ))


def comparacion(real, generada, ruta):
    """Foto real al lado de la generada, misma altura, para revisar pieza por pieza."""
    h = 1200
    a = real.resize((int(real.width * h / real.height), h))
    b = generada.resize((int(generada.width * h / generada.height), h))
    c = Image.new('RGB', (a.width + b.width + 20, h), 'white')
    c.paste(a, (0, 0)); c.paste(b, (a.width + 20, 0))
    guardar(c, ruta)


def main():
    args = sys.argv[1:]
    intentos = int(args[args.index('--intentos') + 1]) if '--intentos' in args else 1
    solo = '--solo-componer' in args
    piezas = [a for a in args if a in PIEZAS] or ['marvel', 'color']
    reg = json.load(open(REG, encoding='utf-8')) if os.path.exists(REG) else {}
    k = None if solo else clave()
    for pieza in piezas:
        real = Image.open(os.path.join(AQUI, 'referencias', PIEZAS[pieza]['ref'] + '.jpg')).convert('RGB')
        for nombre, (relacion, (W, H)) in FORMATOS.items():
            if solo:
                print(f'{pieza} · {nombre} (foto real, sin Kie)')
                guardar(componer(real, pieza, W, H), os.path.join(SALIDA, 'prueba', f'{pieza}-{nombre}.jpg'))
                continue
            for n in range(1, intentos + 1):
                clave_reg = f'{pieza}-{nombre}-{n}'
                cruda = os.path.join(SALIDA, 'crudas', clave_reg + '.png')
                if reg.get(clave_reg, {}).get('estado') == 'listo' and os.path.exists(cruda):
                    print(f'{clave_reg}: ya estaba, no se cobra otra vez')
                else:
                    print(f'{clave_reg}: generando con Kie…')
                    try:
                        tarea, url, creditos = generar(pieza, relacion, k)
                    except Exception as e:
                        reg[clave_reg] = {'estado': 'error', 'error': str(e)[:300]}
                        json.dump(reg, open(REG, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
                        print('   ERROR', e); continue
                    os.makedirs(os.path.dirname(cruda), exist_ok=True)
                    open(cruda, 'wb').write(urllib.request.urlopen(url, timeout=120).read())
                    reg[clave_reg] = {'estado': 'listo', 'tarea': tarea, 'creditos': creditos,
                                      'cuando': time.strftime('%Y-%m-%d %H:%M')}
                    json.dump(reg, open(REG, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
                    print(f'   {creditos} créditos · tarea {tarea}')
                gen = Image.open(cruda).convert('RGB')
                comparacion(real, gen, os.path.join(SALIDA, 'revisar', clave_reg + '-real-vs-ia.jpg'))
                guardar(componer(gen, pieza, W, H), os.path.join(SALIDA, 'finales', clave_reg + '.jpg'))


if __name__ == '__main__':
    main()
