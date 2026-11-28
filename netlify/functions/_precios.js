'use strict';
/* Cálculo del total, del lado del servidor.
 *
 * La página ya calcula el total mientras la clienta arma la pulsera, pero ese
 * número no sirve para cobrar: viaja por el navegador y cualquiera lo cambia
 * antes de enviarlo. Lo único que se acepta del cliente es QUÉ pidió —una lista
 * de identificadores—; el CUÁNTO se calcula aquí, desde catalogo.json.
 *
 * Las reglas son las mismas que las de index.html y salen del mismo sitio:
 * herramientas/extraer_catalogo.py las copia del HTML, y pruebas/precios.js
 * comprueba que este archivo y el navegador den el mismo total.
 */
const CAT = require('../../assets/catalogo.json');
const INV = require('../../assets/stock.json');
const { nombres, pulseras, reglas, fotos, grupos } = CAT;
const ESP = new Set(pulseras);

/* Oferta de temporada (Black Friday 2026). catalogo.json trae dos tablas:
   `precios` —lista menos el descuento— y `lista`. Cuál se cobra lo decide la
   fecha: hasta el último día de `reglas.oferta.hasta`, en hora de Colombia,
   `precios`; después, `lista`, sin que nadie despliegue nada. La página hace
   la misma cuenta (OFERTA en tienda.js) y pruebas/precios.js las compara.

   La media hora de gracia es solo del servidor y a favor de la clienta: quien
   abrió el pago a las 23:58 viendo el precio de oferta no puede encontrarse
   con que se le cobra el de lista a las 00:01. */
const OFERTA = reglas.oferta || null;
const OFERTA_FIN = OFERTA ? Date.parse(OFERTA.hasta + 'T23:59:59-05:00') : 0;
const GRACIA_MS = 30 * 60 * 1000;
const ofertaVigente = (ahora = Date.now()) => !!OFERTA && ahora <= OFERTA_FIN + GRACIA_MS;
const LISTA = CAT.lista || CAT.precios;
/* La tabla con la que se cobra en este instante. Se pide en cada cálculo, no
   una vez al cargar: una función de Netlify puede seguir viva de un día a otro. */
const tabla = ahora => (ofertaVigente(ahora) ? CAT.precios : LISTA);
/* Todas las piezas que existen, con o sin oferta (las dos tablas traen los
   mismos ids; lo exige pruebas/precios.js). */
const precios = CAT.precios;
const precioDe = (id, ahora) => tabla(ahora)[id];
const listaDe = id => LISTA[id];

/* Tope de piezas por pedido. No es una regla de negocio, es un cortafuegos:
   sin él, un carrito con 10.000 charms genera un cobro absurdo. */
const MAX_CHARMS = 60;

/* Varios brazaletes por pedido (2026-11-23, pedido del propietario: una clienta
   quiso dos Mano de Hamsa y hubo que cerrarle la venta por WhatsApp, porque la
   página solo dejaba uno). El pedido lleva `bases`, una lista de {id, talla};
   dos iguales van dos veces. `base` —el primero, o null— se conserva porque es
   la forma de siempre: la mandan el formulario de ventas manuales, el bot y los
   carritos guardados de antes, y la usan pruebas y herramientas. Quien reciba un
   pedido lo recorre con brazaletesDe(), nunca con `pedido.base`: leer solo el
   primero es cobrar o apartar un brazalete de menos sin que nada dé error.
   El tope es un cortafuegos, como MAX_CHARMS. */
const MAX_BRAZALETES = 10;
const brazaletesDe = pedido => (!pedido ? []
  : Array.isArray(pedido.bases) ? pedido.bases
  : pedido.base ? [pedido.base] : []);

