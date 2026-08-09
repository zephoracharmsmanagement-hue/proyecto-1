#!/usr/bin/env node
/**
 * Extrae el inventario y las reglas de precio de index.html a data/inventario.json.
 *
 *   node scripts/inventario.mjs
 *
 * El sitio es la fuente de verdad: si un precio cambia en index.html, se
 * regenera este JSON y las macros de WhatsApp quedan al día. Nunca editar
 * data/inventario.json a mano — se sobrescribe en la siguiente corrida.
 *
 * Lo que NO sale de aquí, porque el sitio no lo tiene: disponibilidad de
 * stock, tallas y tiempos de entrega. Ver docs/whatsapp/01-auditoria-macros.md.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(raiz, 'index.html'), 'utf8');

// El markup trae entidades (&amp;, &middot;). Se decodifican para que las
// respuestas de WhatsApp no salgan con "Lilo &amp; Stitch".
const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ', middot: '·' };
const decodificar = s => s?.replace(/&(#?\w+);/g, (t, e) => ENTIDADES[e] ?? t) ?? null;

const exigir = (re, etiqueta) => {
  const m = html.match(re);
  if (!m) throw new Error(`No se encontró ${etiqueta} en index.html. ¿Cambió el markup?`);
  return m;
};

/* ── 1 · Catálogo: el objeto DATA del armador es la fuente autoritativa ── */

const DATA = JSON.parse(exigir(/^const DATA=(\{.+\});$/m, 'const DATA')[1]);

/* ── 2 · Metadatos por tarjeta: grupo, subtítulo, imagen y sello ───────── */

const tarjetas = new Map();
for (const trozo of html.split('<article ').slice(1)) {
  const id = trozo.match(/data-id="([^"]+)"/)?.[1];
  if (!id) continue;
  const cuerpo = trozo.slice(0, trozo.indexOf('</article>'));
  tarjetas.set(id, {
    grupo: cuerpo.match(/data-g="([^"]+)"/)?.[1] ?? null,
    familia: cuerpo.match(/data-cg="([^"]+)"/)?.[1] ?? null,
    meta: decodificar(cuerpo.match(/class="pc-meta">([^<]*)</)?.[1].trim()),
    imagen: cuerpo.match(/<img src="([^"]+)"/)?.[1] ?? null,
    sello: decodificar(cuerpo.match(/class="pc-mark[^"]*">([^<]*)</)?.[1].trim()),
  });
}

/* ── 3 · Reglas de precio: se leen del código, no se copian a mano ─────── */

const [, wa, libre] = exigir(/const WA='(\d+)', LIBRE=(\d+);/, 'WA y LIBRE');
const [, anticipado, contraentrega] =
  exigir(/const ENVIO=\{anticipado:(\d+), contraentrega:(\d+)\};/, 'las tarifas de envío');
const esc = exigir(/const ESC=\[([^\]]+)\];/, 'la escala ESC')[1]
  .split(',')
  .map(n => parseFloat(n));
const promoBrazalete = parseFloat(exigir(/brutoB\*\.(\d+)/, 'el descuento del brazalete')[1]) / 100;
const minPromo = Number(exigir(/nC>=(\d+)\)\?brutoB/, 'el mínimo de charms de la promo')[1]);
const empaque = Number(exigir(/getElementById\('pack'\)\.checked\?(\d+):0/, 'el Empaque Premium')[1]);

/* ── 4 · Armado ────────────────────────────────────────────────────────── */

// Clips y cadenas viven en DATA.charms, así que suman para los descuentos por
// cantidad y para el mínimo de la promo. Se marcan aparte para que una
// respuesta pueda decir "charm" cuando es charm y "accesorio" cuando no.
const ACCESORIOS = { Clips: 'clip', Cadenas: 'cadena' };

