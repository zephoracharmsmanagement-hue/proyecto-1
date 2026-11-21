#!/usr/bin/env node
/* El catálogo en PDF que el bot de WhatsApp le manda a las clientas, generado
 * desde la tienda en cada despliegue.
 *
 *   node herramientas/catalogo-pdf.mjs                 ← escribe en assets/
 *   node herramientas/catalogo-pdf.mjs --salida DIR    ← escribe en DIR (pruebas)
 *
 * Escribe dos archivos, siempre juntos:
 *
 *   catalogo-zephora-charms.pdf    el que manda el bot (misma ruta de siempre:
 *                                  n8n no cambia)
 *   catalogo-zephora-charms.json   qué pieza lista y a qué precio, para que
 *                                  pruebas/catalogo-pdf.js lo contraste
 *
 * ── Por qué se genera y no se diseña ──
 *
 * Hasta el 2026-11-19 el catálogo era un PDF de Canva del 27-sep, publicado
 * con herramientas/catalogo_pdf.py. Una copia congelada: le faltaban los
 * anillos, las piezas de noviembre y los precios nuevos, y nada lo avisaba —la
 * prueba solo miraba los precios de las piezas que el PDF sí traía—. El
 * propietario lo vio en una prueba con el bot y eligió «que se genere solo».
 *
 * ── De dónde sale cada cosa ──
 *
 *   · Qué piezas, en qué orden, con qué nombre, descripción, sello y foto:
 *     las tarjetas de index.html, tal como las ve la clienta en la portada.
 *     Brazaletes, luego charms por categoría en el orden de los filtros, luego
 *     anillos — el mismo recorrido de la página.
 *   · El precio: assets/catalogo.json, el archivo con el que el servidor cobra.
 *     Si una tarjeta dijera otro número, aquí se usa el del cobro (y la prueba
 *     lo marca).
 *   · La promo: el texto de la caja de promoción de index.html, palabra por
 *     palabra. Si no se encuentra, el script falla en vez de inventar uno.
 *   · «Próximamente»: el conjunto PRONTO de tienda.js, si existe.
 *
 * ── Lo que NO trae, a propósito ──
 *
 * Existencias. Cambian a diario y un PDF no se entera; el bot las confirma
 * con `disponibilidad` antes de cerrar. El PDF lo dice en cada página.
 *
 * ── Cuándo se regenera ──
 *
 * En el build de Netlify (netlify.toml → command), en cada despliegue. Un
 * cambio de catálogo siempre despliega, así que el PDF publicado siempre es el
 * del catálogo publicado. Si este script falla, falla el build y la tienda se
 * queda en el despliegue anterior, entera: mejor que publicar un PDF viejo sin
 * que nadie se entere, que es justo lo que pasó con el de Canva. Las mismas
 * pruebas corren este script en cada push, así que un fallo se ve antes de
 * llegar a Netlify.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUENTES = path.join(RAIZ, 'herramientas', 'fuentes');
const NOMBRE = 'catalogo-zephora-charms';

/* ── Colores y medidas: los de tienda.css ── */
const C = { bone: '#F6F3F4', ink: '#2A1F2E', plum: '#5C3D63', rose: '#B4657F', roseSoft: '#F3E6EB',
  gris: '#5E5463', grisSuave: '#6E6473', line: '#E4DDE0', white: '#FFFFFF' };
const A4 = [595.28, 841.89];
const M = 34;                       // margen
const COLS = 3, GAP = 12;
const ANCHO = A4[0] - 2 * M;
const CW = (ANCHO - GAP * (COLS - 1)) / COLS;   // ancho de tarjeta
/* Tres filas de tres por página: la foto es un poco más ancha que alta y la
   joya se centra en ella. Con la foto cuadrada cabían dos filas y el catálogo
   se iba a 25 páginas, medio vacías. */
