/* Ajustes de inventario que NO son ventas: un faltante en el estante, una pieza
 * dañada, un error de conteo, un bloqueo temporal mientras se busca algo, o un
 * sobrante (aparecieron más unidades de las contadas).
 *
 * ── Por qué existe ──
 *
 * Hasta ahora la única forma de sacar una unidad sin venderla era registrarla
 * en registrar-venta como «regalo» con total 0. Descontaba bien, pero se
 * anotaba en la hoja de inventario como una venta y quedaba mezclada con las
 * ventas de verdad en el registro de pedidos. Un faltante no es una venta.
 *
 * ── Qué hace y qué NO hace ──
 *
 * Descuenta con el mismo CAS que el checkout y registrar-venta (_inventario.mjs:
 * reservar + confirmar), así que la pieza sale de disponibilidad.mjs al
 * instante, y se revierte igual que una venta manual (anular).
 *
 *   - NO manda Purchase a Meta. Un ajuste no es una compra; contarlo le
 *     enseñaría a la pauta que perder una pieza convierte.
 *   - NO se anota en la hoja (_hoja.mjs). Por eso ni siquiera se importa.
 *   - NO cuenta en vendidas.mjs ni en mas-vendidos.mjs: los dos leen solo los
 *     estados 'confirmado', 'pagado' y 'venta-manual'. Este guarda 'ajuste', y
 *     queda fuera sin tocar esas funciones. Tampoco lo toca rescate.mjs, que
 *     solo mira 'esperando-pago'.
 *   - NO toca stock.json. Cambiarlo, o su campo `generado`, reinicia el
 *     contador de ventas.
 *
 * ── Quita o suma ──
 *
 * faltante, dañada, error de conteo y bloqueo temporal QUITAN unidades (aparta
 * y confirma, igual que una venta). «sobrante» las SUMA: queda como una entrada
 * propia en el inventario (`sumar` en _inventario.mjs), sin tocar stock.json —
 * cambiarlo reinicia el contador de ventas—. En el próximo conteo esa entrada
 * se borra sola, porque el conteo nuevo ya trae esas unidades. Pedido del
 * propietario tras el conteo del 10-oct.
 *
 * ── Reclasificar un «regalo» ──
 *
 * Antes de que existiera esto, los faltantes se registraban en registrar-venta
 * como «regalo» con total 0 (MAN-…). Reclasificar convierte ese registro en un
 * ajuste SIN mover unidades —siguen descontadas—: deja de ser una venta en el
 * registro de pedidos (estado 'ajuste'). La fila que dejó en la hoja de
 * inventario no se borra: la hoja es un espejo y no se le quitan filas.
 *
 * ── Contrato (pensado para el formulario de n8n) ──
 *
 * POST, cabecera `x-zephora-automation-key` = VENTA_MANUAL_KEY: la misma clave
 * de registrar-venta, así el formulario de n8n que ya la tiene no necesita un
 * secreto nuevo.
 *
 *   Ajustar: { motivo, charms:[ids], base:{id,talla}, nota }
 *            motivo: faltante | sobrante | dañada | error de conteo | bloqueo temporal
 *            (acepta mayúsculas, tildes y espacios: sirve tal cual la etiqueta
 *            de un desplegable). base es opcional; un brazalete pide talla.
 *            Una unidad por pieza nombrada (repetir el id = más unidades).
 *            → 200 { referencia:"AJ-…", motivo, signo:-1|+1, restante:{id:unidades} }
 *            → 409 si no hay unidades que quitar (el conteo ya dice 0).
 *   Revertir: { anular:"AJ-…" } — o un MAN- ya reclasificado — deshace el
 *            ajuste: devuelve lo quitado o quita lo sumado. Idempotente.
 *   Reclasificar: { reclasificar:"MAN-…", motivo, nota } — solo un «regalo» de
 *            total 0; motivo de los que quitan. No mueve unidades. Idempotente.
 */
import crypto from 'node:crypto';
import { leerPedido, detallar, PedidoInvalido, SinInventario, inventario as INV }
  from './_precios.js';
import { reservar, confirmar, anular, sumar, quitarSuma, _interno as INV_INTERNO } from './_inventario.mjs';
import { guardar, leer, marcar } from './_pedidos.mjs';

const MOTIVOS = ['faltante', 'sobrante', 'danada', 'error-de-conteo', 'bloqueo-temporal'];
/* Los que suman unidades; el resto las quita. */
const SUMAN = new Set(['sobrante']);
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

