/**
 * Responder un archivo binario respetando `Range` (lo usan media.mjs, para los
 * videos de los bloques, y resenas.mjs, para las fotos y videos de reseñas).
 *
 * Safari en iPhone no reproduce un <video> si el servidor no contesta
 * `Range: bytes=…` con 206 y el trozo exacto: con un 200 entero lo deja en
 * negro. Aquí: 200 sin Range, 206 con Range válido (incluye `bytes=-N`), 416
 * si el inicio cae fuera, y HEAD sin cuerpo.
 */
export function responderBytes(req, datos, tipo, cabeceras = {}) {
  const total = datos.byteLength;
  const cab = { 'Content-Type': tipo, 'Accept-Ranges': 'bytes', ...cabeceras };
  const sinCuerpo = req.method === 'HEAD';
  const rango = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') || '');
  if (!rango || (rango[1] === '' && rango[2] === '')) {
    return new Response(sinCuerpo ? null : datos, { status: 200, headers: { ...cab, 'Content-Length': String(total) } });
  }
  let ini, fin;
  if (rango[1] === '') { ini = Math.max(0, total - Number(rango[2])); fin = total - 1; }
  else { ini = Number(rango[1]); fin = rango[2] === '' ? total - 1 : Math.min(Number(rango[2]), total - 1); }
  if (!(ini <= fin) || ini >= total) {
    return new Response('', { status: 416, headers: { ...cab, 'Content-Range': `bytes */${total}` } });
  }
  const trozo = datos.slice(ini, fin + 1);
  return new Response(sinCuerpo ? null : trozo, {
    status: 206,
    headers: { ...cab, 'Content-Range': `bytes ${ini}-${fin}/${total}`, 'Content-Length': String(trozo.byteLength) },
  });
}
