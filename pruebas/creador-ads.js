'use strict';
/* Creador de ads (herramientas/creativos/creador_ads.py).
 *
 * La herramienta compone imágenes, pero lo que aquí se prueba no es que queden
 * bonitas: es que **se niegue a componer** cuando el anuncio diría algo que la
 * tienda no cumple. Cada caso de abajo es un error que ya pasó o que estuvo a
 * punto de pasar en esta cuenta —un precio escrito de memoria, una pieza con una
 * sola unidad, «envío gratis» sin decir que es pagando en línea, la marca que no
 * se nombra—, y un anuncio con cualquiera de ellos sale a gastar plata.
 *
 * Corre con --solo-validar y con las existencias de un archivo: ni Pillow, ni
 * tipografías, ni red. Los totales se comparan contra calcular(), no contra un
 * número escrito aquí: si cambian los precios o la promo, la prueba sigue valiendo.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const GUION = path.join(RAIZ, 'herramientas', 'creativos', 'creador_ads.py');
const { calcular, cop } = require(path.join(RAIZ, 'netlify', 'functions', '_precios.js'));
const CAT = require(path.join(RAIZ, 'assets', 'catalogo.json'));
const RECORTES = require(path.join(RAIZ, 'herramientas', 'creativos', 'recortes.json'));

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'creador-ads-'));

/* Piezas de la prueba: las primeras del catálogo que tengan foto y no estén
   vetadas. No se nombran a mano para que la prueba no dependa del surtido. */
const vetadas = new Set(Object.keys(RECORTES.no_usar));
const conFoto = id => CAT.fotos[id] && fs.existsSync(path.join(RAIZ, 'assets', 'hd', CAT.fotos[id])) && !vetadas.has(id);
const esPulsera = new Set(CAT.pulseras);
const BASE = CAT.pulseras.filter(conFoto)[0];
const CHARMS = Object.keys(CAT.precios).filter(id => !esPulsera.has(id) && conFoto(id));
const [C1, C2, C3, ESCASO] = CHARMS;

/* Existencias con la forma de /.netlify/functions/disponibilidad: 5 de todo,
   menos una pieza con 2 para probar el piso de 3. */
function existencias(fuente = 'conteo-menos-apartado') {
  const p = path.join(tmp, `existencias-${fuente}.json`);
  fs.writeFileSync(p, JSON.stringify({
    generado: '2026-01-01T00:00:00.000Z',
    fuente,
    piezas: Object.keys(CAT.precios).filter(id => !esPulsera.has(id))
      .map(id => ({ id, grupo: CAT.grupos[id] || null, disponible: id === ESCASO ? 2 : 5 })),
    brazaletes: CAT.pulseras.map(id => ({ id, tallas: { 18: 2, 19: 3 } })),
  }));
  return p;
}

let n = 0;
function receta(cambios = {}) {
  const r = {
    angulo: 'Prueba', nombre: 'Caso de prueba', hipotesis: 'baja el costo por checkout en 7 días',
    base: BASE, charms: [C1, C2, C3],
    imagen: { titulo: 'Arma la tuya' },
    texto: { principal: 'Los 4 por {total} en vez de {lista}.', titular: 'Arma la tuya' },
    destino: 'index.html',
    ...cambios,
  };
  const p = path.join(tmp, `receta-${++n}.json`);
  fs.writeFileSync(p, JSON.stringify(r));
  return p;
}
function correr(rec, ex = existencias()) {
  const r = spawnSync('python3', [GUION, rec, '--solo-validar', '--existencias', ex], { encoding: 'utf8' });
  return { codigo: r.status, salida: (r.stdout || '') + (r.stderr || '') };
}
/* Un caso que debe rechazarse: sale con error y dice por qué. */
function rechaza(titulo, cambios, patron) {
  const r = correr(receta(cambios));
  comprobar(r.codigo !== 0 && patron.test(r.salida), titulo, r.codigo === 0 ? 'la dejó pasar' : (patron.test(r.salida) ? '' : r.salida.trim().slice(0, 200)));
}

