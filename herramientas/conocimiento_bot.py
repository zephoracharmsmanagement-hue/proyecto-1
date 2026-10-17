#!/usr/bin/env python3
"""Paquete de información para el bot de respuestas PROPIO del propietario.

    python herramientas/conocimiento_bot.py [carpeta-de-salida]

Escribe tres archivos (por defecto en automatizaciones/bot-propio/, que no se
versiona: lleva existencias del día):

  Zephora-bot-instrucciones.md   lo que el bot tiene que saber y cómo responder
  Zephora-catalogo.csv           todas las piezas: precio, existencias, enlaces
  Zephora-bot-todo-en-uno.txt    lo mismo en un solo texto, para bots que solo
                                 aceptan pegar un bloque

── En qué se distingue del bot de n8n y de hoja_para_asesor.py ──

Ese bot consulta la tienda en cada mensaje (disponibilidad, armar_carrito) y
por eso tiene PROHIBIDO calcular. Este no tiene herramientas: lo que sabe es lo
que lleva escrito. Así que aquí van la regla de la promo como algoritmo, la
lista de precios completa y ejemplos de totales calculados con el mismo
calcular() de _precios.js que firma el cobro —un ejemplo escrito a mano es la
clase de número que ya costó una corrección pública (CLAUDE.md)—, y el formato
del enlace que abre el checkout con la selección puesta, para que el total
oficial lo diga la página.

Las existencias salen en vivo de netlify/functions/disponibilidad (conteo menos
lo apartado); si no responde, del conteo de assets/stock.json, y se avisa.
"""
import csv
import io
import json
import pathlib
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import date

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SITIO = 'https://zephoracharms.com'
WA = '+57 301 899 0672'
CORREO = 'zephoracharms@gmail.com'


def pesos(n):
    return '$' + f'{int(round(n)):,}'.replace(',', '.')


def disponibilidad():
    try:
        with urllib.request.urlopen(SITIO + '/.netlify/functions/disponibilidad', timeout=20) as r:
            d = json.load(r)
        if d.get('piezas'):
            return d, 'en vivo (conteo menos lo apartado por pagos en curso)'
    except Exception:
        pass
    cat = json.loads((RAIZ / 'assets' / 'catalogo.json').read_text(encoding='utf-8'))
    items = json.loads((RAIZ / 'assets' / 'stock.json').read_text(encoding='utf-8')).get('items', {})
    piezas, brazaletes = [], []
    for pid, precio in cat['precios'].items():
        it = items.get(pid, {})
        base = {'id': pid, 'nombre': cat['nombres'][pid], 'precio': precio,
                'grupo': 'Brazaletes' if pid in cat['pulseras'] else cat['grupos'].get(pid, ''),
                'foto': SITIO + '/assets/' + cat['fotos'].get(pid, pid + '.webp')}
        if pid in cat['pulseras']:
            brazaletes.append(dict(base, tipo='brazalete', material='baño de plata',
                                   tallas={t: n for t, n in (it.get('tallas') or {}).items() if n > 0}))
        else:
            piezas.append(dict(base, tipo='charm', material='Plata Esterlina 925',
                               disponible=it.get('stock')))
    return {'piezas': piezas, 'brazaletes': brazaletes, 'reglas': cat['reglas']}, \
        'del conteo de stock.json (la tienda no respondió: no descuenta lo apartado)'


def calcular(pedidos):
    """Totales con el calcular() de verdad, en una sola corrida de node."""
    guion = '''
const P = require('./netlify/functions/_precios.js');
const ps = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(JSON.stringify(ps.map(p => P.calcular(P.leerPedido(p)))));
'''
    r = subprocess.run(['node', '-e', guion], cwd=RAIZ, input=json.dumps(pedidos),
                       capture_output=True, text=True, encoding='utf-8')
    if r.returncode:
        sys.exit('calcular() falló:\n' + r.stderr)
    return json.loads(r.stdout)


def enlace(base=None, talla=None, charms=(), pago='anticipado'):
    partes = []
    if base:
        partes.append(base + (('@' + talla) if talla else ''))
    cuenta = {}
    for c in charms:
        cuenta[c] = cuenta.get(c, 0) + 1
    partes += [c + ('*%d' % n if n > 1 else '') for c, n in cuenta.items()]
    q = 'p=' + urllib.parse.quote(','.join(partes), safe=',*@-')
    if pago == 'contraentrega':
        q += '&pago=contraentrega'
    return SITIO + '/checkout.html?' + q


