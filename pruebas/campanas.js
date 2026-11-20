'use strict';
/* Conversión, 2026-11-20: lo que salió de Clarity y las páginas de campaña.
 *
 * Lo que vio el propietario en 109 sesiones de clientas, casi todas desde la
 * app de Instagram o Facebook en celular: clics que no hacían nada, «COMPRAR»
 * tocado con la selección en $0 (en kits.html no pasaba nada), «Brazalete solo
 * $78.000» tocado en Marvel sin respuesta, y quien llegaba del anuncio de
 * Marvel se perdía antes de ver las piezas.
 *
 * Esta batería exige que nada de eso vuelva:
 *
 *   1. La página de campaña sale de assets/campanas.json, solo con el tema, y
 *      con las piezas del anuncio primero.
 *   2. Los kits pautados (kits.json, pagina.campana) van en modo campaña.
 *   3. Los escalones del combo se pueden tocar.
 *   4. En el navegador, a 375 px: las 5 del anuncio caben en el primer
 *      pantallazo; la foto abre la ficha ahí mismo; «Agregar» agrega; y el
 *      botón de la barra con la selección vacía no queda muerto en NINGUNA
 *      página.
 */
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const BASE = process.env.URL || 'http://localhost:8899';
const leer = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

const CAT = JSON.parse(leer('assets/catalogo.json'));
const CAMPANAS = JSON.parse(leer('assets/campanas.json')).campanas;
const KITS = JSON.parse(leer('assets/kits.json')).kits;
const idsEn = (h, desde, hasta) => {
  const a = h.indexOf(desde), b = hasta ? h.indexOf(hasta, a) : h.length;
  return [...h.slice(a, b).matchAll(/<article class="pc[^"]*" data-id="([^"]+)"/g)].map(m => m[1]);
};
/* Enlaces que sacan del tema: otras categorías, otros kits, la portada, el
   catálogo. Los de cada pieza (producto-*.html) se toleran en el HTML porque
   tienda.js los convierte en la ficha, pero solo si son del tema. */
const salidas = (h, tema) => [...h.matchAll(/href="([^"#][^"]*)"/g)].map(m => m[1])
  .filter(u => !/^https?:\/\/(wa\.me|zephoracharms\.com|fonts\.)/.test(u))
  .filter(u => !/^(envios-y-devoluciones|politica-de-privacidad|terminos-y-condiciones|politica-de-cookies|preguntas-frecuentes)\.html/.test(u))
  .filter(u => !/^(tienda\.css|data:|mailto:|tel:|checkout\.html|https:\/\/instagram\.com\/zephora_charms)/.test(u))
  .filter(u => { const m = u.match(/^producto-(.+)\.html/); return !(m && tema.has(m[1])); })
  .filter(u => !/^assets\//.test(u));

async function main() {
  console.log('\n1 · Páginas de campaña (assets/campanas.json)');
  for (const c of CAMPANAS) {
    const archivo = path.join(RAIZ, c.archivo);
    comprobar(fs.existsSync(archivo), `existe ${c.archivo}`);
    if (!fs.existsSync(archivo)) continue;
    const h = leer(c.archivo);
    const tema = new Set(Object.entries(CAT.grupos).filter(([, g]) => g === c.grupo).map(([id]) => id).concat(c.base));
    const dest = idsEn(h, 'id="destacadas"', '</section>');
    comprobar(JSON.stringify(dest) === JSON.stringify(c.destacados),
      'las del anuncio van primero, en el orden de la configuración', dest.join(', '));
    const todas = idsEn(h, 'id="destacadas"', '<section class="talla-sec"');
    const fuera = todas.filter(id => !tema.has(id));
    comprobar(fuera.length === 0, `solo ${c.grupo}: ninguna pieza de otro tema`, fuera.join(', ') || undefined);
    const delTema = [...tema].filter(id => id !== c.base);
    const faltan = delTema.filter(id => !todas.includes(id));
    comprobar(faltan.length === 0, `y todo ${c.grupo} está (${delTema.length} piezas + el brazalete)`, faltan.join(', ') || undefined);
    comprobar(/<body class="pag-campana"[^>]*data-vacio="#destacadas"/.test(h),
      'sin menú (body.pag-campana) y la barra vacía lleva a las destacadas');
    const sal = salidas(h, tema);
    comprobar(sal.length === 0, 'ningún enlace saca del tema', [...new Set(sal)].slice(0, 6).join(', ') || undefined);
    comprobar(/class="cp-wa"[^>]*data-wa-evento="Contact"/.test(h) && /id="year"/.test(h),
      'se quedan WhatsApp (con su evento) y el pie con #year, que exige tienda.js');
    comprobar(/data-agotadas-final/.test(h), 'las agotadas bajan al final (data-agotadas-final)');
    comprobar(/data-elegir-base="[^"]+"/.test(h) && (h.match(/data-ir="#piezas"/g) || []).length >= 2,
      'el combo se puede tocar: brazalete y charms');
  }

  console.log('\n2 · Kits pautados en modo campaña (kits.json · pagina.campana)');
  for (const k of KITS) {
    const h = leer('kit-' + k.id + '.html');
    const camp = !!(k.pagina && k.pagina.campana);
    if (!camp) {
      comprobar(!/pag-campana/.test(h) && /kp-pop/.test(h), `kit-${k.id}: no pautado, se queda como estaba`);
      continue;
    }
    comprobar(/<body class="pag-campana"/.test(h) && !/kp-pop/.test(h) && !/class="col-resto/.test(h),
      `kit-${k.id}: sin menú, sin «Colecciones populares» ni «catálogo completo»`);
    comprobar(/data-vit-solo="1"/.test(h), `kit-${k.id}: la vitrina sin pestañas de otras colecciones`);
    const rel = k.pagina.relacionadas || {};
    const esperadas = (rel.grupo ? Object.keys(CAT.grupos).filter(id => CAT.grupos[id] === rel.grupo) : rel.ids || [])
      .filter(id => id !== k.base && !k.charms.includes(id));
    const vistas = idsEn(h, 'id="relacionadas"', '</section>');
    comprobar(JSON.stringify(vistas.slice().sort()) === JSON.stringify(esperadas.slice().sort()),
      `kit-${k.id}: luego solo sus relacionadas (${esperadas.length})`, vistas.length + ' en la página');
    const tema = new Set([k.base, ...k.charms, ...esperadas]);
    const sal = salidas(h, tema);
    comprobar(sal.length === 0, `kit-${k.id}: ningún enlace saca del tema`, [...new Set(sal)].slice(0, 6).join(', ') || undefined);
  }

  console.log('\n3 · El combo de las colecciones se puede tocar');
  for (const f of ['coleccion-marvel.html', 'coleccion-simbolos.html']) {
    const h = leer(f);
    const pasos = (h.match(/class="col-paso(?: col-paso--best)?"/g) || []).length;
    const botones = (h.match(/<button type="button" class="col-paso[^"]*" data-(elegir-base|ir)=/g) || []).length;
    comprobar(pasos === 3 && botones === 3, `${f}: los 3 escalones son botones que llevan a algo`, `${botones}/${pasos}`);
  }
  const gen = leer('herramientas/gen_colecciones.py');
  comprobar(/def escalones\(/.test(gen) && !/<div class="col-paso/.test(gen), 'y el generador ya no escribe escalones muertos');

  console.log('\n4 · En el navegador, a 375 px');
  const { chromium } = require('playwright');
  const b = await chromium.launch();
  try {
    const nueva = async () => {
      const p = await b.newPage({ viewport: { width: 375, height: 812 } });
      p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
      return p;
    };
    const c = CAMPANAS[0];
    let p = await nueva();
    await p.goto(BASE + '/' + c.archivo, { waitUntil: 'load' });
    await p.waitForTimeout(800);
    const caben = await p.evaluate(() => {
      const dock = document.getElementById('dock').getBoundingClientRect().top;
      return [...document.querySelectorAll('#destacadas .pc')].map(el => {
        const r = el.getBoundingClientRect(), add = el.querySelector('.pc-add').getBoundingClientRect();
        return r.top >= 0 && add.bottom <= dock;
      });
    });
    comprobar(caben.length === c.destacados.length && caben.every(Boolean),
      `las ${c.destacados.length} del anuncio caben en el primer pantallazo, con su botón`, caben.map(x => x ? '✓' : '✗').join(''));
    const menu = await p.evaluate(() => ['.tnav', '.top-lupa', '.top-menu'].map(s => {
      const el = document.querySelector(s); return el ? getComputedStyle(el).display : 'none'; }));
    comprobar(menu.every(d => d === 'none'), 'sin menú, buscador ni hamburguesa', menu.join(','));
    comprobar(await p.locator('#dock-send').textContent() === 'Elige tu primera pieza',
      'con la selección vacía la barra dice «Elige tu primera pieza»');
    const url0 = p.url();
    await p.evaluate(() => document.querySelector('#destacadas .pc .pc-img').click());
    await p.waitForTimeout(700);
    comprobar(p.url() === url0 && await p.locator('#ficha').isVisible(), 'la foto abre la ficha ahí mismo, sin salir de la campaña');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    const primera = c.destacados.find(id => true);
    await p.evaluate(id => document.querySelector('#destacadas .pc[data-id="' + id + '"] .pc-add').click(), primera);
    await p.waitForTimeout(400);
    comprobar(await p.locator('#dock-send').textContent() === 'Comprar', '«Agregar» la pone en el carrito y la barra pasa a «Comprar»');
    comprobar(!p.errs.length, 'consola limpia', p.errs.join(' | ') || undefined);
    await p.close();

    /* Una destacada agotada no ocupa el primer pantallazo, aunque esté en la
       lista del anuncio: se muda al final de «Toda la colección». Se simula
       con el conteo en 0 (en vivo lo dice disponibilidad). */
    p = await nueva();
    const agotar = c.destacados[c.destacados.length - 1];
    await p.route('**/assets/stock.json*', async r => {
      const s = JSON.parse(fs.readFileSync(path.join(RAIZ, 'assets', 'stock.json'), 'utf8'));
      s.items[agotar].stock = 0;
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(s) });
    });
    await p.goto(BASE + '/' + c.archivo, { waitUntil: 'load' });
    await p.waitForTimeout(1200);
    const sitio = await p.evaluate(id => ({
      dest: [...document.querySelectorAll('#destacadas .pc')].map(e => e.dataset.id),
      ultima: [...document.querySelectorAll('#piezas .grid > .pc')].map(e => e.dataset.id).pop(),
    }), agotar);
    comprobar(!sitio.dest.includes(agotar) && sitio.dest.length === c.destacados.length - 1 && sitio.ultima === agotar,
      `una destacada agotada (${agotar}) sale del primer pantallazo y va al final de la colección`, JSON.stringify(sitio));
    await p.close();

    /* El escalón «Brazalete solo» pide la talla; «+ 3 charms» lleva a las
       piezas con un aviso. */
    p = await nueva();
    await p.goto(BASE + '/coleccion-marvel.html', { waitUntil: 'load' });
    await p.waitForTimeout(600);
    await p.evaluate(() => document.querySelector('#combo [data-elegir-base]').click());
    await p.waitForTimeout(900);
    comprobar(await p.evaluate(() => { const t = document.querySelector('#brazaletes .tallas');
      if (!t || t.hidden) return false; const r = t.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }),
      'Marvel: «Brazalete solo» abre la talla del brazalete, a la vista');
    await p.evaluate(() => document.querySelectorAll('#combo [data-ir]')[1].click());
    await p.waitForTimeout(900);
    comprobar(await p.evaluate(() => { const r = document.querySelector('#piezas').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })
      && /4 piezas/.test(await p.locator('#aviso-corto').textContent()),
      'Marvel: «+ 3 charms» lleva a las piezas y dice qué hacer');
    await p.close();

    /* Ninguna página con el botón muerto: con la selección vacía, tocarlo
       mueve la página hasta algo que elegir. */
    for (const [pag, sel] of [['index.html', '#brazaletes'], ['coleccion-marvel.html', '#piezas'], ['coleccion-simbolos.html', '#piezas'],
      ['kits.html', '#kits'], ['kit-avengers.html', '#kit-avengers'], ['kit-luz-y-suenos.html', '#kit-luz-y-suenos'],
      ['coleccion-mas-vendidos.html', '.mv'], [c.archivo, '#destacadas']]) {
      p = await nueva();
      await p.goto(BASE + '/' + pag, { waitUntil: 'load' });
      await p.waitForTimeout(600);
      await p.evaluate(() => { scrollTo(0, document.body.scrollHeight); });
      await p.waitForTimeout(300);
      const txt = await p.locator('#dock-send').textContent();
      await p.evaluate(() => document.getElementById('dock-send').click());
      /* El desplazamiento es suave: en una página larga, desde el pie, tarda. */
      await p.waitForTimeout(2200);
      const ve = await p.evaluate(s => { const el = document.querySelector(s); if (!el) return 'no existe ' + s;
        const r = el.getBoundingClientRect(); return r.top < innerHeight * 0.6 && r.bottom > 0 ? '' : 'fuera de vista'; }, sel);
      comprobar(txt === 'Elige tu primera pieza' && !ve && !p.errs.length,
        `${pag}: «Elige tu primera pieza» lleva a ${sel}`, [txt, ve, ...p.errs].filter(Boolean).join(' · ') || undefined);
      await p.close();
    }
  } catch (e) { mal('la parte del navegador reventó', e.message.split('\n')[0]); }
  finally { await b.close(); }

  console.log(fallos ? `\nCampañas: ${fallos} en rojo` : '\nCampañas y conversión en verde ✓');
  if (fallos) process.exitCode = 1;
}

main().catch(e => { console.log('  ✗ FALLA la batería reventó — ' + (e.stack || e.message)); process.exitCode = 1; });