function main() {
  if (spawnSync('python3', ['--version']).status !== 0) {
    console.log('  (sin python3: se omite)');
    return;
  }

  const real = calcular({ base: { id: BASE, talla: null }, charms: [C1, C2, C3], pago: 'anticipado' });
  const lista = real.brutoCharms + real.brutoBrazalete;

  // ── lo que debe pasar ──
  const bien = correr(receta());
  comprobar(bien.codigo === 0, 'una receta sana se valida', bien.codigo === 0 ? '' : bien.salida.trim().slice(0, 300));
  comprobar(bien.salida.includes(`${cop(lista)} → ${cop(real.total)}`),
    'y el total que informa es el de calcular()', `${cop(lista)} → ${cop(real.total)}`);
  comprobar(real.gratis.every(id => bien.salida.includes(id)), 'y dice qué pieza sale gratis', real.gratis.join(', '));

  const literal = correr(receta({ texto: { principal: `Los 4 por ${cop(real.total)} en vez de ${cop(lista)}.`, titular: 'Arma la tuya' } }));
  comprobar(literal.codigo === 0, 'una cifra escrita a mano pasa si es exactamente la de calcular()');

  // ── lo que debe rechazar ──
  rechaza('rechaza un precio que calcular() no da', { texto: { principal: `Todo por ${cop(real.total - 1000)}.`, titular: 'x' } }, /no sale de calcular\(\)/);
  rechaza('rechaza una pieza con menos de 3 unidades', { charms: [C1, C2, ESCASO] }, /2 unidad\(es\) disponibles/);
  rechaza('rechaza nombrar a Pandora', { texto: { principal: 'Compatible con Pandora.', titular: 'x' } }, /nombra a Pandora/);
  rechaza('rechaza Pandora también en la imagen', { imagen: { titulo: 'Como Pandora' } }, /imagen\.titulo: nombra a Pandora/);
  rechaza('rechaza «envío gratis» sin «pagando en línea»', { texto: { principal: 'Con envío gratis.', titular: 'x' } }, /sin decir «pagando en línea»/);
  rechaza('rechaza un descuento por porcentaje', { texto: { principal: 'Con 30% de descuento.', titular: 'x' } }, /porcentaje/);
  rechaza('rechaza un brazalete «de plata»', { texto: { principal: 'Un brazalete de plata.', titular: 'x' } }, /baño de plata/);
  rechaza('rechaza «sin interés» sin Addi', { texto: { principal: 'Tres cuotas sin interés.', titular: 'x' } }, /solo se puede decir de Addi/);
  rechaza('rechaza prometer cuotas con Sistecrédito', { texto: { principal: 'Paga a cuotas con Sistecrédito.', titular: 'x' } }, /Sistecrédito no se prometen/);
  rechaza('rechaza una foto vetada', { charms: [C1, C2, Object.keys(RECORTES.no_usar).find(id => !esPulsera.has(id))] }, /foto vetada/);
  rechaza('rechaza una receta sin hipótesis', { hipotesis: '' }, /Falta "hipotesis"/);
  rechaza('rechaza un destino que no existe', { destino: 'no-existe.html' }, /no existe en el sitio/);
  rechaza('rechaza aterrizar en una página con la condición vieja de envío', { destino: 'preguntas-frecuentes.html' }, /180\.000/);
  rechaza('rechaza un marcador desconocido', { texto: { principal: 'Por {precio_inventado}.', titular: 'x' } }, /marcador desconocido/);
  rechaza('rechaza un emoji en la imagen (la tipografía no lo tiene)', { imagen: { titulo: 'Regalo 🎁' } }, /emoji/);
  rechaza('rechaza un charm puesto como brazalete', { base: C1, charms: [C2] }, /no es un brazalete/);

  /* Lo que la imagen dice que sale gratis lo decide calcular(), no la receta. */
  const noGratis = [BASE, C1, C2, C3].find(id => !real.gratis.includes(id));
  rechaza('rechaza afirmar gratis una pieza que calcular() cobra', { exige_gratis: [noGratis] }, /no sale gratis con estas piezas/);

  /* {cuota_addi} solo existe dentro del rango sin interés: con un conjunto que
     lo pase, el marcador falla en vez de imprimir una cuota que Addi no da. */
  const caros = CHARMS.filter(id => id !== ESCASO).slice(0, 12);
  const totalCaro = calcular({ base: null, charms: caros, pago: 'anticipado' }).total;
  if (totalCaro > 600000) {
    rechaza('rechaza la cuota de Addi fuera de su rango sin interés',
      { base: null, charms: caros, imagen: { titulo: 'Todo', pie: 'o 3 cuotas de {cuota_addi} sin interés con Addi' } }, /fuera del rango sin interés de Addi/);
  }

  /* Sin lo apartado no hay con qué validar existencias: mejor parar que suponer. */
  const soloConteo = correr(receta(), existencias('solo-conteo'));
  comprobar(soloConteo.codigo !== 0 && /sin lo apartado/.test(soloConteo.salida), 'se niega a validar con existencias que no descuentan lo apartado');

  // ── las recetas versionadas tienen que seguir siendo JSON con lo mínimo ──
  const dir = path.join(RAIZ, 'herramientas', 'creativos', 'ads');
  fs.readdirSync(dir).filter(f => f.endsWith('.json')).forEach(f => {
    let r = null;
    try { r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { /* se informa abajo */ }
    comprobar(r && r.angulo && r.nombre && r.hipotesis && r.destino && r.texto && r.imagen, `receta ${f}: completa`);
    const texto = r ? JSON.stringify([r.imagen, r.texto]) : '';
    comprobar(!/\$\s?\d/.test(texto), `receta ${f}: sin cifras escritas a mano`, 'los precios van como marcadores');
  });

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fallos ? `\nCreador de ads: ${fallos} en rojo` : '\nCreador de ads en verde ✓');
}

main();
