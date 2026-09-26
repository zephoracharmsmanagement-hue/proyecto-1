'use strict';
/* Suscripción por correo con charm de regalo (automatizaciones/suscripcion/BRIEF.md).
 *
 * De punta a punta con las funciones reales y almacenes falsos: suscribirse,
 * confirmar desde el enlace del correo, y que el regalo se marque en el pedido
 * SIN tocar el total, se gaste solo cuando el pedido se confirma (un pago
 * rechazado no lo gasta) y no se use dos veces. Y la ventana del sitio,
 * renderizada: casilla sin marcar, Lead al suscribirse.
 */
const path = require('path');
const crypto = require('crypto');
const RAIZ = path.join(__dirname, '..');
const BASE = process.env.URL || 'http://localhost:8899';

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));
const copia = v => (v == null ? v : JSON.parse(JSON.stringify(v)));

/* Un almacén de Blobs falso con lo que usan los cuatro módulos: get, CAS con
   etag, delete y list. */
function almacen() {
  const d = {}; let n = 0;
  return {
    async get(k) { return d[k] ? copia(d[k].v) : null; },
    async getWithMetadata(k) { return d[k] ? { data: copia(d[k].v), etag: d[k].e, metadata: {} } : null; },
    async setJSON(k, v, o = {}) {
      if (o.onlyIfNew && d[k]) return { modified: false };
      if (o.onlyIfMatch && (!d[k] || d[k].e !== o.onlyIfMatch)) return { modified: false };
      d[k] = { v: copia(v), e: 'e' + (++n) }; return { modified: true };
    },
    async delete(k) { delete d[k]; },
    async list() { return { blobs: Object.keys(d).map(key => ({ key })) }; },
  };
}

const CLIENTE = correo => ({ nombre: 'Prueba', apellido: 'Suscrita', tipodoc: 'CC', documento: '1234567',
  celular: '3001234567', correo, depto: 'Bogotá D.C.', ciudad: 'Bogotá', direccion: 'Calle 1 # 2-3' });

