'use strict';
/* Reponer inventario desde la hoja.
 *
 * Esta herramienta escribe el archivo que decide qué puede vender la tienda, y
 * ahí los errores no se ven: un número mal puesto no da fallo, deja piezas
 * fuera de la venta o promete unidades que no existen. Lo que hay que
 * demostrar, entonces, no es que sume bien —eso es fácil— sino que **se niegue
 * a escribir cuando el CSV no cuadra**, y que no escriba nada a medias.
 *
 * Y hay un caso que motiva la mitad de la herramienta: `_inventario.mjs`
 * reinicia lo vendido cuando cambia el campo `generado`. Ese campo era una
 * fecha sin hora, así que **reponer dos veces el mismo día no lo reiniciaba**:
 * el contador seguía restando contra el conteo nuevo, la tienda ofrecía menos
 * de lo que tenía, y el desfase se acumulaba en silencio. Aquí se comprueba que
 * dos reposiciones seguidas dejan dos `generado` distintos.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const GUION = path.join(RAIZ, 'herramientas', 'reponer.mjs');

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reponer-'));
const stockOriginal = JSON.parse(fs.readFileSync(path.join(RAIZ, 'assets', 'stock.json'), 'utf8'));

/* Cada caso corre sobre su propia copia: una prueba que dependa de lo que dejó
   la anterior deja de probar lo que dice probar en cuanto se reordenan. */
let n = 0;
function copia() {
  const p = path.join(tmp, `stock-${++n}.json`);
  fs.writeFileSync(p, JSON.stringify(stockOriginal, null, 2));
  return p;
}
function csv(texto) {
  const p = path.join(tmp, `datos-${n}.csv`);
  fs.writeFileSync(p, texto);
  return p;
}

/* Devuelve { ok, salida } sin lanzar: el guión sale con código 1 cuando el CSV
   no cuadra, y eso es justo lo que varias comprobaciones esperan. */