/* «Paga 3, lleva 1 gratis · paga 4, lleva 2 gratis» (pedido del
   propietario, 2026-10-04). Brazalete y charms cuentan igual como piezas: con
   4 sale gratis la más barata y con 6 las dos más baratas; de ahí no pasa
   (8 o más siguen siendo 2). `reglas.promo.tramos` = [[piezas, gratis], …].

   El orden de las piezas importa solo para decir CUÁL sale gratis cuando hay
   empate de precio —el total es el mismo—: se ordenan por precio y, a igual
   precio, los charms antes que el brazalete, así lo gratis suele ser un charm
   y el brazalete se ve con su precio. Con varios brazaletes van todos después
   de los charms, en el orden en que se eligieron: entre dos iguales sale gratis
   el primero. La página hace exactamente lo mismo (gratisDe en tienda.js y en
   checkout.html) y pruebas/precios.js lo compara. */
const cuantasGratis = n => reglas.promo.tramos.reduce((g, [p, k]) => (n >= p ? k : g), 0);

function piezasGratis(pedido, ahora) {
  const precios = tabla(ahora);
  const piezas = pedido.charms.map(id => ({ id, precio: precios[id] }));
  /* `talla` y `brazalete` viajan para que detallar() sepa a qué línea ponerle
     el «gratis»: dos del mismo modelo en tallas distintas son dos líneas. */
  brazaletesDe(pedido).forEach(b => piezas.push({ id: b.id, precio: precios[b.id],
    talla: b.talla == null ? null : String(b.talla), brazalete: true }));
  const orden = piezas.map((x, i) => [x, i]).sort((a, b) => a[0].precio - b[0].precio || a[1] - b[1]);
  return orden.slice(0, cuantasGratis(piezas.length)).map(([x]) => x);
}

class PedidoInvalido extends Error {}

/* Normaliza lo que llegó por la red antes de tocarlo. Todo lo que no reconozca
   lo rechaza en vez de ignorarlo: un charm que se cae en silencio es un pedido
   que llega incompleto y una clienta que reclama con razón. */
function leerPedido(cuerpo) {
  if (!cuerpo || typeof cuerpo !== 'object') throw new PedidoInvalido('Pedido vacío');

  const charms = Array.isArray(cuerpo.charms) ? cuerpo.charms : [];
  if (charms.length > MAX_CHARMS) {
    throw new PedidoInvalido(`Máximo ${MAX_CHARMS} charms por pedido`);
  }
  charms.forEach(id => {
    /* hasOwnProperty y no `in`: «constructor» o «toString» están `in` cualquier
       objeto, pasaban por charm y daban un total NaN (visto el 2026-11-23). */
    if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(precios, id)) {
      throw new PedidoInvalido(`Charm desconocido: ${String(id).slice(0, 40)}`);
    }
    if (ESP.has(id)) throw new PedidoInvalido(`${id} es un brazalete, no un charm`);
  });

  /* `bases` si trae algo (la lista), y si no `base` (uno solo, la forma de
     antes). Una lista vacía cuenta como ausente: quien llena `bases: []` por
     costumbre y manda el brazalete en `base` no puede quedarse sin él. Y si
     `bases` viene pero no es una lista, se rechaza en vez de ignorarse. */
  if (cuerpo.bases != null && !Array.isArray(cuerpo.bases)) {
    throw new PedidoInvalido('`bases` debe ser una lista de brazaletes');
  }
  const crudas = (cuerpo.bases && cuerpo.bases.length) ? cuerpo.bases : (cuerpo.base ? [cuerpo.base] : []);
  if (crudas.length > MAX_BRAZALETES) {
    throw new PedidoInvalido(`Máximo ${MAX_BRAZALETES} brazaletes por pedido`);
  }
  const bases = crudas.map(b => {
    const id = b && b.id;
    if (typeof id !== 'string' || !ESP.has(id)) {
      throw new PedidoInvalido(`Brazalete desconocido: ${String(id).slice(0, 40)}`);
    }
    const talla = b.talla == null ? null : String(b.talla);
    if (talla !== null && !/^(17|18|19|20|21)$/.test(talla)) {
      throw new PedidoInvalido(`Talla no válida: ${talla.slice(0, 10)}`);
    }
    return { id, talla };
  });

  if (!bases.length && charms.length === 0) throw new PedidoInvalido('El pedido no tiene piezas');

  const pago = cuerpo.pago === 'contraentrega' ? 'contraentrega' : 'anticipado';
  /* El Empaque Premium se retiró el 2026-09-13: ya no hay dónde elegirlo ni
     dónde verlo en el resumen. El campo se sigue leyendo y se descarta, en vez
     de borrarse: la página lo manda en false, pero un carrito guardado en el
     navegador de una clienta o un enlace de recuperación de la semana pasada
     todavía puede traerlo en true, y cobrar $40.000 por algo que no aparece en
     ninguna línea del pedido es la clase de cargo que termina en reclamo. */
  return { base: bases[0] || null, bases, charms, pago, empaque: false };
}

