/* Catálogo comercial en PDF, para mandarle a una clienta que lo pide por chat.
 *
 *     node herramientas/catalogo-pdf/generar.mjs
 *     → Catalogo-Zephora-Charms.pdf en la raíz
 *
 * ── De dónde sale cada número ──
 *
 * De `catalogo.json` y `stock.json`, que son los mismos que usa el checkout
 * para cobrar. Ni un precio escrito a mano: la regla de CLAUDE.md —«un número
 * de precio en cualquier documento de este repo tiene que poder reproducirse
 * con calcular(); si no, no se escribe»— vale más aquí que en ningún otro
 * sitio, porque esto viaja por WhatsApp y queda en el teléfono de la clienta.
 * Un catálogo con un precio viejo es una discusión en la venta siguiente.
 *
 * Los ejemplos de la escalera de descuentos no están tabulados: se calculan
 * llamando a `calcular()`, el mismo que firma el cobro.
 *
 * ── Qué se muestra y qué no ──
 *
 * Solo lo que tiene unidades. Ofrecer una pieza agotada en un PDF es peor que
 * en la web: la web bloquea el botón, el PDF no puede, y la clienta escribe
 * pidiendo justo eso. Las tallas de cada brazalete salen una por una del
 * inventario por la misma razón.
 *
 * `stock.json` guarda las unidades en dos formas —charm `stock`, pulsera
 * `tallas`—, así que un `item.stock || 0` daría cero para las 18 pulseras sin
 * dar ningún error. Esa trampa ya está cazada en el repo y aquí se evita
 * mirando `tipo`.
 *
 * ── Por qué HTML y no una librería de PDF ──
 *
 * Porque el catálogo lleva 125 fotos y tiene que verse como la tienda. Se
 * maqueta en HTML con las tipografías de la marca y Chromium lo imprime. Las
 * fuentes van en `fuentes/` —Cormorant Garamond y Jost, las dos con licencia
 * OFL— para que esto corra sin red: si dependiera de Google Fonts, el día que
 * no haya conexión el PDF saldría con otra tipografía y nadie se daría cuenta
 * hasta verlo impreso.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');

const CAT = require(path.join(RAIZ, 'assets', 'catalogo.json'));
const INV = require(path.join(RAIZ, 'assets', 'stock.json'));
const { leerPedido, calcular, cop } = require(
  path.join(RAIZ, 'netlify', 'functions', '_precios.js'));

const { precios, nombres, pulseras, grupos, fotos, reglas } = CAT;
const ESP = new Set(pulseras);
const items = INV.items;

/* ── Qué hay de verdad ───────────────────────────────────────────────────── */

const unidades = id => {
  const it = items[id];
  if (!it) return 0;
  if (it.tipo === 'pulsera') {
    return Object.values(it.tallas || {}).reduce((s, n) => s + (+n || 0), 0);
  }
  return +it.stock || 0;
};
const tallasLibres = id =>
  Object.entries((items[id] || {}).tallas || {})
    .filter(([, n]) => +n > 0).map(([t]) => t).sort();

const hay = id => unidades(id) > 0;

const brazaletes = pulseras.filter(hay)
  .sort((a, b) => precios[a] - precios[b] || nombres[a].localeCompare(nombres[b], 'es'));

const esLetra = id => id.startsWith('letra-');
const charms = Object.keys(precios)
  .filter(id => !ESP.has(id) && !esLetra(id) && hay(id));
const letras = Object.keys(precios).filter(id => esLetra(id) && hay(id))
  .sort((a, b) => a.localeCompare(b, 'es'));

/* El orden de las categorías no es alfabético: va de lo que más se busca a lo
   que menos, que es como se hojea un catálogo. Lo que no esté aquí cae al
   final por su nombre, así que una categoría nueva aparece igual. */
const ORDEN = ['Disney', 'Marvel', 'Pixar', 'Zodiaco', 'Símbolos', 'Muranos',
               'Profesiones', 'Clips', 'Cadenas'];
const porCategoria = new Map();
for (const id of charms) {
  const g = grupos[id] || 'Otros';
  if (!porCategoria.has(g)) porCategoria.set(g, []);
  porCategoria.get(g).push(id);
}
const categorias = [...porCategoria.entries()]
  .sort((a, b) => {
    const ia = ORDEN.indexOf(a[0]), ib = ORDEN.indexOf(b[0]);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a[0].localeCompare(b[0], 'es');
  })
  .map(([g, ids]) => [g, ids.sort((a, b) =>
    precios[b] - precios[a] || nombres[a].localeCompare(nombres[b], 'es'))]);

