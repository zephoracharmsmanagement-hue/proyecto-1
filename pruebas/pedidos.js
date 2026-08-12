'use strict';
/* Registro de pedidos.
 *
 * Existe por un caso concreto: en la primera venta real el detalle de qué se
 * pidió vivía solo en un correo, y hubo que reconstruir el pedido desde el
 * total para saber qué despachar. Lo que esta batería vigila es que ese
 * registro guarde de verdad lo que hace falta para alistar —piezas, talla,
 * dirección— y que el aviso de Wompi lo complete en vez de pisarlo.
 *
 * Y que nada de esto pueda tumbar una venta: si el almacén no está o falla, el
 * pedido sigue su curso. Perder el registro es molesto; perder una compra
 * cobrada, no.
 */
const path = require('path');
const { pathToFileURL } = require('url');
const RAIZ = path.join(__dirname, '..');
const cargar = f => import(pathToFileURL(path.join(RAIZ, 'netlify', 'functions', f)).href);
let pedidos;

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

/* Almacén en memoria con una clave por pedido, como el real. */
function almacenFalso() {
  const datos = new Map();
  return {
    async setJSON(clave, valor) { datos.set(clave, JSON.parse(JSON.stringify(valor))); },
    async get(clave) { return datos.has(clave) ? JSON.parse(JSON.stringify(datos.get(clave))) : null; },
    _claves: () => [...datos.keys()],
  };
}

const PEDIDO = {
  estado: 'esperando-pago',
  pago: 'anticipado',
  lineas: [
    { id: 'pulsera-avengers', nombre: 'Brazalete Avengers', talla: '20', unidades: 1, precio: 58000 },
    { id: 'mickey-mouse', nombre: 'Mickey Mouse', talla: null, unidades: 2, precio: 170000 },
  ],
  cuentas: { total: 241600, envio: 0, envioGratis: true, descuento: 30000 },
  cliente: {
    nombre: 'María', apellido: 'Gómez', celular: '3012345678',
    correo: 'maria@ejemplo.com', ciudad: 'Bogotá D.C.', depto: 'Bogotá D.C.',
    direccion: 'Calle 45 # 12 - 30', barrio: 'Chapinero', notas: 'Portería',
  },
};

