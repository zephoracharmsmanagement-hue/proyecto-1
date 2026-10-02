// Reseñas de la tienda, desde la terminal (Netlify Blobs, almacén «resenas»
// de producción).
//
//   node herramientas/resenas.mjs                 lista todas: id, estado, estrellas, nombre, texto
//   node herramientas/resenas.mjs ocultar <id>    la quita de la página (estado «rechazada»)
//   node herramientas/resenas.mjs publicar <id>   la vuelve a mostrar (estado «aprobada»)
//
// Ocultar no borra: la reseña y sus fotos se quedan guardadas y se puede
// volver a publicar. Es lo mismo que hace el enlace «Rechazar» del correo de
// moderación (netlify/functions/resenas.mjs), para cuando ese correo ya no
// está a mano. La página deja de mostrarla en ~1 minuto (caché).
//
// Credenciales: el token del CLI de Netlify, como subir_media.mjs. No se imprime.
import { getStore } from '@netlify/blobs';
import fs from 'node:fs';
import path from 'node:path';

const SITIO = process.env.NETLIFY_SITE_ID || '81e2d142-0edc-4392-bd3b-9edc20e850ea';
const token = process.env.NETLIFY_AUTH_TOKEN || (() => {
  const f = path.join(process.env.APPDATA || '', 'netlify', 'Config', 'config.json');
  return Object.values(JSON.parse(fs.readFileSync(f, 'utf8')).users || {})[0].auth.token;
})();
/* OJO (2026-10-02): resenas.mjs elige «resenas» solo si process.env.CONTEXT
   es 'production', y en la función, en ejecución, no lo es: la tienda real
   está guardando en «resenas-pruebas» (igual pedidos, inventario y
   suscriptores). Mientras eso no se corrija, esta herramienta trabaja donde
   está la página de verdad. RESENAS_STORE la cambia. */
const ALMACEN = process.env.RESENAS_STORE || 'resenas-pruebas';
const s = getStore({ name: ALMACEN, siteID: SITIO, token });

const [accion, id] = process.argv.slice(2);
if (!accion) {
  const { blobs } = await s.list();
  const todas = (await Promise.all(blobs.map(async b => ({ id: b.key, ...(await s.get(b.key, { type: 'json' })) }))))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  for (const r of todas) {
    const adj = [(r.fotos || []).length ? (r.fotos.length + ' foto' + (r.fotos.length > 1 ? 's' : '')) : '', r.video ? 'video' : ''].filter(Boolean).join(' + ');
    console.log(`${r.id}  ${String(r.estado).padEnd(10)} ${'★'.repeat(r.estrellas || 0).padEnd(5)}  ${(r.fecha || '').slice(0, 10)}  ${r.nombre || ''}${r.ciudad ? ' · ' + r.ciudad : ''}`
      + `${adj ? '  [' + adj + ']' : ''}\n    «${String(r.texto || '').replace(/\s+/g, ' ').slice(0, 90)}»`);
  }
  console.log(`\n${todas.length} reseñas · ${todas.filter(r => r.estado === 'aprobada').length} publicadas`);
} else if (accion === 'ocultar' || accion === 'publicar') {
  if (!id) { console.error('Falta el id (sale en la lista).'); process.exit(1); }
  const r = await s.get(id, { type: 'json' });
  if (!r) { console.error(`No existe la reseña ${id}.`); process.exit(1); }
  r.estado = accion === 'ocultar' ? 'rechazada' : 'aprobada';
  r.moderada = new Date().toISOString();
  await s.setJSON(id, r);
  console.log(`${accion === 'ocultar' ? 'Oculta' : 'Publicada'}: ${r.nombre || ''} — «${String(r.texto || '').slice(0, 60)}»`);
} else {
  console.error('Uso: node herramientas/resenas.mjs [ocultar|publicar <id>]'); process.exit(1);
}