/* ¿Hay de verdad lo que se está pidiendo?
 *
 * El navegador ya lo comprueba —bloquea el botón al llegar al tope y esconde
 * las tallas sin unidades—, pero eso vive en el cliente y el cliente no manda.
 * Peor: entre que se arma la pulsera y se paga pueden pasar horas, y el
 * inventario pudo cambiar en el medio. Cobrar algo que no existe obliga a
 * devolver el dinero, que bajo la Ley 1480 no es solo una molestia.
 *
 * Esto NO resuelve la carrera de dos clientas comprando la última unidad en el
 * mismo minuto: para eso hace falta reservar, y reservar necesita un almacén
 * con estado. Sí cierra el caso corriente, que es pagar algo agotado desde
 * hace rato o pedir tres de algo que tiene uno.
 */
/* Qué hay que preguntarle al inventario vivo para revisar este pedido: cada
   charm, y cada brazalete con TODAS sus tallas —para poder decir cuáles quedan
   si la que pidió se agotó—. Con la misma clave que usa _inventario.mjs
   (`id` o `id|talla`). */
function skusDeInventario(pedido) {
  const items = (INV && INV.items) || {};
  const s = new Set(pedido.charms);
  brazaletesDe(pedido).forEach(b => {
    const it = items[b.id];
    if (it && it.tallas) Object.keys(it.tallas).forEach(t => s.add(b.id + '|' + t));
    if (b.talla) s.add(b.id + '|' + b.talla);
  });
  return [...s];
}

/* `libres`: lo que hay disponible AHORA por sku, de `disponibles()` en
   _inventario.mjs (conteo + ajustes − vendido − apartado), que es la misma
   cuenta de /disponibilidad. Hasta el 2026-11-27 esta revisión leía solo
   stock.json, el último conteo a mano: una pieza repuesta con un ajuste seguía
   «agotada» aquí aunque la página la mostrara disponible, y el pago la
   rechazaba (Cadena Hamsa y Ojo, en pleno Black Friday). Sin `libres` —el
   almacén no respondió— se usa el conteo, como antes: una lectura fallida no
   puede bloquear la venta. */