function correr(rutaCSV, rutaStock, ...args) {
  try {
    const salida = execFileSync('node', [GUION, rutaCSV, ...args], {
      env: Object.assign({}, process.env, { STOCK_JSON: rutaStock }),
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, salida };
  } catch (e) {
    return { ok: false, salida: (e.stdout || '') + (e.stderr || '') };
  }
}

const leer = p => JSON.parse(fs.readFileSync(p, 'utf8'));

/* Piezas reales sobre las que montar los casos. */
const items = stockOriginal.items;
const idCharm = Object.keys(items).find(k => !items[k].tallas);
const idPulsera = Object.keys(items).find(k => items[k].tallas
  && Object.keys(items[k].tallas).length > 1);
const tallas = Object.keys(items[idPulsera].tallas);

function main() {
  console.log('\n1 · Por defecto no escribe nada');
  {
    const s = copia();
    const antes = fs.readFileSync(s, 'utf8');
    const r = correr(csv(`id,quedan\n${idCharm},99\n`), s);
    comprobar(r.ok, 'la vista previa termina bien');
    comprobar(/vista previa/i.test(r.salida), 'y dice que es una vista previa');
    comprobar(fs.readFileSync(s, 'utf8') === antes,
      'el archivo queda byte por byte como estaba: escribir es un acto aparte');
    comprobar(/--escribir/.test(r.salida), 'y explica cómo aplicarlo');
  }

  console.log('\n2 · Con --escribir, aplica');
  {
    const s = copia();
    const r = correr(csv(`id,quedan\n${idCharm},99\n`), s, '--escribir');
    comprobar(r.ok && leer(s).items[idCharm].stock === 99,
      'la cantidad nueva queda en el archivo', String(leer(s).items[idCharm].stock));
    const it = leer(s).items[idCharm];
    comprobar(it.precio === items[idCharm].precio && it.tipo === items[idCharm].tipo
      && it.familia === items[idCharm].familia,
      'y se conservan precio, tipo y familia, que el CSV no trae');
    comprobar(Object.keys(leer(s).items).length === Object.keys(items).length,
      'no se pierde ninguna pieza del catálogo');
  }

  console.log('\n3 · El campo que reinicia lo vendido');
  {
    /* La razón de ser de media herramienta. Ver la cabecera de este archivo. */
    const s = copia();
    correr(csv(`id,quedan\n${idCharm},10\n`), s, '--escribir');
    const primero = leer(s).generado;
    correr(csv(`id,quedan\n${idCharm},20\n`), s, '--escribir');
    const segundo = leer(s).generado;

    comprobar(primero !== segundo,
      'dos reposiciones el mismo día dejan «generado» distinto');
    comprobar(/T\d\d:\d\d/.test(segundo),
      'porque lleva hora, no solo fecha: con fecha sola, la segunda no reiniciaría lo vendido',
      segundo);
    comprobar(/^\d{4}-\d{2}-\d{2}$/.test(leer(s).conteo_inventario),
      'y «conteo_inventario», que es lo que ve la clienta, sigue siendo un día',
      leer(s).conteo_inventario);
  }

  console.log('\n4 · Se niega a escribir un CSV que no cuadra');
  {
    /* Todos estos casos comparten lo importante: el archivo no se toca. Aplicar
       media reposición dejaría el inventario en un estado que no es ni el viejo
       ni el nuevo, y nadie sabría cuál era cuál. */
    const casos = [
      ['una pieza que no existe en el catálogo',
        `id,quedan\nno-existe-esta-pieza,5\n`, /no existe en el cat/i],
      ['un brazalete sin talla',
        `id,talla,quedan\n${idPulsera},,5\n`, /se cuenta por talla/i],
      ['un charm con talla',
        `id,talla,quedan\n${idCharm},18,5\n`, /no tiene tallas/i],
      ['una talla que ese brazalete no tiene',
        `id,talla,quedan\n${idPulsera},99,5\n`, /no tiene talla 99/i],
      ['la misma pieza dos veces',
        `id,quedan\n${idCharm},5\n${idCharm},7\n`, /dos veces/i],
      ['una cantidad negativa',
        `id,quedan\n${idCharm},-3\n`, /entero de 0 en adelante/i],
      ['una cantidad con decimales',
        `id,quedan\n${idCharm},2.5\n`, /entero de 0 en adelante/i],
      ['una cantidad que no es un número',
        `id,quedan\n${idCharm},muchas\n`, /entero de 0 en adelante/i],
      ['una fila sin cantidad',
        `id,quedan\n${idCharm},\n`, /sin cantidad/i],
      ['un CSV sin columna de cantidad',
        `id,pieza\n${idCharm},Algo\n`, /columna de cantidad/i],
      ['un CSV sin columna id',
        `pieza,quedan\nAlgo,5\n`, /columna «id»/i],
    ];

    casos.forEach(([que, texto, patron]) => {
      const s = copia();
      const antes = fs.readFileSync(s, 'utf8');
      const r = correr(csv(texto), s, '--escribir');
      const intacto = fs.readFileSync(s, 'utf8') === antes;
      comprobar(!r.ok && patron.test(r.salida) && intacto, `rechaza ${que}`,
        intacto ? '' : 'Y ESCRIBIÓ IGUAL');
    });
  }

  console.log('\n5 · Un error en la fila 3 no aplica las filas 1 y 2');
  {
    const s = copia();
    const antes = fs.readFileSync(s, 'utf8');
    const r = correr(csv(
      `id,quedan\n${idCharm},50\n${Object.keys(items)[1]},50\nno-existe,5\n`), s, '--escribir');
    comprobar(!r.ok && fs.readFileSync(s, 'utf8') === antes,
      'se valida todo antes de tocar nada: media reposición sería peor que ninguna');
  }

  console.log('\n6 · Las tallas se cuentan por separado');
  {
    const s = copia();
    const otra = tallas[1];
    correr(csv(`id,talla,quedan\n${idPulsera},${tallas[0]},7\n`), s, '--escribir');
    const b = leer(s).items[idPulsera];
    comprobar(b.tallas[tallas[0]] === 7, 'la talla del CSV cambia', `talla ${tallas[0]}: ${b.tallas[tallas[0]]}`);
    comprobar(b.tallas[otra] === items[idPulsera].tallas[otra],
      'y las demás tallas del mismo brazalete no se tocan',
      `talla ${otra}: ${b.tallas[otra]}`);
  }

  console.log('\n7 · Lo que no viene en el CSV');
  {
    const s = copia();
    const otro = Object.keys(items).find(k => k !== idCharm && !items[k].tallas);
    correr(csv(`id,quedan\n${idCharm},4\n`), s, '--escribir');
    comprobar(leer(s).items[otro].stock === items[otro].stock,
      'por defecto se queda como estaba: un CSV parcial no vacía la tienda');
  }
  {
    /* El conteo completo sí puede poner a cero, pero hay que pedirlo. */
    const s = copia();
    const otro = Object.keys(items).find(k => k !== idCharm && !items[k].tallas);
    correr(csv(`id,quedan\n${idCharm},4\n`), s, '--escribir', '--faltantes=cero');
    comprobar(leer(s).items[otro].stock === 0,
      'con --faltantes=cero sí se vacía lo que no viene');
    comprobar(leer(s).items[idCharm].stock === 4, 'y lo que sí viene queda con su cantidad');
  }
  {
    const s = copia();
    const r = correr(csv(`id,quedan\n${idCharm},4\n`), s, '--escribir', '--faltantes=loquesea');
    comprobar(!r.ok, 'una opción inventada se rechaza en vez de tomar el camino por defecto');
  }

  console.log('\n8 · El formato que exporta la hoja de verdad');
  {
    /* Las cabeceras de la hoja Existencias llevan un espacio al final, y los
       nombres de pieza llevan comas. Si esto no se traga tal cual sale de
       Google, la herramienta obliga a editar el CSV a mano cada vez — y ahí es
       donde se cuelan los errores que todo lo demás intenta evitar. */
    const s = copia();
    const r = correr(csv(
      `\ufeffid ,talla ,pieza ,quedan ,actualizado\n`
      + `${idCharm},,"Charm con, coma",6,2026-08-20\n`), s, '--escribir');
    comprobar(r.ok && leer(s).items[idCharm].stock === 6,
      'cabeceras con espacio al final, BOM y comas dentro de comillas');
  }
  {
    const s = copia();
    const r = correr(csv(`id,unidades\n${idCharm},6\n`), s, '--escribir');
    comprobar(r.ok && leer(s).items[idCharm].stock === 6,
      'y acepta otros nombres razonables para la columna de cantidad');
  }

  console.log('\n9 · Se respeta la sangría del archivo');
  {
    /* `stock.json` está sangrado con un espacio. Reescribirlo con otra sangría
       no cambia ni un dato, pero convierte cada reposición en un diff de las
       810 líneas del archivo — y entonces la revisión que el propio guión pide
       al terminar («revisa el diff») ya no se puede hacer, que es justo cuando
       se atrapa un CSV equivocado. */
    const s = path.join(tmp, 'sangria.json');
    fs.writeFileSync(s, JSON.stringify(stockOriginal, null, 1));
    correr(csv(`id,quedan\n${idCharm},4\n`), s, '--escribir');
    const lineas = fs.readFileSync(s, 'utf8').split('\n');
    comprobar(/^ "/.test(lineas[1]),
      'un archivo sangrado con un espacio se reescribe con un espacio', JSON.stringify(lineas[1]));

    const dos = path.join(tmp, 'sangria2.json');
    fs.writeFileSync(dos, JSON.stringify(stockOriginal, null, 2));
    correr(csv(`id,quedan\n${idCharm},4\n`), dos, '--escribir');
    comprobar(/^  "/.test(fs.readFileSync(dos, 'utf8').split('\n')[1]),
      'y uno de dos espacios, con dos: se copia la que había, no una fija');
  }

  console.log('\n10 · El diff se puede revisar');
  {
    const s = copia();
    const r = correr(csv(`id,quedan\n${idCharm},${items[idCharm].stock + 5}\n`), s);
    comprobar(/▲ Suben/.test(r.salida), 'separa lo que sube');
    comprobar(new RegExp(String(items[idCharm].stock) + '\\s+→').test(r.salida),
      'muestra el antes y el después');
    const nombre = JSON.parse(fs.readFileSync(path.join(RAIZ, 'assets', 'catalogo.json'), 'utf8'))
      .nombres[idCharm];
    comprobar(!nombre || r.salida.includes(nombre),
      'con el nombre legible de la pieza, no el slug', nombre);

    const b = correr(csv(`id,quedan\n${idCharm},0\n`), s);
    comprobar(/▼ Bajan/.test(b.salida) && /revisa que sea lo que quieres/i.test(b.salida),
      'y avisa cuando algo baja, que al reponer suele ser un CSV equivocado');
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fallos ? `\nReponer: ${fallos} en rojo` : '\nReponer inventario en verde ✓');
}

main();
