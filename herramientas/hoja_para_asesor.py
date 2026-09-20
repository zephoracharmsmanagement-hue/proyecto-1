#!/usr/bin/env python3
"""Genera el PDF que se le carga a un asesor de IA externo (Gemini y similares).

    python3 herramientas/hoja_para_asesor.py

Escribe `automatizaciones/asesor-externo/Zephora-informacion-AAAA-MM-DD.pdf`.

── Por qué es un script y no un documento escrito a mano ──

Porque un PDF es una copia congelada, y en este proyecto las copias congeladas
ya costaron cuatro fallos delante de clientas, todos del mismo tipo y ninguno
con un error visible:

  · El asesor cobraba de palabra un envío que era gratis.
  · Negaba que se aceptara Addi, con el botón de Addi de la tienda llevando a
    esa misma conversación.
  · Decía que los brazaletes eran baño de plata después de que pasaran a ser
    Plata 925 —que es el motivo por el que subieron de precio—.
  · No sabía explicar las promociones, que son el mejor argumento de venta.

Todos se descubrieron porque alguien leyó un chat, no porque algo fallara.

Así que este PDF se **genera** desde `catalogo.json` y `stock.json`, que son los
mismos archivos con los que el servidor calcula lo que se cobra. Si el precio
cambia, se regenera y ya. Escribirlo a mano sería fabricar la quinta copia.

── Lo que NO arregla ──

Sigue siendo una foto del día que se generó. El inventario se mueve solo: en
esta tienda hay piezas con una o dos unidades y se agotan en horas. Por eso el
documento lleva la fecha en grande, dice cuántas unidades tenía cada pieza en
ese momento, y le ordena al asesor no prometer existencias sin confirmarlas.

La solución de verdad es que el asesor consulte
`zephoracharms.com/.netlify/functions/disponibilidad`, que devuelve inventario
real menos lo apartado. Este PDF es el plan B para una herramienta que no puede
llamar a una URL.
"""
import json
import pathlib
import sys
from datetime import date

RAIZ = pathlib.Path(__file__).resolve().parent.parent
DESTINO = RAIZ / 'automatizaciones' / 'asesor-externo'

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (PageBreak, Paragraph, SimpleDocTemplate,
                                    Spacer, Table, TableStyle)
except ImportError:
    sys.exit('Falta reportlab.  pip install reportlab')

TINTA = colors.HexColor('#2E1F2E')
ROSA = colors.HexColor('#B5838D')
SUAVE = colors.HexColor('#F4EDEF')
GRIS = colors.HexColor('#6B6069')


def pesos(n):
    return '$' + f'{n:,}'.replace(',', '.')


def unidades(item):
    """Un charm cuenta por pieza y un brazalete por talla. Leer `stock` a secas
    da CERO para los 18 brazaletes sin dar ningún error — la trampa ya cazada en
    el motor de contenido, y aquí saldría como catálogo entero agotado."""
    if 'tallas' in item and item['tallas']:
        return sum(item['tallas'].values())
    return item.get('stock', 0)


def tallas_libres(item):
    if 'tallas' not in item or not item['tallas']:
        return None
    return [t for t, q in item['tallas'].items() if q > 0]


