/* La lista de suscriptoras confirmadas, para que n8n haga los envíos.
 * Solo correo, fecha y el enlace de baja firmado de cada una (cada correo que
 * se mande tiene que llevarlo: Ley 1581). Protegido por
 * `x-zephora-automation-key` contra SUSCRIPTORES_KEY, como envio-estado.mjs.
 * Los envíos masivos no son parte de esto. */
import crypto from 'node:crypto';
import { confirmadas, firmar, configurado } from './_suscriptores.mjs';

const H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const json = (c, d) => new Response(JSON.stringify(d), { status: c, headers: H });

function claveValida(req) {
  const esperada = String(process.env.SUSCRIPTORES_KEY || '');
  const recibida = String(req.headers.get('x-zephora-automation-key') || '');
  if (!esperada || !recibida) return false;
  const a = Buffer.from(esperada), b = Buffer.from(recibida);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async (req) => {
  if (req.method !== 'GET') return json(405, { error: 'Solo GET' });
  if (!claveValida(req)) {
    console.warn('suscriptores-export: clave inválida o ausente');
    return json(401, { error: 'Clave inválida o ausente' });
  }
  const lista = await confirmadas();
  if (!lista) return json(503, { error: 'El almacén no respondió' });
  const sitio = (process.env.URL_SITIO || process.env.URL || 'https://zephoracharms.com').replace(/\/$/, '');
  return json(200, {
    total: lista.length,
    suscriptoras: lista.map(s => Object.assign({}, s, configurado()
      ? { baja: `${sitio}/suscribir?baja=${encodeURIComponent(firmar('baja', s.correo))}` } : {})),
  });
};
