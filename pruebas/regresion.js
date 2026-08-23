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
    /* El CTA principal del hero, sea cual sea su estilo. Estaba clavado en
       `a.btn--wa`, y al pasar el botón de compra a primario —WhatsApp quedó
       secundario— la prueba se fue a medir un botón verde a 1.900 px de
       scroll y decía FUERA con el hero intacto. Lo que importa es que la
       acción principal caiga sobre el pliegue, no de qué color es. */
    const cta = await p.locator('.hero-cta .btn').first().boundingBox();
    const ann = await p.locator('.ann').first().boundingBox();
    // ¿se corta algún aviso?
    const cortes = await p.$$eval('.ann-slide', (els) =>
      els.map(e => ({ alto: Math.round(e.scrollHeight), caja: Math.round(e.getBoundingClientRect().height) }))
    );
    const annCorta = cortes.some(c => c.alto > c.caja + 1);
    out.push(`${etiqueta}\n  h1 en y=${Math.round(h1.y)}  (pliegue ${h})  ${h1.y + h1.height < h ? 'VISIBLE' : 'FUERA'}` +
      `\n  CTA principal en y=${Math.round(cta.y)}  ${cta.y + cta.height < h ? 'VISIBLE' : 'FUERA'}` +
      `\n  barra avisos alto=${Math.round(ann.height)}px  ${annCorta ? 'SE CORTA ✗' : 'sin cortes ✓'}`);
    await p.close();
  }

  // ---- 2. Bug de filtros + conteo ----
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errores = [];
  p.on('pageerror', e => errores.push(e.message));
  await p.goto(BASE + '/index.html', { waitUntil: 'networkidle' });

  /* El catálogo completo ya nace abierto: antes esta prueba lo abría con
     #more-btn y ahora ese botón lo cerraría, dejando los filtros fuera de
     pantalla y el resto de comprobaciones midiendo una página plegada. */
  const abiertoAlCargar = await p.locator('#full-cat').isVisible();
  const rotuloInicial = (await p.locator('#more-btn').textContent()).trim();
  await p.click('#more-btn');
  await p.waitForTimeout(150);
  const cerradoTrasClic = !(await p.locator('#full-cat').isVisible());
  await p.click('#more-btn');
  await p.waitForTimeout(150);
  out.push('\nCatálogo abierto de entrada'
    + `\n  visible al cargar: ${abiertoAlCargar ? 'sí ✓' : 'NO ✗'}`
    + `\n  el botón ofrece cerrarlo: ${/ocultar/i.test(rotuloInicial) ? 'sí ✓' : 'NO ✗'} — "${rotuloInicial}"`
    + `\n  y al tocarlo se pliega: ${cerradoTrasClic ? 'sí ✓' : 'NO ✗'}`);

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
    `\n  total: ${destacados + revelados}\n  rótulo actual del botón: "${rotulo.trim()}"`);

  // ---- 4. Categorías ----
  await p.click('.cat[data-cat="Marvel"]');
  await p.waitForTimeout(400);
  const marvelOn = await p.locator('#filters .fbtn[data-f="Marvel"].is-on').count();
  const cuentaMarvel = await p.locator('#count').textContent();
  out.push(`\nTarjeta de categoría "Marvel"\n  filtro aplicado: ${marvelOn === 1 ? 'sí ✓' : 'NO ✗'}\n  contador: "${cuentaMarvel}"`);

  // ---- 5. Eventos del pixel en clic a WhatsApp ----
  await p.evaluate(() => { window.__ev = []; window.fbq = (a, b, c) => window.__ev.push([a, b, c]); });
  await p.evaluate(() => {
    /* Por data-wa y no por la clase: lo que se prueba es que el salto a
       WhatsApp mida, no de qué color es el botón. Se cayó al pasar el CTA del
       hero a secundario —perdió btn--wa— con la medición intacta.
       Ahora mide sobre el del pie: el del hero se retiró, y el pie es la
       salida a WhatsApp que la página promete en todo momento. */
    const a = document.querySelector('a[data-wa="pie"]');
    a.addEventListener('click', e => e.preventDefault(), true);
    a.click();
  });
  const ev = await p.evaluate(() => window.__ev);
  out.push(`\nPixel al tocar WhatsApp: ${JSON.stringify(ev)}`);

  // ---- 6. Venta cruzada y barra de envío gratis ----
  //
  // El aviso de charms se oculta con [hidden], pero tiene display:flex propio y
  // el display gana: nació visible y vacío antes de elegir brazalete, y no se
  // iba al llegar a 3 charms. Nada falla en pantalla —solo sale un recuadro sin
  // texto—, así que solo lo caza recorrer el flujo. Misma familia que .pc[hidden]
  // y .tallas[hidden]: cada elemento con display propio tiene que ganarle a
  // [hidden] explícitamente.
  //
  // No se clava ninguna pieza del catálogo: se toma el primer brazalete con
  // talla libre y los primeros charms disponibles, sean los que sean.
  const xsAntes = await p.locator('#xs').isVisible();
  // El bloqueo de esta página es aria-disabled, no el atributo disabled
  // (`bloqueado()` en index.html). Con :not([disabled]) la prueba elegía una
  // talla agotada, el clic no hacía nada y salía un rojo que no era del sitio.
  const libre = '[data-talla]:not([aria-disabled="true"])';
  const elegido = await p.evaluate(sel => {
    const card = [...document.querySelectorAll('#brazaletes .pc')]
      .find(c => c.querySelector(sel) || !c.querySelector('[data-talla]'));
    if (!card) return null;
    card.querySelector('.pc-add').click();
    return card.dataset.id;
  }, libre);
  await p.waitForTimeout(200);
  // Con inventario cargado la talla es la que confirma; sin él, ya quedó puesto.
  await p.evaluate(([id, sel]) => {
    const t = document.querySelector(`.pc[data-id="${id}"] ${sel}`);
    if (t) t.click();
  }, [elegido, libre]);
  await p.waitForTimeout(250);
  const xsBase = await p.locator('#xs').isVisible();
  const xsTxt = (await p.locator('#xs-tx').textContent()).trim();
  const dockBase = (await p.locator('#dock-n').textContent()).trim();
  const puestos = await p.evaluate(() => {
    const libres = [...document.querySelectorAll('#charms [data-add]')]
      .filter(b => b.getAttribute('aria-disabled') !== 'true');
    libres.slice(0, 3).forEach(b => b.click());
    return Math.min(3, libres.length);
  });
  await p.waitForTimeout(300);
  const xsTres = await p.locator('#xs').isVisible();

  out.push('\nVenta cruzada y envío gratis en la barra fija'
    + `\n  oculto antes de elegir brazalete: ${xsAntes === false ? 'sí ✓' : 'NO ✗ (sale vacío)'}`
    + `\n  aparece al fijar el brazalete: ${xsBase ? 'sí ✓' : 'NO ✗'}`
    + `\n  y nombra el 30% del brazalete: ${/30\s*%/.test(xsTxt) ? 'sí ✓' : 'NO ✗'} — "${xsTxt}"`
    + `\n  la barra dice cuánto falta para envío gratis: `
    + `${/para envío gratis|envío gratis/.test(dockBase) ? 'sí ✓' : 'NO ✗'} — "${dockBase}"`
    + `\n  se retira con ${puestos} charms puestos: `
    + `${puestos < 3 || xsTres === false ? 'sí ✓' : 'NO ✗ (sigue pidiendo charms)'}`);

  // Se deja el carrito como estaba para no arrastrar estado a lo que sigue.
  await p.evaluate(() => { try { localStorage.removeItem('zephora.sel'); } catch (e) {} });

  // ---- 7. Galería de la ficha ----
  //
  // Dos cosas distintas, y la segunda es la que más calla al romperse:
  //
  //   a) que la galería aparezca solo donde hay varias fotos. Una tira de un
  //      solo elemento promete un detalle que no existe.
  //   b) que cada archivo listado en FOTOS exista. Un nombre mal escrito no da
  //      error: la ficha abre, el hueco queda en blanco, y solo se ve mirando.
  //      Es el mismo patrón que dejó una foto sin cargar por un carácter
  //      invisible en el nombre.
  const declaradas = await p.evaluate(() => {
    const F = window.__FOTOS || null;
    if (F) return F;
    // FOTOS vive dentro de la IIFE del armador; se lee del propio fuente.
    const m = document.documentElement.innerHTML.match(/const FOTOS = (\{[\s\S]*?\n\};)/);
    return m ? JSON.parse(m[1].replace(/'/g, '"').replace(/,(\s*[}\]])/g, '$1').replace(/;$/, '')) : null;
  });
  let rotas = [];
  if (declaradas) {
    for (const [pid, lista] of Object.entries(declaradas)) {
      for (const f of lista) {
        const r = await p.evaluate(u => fetch(u, { method: 'HEAD' }).then(r => r.status).catch(() => 0),
          BASE + '/assets/' + f);
        if (r !== 200) rotas.push(`${pid}: ${f} (HTTP ${r})`);
      }
    }
  }
  out.push('\nGalería de la ficha'
    + `\n  se leyó el mapa FOTOS: ${declaradas ? 'sí ✓ (' + Object.keys(declaradas).length + ' piezas)' : 'NO ✗'}`
    + `\n  todas las fotos declaradas existen: ${rotas.length === 0 ? 'sí ✓' : 'NO ✗ — ' + rotas.join(', ')}`);

  // Una pieza con varias fotos abre con tira y miniaturas; una con una sola, no.
  const conVarias = declaradas ? Object.keys(declaradas)[0] : null;
  if (conVarias) {
    await p.evaluate(id => {
      const t = document.querySelector(`.pc[data-id="${id}"] .pc-img`);
      if (t) t.click();
    }, conVarias);
    await p.waitForTimeout(300);
    const n = await p.locator('#fx-gal figure').count();
    const minis = await p.locator('#fx-mini button').count();
    out.push(`  «${conVarias}» abre con ${n} fotos y ${minis} miniaturas: `
      + `${n === declaradas[conVarias].length + 1 && minis === n ? 'sí ✓' : 'NO ✗'}`);
    await p.evaluate(() => { const x = document.querySelector('#fx-x'); if (x) x.click(); });
    await p.waitForTimeout(200);
  }
  const sinExtra = await p.evaluate(decl => {
    const c = [...document.querySelectorAll('#charms .pc[data-id]')]
      .map(e => e.dataset.id).find(i => !(i in decl) && i !== 'letras');
    if (!c) return null;
    document.querySelector(`.pc[data-id="${c}"] .pc-img`).click();
    return c;
  }, declaradas || {});
  if (sinExtra) {
    await p.waitForTimeout(300);
    const galería = await p.locator('#fx-gal').count();
    const miniVisible = await p.locator('#fx-mini').isVisible();
    out.push(`  «${sinExtra}», con una sola foto, no pinta tira ni miniaturas: `
      + `${galería === 0 && !miniVisible ? 'sí ✓' : 'NO ✗'}`);
    await p.evaluate(() => { const x = document.querySelector('#fx-x'); if (x) x.click(); });
    await p.waitForTimeout(200);
  }

  // ---- 8. Desbordamiento horizontal ----
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
