/* Suscripción por correo con doble confirmación. Ver _suscriptores.mjs y
 * automatizaciones/suscripcion/BRIEF.md.
 *
 *   POST  { correo, acepta: true, web: '' }  → manda el correo de confirmación
 *   GET   ?confirmar=<token>                 → guarda y muestra «Listo»
 *   GET   ?baja=<token>                      → borra y muestra «Te diste de baja»
 *
 * Responde SIEMPRE lo mismo al POST, exista o no el correo: no se puede usar
 * para averiguar quién está suscrita. `web` es un campo trampa oculto: si llega
 * lleno es un bot, y recibe el mismo 200 sin que se haga nada.
 *
 * La autorización (Ley 1581) solo cuenta como booleano `true`: "true", 1 o
 * "sí" no fabrican un permiso que nadie dio —misma regla que el optin del
 * checkout—.
 */
import {
  normalizar, correoValido, configurado, firmar, verificar,
  confirmarSuscripcion, darDeBaja, MIN_CHARMS_REGALO,
} from './_suscriptores.mjs';
import { enviar, esc } from './_correo.js';

const JSON_H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const json = (c, d) => new Response(JSON.stringify(d), { status: c, headers: JSON_H });
const MENSAJE = 'Revisa tu correo: te mandamos un enlace para confirmar.';

/* Límite por IP, en la memoria de esta instancia de la función. Es un freno
   de buena fe contra ráfagas, no un muro: Netlify puede repartir peticiones
   entre instancias. */
const intentos = new Map();
function frenar(ip) {
  const ahora = Date.now(), ventana = 10 * 60 * 1000;
  const lista = (intentos.get(ip) || []).filter(t => ahora - t < ventana);
  lista.push(ahora);
  intentos.set(ip, lista);
  if (intentos.size > 5000) intentos.clear();
  return lista.length > 5;
}

const sitio = () => (process.env.URL_SITIO || process.env.URL || 'https://zephoracharms.com').replace(/\/$/, '');

function pagina(titulo, cuerpo, { suscrita } = {}) {
  return new Response(`<!DOCTYPE html><html lang="es-CO"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(titulo)} · Zephora Charms</title>
<style>body{margin:0;background:#F6F3F4;color:#2A1F2E;font:400 16px/1.6 Arial,sans-serif}
main{max-width:520px;margin:12vh auto;padding:28px 22px;background:#fff;border:1px solid #E4DDE0;text-align:center}
h1{font:400 30px/1.2 Georgia,serif;margin:0 0 12px}p{margin:0 0 18px;color:#5a4d5e}
a{display:inline-block;background:#2A1F2E;color:#fff;text-decoration:none;padding:14px 26px;letter-spacing:.08em;
text-transform:uppercase;font-size:13px}</style></head><body><main>
<h1>${esc(titulo)}</h1><p>${cuerpo}</p><a href="${sitio()}/">Ir a la tienda</a></main>
${suscrita ? `<script>try{localStorage.setItem('zephora.suscrita','1')}catch(e){}</script>` : ''}
</body></html>`, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function correoConfirmacion(correo) {
  const url = `${sitio()}/suscribir?confirmar=${encodeURIComponent(firmar('confirmar', correo))}`;
  const baja = `${sitio()}/suscribir?baja=${encodeURIComponent(firmar('baja', correo))}`;
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#F6F3F4;font:400 15px/1.6 Arial,sans-serif;color:#2A1F2E">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #E4DDE0">
<tr><td style="padding:26px">
<p style="margin:0 0 6px;font:400 24px/1.2 Georgia,serif">Confirma tu suscripción</p>
<p style="margin:0 0 18px;color:#5a4d5e">Toca el botón y quedas suscrita. Tu charm de regalo se aplica solo en tu
primera compra de ${MIN_CHARMS_REGALO} charms o más, usando este mismo correo.</p>
<a href="${url}" style="display:inline-block;background:#2A1F2E;color:#fff;text-decoration:none;padding:14px 24px;
letter-spacing:.08em;text-transform:uppercase;font-size:13px">Confirmar</a>
<p style="margin:18px 0 0;font-size:12px;color:#8a8290">Si no fuiste tú, ignora este correo: sin confirmar no guardamos
nada. El enlace vence en 7 días. <a href="${baja}" style="color:#8a8290">Darme de baja</a></p>
</td></tr></table></td></tr></table></body></html>`;
  const txt = `Confirma tu suscripción a Zephora Charms:\n${url}\n\nTu charm de regalo se aplica en tu primera compra de `
    + `${MIN_CHARMS_REGALO} charms o más con este correo.\nSi no fuiste tú, ignora este correo.\nDarme de baja: ${baja}`;
  return enviar({ para: correo, asunto: 'Confirma tu suscripción · Zephora Charms', html, txt });
}

export default async (req) => {
  const url = new URL(req.url, 'https://zephoracharms.com');

  if (req.method === 'GET') {
    const tc = url.searchParams.get('confirmar'), tb = url.searchParams.get('baja');
    if (tc) {
      const correo = verificar('confirmar', tc);
      if (!correo) return pagina('Este enlace ya no sirve', 'Venció o está incompleto. Suscríbete de nuevo desde la tienda y te llega uno nuevo.');
      const r = await confirmarSuscripcion(correo);
      if (!r.ok) return pagina('No pudimos confirmarte', 'Fue un problema nuestro. Intenta con el mismo enlace en unos minutos.');
      console.log(JSON.stringify({ evento: 'suscripcion_confirmada', modo: r.modo }));
      return pagina('Listo, ya estás suscrita',
        `Tu charm de regalo se aplica solo en tu primera compra de ${MIN_CHARMS_REGALO} charms o más, usando este mismo correo.`,
        { suscrita: true });
    }
    if (tb) {
      const correo = verificar('baja', tb);
      if (!correo) return pagina('Este enlace no es válido', 'Si quieres darte de baja, escríbenos y lo hacemos a mano.');
      await darDeBaja(correo);
      console.log(JSON.stringify({ evento: 'suscripcion_baja' }));
      return pagina('Te diste de baja', 'Ya no te escribiremos. Tus pedidos siguen funcionando igual.');
    }
    return json(405, { error: 'Solo POST' });
  }
  if (req.method !== 'POST') return json(405, { error: 'Solo POST' });

  let d;
  try { d = JSON.parse((await req.text()) || '{}'); } catch (_) { return json(400, { error: 'JSON inválido' }); }
  if (d.web) return json(200, { ok: true, mensaje: MENSAJE });           // trampa: bot
  const correo = normalizar(d.correo);
  if (!correoValido(correo)) return json(400, { error: 'Ese correo no parece válido' });
  if (d.acepta !== true) return json(400, { error: 'Falta tu autorización para escribirte' });
  if (!configurado()) {
    console.error('suscribir: falta SUSCRIPCION_SECRETO');
    return json(503, { error: 'La suscripción no está disponible en este momento' });
  }
  const ip = String(req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  if (frenar(ip || 'sin-ip')) return json(429, { error: 'Demasiados intentos. Prueba en unos minutos.' });

  const r = await correoConfirmacion(correo);
  console.log(JSON.stringify({ evento: 'suscripcion_pedida', correoEnviado: r.enviado, motivo: r.motivo || null }));
  return json(200, { ok: true, mensaje: MENSAJE });
};
