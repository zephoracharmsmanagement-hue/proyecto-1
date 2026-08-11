const { chromium } = require('playwright');
const BASE = process.env.URL || 'http://localhost:8899';
const U = BASE + '/index.html';

(async () => {
  const b = await chromium.launch();
  const out = [];

  // ---- 1. Hero sobre el pliegue en iPhone ----
  for (const [w, h, etiqueta] of [[390, 844, 'iPhone 390x844'], [360, 800, 'Android 360x800'], [430, 932, 'iPhone Max 430x932']]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
    const h1 = await p.locator('h1').first().boundingBox();
    const cta = await p.locator('a.btn--wa').first().boundingBox();
    const ann = await p.locator('.ann').first().boundingBox();
    // ¿se corta algún aviso?
    const cortes = await p.$$eval('.ann-slide', (els) =>
      els.map(e => ({ alto: Math.round(e.scrollHeight), caja: Math.round(e.getBoundingClientRect().height) }))
    );
    const annCorta = cortes.some(c => c.alto > c.caja + 1);
    out.push(`${etiqueta}\n  h1 en y=${Math.round(h1.y)}  (pliegue ${h})  ${h1.y + h1.height < h ? 'VISIBLE' : 'FUERA'}` +
      `\n  CTA WhatsApp en y=${Math.round(cta.y)}  ${cta.y + cta.height < h ? 'VISIBLE' : 'FUERA'}` +
      `\n  barra avisos alto=${Math.round(ann.height)}px  ${annCorta ? 'SE CORTA ✗' : 'sin cortes ✓'}`);
    await p.close();
  }

  // ---- 2. Bug de filtros + conteo ----
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errores = [];
  p.on('pageerror', e => errores.push(e.message));
  await p.goto(BASE + '/index.html', { waitUntil: 'networkidle' });

  await p.click('#more-btn');
  await p.click('#filters .fbtn[data-f="Disney"]');
  await p.waitForTimeout(200);
  const bActivos = await p.locator('#b-filters .fbtn.is-on').count();
  const fActivos = await p.locator('#filters .fbtn.is-on').count();
  const texto = await p.locator('#count').textContent();
  const visiblesDisney = await p.locator('#resto-grid .pc:not([hidden])').count();
  out.push(`\nFiltro "Disney"\n  botones activos en #b-filters: ${bActivos} (debe ser 1)` +
    `\n  botones activos en #filters: ${fActivos} (debe ser 1)` +
    `\n  contador dice: "${texto}"  (en pantalla: ${visiblesDisney} en grilla + 2 destacados = ${visiblesDisney + 2})`);

  // ---- 3. Botón catálogo completo ----
  await p.click('#filters .fbtn[data-f="todos"]');
  const revelados = await p.locator('#full-cat .pc').count();
  const destacados = await p.locator('#rail-top .pc').count();
  const rotulo = await p.locator('#more-btn').textContent();
  out.push(`\nCatálogo\n  destacados en carrusel: ${destacados}\n  revelados por el botón: ${revelados}` +
    `\n  total: ${destacados + revelados}\n  rótulo del botón cerrado: "Ver el catálogo completo · 86 charms"`);

  // ---- 4. Categorías ----
  await p.click('.cat[data-cat="Marvel"]');
  await p.waitForTimeout(400);
  const marvelOn = await p.locator('#filters .fbtn[data-f="Marvel"].is-on').count();
  const cuentaMarvel = await p.locator('#count').textContent();
  out.push(`\nTarjeta de categoría "Marvel"\n  filtro aplicado: ${marvelOn === 1 ? 'sí ✓' : 'NO ✗'}\n  contador: "${cuentaMarvel}"`);

  // ---- 5. Eventos del pixel en clic a WhatsApp ----
  await p.evaluate(() => { window.__ev = []; window.fbq = (a, b, c) => window.__ev.push([a, b, c]); });
  await p.evaluate(() => {
    const a = document.querySelector('a.btn--wa[data-wa="hero"]');
    a.addEventListener('click', e => e.preventDefault(), true);
    a.click();
  });
  const ev = await p.evaluate(() => window.__ev);
  out.push(`\nPixel al tocar WhatsApp: ${JSON.stringify(ev)}`);

  // ---- 6. Desbordamiento horizontal ----
  for (const w of [360, 390, 430, 768, 1280]) {
    await p.setViewportSize({ width: w, height: 900 });
    await p.waitForTimeout(120);
    const des = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    out.push(`  scroll horizontal a ${w}px: ${des <= 0 ? 'no ✓' : des + 'px ✗'}`);
  }

  out.push(`\nErrores JS: ${errores.length ? errores.join(' | ') : 'ninguno ✓'}`);
  console.log(out.join('\n'));
  await b.close();
})();