function comprobarInventario(pedido, libres) {
  const items = (INV && INV.items) || {};
  const vivo = libres && typeof libres === 'object' ? libres : null;
  /* Sin inventario cargado se deja pasar: una lectura fallida no puede
     bloquear la venta, igual que en la tienda. */
  if (!vivo && !Object.keys(items).length) return;
  /* Cuántas hay de una pieza (o de una talla). Infinity = sin conteo. */
  const hayDe = (id, talla) => {
    const k = talla ? id + '|' + talla : id;
    if (vivo && typeof vivo[k] === 'number') return vivo[k];
    const it = items[id];
    if (!it) return Infinity;
    if (talla) return it.tallas && +it.tallas[talla] > 0 ? +it.tallas[talla] : 0;
    return typeof it.stock === 'number' ? it.stock : Infinity;
  };

  const faltan = [];

  /* Los brazaletes se cuentan por modelo y talla. Hasta el 2026-11-23 solo se
     miraba que la talla tuviera alguna unidad, que con un brazalete por pedido
     bastaba; con varios hay que comparar cuántos se piden con cuántos quedan. */
  const porTalla = new Map();
  const sinTalla = new Set();
  brazaletesDe(pedido).forEach(b => {
    const it = items[b.id];
    if (!it || !it.tallas) return;
    if (!b.talla) {
      if (!sinTalla.has(b.id)) { sinTalla.add(b.id); faltan.push(`${nombres[b.id]}: falta elegir la talla`); }
      return;
    }
    const k = b.id + '|' + b.talla;
    if (!porTalla.has(k)) porTalla.set(k, { id: b.id, t: String(b.talla), piden: 0 });
    porTalla.get(k).piden++;
  });
  porTalla.forEach(({ id, t, piden }) => {
    const it = items[id];
    const hay = hayDe(id, t);
    if (hay <= 0) {
      const quedan = Object.keys(it.tallas).filter(k => hayDe(id, k) > 0);
      faltan.push(`${nombres[id]} talla ${t} cm se agotó`
        + (quedan.length ? ` (quedan ${quedan.join(', ')} cm)` : ''));
    } else if (piden > hay) {
      faltan.push(`${nombres[id]} talla ${t} cm: pediste ${piden} y queda${hay === 1 ? '' : 'n'} ${hay}`);
    }
  });

  const cuenta = {};
  pedido.charms.forEach(id => { cuenta[id] = (cuenta[id] || 0) + 1; });
  Object.entries(cuenta).forEach(([id, piden]) => {
    const hay = hayDe(id, null);
    if (!Number.isFinite(hay)) return;   // pieza sin conteo: pasa
    if (hay <= 0) faltan.push(`${nombres[id]} se agotó`);
    else if (piden > hay) {
      faltan.push(`${nombres[id]}: pediste ${piden} y queda${hay === 1 ? '' : 'n'} ${hay}`);
    }
  });

  if (faltan.length) {
    throw new SinInventario(
      'Se agotó algo de tu selección mientras la armabas: ' + faltan.join('; ')
      + '. Ajusta tu pulsera o escríbenos y lo conseguimos por encargo.');
  }
}

/* Se distingue de PedidoInvalido a propósito: un pedido inválido huele a
   manipulación y no merece explicación; este es un caso legítimo que hay que
   contarle bien a la clienta para que corrija y siga comprando. */
class SinInventario extends Error {}

/* El mismo cálculo que hace la página, con los mismos redondeos y en el mismo
   orden. Si esto y render() en index.html se separan, pruebas/precios.js falla. */
const ESPECIALES = new Set(((reglas.envioEspecial || {}).departamentos || []).map(d => String(d).trim().toLowerCase()));
/* ¿El departamento es de los destinos especiales? Se compara el nombre tal
   como lo trae assets/codigos-dane.json, que es de donde lo elige la clienta. */
const esDestinoEspecial = depto => ESPECIALES.has(String(depto || '').trim().toLowerCase());

