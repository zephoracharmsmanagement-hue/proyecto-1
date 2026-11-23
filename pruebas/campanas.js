'use strict';
/* Conversión, 2026-11-20: lo que salió de Clarity y las páginas de campaña.
 *
 * Lo que vio el propietario en 109 sesiones de clientas, casi todas desde la
 * app de Instagram o Facebook en celular: clics que no hacían nada, «COMPRAR»
 * tocado con la selección en $0 (en kits.html no pasaba nada), «Brazalete solo
 * $78.000» tocado en Marvel sin respuesta, y quien llegaba del anuncio de
 * Marvel se perdía antes de ver las piezas.
 *
 * Esta batería exige que nada de eso vuelva:
 *
 *   1. La página de campaña sale de assets/campanas.json, solo con el tema, y
 *      con las piezas del anuncio primero.
 *   2. Los kits pautados (kits.json, pagina.campana) van en modo campaña.
 *   3. Los escalones del combo se pueden tocar.
 *   4. En el navegador, a 375 px: las 5 del anuncio caben en el primer
 *      pantallazo; la foto abre la ficha ahí mismo; «Agregar» agrega; y el
 *      botón de la barra con la selección vacía no queda muerto en NINGUNA
 *      página.
 */
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const BASE = process.env.URL || 'http://localhost:8899';
const leer = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

