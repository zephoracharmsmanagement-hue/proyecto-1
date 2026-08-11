const { chromium } = require('playwright');
const BASE = process.env.URL || 'http://localhost:8899';
const U = BASE + '/index.html';
const D = require('path').join(__dirname, 'capturas') + require('path').sep;

(async () => {
  const b = await chromium.launch();

  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await p.screenshot({ path: D + 'm1-hero.png' });
  await p.locator('#categorias').scrollIntoViewIfNeeded();
  await p.waitForTimeout(500);
  await p.screenshot({ path: D + 'm2-categorias.png' });
  await p.locator('#charms').scrollIntoViewIfNeeded();
  await p.waitForTimeout(600);
  await p.screenshot({ path: D + 'm3-carrusel.png' });
  await p.locator('.guar').scrollIntoViewIfNeeded();
  await p.waitForTimeout(500);
  await p.screenshot({ path: D + 'm4-pie.png' });
  await p.close();

  const d = await b.newPage({ viewport: { width: 1280, height: 860 } });
  await d.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await d.screenshot({ path: D + 'd1-hero.png' });
  await d.locator('#categorias').scrollIntoViewIfNeeded();
  await d.waitForTimeout(600);
  await d.screenshot({ path: D + 'd2-categorias.png' });
  await d.locator('#charms').scrollIntoViewIfNeeded();
  await d.waitForTimeout(600);
  await d.screenshot({ path: D + 'd3-carrusel.png' });
  await d.locator('.guar').scrollIntoViewIfNeeded();
  await d.waitForTimeout(600);
  await d.screenshot({ path: D + 'd4-pie.png' });
  await d.goto(BASE + '/preguntas-frecuentes.html', { waitUntil: 'networkidle' });
  await d.screenshot({ path: D + 'd5-faq.png' });
  await d.close();

  await b.close();
  console.log('listo');
})();
