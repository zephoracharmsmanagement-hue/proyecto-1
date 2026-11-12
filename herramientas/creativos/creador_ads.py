#!/usr/bin/env python3
"""Creador de ads de Zephora Charms: de una receta (JSON) a un anuncio listo para aprobar.

    python3 herramientas/creativos/creador_ads.py herramientas/creativos/ads/fe-virgenes.json
    python3 herramientas/creativos/creador_ads.py --elegibles            # piezas con 3 o más unidades
    python3 herramientas/creativos/creador_ads.py RECETA --solo-validar  # sin pintar (no necesita Pillow)

Qué hace, en orden, y por qué en ese orden:

  1. VALIDA la receta contra las reglas que ya costaron un error (LEEME.md y la skill meta-ads):
     existencias en vivo (3 o más), fotos sin grabados de marca, página de destino que existe.
  2. CALCULA los números con `calcular()` de netlify/functions/_precios.js, el mismo código que
     cobra. Los textos no llevan cifras escritas a mano: llevan marcadores ({total}, {lista},
     {cuota_addi}…) que se rellenan aquí. Una cifra suelta que no salga de `calcular()` es un error.
  3. REVISA los textos ya rellenos: sin Pandora, sin porcentajes, «envío gratis» solo pagando en
     línea, «sin interés» solo con Addi y dentro de su rango, brazaletes en baño de plata.
  4. PINTA el anuncio en estilo estudio (joya recortada sobre fondo crema) en 1:1, 4:5 y 9:16.
  5. ESCRIBE ficha.md (lo que se le muestra al propietario) y payload.json (la propuesta para Meta).

NO sube nada a Meta ni gasta un peso. Subir es otro paso, con el payload aprobado por el
propietario (CLAUDE.md § Modo de operación acordado).

Con cualquier error del paso 1 al 3 no se pinta nada: un anuncio bonito con un precio que el
checkout no cobra es peor que no tener anuncio.
"""
import argparse
import datetime
import json
import math
import os
import re
import subprocess
import sys
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
ORIGEN = 'https://zephoracharms.com'
SALIDA = os.path.join(RAIZ, 'material-sin-publicar', 'creativos', 'salida', 'ads')

# Dónde se propone el anuncio. No son secretos (están en CLAUDE.md); una receta puede
# cambiarlos con la clave "meta".
META = {
    'cuenta': '1683479286750530',            # «Zephora - Principal»
    'conjunto': '120255196550480022',        # AMPLIO · CO · 18+
    'conjunto_nombre': 'AMPLIO · CO · 18+',
    'pagina': '1434133013118298',
}
UTM = ('utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}'
       '&utm_term={{adset.name}}&utm_content={{ad.name}}')

MIN_UNIDADES = 3                              # elegibilidad para pauta: 3 o más
ADDI_MIN, ADDI_MAX = 50000, 600000            # «sin interés» solo en este rango (tienda.js, pintarCuotasAddi)
# ancho, alto, tope y fondo de la zona segura, escala inicial
FORMATOS = {
    '1x1': (1080, 1080, 44, 1040, 0.78),
    '4x5': (1080, 1350, 50, 1304, 0.94),
    '9x16': (1080, 1920, 250, 1590, 1.0),     # 9:16 deja libre lo que tapa la interfaz
}
# Páginas que todavía dicen «envío gratis desde $180.000»: un anuncio no puede aterrizar ahí.
DESTINOS_VETADOS = {'preguntas-frecuentes.html', 'envios-y-devoluciones.html'}
CTAS = {'SHOP_NOW', 'LEARN_MORE', 'ORDER_NOW', 'GET_OFFER'}

CAT = json.load(open(os.path.join(RAIZ, 'assets', 'catalogo.json'), encoding='utf-8'))
RECORTES = json.load(open(os.path.join(AQUI, 'recortes.json'), encoding='utf-8'))
PULSERAS = set(CAT['pulseras'])


def cop(n):
    return '$' + f'{int(round(n)):,}'.replace(',', '.')


# ───────────────────────── datos: precio, existencias, reseñas ─────────────────────────

def numeros(base, charms):
    """Todo número de dinero sale de calcular(), en una sola llamada a Node."""
    js = r"""
const {calcular}=require('./netlify/functions/_precios.js');
const {base,charms,pulseras}=JSON.parse(process.argv[1]);
const p={base:base?{id:base,talla:null}:null,charms};
const x=calcular({...p,pago:'anticipado'});
const ce=calcular({...p,pago:'contraentrega'});
const uno={};
charms.forEach(id=>{uno[id]=calcular({base:null,charms:[id],pago:'anticipado'}).brutoCharms;});
pulseras.forEach(id=>{uno[id]=calcular({base:{id,talla:null},charms:[],pago:'anticipado'}).brutoBrazalete;});
console.log(JSON.stringify({total:x.total,lista:x.brutoCharms+x.brutoBrazalete,ahorro:x.descuento,
  gratis:x.gratis,envioAnticipado:x.envio,envioContraentrega:ce.envio,uno}));
"""
    arg = json.dumps({'base': base, 'charms': charms, 'pulseras': sorted(PULSERAS)})
    return json.loads(subprocess.check_output(['node', '-e', js, arg], cwd=RAIZ))


