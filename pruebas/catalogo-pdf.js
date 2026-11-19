'use strict';
/* El catálogo en PDF que el bot de WhatsApp les manda a las clientas, contra
 * la tienda.
 *
 * ── Por qué existe ──
 *
 * Hasta el 2026-11-19 el PDF era un diseño de Canva congelado el 27-sep: sin
 * anillos, sin las piezas de noviembre, y esta prueba seguía en verde porque
 * solo contrastaba los precios de las piezas que el PDF SÍ traía. Lo vio el
 * propietario en una prueba con el bot. Desde entonces el PDF lo genera
 * `herramientas/catalogo-pdf.mjs` en cada build de Netlify, y esta prueba
 * corre el mismo generador y mira lo que importa:
 *
 *   · que no falte NINGUNA pieza de la tienda (el hueco que dejó pasar el de
 *     Canva), ni sobre ninguna que la tienda ya no vende;
 *   · que cada precio sea el de assets/catalogo.json, con el que se cobra;
 *   · que la promo sea el texto de la portada, palabra por palabra;
 *   · que pese poco, porque se abre con los datos del celular;
 *   · que el build de Netlify de verdad lo genere: si alguien vacía el
 *     comando, el bot volvería a mandar un PDF viejo o un 404.
 *
 * ── Qué NO mira ──
 *
 * Existencias. Cambian a diario; el bot las confirma con `disponibilidad`, y
 * el PDF lo dice en cada página.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const RAIZ = path.join(__dirname, '..');

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

const CAT = require(path.join(RAIZ, 'assets', 'catalogo.json'));
const HTML = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const plano = s => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
  .replace(/\s+/g, ' ').trim();

console.log('\n1 · Se genera desde la tienda, sin pasos a mano');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalogo-pdf-'));
const t0 = Date.now();
const r = spawnSync(process.execPath, [path.join(RAIZ, 'herramientas', 'catalogo-pdf.mjs'), '--salida', dir], { encoding: 'utf8' });
comprobar(r.status === 0, 'el generador termina bien', (r.stdout || r.stderr || '').trim().split('\n').pop());
const PDF = path.join(dir, 'catalogo-zephora-charms.pdf');
const JSONF = path.join(dir, 'catalogo-zephora-charms.json');
if (r.status !== 0 || !fs.existsSync(PDF) || !fs.existsSync(JSONF)) {
  console.log('\nCatálogo PDF: no se generó');
  process.exit(1);
}
const seg = (Date.now() - t0) / 1000;
comprobar(seg < 60, 'en menos de un minuto: no alarga el build de Netlify', `${seg.toFixed(1)} s`);

const pdf = fs.readFileSync(PDF);
const hoja = JSON.parse(fs.readFileSync(JSONF, 'utf8'));
comprobar(pdf.slice(0, 5).toString() === '%PDF-', 'es un PDF');
const paginas = (pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
comprobar(paginas === hoja.paginas && paginas >= 2, 'su lista de páginas coincide con el PDF', `${paginas} páginas`);
/* Se abre desde WhatsApp con los datos del celular. */
const mb = pdf.length / 1e6;
comprobar(mb < 5, 'pesa menos de 5 MB', `${mb.toFixed(2)} MB`);

console.log('\n2 · No falta ninguna pieza ni sobra ninguna');

const tienda = Object.keys(CAT.precios);
const enPdf = Object.keys(hoja.precios);
const faltan = tienda.filter(id => !(id in hoja.precios));
const sobran = enPdf.filter(id => !(id in CAT.precios));
comprobar(faltan.length === 0, `las ${tienda.length} piezas de catalogo.json están en el PDF`,
  faltan.length ? faltan.slice(0, 8).join(', ') : `${enPdf.length} piezas · ${hoja.tarjetas} tarjetas`);
comprobar(sobran.length === 0, 'y ninguna que la tienda ya no vende', sobran.join(', ') || undefined);
comprobar(hoja.piezas === tienda.length, 'el resumen cuenta las mismas piezas', `${hoja.piezas}`);

