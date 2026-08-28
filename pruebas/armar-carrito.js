'use strict';
/* Armar un carrito para el bot de WhatsApp.
 *
 * Esta pieza es la que le pone precio a lo que el bot va a prometer, así que lo
 * que hay que demostrar no es que responda, sino que **no puede inventar**:
 *
 *   · El precio tiene que ser el mismo que va a cobrar el checkout. Si aquí sale
 *     uno y allí otro, la clienta ve dos cifras de la misma tienda y la segunda
 *     llega cuando ya sacó la tarjeta.
 *   · No puede ofrecer lo que está apartado por un pago en curso. Es el error que
 *     la reserva de inventario vino a arreglar, y por WhatsApp duele más: en el
 *     checkout lo corrige una pantalla, aquí hay una persona a la que ya se le
 *     dijo que sí.
 *   · No puede escribir nada. Si dejara un pedido en `esperando-pago`, el rescate
 *     del día siguiente le mandaría a la tienda una lista de checkouts
 *     abandonados que nunca existieron — y a quien tuviera `optin`, un correo de
 *     recuperación por una compra imaginaria.
 *
 * Ese último es el que no se ve mirando este archivo: sale de leer `rescate.mjs`.
 * Por eso se comprueba en la forma del código, no solo en el comportamiento.
 */
const path = require('path');
const fs = require('fs');

const RAIZ = path.join(__dirname, '..');

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

/* Imita Netlify Blobs en lo poco que la lectura usa, igual que en
   pruebas/disponibilidad.js. */
function almacenFalso(estado) {
  return {
    async get() { return estado ? JSON.parse(JSON.stringify(estado)) : null; },
    async getWithMetadata() { return estado ? { data: estado, etag: 'e1' } : null; },
    async setJSON() { return { modified: true }; },
    async delete() {},
  };
}

