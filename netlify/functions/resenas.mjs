/* Reseñas con moderación (automatizaciones/tienda/ENCARGO-FICHA.md y
 * ENCARGO-FICHA-2 § 3).
 *
 *   GET  (sin parámetros)        → TODAS las aprobadas de la tienda, las más
 *                                  recientes primero, con promedio y conteo
 *                                  reales. `?producto=` se acepta y se ignora:
 *                                  decisión del propietario (2026-09-26), cada
 *                                  ficha muestra las de toda la tienda.
 *   POST {producto, estrellas, texto, nombre, ciudad, resena?, web,
 *         fotos?: [dataURL ×≤3], video?: dataURL}
 *                                → queda PENDIENTE y la tienda recibe un
 *                                  correo con enlaces para ver lo adjunto y
 *                                  aprobar o rechazar
 *   GET  ?moderar=<id>.<accion>.<firma>  → aprueba o rechaza (enlace del correo)
 *   GET  ?medio=<clave>[&f=<firma>]      → una foto o video de una reseña:
 *                                  público solo si la reseña está aprobada;
 *                                  con firma, para verlo antes de moderar
 *
 * ── Reglas ──
 *
 * - Nada se publica solo, tampoco las fotos: el medio de una reseña pendiente
 *   o rechazada responde 404 sin firma. Se publican también las de 3 estrellas
 *   o menos si son reales: ocultarlas todas se nota y es engañoso.
 * - «Compra verificada» solo si es verdad: la reseña trae `resena` =
 *   <referencia>.<firma>, el enlace firmado que llega tras la entrega
 *   (enlaceResena(), lo devuelve envio-estado en el evento «entregado»), el
 *   pedido existe y contiene esta pieza. Sin eso se acepta, pero sin chulo.
 * - Las firmas usan SUSCRIPCION_SECRETO con un propósito distinto en cada una
 *   («resena-verificada», «resena-moderar», «resena-medio»): una firma de un
 *   tipo no sirve para otro.
 * - Tamaños: una función de Netlify recibe ~6 MB por petición. Las fotos llegan
 *   reducidas por el navegador (~1600 px); el video, con tope de 20 s y
 *   3,5 MB. Videos más largos piden un almacenamiento externo: pendiente del
 *   propietario (ORDEN.md).
 * - Para Google, estas reseñas NO van como AggregateRating del producto: son
 *   de la tienda, no de la pieza (gen_productos.py no lo publica).
 */
import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { nombres } from './_precios.js';
import { leer as leerPedido } from './_pedidos.mjs';
import { enviar, correoTienda, esc } from './_correo.js';
import { responderBytes } from './_rango.mjs';

