// Carga un lote de reseñas reales (las que el propietario junta fuera de la
// web: Excel + fotos numeradas) al mismo almacén que lee la página, ya
// aprobadas. Así salen en el carrusel de la portada, colecciones y fichas sin
// tocar el HTML, y se ocultan una por una con herramientas/resenas.mjs.
//
//   node herramientas/importar-resenas.mjs <carpeta-lote>             simulacro: dice qué haría
//   node herramientas/importar-resenas.mjs <carpeta-lote> --escribir  lo escribe
//   node herramientas/importar-resenas.mjs <carpeta-lote> --ocultar   oculta todo el lote (no borra)
//
// <carpeta-lote>/lote.json = { resenas: [{ id: 'tienda/imp041-ab12cd', excelId,
//   estrellas, texto, nombre, ciudad, fecha, fotos: [{ clave: '<id>/f1.jpg',
//   archivo: 'fotos/x.jpg' }] }] }. El lote lleva nombres de clientas: vive
// fuera de git (lo arma un script local a partir del Excel), nunca en el repo.
//
// Reglas:
// - Ids fijos por reseña del Excel: correrlo dos veces no duplica nada.
// - Si una reseña ya existe y alguien la ocultó, sigue oculta: el lote no
//   pisa la moderación.
// - Primero las fotos y después la reseña: una reseña aprobada nunca apunta
//   a una foto que todavía no subió.
// - Sin «Compra verificada»: eso lo da solo un pedido de la web
//   (netlify/functions/resenas.mjs). Hasta 3 fotos por reseña (f1–f3), que es
//   lo que sirve la función.
// - Almacén: el mismo que herramientas/resenas.mjs (ver el OJO de allá).
import { getStore } from '@netlify/blobs';
import fs from 'node:fs';
import path from 'node:path';

const [carpeta, modo] = process.argv.slice(2);
if (!carpeta || !fs.existsSync(path.join(carpeta, 'lote.json'))) {
  console.error('Uso: node herramientas/importar-resenas.mjs <carpeta-lote> [--escribir|--ocultar]'); process.exit(1);
}
const escribir = modo === '--escribir', ocultar = modo === '--ocultar';
const SITIO = process.env.NETLIFY_SITE_ID || '81e2d142-0edc-4392-bd3b-9edc20e850ea';
const token = process.env.NETLIFY_AUTH_TOKEN || (() => {
  const f = path.join(process.env.APPDATA || '', 'netlify', 'Config', 'config.json');
  return Object.values(JSON.parse(fs.readFileSync(f, 'utf8')).users || {})[0].auth.token;
})();
const ALMACEN = process.env.RESENAS_STORE || 'resenas-pruebas';
const MEDIOS = process.env.RESENAS_MEDIA_STORE || (ALMACEN === 'resenas' ? 'resenas-media' : 'resenas-media-pruebas');
const s = getStore({ name: ALMACEN, siteID: SITIO, token });
const m = getStore({ name: MEDIOS, siteID: SITIO, token });

const { resenas } = JSON.parse(fs.readFileSync(path.join(carpeta, 'lote.json'), 'utf8'));
const CLAVE = /^tienda\/[a-z0-9]+-[a-f0-9]{6}$/, FOTO = /\/f[123]\.jpg$/;
for (const r of resenas) {
  if (!CLAVE.test(r.id) || !(r.estrellas >= 1 && r.estrellas <= 5) || !r.nombre || !r.fecha
    || (r.fotos || []).length > 3 || r.fotos.some(f => !f.clave.startsWith(r.id + '/') || !FOTO.test(f.clave))) {
    console.error('Reseña mal formada en el lote:', r.id || r); process.exit(1);
  }
}
console.log(`${ALMACEN} + ${MEDIOS} · ${resenas.length} reseñas · ${resenas.reduce((n, r) => n + r.fotos.length, 0)} fotos`
  + (escribir ? '' : ocultar ? ' · OCULTANDO' : ' · simulacro (añade --escribir)'));

const ahora = new Date().toISOString();
let nuevas = 0, iguales = 0, ocultas = 0;
for (const r of resenas) {
  const antes = await s.get(r.id, { type: 'json' });
  if (ocultar) {
    if (antes && antes.estado === 'aprobada') { antes.estado = 'rechazada'; antes.moderada = ahora; await s.setJSON(r.id, antes); ocultas++; }
    continue;
  }
  if (antes) { iguales++; continue; }
  nuevas++;
  if (!escribir) continue;
  for (const f of r.fotos) {
    const b = fs.readFileSync(path.join(carpeta, f.archivo));
    await m.set(f.clave, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  }
  await s.setJSON(r.id, {
    id: r.id, producto: 'tienda', estrellas: r.estrellas, texto: r.texto || '', nombre: r.nombre, ciudad: r.ciudad || '',
    verificada: false, referencia: null, fotos: r.fotos.map(f => f.clave), video: null,
    estado: 'aprobada', fecha: r.fecha, moderada: ahora, origen: 'lote-excel', excelId: r.excelId,
  });
  if (nuevas % 20 === 0) console.log(`  … ${nuevas}`);
}
console.log(ocultar ? `Ocultadas: ${ocultas}.`
  : `${escribir ? 'Escritas' : 'Se escribirían'}: ${nuevas} · ya estaban (no se tocan): ${iguales}.`);