async function main() {
  pedidos = await cargar('_pedidos.mjs');

  console.log('1 · Lo que hace falta para alistar');

  {
    const almacen = almacenFalso();
    pedidos._interno.usarAlmacen(almacen);

    const r = await pedidos.guardar('ZC-260812-ABCD', PEDIDO);
    comprobar(r.ok === true, 'el pedido se guarda al crearlo');

    const leido = await pedidos.leer('ZC-260812-ABCD');
    comprobar(leido && leido.referencia === 'ZC-260812-ABCD',
      'se recupera por su referencia, que es como llega desde Wompi');
    comprobar(leido.lineas.length === 2 && leido.lineas[0].talla === '20',
      'con las piezas y la talla: es lo que hay que empacar');
    comprobar(leido.cliente.direccion === 'Calle 45 # 12 - 30' && leido.cliente.barrio === 'Chapinero',
      'y la dirección completa: es lo que hay que despachar');
    comprobar(typeof leido.creado === 'string', 'queda fechado');
    /* Nada del pago: la tarjeta nunca pasa por el sitio y no puede acabar aquí. */
    const crudo = JSON.stringify(leido);
    comprobar(!/tarjeta|card|cvv|numero_tarjeta/i.test(crudo),
      'no guarda nada del medio de pago — el sitio nunca lo ve');
  }

  console.log('\n2 · El aviso de Wompi completa, no pisa');

  {
    const almacen = almacenFalso();
    pedidos._interno.usarAlmacen(almacen);
    await pedidos.guardar('ZC-1', PEDIDO);

    await pedidos.marcar('ZC-1', { estado: 'pagado', transaccion: '01-1234', cobrado: 241600 });
    const leido = await pedidos.leer('ZC-1');

    comprobar(leido.estado === 'pagado', 'el estado pasa a pagado');
    comprobar(leido.transaccion === '01-1234', 'y queda la transacción de Wompi para conciliar');
    comprobar(leido.lineas && leido.lineas.length === 2,
      'sin perder las piezas — el evento de Wompi no las trae');
    comprobar(leido.cliente && leido.cliente.direccion === 'Calle 45 # 12 - 30',
      'ni la dirección');
    comprobar(typeof leido.actualizado === 'string', 'y se anota cuándo cambió');
  }

  {
    const almacen = almacenFalso();
    pedidos._interno.usarAlmacen(almacen);
    await pedidos.guardar('ZC-2', PEDIDO);
    await pedidos.marcar('ZC-2', { estado: 'pago-declined' });
    const leido = await pedidos.leer('ZC-2');
    comprobar(leido.estado === 'pago-declined',
      'un pago rechazado también queda anotado, no se borra el pedido');
  }

  {
    /* Si el almacén estaba caído al crear el pedido, el aviso de pago no puede
       quedarse sin registrar: mejor un registro parcial que ninguno. */
    const almacen = almacenFalso();
    pedidos._interno.usarAlmacen(almacen);
    const r = await pedidos.marcar('ZC-HUERFANO', { estado: 'pagado', cobrado: 99000 });
    comprobar(r.ok === true && r.habia === false,
      'un pago sin pedido previo se guarda igual, marcado como tal');
    const leido = await pedidos.leer('ZC-HUERFANO');
    comprobar(leido && leido.cobrado === 99000, 'y se puede consultar');
  }

  console.log('\n3 · Falla hacia adelante');

  {
    pedidos._interno.usarAlmacen(null);
    const r = await pedidos.guardar('ZC-SIN', PEDIDO);
    comprobar(r.ok === false && r.motivo === 'sin almacén',
      'sin Blobs configurado no se guarda nada y no se lanza', r.motivo);
  }

  {
    const roto = {
      async setJSON() { throw new Error('almacén caído'); },
      async get() { throw new Error('almacén caído'); },
    };
    pedidos._interno.usarAlmacen(roto);
    const g = await pedidos.guardar('ZC-ROTO', PEDIDO);
    comprobar(g.ok === false && /caído/.test(g.motivo),
      'si el almacén falla al guardar, la venta no se cae por eso');
    const m = await pedidos.marcar('ZC-ROTO', { estado: 'pagado' });
    comprobar(m.ok === false, 'ni al actualizar');
    const l = await pedidos.leer('ZC-ROTO');
    comprobar(l === null, 'y leer devuelve null en vez de reventar');
  }

  {
    const almacen = almacenFalso();
    pedidos._interno.usarAlmacen(almacen);
    const r = await pedidos.guardar('', PEDIDO);
    comprobar(r.ok === false, 'sin referencia no se guarda: no habría cómo encontrarlo');
  }

  console.log('\n4 · Los pedidos de prueba no se mezclan con los reales');

  {
    /* En producción la tienda es `pedidos`; en cualquier otro contexto, otra.
       Sin esto, un deploy preview escribiría pedidos falsos entre los buenos.
       Se comprueba sobre el código porque el nombre se fija al cargar el
       módulo y no se puede cambiar después. */
    const fuente = require('fs').readFileSync(
      path.join(RAIZ, 'netlify', 'functions', '_pedidos.mjs'), 'utf8');
    const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    comprobar(/CONTEXT === 'production'/.test(codigo),
      'el almacén de pedidos depende del contexto del despliegue');
    const inv = require('fs').readFileSync(
      path.join(RAIZ, 'netlify', 'functions', '_inventario.mjs'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    comprobar(/CONTEXT === 'production'/.test(inv),
      'y el de inventario también: un pedido de prueba no puede descontar existencias reales');
  }

  pedidos._interno.usarAlmacen(null);
  console.log(fallos ? `\nRegistro de pedidos: ${fallos} en rojo` : '\nRegistro de pedidos en verde ✓');
}

main().catch(e => { console.log('  ✗ FALLA excepción no capturada — ' + e.stack); process.exit(1); });