/* «Error de conteo», «Dañada», «bloqueo_temporal»… → la forma canónica. Así el
   formulario puede mandar la etiqueta que ve la persona, sin traducirla. */
function normalizarMotivo(v) {
  return String(v == null ? '' : v).trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[\s_]+/g, '-');
}

/* AJ- y no MAN-: en el registro de pedidos y en el log se distingue de un
   vistazo un ajuste de una venta. */
function referencia() {
  const d = new Date();
  const f = String(d.getUTCFullYear()).slice(2)
    + String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0');
  return `AJ-${f}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const sku = (id, talla) => (talla ? `${id}|${talla}` : id);

async function revertir(ref) {
  if (!/^(AJ|MAN)-/.test(ref)) {
    return responder(400, { error: 'Aquí solo se revierten ajustes (AJ-…, o un MAN-… reclasificado como ajuste).' });
  }
  const registro = await leer(ref);
  /* 'ajuste-revertido' también pasa: revertir dos veces debe dar 200 con
     modo 'ya-anulada', no un 404 que haga creer que el ajuste no existió. */
  const esAjuste = registro && (registro.estado === 'ajuste' || registro.estado === 'ajuste-revertido');
  if (/^MAN-/.test(ref) && !(esAjuste && registro.reclasificadoDe)) {
    return responder(400, { error: 'Ese MAN- es una venta manual, no un ajuste: se anula en registrar-venta.' });
  }
  if (!esAjuste || !Array.isArray(registro.lineas) || !registro.lineas.length) {
    return responder(404, { error: 'No hay un ajuste registrado con esa referencia' });
  }
  const items = {};
  registro.lineas.forEach(l => {
    const s = sku(l.id, l.talla);
    items[s] = (items[s] || 0) + (l.unidades || 1);
  });
  /* Un sobrante se deshace quitando su suma; el resto, devolviendo lo quitado. */
  const r = SUMAN.has(registro.motivo) ? await quitarSuma(ref) : await anular(ref, items);
  if (!r || (r.modo !== 'anulada' && r.modo !== 'ya-anulada')) {
    return responder(503, { error: 'El inventario no respondió; no se revirtió nada', modo: r && r.modo });
  }
  /* Solo la primera vez: repetir la reversión no debe mover la fecha. */
  if (r.modo === 'anulada') {
    await marcar(ref, { estado: 'ajuste-revertido', revertidoEn: new Date().toISOString() });
  }
  console.log(JSON.stringify({ evento: 'ajuste_inventario_revertido', referencia: ref, modo: r.modo }));
  return responder(200, { referencia: ref, modo: r.modo, restante: r.restante || {} });
}

export default async (req) => {
  if (req.method !== 'POST') return responder(405, { error: 'Solo POST' });
  if (!claveValida(req)) {
    console.warn('ajustar-inventario: intento con clave inválida o ausente');
    return responder(401, { error: 'Clave inválida o ausente' });
  }

  let cuerpo;
  try {
    cuerpo = JSON.parse((await req.text()) || '{}');
  } catch (_) {
    return responder(400, { error: 'El cuerpo no llegó en JSON válido' });
  }

  if (cuerpo.anular) return revertir(String(cuerpo.anular));

  const motivo = normalizarMotivo(cuerpo.motivo);
  if (!MOTIVOS.includes(motivo)) {
    return responder(400, { error: 'motivo debe ser uno de: faltante, sobrante, dañada, error de conteo, bloqueo temporal' });
  }

  if (cuerpo.reclasificar) return reclasificar(String(cuerpo.reclasificar), motivo, texto(cuerpo.nota, 500));

  let pedido;
  try {
    /* leerPedido valida ids y tallas contra el catálogo; `pago` solo lo
       satisface, aquí no hay cobro. */
    pedido = leerPedido({ charms: cuerpo.charms, base: cuerpo.base, pago: 'anticipado' });
  } catch (e) {
    if (e instanceof PedidoInvalido) return responder(400, { error: e.message });
    throw e;
  }
  const itemBase = pedido.base && INV && INV.items && INV.items[pedido.base.id];
  if (itemBase && itemBase.tallas && !pedido.base.talla) {
    return responder(400, { error: 'El brazalete necesita la talla (17 a 21)' });
  }

  const ref = referencia();

  if (SUMAN.has(motivo)) {
    const items = INV_INTERNO.itemsDe(pedido);
    const r = await sumar(ref, items);
    if (!r || r.modo !== 'sumada') {
      console.error(JSON.stringify({ evento: 'ajuste_sin_inventario', referencia: ref, modo: r && r.modo }));
      return responder(503, { error: 'El inventario no respondió; no se registró el ajuste. Intenta de nuevo.', modo: r && r.modo });
    }
    const lineasS = detallar(pedido);
    const regS = await guardar(ref, { estado: 'ajuste', motivo, signo: 1, lineas: lineasS, nota: texto(cuerpo.nota, 500) });
    if (!regS.ok) console.error(JSON.stringify({ evento: 'ajuste_sin_registro', referencia: ref, motivo: regS.motivo }));
    console.log(JSON.stringify({ evento: 'ajuste_inventario', referencia: ref, motivo, signo: 1,
      lineas: lineasS.map(l => ({ id: l.id, talla: l.talla, unidades: l.unidades })) }));
    return responder(200, { referencia: ref, motivo, signo: 1, restante: r.restante || {} });
  }

  let reserva;
  try {
    reserva = await reservar(ref, pedido);
  } catch (e) {
    if (e instanceof SinInventario) {
      return responder(409, {
        error: e.message.replace(/^Se agotó algo de tu selección mientras la armabas: /, 'Sin unidades que ajustar: ')
          .replace(/\. Ajusta tu pulsera.*$/, '. El conteo ya la da por agotada.'),
        agotado: true,
      });
    }
    throw e;
  }
  /* Como en registrar-venta: si el almacén no responde, 503 y no 200. Un 200
     sin haber descontado nada es justo el fallo mudo que esto vino a cerrar. */
  if (!reserva || reserva.modo !== 'reservado') {
    console.error(JSON.stringify({ evento: 'ajuste_sin_inventario', referencia: ref, modo: reserva && reserva.modo }));
    return responder(503, { error: 'El inventario no respondió; no se registró el ajuste. Intenta de nuevo.', modo: reserva && reserva.modo });
  }
  const cierre = await confirmar(ref);

  const lineas = detallar(pedido);
  const registro = await guardar(ref, { estado: 'ajuste', motivo, signo: -1, lineas, nota: texto(cuerpo.nota, 500) });
  if (!registro.ok) {
    /* El descuento ya está hecho; sin registro no se podría revertir por
       referencia. Se avisa en el log para corregirlo a mano. */
    console.error(JSON.stringify({ evento: 'ajuste_sin_registro', referencia: ref, motivo: registro.motivo }));
  }

  console.log(JSON.stringify({
    evento: 'ajuste_inventario', referencia: ref, motivo,
    lineas: lineas.map(l => ({ id: l.id, talla: l.talla, unidades: l.unidades })),
  }));
  return responder(200, { referencia: ref, motivo, signo: -1, restante: cierre.restante || {} });
};

/* Un «regalo» de registrar-venta que en realidad era un faltante (o un bloqueo)
   pasa a ser un ajuste. Las unidades no se mueven: ya están descontadas. */
async function reclasificar(ref, motivo, nota) {
  if (!/^MAN-/.test(ref)) return responder(400, { error: 'Solo se reclasifican registros de registrar-venta (MAN-…)' });
  if (SUMAN.has(motivo)) {
    return responder(400, { error: 'Un regalo quitó unidades: se reclasifica con un motivo que quita (faltante, dañada, error de conteo, bloqueo temporal)' });
  }
  const registro = await leer(ref);
  if (!registro) return responder(404, { error: 'No hay un registro con esa referencia' });
  if (registro.estado === 'ajuste' && registro.reclasificadoDe) {
    return responder(200, { referencia: ref, modo: 'ya-reclasificado', motivo: registro.motivo });
  }
  if (registro.estado !== 'venta-manual' || registro.pago !== 'regalo' || Number(registro.total) !== 0) {
    return responder(409, { error: 'Solo se reclasifica un «regalo» de total 0 que siga vigente (no una venta cobrada ni una anulada)', estado: registro.estado, pago: registro.pago });
  }
  const r = await marcar(ref, {
    estado: 'ajuste', motivo, signo: -1, reclasificadoDe: 'venta-manual',
    reclasificadoEn: new Date().toISOString(), notaAjuste: nota || null,
  });
  if (!r || !r.ok) return responder(503, { error: 'El registro de pedidos no respondió; no se reclasificó nada' });
  console.log(JSON.stringify({ evento: 'ajuste_reclasificado', referencia: ref, motivo }));
  return responder(200, { referencia: ref, modo: 'reclasificado', motivo });
}
