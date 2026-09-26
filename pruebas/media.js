'use strict';
/* Videos de la tienda desde Netlify Blobs (netlify/functions/media.mjs).
 *
 * Lo que se vigila, porque un fallo aquí no da error visible: Safari en
 * iPhone solo reproduce si el servidor responde a `Range` con 206 y el trozo
 * exacto; un 200 entero lo deja en negro. Y que la ruta no sirva nada que no
 * sea un video con nombre limpio.
 */
let fallos = 0;
const comprobar = (c, m, d) => { if (!c) fallos++; console.log((c ? '  ✓ ' : '  ✗ FALLA ') + m + (d ? ' — ' + d : '')); };

async function main() {
  const mod = await import('../netlify/functions/media.mjs');
  const bytes = new Uint8Array(1000).map((_, i) => i % 256);
  const d = { 'bloque-prueba-v1.mp4': bytes.buffer };
  mod._interno.usar({ async get(k) { return d[k] ? d[k].slice(0) : null; } });
  const pedir = (f, h = {}, metodo = 'GET') => mod.default(new Request('https://tienda.test/.netlify/functions/media?f=' + encodeURIComponent(f),
    { method: metodo, headers: h }));

  console.log('1 · Archivo entero');
  let r = await pedir('bloque-prueba-v1.mp4');
  let b = new Uint8Array(await r.arrayBuffer());
  comprobar(r.status === 200 && b.length === 1000 && r.headers.get('content-type') === 'video/mp4', `200 con los 1000 bytes (${r.status}, ${b.length})`);
  comprobar(r.headers.get('accept-ranges') === 'bytes', 'anuncia Accept-Ranges: bytes');
  comprobar(/immutable/.test(r.headers.get('cache-control')) && /durable/.test(r.headers.get('netlify-cdn-cache-control')) && r.headers.get('vary') === 'Range',
    'caché de un año en navegador y CDN, separada por Range');

  // Así llega de verdad en Netlify: la regla /media/* reescribe, pero la
  // función v2 recibe la URL original, sin el ?f= (vista previa, 2026-09-26).
  r = await mod.default(new Request('https://tienda.test/media/bloque-prueba-v1.mp4'));
  comprobar(r.status === 200 && (await r.arrayBuffer()).byteLength === 1000, 'por la ruta /media/<archivo>, sin ?f= → 200');
  r = await mod.default(new Request('https://tienda.test/media/..%2FESTADO.md'));
  comprobar(r.status === 404, 'por la ruta, un nombre raro → 404');

  console.log('2 · Rangos (Safari)');
  r = await pedir('bloque-prueba-v1.mp4', { Range: 'bytes=0-1' });
  b = new Uint8Array(await r.arrayBuffer());
  comprobar(r.status === 206 && r.headers.get('content-range') === 'bytes 0-1/1000' && b.length === 2 && b[1] === 1, 'bytes=0-1 → 206 con 2 bytes (la sonda de Safari)');
  r = await pedir('bloque-prueba-v1.mp4', { Range: 'bytes=990-' });
  b = new Uint8Array(await r.arrayBuffer());
  comprobar(r.status === 206 && r.headers.get('content-range') === 'bytes 990-999/1000' && b.length === 10 && b[0] === 990 % 256, 'bytes=990- → hasta el final');
  r = await pedir('bloque-prueba-v1.mp4', { Range: 'bytes=-5' });
  comprobar(r.status === 206 && r.headers.get('content-range') === 'bytes 995-999/1000', 'bytes=-5 → los últimos 5');
  r = await pedir('bloque-prueba-v1.mp4', { Range: 'bytes=500-5000' });
  comprobar(r.status === 206 && r.headers.get('content-range') === 'bytes 500-999/1000', 'un final mayor al archivo se recorta');
  r = await pedir('bloque-prueba-v1.mp4', { Range: 'bytes=2000-' });
  comprobar(r.status === 416 && r.headers.get('content-range') === 'bytes */1000', 'un inicio fuera del archivo → 416');
  r = await pedir('bloque-prueba-v1.mp4', {}, 'HEAD');
  comprobar(r.status === 200 && r.headers.get('content-length') === '1000' && (await r.arrayBuffer()).byteLength === 0, 'HEAD da el tamaño sin cuerpo');

  console.log('3 · Solo videos con nombre limpio');
  for (const f of ['no-existe-v1.mp4', '../ESTADO.md', 'bloque-prueba-v1.mp4/../x', 'Mayus.mp4', 'algo.html', '']) {
    r = await pedir(f);
    comprobar(r.status === 404, `«${f}» → 404 (${r.status})`);
  }
  r = await pedir('bloque-prueba-v1.mp4', {}, 'POST');
  comprobar(r.status === 405, 'POST → 405');
  mod._interno.usar({ async get() { throw new Error('blobs caído'); } });
  const err = console.error; console.error = () => {};
  r = await pedir('bloque-prueba-v1.mp4');
  console.error = err;
  comprobar(r.status === 503, 'si Blobs falla, 503 (no un 500 mudo)');

  console.log(fallos ? `\n${fallos} comprobaciones en rojo.` : '\nTodo en verde.');
  process.exit(fallos ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
