#!/usr/bin/env node
/**
 * Cruza el Excel de stock (hoja Productos + Movimientos) contra el
 * catálogo del sitio (data/inventario.json) y genera data/stock.json.
 *
 *   node scripts/stock.mjs <ruta-al-excel>
 *
 * El Excel es la fuente de verdad para disponibilidad; el sitio es la
 * fuente de verdad para qué se vende y a qué precio. Este script solo
 * los cruza — nunca inventa un emparejamiento cuando el nombre no calza:
 * lo que no puede emparejar con confianza queda en `sin_emparejar` para
 * revisión manual, o en `data/stock-mapeo.json` como corrección permanente.
 *
 * El stock de cada SKU es la suma de sus movimientos (Inventario inicial,
 * Entrada, Devolución de cliente, Ajuste positivo restan; Salida,
 * Devolución a proveedor, Regalo/muestra, Merma, Ajuste negativo suman
 * en negativo) — igual que la fórmula que ya usa la hoja Productos.
 */

import ExcelJS from 'exceljs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const rutaExcel = process.argv[2];

if (!rutaExcel) {
  console.error('Uso: node scripts/stock.mjs <ruta-al-excel-de-inventario>');
  process.exit(1);
}

// Prefijos de categoría que el Excel antepone y el sitio no (o viceversa).
// Quitarlos no arriesga falsos positivos porque son ruido de clasificación,
// no parte del nombre distintivo de la pieza.
const PREFIJOS_RUIDO = ['pulsera', 'charm', 'zodiaco', 'profesion', 'coleccion preciosa'];

const normalizar = s => {
  let t = (s ?? '')
    .toString()
    .replace(/\s*\([^)]*\)\s*/g, ' ')       // "Ariel (La Sirenita)" → "Ariel"
    .replace(/\s+—\s*\d+\s*cm\s*$/, ' ')    // "... — 20 cm" → "..."
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  for (const prefijo of PREFIJOS_RUIDO) {
    t = t.replace(new RegExp(`\\b${prefijo}\\b`, 'g'), ' ');
  }
  return t.replace(/\s+/g, ' ').trim();
};

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(rutaExcel);

const hojaFilas = (nombre, primeraFila) => {
  const ws = wb.getWorksheet(nombre);
  if (!ws) throw new Error(`No se encontró la hoja "${nombre}" en el Excel.`);
  const filas = [];
  ws.eachRow((row, n) => {
    if (n < primeraFila) return;
    filas.push(row.values.slice(1)); // row.values[0] es undefined (ExcelJS es 1-indexado)
  });
  return filas;
};

/* ── 1 · Efecto de cada tipo de movimiento (hoja Listas) ────────────── */

const listas = hojaFilas('Listas', 3);
const efectoPorTipo = {};
for (const fila of listas) {
  const [, , tipo, efecto] = fila;
  if (tipo != null && efecto != null) efectoPorTipo[tipo] = Number(efecto);
}
if (Object.keys(efectoPorTipo).length === 0) {
  throw new Error('No se pudo leer la tabla de efectos en la hoja Listas.');
}

/* ── 2 · Stock neto por SKU (hoja Movimientos) ───────────────────────── */

const movimientos = hojaFilas('Movimientos', 3);
const stockPorSku = {};
for (const fila of movimientos) {
  const [, sku, , tipo, cantidad] = fila;
  if (!sku) continue;
  const efecto = efectoPorTipo[tipo];
  if (efecto === undefined) {
    console.warn(`  ⚠ Tipo de movimiento desconocido "${tipo}" en SKU ${sku} — se ignora esa línea.`);
    continue;
  }
  stockPorSku[sku] = (stockPorSku[sku] ?? 0) + efecto * Number(cantidad ?? 0);
}

/* ── 3 · Catálogo del Excel (hoja Productos) ─────────────────────────── */