def bajar(url):
    """JSON de una URL. urllib primero; curl de respaldo (hay entornos donde solo curl conoce el proxy)."""
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'creador-ads'}), timeout=25) as r:
            return json.loads(r.read().decode('utf-8'))
    except Exception:
        return json.loads(subprocess.check_output(['curl', '-sSf', '-m', '25', url]))


def leer_existencias(archivo=None):
    """{id: unidades} para charms, {id: {talla: unidades}} para brazaletes, y la fuente.

    Sale de la función `disponibilidad` del sitio: conteo menos lo apartado y lo vendido. No de
    assets/stock.json, que es el conteo del día en que se generó y no sabe lo que pasó después.
    """
    d = json.load(open(archivo, encoding='utf-8')) if archivo else bajar(ORIGEN + '/.netlify/functions/disponibilidad')
    if d.get('fuente') != 'conteo-menos-apartado':
        raise SystemExit('✗ La disponibilidad vino sin lo apartado (fuente: %r). Sin ese dato no se valida '
                         'un anuncio: reintentar en unos minutos.' % d.get('fuente'))
    u = {p['id']: p.get('disponible', 0) for p in d['piezas']}
    u.update({b['id']: b.get('tallas', {}) for b in d['brazaletes']})
    grupos = {p['id']: p.get('grupo') for p in d['piezas']}
    return u, grupos, ('archivo ' + os.path.basename(archivo)) if archivo else 'disponibilidad en vivo', d.get('generado')


def unidades(ex, id_):
    v = ex.get(id_, 0)
    return sum(v.values()) if isinstance(v, dict) else (v or 0)


_RESENAS = {}


def resenas():
    if not _RESENAS:
        try:
            d = bajar(ORIGEN + '/.netlify/functions/resenas')
            _RESENAS.update(total=int(d['total']), promedio=float(d['promedio']))
        except Exception as e:                       # sin red no se inventa el número
            _RESENAS.update(error=str(e)[:80])
    return _RESENAS


# ───────────────────────── textos: marcadores y revisión ─────────────────────────

def nombre_corto(id_, etiquetas):
    if id_ in etiquetas:
        return etiquetas[id_]
    return re.sub(r'^(Charm|Pulsera) ', '', CAT['nombres'].get(id_, id_))


def frase_gratis(gratis, base, etiquetas):
    """«El brazalete te sale gratis»: la píldora automática, escrita desde lo que calcular() regaló."""
    if not gratis:
        return ''
    n = ['el brazalete' if g == base else nombre_corto(g, etiquetas) for g in gratis]
    n.sort(key=lambda s: s != 'el brazalete')          # el brazalete primero
    s = ' y '.join(n)
    return s[0].upper() + s[1:] + (' te sale gratis' if len(n) == 1 else ' te salen gratis')


