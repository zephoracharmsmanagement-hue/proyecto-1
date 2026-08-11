#!/usr/bin/env python3
"""Genera las páginas legales y de información de zephoracharms.com.

Todas comparten cabecera, pie y legal.css; sólo cambia el cuerpo. Se generan
desde aquí para que los cinco archivos no se desincronicen entre sí.
"""
import pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent
WA = '573018990672'
WA_LEGAL = ('https://wa.me/573018990672?text=Hola%2C%20Zephora%20Charms.%20Vengo%20de%20la'
            '%20p%C3%A1gina%20web%20y%20tengo%20una%20consulta%20sobre%20sus%20pol%C3%ADticas'
            '%20de%20compra.')
ACTUALIZADO = '8 de agosto de 2026'

PAGS = [
    ('politica-de-privacidad.html', 'Política de privacidad'),
    ('terminos-y-condiciones.html', 'Términos y condiciones'),
    ('envios-y-devoluciones.html', 'Envíos y devoluciones'),
    ('preguntas-frecuentes.html', 'Preguntas frecuentes'),
    ('politica-de-cookies.html', 'Política de cookies'),
]

SHELL = '''<!DOCTYPE html>
<html lang="es-CO">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{titulo} · Zephora Charms</title>
<meta name="description" content="{desc}">
<link rel="icon" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iNCIgZmlsbD0iIzJBMUYyRSIvPjx0ZXh0IHg9IjE2IiB5PSIyMyIgZm9udC1mYW1pbHk9Ikdlb3JnaWEsc2VyaWYiIGZvbnQtc2l6ZT0iMTkiIGZpbGw9IiNGNkYzRjQiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlo8L3RleHQ+PC9zdmc+">
<meta name="theme-color" content="#2A1F2E">
<link rel="canonical" href="https://zephoracharms.com/{archivo}">
<meta property="og:type" content="article">
<meta property="og:locale" content="es_CO">
<meta property="og:site_name" content="Zephora Charms">
<meta property="og:title" content="{titulo} · Zephora Charms">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="https://zephoracharms.com/{archivo}">
<meta property="og:image" content="https://zephoracharms.com/assets/pulsera-armada-con-muranos-camaleon-verde-y-atrapa.jpg">
<meta property="og:image:width" content="800">
<meta property="og:image:height" content="600">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://zephoracharms.com/assets/pulsera-armada-con-muranos-camaleon-verde-y-atrapa.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="legal.css">
{extra_head}</head>
<body>

<header class="top">
  <div class="top-in">
    <a class="brand" href="index.html">Zephora <em>Charms</em></a>
    <a class="back" href="index.html">← Volver a la tienda</a>
  </div>
</header>

<main class="doc wrap">
  <span class="eyebrow">{eyebrow}</span>
  <h1>{titulo}</h1>
  <p class="upd">Última actualización: {actualizado}</p>
{cuerpo}
  <div class="cta">
    <h2>¿Te queda alguna duda?</h2>
    <p>Escríbenos por WhatsApp y te responde una persona del equipo, de lunes a sábado de
    9:00 a.m. a 6:00 p.m. También puedes escribirnos a
    <a href="mailto:zephoracharms@gmail.com">zephoracharms@gmail.com</a>.</p>
    <a class="btn" href="{wa_legal}">Escribir por WhatsApp</a>
  </div>
</main>

<footer class="foot">
  <div class="wrap">
    <ul class="foot-nav">
      <li><a href="index.html">Tienda</a></li>
      <li><a href="preguntas-frecuentes.html">Preguntas frecuentes</a></li>
      <li><a href="envios-y-devoluciones.html">Envíos y devoluciones</a></li>
      <li><a href="politica-de-privacidad.html">Política de privacidad</a></li>
      <li><a href="terminos-y-condiciones.html">Términos y condiciones</a></li>
      <li><a href="politica-de-cookies.html">Política de cookies</a></li>
    </ul>
    <p>© 2024–<span id="year">2026</span> Zephora Charms · NIT 1.019.151.696-3 · Bogotá D.C., Colombia<br>
    WhatsApp <a href="{wa_legal}">+57 301 899 0672</a> ·
    <a href="mailto:zephoracharms@gmail.com">zephoracharms@gmail.com</a></p>
  </div>
</footer>
<script>document.getElementById('year').textContent=new Date().getFullYear();</script>
</body>
</html>
'''

