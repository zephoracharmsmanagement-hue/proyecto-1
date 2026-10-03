/* El camino completo de una compra: armar, llenar los datos, pagar.
 *
 * No hace falta Netlify levantado. La página llama a
 * /.netlify/functions/crear-pago, y aquí se intercepta esa llamada y se ejecuta
 * el handler de verdad dentro de Node. Se prueba el código que va a producción,
 * no un doble que se le parezca.
 *
 * Y se prueba lo que de verdad importa de un checkout: que no cobre de menos si
 * alguien manipula el carrito, que no deje pasar datos de envío inválidos, y
 * que la firma que se manda a Wompi sea la que Wompi espera.
 */
const { chromium } = require('playwright');
const crypto = require('crypto');
const path = require('path');

const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:8899';

/* El brazalete de las pruebas sale del inventario, no de un id escrito aquí
   —ver pruebas/_pieza.js—. Vender la última unidad de una pieza es lo normal
   en una tienda; que eso ponga roja media suite, no. */
const { brazalete } = require('./_pieza');
/* El mismo formateador de pesos que usa la página: comparar «$25.500» con
   «$25500» daría un falso rojo por el punto de miles. */
const { cop } = require(path.join(__dirname, '..', 'netlify', 'functions', '_precios.js'));
const BRZ = brazalete();
const RAIZ = path.join(__dirname, '..');

/* Entorno de mentira, con secretos de mentira, para que la función crea que
   está configurada. La firma se comprueba recalculándola con este mismo valor. */
const INTEGRIDAD = 'prueba_integridad_no_es_un_secreto_real';
process.env.WOMPI_LLAVE_PUBLICA = 'pub_test_zephora';
process.env.WOMPI_INTEGRIDAD = INTEGRIDAD;
process.env.URL_SITIO = BASE;

/* Las funciones son v2 (`export default`, en .mjs) porque Netlify solo inyecta
   el contexto de Blobs en esa versión — ver la cabecera de _inventario.js. Como
   esta batería es CommonJS, se cargan con import() dinámico dentro del IIFE. */
const { pathToFileURL } = require('url');
const cargar = f => import(pathToFileURL(path.join(RAIZ, 'netlify', 'functions', f)).href);
let crearPago, webhook;

/* Adaptador: las pruebas hablan en {httpMethod, body} → {statusCode, body},
   que es como se leen bien las aserciones, y aquí se traduce a la Request y la
   Response que la función v2 espera y devuelve. Traducir en un solo sitio
   evitó reescribir las quince llamadas de esta batería. */
const invocar = async (fn, opciones) => {
  const init = { method: opciones.httpMethod || 'GET' };
  if (opciones.body != null) {
    init.body = opciones.body;
    init.headers = { 'Content-Type': 'application/json' };
  }
  const res = await fn(new Request('https://zephoracharms.com/.netlify/functions/x', init));
  return { statusCode: res.status, body: await res.text() };
};

/* Las funciones salen a la red por dos motivos: preguntarle a Wompi si el
   comercio existe, y mandar los correos por Resend. Se responde que sí a todo
   sin salir a internet — la batería no puede depender de que ninguno de los dos
   esté disponible, ni de tener llaves reales. `correos` guarda lo que se habría
   mandado para poder revisarlo. La sección 5 cambia este doble a propósito. */
const correos = [];
globalThis.fetch = async (url, opciones) => {
  if (String(url).includes('api.resend.com')) {
    correos.push(JSON.parse((opciones && opciones.body) || '{}'));
    return { ok: true, status: 200, text: async () => '' };
  }
  return { ok: true, status: 200, text: async () => '' };
};
/* Con llave puesta, para que el envío de correo se ejecute de verdad. */
process.env.RESEND_API_KEY = 're_prueba';
process.env.CORREO_TIENDA = 'tienda@ejemplo.com';

const out = [];
let fallas = 0;
const ok = (b, t, extra) => {
  if (!b) fallas++;
  out.push(`  ${b ? '✓' : '✗'} ${t}${extra ? ` — ${extra}` : ''}`);
};

const DATOS = {
  nombre: 'María', apellido: 'Gómez',
  celular: '3012345678', correo: 'maria@ejemplo.com',
  direccion: 'Calle 45 # 12 - 30', adicional: 'Apto 501', barrio: 'Chapinero',
};

/* Deja el carrito puesto sin tener que tocar el armador entero: más rápido y no
   arrastra los tropiezos del catálogo a una prueba que va de otra cosa. */
async function ponerCarrito(p, carrito) {
  await p.addInitScript(c => {
    /* Solo en la primera carga. addInitScript corre en cada navegación, así que
       sin esta marca el carrito se volvería a poner al llegar a gracias.html y
       nunca se podría comprobar que la compra lo vacía. */
    if (localStorage.getItem('prueba.carrito.puesto')) return;
    localStorage.setItem('prueba.carrito.puesto', '1');
    localStorage.setItem('zephora.carrito.v1', JSON.stringify(
      Object.assign({ v: 1, cuando: Date.now() }, c)));
  }, carrito);
}

/* La página llama a la función; aquí se ejecuta de verdad. `capturado` guarda
   lo que se pidió y lo que se respondió para poder revisarlo después. */
function interceptar(p, capturado) {
  return p.route('**/.netlify/functions/crear-pago', async route => {
    const body = route.request().postData() || '{}';
    const r = await invocar(crearPago.default, { httpMethod: 'POST', body });
    capturado.push({ pedido: JSON.parse(body), respuesta: JSON.parse(r.body), codigo: r.statusCode });
    await route.fulfill({ status: r.statusCode, contentType: 'application/json', body: r.body });
  });
}

async function llenarDatos(p, d) {
  await p.fill('#nombre', d.nombre);
  await p.fill('#apellido', d.apellido);
  await p.fill('#celular', d.celular);
  await p.fill('#correo', d.correo);
  await p.selectOption('#depto', 'Bogotá D.C.');
  await p.selectOption('#ciudad', 'Bogotá D.C.');
  await p.fill('#direccion', d.direccion);
  await p.fill('#adicional', d.adicional);
  await p.fill('#barrio', d.barrio);
}

