'use strict';
/* Skydropx solo por panel web, sin API ni webhooks — así que el disparador es
 * el correo que manda por cada evento, correlacionado con el pedido por la
 * referencia que ya se pega a mano al crear la guía. Esto es lo que n8n llama
 * después de reconocer ese correo: valida, busca el pedido, evita mandar el
 * mismo aviso dos veces, y devuelve lo que el nodo de WhatsApp necesita para
 * escribirle a la clienta.
 *
 * ── Por qué pide clave por header, a diferencia de disponibilidad/armar-carrito ──
 *
 * Esos dos no devuelven nada personal: precios y existencias ya son públicos
 * en la tienda. Este sí devuelve celular y nombre — exactamente lo que
 * `_pedidos.mjs` dice a propósito que no hay que exponer sin más en un sitio
 * que cobra. De ahí la clave: sin el header correcto, ni se lee el pedido.
 *
 * ── Qué no hace ──
 *
 * No manda el WhatsApp — eso lo hace n8n con la plantilla ya aprobada por
 * Meta. Esto solo decide a quién, con qué texto exacto, y si ya se avisó
 * antes de este mismo evento para no repetirlo.
 */
import crypto from 'node:crypto';
import { leer, marcar } from './_pedidos.mjs';
import { EVENTOS, TEXTOS } from './_envios.mjs';

const CABECERAS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const responder = (codigo, cuerpo) =>
  new Response(JSON.stringify(cuerpo), { status: codigo, headers: CABECERAS });

/* Comparación en tiempo constante: una clave que protege celular y nombre de
   clientas no debería filtrarse un carácter a la vez por cuánto tarda la
   respuesta. */
function claveValida(req) {
  const esperada = String(process.env.ENVIO_ESTADO_KEY || '');
  const recibida = String(req.headers.get('x-zephora-automation-key') || '');
  if (!esperada || !recibida) return false;
  const a = Buffer.from(esperada);
  const b = Buffer.from(recibida);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export default async (req) => {
  if (req.method !== 'POST') return responder(405, { error: 'Solo POST' });
  if (!claveValida(req)) return responder(401, { error: 'Clave inválida o ausente' });

  let cuerpo;
  try {
    cuerpo = JSON.parse((await req.text()) || '{}');
  } catch (_) {
    return responder(400, { error: 'El cuerpo no llegó en JSON válido' });
  }

  const { referencia, evento, guia, transportadora, urlSeguimiento } = cuerpo;
  if (!referencia || !guia || !transportadora || !urlSeguimiento) {
    return responder(400, { error: 'Falta referencia, guia, transportadora o urlSeguimiento' });
  }
  if (!EVENTOS.includes(evento)) {
    return responder(400, { error: `evento debe ser uno de: ${EVENTOS.join(', ')}` });
  }

  const pedido = await leer(referencia);
  if (!pedido || !pedido.cliente || !pedido.cliente.celular) {
    return responder(404, { error: 'No existe un pedido con celular registrado para esa referencia' });
  }

  const envios = pedido.envios || [];
  const yaEnviado = envios.some(e => e.evento === evento);

  if (!yaEnviado) {
    await marcar(referencia, {
      envios: [...envios, {
        evento, guia, transportadora, urlSeguimiento,
        notificadoEn: new Date().toISOString(),
      }],
    });
  }

  return responder(200, {
    celular: pedido.cliente.celular,
    nombre: pedido.cliente.nombre,
    evento,
    textoEstado: TEXTOS[evento],
    guia, transportadora, urlSeguimiento,
    yaEnviado,
  });
};