/* Toda tarjeta que ve la clienta en la portada está en el PDF. */
const tarjetasPortada = [...new Set([...HTML.matchAll(/<article class="pc[^"]*" data-id="([^"]+)"/g)].map(m => m[1]))];
const enSecciones = new Set(hoja.secciones.flatMap(s => s.ids));
const sinTarjeta = tarjetasPortada.filter(id => !enSecciones.has(id));
comprobar(sinTarjeta.length === 0, `las ${tarjetasPortada.length} tarjetas de la portada salen en el PDF`, sinTarjeta.join(', ') || undefined);

const titulos = hoja.secciones.map(s => s.titulo);
comprobar(titulos[0] === 'Brazaletes' && titulos[titulos.length - 1] === 'Anillos'
  && ['Disney', 'Marvel', 'Símbolos', 'Letras'].every(t => titulos.includes(t)),
  'en el recorrido de la tienda: brazaletes, charms por categoría, anillos', titulos.join(' · '));

console.log('\n3 · Lo que dice el PDF contra lo que la tienda cobra');

const distintas = Object.entries(hoja.precios)
  .filter(([id, p]) => id in CAT.precios && CAT.precios[id] !== p)
  .map(([id, p]) => `${CAT.nombres[id]}: PDF $${p.toLocaleString('es-CO')} · tienda $${CAT.precios[id].toLocaleString('es-CO')}`);
comprobar(distintas.length === 0, 'ningún precio del PDF contradice catalogo.json',
  distintas.length ? distintas.slice(0, 5).join(' | ') : undefined);

const textoPortada = plano(HTML);
comprobar(hoja.promo && hoja.promo.titulo && textoPortada.includes(hoja.promo.titulo),
  'el título de la promo es el de la portada, no uno inventado', hoja.promo && hoja.promo.titulo);
comprobar(hoja.promo && hoja.promo.texto && textoPortada.includes(hoja.promo.texto),
  'y su explicación también');

/* «Próximamente»: lo que marque la tienda, ni más ni menos. */
const tjs = fs.readFileSync(path.join(RAIZ, 'tienda.js'), 'utf8');
const pm = tjs.match(/const PRONTO\s*=\s*new Set\(\[([^\]]*)\]\)/);
const pronto = pm ? [...pm[1].matchAll(/'([^']+)'/g)].map(x => x[1]).filter(id => enSecciones.has(id)) : [];
comprobar(JSON.stringify([...hoja.proximamente].sort()) === JSON.stringify(pronto.sort()),
  'las piezas «Próximamente» son las que marca la tienda', pronto.length ? pronto.join(', ') : 'hoy ninguna');

console.log('\n4 · Se regenera solo en cada despliegue');

const toml = fs.readFileSync(path.join(RAIZ, 'netlify.toml'), 'utf8');
const cmd = (toml.match(/^\s*command\s*=\s*"([^"]*)"/m) || [])[1] || '';
comprobar(/node herramientas\/catalogo-pdf\.mjs/.test(cmd), 'el build de Netlify corre el generador', cmd || '(vacío)');
comprobar(!/--salida/.test(cmd), 'y escribe en assets/, la ruta que manda el bot');
const gi = fs.readFileSync(path.join(RAIZ, '.gitignore'), 'utf8');
comprobar(/assets\/catalogo-zephora-charms\.pdf/.test(gi) && /assets\/catalogo-zephora-charms\.json/.test(gi),
  'el PDF no va en git: una copia guardada a mano es justo la que se queda vieja');
const pkg = require(path.join(RAIZ, 'package.json'));
comprobar(pkg.dependencies && pkg.dependencies.pdfkit && pkg.dependencies.sharp,
  'pdfkit y sharp están en las dependencias que instala Netlify');
const fuentes = ['CormorantGaramond-Medium.ttf', 'CormorantGaramond-SemiBold.ttf', 'CormorantGaramond-MediumItalic.ttf',
  'Jost-Regular.ttf', 'Jost-Medium.ttf', 'OFL-CormorantGaramond.txt', 'OFL-Jost.txt'];
const sinFuente = fuentes.filter(f => !fs.existsSync(path.join(RAIZ, 'herramientas', 'fuentes', f)));
comprobar(sinFuente.length === 0, 'las tipografías del sitio van en el repo, con su licencia', sinFuente.join(', ') || undefined);

fs.rmSync(dir, { recursive: true, force: true });
console.log(fallos
  ? `\nCatálogo PDF: ${fallos} en rojo`
  : `\nCatálogo PDF en verde ✓  (${paginas} páginas · ${hoja.tarjetas} tarjetas · ${hoja.piezas} piezas · ${mb.toFixed(2)} MB)`);
if (fallos) process.exitCode = 1;
