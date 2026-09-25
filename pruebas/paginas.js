// Las páginas de producto generadas (producto-*.html), revisadas como las
// revisaría una persona. Ninguna otra batería ve esto, y ya llegaron tres
// fallos a producción con la suite en verde (ESTADO.md § ENCARGO ABIERTO):
//   (a) quién la enlaza — una página huérfana responde 200 y nadie llega;
//   (b) que sus enlaces lleven a algún sitio — un ancla a una sección que no
//       existe en esa página no hace nada, sin error;
//   (c) que sus secciones tengan estilos — una clase que no está en
//       tienda.css deja la sección cruda;
//   (d) consola limpia — tienda.js sin un id se queda sin carrito, mudo.
//
// (a)–(c) sobre TODAS las páginas, sin navegador. (d), más el píxel y el
// desborde, renderizando a 390 px una página de cada tipo.
//
//   CAPTURAS=<carpeta> node pruebas/paginas.js   guarda una captura por tipo
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const BASE = process.env.URL || 'http://localhost:8899';
const RAIZ = path.join(__dirname, '..');
const ok = (c, t) => console.log((c ? '  ✓ ' : '  ✗ FALLA ') + t);

const leer = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const cat = JSON.parse(leer('assets/catalogo.json'));
const stock = JSON.parse(leer('assets/stock.json')).items;
const unidades = it => !it ? 0 : it.tallas ? Object.values(it.tallas).reduce((a, b) => a + b, 0) : (it.stock || 0);
const css = leer('tienda.css');
const archivoDe = id => 'producto-' + id + '.html';
const paginas = fs.readdirSync(RAIZ).filter(f => /^producto-.+\.html$/.test(f)).sort();
const htmlRaiz = fs.readdirSync(RAIZ).filter(f => f.endsWith('.html'));

const clases = h => new Set([...h.replace(/<script[\s\S]*?<\/script>/g, '').matchAll(/class="([^"]+)"/g)]
  .flatMap(m => m[1].split(/\s+/)).filter(Boolean));
const conEstilo = c => new RegExp('\\.' + c.replace(/[-]/g, '\\-') + '(?![\\w-])').test(css);
// Clases que ya existen en la portada sin regla propia (ganchos de tienda.js):
// no son de esta página. Lo que se vigila es lo NUEVO sin estilo.
const sinEstiloPortada = new Set([...clases(leer('index.html'))].filter(c => !conEstilo(c)));
const ids = h => new Set([...h.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));

