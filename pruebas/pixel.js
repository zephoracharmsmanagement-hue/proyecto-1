// Qué le cuenta el sitio al píxel de Meta, recorriendo una compra de verdad.
//
// Se reemplaza fbq por una grabadora ANTES de que cargue la página: el snippet
// de Meta se retira solo si fbq ya existe, así que no sale nada a Meta y cada
// llamada queda anotada, también a través de la navegación al checkout.
//
// Lo que vigila, porque ninguna otra batería lo ve y un fallo aquí no da error:
//   · tocar una joya de la portada lleva a su página, que manda ViewContent
//     de producto con el id de catalogo.json, una sola vez (no al abrir su
//     galería ni al repintarse tras agregar);
//   · AddToCart lleva el mismo id y su precio;
//   · InitiateCheckout sale UNA sola vez por checkout —antes salía dos, desde
//     tienda.js y desde checkout.html, con eventID distintos— y lleva los ids
//     del carrito con cantidades.
const { chromium } = require('playwright');
const BASE = process.env.URL || 'http://localhost:8899';
const ok = (c, t) => console.log((c ? '  ✓ ' : '  ✗ FALLA ') + t);

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const ev = [];
  await ctx.exposeBinding('__rec', (_, a) => ev.push(a));
  await ctx.addInitScript(() => {
    window.fbq = (...a) => window.__rec({ pagina: location.pathname, a: JSON.parse(JSON.stringify(a)) });
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.body.classList.contains('con-stock'), null, { timeout: 5000 });
  const cat = await p.evaluate(() => fetch('assets/catalogo.json').then(r => r.json()));
  const de = (nombre, pag) => ev.filter(e => e.a[0] === 'track' && e.a[1] === nombre && (!pag || e.pagina.endsWith(pag)));

  console.log('1 · Portada');
  const inits = ev.filter(e => e.a[0] === 'init').map(e => e.a[1]);
  ok(inits.includes('2130673404542988') && inits.includes('1029982529813994'),
    `los dos píxeles inicializados (${inits.join(', ')})`);
  const vcG = de('ViewContent');
  ok(vcG.length === 1 && vcG[0].a[2].content_type === 'product_group',
    `un ViewContent de grupo al cargar (${vcG.length})`);

  // Desde el 2026-09-26 tocar la joya lleva a su página, y es la página la que
  // cuenta la vista.
  console.log('2 · Página de la pieza');
  const id = await p.evaluate(() => {
    const libre = [...document.querySelectorAll('#charms .pc[data-id] [data-add]')]
      .find(x => x.getAttribute('aria-disabled') !== 'true');
    return libre && libre.dataset.add;
  });
  ok(!!id, `charm con unidades para la prueba: ${id}`);
  await Promise.all([p.waitForURL(u => u.pathname.endsWith(`/producto-${id}.html`)),
    p.evaluate(i => document.querySelector(`.pc[data-id="${i}"] .pc-img`).click(), id)]);
  await p.waitForLoadState('networkidle');
  let vc = de('ViewContent', `/producto-${id}.html`);
  const d = vc[0] && vc[0].a[2];
  ok(vc.length === 1 && d.content_type === 'product' && d.content_ids.length === 1 && d.content_ids[0] === id,
    `tocar la joya lleva a su página y manda ViewContent de producto con content_ids [${id}]`);
  ok(d && d.value === cat.precios[id] && d.currency === 'COP',
    `con su precio de catalogo.json (${d && d.value} = ${cat.precios[id]}) en COP`);
  ok(vc[0] && vc[0].a[3] && /^zc-/.test(vc[0].a[3].eventID), 'y con eventID de zcEvId');

  await p.evaluate(() => document.querySelector('.pc--pp .pc-img').click());
  await p.waitForTimeout(250);
  ok(de('ViewContent', `/producto-${id}.html`).length === 1, 'abrir la galería de su propia página NO cuenta otra vista');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  await p.click(`.pp-cta [data-add="${id}"]`);
  await p.waitForTimeout(250);
  const atc = de('AddToCart');
  ok(atc.length === 1 && atc[0].a[2].content_type === 'product' && atc[0].a[2].content_ids[0] === id
    && atc[0].a[2].value === cat.precios[id], `agregar desde la página manda AddToCart [${id}] a ${cat.precios[id]}`);
  ok(de('ViewContent', `/producto-${id}.html`).length === 1, 'repintar tras agregar NO cuenta otra vista');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);

  console.log('3 · Checkout');
  await Promise.all([p.waitForURL(/checkout\.html/), p.evaluate(() => document.getElementById('send').click())]);
  await p.waitForFunction(() => document.querySelector('#cargando') === null || document.querySelector('#cargando').hidden
    || getComputedStyle(document.querySelector('#cargando')).display === 'none', null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(600);
  const ic = de('InitiateCheckout');
  ok(ic.length === 1, `InitiateCheckout sale una sola vez (${ic.length}: ${ic.map(e => e.pagina).join(', ')})`);
  const c = ic[0] && ic[0].a[2];
  ok(c && ic[0].pagina.endsWith('checkout.html'), 'y lo manda checkout.html, no la tienda al tocar pagar');
  ok(c && c.content_type === 'product' && JSON.stringify(c.content_ids) === JSON.stringify([id]),
    `con content_ids del carrito (${c && JSON.stringify(c.content_ids)})`);
  ok(c && JSON.stringify(c.contents) === JSON.stringify([{ id, quantity: 1 }]), 'y contents con cantidades');
  ok(c && c.value > 0 && c.num_items === 1, `value ${c && c.value}, num_items ${c && c.num_items}`);
  ok(ic[0] && ic[0].a[3] && /^zc-/.test(ic[0].a[3].eventID), 'con eventID');
  const initsCk = ev.filter(e => e.a[0] === 'init' && e.pagina.endsWith('checkout.html')).length;
  ok(initsCk === 2, `checkout inicializa los dos píxeles (${initsCk})`);

  console.log('errores JS: ' + (errs.length ? errs.join(' | ') : 'ninguno ✓'));
  if (errs.length) console.log('  ✗ FALLA hubo errores de JavaScript');
  await b.close();
})();