const FOTO = 146;                    // alto de la foto
const CH = FOTO + 54;                // alto de tarjeta
const CAB = 30, PIE = 30;            // cabecera y pie de cada página
const ARRIBA = M + CAB, ABAJO = A4[1] - M - PIE;
const PX = 380, CALIDAD = 76;        // foto: ~2,3 pulgadas a ~160 dpi, en JPEG

const TALLAS_BRAZALETE = ['17', '18', '19', '20', '21'];   // tienda.js: TALLAS

/* ── Leer la tienda ── */

const leer = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const texto = h => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
/* Las tipografías del sitio no traen emojis: se quitan para que no salga un
   recuadro vacío. */
const sinEmoji = s => s.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();

function seccion(html, id) {
  const i = html.indexOf(`<section class="sec" id="${id}"`);
  if (i < 0) throw new Error(`index.html no tiene la sección #${id}`);
  return html.slice(i, html.indexOf('</section>', i));
}

function tarjetas(trozo) {
  const out = [];
  const re = /<article class="(pc[^"]*)" data-id="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g;
  let m;
  while ((m = re.exec(trozo))) {
    const [, clases, id, cuerpo] = m;
    const g = cuerpo.match(/class="pc-name">([\s\S]*?)<\/h3>/);
    const meta = cuerpo.match(/class="pc-meta">([\s\S]*?)<\/p>/);
    const sello = cuerpo.match(/class="pc-mark[^"]*">([\s\S]*?)<\/span>/);
    const img = cuerpo.match(/<img src="([^"?]+)/);
    const grupo = (m[0].match(/data-g="([^"]+)"/) || [])[1] || null;
    out.push({ id, clases, grupo, nombre: g ? texto(g[1]) : id, meta: meta ? texto(meta[1]) : '',
      sello: sello ? texto(sello[1]) : '', img: img ? img[1] : null });
  }
  return out;
}

