const { chromium } = require('playwright');
const BASE = process.env.URL || 'http://localhost:8899';
const U = BASE + '/index.html';

const ok = (c, t) => console.log((c ? '  ✓ ' : '  ✗ FALLA ') + t);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(U, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.body.classList.contains('con-stock'), null, { timeout: 5000 });
  await p.click('#more-btn');
  await p.waitForTimeout(200);

  const tallasDe = async id => {
    await p.click(`.pc[data-id="${id}"] .pc-add`);
    await p.waitForTimeout(120);
    return p.$$eval(`.pc[data-id="${id}"] .tbtn`,
      els => els.map(e => ({ t: e.dataset.talla, off: e.getAttribute('aria-disabled') === 'true' })));
  };

  console.log('1 · pulsera-corazon-liso: 17,18,19,20 sí — 21 no');
  let t = await tallasDe('pulsera-corazon-liso');
  ok(t.length === 5, 'se muestran las 5 tallas (no se esconden)');
  ok(['17', '18', '19', '20'].every(x => t.find(v => v.t === x && !v.off)), '17/18/19/20 disponibles');
  ok(t.find(v => v.t === '21').off, '21 aparece deshabilitada');

  console.log('2 · pulsera-avengers: solo 20');
  t = await tallasDe('pulsera-avengers');
  ok(t.filter(v => !v.off).map(v => v.t).join() === '20', 'solo la 20 disponible');

  console.log('3 · elsa, walle, cancer, acuario agotados');
  for (const id of ['elsa', 'walle', 'cancer', 'acuario']) {
    const r = await p.evaluate(i => {
      const c = document.querySelector(`.pc[data-id="${i}"]`);
      const b = c.querySelector('.pc-add');
      return { out: c.classList.contains('is-out'), off: b.getAttribute('aria-disabled') === 'true', txt: b.textContent.trim(), enc: !!c.querySelector('.pc-encargo') };
    }, id);
    ok(r.out && r.off && r.txt === 'Agotado' && r.enc, `${id}: agotado, bloqueado y con "pedir por encargo"`);
  }
  const antes = await p.evaluate(() => document.querySelectorAll('#sheet-body .srow').length);
  await p.click('.pc[data-id="elsa"] .pc-add', { force: true });
  await p.waitForTimeout(150);
  const desp = await p.evaluate(() => document.querySelectorAll('#sheet-body .srow').length);
  ok(antes === desp, 'tocar un agotado no lo agrega al carrito');

  console.log('4 · letras: A se agrega, F agotada');
  ok(await p.locator('.lbtn').count() === 27, 'hay 27 iniciales');
  await p.click('.lbtn[data-letra="a"]');
  await p.waitForTimeout(150);
  ok(await p.evaluate(() => [...document.querySelectorAll('#sheet-body .srow-n')].some(e => e.textContent.includes('Letra A'))), 'Letra A entra al carrito');
  ok(await p.evaluate(() => document.querySelector('.lbtn[data-letra="f"]').getAttribute('aria-disabled') === 'true'), 'Letra F sale agotada');

  console.log('5 · descuentos intactos: 30% brazalete, 15% charms');
  await p.evaluate(() => { location.hash = ''; });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.body.classList.contains('con-stock'));
  await p.click('#more-btn');
  await p.click('.pc[data-id="pulsera-corazon-liso"] .pc-add');
  await p.click('.tbtn[data-para="pulsera-corazon-liso"][data-talla="18"]');
  for (const id of ['mickey-mouse', 'ariel', 'hulk']) await p.click(`.pc[data-id="${id}"] .pc-add`);
  await p.waitForTimeout(200);
  const tot = await p.evaluate(() => ({
    b: document.getElementById('v-b').textContent,
    c: document.getElementById('v-c').textContent,
    save: document.getElementById('v-save').textContent,
    total: document.getElementById('v-tot').textContent,
    lb: document.getElementById('l-b').textContent,
  }));
  // brazalete 58.000 → -30% = 17.400 ; charms 85+85+85=255.000 → -15% = 38.250 ; ahorro 55.650
  console.log('   ', JSON.stringify(tot));
  ok(tot.save.replace(/\D/g, '') === '55650', 'ahorro = 17.400 (30% brazalete) + 38.250 (15% charms)');
  ok(tot.total.replace(/\D/g, '') === '257350', 'total 257.350');
  ok(tot.lb.includes('18 cm'), 'el resumen muestra la talla');

  console.log('6 · el mensaje de WhatsApp incluye la talla');
  const msg = await p.evaluate(() => {
    let u = null;
    const o = window.open; window.open = x => { u = x; };
    document.getElementById('send').click();
    window.open = o;
    return decodeURIComponent(u.split('text=')[1]);
  });
  ok(/talla 18 cm/.test(msg), 'aparece "talla 18 cm"');
  console.log('    ' + msg.split('\n').filter(l => l.includes('Brazalete'))[0]);

  console.log('7 · tope por unidades');
  const topeOk = await p.evaluate(() => {
    const c = document.querySelector('.pc[data-id="clip-mariposas-de-colores"]'); // stock 1
    const b = c.querySelector('.pc-add');
    b.click(); b.click(); b.click();
    return { txt: b.textContent.trim(), off: b.getAttribute('aria-disabled') === 'true' };
  });
  ok(topeOk.txt === 'Agregado' && topeOk.off, 'un charm con 1 unidad no se puede agregar dos veces');

  console.log('8 · filtro "solo disponibles"');
  await p.click('#solo-disp');
  await p.waitForTimeout(200);
  const disp = await p.evaluate(() => {
    const vis = [...document.querySelectorAll('#resto-grid .pc:not([hidden])')];
    return { total: vis.length, conAgotado: vis.filter(v => v.classList.contains('is-out')).length, cuenta: document.getElementById('count').textContent };
  });
  ok(disp.conAgotado === 0, 'no queda ningún agotado a la vista');
  console.log('    ' + disp.cuenta);

  console.log('errores de consola: ' + (errs.length ? errs.join(' | ') : 'ninguno ✓'));
  await b.close();
})();