class Receta:
    """La receta ya validada y con los números puestos. `errores` vacío = se puede pintar."""

    def __init__(self, ruta, ex, grupos):
        self.ruta = ruta
        self.errores, self.avisos = [], []
        try:
            self.r = json.load(open(ruta, encoding='utf-8'))
        except Exception as e:
            self.r = {}
            self.errores.append(f'La receta no es JSON válido: {e}')
            return
        r = self.r
        self.slug = r.get('slug') or os.path.splitext(os.path.basename(ruta))[0]
        self.base = r.get('base') or None
        self.charms = list(r.get('charms') or [])
        self.etiquetas = r.get('etiquetas') or {}
        self.imagen = dict(r.get('imagen') or {})
        self.texto = dict(r.get('texto') or {})
        self.meta = {**META, **(r.get('meta') or {})}
        self.n = None
        self._piezas(ex)
        if self.errores:
            return
        self.n = numeros(self.base, self.charms)
        self.ex = ex
        self._marcadores()
        self._rellenar()
        self._revisar_textos()
        self._destino()
        for campo in ('angulo', 'nombre', 'hipotesis'):
            if not str(r.get(campo) or '').strip():
                self.errores.append(f'Falta "{campo}" en la receta'
                                    + (' (qué esperamos ver y en cuántos días: sin hipótesis no hay prueba)' if campo == 'hipotesis' else ''))

    # ── piezas: que existan, que haya unidades, que la foto se pueda usar ──
    def _piezas(self, ex):
        if not self.base and not self.charms:
            self.errores.append('La receta no tiene piezas ("base" y/o "charms")')
        if len(set(self.charms)) != len(self.charms):
            self.errores.append('Hay un charm repetido: cada pieza una sola vez en la imagen')
        for id_ in ([self.base] if self.base else []) + self.charms:
            if id_ not in CAT['precios']:
                self.errores.append(f'{id_}: no está en assets/catalogo.json')
                continue
            if (id_ in PULSERAS) != (id_ == self.base):
                self.errores.append(f'{id_}: ' + ('es un brazalete; va en "base"' if id_ in PULSERAS else 'no es un brazalete; va en "charms"'))
            if id_ in RECORTES['no_usar']:
                self.errores.append(f'{id_}: foto vetada — {RECORTES["no_usar"][id_]}')
            foto = CAT['fotos'].get(id_)
            if not foto or not os.path.exists(os.path.join(RAIZ, 'assets', 'hd', foto)):
                self.errores.append(f'{id_}: no tiene foto en assets/hd/')
            elif id_ not in RECORTES['revisadas'] and id_ not in RECORTES['no_usar']:
                self.avisos.append(f'{id_}: foto sin revisar contra grabados de marca. Mirar assets/hd/{foto} '
                                   'y, si está limpia, agregarla a "revisadas" en recortes.json')
            u = unidades(ex, id_)
            if u < MIN_UNIDADES:
                self.errores.append(f'{id_}: {u} unidad(es) disponibles; la pauta pide {MIN_UNIDADES} o más')

    # ── marcadores: lo único que puede poner una cifra en un texto ──
    def _marcadores(self):
        n = self.n
        m = {
            'total': cop(n['total']), 'lista': cop(n['lista']), 'ahorro': cop(n['ahorro']),
            'piezas': str(len(self.charms) + (1 if self.base else 0)),
            'charms': str(len(self.charms)),
            'gratis': frase_gratis(n['gratis'], self.base, self.etiquetas),
            'envio_contraentrega': cop(n['envioContraentrega']),
        }
        if ADDI_MIN <= n['total'] <= ADDI_MAX:
            m['cuota_addi'] = cop(math.ceil(n['total'] / 3))
        pc = {n['uno'][c] for c in self.charms}
        if len(pc) == 1:
            m['precio_charm'] = cop(pc.pop())
        con_unidades = [n['uno'][p] for p in PULSERAS if unidades(self.ex, p) > 0]
        if con_unidades:
            m['desde_brazalete'] = cop(min(con_unidades))
        for id_ in ([self.base] if self.base else []) + self.charms:
            m['precio:' + id_] = cop(n['uno'][id_])
        self.m = m
        # Las cifras que un texto puede traer escritas: las mismas de arriba, y ninguna más.
        self.cifras = {v for k, v in m.items() if v.startswith('$')}

    def _poner(self, s, donde):
        def uno(mo):
            k = mo.group(1)
            if k in ('estrellas', 'resenas'):
                rs = resenas()
                if 'error' in rs:
                    self.errores.append(f'{donde}: {{{k}}} necesita las reseñas del sitio y no respondieron ({rs["error"]})')
                    return ''
                return str(rs['promedio']).replace('.', ',') if k == 'estrellas' else str(rs['total'])
            if k not in self.m:
                porque = {'cuota_addi': f'el total ({cop(self.n["total"])}) está fuera del rango sin interés de Addi',
                          'precio_charm': 'los charms de la receta no valen lo mismo; usar {precio:ID}'}.get(k, 'marcador desconocido')
                self.errores.append(f'{donde}: {{{k}}} — {porque}')
                return ''
            return self.m[k]
        return re.sub(r'\{([a-z_]+(?::[a-z0-9ñ-]+)?)\}', uno, s)

    def _rellenar(self):
        img = self.imagen
        hay_regalo = bool(self.n['gratis'])
        if img.get('precio', 'set') == 'set':                   # valores por defecto del bloque de precio
            if hay_regalo:
                img.setdefault('tachado', ('Brazalete + {charms} charms' if self.base else '{charms} charms') + ': {lista}')
            img.setdefault('grande', 'Pagas {total}' if hay_regalo else '{total}')
            img.setdefault('pildora', '{gratis}' if hay_regalo else '')
        for k in ('antetitulo', 'titulo', 'subtitulo', 'tachado', 'grande', 'pildora', 'pie'):
            img[k] = self._poner(str(img.get(k) or ''), f'imagen.{k}').strip()
        img['puntos'] = [self._poner(str(p), 'imagen.puntos').strip() for p in (img.get('puntos') or [])]
        for k in ('principal', 'titular', 'descripcion'):
            self.texto[k] = self._poner(str(self.texto.get(k) or ''), f'texto.{k}').strip()
        if not img['titulo']:
            self.errores.append('Falta imagen.titulo')
        for k in ('principal', 'titular'):
            if not self.texto[k]:
                self.errores.append(f'Falta texto.{k}')

    # ── revisión: las reglas de la skill meta-ads, hechas comprobación ──
    def _revisar_textos(self):
        img = self.imagen
        campos = {f'imagen.{k}': img[k] for k in ('antetitulo', 'titulo', 'subtitulo', 'tachado', 'grande', 'pildora', 'pie')}
        campos['imagen.puntos'] = ' · '.join(img['puntos'])
        campos.update({f'texto.{k}': v for k, v in self.texto.items()})
        for donde, s in campos.items():
            if not s:
                continue
            bajo = s.lower()
            if 'pandora' in bajo:
                self.errores.append(f'{donde}: nombra a Pandora. Decir «compatible con pulseras de sistema modular»')
            for cifra in re.findall(r'\$\s?\d[\d.]*', s):
                c = '$' + re.sub(r'[^\d]', '', cifra)
                c = cop(int(c[1:])) if len(c) > 1 else c
                if c not in self.cifras:
                    self.errores.append(f'{donde}: {cifra.strip()} no sale de calcular() para estas piezas. '
                                        'Usar un marcador ({total}, {lista}, {cuota_addi}, {precio:ID}…)')
            if re.search(r'\d\s?%', s):
                self.errores.append(f'{donde}: habla de un porcentaje. No hay descuentos por porcentaje: la promo es '
                                    '«paga 3, lleva 1 gratis · paga 4, lleva 2 gratis»')
            if re.search(r'env[ií]o\s+gratis', bajo) and not re.search(r'pagando en l[ií]nea|pago en l[ií]nea|pago anticipado', bajo):
                self.errores.append(f'{donde}: «envío gratis» sin decir «pagando en línea». En contraentrega el envío '
                                    f'cuesta {self.m["envio_contraentrega"]}')
            if 'sin interés' in bajo or 'sin interes' in bajo:
                if 'addi' not in bajo:
                    self.errores.append(f'{donde}: «sin interés» solo se puede decir de Addi')
                elif not ADDI_MIN <= self.n['total'] <= ADDI_MAX:
                    self.errores.append(f'{donde}: Addi es sin interés solo entre {cop(ADDI_MIN)} y {cop(ADDI_MAX)}; '
                                        f'este conjunto vale {cop(self.n["total"])}')
            if re.search(r'sistecr[eé]dito', bajo) and re.search(r'cuota|inter[eé]s', bajo):
                self.errores.append(f'{donde}: con Sistecrédito no se prometen cuotas ni interés')
            if re.search(r'(brazalete|pulsera)s?\s+(de|en)\s+plata', bajo):
                self.errores.append(f'{donde}: el brazalete es «en baño de plata», nunca «de plata». Plata 925 son los charms')
            for frase in ('la mejor calidad', 'gran oferta', 'compra ya', 'oferta imperdible', 'últimas unidades'):
                if frase in bajo:
                    self.errores.append(f'{donde}: «{frase}» — lenguaje de infomercial o afirmación que el sitio no respalda')
            if re.search(r'[!¡]{2,}', s):
                self.errores.append(f'{donde}: signos de exclamación en cadena')
            mo = re.search(r'(\d+)\s+reseñas', bajo)
            est = re.search(r'⭐\s*(\d[,.]\d)', s)
            if mo or est:
                rs = resenas()
                if 'error' in rs:
                    self.avisos.append(f'{donde}: cita reseñas y el sitio no respondió para comprobarlas')
                else:
                    if mo and int(mo.group(1)) != rs['total']:
                        self.errores.append(f'{donde}: dice {mo.group(1)} reseñas y el sitio tiene {rs["total"]}. Usar {{resenas}}')
                    if est and float(est.group(1).replace(',', '.')) != rs['promedio']:
                        self.errores.append(f'{donde}: dice ⭐ {est.group(1)} y el sitio tiene {rs["promedio"]}. Usar {{estrellas}}')
            if donde.startswith('imagen.') and re.search(r'[←-⯿\U0001F000-\U0001FFFF️]', s):
                self.errores.append(f'{donde}: lleva un emoji o símbolo que las tipografías de la imagen no tienen')
        # Lo que la imagen afirma que sale gratis tiene que ser lo que calcular() regala.
        for id_ in self.r.get('exige_gratis') or []:
            if id_ not in self.n['gratis']:
                self.errores.append(f'exige_gratis: {id_} no sale gratis con estas piezas (gratis: {self.n["gratis"] or "nada"})')
        afirma = ' '.join(campos.values()).lower()
        if re.search(r'(brazalete|pulsera)[^.·\n]{0,25}\b(te sale|sale|va)\s+gratis', afirma) and self.base \
                and self.base not in self.n['gratis']:
            self.errores.append('Un texto dice que el brazalete sale gratis y calcular() regala otra pieza: '
                                f'{frase_gratis(self.n["gratis"], self.base, self.etiquetas) or "ninguna"}')
        if len(self.texto['titular']) > 40:
            self.avisos.append(f'texto.titular tiene {len(self.texto["titular"])} caracteres; Meta lo corta cerca de 40')
        if (self.r.get('cta') or 'SHOP_NOW') not in CTAS:
            self.errores.append(f'cta desconocido: {self.r.get("cta")}. Opciones: {", ".join(sorted(CTAS))}')

    def _destino(self):
        d = str(self.r.get('destino') or '').lstrip('/')
        archivo = re.split(r'[?#]', d)[0] or 'index.html'
        if not os.path.exists(os.path.join(RAIZ, archivo)):
            self.errores.append(f'destino: {archivo} no existe en el sitio')
        if archivo in DESTINOS_VETADOS:
            self.errores.append(f'destino: {archivo} todavía dice «envío gratis desde $180.000». Llevar a una ficha, un kit o el catálogo')
        self.enlace = f'{ORIGEN}/{d}'

    @property
    def nombre_anuncio(self):
        return f'FOTO · {self.r["angulo"]} · {self.r["nombre"]} · {datetime.date.today().isoformat()}'


