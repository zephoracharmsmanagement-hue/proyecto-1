'use strict';
/* Confirmación y estado de envío por WhatsApp (Skydropx) — el endpoint que
 * llama n8n después de reconocer el correo de cada evento.
 *
 * Lo que hay que demostrar no es solo que responda, sino que protege lo que
 * `_pedidos.mjs` documenta a propósito que no hay que exponer sin más: sin la
 * clave correcta, ni se lee el pedido. Y que nunca manda el mismo aviso dos
 * veces para el mismo evento del mismo pedido.
 */
const path = require('path');
const fs = require('fs');

const RAIZ = path.join(__dirname, '..');

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

/* Imita Netlify Blobs en lo poco que `_pedidos.mjs` usa, igual que
   `pruebas/armar-carrito.js` hace con `_inventario.mjs`. */
function almacenFalso(inicial) {
  const datos = inicial || {};
  return {
    async get(clave) { return datos[clave] ? JSON.parse(JSON.stringify(datos[clave])) : null; },
    async setJSON(clave, valor) { datos[clave] = JSON.parse(JSON.stringify(valor)); return { modified: true }; },
    async delete(clave) { delete datos[clave]; },
    async list() { return { blobs: Object.keys(datos).map(key => ({ key })) }; },
  };
}

const PEDIDO = {
  referencia: 'ZC-260918-TESTCASE',
  cliente: { nombre: 'Valentina', apellido: 'Ríos', celular: '3018990672' },
};