# ---------------------------------------------------------------- privacidad
PRIVACIDAD = '''  <div class="note">
    <p>Zephora Charms trata tus datos personales conforme a la <b>Ley 1581 de 2012</b>, el
    <b>Decreto 1074 de 2015</b> y demás normas colombianas de protección de datos. Al escribirnos
    por WhatsApp o al enviarnos tu pedido, autorizas el tratamiento descrito en esta política.</p>
  </div>

  <h2>1. Responsable del tratamiento</h2>
  <p><b>Zephora Charms</b>, identificada con <b>NIT 1.019.151.696-3</b>, tienda virtual con
  operación en Bogotá D.C., Colombia, es responsable del tratamiento de los datos personales
  recolectados a través de este sitio y de sus canales de atención.</p>
  <p>Canales de contacto para asuntos de datos personales:</p>
  <ul>
    <li><a href="{wa_legal}">WhatsApp +57 301 899 0672</a>,
      de lunes a sábado de 9:00 a.m. a 6:00 p.m.</li>
    <li>Correo electrónico: <a href="mailto:zephoracharms@gmail.com">zephoracharms@gmail.com</a></li>
  </ul>

  <h2>2. Qué datos recolectamos</h2>
  <p>Este sitio web <b>no tiene formularios de registro ni pasarela de pago</b>: no te pedimos
  crear una cuenta ni ingresar datos bancarios en la página. Los datos personales aparecen
  únicamente cuando decides escribirnos. En concreto:</p>
  <table>
    <tr><th>Categoría</th><th>Qué incluye</th><th>Cuándo se recoge</th></tr>
    <tr><td>Datos de contacto</td><td>Nombre y número de teléfono</td>
      <td>Cuando inicias la conversación por WhatsApp</td></tr>
    <tr><td>Datos de entrega</td><td>Dirección, ciudad y datos que necesita la transportadora</td>
      <td>Sólo si confirmas un pedido</td></tr>
    <tr><td>Datos del pedido</td><td>Piezas elegidas, talla, valor y forma de pago acordada</td>
      <td>Durante la conversación de compra</td></tr>
    <tr><td>Datos de navegación</td><td>Identificadores de cookies, páginas vistas, dispositivo y
      ciudad aproximada</td><td>Al navegar el sitio, mediante el píxel de Meta</td></tr>
  </table>

  <h2>3. Para qué usamos tus datos</h2>
  <ul>
    <li>Atender tus consultas y asesorarte en la elección de piezas y talla.</li>
    <li>Gestionar tu pedido: confirmarlo, prepararlo, despacharlo y hacerle seguimiento.</li>
    <li>Coordinar la entrega con la transportadora y, si aplica, el pago contraentrega.</li>
    <li>Atender solicitudes de cambio, garantía o retracto.</li>
    <li>Medir el rendimiento de nuestra publicidad y mostrar anuncios a personas con intereses
      similares, mediante el píxel de Meta.</li>
    <li>Enviarte información sobre promociones, <b>únicamente si nos das tu autorización expresa</b>.</li>
  </ul>

  <h2>4. Con quién compartimos tus datos</h2>
  <p>No vendemos ni cedemos tus datos personales. Los compartimos sólo con quienes hacen falta
  para que tu pedido llegue y para que el sitio funcione:</p>
  <ul>
    <li><b>Meta Platforms Ireland Ltd.</b> — WhatsApp Business, con el que atendemos la venta, y
      el píxel de Meta, que mide la efectividad de nuestros anuncios. Esto implica una
      transferencia internacional de datos, que autorizas al usar estos canales.</li>
    <li><b>Empresas transportadoras</b> — reciben nombre, teléfono y dirección para entregar tu pedido.</li>
    <li><b>Netlify, Inc.</b> — proveedor de alojamiento del sitio, ubicado fuera de Colombia.</li>
    <li><b>Autoridades</b> — cuando exista una orden judicial o administrativa que nos obligue.</li>
  </ul>

  <h2>5. Tus derechos como titular</h2>
  <p>La Ley 1581 de 2012 te reconoce el derecho a:</p>
  <ul>
    <li><b>Conocer, actualizar y rectificar</b> tus datos personales.</li>
    <li><b>Solicitar prueba</b> de la autorización que nos otorgaste.</li>
    <li><b>Ser informado</b> sobre el uso que le hemos dado a tus datos.</li>
    <li><b>Revocar la autorización</b> o solicitar la supresión de tus datos, cuando no exista un
      deber legal o contractual que nos obligue a conservarlos.</li>
    <li><b>Presentar quejas</b> ante la Superintendencia de Industria y Comercio.</li>
  </ul>
  <p>Para ejercerlos, escríbenos por <a href="{wa_legal}">WhatsApp</a> o al correo
  <a href="mailto:zephoracharms@gmail.com">zephoracharms@gmail.com</a>, indicando tu nombre, el
  dato que quieres consultar o corregir y tu solicitud concreta. Respondemos las consultas dentro
  de los <b>diez (10) días hábiles</b> siguientes y los reclamos dentro de los <b>quince (15) días
  hábiles</b> siguientes, según los términos de ley.</p>

  <h2>6. Seguridad y conservación</h2>
  <p>Aplicamos medidas razonables para proteger tus datos frente a accesos no autorizados,
  pérdida o alteración. Conservamos la información de tu pedido durante el tiempo necesario para
  atender la garantía legal y cumplir las obligaciones tributarias y comerciales aplicables.</p>

  <h2>7. Menores de edad</h2>
  <p>Nuestros productos pueden ser adquiridos por menores de edad únicamente con la autorización
  y el acompañamiento de sus padres o representantes legales, quienes son los responsables de
  suministrar los datos personales necesarios para la compra.</p>

  <h2>8. Cambios en esta política</h2>
  <p>Podemos actualizar esta política para reflejar cambios legales o de nuestra operación. La
  versión vigente es siempre la publicada en esta página, con su fecha de actualización.</p>
'''

