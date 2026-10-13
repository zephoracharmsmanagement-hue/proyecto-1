'use strict';
/* La hoja de inventario: que lo que se apunta cuadre con lo que hay.
 *
 * La hoja existe porque reponer inventario obligaba a preguntarle al propietario
 * qué se había vendido, de memoria. Lo que esta batería vigila es lo que hace
 * que la hoja sirva para eso:
 *
 *   1. Que `quedan` salga del inventario y no de una resta de la hoja. Una hoja
 *      que hace su propia cuenta acaba discrepando del inventario que decide las
 *      ventas, y se descubre vendiendo algo que no existe.
 *   2. Que el error, cuando ocurra, tire hacia el lado seguro. Un aviso perdido
 *      deja la hoja con menos ventas de las reales, o sea con MÁS existencias de
 *      las que hay: es la dirección peligrosa, y por eso cada intento deja línea
 *      en el log en vez de callarse.
 *   3. Que nunca pueda tumbar una venta cobrada.
 */
const path = require('path');
const { pathToFileURL } = require('url');
const RAIZ = path.join(__dirname, '..');
const cargar = f => import(pathToFileURL(path.join(RAIZ, 'netlify', 'functions', f)).href);

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

/* Almacén en memoria con CAS, como el de pruebas/inventario.js. */
function almacenFalso() {
  let dato = null; let etag = 0;
  return {
    async getWithMetadata() { return dato === null ? null : { data: JSON.parse(JSON.stringify(dato)), etag: String(etag) }; },
    async setJSON(clave, valor, opciones) {
      if (opciones && opciones.onlyIfMatch !== undefined && opciones.onlyIfMatch !== String(etag)) {
        return { modified: false };
      }
      dato = JSON.parse(JSON.stringify(valor)); etag++;
      return { modified: true };
    },
  };
}

/* Ver pruebas/_pieza.js: el brazalete se elige del inventario. Este pedido sí
   pasa por crear-pago, así que tiene que ser uno que de verdad se pueda vender. */
const BRZ = require('./_pieza').brazalete();

const LINEAS = [
  { id: 'pulsera-avengers', nombre: 'Brazalete Avengers', talla: '20', unidades: 1, precio: 58000 },
  { id: 'guantelete-del-infinito', nombre: 'Guantelete del Infinito', talla: null, unidades: 2, precio: 156400 },
];

