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

async function main() {
  const { EVENTOS, TEXTOS } = await import('../netlify/functions/_envios.mjs');
  const CLAVE = 'clave-de-prueba-treinta-y-dos-c';
  process.env.ENVIO_ESTADO_KEY = CLAVE;
  const mod = await import('../netlify/functions/envio-estado.mjs');

  const REFERENCIA = 'ZC-260918-TESTCASE';
  const CUERPO_VALIDO = {
    referencia: REFERENCIA, evento: 'creada',
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

  console.log(fallos ? `\nEnvío-estado: ${fallos} en rojo` : '\nEnvío-estado en verde ✓');
}

main().catch(e => { console.log('  ✗ FALLA la batería reventó — ' + e.stack); });
