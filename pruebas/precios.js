/* ¿Cobra el servidor lo mismo que le prometió la página a la clienta?
 *
 * El total que se firma para Wompi lo calcula netlify/functions/_precios.js, no
 * el navegador — si el navegador mandara el monto, cualquiera lo bajaría antes
 * de pagar. Pero entonces hay dos calculadoras, y el día que se muevan los
 * precios en index.html sin volver a correr el extractor, el servidor cobra una
 * cifra distinta de la que la clienta vio en pantalla.
 *
 * Esta batería arma carritos al azar tocando la página de verdad, lee el total
 * que muestra, y lo compara contra lo que el servidor cobraría por ese mismo
 * carrito. Cualquier diferencia es un peso de más o de menos en una compra real.
 */
const { chromium } = require('playwright');
const path = require('path');
const { leerPedido, calcular, cop } = require(
  path.join(__dirname, '..', 'netlify', 'functions', '_precios.js'));

const BASE = process.env.URL || 'http://localhost:8899';
const CASOS = 40;

/* Semilla fija: una falla se reproduce corriendo la batería otra vez, en vez de
   aparecer una de cada tantas veces y no volver a salir. */
let semilla = 20260809;
const azar = () => {
  semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
  return semilla / 0x7fffffff;
};
const entre = (a, b) => a + Math.floor(azar() * (b - a + 1));

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errores = [];
  p.on('pageerror', e => errores.push(e.message));
  await p.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await p.click('#more-btn');            // hace falta para alcanzar todo el catálogo
  await p.waitForTimeout(300);

  /* Cuántas unidades admite cada pieza. La página bloquea el botón al llegar al
     tope, así que un carrito de prueba que pida 6 de algo con 2 unidades no se
     puede armar: la página se quedaría en 2 y la comparación fallaría culpando
     al sitio de un error que está en la prueba. */
  const inventario = require(path.join(__dirname, '..', 'assets', 'stock.json')).items;
  const tope = id => (inventario[id] ? inventario[id].stock : 1);

  /* Piezas que de verdad se pueden agregar hoy: las agotadas tienen el botón
     bloqueado y sumarlas aquí probaría un carrito que nadie puede armar. */
  const disponibles = await p.evaluate(() => {
    const ok = el => el && el.getAttribute('aria-disabled') !== 'true';
    const sacar = sel => [...document.querySelectorAll(sel)]
      .filter(c => !c.classList.contains('is-out') && ok(c.querySelector('.pc-add')))
      .map(c => c.dataset.id)
      .filter(id => id && id !== 'letras');
    return {
      charms: [...new Set(sacar('.pc:not(.pc--b)'))],
      pulseras: [...new Set(sacar('.pc.pc--b'))],
    };
  });

  console.log(`Comparando ${CASOS} carritos contra el cálculo del servidor`);
  console.log(`  piezas disponibles hoy: ${disponibles.charms.length} charms, ` +
    `${disponibles.pulseras.length} brazaletes\n`);

  let fallas = 0;
  const ok = (b, t, extra) => {
    if (!b) fallas++;
    console.log(`  ${b ? '✓' : '✗'} ${t}${extra ? ` — ${extra}` : ''}`);
  };
  for (let i = 0; i < CASOS; i++) {
    const conBase = azar() < 0.75;
    const base = conBase
      ? disponibles.pulseras[entre(0, disponibles.pulseras.length - 1)]
      : null;
    const nCharms = entre(conBase ? 0 : 1, 6);
    const charms = [];
    const puestos = {};
    for (let k = 0; k < nCharms; k++) {
      /* Hasta 8 intentos de encontrar uno que todavía admita otra unidad; si el
         azar insiste en piezas topadas, el carrito sale más corto y ya. */
      for (let intento = 0; intento < 8; intento++) {
        const id = disponibles.charms[entre(0, disponibles.charms.length - 1)];
        if ((puestos[id] || 0) < tope(id)) {
          puestos[id] = (puestos[id] || 0) + 1;
          charms.push(id);
          break;
        }
      }
    }
    if (!base && charms.length === 0) charms.push(disponibles.charms[0]);
    const empaque = azar() < 0.4;
    const pago = azar() < 0.5 ? 'contraentrega' : 'anticipado';

    const enPantalla = await p.evaluate(async ({ base, charms, empaque, pago }) => {
      const esperar = () => new Promise(r => setTimeout(r, 30));
      const boton = id => {
        const c = document.querySelector(`.pc[data-id="${CSS.escape(id)}"]`);
        return c && c.querySelector('.pc-add');
      };
      /* Vaciar lo del caso anterior. De uno en uno y volviendo a consultar el
         DOM: cada quitar vuelve a pintar la hoja entera, así que los nodos que
         se hubieran guardado antes del primer clic ya no son los de la pantalla
         y los siguientes clics no harían nada. */
      for (let i = 0; i < 200; i++) {
        const x = document.querySelector('#sheet-body .srow-x');
        if (!x) break;
        x.click();
        await esperar();
      }

      /* «Elegir» en un brazalete solo abre el selector de tallas: lo que mete la
         pieza en el carrito es tocar una talla. Sin este segundo clic el
         carrito se queda sin brazalete y el total no cuadra. */
      let talla = null;
      if (base) {
        boton(base).click();
        await esperar();
        const libre = document.querySelector(
          `.pc[data-id="${CSS.escape(base)}"] .tbtn:not([aria-disabled="true"])`);
        if (libre) { talla = libre.dataset.talla; libre.click(); await esperar(); }
      }
      for (const id of charms) { boton(id).click(); await esperar(); }

      const pk = document.getElementById('pack');
      if (pk.checked !== empaque) { pk.click(); await esperar(); }
      document.querySelector(`.pbtn[data-pago="${pago}"]`).click();
      await esperar();

      return {
        total: document.getElementById('v-tot').textContent.trim(),
        envio: document.getElementById('v-ship').textContent.trim(),
        piezas: document.querySelectorAll('#sheet-body .srow').length,
        talla,
      };
    }, { base, charms, empaque, pago });

    const servidor = calcular(leerPedido({
      base: base ? { id: base, talla: enPantalla.talla } : null, charms, empaque, pago,
    }));

    const esperado = cop(servidor.total);
    const igual = esperado === enPantalla.total;
    if (!igual) fallas++;

    const resumen = `${base ? base.replace('pulsera-', 'brz:') : 'sin brazalete'}` +
      ` + ${charms.length} charms${empaque ? ' + empaque' : ''} · ${pago}`;
    if (igual) {
      console.log(`  ✓ ${resumen} → ${esperado}`);
    } else {
      console.log(`  ✗ ${resumen}`);
      console.log(`      página:  ${enPantalla.total}  (envío ${enPantalla.envio})`);
      console.log(`      servidor: ${esperado}  (envío ${servidor.envio}, ` +
        `subtotal ${cop(servidor.subtotal)})`);
    }
  }

  /* El envío gratis es solo del pago anticipado. Es la regla más fácil de
     desincronizar entre las tres calculadoras, porque el mismo carrito da dos
     totales distintos según cómo se pague. */
  console.log('\nEnvío gratis: beneficio exclusivo del prepago');
  {
    const R = require(path.join(__dirname, '..', 'assets', 'catalogo.json')).reglas;
    const gordo = { base: { id: 'pulsera-corazon-con-diamante', talla: '21' },
      charms: ['mickey-mouse', 'stitch', 'minnie-mouse'], empaque: false };
    const ant = calcular(leerPedido(Object.assign({}, gordo, { pago: 'anticipado' })));
    const con = calcular(leerPedido(Object.assign({}, gordo, { pago: 'contraentrega' })));
    ok(ant.subtotal >= R.envioGratisDesde, 'el carrito de prueba pasa del umbral',
      cop(ant.subtotal));
    ok(ant.envio === 0, 'anticipado por encima del umbral: envío gratis');
    ok(con.envio === R.envio.contraentrega,
      'contraentrega por encima del umbral: sigue pagando envío', cop(con.envio));
    ok(con.total - ant.total === R.envio.contraentrega,
      'la diferencia entre ambos es exactamente el envío de contraentrega');

    /* Y por debajo del umbral cada uno paga su tarifa, como siempre. */
    const flaco = { charms: ['mickey-mouse'] };
    const fa = calcular(leerPedido(Object.assign({}, flaco, { pago: 'anticipado' })));
    const fc = calcular(leerPedido(Object.assign({}, flaco, { pago: 'contraentrega' })));
    ok(fa.envio === R.envio.anticipado && fc.envio === R.envio.contraentrega,
      'por debajo del umbral cada forma de pago paga su tarifa');
  }

  /* Que el servidor rechace lo que no debería aceptar. Cada uno de estos es un
     intento real: cambiar el id por uno inventado, mandar un brazalete en la
     lista de charms, pedir una talla que no existe. */
  console.log('\nLo que el servidor tiene que rechazar');
  const rechazos = [
    ['carrito vacío', { charms: [] }],
    ['charm inventado', { charms: ['charm-de-oro-macizo'] }],
    ['brazalete colado entre los charms', { charms: ['pulsera-avengers'] }],
    ['talla que no existe', { base: { id: 'pulsera-avengers', talla: '25' }, charms: [] }],
    ['charm que no es texto', { charms: [{ precio: 1 }] }],
    ['pedido de 500 charms', { charms: Array(500).fill('mickey-mouse') }],
  ];
  for (const [que, cuerpo] of rechazos) {
    let paso = false;
    try { leerPedido(cuerpo); paso = true; } catch (_) { /* rechazado, que es lo correcto */ }
    if (paso) { fallas++; console.log(`  ✗ ${que}: lo aceptó`); }
    else console.log(`  ✓ ${que}: rechazado`);
  }

  console.log(errores.length ? `\nerrores JS: ${errores.join(' | ')}` : '\nerrores JS: ninguno ✓');
  console.log(fallas
    ? `\n✗ ${fallas} diferencia(s) entre lo que muestra la página y lo que cobraría el servidor`
    : '\nLa página y el servidor cobran lo mismo en los 40 carritos ✓');

  await b.close();
})();
