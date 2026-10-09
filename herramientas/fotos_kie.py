"""Fotos de producto en alta: centrar + fondo blanco (local, gratis) y nitidez
con Recraft Crisp Upscale de Kie (×2, 0,5 créditos, sin redibujar la joya).

Topaz (topaz/image-upscale) se probó el 2026-10-09 y Kie devolvía «internal
error» con cualquier imagen —incluso servida desde la tienda—; los fallos no
cobran. Recraft dio el mismo dibujo, más nítido, por 0,5 créditos.

    python herramientas/fotos_kie.py spider-man letra-m        # solo esos ids
    python herramientas/fotos_kie.py --solo-local spider-man   # sin gastar créditos
    python herramientas/fotos_hd.py                            # después: a assets/ y assets/hd/

OJO: lee la foto de assets/<foto>.webp. Desde el 2026-10-09 esas ya son las
mejoradas (600 px); este paso es para fotos NUEVAS que entren a 440 px sin
versión de Flow. Volver a pasar una ya mejorada solo la ampliaría otra vez.

Registro (registro.json, junto a este archivo): cada foto queda anotada con
el hash del original. Si ya salió bien con ese mismo original, NO se vuelve a
mandar a Kie: así un corte a mitad de camino o una segunda corrida no cobran
dos veces. La clave de Kie se lee de C:\\Users\\Martin\\anuncios-zephora\\.env y
nunca se imprime.
"""
import hashlib, io, json, os, sys, time, urllib.request
from PIL import Image, ImageDraw, ImageFilter

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
_REPO = RAIZ if os.path.isdir(os.path.join(RAIZ, 'material-sin-publicar')) else r'C:\Users\Martin\projects\proyecto-1'
AQUI = os.path.join(_REPO, 'material-sin-publicar', 'fotos-hd')    # registro, local/ y salida/ (fuera del repo)
ASSETS = os.path.join(RAIZ, 'assets')
SALIDA = os.path.join(AQUI, 'salida')
LOCAL = os.path.join(AQUI, 'local')
REG = os.path.join(AQUI, 'registro.json')
LADO_FINAL = 1200
# Fotos con fondo gris donde la joya tiene partes pálidas del mismo tono: el
# blanqueo del fondo se las comía (2026-10-09, la piedra luna de la Luciérnaga).
# Se centran y amplían igual, pero conservan su fondo original.
SIN_BLANQUEAR = {'luciernaga-you-are-my-light.webp'}
OCUPA = 0.90          # el lado largo de la joya ocupa el 90 % del cuadro (pedido del propietario, 2026-10-09)
LIENZO = 600          # el lienzo local; Recraft lo duplica → 1200 px, el tamaño final
KIE = 'https://api.kie.ai/api/v1'
SUBIDA = 'https://kieai.redpandaai.co/api/file-stream-upload'


def clave():
    for l in open(r'C:\Users\Martin\anuncios-zephora\.env', encoding='utf-8'):
        if l.startswith('KIE_API_KEY='):
            return l.split('=', 1)[1].strip().strip('"')
    raise SystemExit('No hay KIE_API_KEY')


def registro():
    return json.load(open(REG, encoding='utf-8')) if os.path.exists(REG) else {}


