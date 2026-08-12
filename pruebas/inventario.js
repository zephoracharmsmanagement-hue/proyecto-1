'use strict';
/* Reserva de inventario: la carrera de la última unidad.
 *
 * Esta batería existe por una razón concreta y vale la pena dejarla escrita:
 * el resto del proyecto ya comprobaba que no se pudiera comprar algo agotado,
 * y aun así dos clientas podían pagar la misma última pieza si lo hacían en el
 * mismo minuto. La comprobación miraba el inventario; no lo apartaba.
 *
 * Lo que hay que demostrar aquí no es que la reserva reste bien —eso es fácil—
 * sino que **dos pedidos simultáneos por la misma última unidad terminan con
 * exactamente uno aprobado**. Por eso el almacén falso imita la única regla de
 * Netlify Blobs que importa para esto: una escritura condicional solo pasa si
 * el etag sigue siendo el que se leyó.
 *
 * Y por eso el almacén falso tiene latencia. Sin ella las dos operaciones se
 * ejecutarían uña tras otra y la prueba pasaría sin haber probado nada — que es
 * exactamente el error que ya cometió la batería del checkout, dando verde a un
 * pago que en producción no cobraba.
 */
const path = require('path');
const { pathToFileURL } = require('url');
const RAIZ = path.join(__dirname, '..');
const cargar = f => import(pathToFileURL(path.join(RAIZ, 'netlify', 'functions', f)).href);
/* _inventario es ESM —importa @netlify/blobs de forma estática, que es lo que
   garantiza que el empaquetador lo incluya—, así que desde esta batería, que es
   CommonJS, se carga con import() dentro de main(). */
let inventario;
const { SinInventario } = require(path.join(RAIZ, 'netlify', 'functions', '_precios.js'));
const INV = require(path.join(RAIZ, 'assets', 'stock.json'));

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (cond, m, d) => (cond ? ok(m, d) : mal(m, d));

const pausa = ms => new Promise(r => setTimeout(r, ms));

/* Imita Netlify Blobs en lo único que este código necesita: getWithMetadata
   devuelve un etag, y setJSON solo escribe si el etag sigue siendo ese
   (onlyIfMatch) o si la clave no existía (onlyIfNew). Todo lo demás sobra. */
function almacenFalso({ latencia = 0 } = {}) {
  let guardado = null;
  let n = 0;
  let escrituras = 0;
  const copia = v => JSON.parse(JSON.stringify(v));
  return {
    async getWithMetadata() {
      await pausa(latencia);
      if (!guardado) return null;
      return { data: copia(guardado.valor), etag: guardado.etag, metadata: {} };
    },
    async setJSON(clave, valor, opciones = {}) {
      await pausa(latencia);
      if (opciones.onlyIfNew && guardado) return { modified: false };
      if (opciones.onlyIfMatch && (!guardado || guardado.etag !== opciones.onlyIfMatch)) {
        return { modified: false };
      }
      guardado = { valor: copia(valor), etag: 'etag-' + (++n) };
      escrituras++;
      return { modified: true, etag: guardado.etag };
    },
    _estado: () => (guardado ? guardado.valor : null),
    _escrituras: () => escrituras,
  };
}

/* Una pieza con exactamente una unidad: es donde la carrera duele. */
const UNICA = Object.entries((INV && INV.items) || {})
  .find(([, v]) => v && v.stock === 1);
/* Un brazalete con tallas, para comprobar que la talla cuenta como pieza
   distinta: quedan de la 20 y cero de la 18 es un caso real del catálogo. */
const CON_TALLAS = Object.entries((INV && INV.items) || {})
  .find(([, v]) => v && v.tallas && Object.keys(v.tallas).length);

const pedidoDe = (charms, base) => ({ charms, base: base || null, pago: 'anticipado', empaque: false });