const PROD = process.env.CONTEXT === 'production';
const TIENDA = PROD ? 'resenas' : 'resenas-pruebas';
const MEDIOS = PROD ? 'resenas-media' : 'resenas-media-pruebas';
let inyectado = null, inyectadoMedios = null;
function almacen() {
  if (inyectado) return inyectado;
  try { return getStore({ name: TIENDA, consistency: 'strong' }); } catch (e) {
    console.error('resenas: sin almacén —', e.message); return null;
  }
}
function almacenMedios() {
  if (inyectadoMedios) return inyectadoMedios;
  try { return getStore({ name: MEDIOS, consistency: 'strong' }); } catch (e) {
    console.error('resenas: sin almacén de medios —', e.message); return null;
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

/* ── Medios adjuntos ── */
const FOTO = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' };
const VIDEO = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
const TIPO_DE = { jpg: 'image/jpeg', webp: 'image/webp', png: 'image/png', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };
const MAX_FOTO = 1.5 * 1024 * 1024, MAX_VIDEO = 3.5 * 1024 * 1024;

function decodificar(dataUrl, tipos, max) {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m || !tipos[m[1]]) return { error: 'tipo' };
  const b = Buffer.from(m[2], 'base64');
  if (!b.length) return { error: 'tipo' };
  if (b.length > max) return { error: 'peso' };
  return { ext: tipos[m[1]], datos: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
}
const urlMedio = (clave, firmado) => `/resenas?medio=${encodeURIComponent(clave)}` + (firmado ? `&f=${firma('resena-medio', clave)}` : '');

async function servirMedio(req, clave, f) {
  if (!/^[^/]{1,80}\/[a-z0-9]+-[a-f0-9]{6}\/(f[123]\.(jpg|webp|png)|v\.(mp4|webm|mov))$/.test(clave)) return new Response('', { status: 404 });
  const firmado = f && secreto().length >= 16 && iguales(f, firma('resena-medio', clave));
  const s = almacen(), m = almacenMedios();
  if (!s || !m) return new Response('', { status: 503 });
  if (!firmado) {
    const r = await s.get(clave.slice(0, clave.lastIndexOf('/')), { type: 'json' });
    if (!r || r.estado !== 'aprobada') return new Response('', { status: 404 });
  }
  const datos = await m.get(clave, { type: 'arrayBuffer' });
  if (!datos) return new Response('', { status: 404 });
  return responderBytes(req, datos, TIPO_DE[clave.split('.').pop()], {
    'Cache-Control': firmado ? 'private, no-store' : 'public, max-age=3600',
  });
}

async function aprobadas() {
  const s = almacen();
  if (!s) return null;
  const { blobs } = await s.list();
  const todas = await Promise.all((blobs || []).map(b => s.get(b.key, { type: 'json' }).catch(() => null)));
  return todas.filter(r => r && r.estado === 'aprobada').sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

export default async (req) => {
  const url = new URL(req.url, 'https://zephoracharms.com');

  if (req.method === 'GET' || req.method === 'HEAD') {
    const medio = url.searchParams.get('medio');
    if (medio) return servirMedio(req, medio, url.searchParams.get('f'));

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
        accion === 'aprobar' ? 'Ya se ve en todas las páginas de producto (puede tardar un minuto por la caché).' : 'No se publicará.');
    }

    const lista = await aprobadas();
    if (!lista) return json(503, { error: 'El almacén no respondió' });
    const total = lista.length;
    const promedio = total ? lista.reduce((n, r) => n + r.estrellas, 0) / total : 0;
    return json(200, {
      total, promedio: Math.round(promedio * 10) / 10,
      resenas: lista.slice(0, 30).map(r => ({ estrellas: r.estrellas, texto: r.texto, nombre: r.nombre,
        ciudad: r.ciudad, fecha: r.fecha.slice(0, 10), verificada: Boolean(r.verificada),
        fotos: (r.fotos || []).map(k => urlMedio(k)), video: r.video ? urlMedio(r.video) : null })),
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

  const fotosIn = Array.isArray(d.fotos) ? d.fotos : [];
  if (fotosIn.length > 3) return json(400, { error: 'Hasta 3 fotos' });
  const fotos = fotosIn.map(x => decodificar(x, FOTO, MAX_FOTO));
  if (fotos.some(x => x.error === 'tipo')) return json(400, { error: 'Solo fotos JPG, WEBP o PNG' });
  if (fotos.some(x => x.error === 'peso')) return json(400, { error: 'Una foto pesa demasiado' });
  const video = d.video ? decodificar(d.video, VIDEO, MAX_VIDEO) : null;
  if (video && video.error === 'tipo') return json(400, { error: 'Solo video MP4, WEBM o MOV' });
  if (video && video.error === 'peso') return json(400, { error: 'El video pesa demasiado: máximo 20 segundos y 3,5 MB' });

  if (secreto().length < 16) return json(503, { error: 'Las reseñas no están disponibles en este momento' });
  const ip = String(req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  if (frenar(ip || 'sin-ip')) return json(429, { error: 'Demasiadas reseñas seguidas. Prueba más tarde.' });

  const s = almacen();
  const m = (fotos.length || video) ? almacenMedios() : null;
  if (!s || ((fotos.length || video) && !m)) return json(503, { error: 'No pudimos guardar tu reseña. Intenta más tarde.' });
  const ref = await verificada(d.resena, producto);
  const id = `${producto}/${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const claves = [];
  for (const [i, x] of fotos.entries()) { const k = `${id}/f${i + 1}.${x.ext}`; await m.set(k, x.datos); claves.push(k); }
  let claveVideo = null;
  if (video) { claveVideo = `${id}/v.${video.ext}`; await m.set(claveVideo, video.datos); }
  const r = { id, producto, estrellas, texto: cuerpo, nombre, ciudad, verificada: Boolean(ref), referencia: ref,
    fotos: claves, video: claveVideo, estado: 'pendiente', fecha: new Date().toISOString() };
  await s.setJSON(id, r);

  const enlace = accion => `${sitio()}/resenas?moderar=${encodeURIComponent(id)}.${accion}.${firma('resena-moderar', id + '|' + accion)}`;
  const adjuntos = [...claves.map((k, i) => [`Foto ${i + 1}`, k]), ...(claveVideo ? [['Video', claveVideo]] : [])]
    .map(([t, k]) => [t, sitio() + urlMedio(k, true)]);
  const { para } = correoTienda();
  const aviso = await enviar({
    para,
    asunto: `Reseña nueva · ${'★'.repeat(estrellas)} · ${nombres[producto]}${ref ? ' · compra verificada' : ''}${adjuntos.length ? ' · con ' + adjuntos.length + ' adjunto' + (adjuntos.length > 1 ? 's' : '') : ''}`,
    html: `<p style="font:400 15px/1.6 Arial,sans-serif"><b>${esc(nombres[producto])}</b> · ${'★'.repeat(estrellas)}${'☆'.repeat(5 - estrellas)}<br>`
      + `«${esc(cuerpo)}»<br>— ${esc(nombre)}${ciudad ? ', ' + esc(ciudad) : ''}${ref ? ` · pedido ${esc(ref)} (compra verificada)` : ' · sin pedido asociado'}</p>`
      + (adjuntos.length ? `<p style="font:400 14px/1.6 Arial,sans-serif">Revisa lo adjunto antes de publicar: ${adjuntos.map(([t, u]) => `<a href="${u}">${t}</a>`).join(' · ')}</p>` : '')
      + `<p><a href="${enlace('aprobar')}">Publicar</a> · <a href="${enlace('rechazar')}">Rechazar</a></p>`
      + `<p style="font:400 12px/1.5 Arial,sans-serif;color:#8a8290">Se publican también las de pocas estrellas si son reales. Al publicarla se ve en todas las páginas de producto, con sus fotos y video.</p>`,
    txt: `${nombres[producto]} · ${estrellas}/5\n«${cuerpo}»\n— ${nombre}${ciudad ? ', ' + ciudad : ''}\n`
      + adjuntos.map(([t, u]) => `${t}: ${u}`).join('\n') + `\n\nPublicar: ${enlace('aprobar')}\nRechazar: ${enlace('rechazar')}`,
  });
  console.log(JSON.stringify({ evento: 'resena_pendiente', producto, estrellas, verificada: Boolean(ref), fotos: claves.length, video: Boolean(claveVideo), aviso: aviso.enviado }));
  return json(200, { ok: true });
};

export const _interno = { usar(f) { inyectado = f; }, usarMedios(f) { inyectadoMedios = f; }, firma };
