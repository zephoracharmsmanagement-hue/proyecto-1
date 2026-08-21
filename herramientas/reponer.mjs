#!/usr/bin/env node
/* Reponer inventario: de la hoja de cálculo a `assets/stock.json`.
 *
 *   node herramientas/reponer.mjs <archivo.csv>              ← solo muestra el diff
 *   node herramientas/reponer.mjs <archivo.csv> --escribir    ← lo aplica
 *
 * ── Qué cierra ──
 *
 * El círculo del inventario estaba abierto por este lado. La tienda vende, el
 * webhook lo apunta y la hoja lo refleja; pero cuando llegan piezas nuevas no
 * había forma de decírselo al sitio, y `stock.json` se quedaba con el conteo
 * del último día que alguien lo escribió a mano.
 *
 * ── Por qué un CSV y no leer la hoja por API ──
 *
 * Porque no hace falta. Leer la hoja obligaría a meter credenciales de Google
 * en la máquina de quien repone, y a que este script tenga permiso permanente
 * sobre un documento que es la contabilidad del negocio. Descargar la hoja como
 * CSV es un clic, no caduca, no se puede filtrar por accidente, y deja el
 * archivo delante para mirarlo antes de aplicarlo.
 *
 * ── Por qué no escribe salvo que se lo pidan ──
 *
 * Este archivo decide qué puede vender la tienda. Un número mal puesto aquí no
 * da error: deja piezas fuera de la venta, o peor, ofrece unidades que no
 * existen y hay que devolver dinero. Así que por defecto **enseña el diff y no
 * toca nada**; escribir es un acto aparte, con `--escribir`.
 *
 * ── Lo que arregla de paso, y no es menor ──
 *
 * `_inventario.mjs` reinicia lo vendido cuando cambia el campo `generado` de
 * este archivo. Ese campo venía con **fecha sin hora** (`2026-08-16`), así que
 * reponer dos veces el mismo día dejaba `generado` idéntico, `rebasar()`
 * devolvía false y el contador de vendidos seguía restando contra el conteo
 * nuevo. La tienda ofrecería menos de lo que tiene, el desfase se acumularía
 * con cada venta y nadie lo notaría: no hay error, solo menos existencias de
 * las reales.
 *
 * Por eso aquí `generado` se escribe con marca de tiempo completa. Nadie más lo
 * lee ni lo interpreta como fecha —se comprobó— así que es seguro; la fecha que
 * la página muestra es `conteo_inventario`, que sigue siendo un día.
 *
 * ── Lo que NO hace ──
 *
 * No toca las reservas en vuelo. Son pedidos que alguien está pagando ahora
 * mismo y esas unidades siguen comprometidas; de eso ya se encarga
 * `_inventario.mjs`, que las respeta al reiniciar.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
/* La ruta se puede sustituir por entorno, y existe solo para las pruebas: la
   batería necesita ejercer la escritura de verdad —incluido el `generado` que
   reinicia lo vendido— sin tocar el inventario real de la tienda. Es la misma
   costura que `usarAlmacen()` en _inventario.mjs. */
const RUTA = process.env.STOCK_JSON || join(RAIZ, 'assets', 'stock.json');
/* Los nombres legibles no están en stock.json, que solo lleva conteos: viven en
   el catálogo. Sin ellos el diff sería una lista de slugs y nadie podría
   revisarlo de un vistazo, que es justo para lo que existe la vista previa. */
const NOMBRES = (() => {
  try { return JSON.parse(readFileSync(join(RAIZ, 'assets', 'catalogo.json'), 'utf8')).nombres || {}; }
  catch (_) { return {}; }
})();

/* Las columnas que la hoja Existencias exporta llevan un espacio al final
   (`id `, `quedan `), porque así se crearon sus cabeceras. Se normalizan aquí
   en vez de pedirle a nadie que las arregle a mano antes de cada reposición. */
const clave = s => String(s || '').replace(/^﻿/, '').trim().toLowerCase();

/* Cuántas unidades hay. La hoja lo llama `quedan`; un conteo hecho a mano puede
   llamarlo de otras formas razonables, y rechazar el archivo por el nombre de
   una columna sería puro estorbo. */
const COLUMNAS_CANTIDAD = ['quedan', 'unidades', 'stock', 'cantidad', 'existencias'];

/* CSV de verdad, con comillas: los nombres de las piezas llevan comas
   («Lilo y Stitch, edición…») y partir por coma a secas las trocea. */
function leerCSV(texto) {
  const filas = [];
  let campo = '';
  let fila = [];
  let comillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }
        else comillas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') { comillas = true; continue; }
    if (c === ',') { fila.push(campo); campo = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; continue; }
    campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }

  if (!filas.length) return [];
  const cabecera = filas[0].map(clave);
  return filas.slice(1)
    .filter(f => f.some(v => String(v).trim() !== ''))
    .map(f => {
      const o = {};
      cabecera.forEach((k, i) => { o[k] = String(f[i] == null ? '' : f[i]).trim(); });
      return o;
    });
}

const cop = n => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
const sku = (id, talla) => (talla ? `${id}|${talla}` : id);