(async () => {
  const hoja = await cargar('_hoja.mjs');
  const inventario = await cargar('_inventario.mjs');

  console.log('\n1 · Una fila por pieza, no por pedido');
  {
    const filas = hoja._interno.movimientos({
      referencia: 'ZC-260816-AAAA1111', pago: 'contraentrega',
      cuando: '2026-08-16T15:00:00.000Z', ciudad: 'Bogotá D.C., Bogotá D.C.',
      lineas: LINEAS, restante: { 'pulsera-avengers|20': 0, 'guantelete-del-infinito': 1 },
    });
    comprobar(filas.length === 2, 'un pedido de dos piezas son dos movimientos',
      `${filas.length} filas`);
    const brazalete = filas.find(f => f.id === 'pulsera-avengers');
    comprobar(brazalete && brazalete.talla === '20',
      'la talla va en su propia columna, no pegada al nombre');
    comprobar(brazalete && brazalete.quedan === 0,
      'y `quedan` llega tal cual, incluido el cero', `quedan=${brazalete && brazalete.quedan}`);
    const guante = filas.find(f => f.id === 'guantelete-del-infinito');
    comprobar(guante && guante.unidades === 2 && guante.quedan === 1,
      'con las unidades pedidas y lo que sobra de esa pieza');
    comprobar(filas.every(f => f.referencia === 'ZC-260816-AAAA1111'),
      'todas llevan la referencia, para que la hoja pueda descartar duplicados');
  }

  console.log('\n2 · `quedan` sale del inventario, no de la hoja');
  {
    /* Es el punto que sostiene todo lo demás. El número tiene que venir del
       mismo CAS que confirma la venta: leerlo después sería otra lectura, con
       otras ventas de por medio. */
    inventario._interno.usarAlmacen(almacenFalso());
    /* Una talla con exactamente una unidad, elegida del inventario: venderla
       tiene que dejar el resto en cero. Ver _pieza.js. */
    const ULT = require('./_pieza').ultimaUnidad();
    const pedido = { base: { id: ULT.id, talla: ULT.talla }, charms: ['guantelete-del-infinito'] };
    await inventario.reservar('ZC-1', pedido);
    const cierre = await inventario.confirmar('ZC-1');

    comprobar(cierre.modo === 'confirmado' && cierre.restante,
      'confirmar() devuelve lo que queda de cada pieza vendida',
      JSON.stringify(cierre.restante));
    /* La talla elegida tenía 1 unidad. Vendida esa, quedan 0. Ni el brazalete
       ni el número del guantelete se clavan: lo que se comprueba es la regla
       —queda uno menos de lo que había— y no una cifra del catálogo. */
    comprobar(cierre.restante[`${ULT.id}|${ULT.talla}`] === 0,
      'la última unidad de una talla deja el resto en cero',
      `${ULT.id} talla ${ULT.talla}`);
    const hay = inventario._interno.existencias('guantelete-del-infinito');
    comprobar(cierre.restante['guantelete-del-infinito'] === hay - 1,
      'y de un charm queda exactamente uno menos que antes',
      `había ${hay}, quedan ${cierre.restante['guantelete-del-infinito']}`);
  }

  console.log('\n3 · Sin webhook y con webhook caído');
  {
    const guardado = process.env.HOJA_WEBHOOK;
    const fetchReal = globalThis.fetch;

    delete process.env.HOJA_WEBHOOK;
    const sin = await hoja.anotarVenta({ referencia: 'ZC-2', lineas: LINEAS });
    comprobar(sin.enviado === false && /sin HOJA_WEBHOOK/.test(sin.motivo),
      'sin la variable no se manda nada y no se rompe nada');

    process.env.HOJA_WEBHOOK = 'https://n8n.ejemplo/webhook/hoja';
    globalThis.fetch = async () => { throw new Error('se cayó la red'); };
    const caido = await hoja.anotarVenta({ referencia: 'ZC-3', lineas: LINEAS });
    comprobar(caido.enviado === false && !/throw/.test(String(caido.motivo)),
      'si n8n no responde, se anota el motivo y no se lanza nada',
      caido.motivo);

    globalThis.fetch = async () => ({ ok: false, status: 500 });
    const error500 = await hoja.anotarVenta({ referencia: 'ZC-4', lineas: LINEAS });
    comprobar(error500.enviado === false && /500/.test(error500.motivo),
      'un 500 del webhook queda registrado como no enviado', error500.motivo);

    /* El token es lo que impide que cualquiera que conozca la URL escriba filas
       en el inventario de la tienda. */
    let cabeceras = null, url = null;
    globalThis.fetch = async (u, o) => { url = u; cabeceras = o.headers; return { ok: true, status: 200 }; };
    process.env.HOJA_TOKEN = 'secreto-de-prueba';
    const bien = await hoja.anotarVenta({ referencia: 'ZC-5', lineas: LINEAS, restante: {} });
    comprobar(bien.enviado === true && bien.filas === 2, 'con todo en su sitio, se manda');
    comprobar(cabeceras && cabeceras['X-Zephora-Token'] === 'secreto-de-prueba',
      'y el token viaja en la cabecera, no en la URL',
      'la URL se guarda en logs y en historiales; la cabecera no');
    comprobar(!String(url).includes('secreto-de-prueba'), 'el token no aparece en la URL');

    delete process.env.HOJA_TOKEN;
    globalThis.fetch = fetchReal;
    if (guardado === undefined) delete process.env.HOJA_WEBHOOK;
    else process.env.HOJA_WEBHOOK = guardado;
  }

  console.log('\n4 · La venta manda, la hoja no');
  {
    /* Lo que no puede pasar nunca: que un pedido cobrado se caiga porque la hoja
       de cálculo estaba caída. Se comprueba sobre crear-pago real, con el
       webhook lanzando excepciones. */
    /* Almacén nuevo: la sección 2 vendió la última talla 20 en el almacén falso,
       y ese estado vive en el módulo. Sin reiniciarlo, esto daba 409 por falta de
       inventario y parecía un fallo de la hoja cuando era la prueba anterior
       dejando el mostrador vacío. */
    inventario._interno.usarAlmacen(almacenFalso());

    const guardado = process.env.HOJA_WEBHOOK;
    process.env.HOJA_WEBHOOK = 'https://n8n.ejemplo/webhook/hoja';
    const crearPago = await cargar('crear-pago.mjs');
    const fetchReal = globalThis.fetch;
    globalThis.fetch = async (u) => {
      if (String(u).includes('n8n.ejemplo')) throw new Error('n8n caído');
      return { status: 200 };   // Wompi: el comercio existe
    };
    const req = {
      method: 'POST',
      text: async () => JSON.stringify({
        base: { id: BRZ.id, talla: BRZ.talla }, charms: ['mickey-mouse'],
        empaque: false, pago: 'contraentrega',
        cliente: {
          nombre: 'Marialejandra', apellido: 'Quintanilla', tipodoc: 'CC',
          documento: '1007401199', celular: '3012345678', correo: 'm@ejemplo.com',
          depto: 'Bogotá D.C.', ciudad: 'Bogotá D.C.', direccion: 'Calle 16f #99 - 72',
        },
      }),
    };
    const r = await crearPago.default(req);
    globalThis.fetch = fetchReal;
    if (guardado === undefined) delete process.env.HOJA_WEBHOOK;
    else process.env.HOJA_WEBHOOK = guardado;

    comprobar(r.status === 200, 'con la hoja caída, el pedido contraentrega se cierra igual',
      `HTTP ${r.status}`);
    const cuerpo = JSON.parse(await r.text());
    comprobar(cuerpo.modo === 'contraentrega' && cuerpo.referencia,
      'y devuelve su referencia como si nada', cuerpo.referencia);
  }

  console.log('\n5 · Los campos nuevos: tipo, cliente, canal, total, estado (2026-10-12)');
  {
    /* Un pedido real por crear-pago, contraentrega y desde el enlace del bot
       (`via: 'wa'`), con 4 charms: la promo deja gratis el más barato. Lo que
       se vigila es que la hoja reciba lo que de verdad se cobró. */
    inventario._interno.usarAlmacen(almacenFalso());
    const ped = await cargar('_pedidos.mjs');
    const reg = {};
    ped._interno.usarAlmacen({
      async get(k) { return reg[k] ? JSON.parse(JSON.stringify(reg[k])) : null; },
      async setJSON(k, v) { reg[k] = JSON.parse(JSON.stringify(v)); return { modified: true }; },
      async delete(k) { delete reg[k]; },
      async list() { return { blobs: Object.keys(reg).map(key => ({ key })) }; },
    });
    const P = await cargar('_precios.js').then(m => m.default || m);
    const stock = require(path.join(RAIZ, 'assets', 'stock.json')).items;
    const lista = require(path.join(RAIZ, 'assets', 'catalogo.json')).precios;
    /* Cuatro charms con unidades y de precio distinto, para que se sepa cuál
       es «el gratis» sin depender del desempate. */
    const vistos = new Set();
    const cuatro = Object.keys(stock)
      .filter(i => stock[i].tipo === 'charm' && stock[i].stock >= 1 && !/^letra-/.test(i) && i in lista)
      .filter(i => { if (vistos.has(lista[i])) return false; vistos.add(lista[i]); return true; })
      .slice(0, 4);
    const enviados = [];
    const guardado = process.env.HOJA_WEBHOOK;
    process.env.HOJA_WEBHOOK = 'https://n8n.ejemplo/webhook/hoja';
    const crearPago = await cargar('crear-pago.mjs');
    const fetchReal = globalThis.fetch;
    globalThis.fetch = async (u, op) => {
      if (String(u).includes('n8n.ejemplo')) { enviados.push(JSON.parse(op.body)); return { ok: true, status: 200 }; }
      return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
    };
    const pedir = via => crearPago.default({
      method: 'POST', headers: new Headers(),
      text: async () => JSON.stringify({
        charms: cuatro, pago: 'contraentrega', via,
        cliente: { nombre: 'Marialejandra', apellido: 'Quintanilla', celular: '3012345678', correo: 'm@ejemplo.com',
          depto: 'Antioquia', ciudad: 'Rionegro', direccion: 'Calle 16f #99 - 72' },
      }),
    });
    const r = await pedir('wa');
    const d = JSON.parse(await r.text());
    const c = P.calcular(P.leerPedido({ charms: cuatro, pago: 'contraentrega' }));
    const v = enviados[0] || { movimientos: [] };
    const m = v.movimientos;
    comprobar(r.status === 200 && m.length === 4, `pedido de 4 charms → 4 filas (${cuatro.join(', ')})`,
      `HTTP ${r.status}, ${m.length} filas`);
    comprobar(v.tipo === 'venta' && m.every(f => f.tipo === 'venta'), 'tipo «venta»');
    comprobar(m.every(f => f.cliente === 'Marialejandra Quintanilla'), 'cliente con nombre y apellido', m[0] && m[0].cliente);
    comprobar(m.every(f => f.canal === 'web→whatsapp'), 'desde el enlace del bot: canal «web→whatsapp»', m[0] && m[0].canal);
    comprobar(m.every(f => f.estado === 'contraentrega pendiente'), 'estado «contraentrega pendiente»');
    comprobar(m.every(f => f.total === c.total) && c.total === d.total,
      `total del pedido, con envío, repetido en cada fila (${c.total})`);
    const suma = m.reduce((s, f) => s + f.cobrado, 0);
    comprobar(c.descuento > 0 && suma === c.subtotal,
      `la suma de «cobrado» es lo cobrado sin envío (${suma} = ${c.subtotal}), no la tarifa (${c.subtotal + c.descuento})`);
    const gratis = P.piezasGratis(P.leerPedido({ charms: cuatro, pago: 'contraentrega' }))[0];
    const fg = gratis && m.find(f => f.id === gratis.id);
    comprobar(fg && fg.cobrado === 0, `la pieza gratis de la promo va en $0 (${gratis && gratis.id})`, fg && String(fg.cobrado));
    comprobar(reg[d.referencia] && reg[d.referencia].canal === 'web→whatsapp',
      'el canal queda en el registro, para el pago en línea que se anota después');

    enviados.length = 0;
    inventario._interno.usarAlmacen(almacenFalso());
    await (await pedir('')).text();
    comprobar(enviados[0] && enviados[0].movimientos.every(f => f.canal === 'web'), 'sin `via`: canal «web»');

    /* Pago en línea: la hoja se entera al aprobarse, desde _cierre.mjs, que
       ya no tiene la petición del navegador: el canal sale del registro. */
    enviados.length = 0;
    inventario._interno.usarAlmacen(almacenFalso());
    const { cerrarPago } = await cargar('_cierre.mjs');
    const pa = P.leerPedido({ charms: cuatro, pago: 'anticipado' });
    const ca = P.calcular(pa);
    const refA = 'ZC-261012-CIERRE01';
    await inventario.reservar(refA, pa);
    await ped.guardar(refA, { estado: 'esperando-pago', pago: 'anticipado', lineas: P.detallar(pa), cuentas: ca,
      cliente: { nombre: 'Laura', apellido: 'Gómez', ciudad: 'Medellín', depto: 'Antioquia' }, canal: 'web→whatsapp' });
    await cerrarPago({ referencia: refA, aprobado: true, estado: 'APPROVED', total: ca.total, medio: 'wompi' });
    const w = (enviados.find(e => e.referencia === refA) || { movimientos: [] }).movimientos;
    comprobar(w.length === 4 && w.every(f => f.tipo === 'venta' && f.estado === 'pagado' && f.canal === 'web→whatsapp'
      && f.cliente === 'Laura Gómez' && f.total === ca.total),
      'pago en línea aprobado: estado «pagado», canal y cliente del registro, total del pedido',
      JSON.stringify(w.slice(0, 1).map(f => [f.estado, f.canal, f.cliente, f.total])));
    comprobar(w.reduce((s, f) => s + f.cobrado, 0) === ca.subtotal, `y también aquí la suma de «cobrado» es lo cobrado (${ca.subtotal})`);
    enviados.length = 0;
    const refB = 'ZC-261012-CIERRE02';
    inventario._interno.usarAlmacen(almacenFalso());
    await inventario.reservar(refB, pa);
    await ped.guardar(refB, { estado: 'esperando-pago', pago: 'anticipado', lineas: P.detallar(pa), cuentas: ca,
      cliente: { nombre: 'Laura', apellido: 'Gómez' } });
    await cerrarPago({ referencia: refB, aprobado: true, estado: 'APPROVED', total: ca.total, medio: 'wompi' });
    const w2 = (enviados.find(e => e.referencia === refB) || { movimientos: [] }).movimientos;
    comprobar(w2.length && w2.every(f => f.canal === 'web'), 'un pedido de antes, sin canal guardado, va como «web»');

    globalThis.fetch = fetchReal;
    if (guardado === undefined) delete process.env.HOJA_WEBHOOK;
    else process.env.HOJA_WEBHOOK = guardado;
  }

  console.log('\n6 · Venta manual: lo cobrado repartido, y una cancelación');
  {
    const lineas = [
      { id: 'pulsera-corazon-con-diamante', nombre: 'Brazalete Corazón con Diamante', talla: '17', unidades: 1, precio: 78000, gratis: 0 },
      { id: 'angel-guardian', nombre: 'Ángel Guardián', talla: null, unidades: 1, precio: 86000, gratis: 0 },
    ];
    /* Precio de chat distinto de la lista: 150.000 por 164.000 de tarifa. */
    const v = hoja._interno.movimientos({ referencia: 'MAN-X', lineas, total: 150000, prorratear: true,
      cliente: { nombre: 'Valeria Bedoya' }, canal: 'whatsapp', estado: 'pagado' });
    comprobar(v.reduce((s, f) => s + f.cobrado, 0) === 150000, 'prorrateado: las líneas suman exactamente lo cobrado',
      v.map(f => f.cobrado).join(' + '));
    comprobar(v[0].cliente === 'Valeria Bedoya' && v[0].canal === 'whatsapp', 'cliente y canal «whatsapp»');

    const enviados = [];
    const guardado = process.env.HOJA_WEBHOOK;
    process.env.HOJA_WEBHOOK = 'https://n8n.ejemplo/webhook/hoja';
    const fetchReal = globalThis.fetch;
    globalThis.fetch = async (u, op) => { enviados.push(JSON.parse(op.body)); return { ok: true, status: 200 }; };
    await hoja.anotarCancelacion({ referencia: 'ZC-261009-RIONEGRO', pago: 'contraentrega', cuando: 'x',
      lineas, restante: { 'pulsera-corazon-con-diamante|17': 1, 'angel-guardian': 2 }, total: 164000,
      cliente: { nombre: 'Ana', apellido: 'Ruiz' }, canal: 'web' });
    globalThis.fetch = fetchReal;
    if (guardado === undefined) delete process.env.HOJA_WEBHOOK;
    else process.env.HOJA_WEBHOOK = guardado;
    const cm = (enviados[0] || {}).movimientos || [];
    comprobar(enviados[0] && enviados[0].tipo === 'cancelacion' && cm.every(f => f.tipo === 'cancelacion' && f.estado === 'cancelado'),
      'tipo «cancelacion», estado «cancelado»');
    comprobar(cm.length === 2 && cm.every(f => f.referencia === 'ZC-261009-RIONEGRO/cancelacion'),
      'referencia propia: n8n empareja por referencia+id+talla, y con la de la venta la pisaría');
    comprobar(cm.every(f => f.unidades > 0) && cm[0].quedan === 1 && cm[1].quedan === 2,
      'unidades que vuelven (+) y «quedan» ya con la unidad devuelta');
    comprobar(cm.reduce((s, f) => s + f.cobrado, 0) === -164000, 'cobrado en negativo: sumada con su venta, queda en cero');
  }

  console.log(fallos ? `\nHoja de inventario: ${fallos} en rojo` : '\nHoja de inventario en verde ✓');
})();
