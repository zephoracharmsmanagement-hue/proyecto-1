const { chromium } = require('playwright');
const BASE = process.env.URL || 'http://localhost:8899';
const U = BASE + '/index.html';
const ok = (c, t) => console.log((c ? '  ✓ ' : '  ✗ FALLA ') + t);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(U, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.body.classList.contains('con-stock'), null, { timeout: 5000 });

  // ---- 1 · calculadora, con las reglas del negocio ----
  console.log('1 · Calculadora de talla');
  const calc = async v => {
    await p.fill('#muneca', String(v));
    await p.waitForTimeout(280);
    return p.$$eval('#calc-out .tfila', els => els.map(e => ({
      t: e.querySelector('.tfila-t').textContent.replace(/\s*cm/, '').trim(),
      v: e.querySelector('.tfila-v').textContent.split('·')[0].trim(),
      c: (e.querySelector('.tfila-v').textContent.split('·')[1] || '').trim(),
      best: e.classList.contains('tfila--best'),
    })));
  };
  let r = await calc(18);
  const de = t => r.find(x => x.t === t);
  console.log('    muñeca 18 →', r.map(x => `${x.t}:${x.v}`).join('  '));
  ok(de('21').v === 'Holgada', '21 (margen 3) → holgada');
  ok(de('20').v === 'La recomendada' && de('20').best, '20 (margen 2) → recomendada y destacada');
  ok(de('20').c.includes('15 a 20'), '20 → 15 a 20 charms');
  ok(de('19').v === 'Capacidad reducida' && de('19').c.includes('5 a 8'), '19 (margen 1) → reducida, 5 a 8');
  ok(de('18').v === 'No recomendable', '18 (margen 0) → no recomendable');
  ok(de('17').v === 'No recomendable', '17 (margen −1) → no recomendable');

  r = await calc(16.5);
  console.log('    muñeca 16,5 →', r.map(x => `${x.t}:${x.v}`).join('  '));
  ok(de('18').v === 'Capacidad reducida', '16,5 → talla 18 (margen 1,5) = reducida');
  ok(de('19').v === 'La recomendada' && de('19').best, '16,5 → talla 19 (margen 2,5) = recomendada');
  ok(de('20').v === 'Holgada', '16,5 → talla 20 (margen 3,5) = holgada');

  // ---- 2 · ficha de producto por familia ----
  console.log('2 · Ficha de producto');
  const ficha = async id => {
    await p.evaluate(i => document.querySelector(`.pc[data-id="${i}"] .pc-img`).click(), id);
    await p.waitForTimeout(250);
    const d = await p.evaluate(() => ({
      abierta: !document.getElementById('ficha').hidden,
      tipo: document.getElementById('fx-tipo').textContent,
      n: document.getElementById('fx-n').textContent,
      est: document.getElementById('fx-est').textContent,
      specs: [...document.querySelectorAll('#fx-specs div')].map(x => x.querySelector('dt').textContent + ': ' + x.querySelector('dd').textContent),
    }));
    await p.keyboard.press('Escape');
    await p.waitForTimeout(150);
    return d;
  };
  for (const [id, esperado] of [['mickey-mouse', '8 – 10 mm'], ['angel-guardian', '4 – 6 mm en el aro'],
  ['bola-rosa-con-flores', '9 – 11 mm'], ['clip-mariposas-de-colores', '4 – 6 mm'],
  ['cadena-seguridad-luna-y-sol', '4 – 5 mm por aro']]) {
    const d = await ficha(id);
    const ocupa = d.specs.find(s => s.startsWith('Ocupa')) || '';
    ok(d.abierta && ocupa.includes(esperado), `${id} → ${d.tipo} · ${ocupa.replace('Ocupa en la pulsera: ', 'ocupa ')}`);
    ok(d.specs.some(s => s.includes('Plata Esterlina 925')), `${id} declara Plata 925`);
    ok(d.specs.some(s => s.includes('níquel')), `${id} declara libre de níquel`);
  }
  const cerrada = await p.evaluate(() => document.getElementById('ficha').hidden);
  ok(cerrada, 'Escape cierra la ficha');

  // ficha de brazalete
  const fb = await ficha('pulsera-corazon-liso');
  ok(fb.tipo === 'Brazalete' && fb.specs.some(s => s.includes('latón')), 'brazalete declara latón con baño, no plata 925');
  ok(fb.est.includes('17, 18, 19, 20'), 'brazalete muestra sus tallas disponibles: ' + fb.est);

  // ---- 3 · buscador ----
  console.log('3 · Buscador');
  await p.click('#more-btn');
  await p.waitForTimeout(200);
  /* Cuántas tarjetas hay sin buscar nada. Se mide en vez de clavarla: el
     catálogo cambia —el día que se retiraron tres duplicados esta prueba se
     puso roja con la página en lo cierto— y lo que hay que comprobar no es un
     número, sino que al limpiar la búsqueda vuelvan TODAS. */
  const visibles = () => p.evaluate(
    () => document.querySelectorAll('#resto-grid .pc:not([hidden])').length);
  const base = await visibles();
  ok(base > 0, `el catálogo abre con ${base} tarjetas visibles`);

  const buscar = async q => {
    await p.fill('#q', q);
    await p.waitForTimeout(320);
    return p.evaluate(() => ({
      n: document.querySelectorAll('#resto-grid .pc:not([hidden])').length,
      cuenta: document.getElementById('count').textContent,
      vacio: !!document.getElementById('sin-res'),
    }));
  };
  let s = await buscar('angel');
  ok(s.n > 0, `"angel" encuentra sin tilde lo que se llama "Ángel" → ${s.cuenta}`);
  s = await buscar('medicina');
  ok(s.n === 1, `"medicina" → ${s.n} resultado`);
  s = await buscar('xyzq');
  ok(s.n === 0 && s.vacio, 'sin resultados muestra el aviso, no una grilla en blanco');
  await p.click('#q-x');
  await p.waitForTimeout(250);
  s = await p.evaluate(() => ({ n: document.querySelectorAll('#resto-grid .pc:not([hidden])').length, v: document.getElementById('q').value }));
  ok(s.v === '' && s.n === base,
    `la X limpia la búsqueda y vuelven las ${base} tarjetas` +
    (s.n === base ? '' : ` — volvieron ${s.n}`));

  // buscador + categoría + solo disponibles
  await p.click('#filters .fbtn[data-f="Disney"]');
  await p.fill('#q', 'stitch');
  await p.waitForTimeout(320);
  const comb = await p.evaluate(() => ({ n: document.querySelectorAll('#resto-grid .pc:not([hidden])').length, c: document.getElementById('count').textContent }));
  ok(comb.n > 0, `Disney + "stitch" → ${comb.c}`);
  await p.click('#solo-disp');
  await p.waitForTimeout(300);
  const comb2 = await p.evaluate(() => [...document.querySelectorAll('#resto-grid .pc:not([hidden])')].filter(x => x.classList.contains('is-out')).length);
  ok(comb2 === 0, 'sumando "solo disponibles" no queda ningún agotado');

  console.log('errores JS: ' + (errs.length ? errs.join(' | ') : 'ninguno ✓'));
  await b.close();
})();