def main():
    cat = json.loads((RAIZ / 'assets' / 'catalogo.json').read_text(encoding='utf-8'))
    inv = json.loads((RAIZ / 'assets' / 'stock.json').read_text(encoding='utf-8'))
    items = inv.get('items', inv)
    reglas = cat['reglas']
    hoy = date.today().isoformat()

    DESTINO.mkdir(parents=True, exist_ok=True)
    salida = DESTINO / f'Zephora-informacion-{hoy}.pdf'

    ss = getSampleStyleSheet()
    H1 = ParagraphStyle('H1', parent=ss['Heading1'], textColor=TINTA,
                        fontSize=17, spaceAfter=4, spaceBefore=12)
    H2 = ParagraphStyle('H2', parent=ss['Heading2'], textColor=ROSA,
                        fontSize=12, spaceAfter=3, spaceBefore=10)
    P = ParagraphStyle('P', parent=ss['Normal'], textColor=TINTA,
                       fontSize=9.5, leading=13.5, spaceAfter=5)
    NOTA = ParagraphStyle('NOTA', parent=P, textColor=GRIS, fontSize=8.5,
                          leading=12)

    d = []
    A = d.append

    A(Paragraph('Zephora Charms', ParagraphStyle(
        'T', parent=ss['Title'], textColor=TINTA, fontSize=26, spaceAfter=2)))
    A(Paragraph('Información para el asesor de atención al cliente',
                ParagraphStyle('S', parent=P, fontSize=12, textColor=ROSA,
                               spaceAfter=10)))

    A(Table([[Paragraph(
        f'<b>Datos del {hoy}.</b> El inventario cambia todos los días: hay piezas '
        'con una o dos unidades que se agotan en horas. Si este documento tiene '
        'más de una semana, pide que lo regeneren antes de confiar en las '
        'existencias. Los precios y las políticas sí son estables.', NOTA)]],
        colWidths=[165 * mm],
        style=TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), SUAVE),
            ('BOX', (0, 0), (-1, -1), 0.6, ROSA),
            ('LEFTPADDING', (0, 0), (-1, -1), 9),
            ('RIGHTPADDING', (0, 0), (-1, -1), 9),
            ('TOPPADDING', (0, 0), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7)])))
    A(Spacer(1, 10))

    # ── Reglas de conducta, primero: es lo que evita los fallos conocidos ──
    A(Paragraph('Cómo debes responder', H1))
    A(Paragraph(
        'Estas reglas salen de errores reales que ya costaron ventas. No son '
        'recomendaciones de estilo.', NOTA))

    reglas_txt = [
        ('Nunca digas que no sabes si puedes averiguarlo',
         'Un «no» equivocado cierra la venta en el acto y no se puede desandar. '
         'Si algo no está en este documento, di que lo confirmas y que alguien '
         'del equipo escribe enseguida. Eso no es lo mismo que negar. Ya pasó: '
         'preguntaron si aceptábamos Addi, se dijo que no, y sí se acepta.'),
        ('Nunca describas el material de memoria',
         'Toda la joyería —charms Y brazaletes— es Plata Esterlina 925 legítima '
         'con sello S925 grabado. Los brazaletes fueron enchapados en el pasado '
         'y dejaron de serlo: decir «baño de plata» hoy es falso y además regala '
         'el motivo por el que subieron de precio.'),
        ('Nunca calcules un total',
         'Explica los porcentajes de descuento, jamás los pesos de una '
         'combinación concreta, ni siquiera aproximados. Un total que no cuadre '
         'con el checkout es una clienta que se siente engañada al pagar. '
         'Que arme su pulsera en la tienda y el sitio calcula solo.'),
        ('Nunca dejes un «no hay» sin alternativa',
         'Si algo está agotado: dilo claro, promete avisar cuando se reponga, y '
         'ofrece dos o tres piezas del MISMO grupo que sí tengan unidades, '
         'nombrándolas con su nombre y su precio. Nadie compra una descripción '
         'como «algo parecido en morado»; se compra una pieza con nombre.'),
        ('Busca por la idea, no por el nombre literal',
         'La clienta no usa los nombres del catálogo. Pidió una «libélula» y la '
         'pieza que le servía se llama Luciérnaga «You Are My Light»: mismo '
         'grupo, mismo precio, con unidades. Antes de decir que algo no existe, '
         'revisa el catálogo por concepto —qué animal, qué símbolo, qué tema—.'),
        ('Nunca pases datos bancarios',
         'Ni números de cuenta ni celulares de Nequi. Todos los medios de pago '
         'se eligen dentro del checkout de la página.'),
        ('Nunca prometas que algo queda apartado',
         'El sistema no reserva nada hasta que se paga. Puedes decir que lo '
         'consultas con el equipo, nunca que ya quedó guardado.'),
    ]
    for titulo, cuerpo in reglas_txt:
        A(Paragraph(f'<b>{titulo}.</b> {cuerpo}', P))

    # ── Materiales ──
    A(Paragraph('Materiales', H1))
    A(Paragraph(
        '<b>Todo es Plata Esterlina 925 legítima</b>, con el sello S925 grabado '
        'en cada pieza: tanto los charms como los brazaletes. Libre de níquel y '
        'plomo, hipoalergénica, apta para pieles sensibles.', P))
    A(Paragraph(
        '<b>Sobre la oxidación, y conviene adelantarse.</b> La plata 925 sí se '
        'oxida con el tiempo al contacto con el aire. No es un defecto: es una '
        'de las señales de que es plata de verdad. El brillo se recupera con un '
        'paño de joyería.', P))
    A(Paragraph(
        '<b>Cuidado:</b> no mojarla, perfumarse antes de ponérsela, guardarla '
        'seca en su bolsa, quitársela para bañarse, nadar o hacer ejercicio.', P))
    A(Paragraph(
        '<b>Compatibilidad:</b> sí sirven con pulseras de sistema modular, '
        'incluidas las de Pandora. Zephora Charms es una marca independiente y '
        'no está afiliada a Pandora A/S. Di siempre las dos partes.', P))

    # ── Promociones, con las cifras sacadas de las reglas reales ──
    A(Paragraph('Promociones', H1))
    A(Paragraph(
        'Se aplican solas mientras arma la pulsera en el sitio. No hay códigos '
        'ni letra pequeña. <b>Los dos descuentos se suman</b>, y ese es el dato '
        'que más cierra pedidos.', P))

    escala = [[Paragraph('<b>Charms</b>', P), Paragraph('<b>Descuento</b>', P),
               Paragraph('<b>Sobre qué aplica</b>', P)]]
    for n, desc in enumerate(reglas['escalaCharms']):
        if desc == 0:
            continue
        etiqueta = f'{n} o más' if n == len(reglas['escalaCharms']) - 1 else str(n)
        extra = ' — «lleva 4 y paga 3»' if desc >= 0.25 else ''
        escala.append([Paragraph(etiqueta, P),
                       Paragraph(f'<b>{round(desc * 100)}%</b>{extra}', P),
                       Paragraph('El total de charms, no solo el último', P)])
    A(Table(escala, colWidths=[25 * mm, 60 * mm, 80 * mm], style=TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), SUAVE),
        ('LINEBELOW', (0, 0), (-1, -1), 0.4, colors.HexColor('#E3D7DB')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4)])))
    A(Spacer(1, 6))
    A(Paragraph(
        f'<b>Y el brazalete baja un {round(reglas["descuentoBrazalete"] * 100)}%</b> '
        f'llevando {reglas["minCharmsParaDescuento"]} charms o más. A quien duda '
        'entre dos y tres piezas, contarle que con la tercera sube el descuento '
        '<i>y</i> además se activa el del brazalete suele cerrar el pedido.', P))

    # ── Pagos y envíos ──
    A(Paragraph('Pagos y envíos', H1))
    A(Paragraph('Medios de pago', H2))
    A(Paragraph(
        'Transferencia a <b>Bancolombia, Nequi y Daviplata</b>; pagos en línea '
        'con <b>PSE</b>; <b>tarjetas</b> de crédito y débito; financiación a '
        'cuotas con <b>Addi</b>; y <b>contraentrega</b> donde la transportadora '
        'lo permite.', P))
    A(Paragraph(
        '<b>Todos se eligen dentro del checkout</b>, en la pantalla de pago. La '
        'clienta no transfiere a mano ni manda comprobante. El pago lo procesa '
        '<b>Wompi (Bancolombia)</b>, no la tienda —esa frase se puede decir tal '
        'cual y responde sola la pregunta de si es seguro—. Los datos de la '
        'tarjeta no pasan por la tienda en ningún momento.', P))
    A(Paragraph(
        '<b>Addi es la excepción:</b> sí se acepta, pero no se procesa solo en '
        'el checkout. Se gestiona por WhatsApp; el equipo le pasa el enlace de '
        'Addi para aprobar el cupo. Nunca digas que no lo manejamos.', P))

    A(Paragraph('Envíos', H2))
    gratis = reglas['envioGratisDesde'] == 0
    A(Paragraph(
        'Transportadora <b>Inter Rapidísimo</b>, a todo el territorio nacional. '
        + ('Con <b>pago anticipado el envío es GRATIS</b> a toda Colombia, '
           '<b>sin monto mínimo</b>. Es argumento de venta, no letra pequeña. '
           if gratis else
           f'Con pago anticipado cuesta {pesos(reglas["envio"]["anticipado"])}. ')
        + f'Con <b>contraentrega cuesta {pesos(reglas["envio"]["contraentrega"])}</b>, '
        'tarifa plana: es lo que cobra la transportadora por recaudar el dinero '
        'en la entrega, y solo aplica donde ella lo permite.', P))
    A(Paragraph(
        '<b>Tiempos</b>, en días hábiles desde el despacho: Bogotá y alrededores '
        '1 a 2 · ciudades principales 2 a 4 · resto del país y reexpedidos 3 a 6. '
        'Son estimados. Al despachar se manda el número de guía.', P))
    A(Paragraph(
        '<b>Solo Colombia.</b> No hay envíos internacionales por ahora. Pero si '
        'quien escribe está en el exterior comprando para alguien en Colombia, '
        'eso sí se puede, y ahí hay venta.', P))

    A(Paragraph('Empaque, devoluciones y garantía', H1))
    A(Paragraph(
        '<b>Caja básica incluida y sin costo</b> en todos los pedidos, junto con '
        'su bolsa. <b>No existe hoy ningún empaque de pago en la página</b>: '
        'había un Empaque Premium y se retiró, así que no lo menciones ni lo '
        'sumes a un pedido. Sí hay cajas premium fuera de la web; si preguntan, '
        'el equipo les pasa foto y precio. En el checkout se puede escribir una '
        'dedicatoria, y va a mano en la tarjeta, sin costo.', P))
    A(Paragraph(
        '<b>Cambio de talla:</b> 5 días hábiles desde la entrega, pieza sin uso y '
        'en su empaque. Es distinto de devolver: se queda con la pulsera y solo '
        'cambia la medida. Dilo <i>antes</i> de que compre si duda de la talla — '
        'quita el miedo a equivocarse y cierra pedidos.', P))
    A(Paragraph(
        '<b>Retracto:</b> 5 días hábiles desde la entrega (Ley 1480 de 2011), '
        'pieza sin uso y completa; el transporte de devolución lo paga la '
        'clienta y el reembolso sale dentro de los 30 días calendario. '
        '<b>Garantía:</b> la legal más 30 días por defectos de fábrica. No cubre '
        'desgaste por uso, golpes, pérdida de piezas ni daño por químicos.', P))
    A(Paragraph(
        '<b>Talla:</b> se mide la muñeca ajustada y se le suman 2 cm. Esos 2 cm '
        'no sobran: al llenarse de charms, el grosor de las piezas se come unos '
        '2 cm del diámetro útil. Con ese margen caben entre 15 y 20 charms; con '
        'solo 1 cm, entre 5 y 8. En la tienda hay calculadora de talla.', P))
    A(Paragraph('No se emite factura electrónica; va comprobante digital de '
                'compra. No se vende al por mayor.', P))

    # ── Catálogo ──
    A(PageBreak())
    A(Paragraph('Catálogo', H1))
    disponibles = [k for k in cat['precios'] if unidades(items.get(k, {})) > 0]
    agotadas = [k for k in cat['precios'] if unidades(items.get(k, {})) == 0]
    A(Paragraph(
        f'{len(cat["precios"])} referencias. <b>{len(disponibles)} con unidades</b> '
        f'y {len(agotadas)} agotadas el {hoy}. La columna de unidades es el último '
        'conteo y <b>no descuenta lo que se esté pagando en ese momento</b>: '
        'trátala como orientación, nunca como promesa.', NOTA))
    A(Spacer(1, 4))

    orden = ['Disney', 'Pixar', 'Marvel', 'Zodiaco', 'Letras', 'Símbolos',
             'Muranos', 'Profesiones', 'Clips', 'Cadenas']
    grupos = {}
    for pid in cat['precios']:
        grupos.setdefault(cat['grupos'].get(pid, 'Otros'), []).append(pid)
    brazaletes = set(cat['pulseras'])
    orden_final = [g for g in orden if g in grupos] + \
                  [g for g in sorted(grupos) if g not in orden and
                   not set(grupos[g]) & brazaletes]

    def tabla(ids, con_tallas=False):
        filas = [[Paragraph('<b>Pieza</b>', P), Paragraph('<b>Precio</b>', P),
                  Paragraph('<b>Unidades</b>', P)]]
        for pid in sorted(ids, key=lambda k: cat['nombres'][k]):
            q = unidades(items.get(pid, {}))
            if q == 0:
                estado = '<font color="#B03A2E">Agotada</font>'
            elif con_tallas:
                libres = tallas_libres(items.get(pid, {})) or []
                estado = f'{q} · tallas {", ".join(libres)}' if libres else str(q)
            else:
                estado = str(q)
            filas.append([Paragraph(cat['nombres'][pid], P),
                          Paragraph(pesos(cat['precios'][pid]), P),
                          Paragraph(estado, P)])
        return Table(filas, colWidths=[95 * mm, 28 * mm, 42 * mm],
                     repeatRows=1, style=TableStyle([
                         ('BACKGROUND', (0, 0), (-1, 0), SUAVE),
                         ('LINEBELOW', (0, 0), (-1, -1), 0.3,
                          colors.HexColor('#E8DEE2')),
                         ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                         ('TOPPADDING', (0, 0), (-1, -1), 2.5),
                         ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5)]))

    for g in orden_final:
        A(Paragraph(g, H2))
        A(tabla(grupos[g]))
        A(Spacer(1, 5))

    A(Paragraph('Brazaletes', H2))
    A(Paragraph('Se venden por talla. Solo se ofrecen las tallas con unidades.',
                NOTA))
    A(tabla(sorted(brazaletes), con_tallas=True))

    A(Spacer(1, 10))
    A(Paragraph(
        f'Generado el {hoy} desde catalogo.json y stock.json, los mismos '
        'archivos con los que el servidor calcula lo que se cobra. Para '
        'regenerarlo: <font face="Courier">python3 herramientas/hoja_para_asesor.py</font>', NOTA))

    SimpleDocTemplate(
        str(salida), pagesize=A4,
        leftMargin=22 * mm, rightMargin=22 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title=f'Zephora Charms · Información para el asesor ({hoy})',
        author='Zephora Charms').build(d)

    print(f'{salida.relative_to(RAIZ)}')
    print(f'  {len(cat["precios"])} referencias · {len(disponibles)} con unidades '
          f'· {len(agotadas)} agotadas')


if __name__ == '__main__':
    main()
