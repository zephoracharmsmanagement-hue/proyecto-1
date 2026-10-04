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
  /* El catálogo completo ya nace abierto; este clic lo cerraría. Se deja una
     llamada que garantiza el estado abierto sin depender de cómo empiece. */
  await p.evaluate(() => { const f = document.querySelector('#full-cat');
    if (f && f.hidden) document.querySelector('#more-btn').click(); });
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
    const pago = azar() < 0.5 ? 'contraentrega' : 'anticipado';

    const enPantalla = await p.evaluate(async ({ base, charms, pago }) => {
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

      document.querySelector(`.pbtn[data-pago="${pago}"]`).click();
      await esperar();

      const dn = document.getElementById('desc-nota');
      return {
        total: document.getElementById('v-tot').textContent.trim(),
        envio: document.getElementById('v-ship').textContent.trim(),
        piezas: document.querySelectorAll('#sheet-body .srow').length,
        talla,
        /* El aviso de la promo: null si no se muestra. */
        descNota: dn.hidden ? null : dn.textContent.trim(),
        /* La barra de la promo: casillas llenas, o null si no se pinta. */
        dto: document.getElementById('hoja-dto').hidden ? null
          : document.querySelectorAll('#hoja-dto li.is-on').length,
        /* Las líneas que salen GRATIS: lo tachado en cada una. */
        tachado: [...document.querySelectorAll('#sheet-body .srow--gratis .srow-p s')]
          .map(s => +s.textContent.replace(/\D/g, '')),
        gratisDice: [...document.querySelectorAll('#sheet-body .srow--gratis .srow-p b')]
          .every(b => b.textContent.trim() === 'GRATIS'),
      };
    }, { base, charms, pago });

    const servidor = calcular(leerPedido({
      base: base ? { id: base, talla: enPantalla.talla } : null, charms, pago,
    }));

    const esperado = cop(servidor.total);
    const igual = esperado === enPantalla.total;
    if (!igual) fallas++;

    /* La promo en la hoja: lo que sale tachado con «GRATIS» tiene que
       sumar exactamente lo que el servidor descuenta —si no, la clienta ve una
       pieza gratis que no le cobran gratis, o al revés—; la barra llena una
       casilla por pieza de la vuelta en curso, y el aviso dice cuántas faltan
       para la próxima. Todo contra las reglas del servidor, no contra la página. */
    {
      const R = require(path.join(__dirname, '..', 'assets', 'catalogo.json')).reglas;
      const T = R.promo.tramos;
      const piezas = charms.length + (base ? 1 : 0);
      /* El tramo de la barra: 1…4 hasta la primera gratis, después 5…7; desde
         7, el último lleno (máximo). */
      const sig = T.find(t => t[0] > piezas), hechos = T.filter(t => t[0] <= piezas);
      const ult = hechos[hechos.length - 1], prev = hechos[hechos.length - 2];
      const max = !sig, completo = max || (ult && ult[0] === piezas);
      const fin = max ? ult[0] : (completo ? piezas : sig[0]);
      const ini = completo ? (prev ? prev[0] : 0) : (ult ? ult[0] : 0);
      const llenas = piezas ? Math.min(piezas, fin) - ini : null;
      const tachado = enPantalla.tachado.reduce((a, b) => a + b, 0);
      if (tachado !== servidor.descuento) {
        fallas++;
        console.log(`  ✗ ${piezas} piezas: lo tachado como GRATIS suma ${cop(tachado)} y el servidor descuenta ${cop(servidor.descuento)}`);
      }
      if (!enPantalla.gratisDice) {
        fallas++;
        console.log(`  ✗ ${piezas} piezas: una línea gratis no dice «GRATIS»`);
      }
      if (enPantalla.dto !== llenas) {
        fallas++;
        console.log(`  ✗ ${piezas} piezas: la barra de la promo llena ${enPantalla.dto} casillas (deberían ser ${llenas})`);
      }
      const nG = servidor.gratis.length;
      const espera = !piezas ? null
        : max ? new RegExp(`tienes ${nG} piezas GRATIS, lo máximo`)
        : completo ? new RegExp(`Felicidades, tienes ${nG} pieza`)
        : new RegExp(`Agrega ${fin - piezas} pieza`);
      if (espera && !(enPantalla.descNota && espera.test(enPantalla.descNota))) {
        fallas++;
        console.log(`  ✗ ${piezas} piezas: el aviso de la promo no dice lo que toca («${enPantalla.descNota}», se esperaba ${espera})`);
      }
    }

    const resumen = `${base ? base.replace('pulsera-', 'brz:') : 'sin brazalete'}` +
      ` + ${charms.length} charms · ${pago}`;
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

    /* El carrito más chico posible: un solo charm. Con umbral 0 ya no existe
       el «por debajo del mínimo», y eso es justo lo que hay que comprobar —el
       envío gratis del prepago no puede depender del tamaño del carrito—. Si
       algún día vuelve un umbral, este bloque lo detecta solo. */
    const flaco = { charms: ['mickey-mouse'] };
    const fa = calcular(leerPedido(Object.assign({}, flaco, { pago: 'anticipado' })));
    const fc = calcular(leerPedido(Object.assign({}, flaco, { pago: 'contraentrega' })));
    const bajoUmbral = fa.subtotal < R.envioGratisDesde;
    ok(fa.envio === (bajoUmbral ? R.envio.anticipado : 0),
      bajoUmbral
        ? 'por debajo del umbral el anticipado paga su tarifa'
        : 'sin umbral, el carrito más chico también lleva envío gratis anticipado',
      cop(fa.envio));
    ok(fc.envio === R.envio.contraentrega,
      'la contraentrega paga su tarifa sin importar el tamaño del carrito',
      cop(fc.envio));
  }

  /* La promo de la portada es HTML escrito a mano. Si alguien cambia PROMO y
     no toca el recuadro, la página anuncia lo que la caja no aplica —y bajo la
     Ley 1480 gana lo anunciado—. Esto compara las dos cosas, y que la regla
     sea la que se anuncia: lo gratis es lo de menor valor, y es cíclica. */
  console.log('\nLa promo de la portada dice lo que se cobra');
  {
    const R = require(path.join(__dirname, '..', 'assets', 'catalogo.json')).reglas;
    const CAT = require(path.join(__dirname, '..', 'assets', 'catalogo.json'));
    const [p1, g1] = R.promo.tramos[0], [p2, g2] = R.promo.tramos[R.promo.tramos.length - 1];
    const caja = (await p.textContent('#promo .promo-caja')).replace(/\s+/g, ' ');
    ok(new RegExp(`Paga ${p1 - g1} y llévate ${g1} gratis`, 'i').test(caja) && new RegExp(`con ${p1} piezas`).test(caja) && new RegExp(`con ${p2} piezas te salen ${g2} gratis`).test(caja),
      `el recuadro anuncia «paga ${p1 - g1}, lleva ${g1} gratis» con ${p1} piezas y ${g2} gratis con ${p2}`, caja.slice(0, 60));
    ok(/menor valor/i.test(caja) && /GRATIS/.test(caja), 'y que la de menor valor sale gratis');
    ok(!(await p.$('#esc')), 'la cuadrícula de tramos viejos ya no está');
    const banner = (await p.textContent('.ann')).replace(/\s+/g, ' ');
    ok(new RegExp(`PAGA ${p1 - g1} Y LLÉVATE ${g1} GRATIS`).test(banner) && new RegExp(`Paga ${p2 - g2} y llévate ${g2}`).test(banner),
      'el banner de arriba dice la misma promo', banner.trim());

    const ch = Object.keys(CAT.precios).filter(id => !CAT.pulseras.includes(id));
    const barato = ch.reduce((a, b) => (CAT.precios[a] <= CAT.precios[b] ? a : b));
    const caro = ch.reduce((a, b) => (CAT.precios[a] >= CAT.precios[b] ? a : b));
    const c4 = calcular(leerPedido({ charms: [caro, caro, caro, barato], pago: 'anticipado' }));
    ok(c4.descuento === CAT.precios[barato] && c4.gratis[0] === barato,
      'con 4 piezas (paga 3) sale gratis la de menor valor', `${barato} ${cop(CAT.precios[barato])}`);
    const c3 = calcular(leerPedido({ charms: [caro, caro, barato], pago: 'anticipado' }));
    ok(c3.descuento === 0, 'con 3 piezas no hay descuento');
    const b = CAT.pulseras.reduce((a, x) => (CAT.precios[a] <= CAT.precios[x] ? a : x));
    const cb = calcular(leerPedido({ base: { id: b, talla: null }, charms: [caro, caro, caro], pago: 'anticipado' }));
    ok(cb.descuento === Math.min(CAT.precios[b], CAT.precios[caro]),
      'el brazalete cuenta como pieza: brazalete + 3 charms ya son 4', cop(cb.descuento));
    const n = k => calcular(leerPedido({ charms: Array(k).fill(caro), pago: 'anticipado' })).gratis.length;
    ok(n(3) === 0 && n(4) === 1 && n(6) === 1 && n(7) === 2 && n(8) === 2 && n(12) === 2,
      'paga 3 lleva 1, paga 5 lleva 2, y ahí para: 3 → 0, 4 → 1, 6 → 1, 7 → 2, 8 → 2, 12 → 2', [3, 4, 6, 7, 8, 12].map(n).join(' · '));
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