async function main() {
  Object.assign(process.env, {
    SUSCRIPCION_SECRETO: 'secreto-de-prueba-de-la-suscripcion', SUSCRIPTORES_KEY: 'clave-export-de-prueba-32-caracteres',
    RESEND_API_KEY: 're_prueba', CORREO_TIENDA: 'tienda@ejemplo.com', URL_SITIO: 'https://tienda.test',
    WOMPI_LLAVE_PUBLICA: 'pub_test_zephora', WOMPI_INTEGRIDAD: 'integridad_prueba', WOMPI_EVENTOS: 'eventos_prueba',
  });
  delete process.env.META_CAPI_TOKEN; delete process.env.HOJA_WEBHOOK; delete process.env.PEDIDOS_WEBHOOK;

  const correos = [];
  global.fetch = async (url, op) => {
    url = String(url);
    if (url.includes('api.resend.com')) { correos.push(JSON.parse(op.body)); return new Response('{}', { status: 200 }); }
    return new Response('{"data":{}}', { status: 200 });     // Wompi: el comercio existe
  };

  const F = '../netlify/functions/';
  const inv = await import(F + '_inventario.mjs'), ped = await import(F + '_pedidos.mjs');
  const atr = await import(F + '_atribucion.mjs'), sus = await import(F + '_suscriptores.mjs');
  inv._interno.usarAlmacen(almacen()); ped._interno.usarAlmacen(almacen());
  atr.usarAlmacen(almacen()); sus._interno.usar(almacen());
  const suscribir = await import(F + 'suscribir.mjs'), exportar = await import(F + 'suscriptores-export.mjs');
  const crearPago = await import(F + 'crear-pago.mjs'), webhook = await import(F + 'wompi-webhook.mjs');

  const pedir = (mod, { metodo = 'POST', url = 'https://tienda.test/x', cuerpo, cabeceras = {} } = {}) =>
    mod.default({ method: metodo, url, headers: new Headers(cabeceras), text: async () => (cuerpo ? JSON.stringify(cuerpo) : '') });
  const leerJ = async r => ({ s: r.status, d: JSON.parse(await r.text()) });

  const stock = require(path.join(RAIZ, 'assets', 'stock.json')).items;
  const [c1, c2] = Object.keys(stock).filter(i => stock[i].tipo === 'charm' && stock[i].stock >= 3 && !/^letra-/.test(i));

  console.log('\n1 · Suscribirse');
  {
    let r = await leerJ(await pedir(suscribir, { cuerpo: { correo: 'ana@ejemplo.com' } }));
    comprobar(r.s === 400, 'sin la casilla aceptada → 400');
    r = await leerJ(await pedir(suscribir, { cuerpo: { correo: 'ana@ejemplo.com', acepta: 'true' } }));
    comprobar(r.s === 400, '"true" como texto no es autorización → 400');
    const n = correos.length;
    r = await leerJ(await pedir(suscribir, { cuerpo: { correo: 'bot@ejemplo.com', acepta: true, web: 'http://spam' } }));
    comprobar(r.s === 200 && correos.length === n, 'campo trampa lleno → 200 y no se manda nada');
    r = await leerJ(await pedir(suscribir, { cuerpo: { correo: 'Ana@Ejemplo.com ', acepta: true } }));
    const c = correos[correos.length - 1];
    comprobar(r.s === 200 && c && c.to[0] === 'ana@ejemplo.com' && /suscribir\?confirmar=/.test(c.html),
      'correo válido → 200 y llega el enlace de confirmación');
    comprobar(!(await sus.leer('ana@ejemplo.com')), 'y todavía no se guarda nada (doble confirmación)');
    const otro = await leerJ(await pedir(suscribir, { cuerpo: { correo: 'nueva@ejemplo.com', acepta: true } }));
    comprobar(otro.d.mensaje === r.d.mensaje, 'responde lo mismo exista o no el correo');
  }

  console.log('\n2 · Confirmar y darse de baja');
  const confirmar = async correo => {
    const t = sus.firmar('confirmar', correo);
    const r = await pedir(suscribir, { metodo: 'GET', url: 'https://tienda.test/suscribir?confirmar=' + encodeURIComponent(t) });
    return r.text();
  };
  {
    const html = await confirmar('ana@ejemplo.com');
    const reg = await sus.leer('ana@ejemplo.com');
    comprobar(/ya estás suscrita/.test(html) && reg && reg.confirmado && reg.regaloUsado === null, 'el enlace firmado confirma');
    comprobar(/zephora\.suscrita/.test(html), 'y marca este navegador como suscrito (para el aviso del checkout)');
    const t = sus.firmar('confirmar', 'eva@ejemplo.com');
    const alterado = t.slice(0, -2) + (t.endsWith('a') ? 'bb' : 'aa');
    const h1 = await (await pedir(suscribir, { metodo: 'GET', url: 'https://tienda.test/suscribir?confirmar=' + encodeURIComponent(alterado) })).text();
    comprobar(/ya no sirve/.test(h1) && !(await sus.leer('eva@ejemplo.com')), 'token alterado → no confirma');
    const viejo = sus.firmar('confirmar', 'eva@ejemplo.com', Date.now() - 8 * 864e5);
    comprobar(sus.verificar('confirmar', viejo) === null, 'token de hace 8 días → vencido');
    comprobar(sus.verificar('baja', t) === null, 'un token de confirmar no sirve para darse de baja');
  }

  console.log(`\n3 · El regalo en el pedido (charms de prueba: ${c1}, ${c2})`);
  /* Inventario limpio en cada pedido: aquí se prueba el regalo, no el stock, y
     varios pedidos seguidos agotarían las piezas de prueba. */
  const crear = async (correo, charms, pago) => {
    inv._interno.usarAlmacen(almacen());
    const r = await pedir(crearPago, { cuerpo: { charms, base: null, pago, cliente: CLIENTE(correo) } });
    return leerJ(r);
  };
  {
    let r = await crear('ana@ejemplo.com', [c1], 'contraentrega');
    comprobar(r.s === 200 && !r.d.regalo, 'suscrita con 1 charm → sin regalo');
    const sinSus = await crear('nadie@ejemplo.com', [c1, c2], 'contraentrega');
    const n = correos.length;
    r = await crear('ana@ejemplo.com', [c1, c2], 'contraentrega');
    comprobar(r.s === 200 && r.d.regalo === 'suscriptor', 'suscrita con 2 charms → pedido marcado con regalo');
    comprobar(r.d.total === sinSus.d.total, `el total cobrado es idéntico con y sin suscripción (${r.d.total})`);
    const tienda = correos.slice(n).find(c => c.to[0] === 'tienda@ejemplo.com');
    const cliente = correos.slice(n).find(c => c.to[0] === 'ana@ejemplo.com');
    comprobar(tienda && /INCLUIR REGALO DE SUSCRIPTOR/.test(tienda.html) && /INCLUIR REGALO/.test(tienda.text)
      && /REGALO/.test(tienda.subject), 'la hoja de despacho dice INCLUIR REGALO (html, texto y asunto)');
    comprobar(cliente && /charm de regalo por estar suscrita/.test(cliente.html), 'y el comprobante de la clienta lo menciona');
    comprobar((await sus.leer('ana@ejemplo.com')).regaloUsado === r.d.referencia, 'contraentrega gasta el regalo al crearse');
    r = await crear('ana@ejemplo.com', [c1, c2], 'contraentrega');
    comprobar(!r.d.regalo, 'el segundo pedido ya no lleva regalo');
  }

  console.log('\n4 · Pago en línea: el regalo se gasta con el pago aprobado');
  const avisar = async (ref, total, estado) => {
    const evento = { event: 'transaction.updated', timestamp: 1786290000,
      data: { transaction: { id: 'tx-' + ref, reference: ref, status: estado, amount_in_cents: total * 100,
        customer_email: 'bea@ejemplo.com', payment_method_type: 'NEQUI' } },
      signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'] } };
    evento.signature.checksum = crypto.createHash('sha256')
      .update(`tx-${ref}${estado}${total * 100}${evento.timestamp}eventos_prueba`).digest('hex');
    return (await pedir(webhook, { cuerpo: evento })).status;
  };
  {
    await confirmar('bea@ejemplo.com');
    let r = await crear('bea@ejemplo.com', [c1, c2], 'anticipado');
    comprobar(r.s === 200 && r.d.regalo === 'suscriptor', 'el pedido en línea se marca con regalo');
    comprobar((await sus.leer('bea@ejemplo.com')).regaloUsado === null, 'pero no lo gasta todavía');
    comprobar(await avisar(r.d.referencia, r.d.total, 'DECLINED') === 200
      && (await sus.leer('bea@ejemplo.com')).regaloUsado === null, 'pago rechazado → el regalo sigue sin usar');
    const n = correos.length;
    r = await crear('bea@ejemplo.com', [c1, c2], 'anticipado');
    comprobar(await avisar(r.d.referencia, r.d.total, 'APPROVED') === 200
      && (await sus.leer('bea@ejemplo.com')).regaloUsado === r.d.referencia, 'pago aprobado → regalo usado');
    const pagado = correos.slice(n).find(c => c.to[0] === 'tienda@ejemplo.com' && /^PAGADO/.test(c.subject));
    comprobar(pagado && /INCLUIR REGALO DE SUSCRIPTOR/.test(pagado.html), 'la hoja de «PAGADO» lo pide');
    r = await crear('bea@ejemplo.com', [c1, c2], 'anticipado');
    comprobar(!r.d.regalo, 'el pedido siguiente ya no lleva regalo');
  }

  console.log('\n5 · Lista para envíos y baja');
  {
    let r = await pedir(exportar, { metodo: 'GET' });
    comprobar(r.status === 401, 'suscriptores-export sin clave → 401');
    r = await leerJ(await pedir(exportar, { metodo: 'GET', cabeceras: { 'x-zephora-automation-key': process.env.SUSCRIPTORES_KEY } }));
    const correosLista = r.d.suscriptoras.map(s => s.correo).sort();
    comprobar(r.s === 200 && JSON.stringify(correosLista) === JSON.stringify(['ana@ejemplo.com', 'bea@ejemplo.com'])
      && r.d.suscriptoras.every(s => /suscribir\?baja=/.test(s.baja)), 'devuelve solo las confirmadas, cada una con su enlace de baja');
    const baja = r.d.suscriptoras[0].baja.split('?')[1];
    const h = await (await pedir(suscribir, { metodo: 'GET', url: 'https://tienda.test/suscribir?' + baja })).text();
    comprobar(/Te diste de baja/.test(h) && !(await sus.leer(r.d.suscriptoras[0].correo)), 'el enlace de baja borra el registro');
  }

  console.log('\n6 · La ventana del sitio (renderizada)');
  const { chromium } = require('playwright');
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    const ev = [];
    await ctx.exposeBinding('__rec', (_, a) => ev.push(a));
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.fbq = (...a) => window.__rec(JSON.parse(JSON.stringify(a)));
    });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('**/suscribir', r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, mensaje: 'x' }) }));
    await p.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
    comprobar(!(await p.locator('.susc').count()), 'no aparece al entrar');
    /* Desde el 2026-09-26 tocar una joya lleva a su página: cada página vista
       cuenta. En la segunda se abre en seguida su galería (la ficha), y la
       invitación tiene que esperar a que se cierre. */
    await Promise.all([p.waitForURL(/producto-.+\.html/), p.evaluate(() => { document.querySelectorAll('.pc--top .pc-img')[0].click(); })]);
    await p.waitForTimeout(900);
    comprobar(!(await p.locator('.susc').count()), 'con 1 producto visto todavía no aparece');
    await p.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
    const segunda = await p.evaluate(() => document.querySelectorAll('.pc--top')[1].dataset.id);
    await Promise.all([p.waitForURL(u => u.pathname.endsWith('/producto-' + segunda + '.html'), { waitUntil: 'domcontentloaded' }),
      p.evaluate(() => { document.querySelectorAll('.pc--top .pc-img')[1].click(); })]);
    await p.evaluate(() => document.querySelector('.pc--pp .pc-img').click());
    await p.waitForTimeout(900);
    comprobar(!(await p.locator('.susc').count()), 'con la ficha abierta no se sobrepone');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(4500);
    comprobar(await p.locator('.susc').isVisible(), 'tras ver 2 productos, aparece al cerrar la ficha');
    comprobar(!(await p.locator('.susc input[name=acepta]').isChecked()), 'la casilla de autorización va sin marcar');
    await p.click('.susc-x');
    await p.waitForTimeout(200);
    comprobar(!(await p.locator('.susc').count()) && await p.locator('.susc-fab').isVisible(),
      'al cerrarla con la X queda el botón de regalo');
    const wa = await p.locator('.wa-float').boundingBox(), fab = await p.locator('.susc-fab').boundingBox();
    comprobar(fab.x < 60 && wa.x > 300 && Math.abs(fab.y - wa.y) < 4, 'al lado contrario del de WhatsApp, a su altura');
    await p.click('.susc-fab');
    await p.waitForTimeout(200);
    comprobar(await p.locator('.susc').isVisible() && !(await p.locator('.susc-fab').isVisible()), 'y el botón la vuelve a abrir');
    await p.fill('.susc input[name=correo]', 'cami@ejemplo.com');
    await p.click('.susc button[type=submit]');
    await p.waitForTimeout(300);
    comprobar(/Marca la casilla/.test(await p.textContent('.susc-msg')), 'sin la casilla no envía');
    await p.check('.susc input[name=acepta]');
    await p.click('.susc button[type=submit]');
    await p.waitForTimeout(400);
    const lead = ev.filter(e => e[1] === 'Lead');
    comprobar(lead.length === 1 && lead[0][2].content_name === 'suscripcion', 'al suscribirse manda Lead content_name «suscripcion»');
    comprobar(/Revisa tu correo/.test(await p.textContent('.susc')), 'y le dice que revise su correo');
    await p.click('.susc-x');
    await p.waitForTimeout(200);
    comprobar(!(await p.locator('.susc-fab').isVisible()), 'ya suscrita, el botón de regalo no vuelve');
    const des = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    comprobar(des <= 0 && !errs.length, `sin desborde a 390 px (${des}) y consola ${errs.length ? 'con errores: ' + errs.join(' | ') : 'limpia'}`);
    if (process.env.CAPTURAS) await p.screenshot({ path: path.join(process.env.CAPTURAS, 'suscripcion.png') });
  } catch (e) { mal('la ventana no se pudo probar', e.message.split('\n')[0]); }
  finally { await b.close(); }

  console.log(fallos ? `\n${fallos} comprobaciones en rojo.` : '\nTodo en verde.');
}

main().catch(e => console.log('  ✗ FALLA la batería reventó — ' + (e.stack || e.message)));
