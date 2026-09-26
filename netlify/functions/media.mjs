/**
 * Videos de la tienda, servidos desde Netlify Blobs (almacén «media»).
 *
 * Los videos NO se comitean (CLAUDE.md): cada despliegue cuesta ~15 créditos
 * y el historial de git se los quedaría para siempre. Se suben una vez con
 * `node herramientas/subir_media.mjs <archivo.mp4>` y se piden en
 * /media/<nombre>.mp4 (regla de netlify.toml → esta función).
 *
 * Dos cosas que no son adorno:
 * - Rangos (206). Safari en iPhone no reproduce un <video> si el servidor no
 *   responde a `Range: bytes=…`: pide los primeros bytes, y con un 200 entero
 *   se niega. Se responde el trozo pedido con Content-Range.
 * - Caché. El nombre lleva versión (…-v1.mp4): un video cambiado es otro
 *   archivo, así que se cachea un año, en el navegador y en la CDN de Netlify
 *   (`durable`), y la función casi no se invoca. `Vary: Range` separa en la
 *   CDN cada trozo del archivo entero.
 *
 * El almacén es de todo el sitio (no por despliegue): la vista previa y
 * producción ven los mismos videos, como debe ser con un archivo versionado.
 */
import { getStore } from '@netlify/blobs';

const NOMBRE = /^[a-z0-9][a-z0-9-]{0,80}\.(mp4|webm)$/;
const TIPOS = { mp4: 'video/mp4', webm: 'video/webm' };
const CACHE = 'public, max-age=31536000, immutable';

/* Las pruebas inyectan un almacén en memoria (pruebas/media.js). */
let almacen = null;
export const _interno = { usar: a => { almacen = a; } };

export default async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('', { status: 405 });
  const f = new URL(req.url).searchParams.get('f') || '';
  if (!NOMBRE.test(f)) return new Response('', { status: 404 });

  let datos;
  try {
    datos = await (almacen || getStore('media')).get(f, { type: 'arrayBuffer' });
  } catch (e) {
    console.error(JSON.stringify({ evento: 'media_error', archivo: f, error: String(e && e.message || e) }));
    return new Response('', { status: 503 });
  }
  if (!datos) return new Response('', { status: 404 });

  const total = datos.byteLength;
  const cab = {
    'Content-Type': TIPOS[f.split('.').pop()],
    'Accept-Ranges': 'bytes',
    'Cache-Control': CACHE,
    'Netlify-CDN-Cache-Control': 'public, durable, max-age=31536000, immutable',
    'Vary': 'Range',
  };

  const rango = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') || '');
  if (!rango) {
    return new Response(req.method === 'HEAD' ? null : datos, { status: 200, headers: { ...cab, 'Content-Length': String(total) } });
  }
  let ini, fin;
  if (rango[1] === '') { ini = Math.max(0, total - Number(rango[2])); fin = total - 1; }   // bytes=-N: los últimos N
  else { ini = Number(rango[1]); fin = rango[2] === '' ? total - 1 : Math.min(Number(rango[2]), total - 1); }
  if (!(ini <= fin) || ini >= total) {
    return new Response('', { status: 416, headers: { ...cab, 'Content-Range': `bytes */${total}` } });
  }
  const trozo = datos.slice(ini, fin + 1);
  return new Response(req.method === 'HEAD' ? null : trozo, {
    status: 206,
    headers: { ...cab, 'Content-Range': `bytes ${ini}-${fin}/${total}`, 'Content-Length': String(trozo.byteLength) },
  });
};
