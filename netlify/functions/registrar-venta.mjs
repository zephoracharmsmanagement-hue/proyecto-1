/* Registra una venta cerrada FUERA del checkout —WhatsApp, pagada por
 * transferencia, Nequi o efectivo— para que descuente inventario igual que una
 * venta web. Encargo: automatizaciones/ventas-manuales/BRIEF.md.
 *
 * ── Por qué existe ──
 *
 * Sin esto, el sitio seguía ofreciendo unidades ya vendidas por chat. Los
 * arreglos de antes eran peores que el problema: bajar stock.json y desplegar
 * (~15 créditos por venta), o hacer un pedido contraentrega a nombre de la
 * clienta, que suma un envío que nadie cobró y manda el Purchase a Meta con
 * las cookies y la IP del celular del propietario.
 *
 * ── Qué hace ──
 *
 * Valida con leerPedido(), aparta y confirma en el mismo CAS del checkout
 * (_inventario.mjs), guarda el registro (_pedidos.mjs), avisa a la hoja
 * (_hoja.mjs) y manda el Purchase a Meta como venta de chat, sin señales de
 * navegador. No cobra, no crea guía, no escribe a la clienta, no toca
 * stock.json.
 *
 * ── Dos diferencias a propósito con el checkout ──
 *
 * 1. Aquí SÍ se bloquea sin stock (409). El checkout falla hacia adelante para
 *    no perder una venta; aquí la venta ya ocurrió, y un 409 le dice al
 *    propietario que el conteo está mal antes de despachar.
 * 2. Si el almacén de inventario no responde, 503 y no 200: un 200 sin haber
 *    descontado nada sería justo el fallo mudo que esto vino a cerrar.
 *
 * Protegido por `x-zephora-automation-key` contra VENTA_MANUAL_KEY, como
 * envio-estado.mjs. La llama un formulario de n8n.
 */
import crypto from 'node:crypto';
import { leerPedido, detallar, PedidoInvalido, SinInventario, inventario as INV }
  from './_precios.js';
import { reservar, confirmar, anular } from './_inventario.mjs';
import { anotarVenta } from './_hoja.mjs';
import { guardar, leer, marcar } from './_pedidos.mjs';
import { purchase } from './_meta.js';

const PAGOS = ['transferencia', 'nequi', 'efectivo', 'otro', 'regalo'];
const CABECERAS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const responder = (codigo, cuerpo) =>
  new Response(JSON.stringify(cuerpo), { status: codigo, headers: CABECERAS });

