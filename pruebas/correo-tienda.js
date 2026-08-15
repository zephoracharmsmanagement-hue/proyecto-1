'use strict';
/* La hoja de despacho: que no se pierda nada de lo que la clienta escribió.
 *
 * Existe por un pedido perdido. Alguien pidió que se lo entregaran en un local
 * concreto y lo escribió en «Indicaciones para la entrega». Ese campo viajaba
 * bien —llegaba al servidor, se guardaba en el registro— pero **no se imprimía
 * en ningún correo**. El pedido se despachó sin la indicación.
 *
 * Nada falló: la tienda cobró, los correos salieron, no hubo un solo error. El
 * dato simplemente no estaba en la hoja que se lee al empacar. Es el mismo
 * patrón mudo de siempre, y por eso la prueba no comprueba un texto concreto
 * sino **la cadena entera**:
 *
 *   1. Cada campo del formulario llega al servidor (`datos()` lo manda).
 *   2. Cada campo que el servidor acepta se imprime en el correo de la tienda,
 *      en HTML y en texto plano.
 *
 * Así, el día que el formulario gane un campo nuevo y alguien olvide la
 * plantilla, sale en rojo aquí en vez de descubrirse con un paquete perdido.
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const RAIZ = path.join(__dirname, '..');

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

/* Valores centinela: cada uno irrepetible, para que encontrarlo en el correo
   signifique que se imprimió ESE campo y no que coincidió con otra cosa. */
const CLIENTE = {
  nombre: 'Marialejandra', apellido: 'Quintanilla',
  tipodoc: 'CE', documento: '987654321',
  celular: '3012345678', correo: 'marialejandra@ejemplo.com',
  depto: 'Antioquia', ciudad: 'Envigado',
  direccion: 'Carrera 43A # 18-95',
  adicional: 'Torre 4 apto 1102',
  barrio: 'Zuniga',
  notas: 'Entregar en el local Mundo Digital del centro comercial, no en la casa',
  dedicatoria: 'Para Sofia, por aguantarme un ano mas',
  optin: true,
};

const LINEAS = [
  { id: 'pulsera-avengers', nombre: 'Brazalete Avengers', talla: '20', unidades: 1, precio: 58000 },
  { id: 'mickey-mouse', nombre: 'Mickey Mouse', talla: null, unidades: 3, precio: 255000 },
  { id: 'empaque', nombre: 'Empaque Premium de Regalo', talla: null, unidades: 1, precio: 40000 },
];
const CUENTAS = { envio: 0, envioGratis: true, total: 353000 };

/* Campos del formulario que no van dentro de `cliente`, cada uno por su motivo:
     pago, entrega  — viajan en la raíz del pedido; el servidor recalcula con ellos
     optin, acepto  — consentimientos, se comprueban en pruebas/checkout.js
     ciudadotra     — no es un dato propio: alimenta `ciudad` cuando el municipio
                      no está en la lista
   La lista es corta a propósito. Cada nombre que se añada aquí es un campo que
   deja de estar vigilado, así que hay que poder explicar por qué. */
const NO_SON_DATOS = new Set(['pago', 'entrega', 'optin', 'acepto', 'ciudadotra']);

