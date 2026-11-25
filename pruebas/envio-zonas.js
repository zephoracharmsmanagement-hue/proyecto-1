'use strict';
/* Envío por zonas (propietario, 2026-11-25).
 *
 *   · Nacional: 1 pieza paga $15.000 pagando en línea o $25.000 contraentrega;
 *     con 2 o más el envío es gratis en las dos modalidades.
 *   · Destinos especiales (Amazonas, Guainía, San Andrés y Providencia, Vaupés,
 *     Vichada): $38.000 siempre, sin gratis por piezas y sin contraentrega.
 *
 * pruebas/precios.js vigila a calcular(), que es quien cobra. Esto vigila lo que
 * la clienta VE: que el carrito y la pantalla de pago digan el mismo número que
 * el servidor, que el envío cambie al elegir el departamento, y que la
 * contraentrega no se pueda elegir donde no existe. Celular y computador.
 */
const { chromium } = require('playwright');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const BASE = process.env.URL || 'http://localhost:8899';
const { calcular, cop } = require(path.join(RAIZ, 'netlify', 'functions', '_precios.js'));
const CAT = require(path.join(RAIZ, 'assets', 'catalogo.json'));
const STOCK = require(path.join(RAIZ, 'assets', 'stock.json'));

let fallos = 0;
const comprobar = (c, m, d) => {
  if (!c) fallos++;
  console.log(`  ${c ? '✓' : '✗ FALLA'} ${m}${d !== undefined && d !== '' ? ' — ' + d : ''}`);
};

