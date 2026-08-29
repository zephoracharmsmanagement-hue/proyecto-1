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
    /* Para mirar qué quedó escrito de verdad. Una prueba que solo comprueba lo
       que devuelve la función puede estar certificando nada: la regresión del
       contraentrega se veía en el blob, no en la respuesta. */
    _estado: () => dato,
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

  console.log('\n5 · Un contraentrega se anota pendiente, no vendido');
  {
    /* La regresión del 2026-08-29, en el sitio donde ocurrió.
     *
     * crear-pago daba el contraentrega por vendido al crearlo: `confirmar()` en
     * el acto, sin que nadie hubiera pagado ni confirmado. Cada prueba del
     * checkout en producción y cada pedido que la clienta no confirmó se llevó
     * unidades para siempre —Letra E ×2, Atrapasueños Azul, Guantelete— y no se
     * vio hasta cuadrar la hoja a mano semanas después.
     *
     * Aquí se mira lo que de verdad sale hacia n8n y lo que queda en el blob de
     * inventario: la fila tiene que ir como `pendiente`, y `vendido` tiene que
     * seguir vacío. */
    const almacen = almacenFalso();
    inventario._interno.usarAlmacen(almacen);

    const guardado = process.env.HOJA_WEBHOOK;
    process.env.HOJA_WEBHOOK = 'https://n8n.ejemplo/webhook/hoja';
    const crearPago = await cargar('crear-pago.mjs');
    const fetchReal = globalThis.fetch;
    let enviado = null;
    globalThis.fetch = async (u, opciones) => {
      if (String(u).includes('n8n.ejemplo')) {
        enviado = JSON.parse(opciones.body);
        return { ok: true, status: 200 };
      }
      return { status: 200 };
    };
    const r = await crearPago.default({
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
    });
    globalThis.fetch = fetchReal;
    if (guardado === undefined) delete process.env.HOJA_WEBHOOK;
    else process.env.HOJA_WEBHOOK = guardado;

    comprobar(r.status === 200, 'el pedido se crea', `HTTP ${r.status}`);
    comprobar(enviado !== null, 'y la hoja recibe su aviso');
    if (enviado) {
      comprobar(enviado.estado === 'pendiente',
        'el pedido va a la hoja como PENDIENTE, no como venta cerrada',
        enviado.estado);
      comprobar((enviado.movimientos || []).every(m => m.estado === 'pendiente'),
        'y cada movimiento lleva el estado, que es por columna donde se filtra');
      comprobar((enviado.movimientos || []).every(m => typeof m.quedan === 'number'),
        '`quedan` sigue saliendo del inventario y no de una resta de la hoja',
        JSON.stringify((enviado.movimientos || []).map(m => m.quedan)));
    }

    const estado = almacen._estado() || { vendido: {}, reservas: {} };
    comprobar(Object.keys(estado.vendido || {}).length === 0,
      'y NADA queda como vendido: nadie ha pagado ni confirmado todavía',
      JSON.stringify(estado.vendido));
    comprobar(Object.keys(estado.reservas || {}).length === 1,
      'las unidades quedan apartadas, que sí se puede deshacer');

    inventario._interno.usarAlmacen(null);
  }

  console.log(fallos ? `\nHoja de inventario: ${fallos} en rojo` : '\nHoja de inventario en verde ✓');
})();
