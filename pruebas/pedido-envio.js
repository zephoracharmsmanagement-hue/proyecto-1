'use strict';
/* Datos de envío de un pedido, para que n8n arme la orden de Skydropx
 * (docs/superpowers/specs/2026-11-14-avisos-whatsapp-pedidos-design.md § 7).
 *
 * Esta función entrega nombre, celular y dirección de una clienta. Lo que hay
 * que demostrar es, antes que nada, lo que NO hace:
 *   - sin la clave correcta no responde nada, ni lee el pedido;
 *   - no lista pedidos ni entrega más de uno por llamada;
 *   - no entrega lo que la guía no necesita: correo, documento, dedicatoria,
 *     datos del pago ni precios;
 *   - no entrega nada de un pedido que no esté en firme;
 *   - una contraentrega nunca sale marcada para comprarse sola.
 * Y después, que los números (valor declarado, tope, recaudo máximo) los pone
 * el repo y no n8n.
 */
const path = require('path');
const fs = require('fs');

const RAIZ = path.join(__dirname, '..');

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

/* Imita Netlify Blobs en lo que `_pedidos.mjs` usa. Cuenta las lecturas y
   revienta si alguien pide el listado: esta función no tiene por qué. */
function almacenFalso(inicial) {
  const datos = JSON.parse(JSON.stringify(inicial || {}));
  const uso = { lecturas: 0, escrituras: 0, listados: 0 };
  return {
    uso, datos,
    async get(clave) { uso.lecturas++; return datos[clave] ? JSON.parse(JSON.stringify(datos[clave])) : null; },
    async setJSON(clave, valor) { uso.escrituras++; datos[clave] = JSON.parse(JSON.stringify(valor)); return { modified: true }; },
    async delete(clave) { delete datos[clave]; },
    async list() { uso.listados++; throw new Error('pedido-envio no debe listar pedidos'); },
  };
}

const REF_PAGADO = 'ZC-261107-28AEB010';
const REF_CONTRA = 'ZC-261112-B19F5179';
const REF_OTRA = 'ZC-261113-0A1B2C3D';

const CLIENTA = {
  nombre: 'Valentina', apellido: 'Ríos', tipodoc: 'CC', documento: '1020304050',
  celular: '3018990672', correo: 'valentina.privada@ejemplo.test',
  depto: 'Antioquia', ciudad: 'Medellín', direccion: 'Calle 45 # 12 – 30',
  adicional: 'Torre 2, apto. 501', barrio: 'Laureles',
  notas: 'Dejar en portería', dedicatoria: 'Para Ana, con todo mi cariño secreto', optin: true,
};

const LINEAS = [
  { id: 'pulsera-avengers', nombre: 'Brazalete Avengers', talla: '18', unidades: 1, precio: 110000, gratis: 0 },
  { id: 'iron-man', nombre: 'Iron Man', talla: null, unidades: 2, precio: 190000, gratis: 1 },
];

const pedidoPagado = () => ({
  referencia: REF_PAGADO, creado: '2026-11-07T15:00:00.000Z', estado: 'pagado', pago: 'anticipado',
  lineas: LINEAS, cuentas: { subtotal: 240000, envio: 0, total: 240000, centavos: 24000000 },
  cliente: Object.assign({}, CLIENTA), canal: 'web', regalo: null,
  transaccion: 'TX-WOMPI-SECRETA-991', metodo: 'NEQUI', cobrado: 240000, pagadoEn: '2026-11-07T15:02:00.000Z',
});
const pedidoContra = () => ({
  referencia: REF_CONTRA, creado: '2026-11-12T15:00:00.000Z', estado: 'confirmado', pago: 'contraentrega',
  lineas: [LINEAS[1]], cuentas: { subtotal: 41000, envio: 20000, total: 61000, centavos: 6100000 },
  cliente: Object.assign({}, CLIENTA, { depto: 'Bogotá D.C.', ciudad: 'Bogotá D.C.' }), canal: 'web',
});