(async () => {
  [crearPago, webhook] = await Promise.all([cargar("crear-pago.mjs"), cargar("wompi-webhook.mjs")]);
  const b = await chromium.launch();
  const errores = [];

  // ——— 1 · carrito vacío ———
  out.push('1 · Sin carrito');
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => errores.push(e.message));
    await p.goto(BASE + '/checkout.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    ok(await p.locator('#vacio').isVisible(), 'ofrece volver al catálogo en vez de un checkout en blanco');
    ok(!(await p.locator('#app').isVisible()), 'no muestra el formulario');
    await p.close();
  }

  // ——— 2 · una sola página (2026-10-02) ———
  out.push('\n2 · Una sola página, sin preguntas de más');
  {
    /* Pedido del propietario: todo en una página, sin cédula (las
       transportadoras ya no la piden), sin volver a preguntar la forma de pago
       que ya se eligió en el carrito, sin la pregunta de envío, sin la casilla
       de «He leído y acepto» y sin «Te puede interesar», que ya se vio en el
       carrito. Lo que se vigila es que no vuelva ninguno por descuido. */
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => errores.push(e.message));
    await ponerCarrito(p, { base: { id: BRZ.id, talla: BRZ.talla }, charms: ['iron-man'], empaque: false, pago: 'anticipado' });
    await p.goto(BASE + '/checkout.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);

    const hay = sel => p.evaluate(s => !!document.querySelector(s), sel);
    ok(!(await hay('#pasos, .paso, #ir-2, #ir-3, #panel-2, #panel-3')), 'no hay pasos ni botones de «Continuar»');
    ok(!(await hay('#documento, #tipodoc')), 'no pide documento de identidad');
    ok(!(await hay('#acepta')), 'no hay casilla de términos que marcar');
    ok(!(await hay('input[name="entrega"]')), 'no pregunta la forma de envío (hay una sola)');
    ok(!(await hay('#sug, [data-sug]')), 'ni la tira «Te puede interesar», que ya se vio en el carrito');
    ok(!(await hay('#bump, #bump-chk')), 'ni el order bump del Empaque Premium');
    ok(await p.locator('#nombre').isVisible() && await p.locator('#confirmar').isVisible(),
      'los datos y el botón de pagar están en la misma página');

    /* La forma de pago del carrito se confirma, no se vuelve a preguntar. */
    ok(!(await p.locator('#ops-pago').isVisible()), 'las dos formas de pago no se muestran de entrada');
    ok(/Pagar ahora/i.test(await p.locator('#pago-elegido-tx').textContent()),
      'se ve, en una línea, la que eligió en el carrito');
    const total = (await p.locator('#res-total').textContent()).trim();
    ok((await p.locator('#confirmar').textContent()).includes(total), 'el botón dice cuánto va a pagar', total);

    /* Confirmar es aceptar: el aviso va junto al botón, con los tres enlaces. */
    const legal = await p.evaluate(() => { const l = [...document.querySelectorAll('#panel-pago .legal')][0];
      return { tx: l.textContent, links: [...l.querySelectorAll('a')].map(a => a.getAttribute('href')),
        despues: !!(document.querySelector('#confirmar').compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING) }; });
    ok(/Al confirmar aceptas/.test(legal.tx) && legal.despues
      && ['terminos-y-condiciones.html', 'politica-de-privacidad.html', 'envios-y-devoluciones.html'].every(h => legal.links.includes(h)),
      'debajo del botón: «Al confirmar aceptas…» con términos, privacidad y envíos');

    const falta = (await p.locator('#env-nota').textContent()).trim();
    ok(/faltan|envío gratis/i.test(falta), 'el resumen dice lo del envío gratis', falta);
    const aval = (await p.locator('.aval-n').textContent()).trim();
    ok(/2\.400/.test(aval) && /verificad/i.test(aval), 'la prueba social va junto al botón de pagar', aval.slice(0, 40) + '…');

    /* Validación: el botón es la única puerta. Vacío, no manda nada, marca y
       lleva al primer campo que falta. */
    await p.click('#confirmar');
    await p.waitForTimeout(300);
    ok((await p.locator('.campo.mal').count()) >= 5, 'con el formulario vacío marca en rojo lo que falta',
      `${await p.locator('.campo.mal').count()} marcados`);
    ok(await p.locator('#aviso-error').isVisible(), 'y lo dice arriba');
    ok(await p.evaluate(() => document.activeElement && document.activeElement.id === 'nombre'),
      'y deja el cursor en el primer campo que falta');

    await llenarDatos(p, Object.assign({}, DATOS, { celular: '6012345678' }));
    await p.click('#confirmar');
    ok(await p.locator('[data-c="celular"]').evaluate(e => e.classList.contains('mal')),
      'rechaza un fijo donde va un celular (601…)');
    await p.fill('#celular', '301 234 5678');
    ok(!(await p.locator('[data-c="celular"]').evaluate(e => e.classList.contains('mal'))),
      'y acepta el celular con espacios');

    // ciudad "Otro municipio" abre el campo de texto
    await p.selectOption('#depto', 'Antioquia');
    await p.selectOption('#ciudad', '__otro__');
    ok(await p.locator('[data-c="ciudadotra"]').isVisible(),
      'elegir «Otro municipio» abre el campo para escribirlo');
    await p.selectOption('#ciudad', 'Medellín');
    ok(!(await p.locator('[data-c="ciudadotra"]').isVisible()),
      'y se vuelve a ocultar al elegir uno de la lista');
    await p.close();
  }

  // ——— 2ba · la escalera del descuento ———
  out.push('\n2ba · La barra de «lleva 4, paga 3», visible sin abrir el resumen');
  {
    /* Lo que sostiene la barra: que se vea en el móvil con el resumen cerrado
       —si hay que abrirlo, no empuja—, que llene una casilla por pieza de la
       vuelta en curso (brazalete y charms cuentan igual) y que diga cuántas
       faltan para la gratis, o la celebre. */
    const casos = [
      { charms: [], base: true, llenos: 1, dice: /Agrega 3 piezas más/i },
      { charms: ['iron-man'], base: true, llenos: 2, dice: /Agrega 2 piezas más/i },
      { charms: ['iron-man', 'stitch'], base: true, llenos: 3, dice: /Agrega 1 pieza más para que te salga GRATIS/i },
      { charms: ['iron-man', 'stitch', 'mickey-mouse'], base: true, llenos: 4, dice: /Felicidades, tienes 1 pieza GRATIS/i },
      { charms: ['iron-man', 'stitch', 'mickey-mouse', 'hulk', 'minnie-mouse'], base: true, llenos: 2, dice: /Ya tienes 1 pieza GRATIS.*Agrega 2 piezas más/i },
    ];
    for (const k of casos) {
      const p = await b.newPage({ viewport: { width: 390, height: 844 } });
      p.on('pageerror', e => errores.push(e.message));
      await ponerCarrito(p, { base: k.base ? { id: BRZ.id, talla: BRZ.talla } : null, charms: k.charms, empaque: false, pago: 'anticipado' });
      await p.goto(BASE + '/checkout.html', { waitUntil: 'networkidle' });
      await p.waitForTimeout(300);
      const r = await p.evaluate(() => {
        const d = document.querySelector('#dto'), caja = d.getBoundingClientRect();
        return { visible: !d.hidden && caja.height > 0 && caja.bottom <= innerHeight,
          cerrado: !document.querySelector('#res').classList.contains('is-on'),
          tramos: document.querySelectorAll('#dto-pasos li').length,
          llenos: document.querySelectorAll('#dto-pasos li.is-on').length,
          nota: document.querySelector('#dto-nota').textContent.trim() };
      });
      const n = k.charms.length + ' charm' + (k.charms.length === 1 ? '' : 's') + (k.base ? ' + brazalete' : '');
      ok(r.visible && r.cerrado, `${n}: la barra se ve con el resumen cerrado`);
      ok(r.tramos === 4 && r.llenos === k.llenos, `${n}: llena ${k.llenos} de 4 casillas`, `${r.llenos}/${r.tramos}`);
      ok(k.dice.test(r.nota), `${n}: dice lo que corresponde`, r.nota);
      /* Con una gratis, la línea de esa pieza va tachada con «GRATIS» y lo
         tachado es exactamente el renglón del descuento del resumen. */
      if (/GRATIS/.test(r.nota) && /tienes/i.test(r.nota)) {
        const g = await p.evaluate(() => {
          const t = [...document.querySelectorAll('#res-lineas .rrow-p--gratis s')].map(s => +s.textContent.replace(/\D/g, ''));
          const f = document.querySelector('#res-totales .tot-row.save b');
          return { tachado: t.reduce((a, b) => a + b, 0), lineas: t.length,
            dice: [...document.querySelectorAll('#res-lineas .rrow-p--gratis b')].every(b => b.textContent.trim() === 'GRATIS'),
            resumen: f ? +f.textContent.replace(/\D/g, '') : 0 };
        });
        ok(g.lineas === 1 && g.dice && g.tachado === g.resumen && g.resumen > 0,
          `${n}: la pieza gratis sale tachada con «GRATIS» y cuadra con el resumen`, JSON.stringify(g));
      }
      await p.close();
    }
    {
      const p = await b.newPage({ viewport: { width: 390, height: 844 } });
      await ponerCarrito(p, { base: null, charms: [], empaque: false, pago: 'anticipado' });
      await p.goto(BASE + '/checkout.html', { waitUntil: 'networkidle' });
      ok(!(await p.locator('#dto').isVisible()), 'con el carrito vacío no se pinta');
      await p.close();
    }
  }

  // ——— 2bb · un carrito guardado de antes no puede cobrar el empaque ———
  out.push('\n2bb · El empaque retirado no se cuela por un carrito guardado');
  {
    /* El caso peligroso del retiro: una clienta que marcó el Empaque Premium
       la semana pasada tiene `empaque:true` en su localStorage. Ya no hay
       casilla que lo enseñe ni que lo quite, así que si el checkout lo
       heredara le cobraría $40.000 invisibles. Tiene que valer exactamente lo
       mismo que el carrito equivalente sin empaque. */
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => errores.push(e.message));
    const piezas = { base: { id: BRZ.id, talla: BRZ.talla }, charms: ['mickey-mouse', 'stitch'] };

    await ponerCarrito(p, Object.assign({}, piezas, { empaque: false, pago: 'anticipado' }));
    await p.goto(BASE + '/checkout.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    const limpio = (await p.locator('#res-total').textContent()).trim();

    await ponerCarrito(p, Object.assign({}, piezas, { empaque: true, pago: 'anticipado' }));
    await p.goto(BASE + '/checkout.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    const heredado = (await p.locator('#res-total').textContent()).trim();

    ok(limpio === heredado,
      'un carrito guardado con empaque:true cobra lo mismo que uno sin él',
      `${limpio} vs ${heredado}`);
    ok(!/empaque/i.test(await p.locator('#res-lineas').textContent()),
      'y no le aparece ninguna línea de empaque en el resumen');

    /* Y lo mismo por la otra puerta: el «e=1» de los correos ya enviados. */
    await p.goto(BASE + `/checkout.html?p=${BRZ.id}@${BRZ.talla},mickey-mouse,stitch&e=1`,
      { waitUntil: 'networkidle' });
    await p.waitForTimeout(600);
    ok((await p.locator('#res-total').textContent()).trim() === limpio,
      'y un enlace viejo con «e=1» tampoco lo resucita');
    await p.close();
  }

  // ——— 2bd · el carrito, en la misma página ———
  out.push('\n2bd · El carrito es esta página: se edita aquí, sin volver a la tienda');
  {
    /* Pedido del propietario (2026-10-02): carrito y pago en una sola página
       completa, en tres bloques —pedido, datos, pago—. Lo que sostiene eso:
       que cada pieza se pueda subir, bajar o quitar aquí, que «Completa tu
       set» sume sin salir, que el total que se ve sea el que cobra el
       servidor, y que el pedido quede guardado para la tienda. */
    const { calcular, leerPedido } = require(path.join(RAIZ, 'netlify', 'functions', '_precios.js'));
    const inv = JSON.parse(fs.readFileSync(path.join(RAIZ, 'assets', 'stock.json'), 'utf8')).items;
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    p.on('pageerror', e => errores.push(e.message));
    const ev = [];
    await p.exposeBinding('__rec', (_, a) => ev.push(a));
    await p.addInitScript(() => { window.fbq = (...a) => window.__rec(JSON.parse(JSON.stringify(a))); });
    await p.addInitScript(() => { if (!sessionStorage.getItem('prueba.ir')) { sessionStorage.setItem('prueba.ir', '1'); sessionStorage.setItem('zephora.ir', 'ver'); } });
    await ponerCarrito(p, { base: { id: BRZ.id, talla: BRZ.talla }, charms: ['iron-man', 'stitch'], empaque: false, pago: 'anticipado' });
    await p.route('**/.netlify/functions/mas-vendidos', r => r.fulfill({ json: { vendidas: [{ id: 'deadpool', unidades: 3 }] } }));
    await p.goto(BASE + '/checkout.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(300);
    const leer = () => p.evaluate(() => ({
      orden: [...document.querySelectorAll('.paso-t')].map(h => h.textContent.trim()),
      resAntes: !!(document.getElementById('res').compareDocumentPosition(document.getElementById('panel-datos')) & 4),
      filas: document.querySelectorAll('#res-lineas .rrow').length,
      total: document.getElementById('res-total').textContent.trim(),
      sug: document.getElementById('sug2').hidden ? null : [...document.querySelectorAll('#sug2-tira [data-sumar]')].map(b => b.dataset.sumar),
      guardado: JSON.parse(localStorage.getItem('zephora.carrito.v1') || 'null'),
      ancho: document.documentElement.scrollWidth,
    }));
    const esperado = c => cop(calcular(leerPedido({ base: c.base, charms: c.charms, pago: 'anticipado' })).total);
    let r = await leer();
    ok(r.orden.join(' | ') === '1Tu pedido | 2Datos de envío | 3Pago' && r.resAntes,
      'tres bloques en orden en el celular: pedido, datos, pago', r.orden.join(' | '));
    ok(r.filas === 3 && r.ancho <= 390, `las 3 piezas, cada una en su fila (${r.filas}), sin ensanchar la página`);
    const ic0 = ev.filter(e => e[1] === 'InitiateCheckout').length;
    ok(ic0 === 0, 'llegar con «Ver carrito» no cuenta como empezar a comprar (sin InitiateCheckout)');
    const agotado = id => inv[id] && typeof inv[id].stock === 'number' && inv[id].stock <= 0;
    ok(r.sug && r.sug.length >= 3 && r.sug[0] === 'deadpool' && !r.sug.some(id => ['iron-man', 'stitch'].includes(id) || /^letra-/.test(id) || agotado(id)),
      '«Completa tu set» con 3 piezas: lo más vendido primero, sin lo que ya lleva, iniciales ni agotados', (r.sug || []).slice(0, 3).join(', '));
    // Sumar desde la tira: 4 piezas, una gratis, la tira se va.
    await p.click('#sug2-tira [data-sumar="deadpool"]');
    await p.waitForTimeout(200);
    r = await leer();
    ok(r.filas === 4 && r.guardado.charms.includes('deadpool') && r.total === esperado(r.guardado),
      `sumar desde la tira: entra al pedido, se guarda y el total es el del servidor (${r.total})`);
    ok(r.sug === null, 'con 4 piezas ya no empuja: la tira se esconde');
    ok(ev.some(e => e[1] === 'AddToCart' && e[2].content_ids[0] === 'deadpool'), 'y cuenta como AddToCart, igual que en la tienda');
    ok(await p.evaluate(() => document.querySelectorAll('#res-lineas .rrow-p--gratis').length === 1),
      'la pieza gratis sale tachada con GRATIS');
    // − y +
    await p.click('[data-menos="stitch"]');
    await p.waitForTimeout(200);
    r = await leer();
    ok(r.filas === 3 && !r.guardado.charms.includes('stitch') && r.total === esperado(r.guardado), `«−» en la única unidad la quita (${r.total})`);
    const tope = inv['iron-man'] && typeof inv['iron-man'].stock === 'number' ? inv['iron-man'].stock : Infinity;
    const masOn = await p.evaluate(() => !document.querySelector('[data-mas="iron-man"]').disabled);
    ok(masOn === (tope > 1), `«+» se apaga en el tope de stock.json (quedan ${tope})`);
    if (masOn) {
      await p.click('[data-mas="iron-man"]');
      await p.waitForTimeout(200);
      r = await leer();
      ok(r.guardado.charms.filter(x => x === 'iron-man').length === 2 && r.total === esperado(r.guardado), `«+» suma otra unidad (${r.total})`);
    }
    // Empezar a escribir sí es empezar a comprar.
    await p.click('#nombre');
    await p.waitForTimeout(100);
    ok(ev.filter(e => e[1] === 'InitiateCheckout').length === 1, 'al empezar a escribir los datos sale el InitiateCheckout, una vez');
    // Quitar todo deja el carrito vacío.
    await p.evaluate(() => { document.querySelector('[data-quitar-base]').click(); });
    await p.waitForTimeout(150);
    /* Hasta que la página diga vacío: al vaciarse, #app se esconde con sus
       botones dentro, y esos ya no se pueden tocar. */
    for (let i = 0; i < 10 && await p.evaluate(() => !document.getElementById('app').hidden && !!document.querySelector('[data-quitar]')); i++) {
      await p.click('[data-quitar] >> nth=0'); await p.waitForTimeout(120);
    }
    const vacio = await p.evaluate(() => ({ v: !document.getElementById('vacio').hidden, app: document.getElementById('app').hidden, ls: localStorage.getItem('zephora.carrito.v1') }));
    ok(vacio.v && vacio.app && !vacio.ls, 'al quitar todo dice «Tu carrito está vacío» y la tienda también lo ve vacío');
    await p.close();
  }
  {
    /* Recordar los datos: lo más parecido a «pagar a un clic» que hay sin
       billetera. Se llenan solos con lo guardado en ESTE navegador, y «No soy
       yo» los borra. */
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => errores.push(e.message));
    await ponerCarrito(p, { base: null, charms: ['iron-man'], empaque: false, pago: 'anticipado' });
    await p.addInitScript(() => localStorage.setItem('zephora.datos.v1', JSON.stringify({ nombre: 'Ana', apellido: 'Ruiz', celular: '3001234567',
      correo: 'ana@ejemplo.com', depto: 'Antioquia', ciudad: 'Medellín', direccion: 'Calle 10 # 5-20', adicional: '', barrio: 'Laureles' })));
    await p.goto(BASE + '/checkout.html', { waitUntil: 'networkidle' });
    const d = await p.evaluate(() => ({ n: document.getElementById('nombre').value, dep: document.getElementById('depto').value,
      ciu: document.getElementById('ciudad').value, aviso: !document.getElementById('recordado').hidden, rec: document.getElementById('recordar').checked }));
    ok(d.n === 'Ana' && d.dep === 'Antioquia' && d.ciu === 'Medellín' && d.aviso && d.rec, 'quien ya compró llega con sus datos llenos, ciudad incluida', JSON.stringify(d));
    await p.click('#olvidar');
    const d2 = await p.evaluate(() => ({ n: document.getElementById('nombre').value, ls: localStorage.getItem('zephora.datos.v1'), rec: document.getElementById('recordar').checked }));
    ok(!d2.n && !d2.ls && !d2.rec, '«No soy yo · borrar» los quita de la página y del navegador');
    await p.close();
  }

  // ——— 2bc · dedicatoria e indicaciones, solo si se piden ———
  out.push('\n2bc · Dedicatoria e indicaciones, plegadas hasta marcarlas');
  {
    /* Pedido del propietario: que la dedicatoria sea una opción y que su campo
       salga solo si se marca, para que la página se vea limpia. Lo mismo las
       indicaciones de entrega. Y lo que se escribió y luego se desmarcó no
       viaja: ya no lo quiere en la tarjeta. */
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => errores.push(e.message));
    await ponerCarrito(p, { base: null, charms: ['mickey-mouse', 'stitch'], empaque: false, pago: 'anticipado' });
    await p.goto(BASE + '/checkout.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    ok(!(await p.locator('#campo-dedicatoria').isVisible()) && !(await p.locator('#campo-notas').isVisible()),
      'de entrada no se ven los campos, solo sus casillas');
    ok(/sin costo/i.test(await p.locator('label[for], .extra-t').filter({ hasText: 'dedicatoria' }).first().textContent()),
      'la dedicatoria dice que no cuesta');
    await p.check('#con-dedicatoria');
    ok(await p.locator('#campo-dedicatoria').isVisible(), 'marcar «Quiero una dedicatoria» abre su campo');
    ok(await p.evaluate(() => document.activeElement.id === 'dedicatoria'), 'con el cursor puesto para escribir');
    await p.fill('#dedicatoria', 'Para Ana');
    await p.uncheck('#con-dedicatoria');
    ok(!(await p.locator('#campo-dedicatoria').isVisible()), 'desmarcarla lo vuelve a plegar');
    await p.check('#con-notas');
    ok(await p.locator('#campo-notas').isVisible(), 'y las indicaciones de entrega funcionan igual');
    await p.close();
  }

  // ——— 2c · el aviso sale al terminar el campo, no al final ———
  out.push('\n2c · Aviso en vivo');
  {
    /* Antes el error solo salía al pulsar «Continuar»: se podía escribir mal el
       correo arriba del todo y enterarse nueve campos más abajo. Lo que se
       vigila aquí no es que valide —eso ya se probó en la sección 2— sino
       *cuándo* habla y cuándo se calla, que es lo que separa un aviso útil de
       uno que regaña mientras la clienta escribe. */
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => errores.push(e.message));
    await ponerCarrito(p, { base: { id: BRZ.id, talla: BRZ.talla }, charms: ['mickey-mouse'], empaque: false, pago: 'anticipado' });
    await p.goto(BASE + '/checkout.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);

    const mal = n => p.locator('[data-c="' + n + '"]').evaluate(e => e.classList.contains('mal'));

    /* Nadie ha tocado «Continuar» en toda esta sección. */
    await p.fill('#correo', 'maria@ejemplo');
    await p.locator('#correo').blur();
    await p.waitForTimeout(150);
    ok(await mal('correo'), 'el correo a medias se marca al salir del campo, sin pulsar el botón');
    ok(await p.locator('[data-c="correo"] .error').isVisible(),
      'y se ve el motivo escrito debajo, no solo un borde rojo');
    ok(await p.locator('#correo').getAttribute('aria-invalid') === 'true',
      'marcado también para quien no ve el borde: lector de pantalla');
    const describe = await p.locator('#correo').getAttribute('aria-describedby');
    ok(!!describe && (await p.locator('#' + describe.split(' ').pop()).textContent()).includes('@'),
      'con el mensaje colgado del campo, no suelto en la página', describe);

    await p.fill('#correo', 'maria@ejemplo.c');
    await p.waitForTimeout(100);
    ok(await mal('correo'), 'teclear no borra el aviso: sigue rojo mientras el dato siga mal');

    await p.fill('#correo', 'maria@ejemplo.com');
    await p.waitForTimeout(100);
    ok(!(await mal('correo')), 'y se va solo en cuanto queda bien, sin volver a enviar');
    ok(await p.locator('#correo').getAttribute('aria-invalid') === 'false',
      'y deja de anunciarse como erróneo');

    /* Dejar un campo para después es legítimo mientras se llena el formulario;
       de lo que falta ya avisa «Continuar». Marcar en rojo al pasar de largo
       convertiría el paso 1 en una pantalla llena de errores sin haber hecho
       nada mal. */
    await p.locator('#nombre').click();
    await p.locator('#apellido').click();
    await p.waitForTimeout(100);
    ok(!(await mal('nombre')), 'pasar de largo por un campo vacío no lo marca');

    await p.fill('#celular', '6012345678');
    await p.locator('#celular').blur();
    await p.waitForTimeout(150);
    ok(await mal('celular'), 'el fijo se rechaza al salir del campo, no al final');
    await p.fill('#celular', '301 234 5678');
    await p.waitForTimeout(100);
    ok(!(await mal('celular')), 'y el celular con espacios se da por bueno sin reescribirlo');

    /* El botón de pagar sigue siendo la red de seguridad de lo que quedó vacío. */
    await p.click('#confirmar');
    ok(await p.locator('#aviso-error').isVisible(), 'con campos vacíos el botón de pagar no deja seguir');
    ok(await mal('nombre'), 'y ahí sí marca lo que la clienta nunca llegó a llenar');
    await p.close();
  }

  // ——— 3 · compra con Wompi ———
  out.push('\n3 · Pago con Wompi');
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => errores.push(e.message));
    const cap = [];
    await interceptar(p, cap);
    /* El checkout navega a checkout.wompi.co: se atrapa para leer la petición
       en vez de salir a internet.
       Se guarda la URL COMPLETA y el método, no solo los campos: la primera
       versión mandaba los datos por POST y Wompi los rechazaba con «Parámetro
       public-key no proveído», porque los lee de la query string. La prueba
       comprobaba que los campos estuvieran bien armados, pero no por dónde
       viajaban, y por eso pasó en verde algo que en producción no cobraba. */
    let aWompi = null;
    await p.route('https://checkout.wompi.co/**', async route => {
      aWompi = { url: route.request().url(), metodo: route.request().method() };
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>pasarela</p>' });
    });

    await ponerCarrito(p, { base: { id: BRZ.id, talla: BRZ.talla }, charms: ['mickey-mouse', 'stitch'], empaque: true, pago: 'anticipado' });
    await p.goto(BASE + '/checkout.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);

    const enPantalla = await p.locator('#res-total').textContent();
    await llenarDatos(p, DATOS);
    /* Un solo toque: sin casilla de términos ni pasos intermedios. */
    await p.click('#confirmar');
    await p.waitForTimeout(900);

    ok(cap.length === 1, 'llamó a crear-pago una sola vez');
    const r = cap[0] && cap[0].respuesta;
    ok(!!r && !r.error, 'el servidor aceptó el pedido', r && r.error);
    ok(!!cap[0] && cap[0].pedido.total === undefined,
      'el navegador NO manda el total: el servidor lo calcula');
    ok(!!r && ('$' + r.total.toLocaleString('es-CO').replace(/,/g, '.')) === enPantalla,
      'el total del servidor es el que vio la clienta', r && `servidor ${r.total}, pantalla ${enPantalla}`);
    ok(!!r && /^ZC-\d{6}-[0-9A-F]{8}$/.test(r.referencia), 'la referencia tiene forma ZC-AAMMDD-XXXXXXXX',
      r && r.referencia);
    ok(!!r && r.centavos === r.total * 100, 'el monto va a Wompi en centavos');

    if (r) {
      const esperada = crypto.createHash('sha256')
        .update(`${r.referencia}${r.centavos}COP${INTEGRIDAD}`).digest('hex');
      ok(r.firma === esperada, 'la firma de integridad es la que Wompi va a recalcular');
    }

    ok(!!aWompi, 'llega a la pasarela');
    if (aWompi) {
      ok(aWompi.metodo === 'GET',
        'va por GET: Wompi lee los parámetros de la URL, no de un cuerpo POST',
        aWompi.metodo);
      ok(aWompi.url.startsWith('https://checkout.wompi.co/p/?'),
        'con los parámetros en la query string');

      const f = new URLSearchParams(aWompi.url.split('?')[1] || '');
      /* Los cuatro que Wompi da por obligatorios: si falta uno, su checkout
         responde «Parámetro … no proveído» y no se puede pagar. */
      ['public-key', 'currency', 'amount-in-cents', 'reference'].forEach(k => {
        ok(!!f.get(k), `lleva «${k}», que Wompi exige`, f.get(k) || 'vacío');
      });
      ok(f.get('amount-in-cents') === String(r.centavos), 'el monto firmado va en centavos');
      ok(f.get('signature:integrity') === r.firma, 'y la firma que lo respalda');
      ok(f.get('reference') === r.referencia, 'y la referencia del pedido');
      ok((f.get('redirect-url') || '').endsWith('/gracias.html'), 'con la URL de regreso');
      ok(f.get('customer-data:email') === DATOS.correo, 'y los datos de la clienta');
      ok(!f.get('customer-data:legal-id'), 'sin documento: ya no se pide');
      /* El nombre del parámetro va con dos puntos literales, como en la
         documentación de Wompi: escaparlo a %3A depende de que su servidor lo
         desescape, y no hay por qué apostar a eso. */
      ok(aWompi.url.includes('signature:integrity='),
        'los nombres con dos puntos viajan literales, no escapados a %3A');
    }
    await p.close();
  }

  // ——— 4 · contraentrega ———
  out.push('\n4 · Contraentrega');
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => errores.push(e.message));
    const cap = [];
    await interceptar(p, cap);
    await ponerCarrito(p, { base: { id: BRZ.id, talla: BRZ.talla }, charms: ['mickey-mouse'], empaque: false, pago: 'anticipado' });
    await p.goto(BASE + '/checkout.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);

    await llenarDatos(p, DATOS);
    /* Venía con pago anticipado del carrito; «Cambiar» abre las dos. */
    await p.click('#cambiar-pago');
    ok(await p.locator('#ops-pago').isVisible(), '«Cambiar» muestra las dos formas de pago');

    const antes = await p.locator('#p-anticipado').textContent();
    const contra = await p.locator('#p-contraentrega').textContent();
    ok(antes !== contra, 'los dos totales se ven antes de elegir, y son distintos',
      `${antes} vs ${contra}`);

    await p.check('#ops-pago input[value="contraentrega"]');
    await p.waitForTimeout(200);
    ok((await p.locator('#res-total').textContent()) === contra,
      'elegir contraentrega actualiza el resumen');
    ok(!(await p.locator('#ops-pago').isVisible()) && /contraentrega/i.test(await p.locator('#pago-elegido-tx').textContent()),
      'y se vuelve a plegar, con la elegida en su línea');
    ok(/Confirmar pedido/.test(await p.locator('#confirmar').textContent()),
      'el botón ya no dice «Pagar»: se paga al recibir');

    await p.click('#confirmar');
    await p.waitForTimeout(900);

    ok(p.url().includes('gracias.html'), 'termina en la página de confirmación', p.url());
    ok(p.url().includes('modo=contraentrega'), 'marcada como contraentrega');
    ok(cap[0] && cap[0].respuesta.modo === 'contraentrega', 'el servidor no firma nada: no hay cobro');
    ok(cap[0] && !cap[0].respuesta.firma, 'y no manda firma');
    await p.waitForTimeout(400);
    ok((await p.locator('#titulo').textContent()).includes('confirmado'),
      'la página de gracias confirma el pedido');
    ok(await p.evaluate(() => localStorage.getItem('zephora.carrito.v1') === null),
      'el carrito se vacía al confirmar, para no repetir el pedido sin querer');
    await p.close();
  }

  // ——— 4b · suscrita: elige la inicial de su regalo (2026-09-27) ———
  out.push('\n4b · Suscrita: la inicial de regalo viaja con el pedido');
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => errores.push(e.message));
    const cap = [];
    await interceptar(p, cap);
    await ponerCarrito(p, { base: null, charms: ['mickey-mouse', 'stitch'], empaque: false, pago: 'contraentrega' });
    await p.addInitScript(() => localStorage.setItem('zephora.suscrita', '1'));
    await p.goto(BASE + '/checkout.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    await llenarDatos(p, DATOS);
    ok(await p.locator('#campo-regalo').isVisible(), 'en los datos de entrega aparece «Elige la inicial de tu regalo»');
    const primera = await p.$eval('#regalo-inicial option:nth-child(2)', o => o.value);
    await p.selectOption('#regalo-inicial', primera);
    await p.click('#confirmar');
    await p.waitForTimeout(900);
    ok(cap[0] && cap[0].pedido.cliente && cap[0].pedido.cliente.regaloInicial === primera,
      `la letra elegida (${primera}) llega al servidor con el pedido`);
    await p.close();
  }

  // ——— 5 · lo que el servidor no puede aceptar ———
  out.push('\n5 · Intentos contra el servidor');
  {
    /* crear-pago le pregunta a Wompi si el comercio existe. Estas comprobaciones
       van de otra cosa, así que se responde que sí sin salir a la red: si no,
       cada uno de los 300 pedidos de más abajo abriría una conexión real. */
    const fetchReal = globalThis.fetch;
    globalThis.fetch = async () => ({ status: 200 });

    const llamar = async cuerpo => {
      const r = await invocar(crearPago.default, { httpMethod: 'POST', body: JSON.stringify(cuerpo) });
      return { codigo: r.statusCode, cuerpo: JSON.parse(r.body) };
    };
    const bueno = {
      base: { id: BRZ.id, talla: BRZ.talla }, charms: ['mickey-mouse'],
      empaque: false, pago: 'anticipado',
      cliente: Object.assign({ tipodoc: 'CC', depto: 'Bogotá D.C.', ciudad: 'Bogotá D.C.' }, DATOS),
    };

    const real = await llamar(bueno);
    ok(real.codigo === 200, 'un pedido correcto pasa');

    /* El intento evidente: mandar el total que uno quiera. Como el servidor
       nunca lo lee, el cobro sale igual que sin manipular nada. */
    const trucado = await llamar(Object.assign({}, bueno, { total: 1000, centavos: 100000 }));
    ok(trucado.cuerpo.total === real.cuerpo.total,
      'mandar un total falso no cambia lo que se cobra',
      `pidió $1.000, se cobra ${trucado.cuerpo.total}`);

    const sinCel = await llamar(Object.assign({}, bueno, {
      cliente: Object.assign({}, bueno.cliente, { celular: '123' }) }));
    ok(sinCel.codigo === 400, 'rechaza un celular inválido aunque el formulario lo dejara pasar');

    const sinDir = await llamar(Object.assign({}, bueno, {
      cliente: Object.assign({}, bueno.cliente, { direccion: '' }) }));
    ok(sinDir.codigo === 400, 'rechaza un pedido sin dirección');

    /* Autorización de comunicaciones comerciales.
     *
     * Es la única casilla del formulario que no cambia nada de la compra, y por
     * eso es fácil que se rompa sin que nadie lo note: el pedido pasa igual, el
     * cobro sale igual, los correos salen igual. Lo que cambia es a quién se le
     * puede escribir después, y eso solo se descubre el día que hay que
     * demostrar que hubo permiso.
     *
     * `crear-pago` es un endpoint público: cualquiera puede mandarle un cuerpo
     * a mano. Por eso el permiso solo se concede con un booleano `true` — un
     * "false", un 1 o un "no" son valores que en JavaScript pasan por
     * verdaderos y fabricarían una autorización que nadie dio. */
    const consent = v => crearPago._interno.leerCliente(
      Object.assign({}, bueno.cliente, { optin: v })).optin;
    ok(consent(true) === true, 'marcar la casilla queda guardado como autorización');
    ok(consent(false) === false && consent(undefined) === false,
      'sin marcarla no queda ninguna autorización');
    ok(['false', 'no', 1, 'sí', {}].every(v => consent(v) === false),
      'un valor colado por la API pública no fabrica un permiso',
      'probados "false", "no", 1, "sí" y {}');

    const inventado = await llamar(Object.assign({}, bueno, { charms: ['charm-de-oro'] }));
    ok(inventado.codigo === 400, 'rechaza una pieza que no existe en el catálogo');

    const get = await invocar(crearPago.default, { httpMethod: 'GET' });
    ok(get.statusCode === 405, 'no responde a GET');

    /* Inventario. El navegador ya bloquea lo agotado, pero entre armar la
       pulsera y pagar pueden pasar horas y el inventario cambia. Cobrar algo
       que no existe obliga a devolver el dinero. */
    const inv = require(path.join(RAIZ, 'assets', 'stock.json')).items;
    const agotado = Object.keys(inv).find(k => inv[k].tipo === 'charm' && inv[k].stock <= 0);
    if (agotado) {
      const r = await llamar(Object.assign({}, bueno, { charms: [agotado] }));
      ok(r.codigo === 409 && r.cuerpo.agotado,
        'no cobra un charm agotado, y lo dice como falta de inventario (409)', agotado);
      ok(/se agot/i.test(r.cuerpo.error || ''), 'con un mensaje que explica qué pasó');
    }

    const conUno = Object.keys(inv).find(k => inv[k].tipo === 'charm' && inv[k].stock === 1);
    if (conUno) {
      const r = await llamar(Object.assign({}, bueno, { charms: [conUno, conUno] }));
      ok(r.codigo === 409, 'no cobra dos unidades de algo que tiene una', conUno);
      const uno = await llamar(Object.assign({}, bueno, { charms: [conUno] }));
      ok(uno.codigo === 200, 'pero una sola sí pasa');
    }

    /* Tallas: el brazalete se vende por talla, y una talla sin unidades no se
       puede cobrar aunque el modelo tenga inventario en otras. */
    const conTallas = Object.keys(inv).find(k => inv[k].tallas
      && Object.values(inv[k].tallas).some(n => n > 0)
      && ['17', '18', '19', '20', '21'].some(t => !(inv[k].tallas[t] > 0)));
    if (conTallas) {
      const sinUnidades = ['17', '18', '19', '20', '21'].find(t => !(inv[conTallas].tallas[t] > 0));
      const r = await llamar(Object.assign({}, bueno, {
        base: { id: conTallas, talla: sinUnidades }, charms: [] }));
      ok(r.codigo === 409, `no cobra la talla ${sinUnidades} de ${conTallas}, que no tiene unidades`);
      ok(/quedan/.test(r.cuerpo.error || ''), 'y le dice cuáles sí quedan');
    }

    /* Comercio inexistente en Wompi. Pasó en producción: llaves puestas, firma
       correcta, y la clienta acababa en «No se pudo cargar la información del
       undefined» sin vuelta atrás. Ahora se detecta antes de mandarla. */
    globalThis.fetch = async () => ({ status: 404 });
    const muerto = await llamar(bueno);
    ok(muerto.codigo === 503, 'si Wompi no reconoce el comercio, no manda a nadie a la pasarela');
    ok(/contraentrega/i.test(muerto.cuerpo.error || ''),
      'y ofrece contraentrega en vez de un callejón sin salida');

    /* Pero un fallo de red no puede costar una venta buena. */
    globalThis.fetch = async () => { throw new Error('red caída'); };
    const conRedCaida = await llamar(bueno);
    ok(conRedCaida.codigo === 200,
      'si la verificación no se puede hacer, el pago sigue: falla hacia adelante');
    globalThis.fetch = fetchReal;

    /* Dos pedidos seguidos no pueden compartir referencia: Wompi rechazaría el
       segundo, y al conciliar no se distinguirían. */
    const refs = new Set();
    for (let i = 0; i < 300; i++) refs.add((await llamar(bueno)).cuerpo.referencia);
    ok(refs.size === 300, 'las referencias no se repiten en 300 pedidos seguidos',
      `${refs.size} distintas`);
  }

  // ——— 5b · correos ———
  out.push('\n5b · Comprobante por correo');
  {
    correos.length = 0;
    const r = await invocar(crearPago.default, { httpMethod: 'POST', body: JSON.stringify({
      base: { id: BRZ.id, talla: BRZ.talla }, charms: ['mickey-mouse'],
      empaque: false, pago: 'contraentrega',
      cliente: Object.assign({ tipodoc: 'CC', depto: 'Bogotá D.C.', ciudad: 'Bogotá D.C.' }, DATOS),
    }) });
    const ref = JSON.parse(r.body).referencia;

    ok(correos.length === 2, 'salen dos correos: comprobante a la clienta y copia a la tienda',
      `${correos.length} enviados`);
    const aClienta = correos.find(c => c.to && c.to[0] === DATOS.correo);
    const aTienda = correos.find(c => c.to && c.to[0] === 'tienda@ejemplo.com');

    ok(!!aClienta, 'la clienta recibe el suyo en el correo que registró');
    if (aClienta) {
      ok(aClienta.subject.includes(ref), 'el asunto lleva la referencia', aClienta.subject);
      ok(aClienta.html.includes(ref) && aClienta.text.includes(ref), 'y el cuerpo también');
      /* El correo dice «Brazalete Copo de Nieve» donde el catálogo dice
         «Pulsera Copo de Nieve»: `_precios.js` reescribe ese prefijo a
         propósito. Se comprueba la parte que identifica la pieza y no el
         prefijo, para no repetir aquí una regla que vive allí. */
      const pieza = BRZ.nombre.replace(/^Pulsera /, '');
      ok(aClienta.html.includes(pieza) && aClienta.html.includes('Mickey Mouse'),
        'con el detalle de las piezas', pieza);
      ok(aClienta.html.includes(`Talla ${BRZ.talla}`), 'y la talla del brazalete');
      ok(/Pedido confirmado/.test(aClienta.subject),
        'contraentrega se anuncia como pedido confirmado, no como pago pendiente');
      /* Sin esto varios filtros lo mandan a spam, y un comprobante en spam es
         un comprobante que no existe. */
      ok(!!aClienta.text && aClienta.text.length > 100, 'lleva versión en texto plano');
      /* Los clientes de correo bloquean lo remoto: una plantilla que dependa de
         imágenes o fuentes externas llega rota. */
      ok(!/<img|https:\/\/fonts\.|\.webp/.test(aClienta.html),
        'no depende de imágenes ni fuentes externas');
    }
    ok(!!aTienda, 'la tienda recibe su copia');
    if (aTienda) {
      ok(aTienda.reply_to === DATOS.correo,
        'respondiendo a la copia se le escribe a la clienta directamente');
      ok(/CONTRAENTREGA/.test(aTienda.subject), 'con la forma de pago en el asunto',
        aTienda.subject);
    }

    /* Un fallo de correo no puede tumbar un pedido ya cobrado. */
    const fetchBueno = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (String(url).includes('api.resend.com')) throw new Error('Resend caído');
      return { ok: true, status: 200, text: async () => '' };
    };
    const conCorreoCaido = await invocar(crearPago.default, { httpMethod: 'POST', body: JSON.stringify({
      base: { id: BRZ.id, talla: BRZ.talla }, charms: ['mickey-mouse'],
      empaque: false, pago: 'contraentrega',
      cliente: Object.assign({ tipodoc: 'CC', depto: 'Bogotá D.C.', ciudad: 'Bogotá D.C.' }, DATOS),
    }) });
    ok(conCorreoCaido.statusCode === 200,
      'si el correo falla, el pedido sigue su curso igual');
    globalThis.fetch = fetchBueno;

    /* Sin llave configurada tampoco se rompe nada. */
    const llave = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    correos.length = 0;
    const sinLlave = await invocar(crearPago.default, { httpMethod: 'POST', body: JSON.stringify({
      base: { id: BRZ.id, talla: BRZ.talla }, charms: ['mickey-mouse'],
      empaque: false, pago: 'contraentrega',
      cliente: Object.assign({ tipodoc: 'CC', depto: 'Bogotá D.C.', ciudad: 'Bogotá D.C.' }, DATOS),
    }) });
    ok(sinLlave.statusCode === 200 && correos.length === 0,
      'sin RESEND_API_KEY no se manda nada y el pedido tampoco se cae');
    process.env.RESEND_API_KEY = llave;
  }

  // ——— 6 · webhook ———
  out.push('\n6 · Aviso de pago de Wompi');
  {
    process.env.WOMPI_EVENTOS = 'prueba_eventos';
    const evento = {
      event: 'transaction.updated',
      data: { transaction: { id: '01-1234', reference: 'ZC-260809-ABCDEF01',
        status: 'APPROVED', amount_in_cents: 29735000, customer_email: 'maria@ejemplo.com',
        payment_method_type: 'NEQUI' } },
      signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'] },
      timestamp: 1786290000,
    };
    const firma = crypto.createHash('sha256')
      .update('01-1234APPROVED29735000' + evento.timestamp + 'prueba_eventos').digest('hex');

    const bueno = await invocar(webhook.default, { httpMethod: 'POST',
      body: JSON.stringify(Object.assign({}, evento, { signature: Object.assign({}, evento.signature, { checksum: firma }) })) });
    ok(bueno.statusCode === 200, 'acepta un evento con firma correcta');
    ok(JSON.parse(bueno.body).estado === 'APPROVED', 'y lee el estado del pago');

    const falso = await invocar(webhook.default, { httpMethod: 'POST',
      body: JSON.stringify(Object.assign({}, evento, { signature: Object.assign({}, evento.signature, { checksum: 'a'.repeat(64) }) })) });
    ok(falso.statusCode === 401, 'rechaza un «ya te pagaron» inventado por un tercero');

    const sinFirma = await invocar(webhook.default, { httpMethod: 'POST', body: JSON.stringify(evento) });
    ok(sinFirma.statusCode === 401, 'rechaza un evento sin firma');
  }

  console.log(out.join('\n'));
  console.log(errores.length ? `\nerrores JS: ${errores.join(' | ')}` : '\nerrores JS: ninguno ✓');
  console.log(fallas ? `\n✗ ${fallas} comprobación(es) en rojo` : '\nCheckout completo en verde ✓');

  await b.close();
})();