const charms = DATA.charms.map(c => {
  const t = tarjetas.get(c.id) ?? {};
  return {
    id: c.id,
    nombre: c.n,
    precio: c.p,
    grupo: t.grupo,
    tipo: ACCESORIOS[t.grupo] ?? 'charm',
    material: 'Plata Esterlina 925',
    detalle: t.meta || null,
    imagen: t.imagen,
    cuenta_para_descuento: true,
  };
});

const brazaletes = DATA.pulseras.map(p => {
  const t = tarjetas.get(p.id) ?? {};
  return {
    id: p.id,
    nombre: p.n,
    precio: p.p,
    familia: t.familia,
    material: 'Baño de plata sobre base de alta resistencia',
    detalle: t.meta || null,
    imagen: t.imagen,
  };
});

const soloCharms = charms.filter(c => c.tipo === 'charm');
const precioMin = xs => Math.min(...xs.map(x => x.precio));
const brazaleteMin = precioMin(brazaletes);

// Piso del combo tal como lo calcula el armador, con y sin accesorios.
const comboDesde = items => {
  const tres = [...items].sort((a, b) => a.precio - b.precio).slice(0, minPromo);
  const bruto = tres.reduce((s, x) => s + x.precio, 0);
  return Math.round(bruto * (1 - esc[Math.min(minPromo, esc.length - 1)]) +
                    brazaleteMin * (1 - promoBrazalete));
};

const inventario = {
  _generado_por: 'scripts/inventario.mjs — no editar a mano',
  _fuente: 'index.html',
  generado: new Date().toISOString().slice(0, 10),

  marca: {
    nombre: 'Zephora Charms',
    sitio: 'https://zephoracharms.com/',
    whatsapp: `+${wa}`,
    instagram: '@zephora_charms',
  },

  reglas: {
    moneda: 'COP',
    envio: {
      anticipado: Number(anticipado),
      contraentrega: Number(contraentrega),
      gratis_desde: Number(libre),
      se_evalua_sobre: 'el total ya descontado, incluyendo el Empaque Premium',
      cobertura: 'Toda Colombia, con número de guía',
    },
    empaque_premium: empaque,
    garantia_dias: 30,
    descuento_por_charms: {
      1: esc[1], 2: esc[2], 3: esc[3], '4_o_mas': esc[4],
    },
    promo_brazalete: {
      descuento: promoBrazalete,
      minimo_charms: minPromo,
      nota: `Se aplica con ${minPromo} charms O MÁS, y acumula con el descuento por cantidad.`,
    },
    acumulan: true,
  },

  resumen: {
    charms_total: charms.length,
    charms_decorativos: soloCharms.length,
    clips: charms.filter(c => c.tipo === 'clip').length,
    cadenas_seguridad: charms.filter(c => c.tipo === 'cadena').length,
    brazaletes: brazaletes.length,
    charm_decorativo_desde: precioMin(soloCharms),
    accesorio_desde: precioMin(charms.filter(c => c.tipo !== 'charm')),
    brazalete_desde: brazaleteMin,
    combo_desde_real: comboDesde(soloCharms),
    combo_desde_absoluto: comboDesde(charms),
  },

  grupos: [...new Set(charms.map(c => c.grupo))].filter(Boolean).sort(),
  charms,
  brazaletes,
};

const salida = join(raiz, 'data/inventario.json');
writeFileSync(salida, JSON.stringify(inventario, null, 2) + '\n');

const r = inventario.resumen;
console.log(`✓ data/inventario.json · ${r.charms_total} charms (${r.charms_decorativos} decorativos, ` +
            `${r.clips} clips, ${r.cadenas_seguridad} cadenas) + ${r.brazaletes} brazaletes`);
console.log(`  charm decorativo desde $${r.charm_decorativo_desde.toLocaleString('es-CO')} · ` +
            `accesorio desde $${r.accesorio_desde.toLocaleString('es-CO')}`);
console.log(`  combo desde $${r.combo_desde_real.toLocaleString('es-CO')} con charms reales · ` +
            `$${r.combo_desde_absoluto.toLocaleString('es-CO')} contando accesorios`);