function calcular(pedido, ahora, destino) {
  const precios = tabla(ahora);
  const brutoC = pedido.charms.reduce((s, id) => s + precios[id], 0);
  const bases = brazaletesDe(pedido);
  const brutoB = bases.reduce((s, b) => s + precios[b.id], 0);
  const gratis = piezasGratis(pedido, ahora);
  const desc = gratis.reduce((s, x) => s + x.precio, 0);

  /* Envío por zonas (propietario, 2026-11-25).
     · Nacional: con 1 pieza se cobra `reglas.envio` según el pago; desde
       `envioGratisDesdePiezas` (2) es gratis en las dos modalidades. Cuenta
       piezas —cada unidad de brazalete, charm o anillo—, no pesos.
     · Destinos especiales (`reglas.envioEspecial.departamentos`): la guía vale
       mucho más, así que se cobra `envioEspecial.precio`
       siempre, sin gratis por piezas. Que ahí no haya contraentrega lo exige
       crear-pago, no esta función.
     Sin `destino` —el carrito, el bot, el catálogo— se calcula la zona nacional. */
  const subtotal = brutoC + brutoB - desc;
  const piezas = pedido.charms.length + bases.length;
  const especial = esDestinoEspecial(destino);
  const envioGratis = !especial && piezas >= reglas.envioGratisDesdePiezas;
  const envio = subtotal <= 0 ? 0
    : especial ? reglas.envioEspecial.precio
    : envioGratis ? 0 : reglas.envio[pedido.pago];

  /* Wompi cobra en centavos y en enteros. Se redondea una sola vez, al final:
     redondear cada línea deja el total descuadrado frente al que vio la
     clienta en pantalla. */
  const total = Math.round(subtotal + envio);

  return {
    brutoCharms: brutoC,
    brutoBrazalete: brutoB,
    descuento: Math.round(desc),
    /* Las piezas que salieron gratis, para que el correo y la hoja digan
       cuál fue y no solo cuánto. */
    gratis: gratis.map(x => x.id),
    subtotal: Math.round(subtotal),
    envio,
    envioGratis,
    zona: especial ? 'especial' : 'nacional',
    total,
    centavos: total * 100,
  };
}

/* Renglones legibles para el correo, el WhatsApp y el resumen del pedido.
   `gratis` cuenta cuántas unidades de esa línea salieron gratis por la promo;
   `precio` sigue siendo el de lista, para que el correo las muestre tachadas. */
function detallar(pedido, ahora) {
  const precios = tabla(ahora);
  const lineas = [];
  const libres = {};
  /* La clave de un brazalete lleva la talla: lo gratis es de una línea, no de
     todas las del mismo modelo. */
  const claveB = (id, talla) => id + '|' + (talla == null ? '' : String(talla));
  piezasGratis(pedido, ahora).forEach(x => {
    const k = x.brazalete ? claveB(x.id, x.talla) : x.id;
    libres[k] = (libres[k] || 0) + 1;
  });
  /* Una línea por modelo y talla. Dos iguales van en una sola con `unidades: 2`
     y el precio de las dos, como los charms repetidos: la hoja de inventario
     casa sus filas por referencia + id + talla, y dos líneas iguales se
     pisarían. */
  const porTalla = new Map();
  brazaletesDe(pedido).forEach(b => {
    const k = claveB(b.id, b.talla);
    if (!porTalla.has(k)) porTalla.set(k, { id: b.id, talla: b.talla, n: 0 });
    porTalla.get(k).n++;
  });
  porTalla.forEach((b, k) => {
    lineas.push({
      id: b.id,
      nombre: nombres[b.id].replace(/^Pulsera /, 'Brazalete '),
      talla: b.talla,
      unidades: b.n,
      precio: precios[b.id] * b.n,
      gratis: libres[k] || 0,
    });
  });
  const cuenta = {};
  pedido.charms.forEach(id => { cuenta[id] = (cuenta[id] || 0) + 1; });
  Object.entries(cuenta).forEach(([id, n]) => {
    lineas.push({ id, nombre: nombres[id], talla: null, unidades: n, precio: precios[id] * n, gratis: libres[id] || 0 });
  });
  return lineas;
}

const cop = n => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

/* `inventario` se exporta para que _inventario.mjs no tenga que volver a leer
   stock.json por su cuenta: siendo ESM, cargar JSON le obligaría a atributos de
   importación o a createRequire, y las dos formas se comportan distinto según
   si Netlify empaqueta o no. Pasando por aquí, hay un solo sitio que lo lee. */
module.exports = { leerPedido, comprobarInventario, skusDeInventario, calcular, esDestinoEspecial, detallar, piezasGratis, brazaletesDe, cop,
  PedidoInvalido, SinInventario, reglas, nombres, fotos, grupos, inventario: INV,
  ofertaVigente, precioDe, listaDe };