# ------------------------------------------------------------------ términos
TERMINOS = '''  <p>Estos términos regulan la compra de productos de <b>Zephora Charms</b> a través de este
  sitio web y de nuestro canal de atención por WhatsApp. Al realizar un pedido, aceptas lo aquí
  descrito.</p>

  <h2>1. Quiénes somos</h2>
  <p><b>Zephora Charms</b>, identificada con <b>NIT 1.019.151.696-3</b>, es una marca colombiana
  dedicada a la venta de charms en Plata Esterlina 925 y brazaletes con acabado en baño de plata.
  Somos una <b>tienda virtual con operación en Bogotá D.C.</b>: no atendemos público en local
  físico, y despachamos a todo el país.</p>
  <p>Canales oficiales de atención y de notificaciones al consumidor:
  <a href="{wa_legal}">WhatsApp +57 301 899 0672</a>, de lunes a sábado de
  9:00 a.m. a 6:00 p.m., y el correo
  <a href="mailto:zephoracharms@gmail.com">zephoracharms@gmail.com</a>.</p>

  <h2>2. Los productos y sus materiales</h2>
  <p>Describimos los materiales de forma explícita en cada pieza, sin ambigüedades:</p>
  <ul>
    <li><b>Charms:</b> elaborados en <b>Plata Esterlina 925 verificada</b>, con sello grabado.</li>
    <li><b>Brazaletes:</b> piezas de alta calidad con <b>acabado en baño de plata</b>. No son plata
      maciza, y así se indica en cada ficha de producto.</li>
  </ul>
  <p>Las fotografías son referenciales. Al tratarse de piezas con componentes artesanales y
  cristales, pueden existir variaciones mínimas de tono o brillo respecto de la imagen.</p>

  <h2>3. Compatibilidad con otras marcas</h2>
  <p>Nuestros brazaletes y charms son <b>compatibles</b> con pulseras de sistema modular, incluidas
  las de la marca Pandora. Zephora Charms es una <b>marca independiente y no está afiliada,
  patrocinada ni respaldada por Pandora A/S</b> ni por ninguna otra marca mencionada con fines
  descriptivos de compatibilidad.</p>

  <h2>4. Diseños de personajes</h2>
  <p>Los charms inspirados en personajes se comercializan conforme a los permisos y
  autorizaciones con que cuenta Zephora Charms para su distribución en Colombia. Las marcas y
  personajes citados pertenecen a sus respectivos titulares y se mencionan únicamente para
  identificar el diseño de la pieza.</p>

  <h2>5. Precios</h2>
  <ul>
    <li>Todos los precios están expresados en <b>pesos colombianos (COP)</b> e incluyen los
      impuestos aplicables.</li>
    <li>El costo de envío no está incluido en el precio de la pieza, salvo cuando aplique el envío
      gratis descrito en la sección de envíos.</li>
    <li>Los precios pueden cambiar sin previo aviso. El precio válido es el que confirmamos por
      WhatsApp al momento de cerrar el pedido.</li>
  </ul>

  <h2>6. Cómo se hace un pedido</h2>
  <p>El sitio funciona como catálogo y armador de pulseras: no procesa pagos. El pedido se cierra
  por WhatsApp, en estos pasos:</p>
  <ol>
    <li>Eliges tus piezas en el sitio y envías tu selección por WhatsApp, o nos escribes directamente.</li>
    <li>Confirmamos disponibilidad, talla, valor total y tiempo estimado de entrega.</li>
    <li>Acordamos la forma de pago y los datos de envío.</li>
    <li>Despachamos y te compartimos la guía de seguimiento.</li>
  </ol>
  <p>El pedido sólo se entiende perfeccionado cuando lo confirmamos expresamente por WhatsApp.
  Nos reservamos el derecho de no aceptar un pedido cuando la pieza esté agotada o cuando
  detectemos un error evidente en el precio publicado; en ese caso te lo informamos y, si ya
  habías pagado, te devolvemos el dinero.</p>

  <h2>7. Promociones</h2>
  <p>La promoción vigente —<b>30% de descuento en el brazalete al llevarlo con 3 o más charms</b>,
  con descuento adicional escalonado sobre los charms— se aplica automáticamente en el armador
  del sitio y se confirma en el chat. Las promociones tienen vigencia limitada, no son
  acumulables con otras salvo que lo indiquemos, y no son canjeables por dinero.</p>

  <h2>8. Garantía legal</h2>
  <p>Todos nuestros productos cuentan con la <b>garantía legal</b> prevista en la Ley 1480 de 2011
  (Estatuto del Consumidor). Adicionalmente ofrecemos una <b>garantía de 30 días por defectos de
  fábrica</b>. El detalle del procedimiento está en
  <a href="envios-y-devoluciones.html">Envíos y devoluciones</a>.</p>

  <h2>9. Derecho de retracto</h2>
  <p>En las ventas no presenciales tienes derecho a retractarte dentro de los <b>cinco (5) días
  hábiles</b> siguientes a la entrega, conforme al artículo 47 de la Ley 1480 de 2011. Las
  condiciones y excepciones están detalladas en
  <a href="envios-y-devoluciones.html">Envíos y devoluciones</a>.</p>

  <h2>10. Propiedad intelectual del sitio</h2>
  <p>Los textos, fotografías y elementos gráficos de este sitio son de Zephora Charms y no pueden
  reproducirse con fines comerciales sin autorización escrita.</p>

  <h2>11. Datos personales</h2>
  <p>El tratamiento de tus datos se rige por nuestra
  <a href="politica-de-privacidad.html">Política de privacidad</a>.</p>

  <h2>12. Ley aplicable</h2>
  <p>Estos términos se rigen por la legislación colombiana. Cualquier controversia se someterá a
  los jueces competentes de Colombia. Como consumidor, puedes acudir a la Superintendencia de
  Industria y Comercio.</p>
'''