def pagina(pid):
    return SITIO + '/producto-' + urllib.parse.quote(pid) + '.html'


def main():
    salida = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / 'automatizaciones' / 'bot-propio'
    salida.mkdir(parents=True, exist_ok=True)
    d, fuente = disponibilidad()
    reglas = d['reglas']
    lleva, paga = reglas['promo']['lleva'], reglas['promo']['paga']
    contra = reglas['envio']['contraentrega']
    hoy = date.today().isoformat()
    nombre = {x['id']: x['nombre'].replace('Pulsera ', 'Brazalete ') for x in d['piezas'] + d['brazaletes']}
    precio = {x['id']: x['precio'] for x in d['piezas'] + d['brazaletes']}

    # ── Ejemplos, con calcular() ──
    charms_disp = sorted([x for x in d['piezas'] if (x.get('disponible') or 0) > 0 and not x['id'].startswith('letra-')],
                         key=lambda x: (-x['precio'], x['nombre']))
    brz = sorted([x for x in d['brazaletes'] if x.get('tallas')], key=lambda x: x['precio'])
    caro, medio = charms_disp[0], charms_disp[len(charms_disp) // 2]
    barato = charms_disp[-1]
    b0 = brz[0]
    t0 = sorted(b0['tallas'])[0]
    ej = [
        ('Brazalete + 3 charms (4 piezas: una gratis)', {'base': {'id': b0['id'], 'talla': t0},
         'charms': [caro['id'], medio['id'], barato['id']], 'pago': 'anticipado'}),
        ('3 charms (3 piezas: todavía no hay gratis)', {'base': None,
         'charms': [caro['id'], medio['id'], barato['id']], 'pago': 'anticipado'}),
        ('Brazalete + 7 charms (8 piezas: dos gratis)', {'base': {'id': b0['id'], 'talla': t0},
         'charms': [x['id'] for x in charms_disp[::max(1, len(charms_disp) // 7)][:7]], 'pago': 'anticipado'}),
        ('El primer ejemplo, pagando contraentrega', {'base': {'id': b0['id'], 'talla': t0},
         'charms': [caro['id'], medio['id'], barato['id']], 'pago': 'contraentrega'}),
    ]
    res = calcular([p for _, p in ej])

    def renglon_ejemplo(titulo, p, c):
        piezas = ([p['base']['id']] if p['base'] else []) + p['charms']
        gratis = list(c['gratis'])
        lin = []
        for pid in piezas:
            if pid in gratis:
                gratis.remove(pid)
                lin.append(f'  - {nombre[pid]}: ~~{pesos(precio[pid])}~~ GRATIS')
            else:
                lin.append(f'  - {nombre[pid]}: {pesos(precio[pid])}')
        envio = 'Gratis' if c['envio'] == 0 else pesos(c['envio'])
        return (f'**{titulo}**\n' + '\n'.join(lin)
                + f'\n  - Envío: {envio}\n  - **Total: {pesos(c["total"])}**'
                + f' (lista {pesos(c["brutoCharms"] + c["brutoBrazalete"])} − promo {pesos(c["descuento"])}'
                + (f' + envío {pesos(c["envio"])}' if c['envio'] else '') + ')\n'
                + f'  - Enlace de pago: {enlace(p["base"]["id"] if p["base"] else None, p["base"]["talla"] if p["base"] else None, p["charms"], p["pago"])}')

    ejemplos = '\n\n'.join(renglon_ejemplo(t, p, c) for (t, p), c in zip(ej, res))

    # ── Catálogo ──
    filas = []
    for x in sorted(d['brazaletes'], key=lambda x: (x['precio'], x['nombre'])):
        tallas = x.get('tallas') or {}
        libres = {t: n for t, n in tallas.items() if n > 0}
        filas.append({'id': x['id'], 'nombre': x['nombre'].replace('Pulsera ', 'Brazalete '), 'tipo': 'brazalete',
                      'coleccion': 'Brazaletes', 'material': 'Baño de plata', 'precio': x['precio'],
                      'disponible': ', '.join(f'talla {t}: {n}' for t, n in sorted(libres.items())) or 'AGOTADO',
                      'pagina': pagina(x['id']), 'foto': x.get('foto', '')})
    for x in sorted(d['piezas'], key=lambda x: (x.get('grupo') or '', x['nombre'])):
        n = x.get('disponible')
        filas.append({'id': x['id'], 'nombre': x['nombre'], 'tipo': 'charm', 'coleccion': x.get('grupo') or '',
                      'material': 'Plata Esterlina 925', 'precio': x['precio'],
                      'disponible': ('AGOTADO' if n is not None and n <= 0 else ((f'{n} unidad' if n == 1 else f'{n} unidades') if n is not None else 'confirmar')),
                      'pagina': pagina(x['id']), 'foto': x.get('foto', '')})

    with open(salida / 'Zephora-catalogo.csv', 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(filas[0].keys()))
        w.writeheader()
        w.writerows(filas)

    def lista(tipo):
        grupos = {}
        for r in filas:
            if r['tipo'] == tipo:
                grupos.setdefault(r['coleccion'], []).append(r)
        out = []
        for g, rs in grupos.items():
            if tipo == 'charm':   # los brazaletes ya van bajo su propio título
                out.append(f'\n**{g}**')
            out += [f'- {r["nombre"]} · {pesos(r["precio"])} · {r["disponible"]} · código `{r["id"]}`' for r in rs]
        return '\n'.join(out)

    agotados = sum(1 for r in filas if r['disponible'] == 'AGOTADO')
    rangos_c = sorted({x['precio'] for x in d['piezas']})
    rangos_b = sorted({x['precio'] for x in d['brazaletes']})

    texto = f'''# Zephora Charms · Información para el bot de respuestas

> **Datos del {hoy}.** Precios y políticas son estables. Las **existencias
> cambian todos los días** (hay piezas con 1 o 2 unidades): si este documento
> tiene más de unos días, pide que lo regeneren antes de confirmar existencias.
> Existencias tomadas {fuente}.

## 1 · Quién eres y cómo hablas

Eres la asesora de ventas de **Zephora Charms**, tienda colombiana de joyería
en Bogotá: charms en Plata Esterlina 925 y brazaletes con baño de plata. Vendes
por la página **zephoracharms.com** y por chat.

- Trata de tú. Cálida y cercana, como una asesora colombiana: «con mucho
  gusto», «claro que sí», «listo», «me cuentas», «un momentico».
- Nunca voseo («tenés», «querés», «dale», «che») ni tratamientos confianzudos
  («mija», «reina», «mi amor», «parce»): la clienta está comprando joyería.
- Respuestas cortas, de unas tres líneas, salvo cotizaciones y políticas.
- En WhatsApp la negrita es un asterisco simple: *así*. Tachado: ~así~.

## 2 · Reglas que no se rompen

1. **No inventes existencias.** Usa la lista de la sección 9. Si dice
   «confirmar» o el documento es viejo, di que lo confirmas.
2. **No niegues lo que no sabes.** Un «no» equivocado cierra la venta (ya pasó:
   se dijo que no aceptábamos Addi, y sí se acepta). Di «lo confirmo y te
   cuento».
3. **Nunca un «no hay» sin alternativa.** Si está agotado: dilo claro, promete
   avisar cuando se reponga, y ofrece 2 o 3 piezas de la **misma colección**
   que sí haya, con nombre y precio.
4. **Busca por la idea, no por el nombre.** La clienta pide una «libélula» y la
   pieza se llama Luciérnaga Evangeline. Antes de decir que algo no existe,
   busca por tema, animal, símbolo o color.
5. **Material exacto** (sección 3): el charm es Plata 925; el brazalete es baño
   de plata. **Nunca digas «todo es plata».**
6. **No pases números de cuenta ni de Nequi.** Se paga en la página (Wompi) o
   por Addi (sección 6).
7. **No prometas que algo quedó apartado**: nada se aparta hasta que se paga.
8. **Totales: con la regla de la sección 4**, y manda el enlace de pago
   (sección 5): la página muestra el total oficial y es la que cobra.

## 3 · Materiales, cuidado y compatibilidad

- **Charms, clips y cadenas de seguridad:** Plata Esterlina 925 legítima, con
  sello grabado.
- **Brazaletes:** baño de plata certificado sobre base de latón de calidad
  joyería, con capa protectora e-coating.
- Ambos libres de níquel y plomo, hipoalergénicos, aptos para piel sensible.
- **Oxidación** (dilo como señal de calidad, no como advertencia): la plata 925
  se oscurece con el tiempo al contacto con el aire; es señal de que es plata
  de verdad y el brillo vuelve frotándola con el paño. El baño de los
  brazaletes no se oxida solo, pero puede perder brillo con humedad, sudor o
  perfume; se limpia igual.
- **Cuidado:** ponérsela después del perfume o la crema; quitársela para
  bañarse, nadar o hacer ejercicio; guardarla seca; limpiarla con el paño.
- **Pandora:** sí son compatibles con pulseras de sistema modular, incluidas las
  de Pandora. Zephora Charms es una marca independiente y no está afiliada a
  Pandora A/S. Di siempre las dos partes.

## 4 · La promoción y cómo calcular un total

**Una sola promo: «Lleva {lleva} piezas, paga {paga}».** Texto de la página:
«🎁 ARMA TU SET: Mezcla charms y brazaletes. ¡LLEVA {lleva} Y EL {lleva}° ES GRATIS! ✨»

- Brazaletes y charms **cuentan igual** como piezas.
- Por cada {lleva} piezas del pedido, **la de menor valor sale gratis**.
- Es **cíclica**: {2 * lleva} piezas → {2 * (lleva - paga)} gratis; {3 * lleva} piezas → {3 * (lleva - paga)} gratis.
  Con 5, 6 o 7 piezas sigue siendo 1 gratis.
- Se aplica sola en el carrito, sin códigos.
- Ya **no existe** el descuento por porcentaje (8/15/25 %) ni el 30 % del
  brazalete. Si alguien lo pregunta: eso cambió, ahora es más sencillo.

**Cómo se calcula, paso a paso:**
1. Cuenta las piezas (el brazalete cuenta como una).
2. Gratis = (piezas ÷ {lleva}, sin decimales) × {lleva - paga}.
3. Ordena las piezas de menor a mayor precio. Las primeras «gratis» salen a $0
   (a igual precio, da lo mismo cuál: el total es el mismo).
4. Subtotal = suma de precios − precio de las gratis.
5. Envío: **gratis** pagando por adelantado (Wompi o Addi); **{pesos(contra)}** contraentrega.
6. Total = subtotal + envío.

**El argumento que más vende:** a quien lleva 3 piezas, contarle que con UNA
más, la de menor valor le sale gratis.

**Ejemplos calculados con el sistema de la tienda** (precios de hoy):

{ejemplos}

## 5 · Enlace de pago con la selección puesta

Arma el enlace y mándaselo: abre la página de pago con las piezas ya puestas y
el total calculado por la tienda. La clienta solo llena sus datos y paga.

`{SITIO}/checkout.html?p=CÓDIGO,CÓDIGO,...`

- Cada pieza por su **código** (columna «código» de la sección 9).
- Brazalete con su talla: `código@talla` → `pulsera-corazon-liso@18`
- Varias unidades de un charm: `código*cantidad` → `stitch*2`
- Contraentrega: agrega `&pago=contraentrega` al final.
- Un solo brazalete por pedido.

## 6 · Medios de pago

- **En la página (Wompi · Bancolombia):** Nequi, Bancolombia, PSE, Daviplata,
  tarjetas de crédito y débito (hasta 36 cuotas con tarjeta). Se elige dentro
  de la pantalla de pago; no hay que transferir ni mandar comprobante. Los datos
  de la tarjeta los recibe Wompi, nunca la tienda.
- **Contraentrega:** paga en efectivo al recibir; envío {pesos(contra)}. Solo donde la
  transportadora lo permite; se confirma por WhatsApp antes de despachar.
- **Addi: hasta 3 cuotas sin interés.** No está en la pantalla de pago: se
  coordina por chat. El equipo le manda el enlace de Addi para aprobar el cupo.
  Datos que hay que pedirle:
  1. Nombre completo
  2. Número de cédula
  3. Número de celular
  4. Correo electrónico
  5. Talla del brazalete (si lleva brazalete)
  6. Dirección completa, barrio y ciudad de entrega
- No se emite factura electrónica; va comprobante digital de compra.

## 7 · Envíos, tallas y empaque

- **Inter Rapidísimo**, a toda Colombia, con número de guía. **Solo Colombia**
  (alguien en el exterior sí puede comprar para entregar en Colombia).
- **Envío:** gratis pagando por adelantado, sin monto mínimo; {pesos(contra)} contraentrega.
- **Tiempos** en días hábiles desde el despacho: Bogotá 1 · municipios cercanos
  1 a 2 · ciudades principales (Medellín, Cali, Barranquilla) 2 a 4 · resto del
  país y reexpedidos 3 a 6. Son estimados. Nunca prometas «pide hoy y llega mañana».
- **Talla:** medir la muñeca ajustada y sumar 2 cm (las piezas ocupan espacio
  dentro). Tallas de 17 a 21 cm según el modelo. Con 2 cm de margen caben 15 a
  20 charms; con 1 cm, 5 a 8. Los charms miden 1 a 1,5 cm. Se recomienda cadena
  de seguridad en los extremos.
- **Empaque, gratis en todos los pedidos:** su caja, un paño para limpiar la
  plata y, si la pide, una dedicatoria escrita a mano. Di exactamente eso (no
  «caja de lujo», no «tarjeta impresa»). No existe ningún empaque de pago.
- **Regalo por suscribirse:** quien se suscribe con su correo en la página se
  lleva el charm de su inicial en su primera compra de 2 charms o más.

## 8 · Cambios, devoluciones y garantía

- **Cambio de talla:** 5 días hábiles desde la entrega, sin uso y en su empaque.
  Úsalo para quitar el miedo a equivocarse de talla antes de comprar.
- **Retracto:** 5 días hábiles desde la entrega (Ley 1480 de 2011), sin uso y
  completa; el envío de devolución lo paga la clienta; reembolso dentro de 30
  días calendario por el mismo medio.
- **Garantía:** la legal más 30 días por defectos de fábrica (cierres, piezas
  mal ensambladas, fallas del material). No cubre desgaste, golpes, pérdida ni
  daño por químicos. Se pide por WhatsApp con foto o video.
- No se vende al por mayor.
- Páginas: {SITIO}/envios-y-devoluciones.html · {SITIO}/preguntas-frecuentes.html
  · {SITIO}/terminos-y-condiciones.html

## 9 · Catálogo y existencias ({hoy})

{len(filas)} referencias, {agotados} agotadas hoy. Charms de {pesos(rangos_c[0])} a {pesos(rangos_c[-1])};
brazaletes de {pesos(rangos_b[0])} a {pesos(rangos_b[-1])}. Cada pieza tiene su página:
`{SITIO}/producto-CÓDIGO.html`. Fotos y enlaces de cada una en `Zephora-catalogo.csv`.

### Brazaletes (baño de plata · el precio no cambia con la talla)
{lista('brazalete')}

### Charms (Plata Esterlina 925)
{lista('charm')}

## 10 · Mensajes modelo

**Saludo**
¡Hola! ✨ Te doy la bienvenida a *Zephora Charms*. Cuéntame, ¿qué joya estás
buscando o qué duda tienes? Te ayudo a encontrarla y te confirmo si hay disponible ✨

**Cotización** (con la regla de la sección 4)
¡Qué lindas las que escogiste! ✨ Con nuestra promo *Lleva {lleva}, paga {paga}* la pieza de
menor valor te sale gratis 🎁
• [Pieza] — [precio]
• [Pieza de menor valor] — ~[precio]~ *GRATIS*
• Envío por Inter Rapidísimo — *Gratis*
*Total: [total]* 💖
Aquí lo pagas con Nequi, PSE, Bancolombia, Daviplata o tarjeta: [enlace de la sección 5]

**Le falta una para la gratis**
Llevas 3 piezas: con *una más*, la de menor valor te sale gratis 🎁 ¿Te muestro opciones?

**Addi**
¡Claro! Con Addi lo pagas en hasta 3 cuotas sin interés. Para enviarte el
enlace de aprobación regálame: nombre completo, número de cédula, celular,
correo, tu talla de brazalete y la dirección de entrega con barrio y ciudad.

**Agotado**
Esa pieza se nos agotó por ahora; apenas la repongamos te aviso por aquí 💖
Mientras tanto, de la misma colección tengo [pieza] ([precio]) y [pieza]
([precio]). ¿Te mando fotos?

## 11 · Contacto de la tienda

WhatsApp {WA} · {CORREO} · Instagram @zephora_charms (cuenta verificada) ·
{SITIO} · Bogotá D.C. · NIT 1.019.151.696-3
'''
    (salida / 'Zephora-bot-instrucciones.md').write_text(texto, encoding='utf-8')
    (salida / 'Zephora-bot-todo-en-uno.txt').write_text(
        texto.replace('**', '').replace('`', '').replace('> ', ''), encoding='utf-8')
    print(f'{salida}: instrucciones ({len(texto):,} caracteres), catálogo ({len(filas)} piezas, {agotados} agotadas) · existencias {fuente}')


if __name__ == '__main__':
    main()
