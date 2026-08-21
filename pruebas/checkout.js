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

const BASE = process.env.URL || 'http://localhost:8899';
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
  nombre: 'María', apellido: 'Gómez', documento: '1020304050',
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

async function llenarPaso1(p, d) {
  await p.fill('#nombre', d.nombre);
  await p.fill('#apellido', d.apellido);
  await p.fill('#documento', d.documento);
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

  // ——— 2 · validación ———
  out.push('\n2 · Datos de envío');
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => errores.push(e.message));
    await ponerCarrito(p, { base: { id: 'pulsera-avengers', talla: '20' }, charms: ['mickey-mouse'], empaque: false, pago: 'anticipado' });
    await p.goto(BASE + '/checkout.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);

    await p.click('#ir-2');
    ok(await p.locator('#panel-1').isVisible(), 'con el formulario vacío no deja pasar de paso');
    ok((await p.locator('.campo.mal').count()) >= 5, 'marca en rojo los campos que faltan',
      `${await p.locator('.campo.mal').count()} marcados`);

    await llenarPaso1(p, Object.assign({}, DATOS, { celular: '6012345678' }));
    await p.click('#ir-2');
    ok(await p.locator('[data-c="celular"]').evaluate(e => e.classList.contains('mal')),
      'rechaza un fijo donde va un celular (601…)');

    await p.fill('#celular', '301 234 5678');
    await p.click('#ir-2');
    ok(await p.locator('#panel-2').isVisible(), 'acepta el celular con espacios y pasa a entrega');

    ok((await p.locator('#dir-resumen-tx').textContent()).includes('Calle 45'),
      'el paso 2 repite la dirección para poder revisarla');

    // ciudad "Otro municipio" abre el campo de texto
    await p.click('[data-atras="1"]');
    await p.selectOption('#depto', 'Antioquia');
    await p.selectOption('#ciudad', '__otro__');
    ok(await p.locator('[data-c="ciudadotra"]').isVisible(),
      'elegir «Otro municipio» abre el campo para escribirlo');
    await p.selectOption('#ciudad', 'Medellín');
    ok(!(await p.locator('[data-c="ciudadotra"]').isVisible()),
      'y se vuelve a ocultar al elegir uno de la lista');
    await p.close();
  }

  // ——— 2b · sugerencias y envío gratis ———
  out.push('\n2b · Te puede interesar, y lo que falta para el envío gratis');
  {
    /* Lo que sostiene la tira: que sugiera lo parecido a lo que ya lleva, que
       nunca ofrezca lo agotado —el servidor lo rechazaría en la pantalla de
       pago, que es el peor sitio para descubrirlo— y que añadir desde aquí
       mueva el total del resumen, que está pegado arriba y siempre visible. */
    const p = await b.newPage({ viewport: { width: 390, height: 900 } });
    p.on('pageerror', e => errores.push(e.message));
    await ponerCarrito(p, { base: { id: 'pulsera-avengers', talla: '20' }, charms: ['iron-man'], empaque: false, pago: 'anticipado' });
    await p.goto(BASE + '/checkout.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(400);

    const falta = (await p.locator('#env-nota').textContent()).trim();
    ok(/faltan|envío gratis/i.test(falta), 'el resumen dice cuánto falta para el envío gratis', falta);

    await llenarPaso1(p, { nombre: 'Ana', apellido: 'Pérez', documento: '1007401199',
      celular: '3012345678', correo: 'ana@ejemplo.com', direccion: 'Calle 16f #99 - 72',
      adicional: '', barrio: '' });
    await p.click('#ir-2');
    await p.waitForTimeout(400);

    ok(await p.locator('#sug').isVisible(), 'la tira de sugerencias aparece en el paso de entrega');
    const porQue = (await p.locator('#sug-por').textContent()).trim();
    ok(/marvel/i.test(porQue), 'y explica por qué son esas: van por la categoría de lo que ya lleva', porQue);

    const ids = await p.evaluate(() => [...document.querySelectorAll('[data-sug]')].map(x => x.dataset.sug));
    ok(ids.length >= 3, `sugiere ${ids.length} piezas (menos de 3 no se pinta)`);
    ok(!ids.includes('iron-man'), 'nunca sugiere lo que la clienta ya lleva');
    ok(!ids.some(i => /^letra-/.test(i)), 'ni las iniciales, que se eligen a propósito y no se sugieren');

    /* Ninguna sugerida puede estar agotada según el mismo stock.json que usa
       el catálogo. Es la comprobación que evita mandar a la clienta a un 409. */
    const agotadas = await p.evaluate(async lista => {
      const inv = await fetch('assets/stock.json').then(r => r.json());
      return lista.filter(id => {
        const it = inv.items[id];
        return it && typeof it.stock === 'number' && it.stock <= 0;
      });
    }, ids);
    ok(agotadas.length === 0, 'y ninguna está agotada',
      agotadas.length ? 'ofrecidas sin stock: ' + agotadas.join(', ') : `${ids.length} comprobadas`);

    const antes = (await p.locator('#res-total').textContent()).trim();
    await p.locator('#sug-tira .sug-b').first().click();
    await p.waitForTimeout(400);
    const despues = (await p.locator('#res-total').textContent()).trim();
    ok(antes !== despues, 'añadir desde la tira mueve el total del resumen', `${antes} → ${despues}`);
    ok(/añadido/i.test(await p.locator('#sug-tira .sug-b').first().textContent()),
      'y el botón confirma en el sitio, sin que la pieza desaparezca de golpe');

    /* La prueba social va donde se decide pagar, no antes: es el último momento
       de duda y el único punto de la página sin nada que respalde la compra. */
    ok(!(await p.locator('.aval').isVisible()), 'el aval no distrae en el paso de entrega');
    await p.click('#ir-3');
    await p.waitForTimeout(300);
    const aval = (await p.locator('.aval-n').textContent()).trim();
    ok(await p.locator('.aval').isVisible(), 'y sí aparece junto al botón de pagar');
    ok(/2\.400/.test(aval) && /verificad/i.test(aval),
      'con el dato real de la tienda, no una frase de relleno', aval.slice(0, 60) + '…');
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

    await ponerCarrito(p, { base: { id: 'pulsera-avengers', talla: '20' }, charms: ['mickey-mouse', 'stitch'], empaque: true, pago: 'anticipado' });
    await p.goto(BASE + '/checkout.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);

    const enPantalla = await p.locator('#res-total').textContent();
    await llenarPaso1(p, DATOS);
    await p.click('#ir-2');
    await p.click('#ir-3');

    await p.click('#confirmar');
    ok(await p.locator('[data-c="acepta"]').evaluate(e => e.classList.contains('mal')),
      'no cobra sin aceptar términos y condiciones');

    await p.check('#acepta');
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
    await ponerCarrito(p, { base: { id: 'pulsera-avengers', talla: '20' }, charms: ['mickey-mouse'], empaque: false, pago: 'anticipado' });
    await p.goto(BASE + '/checkout.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);

    await llenarPaso1(p, DATOS);
    await p.click('#ir-2');
    await p.click('#ir-3');

    const antes = await p.locator('#p-anticipado').textContent();
    const contra = await p.locator('#p-contraentrega').textContent();
    ok(antes !== contra, 'los dos totales se ven antes de elegir, y son distintos',
      `${antes} vs ${contra}`);

    await p.check('#ops-pago input[value="contraentrega"]');
    await p.waitForTimeout(200);
    ok((await p.locator('#res-total').textContent()) === contra,
      'elegir contraentrega actualiza el resumen');

    await p.check('#acepta');
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
      base: { id: 'pulsera-avengers', talla: '20' }, charms: ['mickey-mouse'],
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
      base: { id: 'pulsera-avengers', talla: '20' }, charms: ['mickey-mouse'],
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
      ok(aClienta.html.includes('Avengers') && aClienta.html.includes('Mickey Mouse'),
        'con el detalle de las piezas');
      ok(aClienta.html.includes('Talla 20'), 'y la talla del brazalete');
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
      base: { id: 'pulsera-avengers', talla: '20' }, charms: ['mickey-mouse'],
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
      base: { id: 'pulsera-avengers', talla: '20' }, charms: ['mickey-mouse'],
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
