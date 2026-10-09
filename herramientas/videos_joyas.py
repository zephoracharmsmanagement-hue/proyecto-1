"""Videos de cada joya para la galería de su ficha (pedido del propietario,
2026-10-01).

    python herramientas/videos_joyas.py            # arma lo que falte
    python herramientas/videos_joyas.py hulk aries # solo esas

Lee herramientas/videos_joyas.json (id del catálogo → clips IMG_*.MOV del
celular) y por cada joya deja:

  · material-sin-publicar/videos-joyas/web/joya-<id>-v3.mp4 — vertical 4:5,
    720 × 900 (recorte centrado: la joya va en el centro del plato), H.264,
    sin audio, 30 fps, +faststart. Estabilizado antes de recortar (vidstab, dos
    pasadas): quita el temblor del pulso y conserva el giro lento alrededor de
    la pieza. Dos clips (frente y reverso) se estabilizan por separado y se unen
    con un fundido de 0,4 s. Se suben a Netlify Blobs con
    herramientas/subir_media.mjs: los videos no van a git.
  · assets/vid-<id>.webp — la portada, 440 × 550, de un cuadro del propio video.

v1 (2026-10-01) era cuadrado y sin estabilizar; el propietario pidió todo
vertical y quitar el temblor (2026-10-01). v3 (2026-10-02) endereza los 13
grabados con el celular de lado («giro» en el .json: la joya quedaba acostada
aunque el cuadro fuera vertical); los demás son el mismo v2 con otro nombre.
Las claves de Blobs no se pisan: cambiar el video es subir otra versión.

La joya no se toca: ni filtros de color ni retoque; estabilizar mueve el
cuadro entero, no la pieza.
"""
import json, pathlib, re, subprocess, sys
import imageio_ffmpeg
from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parent.parent
REPO = RAIZ if (RAIZ / 'material-sin-publicar').exists() else pathlib.Path(r'C:\Users\Martin\projects\proyecto-1')
SRC = REPO / 'material-sin-publicar' / 'videos-joyas' / 'originales' / 'Videos pagina web'
WEB = REPO / 'material-sin-publicar' / 'videos-joyas' / 'web'
ASSETS = RAIZ / 'assets'
FF = imageio_ffmpeg.get_ffmpeg_exe()
ANCHO, ALTO, FPS, FUNDIDO, CRF = 720, 900, 30, 0.4, 27
VERSION = 'v3'
GIRO = {'horario': 'transpose=1,', 'antihorario': 'transpose=2,'}
# Temblor de pulso, no el movimiento buscado: ~0,7 s de suavizado a cada lado
# y el acercamiento justo para que no asomen bordes negros (optzoom=1).
DETECTA = 'vidstabdetect=shakiness=6:accuracy=12:result={trf}'
CORRIGE = 'vidstabtransform=input={trf}:smoothing=20:optzoom=1:interpol=bicubic'


def duracion(ruta):
    r = subprocess.run([FF, '-hide_banner', '-i', str(ruta)], capture_output=True, text=True, encoding='utf-8', errors='replace').stderr
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', r)
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])


def clips(lista):
    out = []
    for c in lista:
        c = {'clip': c} if isinstance(c, str) else c
        ruta = SRC / (c['clip'] + '.MOV')
        d = duracion(ruta)
        desde, hasta = c.get('desde', 0), min(c.get('hasta', d), d)
        out.append((ruta, desde, hasta - desde, GIRO.get(c.get('giro'), '')))
    return out