const productos = hojaFilas('Productos', 3)
  .filter(f => f[0])
  .map(f => ({
    sku: f[0],
    nombre: f[1],
    categoria: f[2],
    coleccion: f[3],
    precio: f[6],
    minimo: Number(f[10] ?? 0),
    stock: stockPorSku[f[0]] ?? 0,
  }));

/* ── 4 · Catálogo del sitio ───────────────────────────────────────────── */

const inventario = JSON.parse(readFileSync(join(raiz, 'data/inventario.json'), 'utf8'));

/* ── 5 · Overrides manuales, si existen ──────────────────────────────── */

const rutaMapeo = join(raiz, 'data/stock-mapeo.json');
const mapeo = existsSync(rutaMapeo) ? JSON.parse(readFileSync(rutaMapeo, 'utf8')) : {};

/* ── 6 · Emparejar charms (1 SKU ⇄ 1 charm) ──────────────────────────── */

// Índice por texto normalizado y, además, por bolsa de palabras ordenada —
// captura reordenamientos exactos ("Cadena Seguridad Luna y Sol" ↔ "Cadena
// de Seguridad Sol y Luna") sin arriesgar coincidencias parciales: solo
// empareja cuando el conjunto de palabras es idéntico, no cuando se parece.
const CONECTORES = new Set(['de', 'y', 'con', 'del', 'la', 'el', 'los', 'las']);
const bolsaDePalabras = s => normalizar(s).split(' ')
  .filter(w => w && !CONECTORES.has(w))
  .sort()
  .join(' ');

const productosPorNombreNorm = new Map();
const productosPorBolsa = new Map();
for (const p of productos) {
  const key = normalizar(p.nombre);
  (productosPorNombreNorm.get(key) ?? productosPorNombreNorm.set(key, []).get(key)).push(p);
  const bolsa = bolsaDePalabras(p.nombre);
  (productosPorBolsa.get(bolsa) ?? productosPorBolsa.set(bolsa, []).get(bolsa)).push(p);
}

const usados = new Set();
const charmsResultado = [];
const charmsSinEmparejar = [];

for (const charm of inventario.charms) {
  const skuManual = mapeo[charm.id];
  let candidato = null;

  if (skuManual) {
    candidato = productos.find(p => p.sku === skuManual) ?? null;
    if (!candidato) console.warn(`  ⚠ stock-mapeo.json referencia el SKU "${skuManual}" para "${charm.id}", pero no existe en el Excel.`);
  } else {
    const exactas = (productosPorNombreNorm.get(normalizar(charm.nombre)) ?? [])
      .filter(p => !usados.has(p.sku));
    const porBolsa = (productosPorBolsa.get(bolsaDePalabras(charm.nombre)) ?? [])
      .filter(p => !usados.has(p.sku));
    const libres = exactas.length ? exactas : porBolsa;
    if (libres.length === 1) candidato = libres[0];
  }

  if (candidato) {
    usados.add(candidato.sku);
    charmsResultado.push({
      id: charm.id, nombre: charm.nombre, sku: candidato.sku,
      stock: candidato.stock, minimo: candidato.minimo,
      agotado: candidato.stock <= 0, bajo: candidato.stock > 0 && candidato.stock <= candidato.minimo,
    });
  } else {
    charmsSinEmparejar.push({ id: charm.id, nombre: charm.nombre });
  }
}

/* ── 7 · Emparejar brazaletes (1 modelo ⇄ N tallas) ──────────────────── */

const brazaletesResultado = [];
const brazaletesSinEmparejar = [];

