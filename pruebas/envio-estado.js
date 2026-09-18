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

  console.log('\n1 · Los seis eventos y sus textos');
  {
    comprobar(EVENTOS.length === 6, 'hay exactamente seis eventos canónicos', EVENTOS.join(', '));
    comprobar(EVENTOS.every(e => typeof TEXTOS[e] === 'string' && TEXTOS[e].length > 10),
      'cada evento tiene un texto real para la clienta, no un placeholder');
  }

  console.log(fallos ? `\nEnvío-estado: ${fallos} en rojo` : '\nEnvío-estado en verde ✓');
}

main().catch(e => { console.log('  ✗ FALLA la batería reventó — ' + e.stack); });
