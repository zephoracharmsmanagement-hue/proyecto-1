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
// Netlify sirve la página también sin «.html» (y redirige ahí): vale cualquiera.
const llegaA = f => u => u.pathname.replace(/\.html$/, '') === '/' + f.replace(/\.html$/, '');
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

  // Los bloqueos de netlify.toml. Sin `force = true`, Netlify no aplica la
  // regla si el archivo existe: ESTADO.md, CLAUDE.md, docs/ y el resto se
  // sirvieron en producción con su regla de 404 «puesta».
  const reglas = leer('netlify.toml').split('[[redirects]]').slice(1);
  const sinForce = reglas.filter(r => /status\s*=\s*404/.test(r) && !/force\s*=\s*true/.test(r))
    .map(r => (r.match(/from\s*=\s*"([^"]+)"/) || [])[1]);
  ok(reglas.some(r => /status\s*=\s*404/.test(r)) && !sinForce.length,
    'toda regla 404 de netlify.toml lleva force = true' + lista(sinForce));

  // ── Renderizadas: una por tipo ──
  const hay = id => unidades(stock[id]) > 0;
  const primero = fn => [...idsPagina].find(fn);
  const tipos = [
    ['charm con unidades', primero(i => !i.startsWith('letra-') && !cat.pulseras.includes(i) && hay(i))],
    ['charm agotado', primero(i => !i.startsWith('letra-') && !cat.pulseras.includes(i) && !hay(i))],
    ['brazalete', primero(i => cat.pulseras.includes(i) && hay(i))],
    ['inicial', primero(i => i.startsWith('letra-'))],
  ].filter(([, id]) => id);

  /* Las funciones de Netlify no existen en el servidor local: se responden con
     datos de prueba (disponibilidad = el conteo de stock.json). Así además se
     prueba cómo se pintan las reseñas y «N compraron», que en local serían un
     404 en la consola. */
  const rutasFalsas = async (ctx, { resenas, vendidas } = {}) => {
    await ctx.route('**/.netlify/functions/disponibilidad', r => r.fulfill({ json: {
      fuente: 'conteo-menos-apartado',
      piezas: Object.entries(stock).filter(([, v]) => !v.tallas).map(([i, v]) => ({ id: i, disponible: v.stock })),
      brazaletes: Object.entries(stock).filter(([, v]) => v.tallas).map(([i, v]) => ({ id: i, tallas: v.tallas })) } }));
    await ctx.route('**/.netlify/functions/vendidas', r => r.fulfill({ json: { ventas: vendidas || {} } }));
    await ctx.route('**/.netlify/functions/resenas?*', r => r.fulfill({ json: resenas || { total: 0, promedio: 0, resenas: [] } }));
  };
  const { calcular } = require(path.join(RAIZ, 'netlify', 'functions', '_precios.js'));

  const b = await chromium.launch();
  for (const [tipo, id] of tipos) {
    console.log(`2 · ${tipo}: ${archivoDe(id)}`);
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    const conDatos = tipo === 'charm con unidades';
    await rutasFalsas(ctx, conDatos ? {
      vendidas: { [id]: 4 },
      resenas: { total: 2, promedio: 4.5, resenas: [
        { estrellas: 5, texto: '<b>Hermoso</b>, llegó rápido', nombre: 'Ana', ciudad: 'Cali', verificada: true },
        { estrellas: 4, texto: 'Muy bonito', nombre: 'Eva', ciudad: '', verificada: false }] },
    } : { vendidas: { [id]: 2 } });
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
    // Prueba social en la página de la pieza: reseñas y los 3 videos de
    // clientas, que no deben descargarse antes de verse (preload="none").
    const social = await p.evaluate(() => ({
      resenas: !!document.getElementById('reseñas'),
      videos: document.querySelectorAll('#historia video.ugc-v').length,
      precarga: [...document.querySelectorAll('#historia video')].every(v => v.preload === 'none' && !v.autoplay),
    }));
    ok(social.resenas && social.videos === 3 && social.precarga,
      `reseñas y ${social.videos} videos de clientas, sin descarga anticipada`);
    const h1 = await p.locator('h1').count();
    ok(h1 === 1, `un solo <h1> (${h1})`);

    if (process.env.CAPTURAS) await p.screenshot({ path: path.join(process.env.CAPTURAS, `pp-${tipo.replace(/ /g, '-')}.png`), fullPage: false });

    // Los paquetes que se publican son los que cobra el servidor.
    const pq = await p.$$eval('.pq [data-total]', bs => bs.map(x => +x.dataset.total));
    if (cat.pulseras.includes(id)) {
      const nota = await p.textContent('.pq-nota');
      const refP = +((nota.match(/charms de \$([\d.]+)/) || [])[1] || '0').replace(/\./g, '');
      const ref = Object.keys(cat.precios).find(i => cat.precios[i] === refP && !cat.pulseras.includes(i));
      const esperado = [1, 2, 3, 4].map(n => calcular({ base: { id, talla: null }, charms: Array(n).fill(ref), pago: 'anticipado' }).total);
      ok(ref && JSON.stringify(pq) === JSON.stringify(esperado), `paquetes brazalete + 1–4 charms = calcular() (${pq.join(' · ')})`);
    } else if (hay(id)) {
      const esperado = [1, 2, 3, 4].map(n => calcular({ base: null, charms: Array(n).fill(id), pago: 'anticipado' }).total);
      ok(JSON.stringify(pq) === JSON.stringify(esperado), `paquetes 1–4 = calcular() (${pq.join(' · ')})`);
      await p.check('.pq input[value="3"]');
      const mas = await p.evaluate(() => ({ v: !document.getElementById('pq-mas').hidden, f: document.getElementById('pq-faltan').textContent,
        n: document.querySelectorAll('#pq-mas [data-add]').length }));
      ok(mas.v && mas.f === '2 charms' && mas.n > 0, `al elegir 3 se abre «completa tu paquete: elige ${mas.f} más» con ${mas.n} opciones`);
      const dock0 = { n: (await p.textContent('#dock-n')).trim(), b: (await p.textContent('#dock-send')).trim() };
      ok(dock0.n === (await p.evaluate(() => document.querySelector('.pc--pp .pc-name').textContent)).trim() && dock0.b === 'Agregar',
        `con el carrito vacío la barra fija ofrece «${dock0.b}» esta pieza`);
    }

    if (conDatos) {
      const r = await p.evaluate(() => ({ top: document.getElementById('pp-estrellas').hidden ? '' : document.getElementById('pp-estrellas').textContent,
        items: document.querySelectorAll('#rp-lista .rp-it').length, txt: document.getElementById('rp-lista').textContent,
        html: document.getElementById('rp-lista').innerHTML, vend: document.getElementById('pp-vendidas').textContent }));
      ok(/4,5 · 2 reseñas/.test(r.top) && r.items === 2, `estrellas con el promedio y conteo reales («${r.top.trim()}»)`);
      ok(r.txt.includes('<b>Hermoso</b>') && !r.html.includes('<b>Hermoso</b>'), 'el texto de una reseña se escapa, no se inyecta');
      ok((r.html.match(/Compra verificada/g) || []).length === 1, 'solo la reseña con pedido lleva «Compra verificada»');
      ok(/4 personas compraron/.test(r.vend), `«${r.vend}»`);
    } else {
      const v = await p.evaluate(() => document.getElementById('pp-vendidas').hidden);
      ok(v, 'con menos de 3 compras no se dice nada');
    }

    if (tipo === 'charm con unidades' || tipo === 'inicial' && hay(id)) {
      await p.click(`.pp-cta [data-add="${id}"]`);
      await p.waitForTimeout(250);
      const atc = ev.filter(e => e[1] === 'AddToCart');
      ok(atc.length === 1 && atc[0][2].content_ids[0] === id && atc[0][2].value === cat.precios[id],
        `Agregar desde la página → AddToCart [${id}]`);
      const dock = (await p.textContent('#dock-n')).trim();
      ok(/1 pieza/.test(dock) && (await p.textContent('#dock-send')).trim() === 'Comprar', `el carrito lo recibe: «${dock}», y la barra vuelve a «Comprar»`);
      if (conDatos) {
        if (process.env.CAPTURAS) await p.screenshot({ path: path.join(process.env.CAPTURAS, `pp-${tipo.replace(/ /g, '-')}-completa.png`), fullPage: true });
        await Promise.all([p.waitForURL(/checkout\.html/, { timeout: 8000 }), p.click(`.pp-cta [data-comprar="${id}"]`)]).catch(() => {});
        ok(/checkout\.html/.test(p.url()) && ev.filter(e => e[1] === 'AddToCart').length === 1,
          '«Comprar ahora» lleva al checkout sin agregar la pieza dos veces');
      }
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
      const ag = await p.evaluate(() => ({ compra: document.getElementById('pp-compra').hidden,
        aviso: !document.getElementById('pp-agotado').hidden, href: document.getElementById('pp-encargo').href }));
      ok(ag.compra && ag.aviso && /wa\.me/.test(ag.href), 'sin paquetes ni botones de compra, y con el encargo por WhatsApp');
    }
    if (process.env.CAPTURAS && !conDatos) await p.screenshot({ path: path.join(process.env.CAPTURAS, `pp-${tipo.replace(/ /g, '-')}-completa.png`), fullPage: true });
    ok(!rotos.length, '(d) sin recursos rotos' + lista(rotos));
    ok(!errs.length, '(d) consola limpia' + lista(errs));
    await ctx.close();
  }
  // ── 3 · Cómo se llega: tocar la joya lleva a su página ──
  // Decisión del propietario (2026-09-26), con la vitrina ya en cada página:
  // la foto y el nombre de cualquier tarjeta llevan a la página de la pieza.
  // En su propia página, la foto abre la ficha como galería ampliada.
  console.log('3 · Portada → página de producto');
  {
    const ctx3 = await b.newContext({ viewport: { width: 390, height: 844 } });
    await rutasFalsas(ctx3);
    const p = await ctx3.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
    const enlazadas = await p.$$eval('.pc[data-id] .pc-name a', as => as.length);
    ok(enlazadas === cat.pulseras.length + Object.keys(cat.precios).filter(i => !i.startsWith('letra-') && !cat.pulseras.includes(i)).length,
      `${enlazadas} nombres de tarjeta enlazan a su página`);
    const id = await p.$eval('.pc--top[data-id]', e => e.dataset.id);
    await Promise.all([p.waitForURL(llegaA(archivoDe(id))), p.click(`.pc[data-id="${id}"] .pc-img`)]);
    ok(true, `tocar la foto de ${id} en la portada lleva a ${archivoDe(id)}`);
    await p.goBack({ waitUntil: 'networkidle' });
    await Promise.all([p.waitForURL(llegaA(archivoDe(id))), p.click(`.pc[data-id="${id}"] .pc-name a`)]);
    ok(true, 'y tocar su nombre, también');
    await p.goBack({ waitUntil: 'networkidle' });
    const conBoton = await p.evaluate(() => {
      const b = [...document.querySelectorAll('#charms .pc[data-id] .pc-add[data-add]')].find(x => x.getAttribute('aria-disabled') !== 'true');
      return b && b.dataset.add;
    });
    const antes = p.url();
    await p.click(`.pc[data-id="${conBoton}"] .pc-add[data-add]`);
    await p.waitForTimeout(250);
    ok(p.url() === antes, `«Agregar» de la tarjeta agrega sin salir de la portada (${conBoton})`);
    await p.evaluate(() => { const L = document.querySelector('[data-letra="m"]'); if (L) L.click(); });
    await Promise.all([p.waitForURL(llegaA('producto-letra-m.html')),
      p.evaluate(() => document.querySelector('.pc[data-id="letras"] .pc-img').click())]);
    ok(true, 'la tarjeta de letras lleva a la inicial que se tocó (M)');
    const rel = await p.$eval('.sec .pc[data-id]:not(.pc--pp):not([data-id="letras"])', e => e.dataset.id).catch(() => null);
    if (rel) {
      await Promise.all([p.waitForURL(llegaA(archivoDe(rel))), p.click(`.pc[data-id="${rel}"]:not(.pc--pp) .pc-img`)]);
      ok(true, `desde una página de producto, una pieza relacionada lleva a la suya (${rel})`);
    }
    await p.click('.pc--pp .pc-img');
    await p.waitForTimeout(300);
    ok(!(await p.locator('#ficha').isHidden()) && await p.locator('#fx-pag').isHidden(),
      'en su propia página, la foto abre la galería y no se enlaza a sí misma');
    // Repintarla abierta (al agregar, al llegar el inventario) sumaba otro
    // bloqueo del fondo: al cerrarla, la página quedaba sin scroll.
    if (await p.locator('#fx-add').isVisible()) { await p.click('#fx-add'); await p.waitForTimeout(200); }
    await p.keyboard.press('Escape');
    await p.waitForTimeout(200);
    ok(!(await p.evaluate(() => document.body.classList.contains('sheet-open'))),
      'agregar desde la galería y cerrarla deja la página con scroll');
    await p.goto(BASE + '/' + archivoDe(cat.pulseras[0]), { waitUntil: 'networkidle' });
    await p.click('.pc--pp .pc-img');
    await p.waitForTimeout(300);
    ok(!(await p.locator('#fx-add').isVisible()), 'la ficha de un brazalete no ofrece «Agregar» (se elige por talla)');
    ok(!errs.length, 'consola limpia' + lista(errs));
    await p.close();
  }

  // ── 4 · Vitrina: elegir de todo el catálogo sin salir de la página ──
  // Pedido del propietario (2026-09-26): el carrusel no saca a la clienta de
  // la ficha —sin «Ver todo el catálogo»—, trae pestañas por colección y está
  // en todas las fichas, brazaletes incluidos, y en los kits.
  console.log('4 · Vitrina en fichas y kits');
  {
    const ctx5 = await b.newContext({ viewport: { width: 390, height: 844 } });
    await rutasFalsas(ctx5);
    const p = await ctx5.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    const sinSalida = paginas.filter(f => /pq-todo|Ver todo el catálogo/.test(leer(f)));
    ok(!sinSalida.length, 'ninguna ficha tiene «Ver todo el catálogo»' + lista(sinSalida));
    const sinVit = paginas.filter(f => !leer(f).includes('class="vit"'));
    ok(!sinVit.length, `las ${paginas.length} fichas traen la vitrina` + lista(sinVit));
    const grupos = [...new Set(Object.entries(cat.grupos).filter(([i]) => cat.precios[i]).map(([, g]) => g))];

    const charm = tipos.find(t => t[0] === 'charm con unidades')[1];
    await p.goto(BASE + '/' + archivoDe(charm), { waitUntil: 'networkidle' });
    await p.check('.pq input[value="2"]');
    const tabs = await p.$$eval('.vit-tab', x => x.map(t => t.textContent));
    ok(tabs[0] === 'Relacionados' && grupos.every(g => tabs.includes(g)) && tabs.includes('Iniciales') && tabs.includes('Brazaletes'),
      `pestañas: ${tabs.join(' · ')}`);
    ok(!(await p.$$eval('.vit-it', x => x.map(i => i.dataset.vid))).includes(charm), 'la vitrina no ofrece la misma pieza');
    const otra = grupos.find(g => g !== cat.grupos[charm]);
    await p.click(`.vit-tab:text-is("${otra}")`);
    const enOtra = await p.$$eval('.vit-it', x => x.map(i => i.dataset.vid));
    ok(enOtra.length > 0 && enOtra.every(i => cat.grupos[i] === otra && hay(i)), `«${otra}» muestra solo sus piezas con unidades (${enOtra.length})`);
    const antes = p.url();
    await p.click('.vit-it >> nth=0 >> .vit-add');
    await p.waitForTimeout(200);
    const tras = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('zephora.carrito.v1') || '{}'); return d.charms || []; });
    ok(p.url() === antes && tras.includes(enOtra[0]) && (await p.getAttribute('.vit-it', 'data-n')) === '×1',
      `«Agregar» suma ${enOtra[0]} al carrito sin salir de la página`);
    await p.click('.vit-tab:text-is("Brazaletes")');
    const br = await p.getAttribute('.vit-it', 'data-vid');
    await p.click('.vit-it >> nth=0 >> .vit-add');
    const t = await p.getAttribute('.vit-it .vit-tallas .tbtn:not([aria-disabled])', 'data-talla');
    await p.click(`.vit-it .vit-tallas .tbtn[data-talla="${t}"]`);
    await p.waitForTimeout(200);
    ok((await p.textContent('.vit-it .vit-add')) === `Talla ${t} ✓`, `un brazalete se elige con su talla en la misma vitrina (${br}, ${t} cm)`);

    const pul = tipos.find(x => x[0] === 'brazalete')[1];
    await p.goto(BASE + '/' + archivoDe(pul), { waitUntil: 'networkidle' });
    const tb = await p.$$eval('.vit-tab', x => x.map(t => t.textContent));
    ok(await p.locator('.pq-mas--b .vit-rail').isVisible() && !tb.includes('Brazaletes') && (await p.$$('.vit-it [data-add]')).length > 0,
      `la ficha del brazalete trae la vitrina de charms, sin cambiar de brazalete (${tb.join(' · ')})`);

    await p.goto(BASE + '/kits.html', { waitUntil: 'networkidle' });
    ok(!(await p.$$('a.kit-paso, .kit a[href^="index.html"]')).length, 'los kits no mandan a la portada');
    const kit = p.locator('.kit').first();
    const piezas = (await kit.locator('.kit-paso').nth(1).getAttribute('data-kit-piezas')).split(',');
    await p.evaluate(() => localStorage.removeItem('zephora.carrito.v1'));
    await p.reload({ waitUntil: 'networkidle' });
    await kit.locator('.kit-paso').nth(1).click();
    await p.waitForTimeout(300);
    const k = await p.evaluate(() => JSON.parse(localStorage.getItem('zephora.carrito.v1') || '{}'));
    ok(p.url().endsWith('/kits.html') && JSON.stringify(k.charms) === JSON.stringify(piezas.slice(1)) && !k.base,
      `«Brazalete + 2» pone sus 2 charms y pide la talla aquí mismo (${piezas.slice(1).join(', ')})`);
    const tk = await kit.locator('.kit-tallas .tbtn:not([aria-disabled])').first().getAttribute('data-talla');
    await kit.locator(`.kit-tallas .tbtn[data-talla="${tk}"]`).click();
    await p.waitForTimeout(200);
    const k2 = await p.evaluate(() => JSON.parse(localStorage.getItem('zephora.carrito.v1') || '{}'));
    ok(k2.base && k2.base.id === piezas[0] && k2.base.talla === tk, `la talla del kit pone su brazalete (${piezas[0]}, ${tk} cm)`);
    ok((await kit.locator('.vit-tab').first().textContent()) === 'De este kit', 'la vitrina del kit empieza por sus propios charms');
    ok(!errs.length, 'consola limpia' + lista(errs));
    await ctx5.close();
  }

  console.log('5 · Colecciones y kits');
  for (const f of htmlRaiz.filter(x => x.startsWith('coleccion-') || x === 'kits.html')) {
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
  // ── 6 · Fotos del carrito en cualquier página (ENCARGO-FICHA-2 § 2) ──
  // imgDe() buscaba la foto en las tarjetas de la página: en kits, colecciones
  // y páginas de producto casi ninguna pieza tiene tarjeta, y el carrito salía
  // sin fotos (y la tira de sugeridos con <img src=""> roto).
  console.log('6 · Fotos del carrito fuera de la portada');
  {
    const ajenas = ['mickey-mouse', 'angel-guardian', 'letra-m', 'aries'];
    for (const f of ['kits.html', 'coleccion-marvel.html', archivoDe('hulk')]) {
      const ctx6 = await b.newContext({ viewport: { width: 390, height: 844 } });
      await rutasFalsas(ctx6);
      await ctx6.addInitScript(ch => localStorage.setItem('zephora.carrito.v1', JSON.stringify(
        { v: 1, base: { id: 'pulsera-avengers', talla: '18' }, charms: ch, pago: 'anticipado', cuando: Date.now() })), ajenas);
      const p = await ctx6.newPage();
      const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      await p.goto(BASE + '/' + f, { waitUntil: 'networkidle' });
      await p.waitForTimeout(300);
      const r = await p.evaluate(() => {
        const filas = [...document.querySelectorAll('#sheet-body .srow')];
        const sinFoto = filas.filter(x => { const i = x.querySelector('img');
          return !i || !i.getAttribute('src') || !(i.complete && i.naturalWidth > 0); })
          .map(x => x.querySelector('.srow-n').firstChild.textContent.trim());
        const vacias = [...document.querySelectorAll('img')].filter(i => i.hasAttribute('src') && !i.getAttribute('src')).length;
        return { n: filas.length, sinFoto, vacias };
      });
      ok(r.n === ajenas.length + 1 && !r.sinFoto.length && !r.vacias && !errs.length,
        `${f}: las ${r.n} filas del carrito con foto` + lista(r.sinFoto) + (r.vacias ? `, ${r.vacias} <img src=""> vacías` : '')
        + (errs.length ? ', errores ' + errs.join(' | ') : ''));
      await ctx6.close();
    }
  }

  await b.close();
})();