def armar(pid, lista):
    sal = WEB / f'joya-{pid}-{VERSION}.mp4'
    if sal.exists():
        return sal
    cs = clips(lista)
    # Primera pasada de vidstab, un archivo de movimientos por clip. Se corre
    # desde WEB con nombre relativo: la ruta de Windows lleva «:» y el filtro
    # lo leería como separador de opciones.
    trfs = []
    for k, (ruta, desde, dur, _) in enumerate(cs):
        trf = f'_{pid}-{k}.trf'
        subprocess.run([FF, '-v', 'error', '-y', '-ss', str(desde), '-t', str(dur), '-i', str(ruta),
                        '-vf', DETECTA.format(trf=trf), '-f', 'null', '-'], check=True, cwd=WEB)
        trfs.append(trf)
    args = [FF, '-v', 'error', '-y']
    for ruta, desde, dur, _ in cs:
        args += ['-ss', str(desde), '-t', str(dur), '-i', str(ruta)]
    cad = []
    for i in range(len(cs)):
        cad.append(f'[{i}:v]{CORRIGE.format(trf=trfs[i])},{cs[i][3]}'
                   f'crop=min(iw\\,ih*4/5):min(ih\\,iw*5/4),scale={ANCHO}:{ALTO}:flags=lanczos,'
                   f'fps={FPS},setsar=1,format=yuv420p,settb=AVTB[v{i}]')
    if len(cs) == 1:
        filtro = ';'.join(cad); final = '[v0]'
    else:
        off = cs[0][2] - FUNDIDO
        filtro = ';'.join(cad) + f';[v0][v1]xfade=transition=fade:duration={FUNDIDO}:offset={off:.3f}[vx]'
        final = '[vx]'
    args += ['-filter_complex', filtro, '-map', final, '-an', '-c:v', 'libx264', '-preset', 'medium',
             '-crf', str(CRF), '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '_' + sal.name]
    # Se escribe con otro nombre y se renombra al terminar: un proceso cortado
    # a medias dejaba un .mp4 truncado que la siguiente corrida daba por hecho.
    subprocess.run(args, check=True, cwd=WEB)
    for t in trfs:
        (WEB / t).unlink(missing_ok=True)
    (WEB / ('_' + sal.name)).replace(sal)
    sin_giro(sal)
    return sal


def sin_giro(sal):
    """Con dos clips (frente y reverso), ffmpeg ya gira los cuadros pero copia
    además la etiqueta de giro del iPhone (displaymatrix −90°) al archivo: el
    navegador lo vuelve a girar y el video sale acostado (900 × 720). Se
    reescribe sin la etiqueta, sin recomprimir."""
    r = subprocess.run([FF, '-hide_banner', '-i', str(sal)], capture_output=True, text=True, encoding='utf-8', errors='replace').stderr
    if 'displaymatrix' not in r:
        return
    tmp = sal.with_name('_g-' + sal.name)
    subprocess.run([FF, '-v', 'error', '-y', '-display_rotation:v:0', '0', '-i', str(sal), '-c', 'copy',
                    '-movflags', '+faststart', str(tmp)], check=True)
    tmp.replace(sal)


def portada(pid, video):
    f = ASSETS / f'vid-{pid}.webp'
    # La portada es de la versión vigente: si es más vieja que el video, se rehace.
    if f.exists() and f.stat().st_mtime >= video.stat().st_mtime:
        return f
    tmp = WEB / f'_p-{pid}.png'
    t = min(1.2, duracion(video) * 0.3)
    subprocess.run([FF, '-v', 'error', '-y', '-ss', str(t), '-i', str(video), '-frames:v', '1', str(tmp)], check=True)
    im = Image.open(tmp).convert('RGB').resize((440, 550), Image.LANCZOS)
    im.save(f, 'WEBP', quality=78, method=6)
    tmp.unlink()
    return f


def main():
    WEB.mkdir(parents=True, exist_ok=True)
    mapa = {k: v for k, v in json.loads((RAIZ / 'herramientas' / 'videos_joyas.json').read_text(encoding='utf-8')).items()
            if not k.startswith('_')}
    pedidos = sys.argv[1:] or list(mapa)
    total = 0
    for pid in pedidos:
        v = armar(pid, mapa[pid])
        portada(pid, v)
        mb = v.stat().st_size / 2**20
        total += mb
        aviso = '  ← más de 3 MB' if mb > 3 else ''
        print(f'{pid:38s} {duracion(v):5.1f} s  {mb:4.2f} MB{aviso}')
    print(f'{len(pedidos)} videos · {total:.1f} MB')


if __name__ == '__main__':
    main()