/* ── La escalera de descuentos, calculada y no escrita ───────────────────── */

/* Se arma sobre un brazalete y un charm que existan hoy, no sobre ids fijos:
   si la pieza de ejemplo se agota, el ejemplo seguiría saliendo pero con un
   precio que nadie puede comprar. */
const brzEjemplo = brazaletes[0];
const charmEjemplo = charms.slice().sort((a, b) => precios[b] - precios[a])[0];

const escalones = [1, 2, 3, 4].map(n => {
  const pedido = leerPedido({
    base: { id: brzEjemplo, talla: tallasLibres(brzEjemplo)[0] },
    charms: Array(n).fill(charmEjemplo),
    pago: 'anticipado',
  });
  const t = calcular(pedido);
  return {
    n,
    pct: Math.round(reglas.escalaCharms[Math.min(n, reglas.escalaCharms.length - 1)] * 100),
    bruto: t.brutoCharms + t.brutoBrazalete,
    ahorro: t.descuento,
    total: t.total,
    conBrazalete: n >= reglas.minCharmsParaDescuento,
  };
});

/* ── Utilidades de maqueta ───────────────────────────────────────────────── */

const esc = s => String(s).replace(/[&<>"]/g,
  m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

const b64 = ruta => readFileSync(ruta).toString('base64');

/* Las fotos van incrustadas en base64 y no como rutas de archivo: así el HTML
   intermedio se puede abrir desde cualquier sitio y, sobre todo, no hay forma
   de que el PDF salga con un hueco porque Chromium no alcanzó a leer un
   archivo del disco.
 *
 * Y van recomprimidas antes de incrustarlas. Al primer intento el PDF salió en
 * 16 MB —justo el tope de WhatsApp, que es por donde se manda esto— porque
 * Chromium reincrusta cada webp sin tocarlo. Cada tarjeta se imprime a unos
 * 45 mm, así que 360 px de lado dan ~200 ppp: de sobra en papel y en pantalla,
 * y una fracción del peso. Ampliar no se hace nunca: si la original es más
 * chica, se deja como está. */
const CACHE = mkdtempSync(path.join(tmpdir(), 'zephora-catalogo-'));
let recomprimidas = 0, ahorro = 0;

const jpeg = (archivo, ancho) => {
  const origen = path.join(RAIZ, 'assets', archivo);
  if (!existsSync(origen)) return null;
  const destino = path.join(CACHE, archivo.replace(/[\/\\]/g, '_') + `.${ancho}.jpg`);
  if (!existsSync(destino)) {
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', origen,
      '-vf', `scale='min(${ancho},iw)':-2:flags=lanczos`,
      '-q:v', '4', destino]);
    recomprimidas++;
    ahorro += readFileSync(origen).length - readFileSync(destino).length;
  }
  return `data:image/jpeg;base64,${b64(destino)}`;
};

/* Los logotipos de pago NO pasan por aquí: necesitan el fondo transparente, y
   un JPEG no tiene alfa. Se incrustan tal cual, que además pesan 5 KB. */
