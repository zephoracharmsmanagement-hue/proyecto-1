// Sube un video comprimido al almacén «media» de Netlify Blobs, de donde lo
// sirve netlify/functions/media.mjs en /media/<nombre>. Los videos no se
// comitean (CLAUDE.md); esto reemplaza el commit.
//
//   node herramientas/subir_media.mjs ruta/bloque-regalo-v1.mp4 [más archivos]
//
// El nombre del archivo es la clave y lleva versión (-v1, -v2…): se cachea un
// año, así que cambiar un video es subir OTRO nombre y cambiar la referencia.
// Nunca se pisa una clave que ya existe.
//
// Credenciales: el token del CLI de Netlify (%APPDATA%\netlify\Config\
// config.json, o NETLIFY_AUTH_TOKEN). No se imprime. El id del sitio es el de
// .netlify/state.json o NETLIFY_SITE_ID.
//
// Receta de compresión (ffmpeg aislado, ver ESTADO.md § videos): recortar las
// franjas negras (cropdetect), 720 px, sin audio, -crf 28, +faststart, ≤ 3 MB.
import { getStore } from '@netlify/blobs';
import fs from 'node:fs';
import path from 'node:path';

const SITIO = process.env.NETLIFY_SITE_ID || '81e2d142-0edc-4392-bd3b-9edc20e850ea';
const token = process.env.NETLIFY_AUTH_TOKEN || (() => {
  const f = path.join(process.env.APPDATA || '', 'netlify', 'Config', 'config.json');
  const c = JSON.parse(fs.readFileSync(f, 'utf8'));
  return Object.values(c.users || {})[0].auth.token;
})();

const archivos = process.argv.slice(2);
if (!archivos.length) { console.error('Uso: node herramientas/subir_media.mjs <video.mp4> [...]'); process.exit(1); }

const store = getStore({ name: 'media', siteID: SITIO, token });
for (const a of archivos) {
  const clave = path.basename(a);
  if (!/^[a-z0-9][a-z0-9-]{0,80}\.(mp4|webm)$/.test(clave)) { console.error(`✗ ${clave}: nombre no válido (minúsculas, guiones, .mp4/.webm)`); process.exitCode = 1; continue; }
  const peso = fs.statSync(a).size;
  if (peso > 3.5 * 1024 * 1024) { console.error(`✗ ${clave}: ${(peso / 1048576).toFixed(1)} MB, más de lo que admite la ficha (~3 MB)`); process.exitCode = 1; continue; }
  if (await store.getMetadata(clave)) { console.log(`= ${clave}: ya estaba, no se pisa`); continue; }
  const b = fs.readFileSync(a);
  await store.set(clave, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  console.log(`✓ ${clave} (${(peso / 1048576).toFixed(2)} MB) → /media/${clave}`);
}
