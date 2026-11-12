'use strict';
/* Feed del catálogo de Meta (netlify/functions/catalogo-meta.mjs).
 *
 * Tres cosas que, si fallan, no dan ningún error visible:
 *   1. Que los ID del feed sean los mismos que manda el píxel. Si no empatan,
 *      Meta acepta el catálogo, acepta los eventos y los anuncios dinámicos
 *      enseñan piezas al azar.
 *   2. Que un brazalete no salga agotado por leer `stock` donde hay `tallas`.
 *   3. Que sin inventario en vivo no se publique un feed con el conteo crudo.
 */
const path = require('path');
const fs = require('fs');
const RAIZ = path.join(__dirname, '..');

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

function almacenFalso(estado) {
  return {
    async get() { return estado ? JSON.parse(JSON.stringify(estado)) : null; },
    async getWithMetadata() { return estado ? { data: estado, etag: 'e1' } : null; },
    async setJSON() { return { modified: true }; },
    async delete() {},
  };
}

/* CSV mínimo: comillas dobles y comas dentro de comillas. */
function leerCSV(txt) {
  const filas = []; let f = [], c = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) { if (ch === '"' && txt[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { f.push(c); c = ''; }
    else if (ch === '\n') { f.push(c); filas.push(f); f = []; c = ''; }
    else c += ch;
  }
  const [cab, ...resto] = filas;
  return resto.map(r => Object.fromEntries(cab.map((k, i) => [k, r[i]])));
}

async function main() {
  const inv = await import('../netlify/functions/_inventario.mjs');
  const mod = await import('../netlify/functions/catalogo-meta.mjs');
  const P = require(path.join(RAIZ, 'netlify', 'functions', '_precios.js'));
  const CAT = require(path.join(RAIZ, 'assets', 'catalogo.json'));
  const items = P.inventario.items;
  const pedir = async () => {
    const r = await mod.default(new Request('https://zephoracharms.com/feeds/meta-catalogo.csv'));
    return { r, txt: await r.text() };
  };

  console.log('\n1 · Sin almacén, 503 y no un feed con el conteo crudo');
  inv._interno.usarAlmacen(null);
  {
    const { r } = await pedir();
    comprobar(r.status === 503, 'responde 503', String(r.status));
  }

  console.log('\n2 · Con almacén: una fila por id de catalogo.json, mismos ID');
  inv._interno.usarAlmacen(almacenFalso({ v: 1, vendido: {}, reservas: {} }));
  const { r, txt } = await pedir();
  comprobar(r.status === 200 && /text\/csv/.test(r.headers.get('content-type')), 'CSV 200');
  const feed = leerCSV(txt);
  const ids = new Set(feed.map(f => f.id));
  const esperados = Object.keys(CAT.precios);
  comprobar(feed.length === esperados.length && esperados.every(i => ids.has(i)),
    'cada id de catalogo.json está en el feed, y nada más', `${feed.length}/${esperados.length}`);
  comprobar(ids.size === feed.length, 'sin ID repetidos');

  console.log('\n3 · Los content_ids que manda el píxel existen en el feed');
  /* Lo que manda tienda.js: [id] para charm y brazalete; para un anillo, la
     lista de ids por talla (ANI[modelo].tallas). Se reconstruye igual. */
  const ani = {};
  Object.keys(CAT.precios).forEach(id => { const m = id.match(/^(anillo-.*)-t\d+$/); if (m) (ani[m[1]] = ani[m[1]] || []).push(id); });
  const paginas = fs.readdirSync(RAIZ).filter(f => /^producto-.*\.html$/.test(f));
  let sinEmpate = [];
  paginas.forEach(f => {
    const m = fs.readFileSync(path.join(RAIZ, f), 'utf8').match(/<body[^>]*data-producto="([^"]+)"/);
    if (!m) return;
    const enviados = ani[m[1]] || [m[1]];
    if (!enviados.every(i => ids.has(i))) sinEmpate.push(m[1]);
  });
  comprobar(sinEmpate.length === 0, `las ${paginas.length} páginas de producto mandan ID que están en el feed`,
    sinEmpate.slice(0, 5).join(', '));
  const anilloFila = feed.find(f => f.id.startsWith('anillo-'));
  comprobar(anilloFila && anilloFila.item_group_id && !/-t\d+$/.test(anilloFila.item_group_id)
    && anilloFila.link.endsWith(`producto-${anilloFila.item_group_id}.html`),
    'un anillo va como variante de su modelo y enlaza a la página del modelo', anilloFila && anilloFila.item_group_id);

  console.log('\n4 · Precio: el de calcular(), nunca escrito a mano');
  const malos = feed.filter(f => {
    const it = items[f.id];
    const p = it.tallas
      ? P.calcular({ base: { id: f.id, talla: null }, charms: [], pago: 'anticipado' }).subtotal
      : P.calcular({ base: null, charms: [f.id], pago: 'anticipado' }).subtotal;
    return f.price !== `${p} COP` || p !== CAT.precios[f.id];
  });
  comprobar(malos.length === 0, 'cada precio coincide con calcular() y con catalogo.json', malos.slice(0, 3).map(f => f.id).join(', '));

  console.log('\n5 · Brazaletes: se suman tallas, no se lee `stock`');
  const pulsera = Object.keys(items).find(k => items[k].tallas && Object.values(items[k].tallas).some(v => v > 0));
  comprobar(feed.find(f => f.id === pulsera).availability === 'in stock',
    `${pulsera} con unidades por talla sale en existencia`);
  {
    /* Todas sus tallas vendidas → agotado. */
    const vendido = {}; Object.entries(items[pulsera].tallas).forEach(([t, n]) => { vendido[`${pulsera}|${t}`] = n; });
    inv._interno.usarAlmacen(almacenFalso({ v: 1, vendido, reservas: {} }));
    const f2 = leerCSV((await pedir()).txt).find(f => f.id === pulsera);
    comprobar(f2.availability === 'out of stock', 'con todas las tallas vendidas sale agotado');
  }

  console.log('\n6 · Charm: lo apartado por un pago en curso cuenta');
  const charm = Object.keys(items).find(k => !items[k].tallas && items[k].stock === 1);
  if (charm) {
    inv._interno.usarAlmacen(almacenFalso({ v: 1, vendido: {},
      reservas: { 'ZC-PRUEBA': { items: { [charm]: 1 }, vence: Date.now() + 600000 } } }));
    const f3 = leerCSV((await pedir()).txt).find(f => f.id === charm);
    comprobar(f3.availability === 'out of stock', `${charm} (1 unidad, apartada) sale agotado`);
  } else ok('no hay charm con 1 unidad para probar el apartado; se salta');

  console.log('\n7 · Campos que Meta exige, y nada de marcas ajenas en el título');
  const req = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand'];
  const incompletos = feed.filter(f => req.some(k => !f[k]));
  comprobar(incompletos.length === 0, 'ninguna fila con campos obligatorios vacíos', incompletos.slice(0, 3).map(f => f.id).join(', '));
  comprobar(!feed.some(f => /pandora/i.test(f.title + f.description)), 'ningún título ni descripción nombra a Pandora');
  comprobar(feed.every(f => /^https:\/\/zephoracharms\.com\/\.netlify\/images\?url=%2Fassets%2Fhd%2F.+&fm=jpg/.test(f.image_link)),
    'imagen pública en JPEG desde assets/hd');
  const letraN = feed.find(f => f.id === 'letra-ñ');
  comprobar(!letraN || letraN.link.endsWith('producto-letra-%C3%B1.html'), 'la ñ va codificada en el enlace');

  console.log(fallos ? `\n${fallos} falla(s)` : '\nTodo bien');
  process.exit(fallos ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
