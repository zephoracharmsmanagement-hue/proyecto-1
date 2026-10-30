/* Renderiza las historias de historias.mjs a JPG de 1080×1920 con Remotion.
 *
 *   npm run render                 todas
 *   npm run render -- 2026-11-15   solo las de ese día
 *
 * Antes de renderizar comprueba lo que no puede salir mal en una historia:
 * que cada pieza exista en el catálogo, que tenga 3 unidades o más (o que la
 * entrada diga `pocas: true`), y que los totales salgan de calcular(), la
 * misma función que cobra el checkout. Si algo falla, no renderiza nada. */
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import historias from './historias.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '../../..');
const require = createRequire(import.meta.url);
const precios = require(path.join(raiz, 'netlify/functions/_precios.js'));
const catalogo = JSON.parse(fs.readFileSync(path.join(raiz, 'assets/catalogo.json'), 'utf8'));
const stock = JSON.parse(fs.readFileSync(path.join(raiz, 'assets/stock.json'), 'utf8')).items;

const unidades = (id) => {
  const it = stock[id];
  if (!it) return 0;
  return it.tallas ? Object.values(it.tallas).reduce((a, b) => a + b, 0) : it.stock || 0;
};

const calc = (base, talla, charms) => {
  const pedido = (pago) => ({base: {id: base, talla}, charms, pago});
  return {anticipado: precios.calcular(pedido('anticipado')), contraentrega: precios.calcular(pedido('contraentrega'))};
};

const errores = [];
const fotos = new Set();

const pieza = (id, h, gratis = false) => {
  const nombre = catalogo.nombres[id];
  const precio = catalogo.precios[id];
  if (!nombre || !precio) errores.push(`${h.id}: «${id}» no está en el catálogo`);
  const u = unidades(id);
  if (u < 3 && !h.pocas) errores.push(`${h.id}: «${id}» tiene ${u} unidades (mínimo 3)`);
  if (u === 0) errores.push(`${h.id}: «${id}» está agotada`);
  const archivo = `hd/${id}.webp`;
  if (!fs.existsSync(path.join(raiz, 'assets', archivo))) errores.push(`${h.id}: falta assets/${archivo}`);
  fotos.add(archivo);
  return {id, nombre: nombre.replace(/^Pulsera /, ''), precio, img: archivo.replace('/', '__'), gratis};
};

const DIAS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
const MOMENTOS = {1: 'manana', 2: 'mediodia', 3: 'tarde', 4: 'noche'};
const vistos = {};

const lista = historias(calc).map((h) => {
  const fecha = new Date(h.dia + 'T12:00:00');
  let id = `${h.dia.slice(8)}-${DIAS[fecha.getDay()]}-${h.momento}-${MOMENTOS[h.momento]}`;
  vistos[id] = (vistos[id] || 0) + 1;
  if (vistos[id] > 1) id += `-${vistos[id]}`;
  const props = {...h, id};
  delete props.set;
  if (h.piezas) props.piezas = h.piezas.map((x) => pieza(x, props));
  if (h.set) {
    const r = calc(h.set.base, h.set.talla, h.set.charms);
    const gratis = [...r.anticipado.gratis];
    const ids = [h.set.base, ...h.set.charms];
    props.piezas = ids.map((x) => {
      const i = gratis.indexOf(x);
      if (i >= 0) gratis.splice(i, 1);
      return pieza(x, props, i >= 0);
    });
    props.totales = {lista: r.anticipado.brutoCharms + r.anticipado.brutoBrazalete, pagas: r.anticipado.total, contraentrega: r.contraentrega.total};
  }
  if (h.foto) {
    if (!fs.existsSync(path.join(raiz, 'assets', h.foto)) && !fs.existsSync(path.join(raiz, 'assets/ads', h.foto))) errores.push(`${id}: falta la foto ${h.foto}`);
    fotos.add(fs.existsSync(path.join(raiz, 'assets', h.foto)) ? h.foto : `ads/${h.foto}`);
  }
  return props;
});

if (errores.length) {
  console.error('No se renderiza nada:\n- ' + errores.join('\n- '));
  process.exit(1);
}

/* Las fotos se copian a public/img (fuera de git): el sitio es la fuente. */
const destino = path.join(aqui, 'public/img');
fs.mkdirSync(destino, {recursive: true});
for (const f of fotos) {
  fs.copyFileSync(path.join(raiz, 'assets', f), path.join(destino, f.includes('hd/') ? f.replace('/', '__') : path.basename(f)));
}

const filtro = process.argv[2];
const aRenderizar = filtro ? lista.filter((h) => h.id.startsWith(filtro.slice(8)) || h.id.startsWith(filtro)) : lista;

const browserExecutable = process.env.REMOTION_CHROME || (fs.existsSync('/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell')
  ? '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'
  : null);

const serveUrl = await bundle({entryPoint: path.join(aqui, 'src/index.ts'), publicDir: path.join(aqui, 'public')});
const salida = path.join(aqui, 'out');
fs.mkdirSync(salida, {recursive: true});
fs.writeFileSync(path.join(salida, 'historias.json'), JSON.stringify(lista, null, 2));

for (const h of aRenderizar) {
  const composition = await selectComposition({serveUrl, id: 'Historia', inputProps: h, browserExecutable});
  await renderStill({composition, serveUrl, output: path.join(salida, `${h.id}.jpg`), inputProps: h, imageFormat: 'jpeg', jpegQuality: 92, browserExecutable});
  console.log('✓', h.id);
}
console.log(`${aRenderizar.length} historias en ${salida}`);