const CAT = JSON.parse(leer('assets/catalogo.json'));
const CAMPANAS = JSON.parse(leer('assets/campanas.json')).campanas;
const KITS = JSON.parse(leer('assets/kits.json')).kits;
const idsEn = (h, desde, hasta) => {
  const a = h.indexOf(desde), b = hasta ? h.indexOf(hasta, a) : h.length;
  return [...h.slice(a, b).matchAll(/<article class="pc[^"]*" data-id="([^"]+)"/g)].map(m => m[1]);
};
/* Enlaces que sacan del tema: otras categorías, otros kits, la portada, el
   catálogo. Los de cada pieza (producto-*.html) se toleran en el HTML porque
   tienda.js los convierte en la ficha, pero solo si son del tema. */
const salidas = (h, tema) => [...h.matchAll(/href="([^"#][^"]*)"/g)].map(m => m[1])
  .filter(u => !/^https?:\/\/(wa\.me|zephoracharms\.com|fonts\.)/.test(u))
  .filter(u => !/^(envios-y-devoluciones|politica-de-privacidad|terminos-y-condiciones|politica-de-cookies|preguntas-frecuentes)\.html/.test(u))
  .filter(u => !/^(tienda\.css|data:|mailto:|tel:|checkout\.html|https:\/\/instagram\.com\/zephora_charms)/.test(u))
  .filter(u => { const m = u.match(/^producto-(.+)\.html/); return !(m && tema.has(m[1])); })
  .filter(u => !/^assets\//.test(u))
  /* El logotipo vuelve a la portada: es la única salida a propósito. */
  .filter(u => u !== 'index.html');

async function main() {
  console.log('\n1 · Páginas de campaña (assets/campanas.json)');
  for (const c of CAMPANAS) {
    const archivo = path.join(RAIZ, c.archivo);
    comprobar(fs.existsSync(archivo), `existe ${c.archivo}`);
    if (!fs.existsSync(archivo)) continue;
    const h = leer(c.archivo);
    const tema = new Set(Object.entries(CAT.grupos).filter(([, g]) => g === c.grupo).map(([id]) => id)
      /* «Inicial y signo»: la tarjeta de las iniciales, los signos y todos los brazaletes. */
      .concat(c.tipo === 'inicial-signo' ? ['letras'].concat(CAT.pulseras) : [c.base]));
    const dest = idsEn(h, 'id="destacadas"', '</section>');
    comprobar(JSON.stringify(dest) === JSON.stringify(c.tipo === 'inicial-signo' ? ['letras'] : c.destacados),
      'las del anuncio van primero, en el orden de la configuración', dest.join(', '));
    const todas = idsEn(h, 'id="destacadas"', '<section class="talla-sec"');
    const fuera = todas.filter(id => !tema.has(id));
    comprobar(fuera.length === 0, `solo ${c.grupo}: ninguna pieza de otro tema`, fuera.join(', ') || undefined);
    const delTema = [...tema].filter(id => id !== c.base);
    const faltan = delTema.filter(id => !todas.includes(id));
    comprobar(faltan.length === 0, `y todo ${c.grupo} está (${delTema.length} piezas + el brazalete)`, faltan.join(', ') || undefined);
    comprobar(/<body class="pag-campana"[^>]*data-vacio="#destacadas"/.test(h),
      'sin menú (body.pag-campana) y la barra vacía lleva a las destacadas');
    const sal = salidas(h, tema);
    comprobar(sal.length === 0, 'ningún enlace saca del tema', [...new Set(sal)].slice(0, 6).join(', ') || undefined);
    comprobar(/class="cp-wa-float"[^>]*data-wa-evento="Contact"[^>]*href="https:\/\/wa\.me\//.test(h) && /id="year"/.test(h),
      'el ícono flotante de WhatsApp (con su evento) y el pie con #year, que exige tienda.js');
    comprobar(/class="cp-wa-float"[^>]*><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"[^>]*><path d="M12\.04 2C6\.58 2 /.test(h),
      'el ícono de WhatsApp es el glifo oficial relleno, el de la portada original (propietario, 2026-11-20)');
    comprobar(/<a class="brand" href="index\.html">/.test(h) && (h.match(/href="index\.html"/g) || []).length === 1,
      'el logotipo lleva a la página principal, y es la única salida');
    comprobar(/data-agotadas-final/.test(h), 'las agotadas bajan al final (data-agotadas-final)');
    comprobar(!/loading="lazy"/.test(h.slice(h.indexOf('id="destacadas"'), h.indexOf('</section>', h.indexOf('id="destacadas"')))),
      'las fotos del primer pantallazo no llevan carga diferida');
    if (c.tipo === 'inicial-signo') {
      comprobar((h.match(/id="letras-grid"/g) || []).length === 1 && !/class="letras-ver"/.test(h),
        'un solo selector de iniciales, y sin el enlace a la página de cada inicial');
      comprobar(idsEn(h, 'id="brazaletes"', '</section>').length === CAT.pulseras.length, `los ${CAT.pulseras.length} brazaletes están para elegir`);
    } else {
      comprobar(/data-elegir-base="[^"]+"/.test(h) && (h.match(/data-ir="#piezas"/g) || []).length >= 2,
        'el combo se puede tocar: brazalete y charms');
    }
  }

  console.log('\n2 · Kits pautados en modo campaña (kits.json · pagina.campana)');
  for (const k of KITS) {
    const h = leer('kit-' + k.id + '.html');
    const camp = !!(k.pagina && k.pagina.campana);
    if (!camp) {
      comprobar(!/pag-campana/.test(h) && /kp-pop/.test(h), `kit-${k.id}: no pautado, se queda como estaba`);
      continue;
    }
    comprobar(/<body class="pag-campana"/.test(h) && !/kp-pop/.test(h) && !/class="col-resto/.test(h),
      `kit-${k.id}: sin menú, sin «Colecciones populares» ni «catálogo completo»`);
    comprobar(/data-vit-solo="1"/.test(h), `kit-${k.id}: la vitrina sin pestañas de otras colecciones`);
    const rel = k.pagina.relacionadas || {};
    const esperadas = (rel.grupo ? Object.keys(CAT.grupos).filter(id => CAT.grupos[id] === rel.grupo) : rel.ids || [])
      .filter(id => id !== k.base && !k.charms.includes(id));
    const vistas = idsEn(h, 'id="relacionadas"', '</section>');
    comprobar(JSON.stringify(vistas.slice().sort()) === JSON.stringify(esperadas.slice().sort()),
      `kit-${k.id}: luego solo sus relacionadas (${esperadas.length})`, vistas.length + ' en la página');
    const tema = new Set([k.base, ...k.charms, ...esperadas]);
    const sal = salidas(h, tema);
    comprobar(sal.length === 0, `kit-${k.id}: ningún enlace saca del tema`, [...new Set(sal)].slice(0, 6).join(', ') || undefined);
  }

  console.log('\n3 · El combo de las colecciones se puede tocar');
  for (const f of ['coleccion-marvel.html', 'coleccion-simbolos.html']) {
    const h = leer(f);
    const pasos = (h.match(/class="col-paso(?: col-paso--best)?"/g) || []).length;
    const botones = (h.match(/<button type="button" class="col-paso[^"]*" data-(elegir-base|ir)=/g) || []).length;
    comprobar(pasos === 3 && botones === 3, `${f}: los 3 escalones son botones que llevan a algo`, `${botones}/${pasos}`);
  }
  const gen = leer('herramientas/gen_colecciones.py');
  comprobar(/def escalones\(/.test(gen) && !/<div class="col-paso/.test(gen), 'y el generador ya no escribe escalones muertos');

  console.log('\n4 · En el navegador, a 375 px');
  const { chromium } = require('playwright');
  const b = await chromium.launch();
  try {
    const nueva = async () => {
      const p = await b.newPage({ viewport: { width: 375, height: 812 } });
      p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
      return p;
    };
    const c = CAMPANAS[0];
    let p = await nueva();
    await p.goto(BASE + '/' + c.archivo, { waitUntil: 'load' });
    await p.waitForTimeout(800);
    const caben = await p.evaluate(() => {
      const dock = document.getElementById('dock').getBoundingClientRect().top;
      return [...document.querySelectorAll('#destacadas .pc')].map(el => {
        const r = el.getBoundingClientRect(), add = el.querySelector('.pc-add').getBoundingClientRect();
        return r.top >= 0 && add.bottom <= dock;
      });
    });
    /* Desde el 2026-11-22 lo primero es el kit con la promo (#cp-kit): en
       Clarity el 37 % se iba tras los destacados sin llegar al combo. Los
       destacados van justo debajo; en el primer pantallazo caben el kit entero
       y al menos dos de ellos con su botón. */
    const kit = await p.evaluate(() => {
      const k = document.getElementById('cp-kit'), r = k.getBoundingClientRect(), b = k.querySelector('[data-kitc-armar]').getBoundingClientRect();
      return { visible: !k.hidden && r.top >= 0 && b.bottom <= document.getElementById('dock').getBoundingClientRect().top,
        antes: !!(k.compareDocumentPosition(document.getElementById('destacadas')) & Node.DOCUMENT_POSITION_FOLLOWING),
        tx: k.innerText.replace(/\s+/g, ' ') };
    });
    comprobar(kit.visible && kit.antes, 'el kit con la promo está entero en el primer pantallazo, arriba de los destacados', kit.tx);
    comprobar(caben.length === c.destacados.length && caben.filter(Boolean).length >= 2,
      `y debajo caben al menos 2 de las ${c.destacados.length} del anuncio, con su botón`, caben.filter(Boolean).length + ' de ' + caben.length);
    /* Los números del kit son los de calcular(): brazalete + los 3 primeros
       charms disponibles, la de menor valor gratis. */
    {
      const { calcular, cop } = require('../netlify/functions/_precios.js');
      const ids = await p.evaluate(() => [...document.querySelectorAll('#cp-kit .cpk-f img')].map(i => i.getAttribute('src').replace(/^.*assets\//, '').replace(/\.webp.*$/, '')));
      const t = calcular({ base: { id: c.base, talla: '18' }, charms: ids.slice(1), pago: 'anticipado' });
      comprobar(ids[0] === c.base && ids.length === 4 && kit.tx.includes(cop(t.total)) && kit.tx.includes('ahorras ' + cop(t.descuento))
        && kit.tx.includes(cop(Math.ceil(t.total / 3))),
        `el kit dice el total de calcular() (${cop(t.total)}), el ahorro (${cop(t.descuento)}) y la cuota de Addi`, kit.tx);
      const q = await nueva();
      await q.goto(BASE + '/' + c.archivo, { waitUntil: 'load' });
      await q.waitForTimeout(800);
      await q.click('[data-kitc-armar]');
      await q.waitForTimeout(200);
      const tallas = await q.locator('#cp-kit [data-kitc-talla]').count();
      await q.locator('#cp-kit [data-kitc-talla]:not([aria-disabled="true"])').first().click();
      await q.waitForTimeout(500);
      const armado = await q.evaluate(() => ({ carrito: JSON.parse(localStorage.getItem('zephora.carrito.v1') || '{}'),
        hoja: document.getElementById('sheet').getAttribute('aria-hidden'), total: document.getElementById('v-tot').textContent,
        ahorro: document.getElementById('tot-ahorro').hidden ? '' : document.getElementById('tot-ahorro').textContent,
        barra: document.getElementById('dock-n').textContent + ' | ' + document.getElementById('dock-send').textContent,
        boton: document.querySelector('[data-kitc-armar]').textContent }));
      comprobar(tallas === 5 && armado.carrito.base && armado.carrito.base.id === c.base && !!armado.carrito.base.talla
        && JSON.stringify(armado.carrito.charms) === JSON.stringify(ids.slice(1)) && armado.hoja === 'false' && armado.total === cop(t.total),
        '«Armar mi kit» pide la talla ahí mismo y abre el carrito con el brazalete y los 3 charms', JSON.stringify(armado));
      comprobar(armado.ahorro === 'Te ahorras ' + cop(t.descuento) + ' · 1 pieza gratis' && /^Tienes 4 piezas/.test(armado.barra)
        && / \| Ir a pagar$/.test(armado.barra) && armado.boton === 'Ir a pagar',
        'el carrito dice el ahorro junto al total, y la barra y el kit pasan a «Ir a pagar»', armado.ahorro + ' · ' + armado.barra);
      comprobar(!q.errs.length, 'consola limpia al armar el kit', q.errs.join(' | ') || undefined);
      await q.close();
    }
    const menu = await p.evaluate(() => ['.tnav', '.top-lupa', '.top-menu'].map(s => {
      const el = document.querySelector(s); return el ? getComputedStyle(el).display : 'none'; }));
    comprobar(menu.every(d => d === 'none'), 'sin menú, buscador ni hamburguesa', menu.join(','));
    /* El ícono de WhatsApp, a la vista y sin tapar el regalo, la barra ni un
       «Agregar». En celular y en computador. (El regalo no se pinta en un
       navegador automatizado; se compara contra su sitio: abajo a la izquierda.) */
    for (const ancho of [375, 1366]) {
      await p.setViewportSize({ width: ancho, height: 812 });
      await p.waitForTimeout(200);
      const wa = await p.evaluate(() => {
        const w = document.querySelector('.cp-wa-float'); if (!w || getComputedStyle(w).display === 'none') return 'no está';
        const a = w.getBoundingClientRect(), cruza = el => { if (!el) return false; const c = el.getBoundingClientRect();
          return c.width > 0 && !(a.right <= c.left || c.right <= a.left || a.bottom <= c.top || c.bottom <= a.top); };
        if (a.right > innerWidth || a.left < innerWidth / 2) return 'no está abajo a la derecha';
        if (cruza(document.getElementById('dock'))) return 'tapa la barra';
        if (cruza(document.getElementById('cp-kit'))) return 'tapa el kit';
        /* Con el kit arriba (2026-11-22) los destacados son una lista que
           sigue bajo el pliegue: en celular el ícono queda sobre alguna
           tarjeta según el alto de la pantalla, como en cualquier rejilla al
           rodar. Lo que no puede tapar es el kit ni la barra; en computador,
           donde todo cabe, tampoco un «Agregar». */
        return innerWidth >= 760 && [...document.querySelectorAll('.pc-add')].some(cruza) ? 'tapa un Agregar' : '';
      });
      comprobar(wa === '', `a ${ancho} px el ícono de WhatsApp se ve y no tapa la barra ni el kit` + (ancho >= 760 ? ' ni un «Agregar»' : ''), wa || undefined);
    }
    await p.setViewportSize({ width: 375, height: 812 });
    await p.waitForTimeout(200);
    comprobar(await p.locator('#dock-send').textContent() === 'Elige tu primera pieza',
      'con la selección vacía la barra dice «Elige tu primera pieza»');
    const url0 = p.url();
    await p.evaluate(() => document.querySelector('#destacadas .pc .pc-img').click());
    await p.waitForTimeout(700);
    comprobar(p.url() === url0 && await p.locator('#ficha').isVisible(), 'la foto abre la ficha ahí mismo, sin salir de la campaña');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    const primera = c.destacados.find(id => true);
    await p.evaluate(id => document.querySelector('#destacadas .pc[data-id="' + id + '"] .pc-add').click(), primera);
    await p.waitForTimeout(400);
    comprobar(await p.locator('#dock-send').textContent() === 'Ir a pagar' && /^Tienes 1 pieza/.test(await p.locator('#dock-n').textContent()),
      '«Agregar» la pone en el carrito y la barra pasa a «Tienes 1 pieza» · «Ir a pagar»');
    const barra = await p.evaluate(() => { const g = s => document.querySelector(s).getBoundingClientRect(), d = g('#dock'), n = document.getElementById('dock-n');
      return { dentro: ['#dock-n', '#dock-p', '#dock-open', '#dock-send'].every(s => { const r = g(s); return r.width > 0 && r.top >= d.top && r.bottom <= d.bottom && r.left >= 0 && r.right <= innerWidth; }),
        cortado: n.scrollWidth > n.clientWidth, ver: document.getElementById('dock-open').textContent.trim(), ancho: Math.round(g('#dock-send').width) }; });
    comprobar(barra.dentro && !barra.cortado && barra.ver === 'Ver pedido' && barra.ancho >= 150,
      'en la barra caben «Tienes 1 pieza…», el total, «Ver pedido» y el botón grande, sin cortarse', JSON.stringify(barra));
    /* En la ficha, «Agregar a mi pulsera» queda a la vista sin bajar. */
    await p.evaluate(() => document.querySelectorAll('#destacadas .pc .pc-img')[1].click());
    await p.waitForTimeout(700);
    const fx = await p.evaluate(() => { const a = document.getElementById('fx-add').getBoundingClientRect(); return { top: Math.round(a.top), alto: innerHeight, tx: document.getElementById('fx-add').textContent }; });
    comprobar(fx.top > 0 && fx.top < fx.alto - 40, 'en la ficha, «Agregar a mi pulsera» se ve sin bajar', JSON.stringify(fx));
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    comprobar(!p.errs.length, 'consola limpia', p.errs.join(' | ') || undefined);
    await p.close();

    /* Una destacada agotada no ocupa el primer pantallazo, aunque esté en la
       lista del anuncio: se muda al final de «Toda la colección». Se simula
       con el conteo en 0 (en vivo lo dice disponibilidad). */
    p = await nueva();
    const agotar = c.destacados[c.destacados.length - 1];
    await p.route('**/assets/stock.json*', async r => {
      const s = JSON.parse(fs.readFileSync(path.join(RAIZ, 'assets', 'stock.json'), 'utf8'));
      s.items[agotar].stock = 0;
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(s) });
    });
    await p.goto(BASE + '/' + c.archivo, { waitUntil: 'load' });
    await p.waitForTimeout(1200);
    const sitio = await p.evaluate(id => ({
      dest: [...document.querySelectorAll('#destacadas .pc')].map(e => e.dataset.id),
      ultima: [...document.querySelectorAll('#piezas .grid > .pc')].map(e => e.dataset.id).pop(),
    }), agotar);
    comprobar(!sitio.dest.includes(agotar) && sitio.dest.length === c.destacados.length - 1 && sitio.ultima === agotar,
      `una destacada agotada (${agotar}) sale del primer pantallazo y va al final de la colección`, JSON.stringify(sitio));
    await p.close();

    /* El escalón «Brazalete solo» pide la talla; «+ 3 charms» lleva a las
       piezas con un aviso. */
    p = await nueva();
    await p.goto(BASE + '/coleccion-marvel.html', { waitUntil: 'load' });
    await p.waitForTimeout(600);
    await p.evaluate(() => document.querySelector('#combo [data-elegir-base]').click());
    await p.waitForTimeout(900);
    comprobar(await p.evaluate(() => { const t = document.querySelector('#brazaletes .tallas');
      if (!t || t.hidden) return false; const r = t.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }),
      'Marvel: «Brazalete solo» abre la talla del brazalete, a la vista');
    await p.evaluate(() => document.querySelectorAll('#combo [data-ir]')[1].click());
    await p.waitForTimeout(900);
    comprobar(await p.evaluate(() => { const r = document.querySelector('#piezas').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })
      && /4 piezas/.test(await p.locator('#aviso-corto').textContent()),
      'Marvel: «+ 3 charms» lleva a las piezas y dice qué hacer');
    await p.close();

    /* Quien llega a la colección desde el anuncio pasa a la campaña (el
       enlace del anuncio no se puede cambiar sin perder su prueba social);
       las demás visitas se quedan en la colección. */
    /* Portada con ?cat=<grupo>: los anuncios de «Inicial y signo» caen ahí.
       Con fbclid pasa a su campaña; sin él, la portada filtra como siempre. */
    for (const c3 of CAMPANAS.filter(x => (x.portada_cat || []).length)) {
      const hp = leer('index.html');
      comprobar(hp.indexOf('redir-campana') > 0 && hp.indexOf('redir-campana') < hp.indexOf('fbq('),
        'index.html: la redirección de la portada va antes del píxel');
      p = await nueva();
      for (const g of c3.portada_cat) {
        await p.goto(BASE + '/index.html?cat=' + g + '&fbclid=IwAR0abc&utm_source=ig', { waitUntil: 'load' });
        await p.waitForTimeout(700);
        const u = new URL(p.url());
        comprobar(u.pathname.endsWith('/' + c3.archivo) && u.searchParams.get('fbclid') === 'IwAR0abc' && u.searchParams.get('utm_source') === 'ig',
          `portada ?cat=${g} con fbclid → ${c3.archivo}, conservando la consulta`, u.pathname + u.search);
      }
      await p.waitForTimeout(900);
      comprobar(await p.evaluate(() => document.querySelectorAll('#letras-grid .lbtn').length > 20 && document.querySelectorAll('#piezas .pc').length === 12) && !p.errs.length,
        'y la campaña carga bien: iniciales para tocar, 12 signos, consola limpia', p.errs.join(' | ') || undefined);
      await p.goto(BASE + '/index.html?cat=' + c3.portada_cat[0], { waitUntil: 'load' });
      await p.waitForTimeout(500);
      const u4 = new URL(p.url());
      await p.goto(BASE + '/index.html?fbclid=IwAR0abc', { waitUntil: 'load' });
      await p.waitForTimeout(500);
      comprobar(u4.pathname.endsWith('/index.html') && new URL(p.url()).pathname.endsWith('/index.html'),
        'sin fbclid, o con fbclid pero sin ese cat, la portada se queda');
      await p.close();
    }

    for (const c2 of CAMPANAS.filter(x => x.desde && ((x.anuncios || []).length || x.desde_meta))) {
      const h = leer(c2.desde);
      comprobar(h.indexOf('utm_content') > 0 && h.indexOf('utm_content') < h.indexOf('fbq('),
        `${c2.desde}: la redirección va antes del píxel (sin PageView de más)`);
      p = await nueva();
      for (const ad of (c2.anuncios || []).slice(0, 1)) {
        await p.goto(BASE + '/' + c2.desde + '?utm_source=ig&utm_content=' + ad + '&fbclid=abc', { waitUntil: 'load' });
        await p.waitForTimeout(600);
        const u = new URL(p.url());
        comprobar(u.pathname.endsWith('/' + c2.archivo) && u.searchParams.get('fbclid') === 'abc' && u.searchParams.get('utm_content') === ad,
          `del anuncio ${ad} → ${c2.archivo}, conservando utm y fbclid`, u.pathname + u.search);
      }
      /* desde_meta: el anuncio BF 4 no lleva utm, solo el fbclid que Meta le
         pone a todo clic. Con eso basta para pasar a la campaña. */
      await p.goto(BASE + '/' + c2.desde + '?fbclid=IwAR0abc_DEF-123', { waitUntil: 'load' });
      await p.waitForTimeout(600);
      const u2 = new URL(p.url());
      if (c2.desde_meta) {
        comprobar(u2.pathname.endsWith('/' + c2.archivo) && u2.searchParams.get('fbclid') === 'IwAR0abc_DEF-123',
          `un clic desde Facebook o Instagram (solo fbclid, sin utm) → ${c2.archivo}, conservando el fbclid`, u2.pathname + u2.search);
        await p.waitForTimeout(900);
        comprobar(await p.evaluate(() => document.querySelectorAll('#destacadas .pc').length > 0) && !p.errs.length,
          'y la campaña carga bien tras el salto (destacadas a la vista, consola limpia)', p.errs.join(' | ') || undefined);
      } else {
        comprobar(u2.pathname.endsWith('/' + c2.desde), `sin desde_meta, un fbclid suelto se queda en ${c2.desde}`);
      }
      await p.goto(BASE + '/' + c2.desde + '?utm_content=999&utm_source=google', { waitUntil: 'load' });
      await p.waitForTimeout(400);
      const u3 = new URL(p.url());
      await p.goto(BASE + '/' + c2.desde, { waitUntil: 'load' });
      await p.waitForTimeout(400);
      comprobar(u3.pathname.endsWith('/' + c2.desde) && new URL(p.url()).pathname.endsWith('/' + c2.desde) && !p.errs.length,
        `otra visita (sin fbclid: buscador, directa, otro utm) se queda en ${c2.desde}`);
      await p.close();
    }

    /* En computador y tableta también (pedido del propietario, 2026-11-20:
       «todo debe estar optimizado tanto para computador como para celular»).
       El 20-nov, a lo ancho, el «Elegir…» de cada escalón se salía de su
       tarjeta y el brazalete quedaba en la columna equivocada. */
    for (const ancho of [1366, 800]) {
      for (const pag of [c.archivo, 'coleccion-marvel.html', 'kit-avengers.html']) {
        p = await b.newPage({ viewport: { width: ancho, height: 800 } });
        const errs = []; p.on('pageerror', e => errs.push(e.message));
        await p.goto(BASE + '/' + pag, { waitUntil: 'load' });
        await p.waitForTimeout(600);
        const r = await p.evaluate(() => {
          const dentro = (h, cont) => { const a = h.getBoundingClientRect(), c = cont.getBoundingClientRect();
            return a.left >= c.left - 1 && a.right <= c.right + 1 && a.top >= c.top - 1 && a.bottom <= c.bottom + 1; };
          const fuera = [...document.querySelectorAll('button.col-paso')].filter(bt =>
            [...bt.children].some(h => !dentro(h, bt))).length;
          const base = document.querySelector('.cp-base');
          let lado = true;
          if (base) { const t = base.querySelector('.pc').getBoundingClientRect(), e = base.querySelector('.col-escalera').getBoundingClientRect();
            lado = t.right <= e.left && Math.abs(t.top - e.top) < 40; }
          return { fuera, lado, des: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        });
        comprobar(r.fuera === 0 && r.lado && r.des <= 0 && !errs.length,
          `${pag} a ${ancho} px: nada se sale de su tarjeta ni desborda`, JSON.stringify(r) + (errs.length ? ' ' + errs.join('|') : ''));
        await p.close();
      }
    }

    /* Ninguna página con el botón muerto: con la selección vacía, tocarlo
       mueve la página hasta algo que elegir. */
    for (const [pag, sel] of [['index.html', '#brazaletes'], ['coleccion-marvel.html', '#piezas'], ['coleccion-simbolos.html', '#piezas'],
      ['kits.html', '#kits'], ['kit-avengers.html', '#kit-avengers'], ['kit-luz-y-suenos.html', '#kit-luz-y-suenos'],
      ['coleccion-mas-vendidos.html', '.mv'], [c.archivo, '#destacadas']]) {
      p = await nueva();
      await p.goto(BASE + '/' + pag, { waitUntil: 'load' });
      await p.waitForTimeout(600);
      await p.evaluate(() => { scrollTo(0, document.body.scrollHeight); });
      await p.waitForTimeout(300);
      const txt = await p.locator('#dock-send').textContent();
      await p.evaluate(() => document.getElementById('dock-send').click());
      /* El desplazamiento es suave: en una página larga, desde el pie, tarda. */
      await p.waitForTimeout(2200);
      const ve = await p.evaluate(s => { const el = document.querySelector(s); if (!el) return 'no existe ' + s;
        const r = el.getBoundingClientRect(); return r.top < innerHeight * 0.6 && r.bottom > 0 ? '' : 'fuera de vista'; }, sel);
      comprobar(txt === 'Elige tu primera pieza' && !ve && !p.errs.length,
        `${pag}: «Elige tu primera pieza» lleva a ${sel}`, [txt, ve, ...p.errs].filter(Boolean).join(' · ') || undefined);
      await p.close();
    }
  } catch (e) { mal('la parte del navegador reventó', e.message.split('\n')[0]); }
  finally { await b.close(); }

  console.log(fallos ? `\nCampañas: ${fallos} en rojo` : '\nCampañas y conversión en verde ✓');
  if (fallos) process.exitCode = 1;
}

main().catch(e => { console.log('  ✗ FALLA la batería reventó — ' + (e.stack || e.message)); process.exitCode = 1; });