async function main() {
  const { EVENTOS, TEXTOS } = await import('../netlify/functions/_envios.mjs');
  const CLAVE = 'clave-de-prueba-treinta-y-dos-c';
  process.env.ENVIO_ESTADO_KEY = CLAVE;
  const mod = await import('../netlify/functions/envio-estado.mjs');
  const pedidos = await import('../netlify/functions/_pedidos.mjs');

  const CUERPO_VALIDO = {
    referencia: PEDIDO.referencia, evento: 'creada',
    guia: 'SKX-1', transportadora: 'Interrapidísimo', urlSeguimiento: 'https://x.test/1',
  };

  const pedir = async (cuerpo, { metodo = 'POST', clave = CLAVE } = {}) => {
    const headers = new Headers();
    if (clave !== null) headers.set('x-zephora-automation-key', clave);
    const r = await mod.default({ method: metodo, headers, text: async () => JSON.stringify(cuerpo) });
    const texto = await r.text();
    return { r, d: texto ? JSON.parse(texto) : null };
  };

  console.log('\n1 · Los seis eventos y sus textos');
  {
    comprobar(EVENTOS.length === 6, 'hay exactamente seis eventos canónicos', EVENTOS.join(', '));
    comprobar(EVENTOS.every(e => typeof TEXTOS[e] === 'string' && TEXTOS[e].length > 10),
      'cada evento tiene un texto real para la clienta, no un placeholder');
  }

  console.log('\n2 · Solo POST, y solo con la clave correcta');
  {
    const { r: metodoMalo } = await pedir(CUERPO_VALIDO, { metodo: 'GET' });
    comprobar(metodoMalo.status === 405, 'GET no está permitido', String(metodoMalo.status));

    const { r: sinClave } = await pedir(CUERPO_VALIDO, { clave: null });
    comprobar(sinClave.status === 401, 'sin header de clave, 401', String(sinClave.status));

    const { r: claveMala } = await pedir(CUERPO_VALIDO, { clave: 'otra-clave-cualquiera' });
    comprobar(claveMala.status === 401, 'con la clave equivocada, también 401', String(claveMala.status));
  }

  console.log('\n3 · Validación del cuerpo');
  {
    const { referencia, ...sinReferencia } = CUERPO_VALIDO;
    const { r: faltaCampo, d: dFaltaCampo } = await pedir(sinReferencia);
    comprobar(faltaCampo.status === 400, 'sin referencia, 400', String(faltaCampo.status));
    comprobar(typeof dFaltaCampo.error === 'string', 'con un mensaje de error, no un cuerpo vacío');

    const { r: eventoRaro } = await pedir(Object.assign({}, CUERPO_VALIDO, { evento: 'perdido' }));
    comprobar(eventoRaro.status === 400, 'evento fuera de la lista cerrada, 400', String(eventoRaro.status));

    const headersOk = new Headers();
    headersOk.set('x-zephora-automation-key', CLAVE);
    const rJsonRoto = await mod.default({ method: 'POST', headers: headersOk, text: async () => '{ esto no es json' });
    comprobar(rJsonRoto.status === 400, 'cuerpo que no es JSON válido, 400', String(rJsonRoto.status));
  }

  console.log('\n4 · Referencia inexistente o sin celular registrado');
  {
    pedidos._interno.usarAlmacen(almacenFalso({}));
    const { r: sinPedido } = await pedir(CUERPO_VALIDO);
    comprobar(sinPedido.status === 404, 'referencia que no existe, 404 — nunca se adivina a quién avisar',
      String(sinPedido.status));

    pedidos._interno.usarAlmacen(almacenFalso({ 'ZC-SIN-CLIENTE': { referencia: 'ZC-SIN-CLIENTE' } }));
    const { r: sinCliente } = await pedir(Object.assign({}, CUERPO_VALIDO, { referencia: 'ZC-SIN-CLIENTE' }));
    comprobar(sinCliente.status === 404, 'pedido sin celular registrado todavía, también 404',
      String(sinCliente.status));
  }

  console.log('\n5 · Caso válido por evento, y anti-duplicados');
  {
    /* "excepcion" queda fuera de este bucle a propósito: dispara un correo a
       la tienda (Task 4), y ese camino solo se ejerce en § 6, donde
       RESEND_API_KEY queda forzada a vacía para no arriesgar un envío real. */
    pedidos._interno.usarAlmacen(almacenFalso({ [PEDIDO.referencia]: PEDIDO }));
    const eventosSinExcepcion = EVENTOS.filter(e => e !== 'excepcion');

    for (const evento of eventosSinExcepcion) {
      const cuerpo = { referencia: PEDIDO.referencia, evento,
        guia: 'SKX-' + evento, transportadora: 'Coordinadora', urlSeguimiento: 'https://x.test/' + evento };
      const { r, d } = await pedir(cuerpo);
      comprobar(r.status === 200, `evento "${evento}", 200`, String(r.status));
      comprobar(d.textoEstado === TEXTOS[evento],
        `evento "${evento}" devuelve exactamente el texto de _envios.mjs, no uno inventado aquí`);
      comprobar(d.celular === PEDIDO.cliente.celular && d.nombre === PEDIDO.cliente.nombre,
        `evento "${evento}" trae el celular y el nombre del pedido guardado`);
      comprobar(d.yaEnviado === false, `evento "${evento}", primera vez, yaEnviado es false`);
    }

    const repetido = { referencia: PEDIDO.referencia, evento: 'en_transito',
      guia: 'SKX-en_transito', transportadora: 'Coordinadora', urlSeguimiento: 'https://x.test/en_transito' };
    const { r: segunda, d: d2 } = await pedir(repetido);
    comprobar(segunda.status === 200, 'repetir el mismo evento sigue respondiendo 200', String(segunda.status));
    comprobar(d2.yaEnviado === true, 'pero avisa que ya se había mandado — n8n no debe repetir el WhatsApp');

    const guardado = await pedidos.leer(PEDIDO.referencia);
    comprobar(Array.isArray(guardado.envios) && guardado.envios.length === eventosSinExcepcion.length,
      'cada evento distinto se guarda una sola vez, y repetir uno no agrega una fila más',
      String(guardado.envios.length));
  }

  console.log('\n6 · Una incidencia avisa también a la tienda');
  {
    pedidos._interno.usarAlmacen(almacenFalso({ [PEDIDO.referencia]: PEDIDO }));

    /* Ver la constante de "Global Constraints": sin esto, quien tenga una
       RESEND_API_KEY real puesta en su entorno mandaría un correo de verdad. */
    const llaveAntes = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = '';
    const original = console.log;
    const capturado = [];
    console.log = (...args) => { capturado.push(args.join(' ')); };

    const { r, d } = await pedir({ referencia: PEDIDO.referencia, evento: 'excepcion',
      guia: 'SKX-9', transportadora: 'Coordinadora', urlSeguimiento: 'https://x.test/9' });

    console.log = original;
    if (llaveAntes === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = llaveAntes;

    comprobar(r.status === 200, 'una incidencia sigue respondiendo 200 a n8n', String(r.status));
    comprobar(d.textoEstado === TEXTOS.excepcion, 'con el texto neutro de excepcion, no uno alarmante inventado aquí');
    comprobar(capturado.some(l => l.includes('no se manda correo')),
      'sin RESEND_API_KEY en la prueba, intenta avisar a la tienda y lo deja escrito en el log');
  }

  console.log('\n7 · Forma del código');
  {
    const codigo = fs.readFileSync(path.join(RAIZ, 'netlify', 'functions', 'envio-estado.mjs'), 'utf8');
    comprobar(/from '\.\/_pedidos\.mjs'/.test(codigo) && /\bleer\(/.test(codigo) && /\bmarcar\(/.test(codigo),
      'usa leer/marcar de _pedidos.mjs — no un lector ni un escritor propios');
    comprobar(/timingSafeEqual/.test(codigo),
      'compara la clave en tiempo constante, no con === directo');
  }

  pedidos._interno.usarAlmacen(null);
  console.log(fallos ? `\nEnvío-estado: ${fallos} en rojo` : '\nEnvío-estado en verde ✓');
}

main().catch(e => { console.log('  ✗ FALLA la batería reventó — ' + e.stack); });
