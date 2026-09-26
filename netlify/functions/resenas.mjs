/* Reseñas de producto con moderación (automatizaciones/tienda/ENCARGO-FICHA.md).
 *
 *   GET  ?producto=<id>          → las APROBADAS de esa pieza, con promedio y
 *                                  conteo reales (nunca un número fijo)
 *   POST {producto, estrellas, texto, nombre, ciudad, resena?, web}
 *                                → queda PENDIENTE y la tienda recibe un
 *                                  correo con enlaces para aprobar o rechazar
 *   GET  ?moderar=<id>.<accion>.<firma>  → aprueba o rechaza (enlace del correo)
 *
 * ── Reglas ──
 *
 * - Nada se publica solo. Se publican también las de 3 estrellas o menos si
 *   son reales: ocultarlas todas se nota y es engañoso.
 * - «Compra verificada» solo si es verdad: la reseña trae `resena` =
 *   <referencia>.<firma>, el enlace firmado que llega tras la entrega
 *   (enlaceResena(), lo devuelve envio-estado en el evento «entregado»), el
 *   pedido existe y contiene esta pieza. Sin eso se acepta, pero sin chulo.
 * - Las firmas usan SUSCRIPCION_SECRETO con un propósito distinto en cada una
 *   («resena-verificada», «resena-moderar»): una firma de un tipo no sirve para
 *   otro.
 */
import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { nombres } from './_precios.js';
import { leer as leerPedido } from './_pedidos.mjs';
import { enviar, correoTienda, esc } from './_correo.js';

const TIENDA = process.env.CONTEXT === 'production' ? 'resenas' : 'resenas-pruebas';
let inyectado = null;
function almacen() {
  if (inyectado) return inyectado;
  try { return getStore({ name: TIENDA, consistency: 'strong' }); } catch (e) {
    console.error('resenas: sin almacén —', e.message); return null;
  }
}

const secreto = () => String(process.env.SUSCRIPCION_SECRETO || '');
const firma = (proposito, dato) => crypto.createHmac('sha256', secreto()).update(proposito + '|' + dato).digest('base64url');
const iguales = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y); };
const sitio = () => (process.env.URL_SITIO || process.env.URL || 'https://zephoracharms.com').replace(/\/$/, '');

/* El enlace para reseñar una pieza de un pedido entregado. */
export function enlaceResena(referencia, producto) {
  if (secreto().length < 16) return null;
  const t = `${referencia}.${firma('resena-verificada', referencia)}`;
  return `${sitio()}/producto-${encodeURIComponent(producto)}.html?resena=${encodeURIComponent(t)}#resenas-pieza`;
}

async function verificada(token, producto) {
  if (!token || secreto().length < 16) return null;
  const i = String(token).lastIndexOf('.');
  if (i < 1) return null;
  const ref = token.slice(0, i), f = token.slice(i + 1);
  if (!iguales(f, firma('resena-verificada', ref))) return null;
  const pedido = await leerPedido(ref);
  const tiene = pedido && (pedido.lineas || []).some(l => l.id === producto);
  return tiene ? ref : null;
}

const H_JSON = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const json = (c, d, h) => new Response(JSON.stringify(d), { status: c, headers: h || H_JSON });
const texto = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

const intentos = new Map();
function frenar(ip) {
  const ahora = Date.now(), l = (intentos.get(ip) || []).filter(t => ahora - t < 3600e3);
  l.push(ahora); intentos.set(ip, l);
  if (intentos.size > 5000) intentos.clear();
  return l.length > 5;
}

