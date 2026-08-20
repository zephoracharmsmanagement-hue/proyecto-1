'use strict';
/* Rescate de checkouts abandonados.
 *
 * Lo que se comprueba aquí es a QUIÉN se le escribe, que es donde esta pieza
 * puede hacer daño. Un pedido que sí se pagó, uno de hace un mes, o uno del que
 * ya se avisó ayer, son tres formas distintas de que la tienda le escriba a
 * alguien que no toca — y eso no da error, solo queda mal.
 *
 * La ventana no es un capricho: antes de dos horas la clienta puede seguir en
 * la pasarela y escribirle es interrumpir una compra que iba a ocurrir sola;
 * después de siete días el mensaje se lee como vigilancia y no como servicio.
 */
const path = require('path');
const { pathToFileURL } = require('url');
const RAIZ = path.join(__dirname, '..');
const cargar = f => import(pathToFileURL(path.join(RAIZ, 'netlify', 'functions', f)).href);

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

const AHORA = Date.parse('2026-08-15T12:00:00Z');
const haceHoras = h => new Date(AHORA - h * 36e5).toISOString();

const pedido = (extra = {}) => Object.assign({
  referencia: 'ZC-260815-AAAA0001',
  estado: 'esperando-pago',
  creado: haceHoras(5),
  lineas: [{ id: 'mickey-mouse', nombre: 'Mickey Mouse', talla: null, unidades: 1, precio: 85000 }],
  cuentas: { total: 100000 },
  cliente: { nombre: 'María', apellido: 'Gómez', celular: '3012345678',
    correo: 'maria@ejemplo.com', ciudad: 'Bogotá D.C.', depto: 'Bogotá D.C.' },
}, extra);

async function main() {
  const r = await cargar('rescate.mjs');
  const { rescatables, enlaceWa, cuerpo, HORAS_MIN, DIAS_MAX } = r._interno;
  const sel = ps => rescatables(ps, AHORA).map(p => p.referencia);

  console.log('1 · A quién SÍ se le escribe');
  comprobar(sel([pedido()]).length === 1,
    'un checkout abandonado hace 5 horas entra en la lista');

  console.log('\n2 · A quién NO');

  comprobar(sel([pedido({ estado: 'pagado' })]).length === 0,
    'a quien ya pagó no se le escribe — sería el peor mensaje posible');
  comprobar(sel([pedido({ estado: 'confirmado' })]).length === 0,
    'ni a un pedido contraentrega, que está en firme');
  comprobar(sel([pedido({ estado: 'pago-declined' })]).length === 0,
    'ni a un pago rechazado: eso lo maneja la clienta con su banco');

  comprobar(sel([pedido({ creado: haceHoras(1) })]).length === 0,
    `antes de ${HORAS_MIN} horas no se toca: puede seguir en la pasarela`);
  comprobar(sel([pedido({ creado: haceHoras(DIAS_MAX * 24 + 5) })]).length === 0,
    `después de ${DIAS_MAX} días ya no: el mensaje se lee como vigilancia`);

  comprobar(sel([pedido({ rescateAvisado: '2026-08-14T14:00:00Z' })]).length === 0,
    'de uno ya avisado no se repite: un correo que repite lo de ayer se deja de abrir');

  const sinCel = pedido();
  delete sinCel.cliente.celular;
  comprobar(sel([sinCel]).length === 0, 'sin celular no hay a dónde escribir');
  comprobar(sel([pedido({ creado: 'no-es-fecha' })]).length === 0,
    'una fecha ilegible se salta en vez de colarse');
  comprobar(sel([null, undefined, {}]).length === 0, 'un registro corrupto no rompe la selección');

  console.log('\n3 · Orden y contenido');

  {
    const lista = rescatables([
      pedido({ referencia: 'ZC-VIEJO', creado: haceHoras(30) }),
      pedido({ referencia: 'ZC-NUEVO', creado: haceHoras(3) }),
    ], AHORA);
    comprobar(lista[0].referencia === 'ZC-NUEVO',
      'el más reciente va primero: es el que más se recupera');
  }

  {
    const p = pedido();
    const url = enlaceWa(p);
    comprobar(url.startsWith('https://wa.me/573018990672?text='), 'el enlace va al WhatsApp de la tienda');
    const texto = decodeURIComponent(url.split('text=')[1]);
    comprobar(texto.includes('María'), 'saluda por su nombre');
    comprobar(texto.includes(p.referencia), 'y lleva la referencia, para que sepa de qué se le habla');
    comprobar(!/descuento|oferta|última|ahora|corre/i.test(texto),
      'no inventa urgencia ni promete nada: ofrece ayuda para terminar');
  }

  {
    const { html, txt } = cuerpo(rescatables([pedido()], AHORA));
    comprobar(html.includes('Mickey Mouse'), 'el correo dice qué había en el carrito');
    comprobar(html.includes('3012345678') || html.includes('wa.me'), 'y cómo contactarla');
    comprobar(txt.includes('ZC-260815-AAAA0001'), 'lleva versión en texto plano con la referencia');
    comprobar(!/<script/i.test(html), 'sin scripts en el correo');
  }

  {
    /* Los datos de la clienta se pintan en HTML: si un nombre trae comillas o
       corchetes y no se escapan, el correo se rompe o peor. */
    const { html } = cuerpo(rescatables([pedido({
      cliente: Object.assign({}, pedido().cliente, { nombre: '<script>x</script>"' }),
    })], AHORA));
    comprobar(!html.includes('<script>x'), 'los datos de la clienta se escapan antes de pintarlos');
  }

  console.log(fallos ? `\nRescate: ${fallos} en rojo` : '\nRescate de checkouts en verde ✓');
}

main().catch(e => { console.log('  ✗ FALLA excepción no capturada — ' + e.stack); process.exit(1); });