# ------------------------------------------------------------------- envíos
ENVIOS = '''  <p>Aquí encuentras cómo enviamos, cuánto cuesta y qué hacer si algo no salió como esperabas.
  Si prefieres que te lo expliquemos por chat, escríbenos por WhatsApp.</p>

  <h2>1. Cobertura y costos</h2>
  <table>
    <tr><th>Concepto</th><th>Condición</th></tr>
    <tr><td>Cobertura</td><td>Todo el territorio nacional colombiano</td></tr>
    <tr><td>Pago anticipado</td><td><b>$15.000 COP</b>, tarifa plana a cualquier ciudad</td></tr>
    <tr><td>Pago contraentrega</td><td><b>$25.000 COP</b>, tarifa plana. Cuesta más porque la
      transportadora cobra por recaudar el dinero en la entrega. Disponible en las ciudades donde
      la transportadora lo permite; lo confirmamos al cerrar el pedido</td></tr>
    <tr><td>Envío gratis</td><td>En pedidos de <b>$180.000 COP</b> o más, con cualquiera de las
      dos formas de pago</td></tr>
  </table>
  <p>La tarifa es la misma para todo el país: no cotizamos por ciudad ni cobramos recargos por
  destino. El costo del envío aparece sumado al total mientras armas tu pulsera, así que lo que
  ves en la página es lo que pagas.</p>

  <h2>2. Tiempos de entrega</h2>
  <p>Enviamos por <b>Inter Rapidísimo</b> a todo el país. Preparamos cada pulsera a mano una vez
  confirmado el pedido, y los tiempos se cuentan en días hábiles desde el despacho:</p>
  <table>
    <tr><th>Destino</th><th>Llega en</th></tr>
    <tr><td>Bogotá y municipios cercanos</td><td>1 – 2 días hábiles</td></tr>
    <tr><td>Ciudades principales (Medellín, Cali, Barranquilla…)</td><td>2 – 4 días hábiles</td></tr>
    <tr><td>Resto del país y reexpedidos</td><td>3 – 6 días hábiles</td></tr>
  </table>
  <p>Los tiempos son estimados y pueden verse afectados por causas ajenas a nosotros —clima,
  contingencias de la transportadora, temporadas de alta demanda—. Si tu pedido se retrasa, te
  avisamos por el mismo chat.</p>

  <h2>3. Cómo rastrear tu pedido</h2>
  <p>Al despachar te enviamos el <b>número de guía</b> por WhatsApp o correo electrónico. Con ese
  número puedes consultar el estado de tu envío directamente en la web oficial de Inter
  Rapidísimo, cuando quieras y sin escribirnos.</p>

  <h2>4. Recepción del pedido</h2>
  <p>Al recibir, revisa que el empaque llegue en buen estado. Si notas daños evidentes, tómale
  una foto antes de abrirlo y escríbenos el mismo día: eso agiliza cualquier reclamación ante la
  transportadora.</p>

  <h2>5. Derecho de retracto</h2>
  <p>Por tratarse de una venta no presencial, tienes derecho a retractarte dentro de los
  <b>cinco (5) días hábiles</b> siguientes a la entrega, conforme al artículo 47 de la Ley 1480
  de 2011.</p>
  <p>Para ejercerlo:</p>
  <ol>
    <li>Escríbenos por WhatsApp dentro de ese plazo manifestando que deseas retractarte.</li>
    <li>Devuelve la pieza <b>sin uso, completa y en su empaque original</b>. El costo del
      transporte de devolución corre por tu cuenta.</li>
    <li>Una vez recibamos y verifiquemos la pieza, te devolvemos el dinero dentro de los
      <b>treinta (30) días calendario</b> siguientes, por el mismo medio de pago.</li>
  </ol>
  <p>Ten en cuenta que el artículo 47 exceptúa del retracto los bienes confeccionados conforme a
  las especificaciones del consumidor o claramente personalizados. Si tu pedido incluyó una
  personalización especial hecha a tu medida, te lo advertimos al momento de confirmarlo.</p>

  <h2>6. Garantía</h2>
  <p>Todas las piezas cuentan con la <b>garantía legal</b> de la Ley 1480 de 2011 y con una
  <b>garantía de 30 días por defectos de fábrica</b> contados desde la entrega: cierres que no
  ajustan, piezas mal ensambladas o fallas del material.</p>
  <p>La garantía <b>no cubre</b> el desgaste normal por uso, la pérdida de piezas, los golpes,
  la deformación por fuerza, ni el deterioro por contacto con perfumes, cloro, agua salada o
  productos químicos.</p>
  <h3>Cómo solicitarla</h3>
  <ol>
    <li>Escríbenos por WhatsApp con una foto o video donde se vea la falla.</li>
    <li>Revisamos el caso y te indicamos cómo hacernos llegar la pieza.</li>
    <li>Reparamos, cambiamos o devolvemos el dinero, según corresponda y de acuerdo con la ley.</li>
  </ol>

  <h2>7. Cambios de talla</h2>
  <p>Si la pulsera no te quedó de la talla correcta, escríbenos dentro de los <b>cinco (5) días
  hábiles</b> siguientes a la entrega. La pieza debe estar sin uso y en su empaque original. Los
  costos de transporte del cambio corren por cuenta del comprador, salvo que el error haya sido
  nuestro.</p>
  <p>Para evitarlo: mide tu muñeca con un metro de costura, súmale 2 cm y esa es tu talla. Si
  tienes dudas, te asesoramos por WhatsApp antes de comprar.</p>
'''