def guardar_registro(r):
    json.dump(r, open(REG, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)


def fondo_blanco(im, tol=28):
    """Pone en blanco puro solo el fondo que toca el borde (relleno por
    inundación desde las esquinas): los brillos plateados DENTRO de la joya no
    se tocan aunque sean casi blancos."""
    im = im.convert('RGB')
    marca = (255, 0, 255)
    trabajo = im.copy()
    w, h = trabajo.size
    for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        if trabajo.getpixel(xy) != marca:
            ImageDraw.floodfill(trabajo, xy, marca, thresh=tol)
    m = Image.new('L', (w, h), 0)
    mp, tp = m.load(), trabajo.load()
    for y in range(h):
        for x in range(w):
            if tp[x, y] == marca:
                mp[x, y] = 255
    m = m.filter(ImageFilter.GaussianBlur(0.8))       # borde suave, sin serrucho
    blanco = Image.new('RGB', (w, h), (255, 255, 255))
    return Image.composite(blanco, im, m), m


def normalizar(origen, blanquear=True):
    """Centra la joya y le da la misma escala en todas las fotos. Nada de IA."""
    im = Image.open(origen).convert('RGB')
    limpio, mfondo = fondo_blanco(im)
    if not blanquear:
        # Ni se recorta: la parte pálida no se distingue del fondo y quedaría
        # fuera de la caja. Se amplía el encuadre original tal cual.
        return im.resize((LIENZO, LIENZO), Image.LANCZOS)
    caja = Image.eval(mfondo, lambda v: 255 - v).point(lambda v: 255 if v > 128 else 0).getbbox()
    if not caja:
        raise ValueError('no se encontró la joya')
    x0, y0, x1, y1 = caja
    pieza = limpio.crop(caja)
    lado = int(max(x1 - x0, y1 - y0) / OCUPA)
    color = (255, 255, 255) if blanquear else im.getpixel((2, 2))
    lienzo = Image.new('RGB', (lado, lado), color)
    lienzo.paste(pieza, ((lado - (x1 - x0)) // 2, (lado - (y1 - y0)) // 2))
    return lienzo.resize((LIENZO, LIENZO), Image.LANCZOS)


def subir(png, k):
    limite = '----zephora' + str(int(time.time() * 1000))
    cuerpo = io.BytesIO()
    def campo(n, v):
        cuerpo.write(f'--{limite}\r\nContent-Disposition: form-data; name="{n}"\r\n\r\n{v}\r\n'.encode())
    campo('uploadPath', 'zephora-fotos-hd')
    cuerpo.write(f'--{limite}\r\nContent-Disposition: form-data; name="file"; filename="{os.path.basename(png)}"\r\n'
                 f'Content-Type: image/png\r\n\r\n'.encode())
    cuerpo.write(open(png, 'rb').read()); cuerpo.write(f'\r\n--{limite}--\r\n'.encode())
    req = urllib.request.Request(SUBIDA, data=cuerpo.getvalue(), method='POST',
                                 headers={'Authorization': 'Bearer ' + k,
                                          'Content-Type': 'multipart/form-data; boundary=' + limite})
    d = json.load(urllib.request.urlopen(req, timeout=60))
    url = (d.get('data') or {}).get('downloadUrl') or (d.get('data') or {}).get('fileUrl')
    if not url:
        raise RuntimeError('subida sin URL: ' + str(d)[:200])
    return url


def kie(metodo, ruta, k, cuerpo=None):
    req = urllib.request.Request(KIE + ruta, method=metodo,
                                 data=json.dumps(cuerpo).encode() if cuerpo else None,
                                 headers={'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(req, timeout=60))


def ampliar(url, k):
    d = kie('POST', '/jobs/createTask', k, {'model': 'recraft/crisp-upscale', 'input': {'image': url}})
    tarea = (d.get('data') or {}).get('taskId')
    if not tarea:
        raise RuntimeError('Kie no dio taskId: ' + str(d)[:200])
    for _ in range(120):
        time.sleep(5)
        e = (kie('GET', '/jobs/recordInfo?taskId=' + tarea, k).get('data') or {})
        if e.get('state') == 'success':
            return tarea, json.loads(e['resultJson'])['resultUrls'][0], e.get('creditsConsumed')
        if e.get('state') == 'fail':
            raise RuntimeError(f"Recraft falló: {e.get('failMsg')}")
    raise RuntimeError('Recraft no terminó en 10 minutos')


def procesar(pid, foto, reg, solo_local, k):
    origen = os.path.join(ASSETS, foto)
    sha = hashlib.sha256(open(origen, 'rb').read()).hexdigest()[:16]
    previo = reg.get(foto)
    if previo and previo.get('sha') == sha and previo.get('ocupa') == OCUPA and previo.get('estado') == 'listo':
        print(f'  {pid}: ya estaba listo, no se cobra otra vez')
        return
    os.makedirs(LOCAL, exist_ok=True); os.makedirs(SALIDA, exist_ok=True)
    nombre = os.path.splitext(foto)[0]
    local_png = os.path.join(LOCAL, nombre + '.png')
    normalizar(origen, foto not in SIN_BLANQUEAR).save(local_png)
    reg[foto] = {'id': pid, 'sha': sha, 'ocupa': OCUPA, 'estado': 'local', 'local': os.path.relpath(local_png, AQUI)}
    guardar_registro(reg)
    if solo_local:
        print(f'  {pid}: normalizada (sin Kie)')
        return
    url = subir(local_png, k)
    tarea, resultado, creditos = ampliar(url, k)
    reg[foto].update({'estado': 'ampliada', 'tarea': tarea, 'creditos': creditos})
    guardar_registro(reg)
    grande = Image.open(io.BytesIO(urllib.request.urlopen(resultado, timeout=120).read())).convert('RGB')
    grande = grande.resize((LADO_FINAL, LADO_FINAL), Image.LANCZOS)
    if foto not in SIN_BLANQUEAR:
        grande, _ = fondo_blanco(grande, tol=18)      # el escalado puede teñir el blanco
    destino = os.path.join(SALIDA, nombre + '.webp')
    grande.save(destino, quality=88, method=6)
    reg[foto].update({'estado': 'listo', 'salida': os.path.relpath(destino, AQUI), 'cuando': time.strftime('%Y-%m-%d %H:%M')})
    guardar_registro(reg)
    print(f'  {pid}: listo · {creditos} créditos · tarea {tarea}')


def main():
    args = sys.argv[1:]
    solo_local = '--solo-local' in args
    args = [a for a in args if not a.startswith('--')] if '--todas' not in sys.argv else None
    cat = json.load(open(os.path.join(ASSETS, 'catalogo.json'), encoding='utf-8'))
    ids = args if args is not None else list(cat['fotos'])
    reg = registro()
    k = None if solo_local else clave()
    hechas = set()
    for pid in ids:
        foto = cat['fotos'].get(pid)
        if not foto:
            print(f'  {pid}: no está en el catálogo'); continue
        if foto in hechas:
            print(f'  {pid}: comparte foto con otro producto, ya procesada'); continue
        hechas.add(foto)
        try:
            procesar(pid, foto, reg, solo_local, k)
        except Exception as e:
            reg.setdefault(foto, {})['error'] = str(e)[:300]
            guardar_registro(reg)
            print(f'  {pid}: ERROR {e}')


if __name__ == '__main__':
    main()