function pagina(titulo, cuerpo) {
  return new Response(`<!DOCTYPE html><html lang="es-CO"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(titulo)}</title><style>body{margin:0;background:#F6F3F4;font:400 16px/1.6 Arial,sans-serif;color:#2A1F2E}
main{max-width:520px;margin:12vh auto;padding:26px;background:#fff;border:1px solid #E4DDE0}</style></head>
<body><main><h1 style="font:400 26px Georgia,serif">${esc(titulo)}</h1><p>${cuerpo}</p></main></body></html>`,
  { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function aprobadas(producto) {
  const s = almacen();
  if (!s) return null;
  const { blobs } = await s.list({ prefix: producto + '/' });
  const todas = await Promise.all((blobs || []).map(b => s.get(b.key, { type: 'json' }).catch(() => null)));
  return todas.filter(r => r && r.estado === 'aprobada').sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

export default async (req) => {
  const url = new URL(req.url, 'https://zephoracharms.com');

  if (req.method === 'GET') {
    const mod = url.searchParams.get('moderar');
    if (mod) {
      const [clave, accion, f] = mod.split('.');
      const id = clave && decodeURIComponent(clave);
      if (!id || !['aprobar', 'rechazar'].includes(accion) || !f || !iguales(f, firma('resena-moderar', id + '|' + accion))) {
        return pagina('Enlace no válido', 'Este enlace de moderación no es válido.');
      }
      const s = almacen();
      const r = s && await s.get(id, { type: 'json' });
      if (!r) return pagina('No encontrada', 'Esa reseña ya no existe.');
      r.estado = accion === 'aprobar' ? 'aprobada' : 'rechazada';
      r.moderada = new Date().toISOString();
      await s.setJSON(id, r);
      console.log(JSON.stringify({ evento: 'resena_' + r.estado, producto: r.producto }));
      return pagina(accion === 'aprobar' ? 'Reseña publicada' : 'Reseña rechazada',
        accion === 'aprobar' ? 'Ya se ve en la página de la pieza (puede tardar un minuto por la caché).' : 'No se publicará.');
    }
    const producto = url.searchParams.get('producto');
    if (!producto || !(producto in nombres)) return json(400, { error: 'Pieza desconocida' });
    const lista = await aprobadas(producto);
    if (!lista) return json(503, { error: 'El almacén no respondió' });
    const total = lista.length;
    const promedio = total ? lista.reduce((n, r) => n + r.estrellas, 0) / total : 0;
    return json(200, {
      producto, total, promedio: Math.round(promedio * 10) / 10,
      resenas: lista.slice(0, 30).map(r => ({ estrellas: r.estrellas, texto: r.texto, nombre: r.nombre,
        ciudad: r.ciudad, fecha: r.fecha.slice(0, 10), verificada: Boolean(r.verificada) })),
    }, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60' });
  }

  if (req.method !== 'POST') return json(405, { error: 'Solo GET o POST' });
  let d;
  try { d = JSON.parse((await req.text()) || '{}'); } catch (_) { return json(400, { error: 'JSON inválido' }); }
  if (d.web) return json(200, { ok: true });                                   // trampa: bot
  const producto = String(d.producto || '');
  if (!(producto in nombres)) return json(400, { error: 'Pieza desconocida' });
  const estrellas = Number(d.estrellas);
  if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) return json(400, { error: 'Elige de 1 a 5 estrellas' });
  const cuerpo = texto(d.texto, 800), nombre = texto(d.nombre, 40), ciudad = texto(d.ciudad, 40);
  if (cuerpo.length < 10) return json(400, { error: 'La reseña es muy corta' });
  if (nombre.length < 2) return json(400, { error: 'Falta tu nombre' });
  if (secreto().length < 16) return json(503, { error: 'Las reseñas no están disponibles en este momento' });
  const ip = String(req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  if (frenar(ip || 'sin-ip')) return json(429, { error: 'Demasiadas reseñas seguidas. Prueba más tarde.' });

  const s = almacen();
  if (!s) return json(503, { error: 'No pudimos guardar tu reseña. Intenta más tarde.' });
  const ref = await verificada(d.resena, producto);
  const id = `${producto}/${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const r = { id, producto, estrellas, texto: cuerpo, nombre, ciudad, verificada: Boolean(ref), referencia: ref,
    estado: 'pendiente', fecha: new Date().toISOString() };
  await s.setJSON(id, r);

  const enlace = accion => `${sitio()}/resenas?moderar=${encodeURIComponent(id)}.${accion}.${firma('resena-moderar', id + '|' + accion)}`;
  const { para } = correoTienda();
  const aviso = await enviar({
    para,
    asunto: `Reseña nueva · ${'★'.repeat(estrellas)} · ${nombres[producto]}${ref ? ' · compra verificada' : ''}`,
    html: `<p style="font:400 15px/1.6 Arial,sans-serif"><b>${esc(nombres[producto])}</b> · ${'★'.repeat(estrellas)}${'☆'.repeat(5 - estrellas)}<br>`
      + `«${esc(cuerpo)}»<br>— ${esc(nombre)}${ciudad ? ', ' + esc(ciudad) : ''}${ref ? ` · pedido ${esc(ref)} (compra verificada)` : ' · sin pedido asociado'}</p>`
      + `<p><a href="${enlace('aprobar')}">Publicar</a> · <a href="${enlace('rechazar')}">Rechazar</a></p>`
      + `<p style="font:400 12px/1.5 Arial,sans-serif;color:#8a8290">Se publican también las de pocas estrellas si son reales.</p>`,
    txt: `${nombres[producto]} · ${estrellas}/5\n«${cuerpo}»\n— ${nombre}${ciudad ? ', ' + ciudad : ''}\n\nPublicar: ${enlace('aprobar')}\nRechazar: ${enlace('rechazar')}`,
  });
  console.log(JSON.stringify({ evento: 'resena_pendiente', producto, estrellas, verificada: Boolean(ref), aviso: aviso.enviado }));
  return json(200, { ok: true });
};

export const _interno = { usar(f) { inyectado = f; }, firma };