# ---------------------------------------------------------------------- faq
FAQS = [
 ('Materiales y cuidado', [
    ('¿De qué material están hechas las joyas?',
     '<p>Son dos materiales distintos y lo decimos sin ambigüedades:</p>'
     '<ul><li>Los <b>charms</b> están elaborados en <b>Plata Esterlina 925 verificada</b>, con el '
     'sello grabado que lo certifica.</li>'
     '<li>Los <b>brazaletes</b> llevan base de latón de calidad joyería con <b>baño de plata '
     'certificado</b> y una capa protectora e-coating. Así consiguen el peso, el brillo y el '
     'acabado de la joyería fina a un precio accesible.</li></ul>'),
    ('¿Se pone negra o se oxida la pieza?',
     '<p>Depende de la pieza, y preferimos decirlo claro:</p>'
     '<ul><li>La <b>Plata 925 de los charms sí se oxida</b> con el tiempo al contacto con el aire. '
     'Es la naturaleza de la plata, no un defecto —de hecho es una de las señales de que es plata '
     'de verdad— y el brillo se recupera con un paño de joyería.</li>'
     '<li>El <b>baño de los brazaletes</b> no se oxida solo gracias al e-coating, pero puede perder '
     'brillo si se expone a humedad, perfumes, cremas o sudor.</li></ul>'
     '<p>En ambos casos: no la mojes, aplícate el perfume antes de ponértela y guárdala en un lugar '
     'seco.</p>'),
    ('¿Tienen níquel o causan alergia?',
     '<p>Nuestras piezas son <b>100% libres de níquel y plomo</b>. Los charms son Plata 925 y los '
     'brazaletes van sobre latón de calidad joyería con baño de plata certificado, así que son '
     'seguras e hipoalergénicas, aptas para pieles sensibles.</p>'),
    ('¿Cómo cuido mi pulsera?',
     '<p>Guárdala en su bolsa cuando no la uses, quítatela para bañarte, nadar o hacer ejercicio, '
     'y evita el contacto con perfumes y cremas. Para limpiarla, un paño suave y seco. Así '
     'conserva el brillo mucho más tiempo.</p>'),
 ]),
 ('Tallas y ajuste', [
    ('¿Cómo sé qué talla necesito?',
     '<p>Mide tu muñeca ajustada con un metro de costura o una tira de papel y <b>súmale 2 cm</b>. '
     'En la tienda tienes una <a href="index.html#talla">calculadora de talla</a>: escribes tu '
     'medida y te dice qué talla pedir y cuántos charms te caben en cada una.</p>'),
    ('¿Por qué hay que sumar 2 cm?',
     '<p>Porque no es espacio sobrante. Cuando la pulsera se llena de charms, el grosor de las '
     'piezas se come el diámetro interior útil de la cadena —unos 2 cm—. Esos 2 cm son justo el '
     'espacio que van a ocupar tus charms para que la pulsera cierre cómoda en tu muñeca real.</p>'),
    ('¿Cuántos charms le caben a mi pulsera?',
     '<p>Entre <b>15 y 20 charms</b> variados si pediste tu talla con los 2 cm de margen '
     'recomendados. Con solo 1 cm de margen te caben entre 5 y 8, y si la llenas más te apretará. '
     'La <a href="index.html#talla">calculadora de talla</a> te lo calcula con tu medida exacta.</p>'),
    ('¿De qué tamaño son los charms?',
     '<p>Miden entre 1 y 1,5 cm en promedio, según el tipo de pieza:</p>'
     '<table><tr><th>Tipo de pieza</th><th>Mide</th><th>Ocupa en la pulsera</th></tr>'
     '<tr><td>Pasador o charm fijo</td><td>0,8 – 1,2 cm</td><td>8 – 10 mm</td></tr>'
     '<tr><td>Dije colgante</td><td>1,5 – 2,5 cm de largo</td><td>4 – 6 mm en el aro</td></tr>'
     '<tr><td>Murano de cristal</td><td>0,9 – 1,1 cm</td><td>9 – 11 mm</td></tr>'
     '<tr><td>Clip separador</td><td>0,5 – 0,9 cm</td><td>4 – 6 mm</td></tr>'
     '<tr><td>Cadena de seguridad</td><td>—</td><td>4 – 5 mm por aro</td></tr></table>'
     '<p>Son <b>medidas aproximadas por tipo de pieza</b>, no medición individual. Cada charm '
     'muestra las suyas en su ficha dentro de la tienda.</p>'),
    ('¿Los charms se pueden salir o caer?',
     '<p>Al abrir el broche los charms pueden deslizarse. Para evitarlo recomendamos usar una '
     '<b>cadena de seguridad</b> en los extremos: sujeta las piezas y además protege la pulsera si '
     'el broche se abre sin que te des cuenta.</p>'),
    ('¿Sirven con mi pulsera Pandora?',
     '<p>Sí. Nuestros charms son compatibles con pulseras de sistema modular, incluidas las de '
     'Pandora, así que puedes combinarlos con los que ya tienes. Zephora Charms es una marca '
     'independiente y no está afiliada a Pandora A/S.</p>'),
 ]),
 ('Envíos y rastreo', [
    ('¿En cuánto tiempo llega mi pedido?',
     '<p>Enviamos por <b>Inter Rapidísimo</b> a todo el país. Los tiempos se cuentan en días '
     'hábiles desde que despachamos:</p>'
     '<table><tr><th>Destino</th><th>Llega en</th></tr>'
     '<tr><td>Bogotá y municipios cercanos</td><td>1 – 2 días hábiles</td></tr>'
     '<tr><td>Ciudades principales (Medellín, Cali, Barranquilla…)</td><td>2 – 4 días hábiles</td></tr>'
     '<tr><td>Resto del país y reexpedidos</td><td>3 – 6 días hábiles</td></tr></table>'),
    ('¿Cómo puedo rastrear mi pedido?',
     '<p>Al despachar tu compra te enviamos el <b>número de guía</b> por WhatsApp o correo, para '
     'que consultes el estado directamente en la web oficial de Inter Rapidísimo.</p>'),
    ('¿Cuánto cuesta el envío?',
     '<p>Tarifa plana a toda Colombia: <b>$15.000</b> con pago anticipado o <b>$25.000</b> '
     'contraentrega —la diferencia es lo que cobra la transportadora por recaudar el dinero en la '
     'entrega—. En pedidos de <b>$180.000 o más el envío es gratis</b> con cualquiera de las dos. '
     'No cotizamos por ciudad: el costo ya viene sumado en el total que ves al armar tu pulsera.</p>'),
    ('¿Hacen envíos internacionales?',
     '<p>Por el momento realizamos envíos únicamente dentro de Colombia.</p>'),
 ]),
 ('Pagos y compra', [
    ('¿Qué medios de pago aceptan?',
     '<p>Aceptamos transferencia a <b>Bancolombia, Nequi y Daviplata</b>, pagos en línea con '
     '<b>PSE</b>, <b>tarjetas de crédito y débito</b>, y financiación a cuotas con <b>Addi</b>. '
     'También puedes pagar <b>contraentrega</b> en las ciudades donde la transportadora lo '
     'permite.</p>'),
    ('¿Cómo compro?',
     '<p>Armas tu pulsera aquí en la página —el precio se calcula solo, con la promoción y el '
     'envío ya incluidos— y envías tu selección por WhatsApp con un toque. Ahí confirmamos '
     'disponibilidad, talla, total y entrega. También puedes escribirnos directamente y te '
     'asesoramos desde cero.</p>'),
    ('¿Puedo pagar contraentrega?',
     '<p>Sí, en las ciudades donde la transportadora lo permite. El envío contraentrega cuesta '
     '<b>$25.000</b> en lugar de $15.000, porque la transportadora cobra por recaudar el dinero. '
     'Te confirmamos la disponibilidad en tu ciudad por WhatsApp al cerrar el pedido.</p>'),
    ('¿Emiten factura?',
     '<p>No emitimos factura electrónica. Con tu pedido adjuntamos el <b>comprobante digital de '
     'compra</b>.</p>'),
    ('¿Venden al por mayor?',
     '<p>No vendemos al por mayor: nos enfocamos exclusivamente en la venta al detal, pieza por '
     'pieza.</p>'),
    ('¿En qué consiste la promoción?',
     '<p>Al llevar un brazalete con <b>3 o más charms</b>, el brazalete baja un <b>30%</b> y los '
     'charms tienen un descuento adicional que crece con la cantidad. Se aplica solo mientras '
     'armas la pulsera en el sitio: sin códigos ni letra pequeña.</p>'),
    ('¿Puedo devolver o cambiar mi pedido?',
     '<p>Sí. Tienes <b>5 días hábiles</b> desde la entrega para retractarte o solicitar un cambio '
     'de talla, con la pieza sin uso y en su empaque original. El detalle está en '
     '<a href="envios-y-devoluciones.html">Envíos y devoluciones</a>.</p>'),
    ('¿Qué garantía tienen las piezas?',
     '<p>La garantía legal de la Ley 1480 de 2011, más una <b>garantía de 30 días por defectos '
     'de fábrica</b>. No cubre desgaste por uso, golpes, pérdida de piezas ni deterioro por '
     'contacto con perfumes, cloro o productos químicos.</p>'),
    ('¿Hacen empaque de regalo?',
     '<p>Todos los pedidos incluyen empaque de regalo. Si quieres algo más especial, tenemos el '
     '<b>Empaque Premium de Regalo</b> por $40.000, que puedes agregar al armar tu pulsera.</p>'),
 ]),
]