# ───────────────────────── imagen: estilo estudio en tres formatos ─────────────────────────

def pintar(rec, formatos, carpeta):
    """Compone el anuncio. Pillow y el motor de recorte se cargan aquí: validar no los necesita."""
    from PIL import Image, ImageChops, ImageDraw, ImageFilter, features

    sys.path.insert(0, AQUI)
    marca = os.path.join(RAIZ, 'material-sin-publicar', 'creativos', 'salida',
                         'historias-' + datetime.date.today().isoformat())
    existia = os.path.isdir(marca)
    import historias_estudio as E                       # recortar() y las tipografías: una sola versión
    if not existia and os.path.isdir(marca) and not os.listdir(marca):
        os.rmdir(marca)                                 # ese módulo crea su carpeta al cargarse; aquí sobra

    TINTA, CIRUELA, ORO, GRIS = E.TINTA, E.CIRUELA, E.ORO_OSC, E.GRIS
    LIGA = {'features': ['-liga']} if features.check('raqm') else {}
    if not os.path.isdir(E.F):
        raise SystemExit('✗ Faltan las tipografías: bash herramientas/creativos/fuentes.sh')

    def sin_piso(pz, zona=0.30):
        """Quita la sombra y el reflejo de estudio que la foto trae bajo la pieza.

        La sombra es lo único de la franja inferior que es a la vez gris, claro, liso y pegado al
        fondo: se rellena desde el fondo por los píxeles que cumplen las cuatro cosas. El metal también
        es gris y claro, pero tiene bordes, y el relleno se detiene en ellos. Así no hay que ajustar
        una franja a mano por pieza, que era lo que dejaba medio reflejo o se comía los pies.
        """
        w, h = pz.size
        m = 4
        lz = Image.new('RGBA', (w + 2 * m, h + 2 * m), (255, 255, 255, 0))
        lz.paste(pz, (m, m))
        r, g, b, a = lz.split()
        mayor = ImageChops.lighter(ImageChops.lighter(r, g), b)
        menor = ImageChops.darker(ImageChops.darker(r, g), b)
        gris = lz.convert('RGB').convert('L')
        rango = ImageChops.subtract(gris.filter(ImageFilter.MaxFilter(5)), gris.filter(ImageFilter.MinFilter(5)))
        sombra = ImageChops.multiply(
            ImageChops.multiply(ImageChops.subtract(mayor, menor).point(lambda v: 255 if v < 18 else 0),
                                menor.point(lambda v: 255 if v > 150 else 0)),
            rango.point(lambda v: 255 if v < 20 else 0))
        franja = Image.new('L', lz.size, 0)
        ImageDraw.Draw(franja).rectangle([0, int(m + h * (1 - zona)), w + 2 * m, h + 2 * m], fill=255)
        marca = ImageChops.lighter(a.point(lambda v: 255 if v < 8 else 0), ImageChops.multiply(sombra, franja))
        ImageDraw.floodfill(marca, (0, 0), 128, thresh=0)
        queda = marca.point(lambda v: 0 if v == 128 else 255).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.9))
        lz.putalpha(ImageChops.multiply(a, queda))
        al = lz.split()[3]                              # motas sueltas que quedaron flotando
        lz.putalpha(ImageChops.darker(al, al.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(7))))
        return lz.crop(lz.getbbox())

    def recorte(id_):
        cfg = RECORTES['recorte'].get(id_, {})
        im = Image.open(E.HD + CAT['fotos'][id_]).convert('RGB')
        cx, cy = im.width // 2, im.height // 2
        # Semillas: puntos del fondo que el relleno desde el borde no alcanza (el hueco del aro, el
        # interior de un corazón abierto). Las del aro van por defecto en todo brazalete; las demás,
        # en recortes.json como fracción de la foto. Solo valen las que caen en blanco: una semilla
        # sobre el metal se llevaría la pieza entera.
        sem = [(cx, cy - 20), (cx + 200, cy), (cx - 250, cy)] if id_ in PULSERAS else []
        sem += [(int(im.width * fx), int(im.height * fy)) for fx, fy in cfg.get('semillas', [])]
        sem = [p for p in sem if min(im.getpixel(p)) > 238]
        pz = E.recortar(os.path.splitext(CAT['fotos'][id_])[0], sem)
        return sin_piso(pz) if cfg.get('sin_piso', True) else pz

    piezas = {id_: recorte(id_) for id_ in ([rec.base] if rec.base else []) + rec.charms}
    img = rec.imagen
    salidas = {}

    for fmt in formatos:
        W, H, top, bot, s0 = FORMATOS[fmt]
        margen = 64
        ancho = W - 2 * margen

        def fuente(fn, tam, txt, minimo=0.6):
            """La tipografía al tamaño pedido, o más chica si el texto no cabe en el ancho."""
            t = tam
            while t > tam * minimo:
                f = fn(t)
                if d0.textlength(txt, font=f, **LIGA) <= ancho:
                    return f
                t -= 2
            return fn(t)

        d0 = ImageDraw.Draw(Image.new('RGB', (8, 8)))
        cols_max = 5 if fmt == '9x16' else 6

        def bloques(s, k):
            """Lista de (alto, pintar(lienzo, dibujo, y)) para una escala `s` y un agrandado de piezas `k`."""
            b = []
            # encabezado
            lineas = []
            if img['antetitulo']:
                lineas.append((img['antetitulo'], fuente(E.ITAL, 100 * s, img['antetitulo']), ORO, 1.14))
            lineas.append((img['titulo'], fuente(E.BOLD, 90 * s, img['titulo']), TINTA, 1.4))
            if img['subtitulo']:
                lineas.append((img['subtitulo'], fuente(E.SANS, max(27, 35 * s), img['subtitulo']), CIRUELA, 1.3))

            def encabezado(c, d, y):
                for txt, f, color, lh in lineas:
                    d.text((W / 2, y), txt, font=f, fill=color + (255,), anchor='ma', **LIGA)
                    y += f.size * lh
            b.append((sum(f.size * lh for _, f, _, lh in lineas), encabezado))

            # brazalete
            if rec.base:
                pz = piezas[rec.base]
                alto_b = min(330 * s * k, ancho * 0.62 * pz.height / pz.width)

                def brazalete(c, d, y, alto_b=alto_b, pz=pz):
                    poner(c, pz, W / 2, y + alto_b / 2, alto=round(alto_b))
                b.append((alto_b, brazalete))

            # charms, en una o más filas
            if rec.charms:
                n = len(rec.charms)
                filas = math.ceil(n / cols_max)
                cols = math.ceil(n / filas)
                hueco = ancho / cols
                base_alto = {1: 500, 2: 380, 3: 310}.get(n, 250)
                alto_c = base_alto * s * k
                f_et = E.SANSB(max(22, round({1: 40, 2: 36, 3: 30}.get(n, 26) * s)))
                et_lineas = {}
                for id_ in rec.charms:
                    et_lineas[id_] = partir(d0, nombre_corto(id_, rec.etiquetas), f_et, hueco - 14, LIGA)
                alto_et = max(len(v) for v in et_lineas.values()) * f_et.size * 1.2
                alto_fila = alto_c + 16 * s + alto_et
                sep = 26 * s

                def charms(c, d, y, alto_c=alto_c, f_et=f_et):
                    for i, id_ in enumerate(rec.charms):
                        fila, col = divmod(i, cols)
                        en_fila = min(cols, n - fila * cols)
                        x = W / 2 + (col - (en_fila - 1) / 2) * hueco
                        yy = y + fila * (alto_fila + sep)
                        pz = piezas[id_]
                        a = min(alto_c, (hueco - 22) * pz.height / pz.width)
                        poner(c, pz, x, yy + alto_c / 2, alto=round(a))
                        d2 = ImageDraw.Draw(c)
                        for j, ln in enumerate(et_lineas[id_]):
                            d2.text((x, yy + alto_c + 16 * s + j * f_et.size * 1.2), ln, font=f_et, fill=TINTA + (255,), anchor='ma', **LIGA)
                b.append((filas * alto_fila + (filas - 1) * sep, charms))

            # puntos (beneficios cortos)
            if img['puntos']:
                f_p = E.SANS(max(26, round(32 * s)))

                def puntos(c, d, y, f_p=f_p):
                    for j, ln in enumerate(img['puntos']):
                        w = d.textlength(ln, font=f_p, **LIGA)
                        yy = y + j * f_p.size * 1.45
                        r = f_p.size * 0.13
                        d.ellipse([W / 2 - w / 2 - 26 - r, yy + f_p.size * 0.55 - r, W / 2 - w / 2 - 26 + r, yy + f_p.size * 0.55 + r], fill=ORO + (255,))
                        d.text((W / 2, yy), ln, font=f_p, fill=CIRUELA + (255,), anchor='ma', **LIGA)
                b.append((len(img['puntos']) * f_p.size * 1.45, puntos))

            # precio
            renglones = []
            if img['tachado']:
                renglones.append(('tachado', img['tachado'], fuente(E.SANS, max(27, 36 * s), img['tachado']), 1.3))
            if img['grande']:
                renglones.append(('grande', img['grande'], fuente(E.BOLD, 86 * s, img['grande']), 1.3))
            if img['pildora']:
                renglones.append(('pildora', img['pildora'], fuente(E.SANSB, max(26, 32 * s), img['pildora'], 0.7), 2.25))
            if img['pie']:
                renglones.append(('pie', img['pie'], fuente(E.SANS, max(24, 28 * s), img['pie']), 1.3))
            if renglones:
                def precio(c, d, y):
                    for tipo, txt, f, lh in renglones:
                        if tipo == 'tachado':
                            w = d.textlength(txt, font=f, **LIGA)
                            d.text((W / 2, y), txt, font=f, fill=GRIS + (255,), anchor='ma', **LIGA)
                            asc, _ = f.getmetrics()
                            ym = y + asc - f.size * 0.26                      # a media altura de las minúsculas
                            d.line([(W / 2 - w / 2 - 6, ym), (W / 2 + w / 2 + 6, ym)], fill=GRIS + (255,), width=3)
                        elif tipo == 'pildora':
                            w = d.textlength(txt, font=f, **LIGA)
                            h = f.size * 1.75
                            cy = y + f.size * 1.1
                            d.rounded_rectangle([W / 2 - w / 2 - 30, cy - h / 2, W / 2 + w / 2 + 30, cy + h / 2], radius=h / 2, fill=CIRUELA + (255,))
                            d.text((W / 2, cy), txt, font=f, fill=(255, 255, 255, 255), anchor='mm', **LIGA)
                        else:
                            d.text((W / 2, y), txt, font=f, fill=(TINTA if tipo == 'grande' else CIRUELA) + (255,), anchor='ma', **LIGA)
                        y += f.size * lh
                b.append((sum(f.size * lh for _, _, f, lh in renglones), precio))

            # firma
            f_f = E.FIRMA(max(40, round(52 * s)))
            b.append((f_f.size * 1.1, lambda c, d, y, f_f=f_f: d.text((W / 2, y), 'Zephora Charms', font=f_f, fill=TINTA + (255,), anchor='ma', **LIGA)))
            return b

        def poner(c, pz, cx, cy, alto):
            p = pz.resize((max(1, round(pz.width * alto / pz.height)), alto), Image.LANCZOS)
            x, y = int(cx - p.width / 2), int(cy - p.height / 2)
            sombra = Image.new('RGBA', c.size, (0, 0, 0, 0))
            sombra.paste((60, 40, 50, 255), (x + 9, y + 20), p.split()[3].point(lambda v: v * 0.38))
            c.alpha_composite(sombra.filter(ImageFilter.GaussianBlur(15)))
            c.alpha_composite(p, (x, y))

        # Escala: la mayor que cabe en la zona segura; después, piezas tan grandes como dé el aire que sobre.
        alto_zona = bot - top
        s = s0
        while s > 0.5 and sum(a for a, _ in bloques(s, 1.0)) + 22 * (len(bloques(s, 1.0)) - 1) > alto_zona:
            s -= 0.02
        k = 1.0
        while k < 1.7 and sum(a for a, _ in bloques(s, k + 0.05)) + 44 * s * (len(bloques(s, k)) - 1) <= alto_zona:
            k += 0.05
        bl = bloques(s, k)
        sobra = alto_zona - sum(a for a, _ in bl)
        aire = min(sobra / (len(bl) - 1), 120)
        y = top + (sobra - aire * (len(bl) - 1)) / 2

        fondo = Image.new('RGB', (W, H), (226, 214, 204))
        luz = Image.new('L', (W, H), 0)
        ImageDraw.Draw(luz).ellipse([-200, H * 0.16, W + 200, H * 0.78], fill=255)
        fondo = Image.composite(Image.new('RGB', (W, H), (246, 240, 234)), fondo, luz.filter(ImageFilter.GaussianBlur(260 * H / 1920)))
        c = fondo.convert('RGBA')
        for alto, f in bl:
            f(c, ImageDraw.Draw(c), y)
            y += alto + aire
        ruta = os.path.join(carpeta, f'{rec.slug}-{fmt}.jpg')
        c.convert('RGB').save(ruta, quality=94)
        salidas[fmt] = ruta
    return salidas