const imagen = archivo => {
  const ruta = path.join(RAIZ, 'assets', archivo);
  if (!existsSync(ruta)) return null;
  const ext = path.extname(archivo).slice(1).toLowerCase();
  return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${b64(ruta)}`;
};

const fotoDe = id => {
  const archivo = fotos[id];
  return archivo ? jpeg(archivo, 360) : null;
};

const fuentes = readdirSync(path.join(AQUI, 'fuentes'))
  .filter(f => f.endsWith('.woff2'))
  .map(f => {
    const [fam, peso, estilo] = f.replace('.woff2', '').split('-').reduce((a, p, i, arr) => {
      // cormorant-garamond-300-normal-latin / jost-400-normal-latin-ext
      return a;
    }, []) || [];
    const m = f.match(/^(.+?)-(\d+)-(normal|italic)-(latin(?:-ext)?)\.woff2$/);
    const familia = m[1] === 'jost' ? 'Jost' : 'Cormorant Garamond';
    return `@font-face{font-family:'${familia}';font-style:${m[3]};font-weight:${m[2]};`
      + `src:url(data:font/woff2;base64,${b64(path.join(AQUI, 'fuentes', f))}) format('woff2')}`;
  }).join('\n');

/* ── Piezas de la maqueta ────────────────────────────────────────────────── */

const tarjeta = (id, extra = '') => {
  const foto = fotoDe(id);
  const nombre = nombres[id].replace(/^Pulsera /, '');
  return `<figure class="p">
    <div class="p-f">${foto
      ? `<img src="${foto}" alt="">`
      : `<span class="p-ini">${esc(nombre.trim()[0])}</span>`}</div>
    <figcaption>
      <span class="p-n">${esc(nombre)}</span>
      <span class="p-p">${cop(precios[id])}</span>
      ${extra}
    </figcaption>
  </figure>`;
};

const paginaCharms = (titulo, ids, subtitulo = '') => {
  const POR_PAGINA = 20;
  const trozos = [];
  for (let i = 0; i < ids.length; i += POR_PAGINA) trozos.push(ids.slice(i, i + POR_PAGINA));
  return trozos.map((trozo, i) => `<section class="hoja">
    <header class="h-cab">
      <span class="h-eyebrow">Charms · Plata Esterlina 925</span>
      <h2>${esc(titulo)}${trozos.length > 1 ? ` <span class="h-de">${i + 1} de ${trozos.length}</span>` : ''}</h2>
      ${i === 0 && subtitulo ? `<p class="h-sub">${subtitulo}</p>` : ''}
    </header>
    <div class="rej rej-4">${trozo.map(id => tarjeta(id)).join('')}</div>
    ${pie()}
  </section>`).join('');
};

/* La portada es la 1 y no lleva pie, así que el contador arranca en 2. El
   total se calcula antes de maquetar: sin él, el pie diría «3» sin decir de
   cuántas, que en un PDF que se hojea en el teléfono no orienta. */
const TOTAL = 1                                   // portada
  + 1                                             // promoción
  + 1                                             // brazaletes
  + categorias.reduce((s, [, ids]) => s + Math.ceil(ids.length / 20), 0)
  + 1 + 1 + 1 + 1;                                // iniciales, tallas, envíos, cierre
/* La página de tallas se referencia desde los pasos de compra. Se calcula en
   vez de escribirse: al añadir una categoría de charms se corre una página y
   la referencia apuntaría a otra cosa, sin que nada falle. */
const PAG_TALLAS = 3
  + categorias.reduce((s, [, ids]) => s + Math.ceil(ids.length / 20), 0)
  + 1 + 1;
let numero = 1;
const pie = () => {
  numero++;
  return `<footer class="h-pie">
    <span>Zephora Charms · zephoracharms.com</span>
    <span class="h-num">${numero} / ${TOTAL}</span>
    <span>WhatsApp 301 899 0672</span>
  </footer>`;
};

/* ── El documento ────────────────────────────────────────────────────────── */

const hoy = new Date().toLocaleDateString('es-CO',
  { day: 'numeric', month: 'long', year: 'numeric' });
const mesAnio = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

const portada = jpeg('hero-marca-ancho.webp', 1400);   // a sangre, ocupa media página
const logos = ['nequi', 'daviplata', 'bancolombia', 'pse', 'visa', 'mastercard', 'addi']
  .map(n => [n, imagen(path.join('pagos', `${n}.webp`))])
  .filter(([, d]) => d);

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Catálogo Zephora Charms</title>
<style>
${fuentes}

:root{
  --bone:#F6F3F4; --ink:#2A1F2E; --plum:#5C3D63; --rose:#B4657F;
  --silver:#A9A6AE; --line:#E4DDE0; --white:#fff; --bien:#1a6650;
}
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font:300 10pt/1.5 Jost,sans-serif;color:var(--ink);background:var(--white)}

/* Cada .hoja es exactamente una página A4. El alto fijo más el salto hace que
   Chromium no reparta una rejilla entre dos páginas: sin esto, una fila de
   charms se parte por la mitad y la foto queda cortada. */
.hoja{width:210mm;height:297mm;padding:16mm 15mm 12mm;display:flex;
  flex-direction:column;page-break-after:always;break-after:page;position:relative;
  background:var(--white)}
.hoja:last-child{page-break-after:auto;break-after:auto}

h1,h2,h3{font-family:'Cormorant Garamond',Georgia,serif;font-weight:300;
  letter-spacing:.01em;line-height:1.1}
.h-eyebrow{display:block;font-size:7.5pt;letter-spacing:.22em;text-transform:uppercase;
  color:var(--silver);margin-bottom:5px}
.h-cab{border-bottom:1px solid var(--line);padding-bottom:9px;margin-bottom:11px}
.h-cab h2{font-size:26pt}
.h-de{font-size:11pt;color:var(--silver);letter-spacing:.06em}
.h-sub{font-size:9pt;color:#6d6070;margin-top:6px;max-width:150mm}
.h-pie{margin-top:auto;padding-top:8px;border-top:1px solid var(--line);
  display:flex;justify-content:space-between;align-items:baseline;font-size:7.5pt;
  letter-spacing:.08em;text-transform:uppercase;color:var(--silver)}
.h-num{letter-spacing:.1em;color:var(--plum)}

/* ── portada ── */
.cub{width:210mm;height:297mm;page-break-after:always;break-after:page;
  display:flex;flex-direction:column;background:var(--bone)}
.cub-f{height:172mm;overflow:hidden;position:relative}
.cub-f img{width:100%;height:100%;object-fit:cover;display:block}
.cub-tx{flex:1;padding:18mm 18mm 14mm;display:flex;flex-direction:column}
.cub-marca{font-family:'Cormorant Garamond',Georgia,serif;font-size:40pt;
  line-height:1;letter-spacing:.02em}
.cub-marca i{font-style:italic;color:var(--plum)}
.cub-linea{width:52px;height:1px;background:var(--rose);margin:14px 0 13px}
.cub-sub{font-size:10.5pt;line-height:1.65;color:#4a3d4e;max-width:120mm}
.cub-meta{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;
  font-size:8pt;letter-spacing:.16em;text-transform:uppercase;color:var(--silver)}
.cub-meta b{font-weight:400;color:var(--plum)}

/* ── rejillas de piezas ── */
.rej{display:grid;gap:5mm}
.rej-4{grid-template-columns:repeat(4,1fr)}
.rej-3{grid-template-columns:repeat(3,1fr)}
.p{display:flex;flex-direction:column;break-inside:avoid}
.p-f{aspect-ratio:1;background:var(--bone);border:1px solid var(--line);
  border-radius:2px;overflow:hidden;display:grid;place-items:center}
.p-f img{width:100%;height:100%;object-fit:cover;display:block}
.p-ini{font-family:'Cormorant Garamond',Georgia,serif;font-size:22pt;color:var(--silver)}
.p figcaption{padding-top:5px;display:flex;flex-direction:column;gap:1px}
.p-n{font-size:8.5pt;line-height:1.3;color:var(--ink)}
.p-p{font-size:9pt;color:var(--plum);letter-spacing:.02em}
.p-t{font-size:7pt;letter-spacing:.08em;text-transform:uppercase;color:var(--silver)}

/* ── escalera de descuentos ── */
.esc{display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;margin:7mm 0}
.esc-c{border:1px solid var(--line);border-radius:2px;padding:7mm 4mm;text-align:center;
  display:flex;flex-direction:column;gap:3px}
.esc-c.destaca{border-color:var(--rose);background:#FCF7F9}
.esc-n{font-family:'Cormorant Garamond',Georgia,serif;font-size:15pt;color:var(--ink)}
.esc-pct{font-size:20pt;font-weight:400;color:var(--rose);line-height:1.1}
.esc-pct small{font-size:9pt;letter-spacing:.1em}
.esc-d{font-size:7.5pt;color:#6d6070;line-height:1.4;margin-top:3px}
.esc-nota{font-size:7pt;color:var(--silver);margin-top:auto;padding-top:5px}

.cuenta{border:1px solid var(--line);border-radius:2px;overflow:hidden;margin-top:2mm}
.cuenta table{width:100%;border-collapse:collapse;font-size:9pt}
.cuenta th{background:var(--bone);font-weight:400;font-size:7.5pt;letter-spacing:.12em;
  text-transform:uppercase;color:var(--silver);padding:7px 10px;text-align:left}
.cuenta td{padding:7px 10px;border-top:1px solid var(--line)}
.cuenta td:not(:first-child){text-align:right;white-space:nowrap}
.cuenta .ahorro{color:var(--rose)}
.cuenta .total{color:var(--plum)}
.cuenta tr.fuerte td{background:#FCF7F9}

/* ── bloques de texto ── */
.dos{display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin-top:6mm}
.bloque h3{font-size:15pt;margin-bottom:5px}
.bloque p{font-size:9pt;line-height:1.6;color:#4a3d4e;margin-bottom:7px}
.lista{list-style:none;font-size:9pt;line-height:1.6;color:#4a3d4e}
.lista li{padding-left:14px;position:relative;margin-bottom:5px}
.lista li::before{content:'';position:absolute;left:0;top:8px;width:5px;height:5px;
  border-radius:50%;background:var(--rose)}

.tabla{width:100%;border-collapse:collapse;font-size:9pt;margin-top:4mm}
.tabla th{text-align:left;font-weight:400;font-size:7.5pt;letter-spacing:.12em;
  text-transform:uppercase;color:var(--silver);padding:7px 0;border-bottom:1px solid var(--line)}
.tabla td{padding:7px 0;border-bottom:1px solid var(--line);color:#4a3d4e}
.tabla td:last-child{text-align:right;white-space:nowrap}
.tabla b{font-weight:400;color:var(--plum)}

.pagos{display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;margin-top:4mm}
.pago{border:1px solid var(--line);border-radius:2px;padding:5mm 3mm;text-align:center;
  display:flex;flex-direction:column;align-items:center;gap:5px;justify-content:center}
.pago img{max-width:26mm;max-height:9mm;width:auto;height:auto;object-fit:contain}
.pago span{font-size:7pt;letter-spacing:.08em;text-transform:uppercase;color:var(--silver)}

.pasos{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm;margin-top:auto;
  padding-top:9mm;border-top:1px solid var(--line)}
.paso{display:flex;flex-direction:column;gap:3px}
.paso-n{font-family:'Cormorant Garamond',Georgia,serif;font-size:22pt;color:var(--rose);
  line-height:1}
.paso b{font-weight:400;font-size:10pt;color:var(--ink)}
.paso p{font-size:8.5pt;line-height:1.5;color:#6d6070}

.aviso{border-left:2px solid var(--rose);padding:3mm 0 3mm 5mm;margin-top:5mm;
  font-size:9pt;line-height:1.6;color:#4a3d4e}
.aviso b{font-weight:400;color:var(--plum)}

/* ── iniciales ── */
.letras{display:grid;grid-template-columns:repeat(5,1fr);gap:6mm;margin-top:8mm}
.letra{aspect-ratio:1;border:1px solid var(--line);border-radius:2px;display:grid;
  place-items:center;font-family:'Cormorant Garamond',Georgia,serif;font-size:34pt;
  color:var(--ink);background:var(--bone)}

/* ── cierre ── */
.cierre{align-items:center;justify-content:center;text-align:center}
.cierre h2{font-size:30pt;margin-bottom:4mm}
.cierre .cub-linea{margin:0 auto 6mm}
.cierre p{font-size:10.5pt;line-height:1.7;color:#4a3d4e;max-width:120mm;margin-bottom:8mm}
.contacto{display:grid;gap:3mm;font-size:11pt;color:var(--plum)}
.contacto b{font-weight:400;letter-spacing:.04em}
.contacto span{display:block;font-size:7.5pt;letter-spacing:.16em;text-transform:uppercase;
  color:var(--silver);margin-bottom:2px}
</style></head><body>

<!-- 1 · PORTADA -->
<section class="cub">
  <div class="cub-f">${portada ? `<img src="${portada}" alt="">` : ''}</div>
  <div class="cub-tx">
    <div class="cub-marca">Zephora <i>Charms</i></div>
    <div class="cub-linea"></div>
    <p class="cub-sub">Charms en Plata Esterlina 925 verificada y brazaletes con
      baño de plata certificado. Compatibles con pulseras de sistema modular,
      incluidas las de Pandora.</p>
    <div class="cub-meta">
      <span>Catálogo · <b>${esc(mesAnio)}</b></span>
      <span>Envíos a toda Colombia</span>
    </div>
  </div>
</section>

<!-- 2 · LA PROMOCIÓN -->
<section class="hoja">
  <header class="h-cab">
    <span class="h-eyebrow">Se aplica solo · sin códigos</span>
    <h2>Cuantos más charms, <i style="font-style:italic;color:var(--plum)">más ahorras</i></h2>
    <p class="h-sub">Dos descuentos que se suman y se calculan solos al armar tu
      pulsera. No hay letra pequeña ni mínimo de compra.</p>
  </header>

  <div class="esc">
    ${escalones.map(e => `<div class="esc-c${e.n >= 4 ? ' destaca' : ''}">
      <span class="esc-n">${e.n} charm${e.n > 1 ? 's' : ''}</span>
      <span class="esc-pct">${e.pct ? `${e.pct}%<small> OFF</small>` : '<small style="font-size:9pt;letter-spacing:.06em">Precio normal</small>'}</span>
      <span class="esc-d">${e.n === 1 ? 'Sin mínimo de compra'
        : e.n === 2 ? 'El descuento baja los dos, no solo el segundo'
        : e.n === 3 ? 'Aquí se activa el −30% del brazalete'
        : 'Llevas 4 y pagas 3'}</span>
    </div>`).join('')}
  </div>

  <div class="cuenta">
    <table>
      <thead><tr>
        <th>La cuenta, con ${esc(nombres[brzEjemplo].replace(/^Pulsera /, 'brazalete '))} y charms de ${cop(precios[charmEjemplo])}</th>
        <th>Precio sin promo</th><th>Ahorras</th><th>Pagas</th>
      </tr></thead>
      <tbody>
        ${escalones.map(e => `<tr${e.n >= 4 ? ' class="fuerte"' : ''}>
          <td>Brazalete + ${e.n} charm${e.n > 1 ? 's' : ''}${e.conBrazalete ? ' <span style="color:var(--rose)">· brazalete −30%</span>' : ''}</td>
          <td>${cop(e.bruto)}</td>
          <td class="ahorro">${e.ahorro > 0 ? '− ' + cop(e.ahorro) : '—'}</td>
          <td class="total">${cop(e.total)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="aviso">
    <b>El tercer charm es el que más rinde.</b> Al llegar a tres se activan los
    dos descuentos a la vez —el ${escalones[2].pct}% sobre los charms y el 30%
    del brazalete—, así que el tercero sale por
    ${cop(escalones[2].total - escalones[1].total)} en vez de
    ${cop(precios[charmEjemplo])}: menos de la mitad.
  </div>

  <div class="dos">
    <div class="bloque">
      <h3>Qué recibes</h3>
      <ul class="lista">
        <li><b>Charms en Plata Esterlina 925</b> verificada, con el sello grabado.</li>
        <li><b>Brazaletes</b> con base de latón de calidad joyería, baño de plata
          certificado y capa protectora e-coating.</li>
        <li><b>Libres de níquel y plomo</b>, aptos para pieles sensibles.</li>
        <li><b>Empaque de regalo incluido</b> en todos los pedidos, sin costo,
          con tarjeta para tu dedicatoria escrita a mano.</li>
      </ul>
    </div>
    <div class="bloque">
      <h3>Garantía</h3>
      <p>La garantía legal de la Ley 1480 de 2011, más <b>30 días por defectos
        de fábrica</b>. Tienes 5 días hábiles desde la entrega para retractarte
        o cambiar la talla, con la pieza sin uso y en su empaque original.</p>
      <p>No cubre desgaste por uso, golpes, pérdida de piezas ni deterioro por
        contacto con perfumes, cloro o productos químicos.</p>
    </div>
  </div>

  <div class="pasos">
    <div class="paso"><span class="paso-n">1</span>
      <b>Elige tu brazalete</b>
      <p>Mide tu muñeca y súmale 2 cm. La talla está en la página ${PAG_TALLAS}.</p></div>
    <div class="paso"><span class="paso-n">2</span>
      <b>Suma tus charms</b>
      <p>Desde 3 se activan los dos descuentos. El precio se calcula solo.</p></div>
    <div class="paso"><span class="paso-n">3</span>
      <b>Págala como prefieras</b>
      <p>En línea con envío gratis, o contraentrega al recibir.</p></div>
  </div>
  ${pie()}
</section>

<!-- 3 · BRAZALETES -->
<section class="hoja">
  <header class="h-cab">
    <span class="h-eyebrow">La base de tu pulsera</span>
    <h2>Brazaletes</h2>
    <p class="h-sub">Baño de plata certificado con e-coating. Con 3 charms o más,
      el brazalete baja un 30%. Se muestran solo las tallas disponibles hoy.</p>
  </header>
  <div class="rej rej-4">
    ${brazaletes.map(id => tarjeta(id,
      `<span class="p-t">Tallas ${tallasLibres(id).join(' · ')} cm</span>`)).join('')}
  </div>
  ${pie()}
</section>

<!-- 4 · CHARMS -->
${categorias.map(([g, ids]) => paginaCharms(g, ids,
  g === 'Zodiaco' ? 'Los doce signos, en plata 925.'
  : g === 'Muranos' ? 'Cristal de Murano soplado, cada pieza con su propia veta.'
  : g === 'Clips' ? 'Separadores que fijan los charms en su sitio.'
  : g === 'Cadenas' ? 'Cadena de seguridad: sujeta las piezas y protege la pulsera si el broche se abre.'
  : '')).join('')}

<!-- 5 · INICIALES -->
<section class="hoja">
  <header class="h-cab">
    <span class="h-eyebrow">Charms · Plata Esterlina 925</span>
    <h2>Iniciales</h2>
    <p class="h-sub">La letra de quien quieras, en pavé de circonias.
      ${cop(precios[letras[0]])} cada una. Disponibles hoy:</p>
  </header>
  <div class="letras">
    ${letras.map(id => `<div class="letra">${esc(id.replace('letra-', '').toUpperCase())}</div>`).join('')}
  </div>
  <div class="aviso">
    <b>¿No está la tuya?</b> Escríbenos por WhatsApp y la conseguimos por encargo.
  </div>
  ${pie()}
</section>

<!-- 6 · TALLAS -->
<section class="hoja">
  <header class="h-cab">
    <span class="h-eyebrow">Para que cierre cómoda</span>
    <h2>¿Qué talla es la mía?</h2>
  </header>
  <div class="dos">
    <div class="bloque">
      <h3>Cómo medir</h3>
      <ul class="lista">
        <li>Mide tu muñeca <b>ajustada</b>, con un metro de costura o una tira de papel.</li>
        <li><b>Súmale 2 cm.</b> Esa es tu talla.</li>
        <li>Si te queda entre dos tallas, pide la mayor.</li>
      </ul>
      <p style="margin-top:10px">Los 2 cm no son espacio sobrante: cuando la
        pulsera se llena de charms, el grosor de las piezas se come el diámetro
        interior útil de la cadena. Son justo el espacio que van a ocupar tus
        charms para que cierre cómoda en tu muñeca real.</p>
    </div>
    <div class="bloque">
      <h3>Cuántos charms caben</h3>
      <table class="tabla">
        <thead><tr><th>Margen que dejaste</th><th>Charms variados</th></tr></thead>
        <tbody>
          <tr><td>Los 2 cm recomendados</td><td><b>15 a 20</b></td></tr>
          <tr><td>Solo 1 cm</td><td>5 a 8</td></tr>
        </tbody>
      </table>
      <table class="tabla" style="margin-top:7mm">
        <thead><tr><th>Tipo de pieza</th><th>Ocupa</th></tr></thead>
        <tbody>
          <tr><td>Pasador o charm fijo</td><td>8 – 10 mm</td></tr>
          <tr><td>Dije colgante</td><td>4 – 6 mm en el aro</td></tr>
          <tr><td>Murano de cristal</td><td>9 – 11 mm</td></tr>
          <tr><td>Clip separador</td><td>4 – 6 mm</td></tr>
          <tr><td>Cadena de seguridad</td><td>4 – 5 mm por aro</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <div class="aviso">
    <b>En zephoracharms.com hay una calculadora:</b> escribes tu medida y te dice
    qué talla pedir y cuántos charms te caben en cada una.
  </div>
  ${pie()}
</section>

<!-- 7 · ENVÍOS Y PAGOS -->
<section class="hoja">
  <header class="h-cab">
    <span class="h-eyebrow">Sin sorpresas al final</span>
    <h2>Envíos y formas de pago</h2>
  </header>

  <div class="dos">
    <div class="bloque">
      <h3>Envíos</h3>
      <table class="tabla">
        <tbody>
          <tr><td>Pago anticipado</td><td><b>Envío GRATIS</b></td></tr>
          <tr><td>Pago contraentrega</td><td><b>${cop(reglas.envio.contraentrega)}</b></td></tr>
        </tbody>
      </table>
      <p style="margin-top:9px"><b>Sin monto mínimo.</b> Con pago anticipado el
        envío va gratis a cualquier ciudad del país. La contraentrega cuesta
        ${cop(reglas.envio.contraentrega)} porque la transportadora cobra por
        recaudar el dinero en la entrega.</p>
      <table class="tabla" style="margin-top:5mm">
        <thead><tr><th>Destino</th><th>Llega en</th></tr></thead>
        <tbody>
          <tr><td>Bogotá y municipios cercanos</td><td>1 – 2 días hábiles</td></tr>
          <tr><td>Ciudades principales</td><td>2 – 4 días hábiles</td></tr>
          <tr><td>Resto del país</td><td>3 – 6 días hábiles</td></tr>
        </tbody>
      </table>
      <p style="margin-top:9px">Enviamos por Inter Rapidísimo con número de guía.
        Al despachar te lo mandamos por WhatsApp o correo.</p>
    </div>

    <div class="bloque">
      <h3>Formas de pago</h3>
      <div class="pagos">
        ${logos.filter(([n]) => n !== 'addi').map(([n, d]) =>
          `<div class="pago"><img src="${d}" alt="${n}"></div>`).join('')}
        <div class="pago"><span>Hasta<br>36 cuotas</span></div>
        <div class="pago"><span>Contra-<br>entrega</span></div>
      </div>
      <p style="margin-top:10px">Pagas en línea con la pasarela segura de Wompi
        (Bancolombia). Zephora Charms no ve ni guarda los datos de tu tarjeta.</p>
      ${logos.find(([n]) => n === 'addi') ? `<p style="margin-top:8px">
        ¿Prefieres <img src="${logos.find(([n]) => n === 'addi')[1]}" alt="Addi"
          style="height:12px;width:auto;vertical-align:-2px">? También lo
        trabajamos a cuotas; ese se coordina por WhatsApp y no desde el botón
        de pago.</p>` : ''}
      <p style="margin-top:8px">No emitimos factura electrónica; con tu pedido va
        el comprobante digital de compra.</p>
    </div>
  </div>

  <div class="dos" style="margin-top:9mm">
    <div class="bloque">
      <h3>Cómo cuidar tus piezas</h3>
      <ul class="lista">
        <li>Quítatela para bañarte, nadar o hacer ejercicio.</li>
        <li>Ponte el perfume y la crema <b>antes</b> de ponértela.</li>
        <li>Guárdala en su bolsa cuando no la uses, en un lugar seco.</li>
        <li>Para limpiarla, un paño suave y seco.</li>
      </ul>
    </div>
    <div class="bloque">
      <h3>La plata se oxida, y está bien</h3>
      <p>La Plata 925 de los charms <b>sí se oxida</b> con el tiempo al contacto
        con el aire. Es la naturaleza de la plata, no un defecto —de hecho es
        una de las señales de que es plata de verdad— y el brillo se recupera
        con un paño de joyería.</p>
      <p>El baño de los brazaletes no se oxida solo, gracias al e-coating, pero
        puede perder brillo con humedad, perfumes o sudor.</p>
    </div>
  </div>
  ${pie()}
</section>

<!-- 8 · CIERRE -->
<section class="hoja cierre">
  <h2>No vendemos joyas.<br><i style="font-style:italic;color:var(--plum)">Guardamos momentos.</i></h2>
  <div class="cub-linea"></div>
  <p>El charm del viaje que te cambió. El del signo de tu mamá. El de la carrera
    que te costó tanto. La patica del perro que te espera en casa. Ninguna
    pulsera Zephora es igual a otra, porque ninguna historia lo es.</p>
  <div class="contacto">
    <div><span>Arma la tuya</span><b>zephoracharms.com</b></div>
    <div><span>Pedidos y asesoría</span><b>WhatsApp 301 899 0672</b></div>
    <div><span>Instagram</span><b>@zephora_charms</b></div>
  </div>
  <p style="margin-top:12mm;font-size:7.5pt;color:var(--silver);letter-spacing:.04em">
    Precios en pesos colombianos, vigentes a ${esc(hoy)} y sujetos a
    disponibilidad. Zephora Charms es una marca independiente y no está afiliada
    a Pandora A/S.</p>
</section>

</body></html>`;

/* ── A PDF ───────────────────────────────────────────────────────────────── */

const destinoHtml = path.join(AQUI, 'catalogo.html');
writeFileSync(destinoHtml, html, 'utf8');

const { chromium } = require(path.join(RAIZ, 'pruebas', 'node_modules', 'playwright'));
const destinoPdf = path.join(RAIZ, 'Catalogo-Zephora-Charms.pdf');

const navegador = await chromium.launch();
const pagina = await navegador.newPage();
await pagina.goto('file://' + destinoHtml, { waitUntil: 'networkidle' });
/* Las fuentes van incrustadas, pero se espera igual: si Chromium imprimiera
   antes de tenerlas listas, el PDF saldría con la tipografía de reserva y la
   diferencia solo se ve abriéndolo. */
await pagina.evaluate(() => document.fonts.ready);
await pagina.pdf({
  path: destinoPdf, format: 'A4', printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
});
await navegador.close();

const piezas = brazaletes.length + charms.length + letras.length;
console.log(`${path.basename(destinoPdf)} · ${piezas} piezas disponibles`);
console.log(`  ${brazaletes.length} brazaletes · ${charms.length} charms en `
  + `${categorias.length} categorías · ${letras.length} iniciales`);
console.log(`  agotadas y por tanto fuera del catálogo: `
  + `${Object.keys(precios).length - piezas}`);
console.log(`  inventario del ${INV.conteo_inventario}`);
const pesoPdf = readFileSync(destinoPdf).length;
console.log(`  ${recomprimidas} fotos recomprimidas · PDF de `
  + `${(pesoPdf / 1048576).toFixed(1)} MB`);
if (pesoPdf > 15 * 1048576) {
  console.error('  ⚠ Por encima de 15 MB: WhatsApp no lo deja pasar. '
    + 'Bajar el ancho de `fotoDe` o subir el `-q:v` de `jpeg()`.');
}