async function main() {
  const CLAVE = 'clave-de-prueba-de-pedido-envio-con-40-ch';
  process.env.PEDIDO_ENVIO_KEY = CLAVE;
  const mod = await import('../netlify/functions/pedido-envio.mjs');
  const pedidos = await import('../netlify/functions/_pedidos.mjs');
  const { codigoDane } = require('../netlify/functions/_dane.js');

  /* Todo lo que la función escribe en el log durante la batería queda aquí:
     al final se revisa que no haya ni un dato de la clienta. */
  const bitacora = [];
  const pedir = async (cuerpo, { metodo = 'POST', clave = CLAVE, crudo } = {}) => {
    const headers = new Headers();
    if (clave !== null) headers.set('x-zephora-automation-key', clave);
    const originales = { log: console.log, warn: console.warn, error: console.error };
    ['log', 'warn', 'error'].forEach(k => { console[k] = (...a) => bitacora.push(a.map(String).join(' ')); });
    let r;
    try {
      r = await mod.default({ method: metodo, headers,
        text: async () => (crudo !== undefined ? crudo : JSON.stringify(cuerpo)) });
    } finally {
      Object.assign(console, originales);
    }
    const texto = await r.text();
    return { r, d: texto ? JSON.parse(texto) : null, texto };
  };
  const con = (inicial) => { const a = almacenFalso(inicial); pedidos._interno.usarAlmacen(a); return a; };

  console.log('\n1 · Sin la clave correcta no responde nada, y ni siquiera lee el pedido');
  {
    const a = con({ [REF_PAGADO]: pedidoPagado() });

    const { r: get } = await pedir({ referencia: REF_PAGADO }, { metodo: 'GET' });
    comprobar(get.status === 405, 'GET no está permitido: la referencia no viaja en la dirección', String(get.status));

    const { r: sin, texto: tSin } = await pedir({ referencia: REF_PAGADO }, { clave: null });
    comprobar(sin.status === 401, 'sin clave, 401', String(sin.status));
    comprobar(!tSin.includes('3018990672') && !tSin.includes('Calle 45'), 'y la respuesta no trae ningún dato de la clienta');

    const { r: otra } = await pedir({ referencia: REF_PAGADO }, { clave: 'otra-clave-cualquiera' });
    comprobar(otra.status === 401, 'con otra clave, 401', String(otra.status));

    const mismoLargo = CLAVE.slice(0, -1) + (CLAVE.slice(-1) === 'x' ? 'y' : 'x');
    const { r: casi } = await pedir({ referencia: REF_PAGADO }, { clave: mismoLargo });
    comprobar(mismoLargo.length === CLAVE.length && casi.status === 401,
      'con una clave del mismo largo y un carácter distinto, 401', String(casi.status));

    const { r: prefijo } = await pedir({ referencia: REF_PAGADO }, { clave: CLAVE + 'x' });
    comprobar(prefijo.status === 401, 'con la clave correcta y un carácter de más, 401', String(prefijo.status));

    comprobar(a.uso.lecturas === 0, 'en ninguno de esos intentos se leyó el pedido', String(a.uso.lecturas));

    const { r: basura } = await pedir(null, { clave: null, crudo: '{ esto no es json' });
    comprobar(basura.status === 401, 'sin clave no se llega ni a mirar el cuerpo: JSON roto también da 401', String(basura.status));

    /* Una clave corta o ausente en Netlify no puede dejar la puerta abierta. */
    process.env.PEDIDO_ENVIO_KEY = '';
    const { r: sinVar } = await pedir({ referencia: REF_PAGADO }, { clave: '' });
    comprobar(sinVar.status === 401, 'sin PEDIDO_ENVIO_KEY en el servidor, 401 aunque la clave llegue vacía', String(sinVar.status));
    process.env.PEDIDO_ENVIO_KEY = 'corta';
    const { r: corta } = await pedir({ referencia: REF_PAGADO }, { clave: 'corta' });
    comprobar(corta.status === 401, 'con una PEDIDO_ENVIO_KEY de menos de 32 caracteres, 401 aunque coincida', String(corta.status));
    process.env.PEDIDO_ENVIO_KEY = CLAVE;
    comprobar(a.uso.lecturas === 0, 'y tampoco ahí se leyó nada', String(a.uso.lecturas));
  }

  console.log('\n2 · Un pedido por llamada, por su referencia exacta; nunca un listado');
  {
    const a = con({ [REF_PAGADO]: pedidoPagado(), [REF_CONTRA]: pedidoContra() });

    const { r: vacio } = await pedir({});
    comprobar(vacio.status === 400, 'sin referencia, 400', String(vacio.status));
    const { r: lista } = await pedir({ referencia: [REF_PAGADO, REF_CONTRA] });
    comprobar(lista.status === 400, 'una lista de referencias, 400', String(lista.status));
    const { r: comodin } = await pedir({ referencia: 'ZC-*' });
    comprobar(comodin.status === 400, 'un comodín, 400', String(comodin.status));
    const { r: ajuste } = await pedir({ referencia: 'AJ-261101-LLEGADA-01' });
    comprobar(ajuste.status === 400, 'una clave que no es de pedido (un ajuste de inventario), 400', String(ajuste.status));
    const { r: roto } = await pedir(null, { crudo: '{ esto no es json' });
    comprobar(roto.status === 400, 'cuerpo que no es JSON, 400', String(roto.status));
    const { r: enorme } = await pedir(null, { crudo: JSON.stringify({ referencia: REF_PAGADO, relleno: 'x'.repeat(5000) }) });
    comprobar(enorme.status === 400 || enorme.status === 413, 'un cuerpo desmedido se rechaza', String(enorme.status));
    comprobar(a.uso.lecturas === 0, 'nada de lo anterior llegó a leer un pedido', String(a.uso.lecturas));

    const { r: noExiste, texto: tNo } = await pedir({ referencia: REF_OTRA });
    comprobar(noExiste.status === 404, 'referencia bien formada que no existe, 404', String(noExiste.status));
    comprobar(!tNo.includes('3018990672'), 'y no se cuela ningún dato de otro pedido');

    const { r: bien, d } = await pedir({ referencia: REF_PAGADO });
    comprobar(bien.status === 200 && d.referencia === REF_PAGADO, 'la referencia exacta entrega ese pedido', String(bien.status));
    comprobar(a.uso.listados === 0, 'en ningún momento se pidió el listado de pedidos', String(a.uso.listados));
    comprobar(bien.headers.get('cache-control') === 'no-store', 'la respuesta no se guarda en caché');
  }

  console.log('\n3 · Pedido pagado: lo que la guía necesita, y nada más');
  {
    con({ [REF_PAGADO]: pedidoPagado() });
    const { d, texto } = await pedir({ referencia: REF_PAGADO });

    comprobar(d.tipo === 'pagado', 'dice que es un pedido pagado', d.tipo);
    comprobar(d.destinatario.nombre === 'Valentina Ríos' && d.destinatario.celular === '3018990672',
      'trae nombre completo y celular', JSON.stringify(d.destinatario));
    comprobar(d.destino.direccion === CLIENTA.direccion && d.destino.detalles === CLIENTA.adicional
      && d.destino.barrio === 'Laureles' && d.destino.ciudad === 'Medellín' && d.destino.departamento === 'Antioquia',
      'trae la dirección tal como la escribió la clienta');
    comprobar(d.destino.codigo_dane === '05001', 'y el código DANE del municipio (Medellín, 05001)', String(d.destino.codigo_dane));
    comprobar(d.destino.indicaciones === 'Dejar en portería' && d.destino.indicaciones_cortas === 'Dejar en portería'
      && d.destino.indicaciones_recortadas === false, 'las indicaciones cortas van enteras');
    comprobar(JSON.stringify(d.piezas) === JSON.stringify([
      { nombre: 'Brazalete Avengers', cantidad: 1 }, { nombre: 'Iron Man', cantidad: 2 }]),
      'las piezas van con nombre y cantidad', JSON.stringify(d.piezas));
    comprobar(d.paquete.largo_cm === 19 && d.paquete.ancho_cm === 19 && d.paquete.alto_cm === 5
      && d.paquete.peso_kg === 1 && d.paquete.contenido === 'brazalete', 'el paquete habitual: 19 × 19 × 5 cm, 1 kg, «brazalete»');

    comprobar(d.reglas.declarado === 46000, 'valor declarado de un pedido pagado: $46.000', String(d.reglas.declarado));
    comprobar(d.reglas.recaudo === false && d.reglas.recaudo_maximo === null, 'sin recaudo');
    comprobar(d.reglas.proteccion === false, 'sin Protección Plus');
    comprobar(d.reglas.transportadora === 'Inter Rapidísimo', 'transportadora habitual: Inter Rapidísimo', d.reglas.transportadora);
    comprobar(d.reglas.tope_guia === 25000 && d.reglas.cambiar_si_ahorra === 5000,
      'tope de $25.000 por guía y cambio de transportadora desde $5.000 de ahorro');
    comprobar(d.compra_automatica.permitida === true && d.compra_automatica.motivos.length === 0,
      'un pedido pagado con dirección completa sí puede comprarse solo', JSON.stringify(d.compra_automatica));
    comprobar(d.skydropx.orden_id === null && d.skydropx.guia_id === null, 'todavía sin orden ni guía de Skydropx');

    const prohibidos = {
      'el correo': CLIENTA.correo, 'el documento': CLIENTA.documento, 'la dedicatoria': 'cariño secreto',
      'la transacción de la pasarela': 'TX-WOMPI-SECRETA-991', 'el medio de pago': 'NEQUI',
      'lo cobrado': '240000', 'el precio de una pieza': '110000', 'la fecha de pago': '2026-11-07T15:02',
    };
    Object.entries(prohibidos).forEach(([que, valor]) =>
      comprobar(!texto.includes(valor), `no entrega ${que}`));
    comprobar(!/optin|canal|regalo|cuentas|envios|posventa|rescate/.test(texto),
      'ni el permiso de publicidad, el canal, las cuentas ni el historial del pedido');
  }

  console.log('\n4 · Contraentrega: recaudo, protección, y nunca sola');
  {
    con({ [REF_CONTRA]: pedidoContra() });
    const { r, d } = await pedir({ referencia: REF_CONTRA });
    comprobar(r.status === 200 && d.tipo === 'contraentrega', 'dice que es contraentrega', d && d.tipo);
    comprobar(d.reglas.recaudo === true && d.reglas.recaudo_maximo === 61000,
      'recaudo máximo = el total que la clienta vio en el checkout ($61.000)', String(d.reglas.recaudo_maximo));
    comprobar(d.reglas.declarado === null, 'el valor declarado no lo fija la tienda: depende del flete que cotice n8n', String(d.reglas.declarado));
    comprobar(d.reglas.proteccion === true, 'con Protección Plus, pedida de forma explícita');
    comprobar(d.reglas.transportadora === 'Coordinadora', 'transportadora habitual: Coordinadora', d.reglas.transportadora);
    comprobar(d.destino.codigo_dane === '11001', 'Bogotá D.C. → 11001', String(d.destino.codigo_dane));
    comprobar(d.compra_automatica.permitida === false && d.compra_automatica.motivos.includes('contraentrega'),
      'una contraentrega nunca sale para comprarse sola: la guía se hace a mano', JSON.stringify(d.compra_automatica));
  }

  console.log('\n5 · Cuándo un pedido pagado tampoco se compra solo');
  {
    const otroMunicipio = pedidoPagado();
    otroMunicipio.cliente.ciudad = 'Vereda El Manzano';
    con({ [REF_PAGADO]: otroMunicipio });
    const { d: d1 } = await pedir({ referencia: REF_PAGADO });
    comprobar(d1.destino.codigo_dane === null && d1.destino.ciudad === 'Vereda El Manzano',
      '«Otro municipio» escrito a mano: sin código DANE, y la ciudad va como la escribió');
    comprobar(d1.compra_automatica.permitida === false && d1.compra_automatica.motivos.includes('sin-codigo-dane'),
      'y no se compra sola', JSON.stringify(d1.compra_automatica));

    const largas = pedidoPagado();
    largas.cliente.notas = 'Portería del conjunto, preguntar por doña Marta; si no está, dejar con el vigilante del turno de la tarde, torre 2';
    con({ [REF_PAGADO]: largas });
    const { d: d2 } = await pedir({ referencia: REF_PAGADO });
    comprobar(d2.destino.indicaciones === largas.cliente.notas, 'las indicaciones largas van completas');
    comprobar(d2.destino.indicaciones_cortas.length <= 70 && largas.cliente.notas.startsWith(d2.destino.indicaciones_cortas.replace(/…$/, '')),
      'con una versión de 70 caracteres para la guía', String(d2.destino.indicaciones_cortas.length));
    comprobar(d2.destino.indicaciones_recortadas === true
      && d2.compra_automatica.permitida === false && d2.compra_automatica.motivos.includes('indicaciones-recortadas'),
      'y, como se recortaron, no se compra sola', JSON.stringify(d2.compra_automatica));

    const conGuia = pedidoPagado();
    conGuia.skydropx = { orden_id: 'ord-1', guia_id: 'guia-1' };
    con({ [REF_PAGADO]: conGuia });
    const { d: d3 } = await pedir({ referencia: REF_PAGADO });
    comprobar(d3.skydropx.guia_id === 'guia-1' && d3.compra_automatica.permitida === false
      && d3.compra_automatica.motivos.includes('ya-tiene-guia'),
      'un pedido que ya tiene guía no se vuelve a comprar', JSON.stringify(d3.compra_automatica));
  }

  console.log('\n6 · Solo pedidos en firme');
  {
    const casos = [
      ['esperando pago', Object.assign(pedidoPagado(), { estado: 'esperando-pago' }), 'pendiente-de-pago'],
      ['pago rechazado', Object.assign(pedidoPagado(), { estado: 'pago-declined' }), 'no-en-firme'],
      ['cancelado', Object.assign(pedidoContra(), { referencia: REF_PAGADO, estado: 'cancelado' }), 'no-en-firme'],
      ['anulado', Object.assign(pedidoContra(), { referencia: REF_PAGADO, estado: 'anulada' }), 'no-en-firme'],
      ['de prueba', Object.assign(pedidoContra(), { referencia: REF_PAGADO, estado: 'prueba-cancelada' }), 'no-en-firme'],
      ['que no llegó a la pasarela', Object.assign(pedidoPagado(), { estado: 'no-llego-a-la-pasarela' }), 'no-en-firme'],
      ['«confirmado» pero de pago en línea, sin cobro', Object.assign(pedidoPagado(), { estado: 'confirmado' }), 'no-en-firme'],
      ['«pagado» pero contraentrega', Object.assign(pedidoContra(), { referencia: REF_PAGADO, estado: 'pagado' }), 'no-en-firme'],
    ];
    for (const [nombre, pedido, motivo] of casos) {
      con({ [REF_PAGADO]: pedido });
      const { r, d, texto } = await pedir({ referencia: REF_PAGADO });
      comprobar(r.status === 409 && d.motivo === motivo && !texto.includes('3018990672') && !texto.includes('Calle 45'),
        `un pedido ${nombre} no entrega nada (409, ${motivo})`, r.status + ' ' + (d && d.motivo));
    }

    const MANUAL = 'MAN-261110-AABBCCDD';
    con({ [MANUAL]: { referencia: MANUAL, estado: 'venta-manual', pago: 'nequi', total: 95000,
      lineas: [LINEAS[1]], cliente: { nombre: 'Laura', celular: '3001112233', correo: '' } } });
    const { r: rm, d: dm, texto: tm } = await pedir({ referencia: MANUAL });
    comprobar(rm.status === 409 && dm.motivo === 'venta-manual' && !tm.includes('3001112233'),
      'una venta manual lo dice: no tiene dirección y no entrega nada', rm.status + ' ' + (dm && dm.motivo));

    const sinDir = pedidoPagado(); delete sinDir.cliente.direccion;
    con({ [REF_PAGADO]: sinDir });
    const { r: rs, d: ds } = await pedir({ referencia: REF_PAGADO });
    comprobar(rs.status === 409 && ds.motivo === 'sin-direccion', 'un pedido en firme sin dirección guardada, 409', rs.status + ' ' + (ds && ds.motivo));
  }

  console.log('\n7 · Anotar la orden y la guía de Skydropx');
  {
    const a = con({ [REF_PAGADO]: pedidoPagado() });

    const { r: r1, d: d1, texto: t1 } = await pedir({ referencia: REF_PAGADO, anotar: { orden_id: 'ord-8f3a' } });
    comprobar(r1.status === 200 && d1.ok === true && d1.skydropx.orden_id === 'ord-8f3a', 'anota la orden', String(r1.status));
    comprobar(!t1.includes('3018990672') && !t1.includes('Calle 45'), 'y al anotar no devuelve datos de la clienta');

    const { r: r2, d: d2 } = await pedir({ referencia: REF_PAGADO, anotar: { guia_id: 'guia-771', transportadora: 'Inter Rapidísimo' } });
    comprobar(r2.status === 200 && d2.skydropx.guia_id === 'guia-771' && d2.skydropx.orden_id === 'ord-8f3a',
      'anota la guía sin perder la orden', JSON.stringify(d2 && d2.skydropx));

    const g = a.datos[REF_PAGADO];
    comprobar(g.estado === 'pagado' && g.cliente.celular === '3018990672' && g.lineas.length === 2 && g.transaccion === 'TX-WOMPI-SECRETA-991',
      'el pedido conserva su estado, su clienta, sus piezas y su pago');
    comprobar(g.skydropx.orden_id === 'ord-8f3a' && g.skydropx.guia_id === 'guia-771' && g.skydropx.transportadora === 'Inter Rapidísimo'
      && typeof g.skydropx.ordenEn === 'string' && typeof g.skydropx.guiaEn === 'string',
      'y queda con la orden, la guía, la transportadora y sus fechas', JSON.stringify(g.skydropx));

    /* n8n manda en null lo que todavía no tiene (la guía, al crear la orden).
       Un null es «no viene»: no borra nada ni es un error. */
    const { r: rn, d: dn } = await pedir({ referencia: REF_PAGADO,
      anotar: { orden_id: 'ord-8f3a', guia_id: null, transportadora: null } });
    comprobar(rn.status === 200 && dn.skydropx.guia_id === 'guia-771'
      && a.datos[REF_PAGADO].skydropx.guia_id === 'guia-771' && a.datos[REF_PAGADO].skydropx.transportadora === 'Inter Rapidísimo',
      'un campo en null se toma como «no viene»: ni falla ni borra la guía ya anotada', rn.status + ' ' + JSON.stringify(dn && dn.skydropx));
    const { r: rnn } = await pedir({ referencia: REF_PAGADO, anotar: { orden_id: null, guia_id: null } });
    comprobar(rnn.status === 400, 'pero si todo viene en null no hay nada que anotar: 400', String(rnn.status));

    const { r: r3 } = await pedir({ referencia: REF_PAGADO, anotar: { guia_id: 'guia-771' } });
    comprobar(r3.status === 200, 'repetir la misma guía no es un error', String(r3.status));
    const { r: r4, d: d4 } = await pedir({ referencia: REF_PAGADO, anotar: { guia_id: 'guia-OTRA' } });
    comprobar(r4.status === 409 && d4.motivo === 'ya-tiene-guia' && a.datos[REF_PAGADO].skydropx.guia_id === 'guia-771',
      'una segunda guía distinta se rechaza y no pisa la primera', r4.status + ' ' + (d4 && d4.motivo));

    const escriturasAntes = a.uso.escrituras;
    const { r: r5 } = await pedir({ referencia: REF_PAGADO, anotar: {} });
    const { r: r6 } = await pedir({ referencia: REF_PAGADO, anotar: { guia_id: '<script>alert(1)</script>' } });
    const { r: r7 } = await pedir({ referencia: REF_PAGADO, anotar: { orden_id: 'x'.repeat(200) } });
    const { r: r8 } = await pedir({ referencia: REF_PAGADO, anotar: { estado: 'pagado', cliente: { celular: '3000000000' } } });
    /* Un id válido no le abre la puerta a otros campos: se rechaza todo. */
    const { r: r8b } = await pedir({ referencia: REF_PAGADO,
      anotar: { orden_id: 'ord-2', estado: 'cancelado', cliente: { celular: '3000000000' } } });
    comprobar([r5, r6, r7, r8, r8b].every(r => r.status === 400) && a.uso.escrituras === escriturasAntes,
      'anotar sin ids, con ids raros o con otros campos se rechaza y no escribe nada', [r5, r6, r7, r8, r8b].map(r => r.status).join(','));
    comprobar(a.datos[REF_PAGADO].estado === 'pagado' && a.datos[REF_PAGADO].cliente.celular === '3018990672'
      && a.datos[REF_PAGADO].skydropx.orden_id === 'ord-8f3a', 'y el pedido sigue exactamente como estaba');

    const { r: r9 } = await pedir({ referencia: REF_OTRA, anotar: { orden_id: 'ord-1' } });
    comprobar(r9.status === 404 && !a.datos[REF_OTRA], 'anotar sobre un pedido que no existe da 404 y no crea ninguno', String(r9.status));

    con({ [REF_PAGADO]: Object.assign(pedidoPagado(), { estado: 'esperando-pago' }) });
    const { r: r10 } = await pedir({ referencia: REF_PAGADO, anotar: { orden_id: 'ord-1' } });
    comprobar(r10.status === 409, 'tampoco se anota sobre un pedido que no está en firme', String(r10.status));
  }

  console.log('\n8 · La tabla de códigos DANE cubre las ciudades del checkout');
  {
    const geo = JSON.parse(fs.readFileSync(path.join(RAIZ, 'assets', 'colombia.json'), 'utf8')).departamentos;
    const tabla = JSON.parse(fs.readFileSync(path.join(RAIZ, 'assets', 'codigos-dane.json'), 'utf8')).departamentos;
    const faltan = [], malos = [], vistos = {}, repetidos = [], prefijos = {};
    Object.entries(geo).forEach(([depto, ciudades]) => ciudades.forEach(ciudad => {
      const c = codigoDane(depto, ciudad);
      if (!c) { faltan.push(depto + ' → ' + ciudad); return; }
      if (!/^\d{5}$/.test(c)) malos.push(ciudad + ' ' + c);
      if (vistos[c]) repetidos.push(c + ' ' + vistos[c] + ' / ' + ciudad); else vistos[c] = ciudad;
      (prefijos[depto] = prefijos[depto] || new Set()).add(c.slice(0, 2));
    }));
    const total = Object.values(geo).reduce((n, l) => n + l.length, 0);
    comprobar(faltan.length === 0, `las ${total} ciudades que ofrece el checkout tienen código`, faltan.slice(0, 5).join(', '));
    comprobar(malos.length === 0, 'todos los códigos son de 5 dígitos', malos.slice(0, 5).join(', '));
    comprobar(repetidos.length === 0, 'ningún código se repite entre dos ciudades', repetidos.slice(0, 5).join(', '));
    comprobar(Object.values(prefijos).every(s => s.size === 1) && new Set(Object.values(prefijos).map(s => [...s][0])).size === Object.keys(prefijos).length,
      'todas las ciudades de un departamento comparten prefijo, y cada departamento tiene el suyo');
    const sobran = Object.entries(tabla).flatMap(([d, cs]) => Object.keys(cs).filter(c => !(geo[d] || []).includes(c)).map(c => d + ' → ' + c));
    comprobar(sobran.length === 0, 'y la tabla no trae ciudades que el checkout no ofrezca', sobran.slice(0, 5).join(', '));

    const conocidos = [['Bogotá D.C.', 'Bogotá D.C.', '11001'], ['Antioquia', 'Medellín', '05001'], ['Valle del Cauca', 'Cali', '76001'],
      ['Atlántico', 'Barranquilla', '08001'], ['Bolívar', 'Cartagena', '13001'], ['Santander', 'Bucaramanga', '68001'],
      ['Norte de Santander', 'Cúcuta', '54001'], ['Amazonas', 'Leticia', '91001'], ['San Andrés y Providencia', 'San Andrés', '88001']];
    conocidos.forEach(([d, c, cod]) => comprobar(codigoDane(d, c) === cod, `${c} → ${cod}`, String(codigoDane(d, c))));

    comprobar(codigoDane('Antioquia', 'Vereda El Manzano') === null, 'un municipio escrito a mano no tiene código');
    comprobar(codigoDane('Valle del Cauca', 'Medellín') === null, 'una ciudad con el departamento equivocado tampoco');
    comprobar(codigoDane('__proto__', 'constructor') === null && codigoDane('Antioquia', 'constructor') === null && codigoDane(undefined, undefined) === null,
      'ni un nombre raro ni un dato ausente devuelven nada');
  }

  console.log('\n9 · Forma del código y configuración');
  {
    const codigo = fs.readFileSync(path.join(RAIZ, 'netlify', 'functions', 'pedido-envio.mjs'), 'utf8');
    comprobar(/timingSafeEqual/.test(codigo), 'compara la clave en tiempo constante');
    comprobar(/PEDIDO_ENVIO_KEY/.test(codigo) && !/ENVIO_ESTADO_KEY|SUSCRIPTORES_KEY|VENTA_MANUAL_KEY/.test(codigo),
      'usa su propia clave, PEDIDO_ENVIO_KEY, y no comparte la de otra función');
    comprobar(/from '\.\/_pedidos\.mjs'/.test(codigo) && !/\blistar\b/.test(codigo),
      'lee y marca con _pedidos.mjs, y no importa `listar`');
    const todo = bitacora.join('\n');
    const personales = ['3018990672', '3001112233', 'Valentina', 'Ríos', 'Calle 45', 'Laureles', 'Torre 2', 'portería',
      'Portería', 'valentina.privada', '1020304050', 'cariño secreto', CLAVE];
    comprobar(bitacora.length > 20 && bitacora.some(l => l.includes('"evento":"pedido_envio"') && l.includes(REF_PAGADO)),
      'cada llamada deja en el log la referencia y el resultado', String(bitacora.length) + ' líneas');
    comprobar(personales.every(p => !todo.includes(p)),
      'y en todo lo que escribió en el log no hay ni un dato de la clienta ni la clave',
      personales.filter(p => todo.includes(p)).join(', '));
    const ejemplo = fs.readFileSync(path.join(RAIZ, '.env.example'), 'utf8');
    comprobar(/^PEDIDO_ENVIO_KEY=\s*$/m.test(ejemplo), '.env.example nombra PEDIDO_ENVIO_KEY, sin valor');
    const correr = fs.readFileSync(path.join(RAIZ, 'pruebas', 'correr.sh'), 'utf8');
    comprobar(/\bpedido-envio\b/.test(correr), 'correr.sh corre esta batería');
  }

  pedidos._interno.usarAlmacen(null);
  console.log(fallos ? `\nPedido-envío: ${fallos} en rojo` : '\nPedido-envío en verde ✓');
}

main().catch(e => { console.log('  ✗ FALLA la batería reventó — ' + e.stack); });