(async () => {
  console.log(`1 · Estructura de las ${paginas.length} páginas de producto`);
  ok(paginas.length > 0, `${paginas.length} páginas encontradas`);
  const idsPagina = new Set(paginas.map(f => f.slice(9, -5)));
  const fuera = [...idsPagina].filter(i => !(i in cat.precios));
  ok(fuera.length === 0, 'cada página es un id de catalogo.json' + (fuera.length ? ' — sobran: ' + fuera.join(', ') : ''));

  const malos = { init: [], canon: [], og: [], data: [], enlaces: [], clases: new Set() };
  for (const f of paginas) {
    const h = leer(f), id = f.slice(9, -5);
    if ((h.match(/fbq\('init',\s*'\d+'\)/g) || []).length !== 2) malos.init.push(f);
    if (!h.includes(`<link rel="canonical" href="https://zephoracharms.com/${encodeURIComponent(f)}">`)) malos.canon.push(f);
    for (const p of ['og:title', 'og:description', 'og:image', 'og:url']) if (!h.includes(`property="${p}"`)) { malos.og.push(f); break; }
    if (!h.includes(`<body data-producto="${id}">`)) malos.data.push(f);
    const propios = ids(h);
    for (const [, href] of h.matchAll(/href="([^"]+)"/g)) {
      if (/^(https?:|mailto:|tel:|data:|javascript:)/.test(href)) continue;
      const [ruta, ancla] = href.split('#');
      const destino = ruta ? decodeURIComponent(ruta.split('?')[0]) : f;
      if (ruta && !fs.existsSync(path.join(RAIZ, destino))) { malos.enlaces.push(`${f} → ${href} (no existe)`); continue; }
      if (ancla && destino.endsWith('.html')) {
        const suyos = destino === f ? propios : ids(leer(destino));
        if (!suyos.has(ancla)) malos.enlaces.push(`${f} → ${href} (sin #${ancla})`);
      }
    }
    for (const c of clases(h)) if (!conEstilo(c) && !sinEstiloPortada.has(c)) malos.clases.add(c);
  }
  const lista = a => a.length ? ' — ' + a.slice(0, 6).join(', ') + (a.length > 6 ? ` y ${a.length - 6} más` : '') : '';
  ok(!malos.init.length, 'los dos fbq(\'init\') en todas' + lista(malos.init));
  ok(!malos.canon.length, 'canonical a su propia URL en todas' + lista(malos.canon));
  ok(!malos.og.length, 'og:title/description/image/url en todas' + lista(malos.og));
  ok(!malos.data.length, '<body data-producto> con su id en todas' + lista(malos.data));
  ok(!malos.enlaces.length, '(b) cada enlace lleva a un archivo y ancla que existen' + lista(malos.enlaces));
  ok(!malos.clases.size, '(c) ninguna clase nueva sin regla en tienda.css' + lista([...malos.clases]));

  // (a) Quién enlaza cada página: cualquier otro .html del sitio.
  const huerfanas = paginas.filter(f => !htmlRaiz.some(o => o !== f &&
    (leer(o).includes(`href="${encodeURIComponent(f)}"`) || leer(o).includes(`href="${f}"`))));
  ok(!huerfanas.length, `(a) ninguna página huérfana` + lista(huerfanas));

  // ── Renderizadas: una por tipo ──
  const hay = id => unidades(stock[id]) > 0;
  const primero = fn => [...idsPagina].find(fn);
  const tipos = [
    ['charm con unidades', primero(i => !i.startsWith('letra-') && !cat.pulseras.includes(i) && hay(i))],
    ['charm agotado', primero(i => !i.startsWith('letra-') && !cat.pulseras.includes(i) && !hay(i))],
    ['brazalete', primero(i => cat.pulseras.includes(i) && hay(i))],
    ['inicial', primero(i => i.startsWith('letra-'))],
  ].filter(([, id]) => id);

  const b = await chromium.launch();
  for (const [tipo, id] of tipos) {
    console.log(`2 · ${tipo}: ${archivoDe(id)}`);
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    const ev = [];
    await ctx.exposeBinding('__rec', (_, a) => ev.push(a));
    await ctx.addInitScript(() => { window.fbq = (...a) => window.__rec(JSON.parse(JSON.stringify(a))); });
    const p = await ctx.newPage();
    const errs = [], rotos = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('response', r => { if (r.status() >= 400 && r.url().startsWith(BASE)) rotos.push(r.status() + ' ' + r.url().slice(BASE.length)); });
    await p.goto(BASE + '/' + encodeURIComponent(archivoDe(id)), { waitUntil: 'networkidle' });
    await p.waitForFunction(() => document.body.classList.contains('con-stock'), null, { timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(250);

    const vc = ev.filter(e => e[1] === 'ViewContent');
    ok(vc.length === 1 && vc[0][2].content_type === 'product' && JSON.stringify(vc[0][2].content_ids) === JSON.stringify([id])
      && vc[0][2].value === cat.precios[id] && vc[0][2].currency === 'COP' && /^zc-/.test((vc[0][3] || {}).eventID),
      `ViewContent product [${id}] a ${cat.precios[id]} COP con eventID (${vc.length} enviado)`);
    const est = await p.textContent('#pp-est'), specs = await p.locator('#pp-specs div').count();
    ok(!!est.trim() && specs >= 3, `disponibilidad «${est.trim()}» y ${specs} filas de ficha técnica`);
    const material = await p.textContent('#pp-specs');
    ok(cat.pulseras.includes(id) ? (/baño de plata/i.test(material) && !/925/.test(material)) : /925/.test(material),
      'material correcto para su tipo');
    const des = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(des <= 0, `sin scroll horizontal a 390 px (${des})`);
    // Un `padding` abreviado en .pp pisó el de .wrap y la pieza quedó pegada
    // al borde: se ve mal y ninguna comprobación de datos lo nota.
    const margen = await p.evaluate(() => Math.round(document.querySelector('.pc--pp').getBoundingClientRect().left));
    ok(margen >= 12, `la pieza respeta el margen lateral (${margen} px)`);
    const h1 = await p.locator('h1').count();
    ok(h1 === 1, `un solo <h1> (${h1})`);

    if (process.env.CAPTURAS) await p.screenshot({ path: path.join(process.env.CAPTURAS, `pp-${tipo.replace(/ /g, '-')}.png`), fullPage: false });

    if (tipo === 'charm con unidades' || tipo === 'inicial' && hay(id)) {
      await p.click(`.pc--pp [data-add="${id}"]`);
      await p.waitForTimeout(250);
      const atc = ev.filter(e => e[1] === 'AddToCart');
      ok(atc.length === 1 && atc[0][2].content_ids[0] === id && atc[0][2].value === cat.precios[id],
        `Agregar desde la página → AddToCart [${id}]`);
      const dock = (await p.textContent('#dock-n')).trim();
      ok(/1 pieza/.test(dock), `el carrito lo recibe: «${dock}»`);
    }
    if (tipo === 'brazalete') {
      const abiertas = await p.locator('.pc--pp .tallas:not([hidden])').count();
      ok(abiertas === 1, 'el panel de tallas sale abierto');
      const t = p.locator('.pc--pp [data-talla]:not([aria-disabled="true"])').first();
      await t.click();
      await p.waitForTimeout(250);
      const atc = ev.filter(e => e[1] === 'AddToCart');
      ok(atc.length === 1 && atc[0][2].content_ids[0] === id, `elegir talla → AddToCart [${id}]`);
    }
    if (tipo === 'charm agotado' || tipo === 'inicial' && !hay(id)) {
      const enc = await p.locator('.pc--pp .pc-encargo').count();
      const bloq = await p.getAttribute(`.pc--pp .pc-add`, 'aria-disabled');
      ok(enc === 1 && bloq === 'true', 'agotado: botón bloqueado y «Pedir por encargo»');
    }
    if (process.env.CAPTURAS) await p.screenshot({ path: path.join(process.env.CAPTURAS, `pp-${tipo.replace(/ /g, '-')}-completa.png`), fullPage: true });
    ok(!rotos.length, '(d) sin recursos rotos' + lista(rotos));
    ok(!errs.length, '(d) consola limpia' + lista(errs));
    await ctx.close();
  }
  // ── 3 · Cómo se llega: el nombre de la tarjeta y la ficha ──
  // Decisión del propietario: tocar la tarjeta sigue abriendo la ficha (el
  // flujo que hoy lleva a agregar no cambia); el nombre es un enlace real a
  // la página y la ficha trae «Ver la página completa».
  console.log('3 · Portada → página de producto');
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
    const enlazadas = await p.$$eval('.pc[data-id] .pc-name a', as => as.length);
    ok(enlazadas === cat.pulseras.length + Object.keys(cat.precios).filter(i => !i.startsWith('letra-') && !cat.pulseras.includes(i)).length,
      `${enlazadas} nombres de tarjeta enlazan a su página`);
    const id = await p.$eval('.pc--top[data-id]', e => e.dataset.id);
    await p.click(`.pc[data-id="${id}"] .pc-name a`);
    await p.waitForTimeout(300);
    ok(p.url().endsWith('/index.html') && !(await p.locator('#ficha').isHidden()),
      `clic normal en el nombre abre la ficha y no sale de la portada`);
    // .btn{display:…} le ganaba a [hidden]: toda ficha ofrecía «Pedir por
    // encargo», también con unidades. Se mide lo que se VE, no el atributo.
    const encargoVisible = await p.locator('#fx-wa').isVisible();
    const agotadaId = await p.evaluate(() => document.querySelector('#fx-est').textContent);
    ok(!encargoVisible || /Agotado/.test(agotadaId), `la ficha de una pieza con unidades no ofrece encargo («${agotadaId}»)`);
    const pag = await p.getAttribute('#fx-pag', 'href');
    ok(pag === archivoDe(id) && await p.locator('#fx-pag').isVisible(), `la ficha enlaza a ${pag}`);
    await Promise.all([p.waitForURL(u => u.pathname.endsWith(archivoDe(id))), p.click('#fx-pag')]);
    ok(true, 'y ese enlace lleva a la página de la pieza');
    await p.click('.pc--pp .pc-img');
    await p.waitForTimeout(300);
    ok(await p.locator('#fx-pag').isHidden(), 'en su propia página, la ficha no se enlaza a sí misma');
    await p.keyboard.press('Escape');
    await p.goto(BASE + '/' + archivoDe(cat.pulseras[0]), { waitUntil: 'networkidle' });
    await p.click('.pc--pp .pc-img');
    await p.waitForTimeout(300);
    ok(!(await p.locator('#fx-add').isVisible()), 'la ficha de un brazalete no ofrece «Agregar» (se elige por talla)');
    ok(!errs.length, 'consola limpia' + lista(errs));
    await p.close();
  }

  console.log('4 · Colecciones');
  for (const f of htmlRaiz.filter(x => x.startsWith('coleccion-'))) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errs = [], rotos = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('response', r => { if (r.status() >= 400 && r.url().startsWith(BASE)) rotos.push(r.status() + ' ' + r.url().slice(BASE.length)); });
    await p.goto(BASE + '/' + f, { waitUntil: 'networkidle' });
    const des = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const entra = htmlRaiz.filter(o => o !== f && leer(o).includes(`href="${f}"`)).length;
    const h = leer(f);
    const nuevas = [...clases(h)].filter(c => !conEstilo(c) && !sinEstiloPortada.has(c));
    ok(entra > 0 && !des && !errs.length && !rotos.length && !nuevas.length,
      `${f}: enlazada desde ${entra} páginas, sin desborde (${des}), consola ${errs.length ? 'CON ERRORES ' + errs.join(' | ') : 'limpia'}` +
      (rotos.length ? ', rotos ' + rotos.join(' ') : '') + (nuevas.length ? ', clases sin estilo ' + nuevas.join(' ') : ''));
    if (process.env.CAPTURAS) await p.screenshot({ path: path.join(process.env.CAPTURAS, f.replace('.html', '.png')) });
    await p.close();
  }
  await b.close();
})();