for (const bz of inventario.brazaletes) {
  const skusManual = mapeo[bz.id];
  let tallas;

  if (Array.isArray(skusManual)) {
    tallas = skusManual.map(sku => productos.find(p => p.sku === sku)).filter(Boolean);
  } else {
    const nombreBase = normalizar(bz.nombre);
    const bolsaBase = bolsaDePalabras(bz.nombre);
    tallas = productos.filter(p => p.categoria === 'Pulsera' && normalizar(p.nombre) === nombreBase);
    if (tallas.length === 0) {
      tallas = productos.filter(p => p.categoria === 'Pulsera' && bolsaDePalabras(p.nombre) === bolsaBase);
    }
  }

  if (tallas.length > 0) {
    tallas.forEach(t => usados.add(t.sku));
    const porTalla = tallas
      .map(t => {
        const m = /—\s*(\d+)\s*cm/.exec(t.nombre);
        return { talla_cm: m ? Number(m[1]) : null, sku: t.sku, stock: t.stock, minimo: t.minimo };
      })
      .sort((a, b) => (a.talla_cm ?? 0) - (b.talla_cm ?? 0));
    brazaletesResultado.push({
      id: bz.id, nombre: bz.nombre,
      stock_total: porTalla.reduce((s, t) => s + t.stock, 0),
      tallas: porTalla,
    });
  } else {
    brazaletesSinEmparejar.push({ id: bz.id, nombre: bz.nombre });
  }
}

/* ── 8 · Lo que sobra del Excel — nuevo, renombrado, o descatalogado en el sitio ── */

const excelSinUsar = productos
  .filter(p => !usados.has(p.sku))
  .map(p => ({ sku: p.sku, nombre: p.nombre, categoria: p.categoria, stock: p.stock }));

/* ── 9 · Armado y escritura ───────────────────────────────────────────── */

const agotados = [...charmsResultado, ...brazaletesResultado.flatMap(b => b.tallas.map(t => ({ ...t, nombre: `${b.nombre} — ${t.talla_cm} cm` })))]
  .filter(x => (x.stock ?? x.stock_total) <= 0);
const bajos = charmsResultado.filter(c => c.bajo);

const stock = {
  _generado_por: 'scripts/stock.mjs — no editar a mano',
  _fuente_excel: rutaExcel,
  generado: new Date().toISOString().slice(0, 10),
  resumen: {
    charms_emparejados: charmsResultado.length,
    charms_sin_emparejar: charmsSinEmparejar.length,
    brazaletes_emparejados: brazaletesResultado.length,
    brazaletes_sin_emparejar: brazaletesSinEmparejar.length,
    referencias_excel_sin_usar: excelSinUsar.length,
    charms_agotados: charmsResultado.filter(c => c.agotado).length,
    charms_stock_bajo: bajos.length,
  },
  charms: Object.fromEntries(charmsResultado.map(c => [c.id, { sku: c.sku, stock: c.stock, minimo: c.minimo, agotado: c.agotado, bajo: c.bajo }])),
  brazaletes: Object.fromEntries(brazaletesResultado.map(b => [b.id, { stock_total: b.stock_total, tallas: b.tallas }])),
  diagnostico: {
    charms_sin_emparejar: charmsSinEmparejar,
    brazaletes_sin_emparejar: brazaletesSinEmparejar,
    excel_sin_usar: excelSinUsar,
  },
};

writeFileSync(join(raiz, 'data/stock.json'), JSON.stringify(stock, null, 2) + '\n');

console.log(`✓ data/stock.json`);
console.log(`  charms: ${charmsResultado.length} emparejados, ${charmsSinEmparejar.length} sin emparejar`);
console.log(`  brazaletes: ${brazaletesResultado.length} emparejados, ${brazaletesSinEmparejar.length} sin emparejar`);
console.log(`  del Excel sin usar: ${excelSinUsar.length} referencias`);
console.log(`  agotados: ${agotados.length} · stock bajo: ${bajos.length}`);
if (charmsSinEmparejar.length || brazaletesSinEmparejar.length) {
  console.log(`\n  ⚠ Hay referencias del sitio sin emparejar. Revisa "diagnostico" en`);
  console.log(`    data/stock.json y, si corresponde, agrégalas a data/stock-mapeo.json`);
  console.log(`    con el SKU correcto: { "id-del-sitio": "SKU-DEL-EXCEL" }.`);
}