async function main() {
  inventario = await cargar('_inventario.mjs');

  console.log('1 · Apartar y devolver');

  if (!UNICA) { mal('no hay ninguna pieza con una sola unidad en stock.json'); return; }
  const [pieza] = UNICA;

  {
    const almacen = almacenFalso();
    inventario._interno.usarAlmacen(almacen);

    const r = await inventario.reservar('ZC-1', pedidoDe([pieza]));
    comprobar(r.modo === 'reservado', 'una reserva normal aparta la unidad', r.modo);

    let segundo = null;
    try {
      await inventario.reservar('ZC-2', pedidoDe([pieza]));
    } catch (e) { segundo = e; }
    comprobar(segundo instanceof SinInventario,
      'con la unidad apartada, el siguiente pedido recibe SinInventario',
      segundo ? segundo.constructor.name : 'no lanzó');

    await inventario.liberar('ZC-1');
    const tercero = await inventario.reservar('ZC-3', pedidoDe([pieza]));
    comprobar(tercero.modo === 'reservado',
      'al liberar, la unidad vuelve al mostrador');

    await inventario.confirmar('ZC-3');
    const estado = almacen._estado();
    comprobar(estado.vendido[pieza] === 1 && !estado.reservas['ZC-3'],
      'confirmar pasa lo apartado a vendido y borra la reserva');

    await inventario.confirmar('ZC-3');
    comprobar(almacen._estado().vendido[pieza] === 1,
      'confirmar dos veces no descuenta dos veces (Wompi reintenta sus avisos)');
  }

  console.log('\n2 · La carrera: dos clientas, la última unidad');

  {
    /* La latencia es lo que hace real la prueba: con ella, las dos lecturas
       ocurren antes de que cualquiera de las dos escriba, que es exactamente la
       situación que producía la sobreventa. */
    const almacen = almacenFalso({ latencia: 5 });
    inventario._interno.usarAlmacen(almacen);

    const [a, b] = await Promise.allSettled([
      inventario.reservar('ZC-A', pedidoDe([pieza])),
      inventario.reservar('ZC-B', pedidoDe([pieza])),
    ]);

    const ganaron = [a, b].filter(r => r.status === 'fulfilled' && r.value.modo === 'reservado');
    const perdieron = [a, b].filter(r => r.status === 'rejected' && r.reason instanceof SinInventario);

    comprobar(ganaron.length === 1,
      'exactamente una de las dos se lleva la unidad', `ganaron ${ganaron.length}`);
    comprobar(perdieron.length === 1,
      'la otra recibe SinInventario, no un cobro que habría que devolver',
      `rechazadas ${perdieron.length}`);

    const estado = almacen._estado();
    const apartadas = Object.values(estado.reservas)
      .reduce((s, r) => s + (r.items[pieza] || 0), 0);
    comprobar(apartadas === 1,
      'el estado queda con una sola unidad apartada', `apartadas ${apartadas}`);
  }

  {
    /* Diez a la vez sobre tres unidades: pasan tres, no diez. */
    const almacen = almacenFalso({ latencia: 2 });
    inventario._interno.usarAlmacen(almacen);
    const HAY = 3;
    const falso = { charms: [], base: null, pago: 'anticipado', empaque: false };
    /* Se usa una pieza inventada con tres unidades simulando el stock real a
       través de vendido: se parte de una pieza con 1 y se "devuelven" 2. */
    const inicial = inventario._interno.vacio();
    inicial.vendido[pieza] = 1 - HAY;   // deja tres libres sobre la misma clave
    await almacen.setJSON('estado', inicial, { onlyIfNew: true });

    const intentos = Array.from({ length: 10 }, (_, i) =>
      inventario.reservar('ZC-C' + i, pedidoDe([pieza])));
    const res = await Promise.allSettled(intentos);
    const pasaron = res.filter(r => r.status === 'fulfilled' && r.value.modo === 'reservado').length;
    const negados = res.filter(r => r.status === 'rejected' && r.reason instanceof SinInventario).length;
    comprobar(pasaron === HAY, `de diez pedidos simultáneos pasan ${HAY}`, `pasaron ${pasaron}`);
    comprobar(pasaron + negados === 10, 'ninguno se queda en un estado indefinido',
      `${pasaron} + ${negados}`);
    void falso;
  }

  console.log('\n3 · Tallas y piezas sin conteo');

  if (CON_TALLAS) {
    const [brazalete, datos] = CON_TALLAS;
    const talla = Object.keys(datos.tallas)[0];
    const almacen = almacenFalso();
    inventario._interno.usarAlmacen(almacen);

    const hay = +datos.tallas[talla];
    const res = [];
    for (let i = 0; i < hay; i++) {
      res.push(await inventario.reservar('ZC-T' + i, pedidoDe([], { id: brazalete, talla })));
    }
    comprobar(res.every(r => r.modo === 'reservado'),
      `se pueden apartar las ${hay} unidades de la talla ${talla}`);

    let extra = null;
    try {
      await inventario.reservar('ZC-TX', pedidoDe([], { id: brazalete, talla }));
    } catch (e) { extra = e; }
    comprobar(extra instanceof SinInventario,
      'una más de esa talla ya no cabe');

    const otra = Object.keys(datos.tallas).find(t => t !== talla);
    if (otra) {
      let r = null;
      try { r = await inventario.reservar('ZC-TO', pedidoDe([], { id: brazalete, talla: otra })); }
      catch (e) { void e; }
      comprobar(r !== null, 'otra talla del mismo brazalete se cuenta aparte');
    } else {
      ok('el brazalete de prueba solo tiene una talla, no aplica el contraste');
    }
  } else {
    mal('no hay ningún brazalete con tallas en stock.json');
  }

  {
    const almacen = almacenFalso();
    inventario._interno.usarAlmacen(almacen);
    const r = await inventario.reservar('ZC-SC', pedidoDe(['pieza-que-no-existe-en-inventario']));
    comprobar(r.modo === 'reservado',
      'una pieza sin conteo declarado se vende como antes de que existiera el archivo');
  }

  console.log('\n4 · Caducidad');

  {
    const almacen = almacenFalso();
    inventario._interno.usarAlmacen(almacen);
    const viejo = inventario._interno.vacio();
    viejo.reservas['ZC-VIEJA'] = { items: { [pieza]: 1 }, vence: Date.now() - 1000 };
    await almacen.setJSON('estado', viejo, { onlyIfNew: true });

    const r = await inventario.reservar('ZC-NUEVA', pedidoDe([pieza]));
    comprobar(r.modo === 'reservado',
      'una reserva vencida no bloquea: el checkout abandonado devuelve la unidad');
    comprobar(!almacen._estado().reservas['ZC-VIEJA'],
      'y se limpia sola al escribir, sin barrido en segundo plano');
  }

  console.log('\n4b · Reponer inventario');

  {
    /* El desfase que esto evita no da ningún error: la tienda simplemente
       ofrece menos de lo que tiene, y cada venta lo empeora. Sin esta prueba
       solo se vería semanas después, como piezas «agotadas» que están en la
       mano. */
    {
      const almacen = almacenFalso();
      inventario._interno.usarAlmacen(almacen);

      const viejo = inventario._interno.vacio();
      viejo.base = '1999-01-01';            // contando contra un stock.json anterior
      viejo.vendido[pieza] = 1;             // y con la única unidad ya vendida
      await almacen.setJSON('estado', viejo, { onlyIfNew: true });

      /* Con el conteo viejo esta pieza estaría a cero y la venta se caería. Es
         justo el síntoma que esto evita: una pieza «agotada» que está en la mano. */
      const r = await inventario.reservar('ZC-REPUESTO', pedidoDe([pieza]));
      comprobar(r.modo === 'reservado',
        'tras reponer, la pieza vuelve a venderse en vez de quedarse agotada de mentira',
        r.modo);

      const estado = almacen._estado();
      comprobar(Object.keys(estado.vendido).length === 0,
        'lo vendido vuelve a cero — el conteo nuevo de stock.json ya lo descuenta');
      comprobar(estado.base && estado.base !== '1999-01-01',
        'y queda anotado contra qué versión de stock.json se está contando');
    }

    {
      /* Reponer no puede regalar unidades que alguien está pagando ahora mismo. */
      const almacen = almacenFalso();
      inventario._interno.usarAlmacen(almacen);

      const viejo = inventario._interno.vacio();
      viejo.base = '1999-01-01';
      viejo.reservas['ZC-EN-VUELO'] = { items: { [pieza]: 1 }, vence: Date.now() + 600000 };
      await almacen.setJSON('estado', viejo, { onlyIfNew: true });

      let error = null;
      try { await inventario.reservar('ZC-OTRA', pedidoDe([pieza])); }
      catch (e) { error = e; }
      comprobar(error instanceof SinInventario,
        'las reservas en vuelo sobreviven al rebase: esas unidades siguen apartadas');
    }
  }

  console.log('\n5 · Falla hacia adelante');

  {
    inventario._interno.usarAlmacen(null);
    /* Sin almacén inyectado y sin Blobs configurado, almacen() devuelve null. */
    const r = await inventario.reservar('ZC-SIN', pedidoDe([pieza]));
    comprobar(r.ok === true && r.modo !== 'reservado',
      'sin almacén disponible la venta pasa igual', r.modo);
  }

  {
    const roto = {
      async getWithMetadata() { throw new Error('red caída'); },
      async setJSON() { throw new Error('red caída'); },
    };
    inventario._interno.usarAlmacen(roto);
    const r = await inventario.reservar('ZC-ROTO', pedidoDe([pieza]));
    comprobar(r.ok === true && r.modo === 'sin-lectura',
      'si Blobs no responde, una lectura fallida no cuesta una compra buena', r.modo);
  }

  {
    /* Un almacén que nunca deja escribir: el CAS no converge nunca. Tampoco
       puede bloquear la venta — seis choques no son un dato de que no haya. */
    const terco = {
      async getWithMetadata() { return { data: inventario._interno.vacio(), etag: 'x', metadata: {} }; },
      async setJSON() { return { modified: false }; },
    };
    inventario._interno.usarAlmacen(terco);
    const r = await inventario.reservar('ZC-TERCO', pedidoDe([pieza]));
    comprobar(r.ok === true && r.modo === 'sin-converger',
      'si el CAS no converge, se deja pasar y queda gritado en el log', r.modo);
  }

  inventario._interno.usarAlmacen(null);

  console.log('\n6 · Las funciones tienen que ser v2');

  /* Esta sección existe porque el fallo ya ocurrió y ninguna prueba lo vio.
   *
   * Netlify solo inyecta NETLIFY_BLOBS_CONTEXT en funciones v2. Con las v1 de
   * antes, getStore() lanzaba y todo esto se caía al camino de emergencia: la
   * tienda vendía, nada se rompía, y no se reservaba nada. Estuvo así en
   * producción una jornada entera.
   *
   * Y las cinco secciones de arriba pasaban igual, porque en local siempre se
   * usa el almacén falso o el camino de emergencia — nunca el de verdad. Una
   * batería que no mira el mecanismo puede estar certificando nada, que es la
   * lección que este proyecto ya se había llevado con un pago que no cobraba.
   *
   * Comprobar la versión del handler es lo más cerca que se puede estar de eso
   * sin levantar Netlify: si alguien vuelve a v1, esto se pone rojo. */
  {
    /* Y la forma del import, que fue el segundo fallo silencioso seguido de la
       misma pieza. @netlify/blobs tiene que importarse de forma estática y a
       nivel de módulo: con un require perezoso dentro de una función, el
       rastreador de dependencias de Netlify no lo veía, no empaquetaba la
       librería, y en producción reventaba con «Cannot find module» — sin romper
       nada, porque esto falla hacia adelante. */
    const fuente = require('fs').readFileSync(
      path.join(RAIZ, 'netlify', 'functions', '_inventario.mjs'), 'utf8');
    /* Sin comentarios: la cabecera del módulo explica por qué el require
       perezoso era un error, y mencionarlo no puede hacer fallar la prueba. */
    const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    comprobar(/^import \{[^}]*getStore[^}]*\} from '@netlify\/blobs';$/m.test(codigo),
      '_inventario.mjs importa @netlify/blobs de forma estática');
    comprobar(!/require\(\s*['"]@netlify\/blobs['"]\s*\)/.test(codigo),
      'y no queda ningún require perezoso, que el empaquetador no vería');

    for (const archivo of ['crear-pago.mjs', 'wompi-webhook.mjs']) {
      const ruta = path.join(RAIZ, 'netlify', 'functions', archivo);
      let mod = null;
      try { mod = await import(pathToFileURL(ruta).href); } catch (e) { void e; }
      comprobar(mod !== null, `${archivo} existe y se puede cargar`);
      if (!mod) continue;
      comprobar(typeof mod.default === 'function',
        `${archivo} exporta el handler v2 por defecto`);
      comprobar(mod.handler === undefined,
        `${archivo} ya no exporta el handler v1 — con v1, Blobs no se configura`);
    }
  }

  console.log(fallos ? `\nReserva de inventario: ${fallos} en rojo` : '\nReserva de inventario en verde ✓');
}

main().catch(e => { console.log('  ✗ FALLA excepción no capturada — ' + e.stack); process.exit(1); });