def partir(d, txt, f, ancho, liga):
    """Una etiqueta en una línea si cabe, en dos si no."""
    if d.textlength(txt, font=f, **liga) <= ancho or ' ' not in txt:
        return [txt]
    pal = txt.split(' ')
    mejor = min(range(1, len(pal)), key=lambda i: max(d.textlength(' '.join(pal[:i]), font=f, **liga),
                                                      d.textlength(' '.join(pal[i:]), font=f, **liga)))
    return [' '.join(pal[:mejor]), ' '.join(pal[mejor:])]


# ───────────────────────── entregables: ficha y payload ─────────────────────────

def escribir(rec, salidas, carpeta, fuente_ex, generado):
    n, ex = rec.n, rec.ex
    filas = []
    for id_ in ([rec.base] if rec.base else []) + rec.charms:
        v = ex.get(id_, 0)
        u = ' · '.join(f'{t}: {q}' for t, q in sorted(v.items())) if isinstance(v, dict) else str(v)
        filas.append(f'| {CAT["nombres"][id_]} | {cop(n["uno"][id_])} | {u} | {"gratis" if id_ in n["gratis"] else ""} |')
    cuota = rec.m.get('cuota_addi')
    payload = {
        'cuenta_publicitaria': rec.meta['cuenta'],
        'conjunto': {'id': rec.meta['conjunto'], 'nombre': rec.meta['conjunto_nombre']},
        'pagina': rec.meta['pagina'],
        'anuncio': {'nombre': rec.nombre_anuncio, 'estado_inicial': 'PAUSED'},
        'creativo': {
            'imagenes': {k: os.path.relpath(v, RAIZ) for k, v in salidas.items()},
            'texto_principal': rec.texto['principal'],
            'titular': rec.texto['titular'],
            'descripcion': rec.texto.get('descripcion', ''),
            'cta': rec.r.get('cta') or 'SHOP_NOW',
            'enlace': rec.enlace,
            'parametros_url': UTM,
        },
        'verificado': {
            'fecha': datetime.date.today().isoformat(),
            'precio': {'total': n['total'], 'lista': n['lista'], 'gratis': n['gratis'], 'fuente': 'calcular() en netlify/functions/_precios.js'},
            'existencias': {'fuente': fuente_ex, 'generado': generado,
                            'unidades': {i: ex.get(i, 0) for i in ([rec.base] if rec.base else []) + rec.charms}},
            'avisos': rec.avisos,
        },
    }
    json.dump(payload, open(os.path.join(carpeta, 'payload.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    ficha = f"""# {rec.nombre_anuncio}

Receta: `{os.path.relpath(rec.ruta, RAIZ)}` · generado el {datetime.date.today().isoformat()}

## Piezas

| Pieza | Precio | Disponibles | |
|---|---|---|---|
{chr(10).join(filas)}

Existencias: {fuente_ex} ({generado}). Precio de lista {cop(n['lista'])} → **{cop(n['total'])}** pagando en línea
{f'(Addi: 3 cuotas de {cuota} sin interés)' if cuota else '(fuera del rango sin interés de Addi)'}. Todo sale de `calcular()`.

## Textos

**Texto principal**

{rec.texto['principal']}

**Titular:** {rec.texto['titular']}

**Descripción:** {rec.texto.get('descripcion', '') or '—'}

**Botón:** {rec.r.get('cta') or 'SHOP_NOW'} → {rec.enlace}

## Imágenes

{chr(10).join(f'- {k}: `{os.path.relpath(v, RAIZ)}`' for k, v in salidas.items()) or '- (no se pintaron: --solo-validar)'}

## Propuesta para aprobar

```
Qué:        crear 1 anuncio, pausado, y activarlo solo con el sí del propietario
Objeto:     conjunto {rec.meta['conjunto_nombre']} ({rec.meta['conjunto']}), cuenta {rec.meta['cuenta']}
Antes → después: <anuncios activos hoy> → <uno más> (techo de 8; si entra uno con el techo lleno, decir cuál sale)
Por qué:    {rec.r.get('por_que') or 'ángulo «' + rec.r['angulo'] + '» sin anuncio activo'}
Hipótesis:  {rec.r['hipotesis']}
Riesgo:     reparte el presupuesto del conjunto entre un anuncio más; no sube el gasto diario
```
{chr(10).join(['', '## Avisos', ''] + ['- ' + a for a in rec.avisos]) if rec.avisos else ''}
"""
    open(os.path.join(carpeta, 'ficha.md'), 'w', encoding='utf-8').write(ficha)


# ───────────────────────── línea de comandos ─────────────────────────

def elegibles(ex, grupos, filtro):
    n = numeros(None, [])
    por_grupo = {}
    for id_ in CAT['precios']:
        u = unidades(ex, id_)
        if u < MIN_UNIDADES:
            continue
        g = 'Brazaletes' if id_ in PULSERAS else (grupos.get(id_) or 'Otros')
        if filtro and filtro.lower() not in g.lower():
            continue
        v = ex.get(id_)
        det = ' (' + ' · '.join(f'{t}:{q}' for t, q in sorted(v.items()) if q) + ')' if isinstance(v, dict) else ''
        precio = n['uno'].get(id_) or CAT['precios'][id_]
        nota = '  ✗ foto vetada' if id_ in RECORTES['no_usar'] else ('' if id_ in RECORTES['revisadas'] else '  · foto sin revisar')
        por_grupo.setdefault(g, []).append(f'  {u:>3}  {cop(precio):>9}  {id_}{det}{nota}')
    for g in sorted(por_grupo):
        print(f'\n{g} ({len(por_grupo[g])})')
        print('\n'.join(sorted(por_grupo[g], reverse=True)))


def main():
    ap = argparse.ArgumentParser(description='Creador de ads de Zephora Charms')
    ap.add_argument('recetas', nargs='*', help='recetas JSON (herramientas/creativos/ads/*.json)')
    ap.add_argument('--elegibles', action='store_true', help='lista las piezas con 3 o más unidades')
    ap.add_argument('--grupo', help='con --elegibles: solo un grupo (Marvel, Disney, Letras, Brazaletes…)')
    ap.add_argument('--solo-validar', action='store_true', help='valida y calcula, sin pintar')
    ap.add_argument('--existencias', help='JSON guardado de /.netlify/functions/disponibilidad (por defecto, en vivo)')
    ap.add_argument('--formatos', default='1x1,4x5,9x16')
    ap.add_argument('--salida', default=SALIDA)
    a = ap.parse_args()
    ex, grupos, fuente_ex, generado = leer_existencias(a.existencias)
    if a.elegibles:
        return elegibles(ex, grupos, a.grupo)
    if not a.recetas:
        ap.error('falta la receta (o --elegibles)')
    formatos = [f for f in a.formatos.split(',') if f]
    if any(f not in FORMATOS for f in formatos):
        ap.error('formatos válidos: ' + ', '.join(FORMATOS))
    rojas = 0
    for ruta in a.recetas:
        rec = Receta(ruta, ex, grupos)
        print(f'\n── {os.path.relpath(ruta, RAIZ) if os.path.isabs(ruta) else ruta} ──')
        for e in rec.errores:
            print('  ✗', e)
        for w in rec.avisos:
            print('  ⚠', w)
        if rec.errores:
            rojas += 1
            print('  No se generó nada.')
            continue
        print(f'  ✓ {cop(rec.n["lista"])} → {cop(rec.n["total"])}' + (f' · gratis: {", ".join(rec.n["gratis"])}' if rec.n['gratis'] else ''))
        salidas = {}
        carpeta = os.path.join(a.salida, f'{datetime.date.today().isoformat()}-{rec.slug}')
        if not a.solo_validar:
            os.makedirs(carpeta, exist_ok=True)
            salidas = pintar(rec, formatos, carpeta)
            escribir(rec, salidas, carpeta, fuente_ex, generado)
            for f in list(salidas.values()) + [os.path.join(carpeta, 'ficha.md'), os.path.join(carpeta, 'payload.json')]:
                print('  →', os.path.relpath(f, RAIZ))
    sys.exit(1 if rojas else 0)


if __name__ == '__main__':
    main()
