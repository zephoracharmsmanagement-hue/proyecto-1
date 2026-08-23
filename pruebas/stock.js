const { chromium } = require('playwright');
const path = require('path');
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
  /* El catálogo completo ya nace abierto; este clic lo cerraría. Se deja una
     llamada que garantiza el estado abierto sin depender de cómo empiece. */
  await p.evaluate(() => { const f = document.querySelector('#full-cat');
    if (f && f.hidden) document.querySelector('#more-btn').click(); });
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

  /* Un brazalete con una sola talla con existencias. Se elige del inventario
     —ver _pieza.js—: el que estaba escrito aquí se vendió y esta comprobación
     pasó a fallar con el sitio en lo cierto. */
  const UNA = require('./_pieza').unaSolaTalla();
  console.log(`2 · ${UNA.id}: solo ${UNA.talla}`);
  t = await tallasDe(UNA.id);
  ok(t.filter(v => !v.off).map(v => v.t).join() === UNA.talla,
    `solo la ${UNA.talla} disponible`);

  /* Los agotados salen de stock.json, no de una lista escrita a mano: el día
     que se retiraron tres duplicados del catálogo esta batería reventó porque
     nombraba una pieza que ya no existe. Lo que hay que comprobar es la regla
     —un agotado se muestra en gris, bloqueado y con encargo—, no unos ids. */
  const INV = require(path.join(__dirname, '..', 'assets', 'stock.json')).items;
  const agotados = Object.keys(INV)
    .filter(k => INV[k].stock === 0 && INV[k].tipo === 'charm').slice(0, 4);
  console.log(`3 · ${agotados.join(', ')} agotados`);
  ok(agotados.length > 0, 'hay piezas agotadas en el inventario para comprobar');
  for (const id of agotados) {
    const r = await p.evaluate(i => {
      const c = document.querySelector(`.pc[data-id="${i}"]`);
      const b = c.querySelector('.pc-add');
      return { out: c.classList.contains('is-out'), off: b.getAttribute('aria-disabled') === 'true', txt: b.textContent.trim(), enc: !!c.querySelector('.pc-encargo') };
    }, id);
    ok(r.out && r.off && r.txt === 'Agotado' && r.enc, `${id}: agotado, bloqueado y con "pedir por encargo"`);
  }
  const antes = await p.evaluate(() => document.querySelectorAll('#sheet-body .srow').length);
  await p.click(`.pc[data-id="${agotados[0]}"] .pc-add`, { force: true });
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
  /* Desde que el carrito persiste en localStorage, recargar ya no lo vacía:
     la Letra A del paso 4 volvería y descuadraría los totales de este paso.
     Se limpia explícito, que es lo que hoy significa «empezar de cero». */
  await p.evaluate(() => { location.hash = ''; localStorage.removeItem('zephora.carrito.v1'); });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.body.classList.contains('con-stock'));
  /* El catálogo completo ya nace abierto; este clic lo cerraría. Se deja una
     llamada que garantiza el estado abierto sin depender de cómo empiece. */
  await p.evaluate(() => { const f = document.querySelector('#full-cat');
    if (f && f.hidden) document.querySelector('#more-btn').click(); });
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

  console.log('5b · «Te puede interesar» dentro de la hoja');
  /* La hoja tapa el catálogo entero, así que quien abría el resumen ya no
     añadía nada más. La tira lo resuelve, pero solo si no reintroduce lo que
     el catálogo ya bloquea: ofrecer una pieza agotada aquí mandaría a la
     clienta a un 409 en la pantalla de pago. */
  {
    const tira = await p.evaluate(() => ({
      visible: !document.querySelector('#sug').hidden,
      por: document.querySelector('#sug-por').textContent.trim(),
      ids: [...document.querySelectorAll('.sug-c')].map(b => b.dataset.sug),
    }));
    ok(tira.visible && tira.ids.length >= 3,
      'la tira aparece en la hoja con lo que pega con el carrito', `${tira.ids.length} piezas`);
    ok(/marvel/i.test(tira.por), 'y dice por qué son esas', tira.por);

    const puestos = await p.evaluate(() =>
      [...document.querySelectorAll('#sheet-body .srow-n')].map(e => e.textContent));
    ok(!tira.ids.some(id => puestos.some(n => n.includes(id))),
      'nunca repite lo que ya lleva');
    ok(!tira.ids.some(id => /^letra-/.test(id)),
      'ni las iniciales, que se eligen a propósito y no se sugieren');

    const inv = await p.evaluate(() => fetch('assets/stock.json').then(r => r.json()));
    const sinStock = tira.ids.filter(id => {
      const it = inv.items[id];
      return it && typeof it.stock === 'number' && it.stock <= 0;
    });
    ok(sinStock.length === 0, 'y ninguna está agotada',
      sinStock.length ? sinStock.join(', ') : `${tira.ids.length} comprobadas`);

    /* Añadir desde la tira tiene que mover el total y dejar señal en la propia
       tarjeta: si se repinta de golpe, la pieza desaparece y no queda rastro de
       que entró al pedido. */
    const antes = await p.locator('#v-tot').textContent();
    const puesto = tira.ids[0];
    /* Hay que abrir la hoja para tocarla: fuera de ella la tira existe en el
       DOM pero está desplazada fuera de pantalla, que es justo el motivo de
       ponerla aquí dentro. */
    await p.evaluate(() => {
      if (!document.body.classList.contains('sheet-open')) document.querySelector('#dock-open').click();
    });
    await p.waitForTimeout(400);
    await p.locator('.sug-c').first().click();
    await p.waitForTimeout(250);
    ok(await p.evaluate(() => document.querySelector('.sug-c').classList.contains('is-puesto')),
      'la tarjeta confirma en el sitio en vez de desaparecer');
    ok((await p.locator('#v-tot').textContent()) !== antes,
      'y el total de la hoja se mueve', `${antes} → ${await p.locator('#v-tot').textContent()}`);
    /* Pasada la confirmación, la tira se rehace: la pieza que entró sale de la
       lista y llega otra por detrás, para que nunca quede a medias. */
    await p.waitForTimeout(1100);
    const luego = await p.evaluate(() => [...document.querySelectorAll('.sug-c')].map(c => c.dataset.sug));
    ok(!luego.includes(puesto) && luego.length >= 3,
      'y al repintarse deja de ofrecer la que ya entró, sin quedarse corta',
      `${luego.length} piezas`);
    /* Se deshace para que los pasos siguientes vean el mismo carrito de antes. */
    await p.evaluate(() => {
      const f = [...document.querySelectorAll('#sheet-body .srow')].pop();
      f.querySelector('.srow-x').click();
    });
    await p.waitForTimeout(200);
    ok((await p.locator('#v-tot').textContent()).replace(/\D/g, '') === '257350',
      'y quitarla devuelve el total de antes', puesto);
    /* Se cierra: los pasos siguientes trabajan con la tienda a la vista. */
    await p.evaluate(() => {
      if (document.body.classList.contains('sheet-open')) document.querySelector('#sheet-x').click();
    });
    await p.waitForTimeout(300);
  }

  console.log('6 · la talla viaja hasta el checkout');
  /* Antes esto miraba el texto del pedido por WhatsApp. Ese botón se retiró del
     carrito —al lado del de pagar se comía checkouts terminados—, así que la
     talla ahora tiene que llegar por el camino que de verdad se usa. */
  /* Por el botón de la barra fija: #send vive dentro de la hoja y solo es
     visible con la hoja abierta. Los dos llaman a comprar(). */
  await p.click('#dock-send');
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(700);
  const resumen = await p.locator('#res-lineas').textContent();
  ok(/Talla 18 cm/i.test(resumen), 'el resumen del checkout muestra "Talla 18 cm"');
  console.log('    ' + (await p.locator('#res-lineas .rrow').first().textContent()).replace(/\s+/g, ' ').trim());
  await p.goBack({ waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.body.classList.contains('con-stock'));
  /* Volver recarga la tienda desde cero, así que el catálogo completo queda
     plegado otra vez y los pasos que siguen viven dentro de él. */
  /* El catálogo completo ya nace abierto; este clic lo cerraría. Se deja una
     llamada que garantiza el estado abierto sin depender de cómo empiece. */
  await p.evaluate(() => { const f = document.querySelector('#full-cat');
    if (f && f.hidden) document.querySelector('#more-btn').click(); });
  await p.waitForTimeout(300);

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
