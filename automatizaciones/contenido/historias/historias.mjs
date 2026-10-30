/* Las historias de noviembre 2026, en el orden del plan
   (Plan de Instagram · Noviembre 2026 v2). Una entrada = una imagen.

   Reglas que render.mjs hace cumplir, no esta lista:
   - Los nombres y precios de las piezas salen del catálogo (`piezas: [id]`).
   - Los totales de un set salen de calcular() (`set: {...}`).
   - Una pieza con menos de 3 unidades en stock.json no se renderiza, salvo
     que la entrada diga `pocas: true` y el texto lo diga («quedan 2»).

   Lo que NO está aquí, a propósito: detrás de cámaras, empaques, pedidos
   saliendo, reposts del Reel y la pulsera puesta en la calle. Eso es video o
   foto real del día y lo graba el propietario.

   `momento`: 1 mañana · 2 mediodía · 3 tarde · 4 noche. */

const ENLACE = 'Toca el enlace';
const PROMO = 'Paga 3, lleva 1 gratis · paga 4, lleva 2';

/* `calc` lo pasa render.mjs: calc(base, talla, charms) → resultado de
   calcular() en pago anticipado y contraentrega. */
export default function historias(calc) {
  const set4 = calc('pulsera-corazon-liso', '19', ['virgen-maria', 'corazon-arbol-de-la-vida', 'osito-graduacion']);
  const set6 = calc('pulsera-corazon-liso', '19', ['virgen-maria', 'corazon-arbol-de-la-vida', 'osito-graduacion', 'atrapasuenos-azul', 'luciernaga-you-are-my-light']);
  const dif = set6.anticipado.total - set4.anticipado.total;
  const cop = (n) => '$' + n.toLocaleString('es-CO').replace(/,/g, '.');

  return [
    /* ── Semana 1 · Regalo para mamá ── */
    {dia: '2026-11-01', momento: 2, plantilla: 'pregunta', fondo: 'rose', kicker: 'Encuesta', titulo: '¿Ya pensaste en los', titulo2: 'regalos de Navidad?', foto: 'bloque-regalo-v1.webp', fotoAlto: 560},
    {dia: '2026-11-01', momento: 4, plantilla: 'set', kicker: 'Arma tu set', titulo: 'Paga 3,', titulo2: 'lleva 1 gratis', set: {base: 'pulsera-corazon-liso', talla: '19', charms: ['virgen-maria', 'corazon-arbol-de-la-vida', 'osito-graduacion']}},

    {dia: '2026-11-02', momento: 2, plantilla: 'pregunta', kicker: 'Quiz', titulo: '¿Qué charm', titulo2: 'es tu mamá?', piezas: ['virgen-maria', 'corazon-arbol-de-la-vida', 'corazon-mama-e-hija'], etiquetas: ['A', 'B', 'C'], pocas: true},
    {dia: '2026-11-02', momento: 4, plantilla: 'producto', kicker: 'Para mamá', titulo: 'Un charm que', titulo2: 'la describe', piezas: ['virgen-maria', 'corazon-arbol-de-la-vida'], cuerpo: `Charms en plata 925 · ${PROMO}`, cta: ENLACE},

    {dia: '2026-11-03', momento: 2, plantilla: 'pregunta', fondo: 'rose', kicker: 'Cuéntame', titulo: 'Cuéntame cómo es tu mamá', titulo2: 'y te digo qué charm', foto: 'bloque-diario-v1.webp', fotoAlto: 520, fotoPos: 'center 40%'},

    {dia: '2026-11-04', momento: 2, plantilla: 'pregunta', kicker: '¿Cuál prefieres?', titulo: 'Luz o', titulo2: 'sueños', piezas: ['luciernaga-you-are-my-light', 'atrapasuenos-azul'], etiquetas: ['A', 'B']},
    {dia: '2026-11-04', momento: 4, plantilla: 'producto', kicker: 'Charm de la semana', titulo: 'Atrapasueños', titulo2: 'Azul', piezas: ['atrapasuenos-azul'], cta: ENLACE},

    {dia: '2026-11-05', momento: 2, plantilla: 'pregunta', fondo: 'rose', kicker: 'Del 1 al 10', titulo: '¿Cuánto amas', titulo2: 'los muranos?', piezas: ['esfera-azul-con-cristales', 'bola-roja-remolino', 'flor-azul-con-cristales']},
    {dia: '2026-11-05', momento: 3, plantilla: 'resena', resena: {texto: 'Amo cómo se ve. Tenía un poquito de duda de pedir por internet, pero superó totalmente lo que esperaba.', nombre: 'Adriana M.', ciudad: 'Bogotá'}, foto: 'pulsera-zephora-completa-con-charms-de-virgen-pati.jpg', fotoAlto: 620},
    {dia: '2026-11-05', momento: 4, plantilla: 'set', kicker: 'Así se ve un set de 4', titulo: 'La de menor valor', titulo2: 'sale gratis', set: {base: 'pulsera-corona-pave', talla: '18', charms: ['atrapasuenos-azul', 'luciernaga-you-are-my-light', 'esfera-azul-con-cristales']}},

    {dia: '2026-11-06', momento: 2, plantilla: 'pregunta', kicker: 'Encuesta', titulo: '¿Tu novio sabe', titulo2: 'qué regalarte?', foto: 'hero-marca-ancho.webp', fotoAlto: 480},
    {dia: '2026-11-06', momento: 4, plantilla: 'anuncio', fondo: 'plum', kicker: 'Para que no adivine', titulo: 'Envíaselo', titulo2: 'a tu novio', subtitulo: 'Elige tus charms en el sitio y mándale el enlace. Él solo tiene que pagar.', cta: ENLACE},

    {dia: '2026-11-07', momento: 2, plantilla: 'pregunta', kicker: '¿Cuál prefieres?', titulo: 'Corona', titulo2: 'con cristales o pavé', piezas: ['pulsera-corona-con-cristales', 'pulsera-corona-pave'], etiquetas: ['A', 'B']},
    {dia: '2026-11-07', momento: 3, plantilla: 'info', kicker: 'Tu talla', titulo: 'Mide tu muñeca', titulo2: 'y súmale 2 cm', pasos: ['Mide la muñeca ajustada con un metro de costura o una tira de papel.', 'Súmale 2 cm: con charms, el grosor de las piezas se come espacio.', 'Ese número es tu talla. Tallas de 17 a 21 cm.']},
    {dia: '2026-11-07', momento: 4, plantilla: 'anuncio', fondo: 'rose', kicker: 'Calculadora de talla', titulo: 'Escribe tu medida', titulo2: 'y te decimos tu talla', subtitulo: 'Y cuántos charms te caben en cada una.', cta: ENLACE},

    {dia: '2026-11-08', momento: 2, plantilla: 'pregunta', fondo: 'rose', kicker: 'Quiz', titulo: '¿Cuántos charms caben', titulo2: 'en tu pulsera?', foto: 'historia-1-portada.webp', fotoAlto: 560, fotoPos: 'center 35%'},
    {dia: '2026-11-08', momento: 4, plantilla: 'anuncio', fondo: 'ink', kicker: 'Atenta al martes', titulo: 'El martes', titulo2: 'les cuento algo', subtitulo: 'Activa las notificaciones de esta cuenta.'},

    /* ── Semana 2 · Lista de espera ── */
    {dia: '2026-11-09', momento: 4, plantilla: 'set', kicker: 'Sigue vigente', titulo: 'Paga 3,', titulo2: 'lleva 1 gratis', set: {base: 'pulsera-avengers', talla: '19', charms: ['iron-man', 'deadpool', 'spider-man']}},

    {dia: '2026-11-10', momento: 1, plantilla: 'anuncio', fondo: 'ink', titulo: 'Hoy les cuento', titulo2: 'algo importante', subtitulo: 'A las 7 de la noche.'},
    {dia: '2026-11-10', momento: 2, plantilla: 'pregunta', kicker: 'Encuesta', titulo: '¿Qué te gustaría', titulo2: 'que trajera la promo?', foto: 'bloque-historia-v1.webp', fotoAlto: 520},
    {dia: '2026-11-10', momento: 4, plantilla: 'anuncio', fondo: 'plum', kicker: 'Lista de espera', titulo: 'El 15 empieza algo.', titulo2: 'Entra primero', subtitulo: 'Escríbenos «LISTA» por mensaje. La lista entra el sábado 14 a las 7 p. m., un día antes que todos.', cta: 'O toca el enlace'},

    {dia: '2026-11-11', momento: 2, plantilla: 'anuncio', fondo: 'rose', kicker: 'Cuenta regresiva', titulo: 'Domingo 15', titulo2: 'de noviembre', subtitulo: 'Activa el recordatorio.'},
    {dia: '2026-11-11', momento: 3, plantilla: 'resena', resena: {texto: 'El detalle con el que viene presentado es divino, ideal si te quieres dar un gusto o regalarle algo especial a alguien. ¡Sin duda volveré a comprar!', nombre: 'Valentina R.', ciudad: 'Medellín'}, foto: 'pulsera-armada-con-muranos-camaleon-verde-y-atrapa.jpg', fotoAlto: 540},
    {dia: '2026-11-11', momento: 4, plantilla: 'anuncio', fondo: 'plum', foto: 'bloque-regalo-v1.webp', fotoAlto: 560, kicker: 'Lista de espera', titulo: 'Escribe «LISTA»', titulo2: 'y entras primero', cta: ENLACE},

    {dia: '2026-11-12', momento: 2, plantilla: 'pregunta', kicker: 'Pregúntame', titulo: '¿Qué quieres saber', titulo2: 'antes del 15?'},
    {dia: '2026-11-12', momento: 4, plantilla: 'anuncio', fondo: 'ink', numero: '3', titulo: 'días para el 15', subtitulo: 'La lista entra un día antes. Escribe «LISTA».', cta: ENLACE},

    {dia: '2026-11-13', momento: 2, plantilla: 'pregunta', fondo: 'rose', kicker: 'Del 1 al 10', titulo: '¿Qué tan lista estás', titulo2: 'para el 15?', foto: 'historia-3-portada.webp', fotoAlto: 560, fotoPos: 'center 45%'},
    {dia: '2026-11-13', momento: 4, plantilla: 'anuncio', fondo: 'ink', numero: '2', titulo: 'días para el 15', subtitulo: 'Último día para entrar a la lista: mañana.', cta: ENLACE},

    {dia: '2026-11-14', momento: 1, plantilla: 'anuncio', fondo: 'plum', numero: '7 p. m.', titulo: 'Hoy abrimos', titulo2: 'solo para la lista', subtitulo: '¿No estás? Escribe «LISTA» antes de las 7.'},
    {dia: '2026-11-14', momento: 2, plantilla: 'anuncio', fondo: 'rose', foto: 'historia-2-portada.webp', fotoAlto: 560, fotoPos: 'center 40%', kicker: 'Recordatorio', titulo: 'Hoy a las 7 p. m.', titulo2: 'entra la lista', cta: ENLACE},
    {dia: '2026-11-14', momento: 3, plantilla: 'anuncio', fondo: 'ink', kicker: '6 p. m.', numero: '1', titulo: 'hora', subtitulo: 'Para abrir solo para la lista.'},
    {dia: '2026-11-14', momento: 4, plantilla: 'anuncio', fondo: 'plum', foto: 'bloque-regalo-v1.webp', fotoAlto: 560, kicker: 'Acceso anticipado', titulo: 'Abierto', titulo2: 'para la lista', subtitulo: `Con 6 piezas, 2 salen gratis.`, cta: ENLACE},

    /* ── Semana 3 · Promoción: regalos ── */
    {dia: '2026-11-15', momento: 1, plantilla: 'anuncio', fondo: 'plum', foto: 'bloque-regalo-v1.webp', fotoAlto: 600, kicker: 'Black Friday Zephora', titulo: 'Ya empezó', subtitulo: `Con 4 piezas, 1 gratis. Con 6, 2 gratis. Hasta el lunes 30.`, cta: ENLACE},
    {dia: '2026-11-15', momento: 1, plantilla: 'set', kicker: `Por ${cop(dif)} más`, titulo: 'De 4 a 6 piezas,', titulo2: 'dos gratis', set: {base: 'pulsera-corazon-liso', talla: '19', charms: ['virgen-maria', 'corazon-arbol-de-la-vida', 'osito-graduacion', 'atrapasuenos-azul', 'luciernaga-you-are-my-light']}},
    {dia: '2026-11-15', momento: 2, plantilla: 'info', kicker: 'Cómo comprar', titulo: 'En 4 pasos', pasos: ['Elige tu brazalete y tu talla (muñeca + 2 cm).', 'Suma tus charms: con 4 piezas, 1 gratis; con 6, 2 gratis.', 'Paga en línea con envío gratis, o contraentrega.', 'Llega en su caja, con paño y dedicatoria si la pides.']},
    {dia: '2026-11-15', momento: 4, plantilla: 'info', kicker: 'Formas de pago', titulo: 'Paga como', titulo2: 'te quede mejor', filas: [['Nequi, PSE, Daviplata, Bancolombia', 'En línea'], ['Tarjeta crédito o débito', 'Hasta 36 cuotas'], ['Addi', '3 cuotas sin interés'], ['Contraentrega', 'Envío $20.000']], cuerpo: 'Pagando en línea, el envío es gratis.', cta: ENLACE},

    {dia: '2026-11-16', momento: 1, plantilla: 'producto', kicker: 'Para la que se gradúa', titulo: 'Osito', titulo2: 'Graduación', piezas: ['osito-graduacion'], cta: ENLACE},
    {dia: '2026-11-16', momento: 2, plantilla: 'pregunta', fondo: 'rose', kicker: 'Encuesta', titulo: '¿Quién se gradúa', titulo2: 'en tu familia?', piezas: ['osito-graduacion'], etiquetas: []},
    {dia: '2026-11-16', momento: 4, plantilla: 'anuncio', fondo: 'plum', kicker: 'Medicina · Psicología · Odontología · Fisioterapia', titulo: 'Charms de profesión', titulo2: 'por encargo', subtitulo: 'Quedan pocas unidades. Escríbenos y te contamos cuál hay para su carrera.', cta: 'Escríbenos'},

    {dia: '2026-11-17', momento: 2, plantilla: 'pregunta', kicker: 'Pregúntame', titulo: 'Pregúntame', titulo2: 'antes de comprar', foto: 'susc-pulsera.webp', fotoAlto: 480},
    {dia: '2026-11-17', momento: 4, plantilla: 'set', kicker: 'Para él', titulo: 'Su pulsera', titulo2: 'Avengers', set: {base: 'pulsera-avengers', talla: '20', charms: ['iron-man', 'deadpool', 'spider-man', 'casco-iron-man', 'mascara-spider-man-roja']}},

    {dia: '2026-11-18', momento: 2, plantilla: 'pregunta', kicker: 'Quiz', titulo: 'Con 6 piezas,', titulo2: '¿cuántas salen gratis?', piezas: ['pulsera-corazon-liso', 'virgen-maria', 'atrapasuenos-azul']},
    {dia: '2026-11-18', momento: 3, plantilla: 'resena', resena: {texto: 'Se lo regalé a una persona súper especial y le encantó. Desde que abrió la cajita quedó fascinada con los detalles.', nombre: 'Sebastián G.', ciudad: 'Cali'}, foto: 'detalle-de-la-pulsera-corazon-rosado-con-cadena-de.jpg', fotoAlto: 540},
    {dia: '2026-11-18', momento: 4, plantilla: 'anuncio', fondo: 'rose', foto: 'historia-3-portada.webp', fotoAlto: 600, fotoPos: 'center 45%', kicker: 'Black Friday', titulo: 'Dos gratis', titulo2: 'con 6 piezas', cta: ENLACE},

    {dia: '2026-11-19', momento: 2, plantilla: 'pregunta', kicker: 'Encuesta', titulo: '¿Para quién', titulo2: 'es tu regalo?', piezas: ['virgen-maria', 'iron-man', 'osito-graduacion'], etiquetas: ['Mamá', 'Él', 'Ella']},
    {dia: '2026-11-19', momento: 3, plantilla: 'info', kicker: 'Tiempos de entrega', titulo: '¿Cuándo', titulo2: 'me llega?', filas: [['Bogotá', '1 día hábil'], ['Cerca de Bogotá', '1 – 2 días hábiles'], ['Ciudades principales', '2 – 4 días hábiles'], ['Resto del país', 'Según Inter Rapidísimo']], cuerpo: 'Contados desde el despacho. Enviamos con Inter Rapidísimo a todo Colombia.'},
    {dia: '2026-11-19', momento: 4, plantilla: 'producto', kicker: 'Black Friday', titulo: 'Dos gratis', titulo2: 'con 6 piezas', piezas: ['pulsera-corona-pave'], cuerpo: 'Brazalete con baño de plata · charms en plata 925', cta: ENLACE},

    {dia: '2026-11-20', momento: 2, plantilla: 'pregunta', fondo: 'rose', kicker: 'Quiz', titulo: '¿Qué significa', titulo2: 'el sello 925?', foto: 'bloque-s925.webp', fotoAlto: 560},
    {dia: '2026-11-20', momento: 4, plantilla: 'info', fondo: 'plum', kicker: 'Antes de comprar joyas', titulo: 'Lo que sí', titulo2: 'te prometemos', pasos: ['Charms en plata 925, con el sello grabado.', 'Brazaletes con baño de plata.', '100% libres de níquel y plomo.', 'Garantía de 30 días por defectos de fábrica.'], cta: ENLACE},

    {dia: '2026-11-21', momento: 1, plantilla: 'producto', kicker: 'Último día de Escorpio · quedan 2', titulo: 'Escorpio', piezas: ['escorpio'], pocas: true, cta: ENLACE},
    {dia: '2026-11-21', momento: 2, plantilla: 'pregunta', kicker: '¿Cuál prefieres?', titulo: 'Corona', titulo2: 'o corazón', piezas: ['pulsera-corona-pave', 'pulsera-corazon-liso'], etiquetas: ['A', 'B']},
    {dia: '2026-11-21', momento: 4, plantilla: 'anuncio', fondo: 'ink', foto: 'kit-spiderman-9x16.jpg', fotoAlto: 640, fotoPos: 'center 55%', kicker: 'Black Friday', titulo: 'Arma la tuya', titulo2: 'hasta el lunes 30', cta: ENLACE},

    {dia: '2026-11-22', momento: 1, plantilla: 'producto', kicker: 'Empieza Sagitario · quedan 2', titulo: 'Sagitario', piezas: ['sagitario'], pocas: true, cta: ENLACE},
    {dia: '2026-11-22', momento: 2, plantilla: 'pregunta', fondo: 'rose', kicker: 'Encuesta', titulo: '¿Ya compraste', titulo2: 'tus regalos?', foto: 'bloque-regalo-v1.webp', fotoAlto: 560},
    {dia: '2026-11-22', momento: 4, plantilla: 'anuncio', fondo: 'ink', numero: '8', titulo: 'días para que cierre', subtitulo: 'Black Friday termina el lunes 30 a medianoche.', cta: ENLACE},

    /* ── Semana 4 · Pico de Black Friday ── */
    {dia: '2026-11-23', momento: 4, plantilla: 'anuncio', fondo: 'plum', foto: 'hero-marca-ancho.webp', fotoAlto: 420, kicker: 'Esta semana', titulo: 'El viernes', titulo2: 'es el día', cta: ENLACE},

    {dia: '2026-11-24', momento: 2, plantilla: 'pregunta', kicker: 'Encuesta', titulo: '¿Cuánto quieres', titulo2: 'invertir en tu regalo?', foto: 'bloque-diario-v1.webp', fotoAlto: 520},
    {dia: '2026-11-24', momento: 4, plantilla: 'anuncio', fondo: 'rose', kicker: 'Con Addi', titulo: '3 cuotas', titulo2: 'sin interés', subtitulo: `Tu set de 4 piezas desde ${cop(Math.ceil(set4.anticipado.total / 3))} al mes. Lo eliges al pagar y apruebas con tu cédula.`, cta: ENLACE},

    {dia: '2026-11-25', momento: 2, plantilla: 'anuncio', fondo: 'plum', foto: 'bloque-regalo-v1.webp', fotoAlto: 560, kicker: 'Compártelo', titulo: 'Envíale esto', titulo2: 'a tu novio'},
    {dia: '2026-11-25', momento: 3, plantilla: 'resena', resena: {texto: 'Amo cómo se ve. Tenía un poquito de duda de pedir por internet, pero superó totalmente lo que esperaba.', nombre: 'Adriana M.', ciudad: 'Bogotá'}, fondo: 'rose', foto: 'pulsera-zephora-completa-con-charms-de-virgen-pati.jpg', fotoAlto: 620},
    {dia: '2026-11-25', momento: 4, plantilla: 'set', kicker: 'Black Friday', titulo: 'Seis piezas,', titulo2: 'dos gratis', set: {base: 'pulsera-corazon-liso', talla: '19', charms: ['virgen-maria', 'corazon-arbol-de-la-vida', 'osito-graduacion', 'atrapasuenos-azul', 'luciernaga-you-are-my-light']}},

    {dia: '2026-11-26', momento: 1, plantilla: 'anuncio', fondo: 'ink', titulo: 'Mañana', titulo2: 'es el día'},
    {dia: '2026-11-26', momento: 2, plantilla: 'pregunta', fondo: 'rose', kicker: 'Preguntas frecuentes', titulo: 'Pregúntame', titulo2: 'lo que quieras', foto: 'historia-2-portada.webp', fotoAlto: 520, fotoPos: 'center 40%'},
    {dia: '2026-11-26', momento: 4, plantilla: 'anuncio', fondo: 'ink', numero: '1', titulo: 'día para Black Friday', cta: ENLACE},

    {dia: '2026-11-27', momento: 1, plantilla: 'anuncio', fondo: 'plum', foto: 'kit-spiderman-9x16.jpg', fotoAlto: 640, fotoPos: 'center 55%', kicker: 'Viernes 27', titulo: 'Hoy es', titulo2: 'Black Friday', subtitulo: 'Con 6 piezas, 2 gratis.', cta: ENLACE},
    {dia: '2026-11-27', momento: 4, plantilla: 'anuncio', fondo: 'ink', numero: '3', titulo: 'días para que cierre', subtitulo: 'Hasta el lunes 30 a medianoche.', cta: ENLACE},

    {dia: '2026-11-28', momento: 2, plantilla: 'pregunta', kicker: '¿Cuál armarías tú?', titulo: 'Corazón', titulo2: 'o Avengers', piezas: ['pulsera-corazon-liso', 'pulsera-avengers'], etiquetas: ['A', 'B']},
    {dia: '2026-11-28', momento: 4, plantilla: 'set', kicker: 'Para él', titulo: 'Cuatro piezas,', titulo2: 'una gratis', set: {base: 'pulsera-avengers', talla: '20', charms: ['iron-man', 'deadpool', 'spider-man']}},

    {dia: '2026-11-29', momento: 2, plantilla: 'anuncio', fondo: 'ink', titulo: 'Mañana', titulo2: 'cierra', subtitulo: 'Black Friday termina el lunes 30 a medianoche.'},
    {dia: '2026-11-29', momento: 4, plantilla: 'producto', kicker: 'Última noche de domingo', titulo: 'Dos gratis', titulo2: 'con 6 piezas', piezas: ['pulsera-corazon-liso'], cuerpo: 'Brazalete con baño de plata · tallas 17 a 20', cta: ENLACE},

    /* ── Cierre ── */
    {dia: '2026-11-30', momento: 1, plantilla: 'anuncio', fondo: 'plum', kicker: 'Lunes 30', titulo: 'Último día', subtitulo: 'Después de hoy, la promo de 6 piezas no vuelve.', cta: ENLACE},
    {dia: '2026-11-30', momento: 3, plantilla: 'anuncio', fondo: 'ink', numero: '6', titulo: 'horas', subtitulo: 'Cerramos a medianoche.', cta: ENLACE},
    {dia: '2026-11-30', momento: 4, plantilla: 'anuncio', fondo: 'plum', foto: 'historia-1-portada.webp', fotoAlto: 600, fotoPos: 'center 35%', kicker: 'Hoy a medianoche', titulo: 'Cerramos', subtitulo: 'Gracias por armar la tuya con nosotros.', cta: ENLACE},
  ];
}
