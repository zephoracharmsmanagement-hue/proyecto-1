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

const crearPago = require(path.join(RAIZ, 'netlify', 'functions', 'crear-pago.js'));
const webhook = require(path.join(RAIZ, 'netlify', 'functions', 'wompi-webhook.js'));

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
    const r = await crearPago.handler({ httpMethod: 'POST', body });
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
    await ponerCarrito(p, { base: { id: 'pulsera-avengers', talla: '18' }, charms: ['mickey-mouse'], empaque: false, pago: 'anticipado' });
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

  // ——— 3 · compra con Wompi ———
  out.push('\n3 · Pago con Wompi');
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => errores.push(e.message));
    const cap = [];
    await interceptar(p, cap);
    /* El checkout hace submit a checkout.wompi.co: se atrapa para leer el
       formulario en vez de salir a internet. */
    let aWompi = null;
    await p.route('https://checkout.wompi.co/**', async route => {
      aWompi = route.request().postData();
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>pasarela</p>' });
    });

    await ponerCarrito(p, { base: { id: 'pulsera-avengers', talla: '18' }, charms: ['mickey-mouse', 'stitch'], empaque: true, pago: 'anticipado' });
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

    ok(!!aWompi, 'envía el formulario a la pasarela');
    if (aWompi) {
      const f = new URLSearchParams(aWompi);
      ok(f.get('amount-in-cents') === String(r.centavos), 'el formulario lleva el monto firmado');
      ok(f.get('signature:integrity') === r.firma, 'y la firma que lo respalda');
      ok(f.get('reference') === r.referencia, 'y la referencia del pedido');
      ok((f.get('redirect-url') || '').endsWith('/gracias.html'), 'con la URL de regreso');
      ok(f.get('customer-data:email') === DATOS.correo, 'y los datos de la clienta');
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
    await ponerCarrito(p, { base: { id: 'pulsera-avengers', talla: '18' }, charms: ['mickey-mouse'], empaque: false, pago: 'anticipado' });
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
    const llamar = async cuerpo => {
      const r = await crearPago.handler({ httpMethod: 'POST', body: JSON.stringify(cuerpo) });
      return { codigo: r.statusCode, cuerpo: JSON.parse(r.body) };
    };
    const bueno = {
      base: { id: 'pulsera-avengers', talla: '18' }, charms: ['mickey-mouse'],
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

    const inventado = await llamar(Object.assign({}, bueno, { charms: ['charm-de-oro'] }));
    ok(inventado.codigo === 400, 'rechaza una pieza que no existe en el catálogo');

    const get = await crearPago.handler({ httpMethod: 'GET' });
    ok(get.statusCode === 405, 'no responde a GET');

    /* Dos pedidos seguidos no pueden compartir referencia: Wompi rechazaría el
       segundo, y al conciliar no se distinguirían. */
    const refs = new Set();
    for (let i = 0; i < 300; i++) refs.add((await llamar(bueno)).cuerpo.referencia);
    ok(refs.size === 300, 'las referencias no se repiten en 300 pedidos seguidos',
      `${refs.size} distintas`);
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

    const bueno = await webhook.handler({ httpMethod: 'POST',
      body: JSON.stringify(Object.assign({}, evento, { signature: Object.assign({}, evento.signature, { checksum: firma }) })) });
    ok(bueno.statusCode === 200, 'acepta un evento con firma correcta');
    ok(JSON.parse(bueno.body).estado === 'APPROVED', 'y lee el estado del pago');

    const falso = await webhook.handler({ httpMethod: 'POST',
      body: JSON.stringify(Object.assign({}, evento, { signature: Object.assign({}, evento.signature, { checksum: 'a'.repeat(64) }) })) });
    ok(falso.statusCode === 401, 'rechaza un «ya te pagaron» inventado por un tercero');

    const sinFirma = await webhook.handler({ httpMethod: 'POST', body: JSON.stringify(evento) });
    ok(sinFirma.statusCode === 401, 'rechaza un evento sin firma');
  }

  console.log(out.join('\n'));
  console.log(errores.length ? `\nerrores JS: ${errores.join(' | ')}` : '\nerrores JS: ninguno ✓');
  console.log(fallas ? `\n✗ ${fallas} comprobación(es) en rojo` : '\nCheckout completo en verde ✓');

  await b.close();
})();