function claveValida(req) {
  const esperada = String(process.env.VENTA_MANUAL_KEY || '');
  const recibida = String(req.headers.get('x-zephora-automation-key') || '');
  if (!esperada || !recibida) return false;
  const a = Buffer.from(esperada), b = Buffer.from(recibida);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* MAN- y no ZC-: al leer el log, la hoja o Events Manager se distingue de un
   vistazo una venta de chat de una del checkout. */
function referencia() {
  const d = new Date();
  const f = String(d.getUTCFullYear()).slice(2)
    + String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0');
  return `MAN-${f}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const sku = (id, talla) => (talla ? `${id}|${talla}` : id);

async function anularVenta(ref) {
  if (!/^MAN-/.test(ref)) {
    return responder(400, { error: 'Solo se anulan aquí ventas manuales (MAN-…)' });
  }
  const registro = await leer(ref);
  if (!registro || !Array.isArray(registro.lineas) || !registro.lineas.length) {
    return responder(404, { error: 'No hay una venta manual registrada con esa referencia' });
  }
  const items = {};
  registro.lineas.forEach(l => {
    const s = sku(l.id, l.talla);
    items[s] = (items[s] || 0) + (l.unidades || 1);
  });
  const r = await anular(ref, items);
  if (!r || (r.modo !== 'anulada' && r.modo !== 'ya-anulada')) {
    return responder(503, { error: 'El inventario no respondió; no se anuló nada', modo: r && r.modo });
  }
  await marcar(ref, { estado: 'anulada', anuladaEn: new Date().toISOString() });
  console.log(JSON.stringify({ evento: 'venta_manual_anulada', referencia: ref, modo: r.modo }));
  return responder(200, { referencia: ref, modo: r.modo, restante: r.restante || {} });
}

export default async (req) => {
  if (req.method !== 'POST') return responder(405, { error: 'Solo POST' });
  if (!claveValida(req)) {
    console.warn('registrar-venta: intento con clave inválida o ausente');
    return responder(401, { error: 'Clave inválida o ausente' });
  }

  let cuerpo;
  try {
    cuerpo = JSON.parse((await req.text()) || '{}');
  } catch (_) {
    return responder(400, { error: 'El cuerpo no llegó en JSON válido' });
  }

  if (cuerpo.anular) return anularVenta(String(cuerpo.anular));

  const pago = String(cuerpo.pago || '');
  if (!PAGOS.includes(pago)) return responder(400, { error: `pago debe ser uno de: ${PAGOS.join(', ')}` });
  const total = Number(cuerpo.total);
  if (!Number.isInteger(total) || total < 0) {
    return responder(400, { error: 'total debe ser lo cobrado en COP, entero y no negativo' });
  }
  if (pago !== 'regalo' && total === 0) return responder(400, { error: 'Una venta con total 0 va con pago «regalo»' });

  let pedido;
  try {
    /* `pago` aquí es solo para que leerPedido no se queje: el medio real va
       aparte. calcular() no se usa: el total es lo que de verdad se cobró. */
    pedido = leerPedido({ charms: cuerpo.charms, base: cuerpo.base, pago: 'anticipado' });
  } catch (e) {
    if (e instanceof PedidoInvalido) return responder(400, { error: e.message });
    throw e;
  }
  const itemBase = pedido.base && INV && INV.items && INV.items[pedido.base.id];
  if (itemBase && itemBase.tallas && !pedido.base.talla) {
    return responder(400, { error: 'El brazalete necesita la talla vendida (17 a 21)' });
  }

  const ref = referencia();
  let reserva;
  try {
    reserva = await reservar(ref, pedido);
  } catch (e) {
    if (e instanceof SinInventario) {
      return responder(409, { error: e.message.replace(/^Se agotó algo de tu selección mientras la armabas: /, 'Sin unidades: ')
        .replace(/\. Ajusta tu pulsera.*$/, '. Revisa el conteo antes de despachar.'), agotado: true });
    }
    throw e;
  }
  if (!reserva || reserva.modo !== 'reservado') {
    console.error(JSON.stringify({ evento: 'venta_manual_sin_inventario', referencia: ref, modo: reserva && reserva.modo }));
    return responder(503, { error: 'El inventario no respondió; no se registró la venta. Intenta de nuevo.', modo: reserva && reserva.modo });
  }
  const cierre = await confirmar(ref);

  const lineas = detallar(pedido);
  const cliente = {
    nombre: texto(cuerpo.nombre, 80), celular: texto(cuerpo.telefono, 20), correo: texto(cuerpo.correo, 120),
  };
  const cuando = new Date().toISOString();

  const registro = await guardar(ref, {
    estado: 'venta-manual', pago, lineas, total, cliente, nota: texto(cuerpo.nota, 500),
  });
  if (!registro.ok) {
    console.error(JSON.stringify({ evento: 'venta_manual_sin_registro', referencia: ref, motivo: registro.motivo }));
  }

  await anotarVenta({ referencia: ref, pago, cuando, ciudad: '', total, lineas, restante: cierre.restante });

  /* Un regalo no es una compra: contarlo le enseñaría a Meta que regalar
     convierte. Las demás salen como venta de chat, sin señales de navegador. */
  let meta = { enviado: false, motivo: 'regalo: no es compra' };
  if (pago !== 'regalo') {
    const cuenta = {};
    lineas.forEach(l => { cuenta[l.id] = (cuenta[l.id] || 0) + (l.unidades || 1); });
    meta = await purchase({
      referencia: ref, total, cuando, origen: 'chat',
      correo: cliente.correo, telefono: cliente.celular, nombre: cliente.nombre,
      senales: { contenidos: Object.entries(cuenta).map(([id, quantity]) => ({ id, quantity })) },
    });
  }

  console.log(JSON.stringify({
    evento: 'venta_manual', referencia: ref, pago, total,
    lineas: lineas.map(l => ({ id: l.id, talla: l.talla, unidades: l.unidades })),
    meta: { enviado: meta.enviado, motivo: meta.motivo || null },
  }));
  return responder(200, { referencia: ref, restante: cierre.restante || {}, meta: meta.enviado });
};