(async () => {
  const correo = require(path.join(RAIZ, 'netlify', 'functions', '_correo.js'));
  const crearPago = await import(
    pathToFileURL(path.join(RAIZ, 'netlify', 'functions', 'crear-pago.mjs')).href);
  const html = fs.readFileSync(path.join(RAIZ, 'checkout.html'), 'utf8');

  console.log('\n1 · Del formulario al servidor');
  {
    /* Los campos del formulario tienen que estar dentro de datos(), que es lo
       que se manda a crear-pago. Un campo que se pinta y no se manda es una
       casilla que la clienta rellena para nada. */
    const cuerpoDatos = (html.match(/function datos\(\)\{[\s\S]*?\n\}/) || [''])[0];
    comprobar(cuerpoDatos.length > 0, 'se encuentra datos() en checkout.html');

    const nombres = [...html.matchAll(/<(?:input|select|textarea)[^>]*\sname="([^"]+)"/g)]
      .map(m => m[1]).filter(n => !NO_SON_DATOS.has(n));
    const perdidos = [...new Set(nombres)].filter(n => !cuerpoDatos.includes(n));
    comprobar(perdidos.length === 0,
      'todos los campos del formulario viajan al servidor',
      perdidos.length ? 'no se mandan: ' + perdidos.join(', ') : `${new Set(nombres).size} campos`);
  }

  console.log('\n2 · Del servidor a la hoja de despacho');
  {
    /* La lista no se escribe a mano: se saca de lo que crear-pago acepta de
       verdad. Si mañana entra un campo nuevo, entra solo en esta prueba. */
    const limpio = crearPago._interno.leerCliente(CLIENTE);
    const aImprimir = Object.entries(limpio)
      .filter(([, v]) => typeof v === 'string' && v.trim() !== '');

    const cuerpoHtml = correo.plantillaTienda(
      { referencia: 'ZC-260815-TEST0001', lineas: LINEAS, cuentas: CUENTAS, pago: 'contraentrega', cliente: limpio });
    const cuerpoTxt = correo.textoTienda(
      { referencia: 'ZC-260815-TEST0001', lineas: LINEAS, cuentas: CUENTAS, pago: 'contraentrega', cliente: limpio });

    const faltanHtml = aImprimir.filter(([, v]) => !cuerpoHtml.includes(v)).map(([k]) => k);
    const faltanTxt = aImprimir.filter(([, v]) => !cuerpoTxt.includes(v)).map(([k]) => k);

    comprobar(faltanHtml.length === 0,
      'el correo en HTML imprime todos los datos de la clienta',
      faltanHtml.length ? 'no salen: ' + faltanHtml.join(', ') : `${aImprimir.length} campos`);
    comprobar(faltanTxt.length === 0,
      'y la versión en texto plano también',
      faltanTxt.length ? 'no salen: ' + faltanTxt.join(', ') : `${aImprimir.length} campos`);

    /* Las indicaciones de entrega son el campo que costó un pedido. Aparte de
       salir, tienen que destacarse: al empacar se lee en diagonal. */
    comprobar(/Indicaciones para la entrega/i.test(cuerpoHtml),
      'las indicaciones salen bajo un rótulo propio, no perdidas en un párrafo');
    comprobar(cuerpoHtml.indexOf(limpio.notas) < cuerpoHtml.indexOf(limpio.direccion),
      'y van antes que la dirección, que es lo que se copia a la guía');

    console.log('\n3 · Qué empacar');
    const piezas = LINEAS.filter(l => !cuerpoHtml.includes(l.nombre)).map(l => l.nombre);
    comprobar(piezas.length === 0, 'salen todas las piezas del pedido, empaque incluido',
      piezas.length ? 'faltan: ' + piezas.join(', ') : `${LINEAS.length} líneas`);
    comprobar(cuerpoHtml.includes('talla 20') && cuerpoTxt.includes('talla 20'),
      'con la talla del brazalete, que es lo que no se puede adivinar al empacar');
    comprobar(/×3|x3/.test(cuerpoHtml) && /x3/.test(cuerpoTxt),
      'y las unidades cuando se pidió más de una');

    console.log('\n4 · Lo que se ve sin abrir el correo');
    /* El asunto se lee en una lista. Si el aviso no está ahí, se empaca sin
       abrirlo — que es exactamente como se perdió el pedido. */
    process.env.CORREO_TIENDA = 'tienda@ejemplo.com';
    process.env.RESEND_API_KEY = '';
    let asunto = null;
    const fetchReal = globalThis.fetch;
    globalThis.fetch = async (u, o) => { asunto = JSON.parse(o.body).subject; return { ok: true, status: 200, json: async () => ({ id: 'x' }) }; };
    process.env.RESEND_API_KEY = 're_prueba';
    await correo.avisoTienda(
      { referencia: 'ZC-260815-TEST0001', lineas: LINEAS, cuentas: CUENTAS, pago: 'contraentrega', cliente: limpio });
    globalThis.fetch = fetchReal;
    comprobar(asunto && /INDICACIONES/i.test(asunto),
      'el asunto avisa que el pedido trae indicaciones', asunto || 'no se mandó nada');
    comprobar(asunto && /DEDICATORIA/i.test(asunto),
      'y que hay una dedicatoria por escribir a mano');

    /* Un pedido sin indicaciones no debe llevar el aviso: si sale siempre, deja
       de significar algo y se ignora. */
    let asunto2 = null;
    globalThis.fetch = async (u, o) => { asunto2 = JSON.parse(o.body).subject; return { ok: true, status: 200, json: async () => ({ id: 'x' }) }; };
    await correo.avisoTienda({
      referencia: 'ZC-260815-TEST0002', lineas: LINEAS, cuentas: CUENTAS, pago: 'anticipado',
      cliente: Object.assign({}, limpio, { notas: '', dedicatoria: '' }),
    });
    globalThis.fetch = fetchReal;
    comprobar(asunto2 && !/INDICACIONES|DEDICATORIA/i.test(asunto2),
      'y no lo lleva cuando no hay nada que advertir', asunto2 || '—');
  }

  console.log('\n5 · Pagado contra sin pagar');
  {
    const limpio = crearPago._interno.leerCliente(CLIENTE);
    const base = { referencia: 'ZC-260815-TEST0003', lineas: LINEAS, cuentas: CUENTAS, cliente: limpio };

    /* El pedido en línea se avisa al crearse, antes de que exista el pago. Si la
       hoja no lo dice, se despacha algo que nadie ha cobrado todavía. */
    const sinPagar = correo.plantillaTienda(Object.assign({ pago: 'anticipado' }, base));
    comprobar(/sin confirmar|no despachar/i.test(sinPagar),
      'el pedido en línea sin confirmar avisa de que no se despache aún');

    const pagado = correo.plantillaTienda(Object.assign({ pago: 'anticipado', pagado: true }, base));
    comprobar(/PAGO CONFIRMADO/.test(pagado) && !/no despachar/i.test(pagado),
      'y cuando Wompi confirma, dice que ya se puede despachar');

    /* Lo que importa del aviso de pago: que no obligue a ir a buscar el correo
       anterior. Tiene que traer la hoja entera, indicaciones incluidas. */
    let asunto = null, cuerpo = null;
    const fetchReal = globalThis.fetch;
    globalThis.fetch = async (u, o) => {
      const b = JSON.parse(o.body); asunto = b.subject; cuerpo = b.html;
      return { ok: true, status: 200, json: async () => ({ id: 'x' }) };
    };
    await correo.pagoTienda({
      referencia: 'ZC-260815-TEST0003', total: CUENTAS.total,
      pedido: { cliente: limpio, lineas: LINEAS, cuentas: CUENTAS, pago: 'anticipado' },
    });
    globalThis.fetch = fetchReal;
    comprobar(asunto && /PAGADO/.test(asunto) && /despachar/i.test(asunto),
      'el asunto del pago dice que hay que despachar', asunto || '—');
    comprobar(cuerpo && cuerpo.includes(limpio.notas),
      'y el aviso de pago repite las indicaciones de entrega, sin mandar a buscar otro correo');

    /* Si el registro no se pudo leer, el aviso sale igual con lo que se sepa:
       perder el aviso del cobro es peor que mandarlo incompleto. */
    let asunto2 = null;
    globalThis.fetch = async (u, o) => { asunto2 = JSON.parse(o.body).subject; return { ok: true, status: 200, json: async () => ({ id: 'x' }) }; };
    const r = await correo.pagoTienda({ referencia: 'ZC-260815-TEST0004', total: 99000, pedido: null });
    globalThis.fetch = fetchReal;
    comprobar(r.enviado !== false && asunto2 && /PAGADO/.test(asunto2),
      'sin registro en el almacén, el aviso del cobro sale igual', asunto2 || '—');
  }

  console.log(fallos ? `\nHoja de despacho: ${fallos} en rojo` : '\nHoja de despacho en verde ✓');
})();