export function leerTienda() {
  const html = leer('index.html');
  const cat = JSON.parse(leer('assets/catalogo.json'));
  /* Con una oferta de temporada, catalogo.json trae `precios` (con descuento) y
     `lista`. El PDF se arma en cada despliegue: lleva lo que se cobra ese día,
     igual que _precios.js (oferta vigente hasta el último día, hora de Colombia). */
  const of = cat.reglas.oferta;
  const precios = of && cat.lista && Date.now() > Date.parse(of.hasta + 'T23:59:59-05:00') ? cat.lista : cat.precios;

  /* Brazaletes, en el orden de su sección. */
  const brz = tarjetas(seccion(html, 'brazaletes'));

  /* Charms: categorías en el orden de los filtros de la portada. «Religiosos»
     es un tema, no una categoría (sus piezas viven en Símbolos), y
     «Favoritos»/«Todos» no son grupos. */
  const sCharms = seccion(html, 'charms');
  const filtros = [...sCharms.matchAll(/class="fbtn[^"]*" type="button" data-f="([^"]+)">([^<]+)</g)]
    .map(m => ({ f: m[1], titulo: texto(m[2]) }))
    .filter(x => !['Favoritos', 'todos', 'Religiosos'].includes(x.f));
  const charms = tarjetas(sCharms);      // la cuadrícula y, al final, los favoritos (#rail-top)
  const vistos = new Set();
  const charmsUnicos = charms.filter(t => !vistos.has(t.id) && vistos.add(t.id));

  const anillos = tarjetas(seccion(html, 'anillos'));

  /* Letras: una sola tarjeta en la tienda; las iniciales salen del catálogo. */
  const letras = Object.keys(precios).filter(id => id.startsWith('letra-'));

  /* Promo: la caja de la portada, tal cual. */
  const pt = html.match(/class="promo-caja-t">([\s\S]*?)<\/p>/);
  const px = html.match(/class="promo-caja-x">([\s\S]*?)<\/p>/);
  if (!pt || !px) throw new Error('No encontré la caja de la promo en index.html: no se inventa un texto.');
  const promo = { titulo: sinEmoji(texto(pt[1])), texto: sinEmoji(texto(px[1])) };

  /* «Próximamente»: el conjunto de tienda.js, si lo hay. */
  const t = leer('tienda.js');
  const pm = t.match(/const PRONTO\s*=\s*new Set\(\[([^\]]*)\]\)/);
  const pronto = new Set(pm ? [...pm[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : []);

  const intro = id => { const s = seccion(html, id).match(/<div class="sec-head">[\s\S]*?<p>([\s\S]*?)<\/p>/); return s ? texto(s[1]) : ''; };
  const wa = (html.match(/wa\.me\/(\d+)/) || [])[1] || '';

  return { cat, precios, brz, filtros, charms: charmsUnicos, anillos, letras, promo, pronto, wa,
    intros: { brazaletes: intro('brazaletes'), charms: intro('charms'), anillos: intro('anillos') } };
}

/* ── Armar el contenido: secciones y tarjetas ── */

const pesos = n => '$' + Number(n).toLocaleString('es-CO').replace(/,/g, '.');

export function armar(t) {
  const secciones = [];
  const lista = {};          // id → precio, de cada pieza que lista el PDF
  const tallasAnillo = base => Object.keys(t.precios).filter(id => id.startsWith(base + '-t'))
    .map(id => ({ id, talla: id.slice(base.length + 2) }));

  secciones.push({ titulo: 'Brazaletes', intro: t.intros.brazaletes, tarjetas: t.brz.map(b => {
    const precio = t.precios[b.id];
    if (precio == null) throw new Error(`El brazalete ${b.id} no tiene precio en catalogo.json`);
    lista[b.id] = precio;
    return { ...b, precio, extra: 'Tallas ' + TALLAS_BRAZALETE.join(' · ') + ' cm' };
  }) });

  t.filtros.forEach((f, i) => {
    let ts;
    if (f.f === 'Letras') {
      const tarjeta = t.charms.find(c => c.id === 'letras');
      if (!tarjeta) throw new Error('No encontré la tarjeta de letras');
      const precio = t.precios[t.letras[0]];
      t.letras.forEach(id => { lista[id] = t.precios[id]; });
      ts = [{ ...tarjeta, ancha: true, precio, iniciales: t.letras.map(id => id.slice(6).toUpperCase()) }];
    } else {
      ts = t.charms.filter(c => c.grupo === f.f).map(c => {
        const precio = t.precios[c.id];
        if (precio == null) throw new Error(`El charm ${c.id} no tiene precio en catalogo.json`);
        lista[c.id] = precio;
        return { ...c, precio };
      });
    }
    /* Sin el párrafo de la sección de charms: habla del buscador y los
       favoritos de la página, que en un PDF no existen. */
    if (ts.length) secciones.push({ titulo: f.titulo, eyebrow: i === 0 ? 'Charms' : '', tarjetas: ts });
  });

  secciones.push({ titulo: 'Anillos', intro: t.intros.anillos, tarjetas: t.anillos.map(a => {
    const tallas = tallasAnillo(a.id);
    if (!tallas.length) throw new Error(`El anillo ${a.id} no tiene tallas en catalogo.json`);
    const precio = t.precios[tallas[0].id];
    tallas.forEach(x => { lista[x.id] = t.precios[x.id]; });
    return { ...a, precio, extra: 'Tallas ' + tallas.map(x => x.talla).join(' · ') };
  }) });

  /* Lo que se marca como «Próximamente» en la tienda, igual aquí. */
  secciones.forEach(s => s.tarjetas.forEach(c => { c.pronto = t.pronto.has(c.id); }));
  return { secciones, lista };
}

/* ── Paginar: dónde cae cada cosa ── */

function paginar(secciones) {
  const paginas = [[]];
  let y = ARRIBA;
  const nueva = () => { paginas.push([]); y = ARRIBA; };
  const cabe = h => y + h <= ABAJO;
  for (const s of secciones) {
    const hCab = (s.eyebrow ? 14 : 0) + 30 + (s.intro ? 30 : 0) + 8;
    /* Un título nunca queda solo al pie de una página. */
    if (!cabe(hCab + CH)) nueva();
    s.pagina = paginas.length;      // 1-based contando desde la primera interior
    paginas[paginas.length - 1].push({ tipo: 'titulo', s, y });
    y += hCab;
    let col = 0;
    for (const c of s.tarjetas) {
      if (c.ancha) {
        const h = 190;
        if (col) { y += CH + GAP; col = 0; }
        if (!cabe(h)) nueva();
        paginas[paginas.length - 1].push({ tipo: 'ancha', c, x: M, y });
        y += h + GAP;
        continue;
      }
      if (col === 0 && !cabe(CH)) nueva();
      paginas[paginas.length - 1].push({ tipo: 'tarjeta', c, x: M + col * (CW + GAP), y });
      col++;
      if (col === COLS) { col = 0; y += CH + GAP; }
    }
    if (col) y += CH + GAP;
    y += 10;
  }
  return paginas;
}

/* ── Fotos: JPEG pequeño, sobre el fondo de la tarjeta ── */

async function foto(rutaRel, cache) {
  if (cache.has(rutaRel)) return cache.get(rutaRel);
  const archivo = path.basename(rutaRel);
  const hd = path.join(RAIZ, 'assets', 'hd', archivo);
  const origen = fs.existsSync(hd) ? hd : path.join(RAIZ, rutaRel);
  if (!fs.existsSync(origen)) throw new Error(`Falta la foto ${rutaRel}`);
  const buf = await sharp(origen).resize(PX, PX, { fit: 'contain', background: C.white })
    .flatten({ background: C.white }).jpeg({ quality: CALIDAD, mozjpeg: true }).toBuffer();
  cache.set(rutaRel, buf);
  return buf;
}

/* ── Dibujar ── */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = d => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
const telefono = wa => wa ? '+' + wa.slice(0, 2) + ' ' + wa.slice(2, 5) + ' ' + wa.slice(5, 8) + ' ' + wa.slice(8) : '';

export async function generar({ salida = path.join(RAIZ, 'assets'), hoy = new Date() } = {}) {
  const t = leerTienda();
  const { secciones, lista } = armar(t);
  const paginas = paginar(secciones);
  const fotos = new Map();

  const doc = new PDFDocument({ size: A4, margin: 0, autoFirstPage: false,
    info: { Title: 'Catálogo Zephora Charms', Author: 'Zephora Charms', Subject: 'Charms en Plata 925, brazaletes y anillos' } });
  const f = n => path.join(FUENTES, n);
  doc.registerFont('serif', f('CormorantGaramond-Medium.ttf'));
  doc.registerFont('serif-b', f('CormorantGaramond-SemiBold.ttf'));
  doc.registerFont('serif-i', f('CormorantGaramond-MediumItalic.ttf'));
  doc.registerFont('sans', f('Jost-Regular.ttf'));
  doc.registerFont('sans-m', f('Jost-Medium.ttf'));
  const trozos = [];
  doc.on('data', d => trozos.push(d));
  const listo = new Promise(r => doc.on('end', r));

  const fondo = () => doc.rect(0, 0, A4[0], A4[1]).fill(C.bone);
  const marca = (x, y, tam, centrada) => {
    doc.font('serif').fontSize(tam).fillColor(C.ink);
    const a = doc.widthOfString('ZEPHORA ', { characterSpacing: tam * 0.13 });
    doc.font('serif-i');
    const b = doc.widthOfString('Charms', { characterSpacing: tam * 0.04 });
    const x0 = centrada ? (A4[0] - a - b) / 2 : x;
    doc.font('serif').fillColor(C.ink).text('ZEPHORA ', x0, y, { characterSpacing: tam * 0.13, lineBreak: false });
    doc.font('serif-i').fillColor(C.plum).text('Charms', x0 + a, y, { characterSpacing: tam * 0.04, lineBreak: false });
  };
  const nota = `Consulta disponibilidad por WhatsApp${t.wa ? ' · ' + telefono(t.wa) : ''} · zephoracharms.com`;

  /* Portada */
  doc.addPage(); fondo();
  doc.font('sans').fontSize(9).fillColor(C.grisSuave)
    .text('CATÁLOGO · ' + MESES[hoy.getMonth()].toUpperCase() + ' ' + hoy.getFullYear(), 0, 120, { width: A4[0], align: 'center', characterSpacing: 2.2 });
  marca(0, 142, 40, true);
  doc.font('serif-i').fontSize(15).fillColor(C.gris)
    .text('Charms en Plata Esterlina 925, brazaletes y anillos', 0, 196, { width: A4[0], align: 'center' });

  /* Tres piezas destacadas de la tienda */
  const dest = (t.cat.destacados || []).slice(0, 3)
    .map(id => t.charms.find(c => c.id === id)).filter(c => c && c.img);
  const lado = 140, gapD = 14, x0 = (A4[0] - (lado * dest.length + gapD * (dest.length - 1))) / 2;
  for (let i = 0; i < dest.length; i++) {
    const x = x0 + i * (lado + gapD);
    doc.rect(x, 238, lado, lado).fill(C.white);
    doc.image(await foto(dest[i].img, fotos), x, 238, { fit: [lado, lado], align: 'center', valign: 'center' });
  }

  /* La promo, con las palabras del sitio */
  const py = 404;
  doc.roundedRect(M + 30, py, ANCHO - 60, 92, 6).fill(C.plum);
  doc.font('sans-m').fontSize(11.5).fillColor(C.white)
    .text(t.promo.titulo, M + 50, py + 18, { width: ANCHO - 100, align: 'center' });
  doc.font('sans').fontSize(9.5).fillColor('#EFE4F1')
    .text(t.promo.texto, M + 50, doc.y + 6, { width: ANCHO - 100, align: 'center', lineGap: 1.5 });

  /* Contenido, con la página donde empieza cada sección */
  let iy = 528;
  doc.font('sans').fontSize(8.5).fillColor(C.grisSuave).text('CONTENIDO', 0, iy, { width: A4[0], align: 'center', characterSpacing: 2 });
  iy += 20;
  const colX = [M + 70, A4[0] / 2 + 20], colW = A4[0] / 2 - M - 90;
  secciones.forEach((s, i) => {
    const col = i < Math.ceil(secciones.length / 2) ? 0 : 1;
    const fila = col ? i - Math.ceil(secciones.length / 2) : i;
    const y = iy + fila * 17;
    doc.font('serif').fontSize(12.5).fillColor(C.ink).text(s.titulo, colX[col], y, { lineBreak: false });
    doc.font('sans').fontSize(9).fillColor(C.grisSuave).text(String(s.pagina + 1), colX[col], y + 3, { width: colW, align: 'right' });
  });

  doc.font('sans').fontSize(8.5).fillColor(C.gris)
    .text(`Precios vigentes al ${fechaLarga(hoy)}. Las existencias cambian a diario: ${nota.charAt(0).toLowerCase() + nota.slice(1)}.`,
      M + 40, A4[1] - M - 34, { width: ANCHO - 80, align: 'center' });

  /* Páginas interiores */
  for (let p = 0; p < paginas.length; p++) {
    doc.addPage(); fondo();
    marca(M, M - 2, 12, false);
    doc.font('sans').fontSize(7.5).fillColor(C.grisSuave)
      .text('CATÁLOGO · ' + MESES[hoy.getMonth()].toUpperCase() + ' ' + hoy.getFullYear(), M, M + 2, { width: ANCHO, align: 'right', characterSpacing: 1.4 });
    doc.moveTo(M, M + 18).lineTo(A4[0] - M, M + 18).lineWidth(0.6).strokeColor(C.line).stroke();

    for (const e of paginas[p]) {
      if (e.tipo === 'titulo') {
        let y = e.y;
        if (e.s.eyebrow) {
          doc.font('sans').fontSize(8).fillColor(C.grisSuave).text(e.s.eyebrow.toUpperCase(), M, y, { characterSpacing: 2 });
          y += 14;
        }
        doc.font('serif').fontSize(22).fillColor(C.ink).text(e.s.titulo, M, y, { characterSpacing: 0.6, lineBreak: false });
        const n = e.s.tarjetas.reduce((k, c) => k + (c.iniciales ? c.iniciales.length : 1), 0);
        doc.font('sans').fontSize(8).fillColor(C.grisSuave)
          .text(n + (n === 1 ? ' pieza' : (e.s.titulo === 'Letras' ? ' iniciales' : ' piezas')), M, y + 9, { width: ANCHO, align: 'right' });
        y += 30;
        if (e.s.intro) {
          doc.font('sans').fontSize(8.5).fillColor(C.gris).text(e.s.intro, M, y, { width: ANCHO, height: 26, ellipsis: true, lineGap: 1 });
        }
      } else if (e.tipo === 'tarjeta') {
        await tarjeta(doc, e.c, e.x, e.y, fotos);
      } else {
        await ancha(doc, e.c, e.x, e.y, fotos);
      }
    }

    doc.moveTo(M, A4[1] - M - 16).lineTo(A4[0] - M, A4[1] - M - 16).lineWidth(0.6).strokeColor(C.line).stroke();
    doc.font('sans').fontSize(7.5).fillColor(C.gris).text(nota, M, A4[1] - M - 9, { width: ANCHO - 30, lineBreak: false });
    doc.font('sans').fontSize(7.5).fillColor(C.grisSuave).text(String(p + 2), M, A4[1] - M - 9, { width: ANCHO, align: 'right' });
  }

  doc.end();
  await listo;
  const pdf = Buffer.concat(trozos);

  fs.mkdirSync(salida, { recursive: true });
  fs.writeFileSync(path.join(salida, NOMBRE + '.pdf'), pdf);
  /* Piezas = referencias que se pueden comprar: cada inicial y cada talla de
     anillo cuentan aparte, igual que en catalogo.json. */
  const piezas = Object.keys(lista).length;
  const resumen = {
    _: 'Generado por herramientas/catalogo-pdf.mjs junto con catalogo-zephora-charms.pdf (en el build de Netlify): '
      + 'qué pieza lista ese PDF y a qué precio, para que pruebas/catalogo-pdf.js lo contraste con catalogo.json. No editar a mano.',
    publicado: hoy.toISOString().slice(0, 10),
    vigentes: `precios vigentes al ${fechaLarga(hoy)}`,
    paginas: paginas.length + 1,
    tarjetas: secciones.reduce((k, s) => k + s.tarjetas.length, 0),
    piezas,
    secciones: secciones.map(s => ({ titulo: s.titulo, pagina: s.pagina + 1, ids: s.tarjetas.map(c => c.id) })),
    proximamente: secciones.flatMap(s => s.tarjetas.filter(c => c.pronto).map(c => c.id)),
    promo: t.promo,
    precios: Object.fromEntries(Object.entries(lista).sort(([a], [b]) => a.localeCompare(b))),
  };
  fs.writeFileSync(path.join(salida, NOMBRE + '.json'), JSON.stringify(resumen, null, 1) + '\n');
  return { pdf: pdf.length, ...resumen };
}

async function tarjeta(doc, c, x, y, fotos) {
  doc.rect(x, y, CW, CH).fill(C.white);
  doc.rect(x, y, CW, CH).lineWidth(0.6).strokeColor(C.line).stroke();
  if (c.img) doc.image(await foto(c.img, fotos), x + 1, y + 1, { fit: [CW - 2, FOTO - 2], align: 'center', valign: 'center' });
  sello(doc, c.sello, x + 7, y + 7);
  if (c.pronto) etiqueta(doc, 'Próximamente', x + CW - 7, y + 7);
  let ty = y + FOTO + 4;
  doc.font('serif-b').fontSize(11.5).fillColor(C.ink).text(c.nombre, x + 8, ty, { width: CW - 16, height: 14, ellipsis: true, lineBreak: false });
  ty += 15;
  const meta = c.extra || c.meta;
  if (meta) doc.font('sans').fontSize(7).fillColor(C.gris).text(meta, x + 8, ty, { width: CW - 16, height: 9, ellipsis: true, lineBreak: false });
  doc.font('sans-m').fontSize(10.5).fillColor(C.plum).text(pesos(c.precio), x + 8, y + CH - 16, { lineBreak: false });
  if (c.extra && c.meta) doc.font('sans').fontSize(7).fillColor(C.grisSuave)
    .text(c.meta, x + 8, y + CH - 14, { width: CW - 16, align: 'right', height: 9, ellipsis: true, lineBreak: false });
}

async function ancha(doc, c, x, y, fotos) {
  const h = 190, lado = h - 2;
  doc.rect(x, y, ANCHO, h).fill(C.white);
  doc.rect(x, y, ANCHO, h).lineWidth(0.6).strokeColor(C.line).stroke();
  if (c.img) doc.image(await foto(c.img, fotos), x + 1, y + 1, { fit: [lado, lado], align: 'center', valign: 'center' });
  sello(doc, c.sello, x + 7, y + 7);
  const tx = x + lado + 18, tw = ANCHO - lado - 30;
  doc.font('serif-b').fontSize(16).fillColor(C.ink).text(c.nombre, tx, y + 14, { width: tw });
  doc.font('sans-m').fontSize(12).fillColor(C.plum).text(pesos(c.precio) + ' cada una', tx, doc.y + 4, { width: tw });
  /* Las iniciales, en cuadritos como en la tienda */
  const b = 22, g = 5, porFila = Math.floor((tw + g) / (b + g));
  let iy = doc.y + 10;
  c.iniciales.forEach((L, i) => {
    const bx = tx + (i % porFila) * (b + g), by = iy + Math.floor(i / porFila) * (b + g);
    doc.rect(bx, by, b, b).lineWidth(0.6).strokeColor(C.line).stroke();
    doc.font('sans').fontSize(10).fillColor(C.ink).text(L, bx, by + 6, { width: b, align: 'center', lineBreak: false });
  });
}

function sello(doc, s, x, y) {
  if (!s) return;
  doc.font('sans').fontSize(6.5);
  const w = doc.widthOfString(s) + 10;
  doc.rect(x, y, w, 13).fill(C.white);
  doc.rect(x, y, w, 13).lineWidth(0.5).strokeColor(C.silverLine || C.line).stroke();
  doc.fillColor(C.gris).text(s, x + 5, y + 3, { lineBreak: false });
}

function etiqueta(doc, s, xDer, y) {
  doc.font('sans-m').fontSize(6.5);
  const w = doc.widthOfString(s.toUpperCase(), { characterSpacing: 0.6 }) + 12;
  doc.rect(xDer - w, y, w, 13).fill(C.rose);
  doc.fillColor(C.white).text(s.toUpperCase(), xDer - w + 6, y + 3.2, { characterSpacing: 0.6, lineBreak: false });
}

/* Línea de órdenes */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--salida');
  const salida = i > 0 ? path.resolve(process.argv[i + 1]) : undefined;
  const t0 = Date.now();
  generar({ salida }).then(r => {
    console.log(`Catálogo PDF: ${r.paginas} páginas, ${r.tarjetas} tarjetas (${r.piezas} piezas), `
      + `${(r.pdf / 1e6).toFixed(2)} MB, en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }).catch(e => { console.error('Catálogo PDF: NO se generó —', e.message); process.exit(1); });
}
