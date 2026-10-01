"""Videos de cada joya para la galería de su ficha (pedido del propietario,
2026-10-01).

    python herramientas/videos_joyas.py            # arma lo que falte
    python herramientas/videos_joyas.py hulk aries # solo esas

Lee herramientas/videos_joyas.json (id del catálogo → clips IMG_*.MOV del
celular) y por cada joya deja:

  · material-sin-publicar/videos-joyas/web/joya-<id>-v1.mp4 — cuadrado de
    720 px (recorte centrado: la joya va en el centro del plato), H.264, sin
    audio, 30 fps, +faststart. Dos clips (frente y reverso) se unen con un
    fundido de 0,4 s. Se suben a Netlify Blobs con herramientas/subir_media.mjs:
    los videos no van a git.
  · assets/vid-<id>.webp — la portada, 440 px, de un cuadro del propio video.

La joya no se toca: ni filtros ni retoque, solo recorte y compresión.
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
LADO, FPS, FUNDIDO, CRF = 720, 30, 0.4, 27
VERSION = 'v1'


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
        out.append((ruta, desde, hasta - desde))
    return out


def armar(pid, lista):
    sal = WEB / f'joya-{pid}-{VERSION}.mp4'
    if sal.exists():
        return sal
    cs = clips(lista)
    args = [FF, '-v', 'error', '-y']
    for ruta, desde, dur in cs:
        args += ['-ss', str(desde), '-t', str(dur), '-i', str(ruta)]
    cad = []
    for i in range(len(cs)):
        cad.append(f'[{i}:v]crop=min(iw\\,ih):min(iw\\,ih),scale={LADO}:{LADO}:flags=lanczos,'
                   f'fps={FPS},setsar=1,format=yuv420p,settb=AVTB[v{i}]')
    if len(cs) == 1:
        filtro = ';'.join(cad); final = '[v0]'
    else:
        off = cs[0][2] - FUNDIDO
        filtro = ';'.join(cad) + f';[v0][v1]xfade=transition=fade:duration={FUNDIDO}:offset={off:.3f}[vx]'
        final = '[vx]'
    args += ['-filter_complex', filtro, '-map', final, '-an', '-c:v', 'libx264', '-preset', 'slow',
             '-crf', str(CRF), '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(sal)]
    subprocess.run(args, check=True)
    return sal


def portada(pid, video):
    f = ASSETS / f'vid-{pid}.webp'
    if f.exists():
        return f
    tmp = WEB / f'_p-{pid}.png'
    t = min(1.2, duracion(video) * 0.3)
    subprocess.run([FF, '-v', 'error', '-y', '-ss', str(t), '-i', str(video), '-frames:v', '1', str(tmp)], check=True)
    im = Image.open(tmp).convert('RGB').resize((440, 440), Image.LANCZOS)
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