async function main() {
  const mod = await import('../netlify/functions/armar-carrito.mjs');
  const inventario = await import('../netlify/functions/_inventario.mjs');
  const { inventario: stock, calcular, cop, reglas } =
    require(path.join(RAIZ, 'netlify', 'functions', '_precios.js'));
  const items = stock.items;

  /* Piezas reales del catálogo, no ids a mano: la misma regla que el resto de
     las baterías. Un charm con 3 o más hace falta para poder apartar una unidad
     y que aún quede margen. */
  const conStock = Object.keys(items).filter(k => !items[k].tallas && items[k].stock >= 3);
  const charm = conStock[0];
  /* Tres charms **distintos**, uno de cada: hace falta un carrito grande para
     cruzar el umbral de envío gratis, y pedir tres del mismo se chocaría con el
     inventario real —que es lo correcto, pero no es lo que se está probando—. */
  const tres = conStock.slice(0, 3);
  const pulsera = Object.keys(items).find(k => items[k].tallas
    && Object.values(items[k].tallas).some(v => v > 0));
  const talla = Object.keys(items[pulsera].tallas).find(t => items[pulsera].tallas[t] > 0);

  const pedir = async (cuerpo, metodo = 'POST') => {
    const r = await mod.default({
      method: metodo,
      text: async () => JSON.stringify(cuerpo),
    });
    return { r, d: JSON.parse(await r.text()) };
  };

  /* Por defecto, un almacén sano y vacío: nada apartado, nada vendido. */
  inventario._interno.usarAlmacen(almacenFalso({ v: 1, vendido: {}, reservas: {} }));

  console.log('\n1 · El precio es el que va a cobrar el checkout');
  {
    const pedido = { base: { id: pulsera, talla }, charms: [charm, charm], empaque: true };
    const { r, d } = await pedir(pedido);
    comprobar(r.status === 200, 'un carrito bueno responde 200', String(r.status));

    /* La comprobación que da sentido a toda la función: el número que el bot va
       a decir por WhatsApp sale del mismo cálculo que firma el cobro. */
    const esperado = calcular({ base: { id: pulsera, talla },
      charms: [charm, charm], empaque: true, pago: 'anticipado' });
    comprobar(d.total === esperado.total,
      'el total es exactamente el de calcular(), no una aproximación',
      `${d.total} = ${esperado.total}`);
    comprobar(d.descuento === esperado.descuento && d.envio === esperado.envio,
      'y el descuento y el envío también');
    comprobar(d.totalTexto === cop(esperado.total),
      'viene formateado en pesos colombianos, para que el bot no escriba $187,450',
      d.totalTexto);
  }
  {
    /* La regla más fácil de que un modelo se salte: el envío gratis es **solo**
       del prepago (`envioGratisSoloAnticipado`), así que el mismo carrito vale
       distinto según cómo se pague. Un bot que dijera el precio del prepago a
       quien va a pagar contraentrega se equivoca en $25.000 sin que nada falle.
       Se prueba por encima del umbral, que es donde las dos ramas divergen. */
    const grande = { base: { id: pulsera, talla }, charms: tres, empaque: false };
    const a = await pedir(Object.assign({ pago: 'anticipado' }, grande));
    const b = await pedir(Object.assign({ pago: 'contraentrega' }, grande));
    comprobar(a.d.subtotal >= reglas.envioGratisDesde,
      'el carrito de prueba pasa el umbral de envío gratis',
      `${cop(a.d.subtotal)} ≥ ${cop(reglas.envioGratisDesde)}`);
    comprobar(a.d.envioGratis === true && a.d.envio === 0,
      'pagando por adelantado, el envío sale gratis');
    comprobar(b.d.envioGratis === false && b.d.envio === reglas.envio.contraentrega,
      'y contraentrega lo paga igual, aunque el carrito sea el mismo',
      cop(b.d.envio));
    comprobar(b.d.total - a.d.total === reglas.envio.contraentrega,
      'la diferencia es exactamente el envío, no una aproximación',
      `${a.d.totalTexto} vs ${b.d.totalTexto}`);
  }

  console.log('\n2 · No se puede armar lo que el checkout rechazaría');
  {
    const { r, d } = await pedir({ charms: ['pieza-que-no-existe'] });
    comprobar(r.status === 400, 'un charm inventado se rechaza, no se ignora', String(r.status));
    comprobar(/desconocido/i.test(d.error), 'y el motivo dice cuál', d.error);
  }
  {
    const { r } = await pedir({ charms: [pulsera] });
    comprobar(r.status === 400, 'un brazalete pedido como charm se rechaza');
  }
  {
    const { r, d } = await pedir({ base: { id: pulsera, talla: '47' } });
    comprobar(r.status === 400 && /alla/.test(d.error),
      'una talla que no existe se rechaza', d.error);
  }
  {
    const { r } = await pedir({ charms: Array(61).fill(charm) });
    comprobar(r.status === 400, 'el tope de 60 charms también rige aquí');
  }
  {
    const { r } = await pedir({ charms: [] });
    comprobar(r.status === 400, 'un carrito vacío no genera enlace');
  }
  {
    const { r } = await pedir({ charms: [charm] }, 'GET');
    comprobar(r.status === 405, 'solo POST: un GET no arma carritos');
  }

  console.log('\n3 · No se ofrece lo que otra clienta está pagando ahora mismo');
  {
    /* El caso que solo ve `disponibles()`: stock.json dice que hay, pero las
       unidades están apartadas por un pago en curso. */
    const quedan = items[charm].stock;
    inventario._interno.usarAlmacen(almacenFalso({
      v: 1, vendido: {},
      reservas: { 'ZC-OTRA': { items: { [charm]: quedan }, vence: Date.now() + 60000 } },
    }));
    const { r, d } = await pedir({ charms: [charm] });
    comprobar(r.status === 409, 'se responde 409, no 400: el carrito está bien, cambió el mundo',
      String(r.status));
    comprobar(d.agotado === true, 'y marcado como agotado, para que el bot ofrezca otra cosa');
    comprobar(/se agotó|queda/i.test(d.error),
      'con las mismas palabras que usaría el checkout', d.error);
  }
  {
    /* Una reserva caducada no bloquea: esa clienta abandonó y las unidades
       volvieron al mostrador. */
    inventario._interno.usarAlmacen(almacenFalso({
      v: 1, vendido: {},
      reservas: { 'ZC-VIEJA': { items: { [charm]: items[charm].stock }, vence: Date.now() - 60000 } },
    }));
    const { r } = await pedir({ charms: [charm] });
    comprobar(r.status === 200, 'una reserva caducada no bloquea la venta');
  }
  {
    inventario._interno.usarAlmacen(almacenFalso({
      v: 1, vendido: {},
      reservas: { 'ZC-OTRA': { items: { [`${pulsera}|${talla}`]: 99 }, vence: Date.now() + 60000 } },
    }));
    const { r } = await pedir({ base: { id: pulsera, talla } });
    comprobar(r.status === 409, 'la talla apartada tampoco se ofrece');
  }

  console.log('\n4 · Sin poder leer lo apartado, se responde pero se avisa');
  {
    /* Falla hacia adelante: el precio sigue siendo bueno, la disponibilidad no
       se pudo confirmar. Lo que no puede pasar es que se calle. */
    inventario._interno.usarAlmacen(null);
    const { r, d } = await pedir({ charms: [charm] });
    comprobar(r.status === 200, 'la venta no se cae porque Blobs no responda');
    comprobar(d.disponibilidad === 'sin-lectura',
      'pero queda marcado que no se pudo comprobar', d.disponibilidad);
    comprobar(/[Cc]onfirmar/.test(d.aviso),
      'y el aviso le dice al bot que confirme antes de prometer');
  }
  inventario._interno.usarAlmacen(almacenFalso({ v: 1, vendido: {}, reservas: {} }));
  {
    const { d } = await pedir({ charms: [charm] });
    comprobar(d.disponibilidad === 'real', 'con almacén sano, el dato se marca como real');
  }

  console.log('\n5 · El enlace lleva al checkout, con todo puesto');
  {
    const { d } = await pedir({ base: { id: pulsera, talla },
      charms: [charm, charm], empaque: true, pago: 'contraentrega' });
    comprobar(/\/checkout\.html\?/.test(d.enlace),
      'apunta al checkout de siempre, no a una pasarela', d.enlace.replace(/^https?:\/\/[^/]*/, ''));

    const q = new URLSearchParams(d.enlace.split('?')[1]);
    const p = q.get('p');
    comprobar(p.includes(`${pulsera}@${talla}`), 'el brazalete va con @talla', p);
    comprobar(p.includes(`${charm}*2`), 'dos unidades se agrupan como *2');
    comprobar(q.get('e') === '1' && q.get('pago') === 'contraentrega',
      'el empaque y la forma de pago viajan');
    comprobar(q.get('via') === 'wa',
      'y queda de dónde vino, para poder medir el canal aparte');

    /* La misma comprobación que hace pruebas/reanudar.js § 3, y por el mismo
       motivo: el formato tiene que ser el que aceptan las dos páginas, leído de
       los propios HTML y no de una copia escrita aquí. */
    ['checkout.html', 'index.html'].forEach(archivo => {
      const html = fs.readFileSync(path.join(RAIZ, archivo), 'utf8');
      const m = html.match(/t\.match\(\/(\^\([a-z0-9\\[\]{}(),?:*@|+-]+\$)\/\)/);
      comprobar(!!m, `la expresión que valida el enlace sigue en ${archivo}`);
      if (!m) return;
      const re = new RegExp(m[1]);
      comprobar(p.split(',').every(t => re.test(t)),
        `y lo que genera el bot pasa la validación de ${archivo}`);
    });
  }
  {
    const { d } = await pedir({ charms: [charm] });
    comprobar(d.lineas.every(l => l.nombre && !/^[a-z0-9-]+$/.test(l.nombre)),
      'las líneas traen nombre legible: el bot no traduce identificadores');
    comprobar(/^\$/.test(d.lineas[0].precio),
      'y el precio de cada línea ya viene formateado', d.lineas[0].precio);
  }

  console.log('\n6 · La forma del módulo: esto no escribe nada');
  {
    const src = fs.readFileSync(path.join(RAIZ, 'netlify', 'functions', 'armar-carrito.mjs'), 'utf8');
    /* Sin comentarios: este archivo explica largo y tendido por qué NO guarda
       pedidos, así que buscar las palabras en el texto entero encontraría justo
       la explicación de que no lo hace. Lo que se comprueba es el código. */
    const codigo = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    /* La más importante de la batería. Un registro escrito desde aquí saldría
       mañana en el correo de checkouts abandonados como un pedido que nadie
       hizo — y `rescate.mjs` no tiene forma de distinguirlo. */
    comprobar(!/_pedidos|guardar\(|marcar\(/.test(codigo),
      'NO toca el registro de pedidos: un fantasma en esperando-pago envenenaría el rescate');
    comprobar(!/reservar\(/.test(codigo),
      'NO aparta inventario: el carrito de una conversación no congela unidades');
    /* `\b` delante de `firmar` a propósito: sin él, la palabra «confirmar» —que
       sale en el aviso que lee el bot— dispara la comprobación y la pone roja
       por un motivo que no tiene nada que ver con firmar cobros. */
    comprobar(!/wompi|\bfirmar|createHash|WOMPI_/i.test(codigo),
      'NO firma ni arma cobros: el camino del dinero sigue en un solo sitio');
    comprobar(/leerPedido|comprobarInventario|calcular/.test(codigo),
      'sí usa el mismo lector y el mismo cálculo que crear-pago');
  }
  {
    /* El escritor de la URL es uno solo para las dos funciones. Con dos copias,
       la comprobación de § 5 cubriría una y la otra podría separarse en silencio
       de lo que las páginas leen. */
    const a = fs.readFileSync(path.join(RAIZ, 'netlify', 'functions', 'armar-carrito.mjs'), 'utf8');
    const b = fs.readFileSync(path.join(RAIZ, 'netlify', 'functions', 'reanudar.mjs'), 'utf8');
    comprobar(/from '\.\/_carrito\.mjs'/.test(a) && /from '\.\/_carrito\.mjs'/.test(b),
      'las dos funciones escriben la URL con el mismo módulo, no con una copia cada una');
  }

  inventario._interno.usarAlmacen(null);
  console.log(fallos ? `\nArmar carrito: ${fallos} en rojo` : '\nArmar carrito en verde ✓');
}

main().catch(e => { console.log('  ✗ FALLA la batería reventó — ' + e.stack); });