function abortar(titulo, detalles) {
  console.error(`\n✗ ${titulo}\n`);
  (detalles || []).forEach(d => console.error('   ' + d));
  console.error('\nNo se escribió nada.\n');
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  const ruta = args.find(a => !a.startsWith('--'));
  const escribir = args.includes('--escribir');
  const faltantes = (args.find(a => a.startsWith('--faltantes=')) || '').split('=')[1] || 'ignorar';
  const conteoArg = (args.find(a => a.startsWith('--conteo=')) || '').split('=')[1];

  if (!ruta) {
    console.error(`
Reponer inventario desde la hoja de cálculo.

  node herramientas/reponer.mjs <archivo.csv> [opciones]

Descarga la hoja «Existencias» como CSV (Archivo → Descargar → CSV) y pásala
aquí. Por defecto SOLO muestra el diff; nada se escribe sin --escribir.

Opciones:
  --escribir            aplica los cambios a assets/stock.json
  --faltantes=ignorar   (por defecto) las piezas que no estén en el CSV se
                        quedan como están
  --faltantes=cero      las piezas que no estén en el CSV pasan a 0 unidades.
                        Úsalo solo si el CSV es un conteo COMPLETO
  --conteo=AAAA-MM-DD   fecha del conteo que muestra la página (por defecto hoy)
`);
    process.exit(1);
  }

  if (!['ignorar', 'cero'].includes(faltantes)) {
    abortar(`--faltantes=${faltantes} no existe. Usa "ignorar" o "cero".`);
  }

  const crudo = readFileSync(RUTA, 'utf8');
  const stock = JSON.parse(crudo);
  const items = stock.items || {};
  /* Se reescribe con la sangría que ya tenía el archivo. Con una distinta, cada
     reposición sale como un diff de todo el archivo y la revisión que este mismo
     guión pide al final —«revisa el diff»— deja de poder hacerse. */
  const sangria = (crudo.match(/\n([ \t]+)"/) || [null, '  '])[1];
  let filas;
  try {
    filas = leerCSV(readFileSync(ruta, 'utf8'));
  } catch (e) {
    abortar(`No se pudo leer ${ruta}`, [e.message]);
  }
  if (!filas.length) abortar('El CSV no tiene filas de datos.');

  const cols = Object.keys(filas[0]);
  const colCantidad = COLUMNAS_CANTIDAD.find(c => cols.includes(c));
  if (!cols.includes('id')) {
    abortar('El CSV no tiene columna «id».', ['Columnas encontradas: ' + cols.join(', ')]);
  }
  if (!colCantidad) {
    abortar('El CSV no tiene columna de cantidad.', [
      'Se busca una de: ' + COLUMNAS_CANTIDAD.join(', '),
      'Columnas encontradas: ' + cols.join(', '),
    ]);
  }

  /* Se valida TODO antes de tocar nada. Aplicar la mitad de un conteo y
     abortar por la fila 40 dejaría el inventario en un estado que no es ni el
     viejo ni el nuevo, y nadie sabría cuál era cuál. */
  const errores = [];
  const vistos = new Set();
  const nuevos = {};

  filas.forEach((f, i) => {
    const linea = i + 2;               // +1 por la cabecera, +1 porque los humanos cuentan desde 1
    const id = f.id;
    const talla = f.talla || '';
    if (!id) { errores.push(`línea ${linea}: fila sin id`); return; }

    const it = items[id];
    if (!it) {
      errores.push(`línea ${linea}: «${id}» no existe en el catálogo`);
      return;
    }

    if (it.tallas && !talla) {
      errores.push(`línea ${linea}: «${id}» es un brazalete y se cuenta por talla, pero la talla viene vacía`);
      return;
    }
    if (!it.tallas && talla) {
      errores.push(`línea ${linea}: «${id}» es un charm y no tiene tallas, pero llegó con talla ${talla}`);
      return;
    }
    if (it.tallas && !Object.prototype.hasOwnProperty.call(it.tallas, talla)) {
      errores.push(`línea ${linea}: «${id}» no tiene talla ${talla} `
        + `(las suyas: ${Object.keys(it.tallas).join(', ')})`);
      return;
    }

    const s = sku(id, talla);
    if (vistos.has(s)) {
      errores.push(`línea ${linea}: «${s}» aparece dos veces en el CSV — no se puede saber cuál vale`);
      return;
    }
    vistos.add(s);

    const bruto = f[colCantidad];
    if (bruto === '') { errores.push(`línea ${linea}: «${s}» sin cantidad`); return; }
    const n = Number(bruto);
    if (!Number.isInteger(n) || n < 0) {
      errores.push(`línea ${linea}: «${s}» tiene cantidad «${bruto}»; se espera un entero de 0 en adelante`);
      return;
    }
    nuevos[s] = n;
  });

  if (errores.length) {
    abortar(`El CSV tiene ${errores.length} problema(s):`, errores.slice(0, 40).concat(
      errores.length > 40 ? [`… y ${errores.length - 40} más`] : []));
  }

  /* ── El diff ── */
  const sube = [], baja = [], igual = [], sinTocar = [];
  const salida = JSON.parse(JSON.stringify(items));

  const actual = s => {
    const [id, talla] = s.includes('|') ? s.split('|') : [s, null];
    return talla ? Number(items[id].tallas[talla]) || 0 : Number(items[id].stock) || 0;
  };
  const poner = (s, n) => {
    const [id, talla] = s.includes('|') ? s.split('|') : [s, null];
    if (talla) salida[id].tallas[talla] = n;
    else salida[id].stock = n;
  };

  Object.entries(nuevos).forEach(([s, n]) => {
    const antes = actual(s);
    poner(s, n);
    const fila = { s, antes, ahora: n };
    if (n > antes) sube.push(fila);
    else if (n < antes) baja.push(fila);
    else igual.push(fila);
  });

  Object.entries(items).forEach(([id, it]) => {
    const suyos = it.tallas ? Object.keys(it.tallas).map(t => sku(id, t)) : [id];
    suyos.forEach(s => {
      if (vistos.has(s)) return;
      if (faltantes === 'cero') {
        const antes = actual(s);
        poner(s, 0);
        if (antes !== 0) baja.push({ s, antes, ahora: 0 });
        else igual.push({ s, antes, ahora: 0 });
      } else {
        sinTocar.push({ s, antes: actual(s) });
      }
    });
  });

  const nombre = s => {
    const [id, talla] = s.includes('|') ? s.split('|') : [s, null];
    return (NOMBRES[id] || id) + (talla ? ` · talla ${talla}` : '');
  };
  const linea = f => `  ${nombre(f.s).padEnd(42)} ${String(f.antes).padStart(4)} → ${String(f.ahora).padStart(4)}`;

  console.log(`\nCSV: ${ruta}`);
  console.log(`Columna de cantidad: «${colCantidad}»  ·  filas leídas: ${filas.length}\n`);

  if (sube.length) {
    console.log(`▲ Suben (${sube.length})`);
    sube.sort((a, b) => (b.ahora - b.antes) - (a.ahora - a.antes)).forEach(f => console.log(linea(f)));
    console.log('');
  }
  if (baja.length) {
    /* Bajar existencias al reponer es raro y suele ser un CSV equivocado o una
       columna mal elegida. Se destaca por eso, no por ser un error. */
    console.log(`▼ Bajan (${baja.length}) — revisa que sea lo que quieres`);
    baja.sort((a, b) => (a.ahora - a.antes) - (b.ahora - b.antes)).forEach(f => console.log(linea(f)));
    console.log('');
  }
  console.log(`= Sin cambio: ${igual.length}`);
  if (sinTocar.length) {
    console.log(`· No venían en el CSV y se quedan como están: ${sinTocar.length}`);
    if (sinTocar.length <= 15) sinTocar.forEach(f => console.log(`  ${nombre(f.s).padEnd(42)} ${f.antes}`));
    console.log('  (con --faltantes=cero pasarían todas a 0)');
  }

  const totalAntes = Object.values(items).reduce((n, it) =>
    n + (it.tallas ? Object.values(it.tallas).reduce((a, b) => a + (Number(b) || 0), 0) : (Number(it.stock) || 0)), 0);
  const totalAhora = Object.values(salida).reduce((n, it) =>
    n + (it.tallas ? Object.values(it.tallas).reduce((a, b) => a + (Number(b) || 0), 0) : (Number(it.stock) || 0)), 0);
  const valor = Object.entries(salida).reduce((n, [, it]) =>
    n + (it.precio || 0) * (it.tallas ? Object.values(it.tallas).reduce((a, b) => a + (Number(b) || 0), 0) : (Number(it.stock) || 0)), 0);

  console.log(`\nUnidades en total: ${totalAntes} → ${totalAhora}  (${totalAhora - totalAntes >= 0 ? '+' : ''}${totalAhora - totalAntes})`);
  console.log(`Valor del inventario a precio de venta: ${cop(valor)}`);

  if (!escribir) {
    console.log('\nEsto fue solo la vista previa. Para aplicarlo:');
    console.log(`  node herramientas/reponer.mjs ${ruta} --escribir\n`);
    return;
  }

  /* Marca de tiempo completa, no solo la fecha: es lo que hace que reponer dos
     veces el mismo día reinicie lo vendido las dos veces. Ver la cabecera. */
  stock.generado = new Date().toISOString();
  stock.conteo_inventario = conteoArg || new Date().toISOString().slice(0, 10);
  stock.items = salida;

  writeFileSync(RUTA, JSON.stringify(stock, null, sangria) + '\n', 'utf8');

  console.log(`\n✓ Escrito ${RUTA}`);
  console.log(`  generado: ${stock.generado}`);
  console.log(`  conteo_inventario: ${stock.conteo_inventario}`);
  console.log(`
Falta desplegar para que la tienda lo vea. Al desplegarse, el contador de
vendidos se reinicia solo —lo detecta el cambio de «generado»— y las reservas
en vuelo se respetan.

Revisa el diff con «git diff assets/stock.json» antes de commitear.
`);
}

main();