(async () => {
  const R = CAT.reglas, E = R.envioEspecial, ESP = E.departamentos[0];
  /* Dos charms con existencias, sin depender de cuáles haya hoy. */
  const charms = Object.entries(STOCK.items).filter(([id, x]) => x.tipo === 'charm' && CAT.precios[id] && Number(x.stock) >= 3)
    .map(([id]) => id).slice(0, 2);
  comprobar(charms.length === 2, 'hay dos charms con existencias para probar', charms.join(', '));

  /* El servidor no acepta contraentrega a un destino especial aunque alguien
     la mande saltándose la página. Se rechaza antes de apartar o guardar nada,
     así que se puede llamar a la función de verdad sin almacén. */
  {
    const { pathToFileURL } = require('url');
    const fn = (await import(pathToFileURL(path.join(RAIZ, 'netlify', 'functions', 'crear-pago.mjs')).href)).default;
    const r = await fn(new Request('https://zephoracharms.com/.netlify/functions/crear-pago', { method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://zephoracharms.com' },
      body: JSON.stringify({ charms: charms.slice(0, 1), pago: 'contraentrega', cliente: { nombre: 'Prueba', apellido: 'Interna',
        celular: '3001234567', correo: 'prueba.interna@example.com', depto: ESP, ciudad: 'Leticia', direccion: 'Calle 10 # 20-30' } }) }), {});
    const tx = await r.text();
    comprobar(r.status === 400 && /solo enviamos con pago anticipado/.test(tx),
      `crear-pago rechaza la contraentrega a ${ESP} con un 400 que lo explica`, r.status + ' ' + tx.slice(0, 90));
  }

  const b = await chromium.launch({ executablePath: process.env.CHROME_EXE || undefined });
  for (const [w, h, nombre] of [[390, 844, 'celular'], [1366, 768, 'computador']]) {
    console.log(`\n${nombre} (${w}×${h})`);
    const errs = [];
    /* Un navegador limpio por caso: el carrito de uno no se le cuela al siguiente. */
    const abrir = async (url, carrito) => {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500 });
      await ctx.route(/facebook\.(com|net)|clarity\.ms|google-analytics|googletagmanager/, r => r.abort());
      /* Nada sale del navegador: ni pedidos ni eventos. La disponibilidad se
         responde vacía y la página usa stock.json. */
      await ctx.route('**/.netlify/functions/**', r => r.abort());
      const p = await ctx.newPage();
      p.on('pageerror', e => errs.push(e.message));
      await p.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
      await p.evaluate(c => { localStorage.setItem('zephora.carrito.v1', JSON.stringify(c)); localStorage.setItem('zephora.suscrita', '1'); }, carrito);
      await p.goto(BASE + '/' + url, { waitUntil: 'load' });
      await p.waitForTimeout(1500);
      return p;
    };

    /* ── El carrito de la portada ── */
    for (const pago of ['anticipado', 'contraentrega']) {
      for (const n of [1, 2]) {
        const car = { v: 1, cuando: Date.now(), charms: charms.slice(0, n), bases: [], base: null, pago };
        const p = await abrir('index.html', car);
        const t = calcular({ charms: car.charms, bases: [], pago });
        const v = await p.evaluate(() => ({ tot: document.getElementById('v-tot').textContent, ship: document.getElementById('v-ship').textContent,
          nota: document.getElementById('ship-note').textContent, dock: document.getElementById('dock-n').textContent,
          ant: document.getElementById('pb-ant').textContent, con: document.getElementById('pb-con').textContent,
          corta: (() => { const e = document.getElementById('dock-n'); return e.scrollWidth > e.clientWidth + 1; })() }));
        comprobar(v.tot === cop(t.total) && v.ship === (t.envio ? cop(t.envio) : 'Gratis'),
          `carrito, ${n} pieza(s), ${pago}: total ${cop(t.total)}, envío ${t.envio ? cop(t.envio) : 'gratis'}`, `${v.tot} · ${v.ship}`);
        if (n === 1) {
          comprobar(/1 pieza más/.test(v.nota) && /1 más: envío gratis/.test(v.dock) && !v.corta,
            'con una pieza dice que con una más el envío es gratis, y el aviso de la barra cabe', `${v.nota} | ${v.dock}`);
          comprobar(v.ant === 'Envío ' + cop(R.envio.anticipado) && v.con === 'Envío ' + cop(R.envio.contraentrega),
            'los dos botones de pago muestran lo que cuesta cada envío', `${v.ant} / ${v.con}`);
        } else {
          comprobar(/envío gratis/i.test(v.nota) && /GRATIS/.test(v.ant) && /GRATIS/.test(v.con),
            'con dos piezas el envío sale gratis en las dos formas de pago', `${v.ant} / ${v.con}`);
        }
        await p.context().close();
      }
    }

    /* ── Dónde se dice «con 2 piezas el envío es gratis» (2026-11-25) ── */
    {
      /* En el carrito, pegado al total y a la vista sin bajar. */
      for (const n of [1, 2]) {
        const p = await abrir('index.html', { v: 1, cuando: Date.now(), charms: charms.slice(0, n), bases: [], base: null, pago: 'anticipado' });
        await p.evaluate(() => document.getElementById('dock-open').click()); await p.waitForTimeout(900);
        const v = await p.evaluate(() => { const ve = s => { const e = document.querySelector(s); if (!e || e.hidden) return false; const r = e.getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight; };
          const bot = document.getElementById('send').getBoundingClientRect(), caja = document.querySelector('.tot-env').getBoundingClientRect();
          return { aviso: ve('.tot-env-aviso'), avisoTx: document.querySelector('.tot-env-aviso').textContent, filas: [...document.querySelectorAll('.tot-env-fila')].map(x => x.textContent),
            cajaVisible: ve('.tot-env'), sobreBoton: caja.bottom <= bot.top, boton: ve('#send'), titulo: document.querySelector('#sug .sug-h b').textContent,
            desborda: document.documentElement.scrollWidth > innerWidth + 1 }; });
        const t = calcular({ charms: charms.slice(0, n), bases: [], pago: 'anticipado' });
        comprobar(v.cajaVisible && v.sobreBoton && v.boton && !v.desborda
          && v.filas[0] === 'Piezas' + cop(t.subtotal) && v.filas[1] === 'Envío' + (t.envio ? cop(t.envio) : 'Gratis'),
          `carrito con ${n} pieza(s): las cuentas «Piezas» y «Envío» se ven junto al total, encima del botón`, v.filas.join(' · '));
        comprobar(n === 1 ? v.aviso && /1 pieza más.*GRATIS/.test(v.avisoTx) : !v.aviso,
          n === 1 ? 'y el aviso «Agrega 1 pieza más y el envío te sale GRATIS» está a la vista' : 'con el envío ya gratis no se muestra el aviso', v.avisoTx);
        comprobar(v.titulo === (n === 1 ? 'Suma una más y el envío es gratis' : 'Te puede interesar'), 'el título de las sugerencias acompaña', v.titulo);
        await p.context().close();
      }
      /* La cinta de arriba se turna con el aviso del envío, sin cambiar de alto. */
      const p = await abrir('index.html', { v: 1, cuando: Date.now(), charms: [], bases: [], base: null, pago: 'anticipado' });
      const c = await p.evaluate(() => { const s = [...document.querySelectorAll('.ann-slide')], e = document.querySelector('.ann-slide--envio');
        return { n: s.length, tx: e ? e.textContent : '', dos: !!document.querySelector('.ann-track--dos'), anim: s.map(x => getComputedStyle(x).animationName).join(',') }; });
      comprobar(c.n === 2 && c.dos && c.tx.includes('ENVÍO GRATIS desde ' + R.envioGratisDesdePiezas + ' piezas') && c.anim === 'annd,annd',
        'la cinta de arriba tiene dos avisos que se turnan: la oferta y el envío gratis', c.tx);
      /* Al agregar la primera pieza, el aviso dice lo que gana con la segunda. */
      await p.evaluate(() => document.querySelector('#charms .pc:not(.is-out) .pc-add:not([aria-disabled="true"])').click());
      await p.waitForTimeout(600);
      const a1 = await p.evaluate(() => document.getElementById('aviso-corto').textContent);
      await p.evaluate(() => document.querySelectorAll('#charms .pc:not(.is-out) .pc-add:not([aria-disabled="true"])')[1].click());
      await p.waitForTimeout(600);
      const a2 = await p.evaluate(() => { const a = document.getElementById('aviso-corto'), r = a.getBoundingClientRect(); return { tx: a.textContent, dentro: r.left >= 0 && r.right <= innerWidth }; });
      comprobar(/con 1 más el envío es GRATIS/.test(a1) && /Ir a pagar/.test(a1) && !/envío/.test(a2.tx) && a2.dentro,
        'al agregar la primera pieza el aviso dice «con 1 más el envío es GRATIS»; con la segunda ya no', `${a1} → ${a2.tx}`);
      await p.context().close();
    }

    /* ── La pantalla de pago ── */
    const leer = p => p.evaluate(() => ({ tx: document.body.textContent.replace(/\s+/g, ' '),
      nota: document.getElementById('env-nota').textContent, boton: document.getElementById('confirmar').textContent,
      contraOff: document.querySelector('#ops-pago input[value="contraentrega"]').disabled,
      tope: document.getElementById('contra-tope').hidden ? '' : document.getElementById('contra-tope').textContent,
      pago: (document.querySelector('#ops-pago input:checked') || {}).value,
      desborda: document.documentElement.scrollWidth > innerWidth + 1 }));
    const elegir = async (p, depto) => { await p.selectOption('#depto', depto); await p.waitForTimeout(400); };

    for (const n of [1, 2]) {
      const car = { v: 1, cuando: Date.now(), charms: charms.slice(0, n), bases: [], base: null, pago: 'contraentrega' };
      const p = await abrir('checkout.html', car);
      const sin = await leer(p);
      const tNac = calcular({ charms: car.charms, bases: [], pago: 'contraentrega' });
      comprobar(sin.boton.includes(cop(tNac.total)) && !sin.contraOff,
        `pago, ${n} pieza(s), sin departamento: se muestra la zona nacional (${cop(tNac.total)})`, sin.boton);

      await elegir(p, 'Antioquia');
      const nac = await leer(p);
      comprobar(nac.boton.includes(cop(tNac.total)) && !nac.contraOff && nac.pago === 'contraentrega',
        `Antioquia, contraentrega: ${cop(tNac.total)}, igual que el servidor`, nac.boton);
      comprobar(n === 1 ? /2 piezas o más el envío es gratis/.test(nac.nota) : /envío gratis/i.test(nac.nota), 'la nota del envío dice lo que corresponde', nac.nota);

      await elegir(p, ESP);
      const esp = await leer(p);
      const tEsp = calcular({ charms: car.charms, bases: [], pago: 'anticipado' }, undefined, ESP);
      comprobar(tEsp.envio === E.precio && esp.boton.includes(cop(tEsp.total)),
        `${ESP}: el total pasa a ${cop(tEsp.total)} (envío ${cop(E.precio)}), igual que el servidor`, esp.boton);
      comprobar(esp.contraOff && esp.pago === 'anticipado' && esp.tope.includes(ESP),
        'la contraentrega queda deshabilitada, dice por qué, y el pago pasa a anticipado', `${esp.pago} · ${esp.tope}`);
      comprobar(esp.nota.includes(cop(E.precio)) && esp.nota.includes(ESP) && esp.tx.includes('destino especial'),
        'la nota y el renglón del envío explican el destino especial', esp.nota);
      comprobar(!esp.desborda, 'nada se desborda a lo ancho');

      await elegir(p, 'Bogotá D.C.');
      const vuelve = await leer(p);
      const tAnt = calcular({ charms: car.charms, bases: [], pago: 'anticipado' });
      comprobar(!vuelve.contraOff && vuelve.tope === '' && vuelve.boton.includes(cop(tAnt.total)),
        `al volver a Bogotá la contraentrega se puede elegir otra vez y el total baja a ${cop(tAnt.total)}`, vuelve.boton);
      await p.context().close();
    }
    comprobar(!errs.length, 'consola limpia', errs.join(' | ') || undefined);
  }
  await b.close();
  console.log(fallos ? `\n${fallos} fallo(s)` : '\nEnvío por zonas en verde ✓');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