def bloque_faq():
    """Las preguntas van agrupadas: 24 en una lista plana no se recorren."""
    out = ['  <nav class="qa-nav" aria-label="Temas">']
    for grupo, _ in FAQS:
        out.append(f'    <a href="#{ancla(grupo)}">{grupo}</a>')
    out.append('  </nav>')
    for grupo, preguntas in FAQS:
        out.append(f'  <h2 id="{ancla(grupo)}" class="qa-t">{grupo}</h2>')
        out.append('  <div class="qa">')
        for p, r in preguntas:
            out.append('    <details>\n'
                       f'      <summary>{p}</summary>\n'
                       f'      <div class="a">{r}</div>\n'
                       '    </details>')
        out.append('  </div>')
    return '\n'.join(out) + '\n'


def ancla(t):
    import re
    import unicodedata
    t = unicodedata.normalize('NFD', t)
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')


def jsonld_faq():
    import json
    import re
    ent = []
    for _, preguntas in FAQS:
        for p, r in preguntas:
            texto = re.sub(r'<[^>]+>', ' ', r)
            texto = re.sub(r'\s+', ' ', texto).strip()
            ent.append({'@type': 'Question', 'name': p,
                        'acceptedAnswer': {'@type': 'Answer', 'text': texto}})
    d = {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': ent}
    return ('<script type="application/ld+json">\n'
            + json.dumps(d, ensure_ascii=False) + '\n</script>\n')


# ------------------------------------------------------------------- cookies
COOKIES = '''  <p>Esta página explica qué cookies y tecnologías similares usa
  <b>zephoracharms.com</b>, para qué sirven y cómo puedes desactivarlas.</p>

  <h2>1. Qué son las cookies</h2>
  <p>Son pequeños archivos que un sitio guarda en tu navegador para recordar información entre
  visitas. Algunas son necesarias para que la página funcione; otras sirven para medir audiencia
  o para publicidad.</p>

  <h2>2. Qué usamos en este sitio</h2>
  <p>Este sitio <b>no tiene carrito con sesión, ni login, ni pasarela de pago</b>, así que no
  instalamos cookies propias para recordarte. Lo que sí usamos:</p>
  <table>
    <tr><th>Tecnología</th><th>Origen</th><th>Para qué</th></tr>
    <tr><td><b>Píxel de Meta</b><br>(cookies <code>_fbp</code> y <code>_fbc</code>)</td>
      <td>Meta Platforms</td>
      <td>Medir cuántas personas llegan desde nuestros anuncios y cuántas nos escriben por
        WhatsApp, y mostrar anuncios a personas con intereses similares</td></tr>
    <tr><td><b>Google Fonts</b></td><td>Google</td>
      <td>Cargar las tipografías del sitio. No instala cookies publicitarias, pero sí implica una
        conexión a servidores de Google</td></tr>
    <tr><td><b>Selección temporal</b></td><td>Propia</td>
      <td>Las piezas que eliges en el armador se guardan sólo en la memoria de la página: al
        cerrar la pestaña se pierden. No usa cookies</td></tr>
  </table>

  <h2>3. Cómo desactivarlas</h2>
  <ul>
    <li><b>Desde tu navegador:</b> todos permiten bloquear o borrar cookies desde su configuración
      de privacidad. Ten en cuenta que bloquearlas no afecta tu compra, porque el pedido se cierra
      por WhatsApp.</li>
    <li><b>Publicidad de Meta:</b> puedes ajustar qué anuncios ves desde las preferencias de
      anuncios de tu cuenta de Facebook o Instagram.</li>
    <li><b>Navegación privada:</b> al cerrar la ventana, las cookies de esa sesión se eliminan.</li>
  </ul>

  <h2>4. Más información</h2>
  <p>El tratamiento de los datos recogidos mediante estas tecnologías está descrito en nuestra
  <a href="politica-de-privacidad.html">Política de privacidad</a>. Si tienes dudas,
  <a href="{wa_legal}">escríbenos por WhatsApp</a>.</p>
'''

CUERPOS = {
    'politica-de-privacidad.html': (
        PRIVACIDAD, 'Protección de datos',
        'Cómo Zephora Charms recolecta, usa y protege tus datos personales, conforme a la Ley 1581 de 2012.', ''),
    'terminos-y-condiciones.html': (
        TERMINOS, 'Condiciones de compra',
        'Términos que regulan la compra de charms en Plata 925 y brazaletes de Zephora Charms en Colombia.', ''),
    'envios-y-devoluciones.html': (
        ENVIOS, 'Antes y después de comprar',
        'Cobertura, costos y tiempos de envío en Colombia, derecho de retracto, cambios de talla y garantía.', ''),
    'preguntas-frecuentes.html': (
        None, 'Resolvemos tus dudas',
        'Materiales, tallas, compatibilidad con Pandora, envíos, garantía y cuidado de tus charms en Plata 925.', None),
    'politica-de-cookies.html': (
        COOKIES, 'Cookies y medición',
        'Qué cookies usa zephoracharms.com, para qué sirven y cómo desactivarlas.', ''),
}

for archivo, titulo in PAGS:
    cuerpo, eyebrow, desc, extra = CUERPOS[archivo]
    if archivo == 'preguntas-frecuentes.html':
        cuerpo, extra = bloque_faq(), jsonld_faq()
    html = SHELL.format(
        titulo=titulo, desc=desc, archivo=archivo, eyebrow=eyebrow,
        actualizado=ACTUALIZADO, wa_legal=WA_LEGAL, extra_head=extra,
        cuerpo=cuerpo.format(wa_legal=WA_LEGAL) if '{wa_legal}' in cuerpo else cuerpo)
    (RAIZ / archivo).write_text(html, encoding='utf-8')
    print(f'{archivo}  ({len(html):,} bytes)')
