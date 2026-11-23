'use strict';
/* Banner de Black Friday de la portada (#bfb, 2026-11-23).
 *
 * Dos caras que se turnan cada 6 s: el video con los descuentos y «BLACK
 * FRIDAY» con el video dentro de las letras y la promo. Lo que se vigila:
 *
 *   · Que diga lo que la tienda cobra: los porcentajes y la fecha son los de
 *     OFERTA en tienda.js, no números escritos a mano que se queden viejos.
 *   · Que se quite solo al vencer y vuelva el banner de siempre, sin dejar la
 *     portada sin encabezado.
 *   · Que el botón quede a la vista en el primer pantallazo, en celular y en
 *     computador, y nada se desborde.
 *   · Que el video no frene la carga: no viaja con la página, se pide uno
 *     solo, y a quien pidió «reducir movimiento» no se le pide ni se le mueve.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const BASE = process.env.URL || 'http://localhost:8899';

let fallos = 0;
const comprobar = (c, m, d) => {
  if (!c) fallos++;
  console.log(`  ${c ? '✓' : '✗ FALLA'} ${m}${d !== undefined && d !== '' ? ' — ' + d : ''}`);
};

(async () => {
  const js = fs.readFileSync(path.join(RAIZ, 'tienda.js'), 'utf8');
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const m = /const OFERTA=(\{[^}]*\}|null);/.exec(js);
  const OFERTA = m && m[1] !== 'null' ? Function('return ' + m[1])() : null;
  const hay = /id="bfb"/.test(html);

  console.log('\n1 · El banner y la oferta dicen lo mismo');
  if (!OFERTA) {
    comprobar(!hay, 'sin OFERTA en tienda.js no queda banner de Black Friday en index.html');
    console.log(fallos ? `\n${fallos} fallo(s)` : '\nBanner de Black Friday en verde ✓');
    process.exit(fallos ? 1 : 0);
  }
  comprobar(hay, 'index.html trae el banner #bfb');
  const hasta = (/id="bfb" data-hasta="([^"]+)"/.exec(html) || [])[1];
  comprobar(hasta === OFERTA.hasta, 'su fecha (`data-hasta`) es la de OFERTA en tienda.js', `${hasta} / ${OFERTA.hasta}`);
  const cinta = (/class="bfb-cinta"[^>]*><span>([^<]+)</.exec(html) || [])[1] || '';
  comprobar(cinta.includes(`−${OFERTA.charms} % charms`) && cinta.includes(`−${OFERTA.brazaletes} % brazaletes`)
    && cinta.includes('hasta el ' + (+OFERTA.hasta.slice(8)) + ' de'), 'la cinta dice los mismos porcentajes y el mismo día', cinta);
  comprobar(!/\bantes\b|precio anterior/i.test((/<section class="bfb"[\s\S]*?<\/section>/.exec(html) || [''])[0]),
    'no dice «antes» ni «precio anterior»');
  for (const f of ['bf-portada-celular.webp', 'bf-portada-escritorio.webp'])
    comprobar(fs.existsSync(path.join(RAIZ, 'assets', f)), `existe la portada assets/${f}`);
  comprobar(/media\/bf-portada-'\+\(.*\)\+'-v1\.mp4/.test(js) && /<\/section>\s*<script>[^\n]*media\/bf-portada-'\+\(.*\)\+'-v1\.mp4/.test(html),
    'el video sale de /media/ y lo arranca el guion pegado al banner, sin esperar a que cargue toda la página');

  const b = await chromium.launch(process.env.CHROME_EXE ? { executablePath: process.env.CHROME_EXE } : {});
  const nueva = async (w, h, extra) => {
    const ctx = await b.newContext(Object.assign({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500 }, extra || {}));
    await ctx.route(/facebook\.(com|net)|clarity\.ms|google-analytics|googletagmanager/, r => r.abort());
    const p = await ctx.newPage(); p.errs = []; p.videos = [];
    p.on('pageerror', e => p.errs.push(e.message));
    p.on('request', r => { if (/\/media\/bf-portada/.test(r.url())) p.videos.push(r.url().replace(/^.*\/media\//, '')); });
    return p;
  };
  const estado = p => p.evaluate(() => {
    const s = document.getElementById('bfb'), hb = document.querySelector('.hbanner');
    if (!s) return { hay: false, hb: hb && getComputedStyle(hb).display };
    const r = s.getBoundingClientRect(), dock = document.getElementById('dock').getBoundingClientRect().top;
    const on = s.querySelector('.bfb-cara.is-on'), btn = on.querySelector('.bfb-btn').getBoundingClientRect(), cinta = on.querySelector('.bfb-cinta');
    return { hay: true, hb: getComputedStyle(hb).display, cara: on.classList.contains('bfb-a') ? 'A' : 'C', inertes: s.querySelectorAll('.bfb-cara[inert]').length,
      arriba: r.top >= 0 && r.top < 200, boton: btn.top > r.top && btn.bottom <= Math.min(dock, r.bottom) && (!cinta || btn.bottom <= cinta.getBoundingClientRect().top),
      desborda: document.documentElement.scrollWidth > innerWidth, tx: on.innerText.replace(/\s+/g, ' '),
      cuenta: s.querySelector('.bfb-cara.is-on [data-bfb-cuenta]').textContent, fotos: s.querySelectorAll('[data-bfb-fotos] img').length,
      etiquetas: [...s.querySelectorAll('[data-bfb-fotos] em')].map(e => e.textContent).join(','), href: on.querySelector('.bfb-btn').getAttribute('href'),
      pulsado: [...s.querySelectorAll('.bfb-pts button')].map(x => x.getAttribute('aria-pressed')).join(',') };
  });

  for (const [w, h, nombre] of [[375, 812, 'celular'], [1366, 768, 'computador']]) {
    console.log(`\n2 · En ${nombre} (${w} px)`);
    const p = await nueva(w, h);
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    const a = await estado(p);
    comprobar(a.hay && a.hb === 'none' && a.arriba, 'el banner está arriba y el de siempre no se pinta', JSON.stringify([a.hay, a.hb]));
    comprobar(a.cara === 'A' && a.tx.includes(`−${OFERTA.charms} % en charms`) && a.tx.includes(`−${OFERTA.brazaletes} % en brazaletes`)
      && /paga 3 y llévate 1 gratis/.test(a.tx) && /paga 4 y llévate 2/.test(a.tx), 'la primera cara dice los dos descuentos y la promo', a.tx);
    comprobar(/hasta el lunes 30 de noviembre/i.test(a.tx) === (OFERTA.hasta === '2026-11-30') && /hasta el \w+ \d+ de \w+/i.test(a.tx), 'y la fecha de cierre, escrita desde OFERTA', a.tx);
    comprobar(/^(\d+ d )?\d\d h \d\d min$/.test(a.cuenta), 'la cuenta regresiva corre', a.cuenta);
    comprobar(a.boton && !a.desborda && a.href === '#charms', 'el botón «Ver las ofertas» queda a la vista sobre la barra, sin desbordes');
    /* El turno arranca cuando el video corre, o a los 2,5 s si no corre (este
       navegador no reproduce MP4): la segunda cara llega entre 6 y 9 s. */
    await p.waitForTimeout(3500);
    comprobar((await estado(p)).cara === 'A', 'a los 5 s sigue en la primera cara');
    await p.waitForFunction(() => document.querySelector('#bfb .bfb-c.is-on'), null, { timeout: 6000 }).catch(() => {});
    await p.waitForTimeout(900);
    const c = await estado(p);
    comprobar(c.cara === 'C' && c.inertes === 1 && c.pulsado === 'false,true', 'a los 6 s pasa sola a la segunda cara', JSON.stringify([c.cara, c.pulsado]));
    comprobar(/Paga 3, llévate 1 gratis/.test(c.tx) && /Paga 4, llévate 2/.test(c.tx) && /BLACK\s+FRIDAY/i.test(c.tx), 'que dice BLACK FRIDAY y la promo de piezas gratis', c.tx);
    comprobar(c.fotos === 3 && c.etiquetas === Array(3).fill(`−${OFERTA.charms} %`).join(','), 'con tres charms de la tienda y su descuento', c.etiquetas);
    comprobar(c.boton && !c.desborda && c.href === '#promo', 'y su botón «Armar la mía» a la vista, sin tapar la cinta');
    await p.evaluate(() => document.querySelector('.bfb-pts button').click());
    await p.waitForTimeout(300);
    comprobar((await estado(p)).cara === 'A', 'las rayitas dejan volver a la primera a mano');
    const unicos = [...new Set(p.videos)];
    comprobar(unicos.length === 1 && unicos[0] === `bf-portada-${w < 760 ? 'celular' : 'escritorio'}-v1.mp4`, 'pide un solo video, el de su tamaño de pantalla', unicos.join(','));
    comprobar(!p.errs.length, 'consola limpia', p.errs.join(' | ') || undefined);
    await p.context().close();
  }

  console.log('\n3 · Con «reducir movimiento»');
  {
    const p = await nueva(375, 812, { reducedMotion: 'reduce' });
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(9500);
    const a = await estado(p);
    comprobar(a.cara === 'A' && !p.videos.length, 'se queda en la primera cara y no pide el video', JSON.stringify([a.cara, p.videos]));
    comprobar(!p.errs.length, 'consola limpia', p.errs.join(' | ') || undefined);
    await p.context().close();
  }

  console.log('\n4 · Al vencer la oferta');
  {
    const p = await nueva(375, 812);
    const salto = Date.parse(OFERTA.hasta + 'T23:59:59-05:00') - Date.now() + 60000;
    await p.addInitScript(s => { const D = Date.now.bind(Date); Date.now = () => D() + s; }, salto);
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    const a = await estado(p);
    comprobar(!a.hay && a.hb !== 'none' && !p.videos.length, 'el banner se quita solo, vuelve el de siempre y no se pide el video', JSON.stringify(a));
    const foto = await p.evaluate(() => { const i = document.querySelector('.hbanner-img'); return i.complete && i.naturalWidth > 0; });
    comprobar(foto, 'y la foto del banner de siempre carga');
    comprobar(!p.errs.length, 'consola limpia', p.errs.join(' | ') || undefined);
    await p.context().close();
  }

  await b.close();
  console.log(fallos ? `\n${fallos} fallo(s)` : '\nBanner de Black Friday en verde ✓');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
