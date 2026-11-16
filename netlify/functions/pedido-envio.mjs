/* Datos de envío de UN pedido, para que n8n arme la orden de Skydropx.
 *
 * Diseño: docs/superpowers/specs/2026-11-14-avisos-whatsapp-pedidos-design.md § 7
 * (etapa 2, aprobada por el propietario el 2026-11-15).
 *
 * ── Qué hace ──
 *
 * n8n se entera de cada venta por el aviso que la tienda ya le manda a la hoja
 * de inventario, que trae la referencia pero no el celular ni la dirección (y
 * no debe traerlos: es un espejo de inventario). Con esa referencia llama
 * aquí y recibe lo que la guía necesita: a quién, a dónde, qué paquete y con
 * qué reglas. Después vuelve a llamar para anotar en el pedido la orden y la
 * guía que creó en Skydropx.
 *
 *   POST { referencia }                               → datos del envío
 *   POST { referencia, anotar: { orden_id, guia_id, transportadora } }
 *                                                     → guarda y responde sin datos
 *
 * ── Por qué es tan estrecha ──
 *
 * Entrega nombre, celular y dirección de una clienta: exactamente lo que
 * `_pedidos.mjs` dice que no hay que exponer sin más. Por eso:
 *
 *  · Sin la clave no se mira ni el cuerpo ni el pedido. La clave es propia de
 *    esta función (`PEDIDO_ENVIO_KEY`): si se filtra la de otra automatización,
 *    esta puerta sigue cerrada.
 *  · Un pedido por llamada, por su referencia exacta. No hay búsqueda ni forma
 *    de recorrer los pedidos: quien tenga la clave pero no una referencia no
 *    saca nada. Y solo por POST, para que la referencia no quede en la
 *    dirección ni en los registros de acceso.
 *  · Solo lo que la guía necesita. No van el correo, el documento, la
 *    dedicatoria, el permiso de publicidad, los precios ni nada del pago.
 *  · Solo pedidos en firme: pagado y cobrado, o contraentrega confirmada. Uno
 *    pendiente, rechazado, anulado o de prueba no entrega nada.
 *  · No cambia el estado del pedido ni toca el cobro ni el inventario.
 *
 * ── Los números los pone el repo ──
 *
 * Valor declarado, tope por guía, recaudo máximo y si la guía se puede comprar
 * sola salen de aquí, de las reglas que dio el propietario. n8n no decide
 * ninguno: si mañana cambia una regla, se cambia en un sitio con pruebas.
 */
import crypto from 'node:crypto';
import { leer, marcar } from './_pedidos.mjs';
import dane from './_dane.js';

const CABECERAS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};
const responder = (codigo, cuerpo, extra) =>
  new Response(JSON.stringify(cuerpo), { status: codigo, headers: extra ? Object.assign({}, CABECERAS, extra) : CABECERAS });

/* Reglas del propietario (2026-11-15), en pesos. */
const REGLAS = {
  declaradoPagado: 46000,          // valor declarado de un pedido ya pagado
  topeGuia: 25000,                 // por encima, la guía no se compra sola
  cambiarSiAhorra: 5000,           // se cambia de transportadora solo si la otra ahorra esto o más
  transportadora: { pagado: 'Inter Rapidísimo', contraentrega: 'Coordinadora' },
};
/* El «paquete habitual» de la cuenta de Skydropx. */
const PAQUETE = { largo_cm: 19, ancho_cm: 19, alto_cm: 5, peso_kg: 1, contenido: 'brazalete' };
/* Skydropx imprime 70 caracteres de indicaciones en la guía. */
const INDICACIONES_MAX = 70;

const MIN_CLAVE = 32;
const TOPE_CUERPO = 2000;
/* Las referencias que generan crear-pago y registrar-venta. Nada más se lee:
   en ese almacén también viven los ajustes de inventario. */
const REFERENCIA = /^(ZC|MAN)-\d{6}-[0-9A-F]{8}$/;
const ID_SKYDROPX = /^[A-Za-z0-9_-]{1,80}$/;
const TRANSPORTADORA = /^[\p{L}\p{N} .-]{1,40}$/u;

/* Comparación en tiempo constante. Se comparan los resúmenes y no las claves:
   así ni el contenido ni el largo se filtran por cuánto tarda la respuesta.
   Una clave ausente o corta en el servidor cierra la puerta, no la abre. */
function claveValida(req) {
  const esperada = String(process.env.PEDIDO_ENVIO_KEY || '');
  const recibida = String(req.headers.get('x-zephora-automation-key') || '');
  if (esperada.length < MIN_CLAVE) {
    console.error('pedido-envio: PEDIDO_ENVIO_KEY falta o tiene menos de ' + MIN_CLAVE + ' caracteres; no se atiende nada');
    return false;
  }
  const h = s => crypto.createHash('sha256').update(s).digest();
  return crypto.timingSafeEqual(h(esperada), h(recibida));
}

const texto = v => (typeof v === 'string' ? v.trim() : '');

/* ¿Está en firme? Se exige que el estado y el medio de pago cuenten la misma
   historia: «pagado» es un pago en línea ya cobrado; «confirmado», una
   contraentrega. Cualquier otra combinación no se despacha desde aquí. */
function situacion(pedido) {
  const estado = pedido.estado, pago = pedido.pago;
  if (estado === 'venta-manual') return { motivo: 'venta-manual', error: 'Es una venta manual: no tiene dirección guardada' };
  if (estado === 'esperando-pago') return { motivo: 'pendiente-de-pago', error: 'El pedido todavía no está pagado' };
  let tipo = null;
  if (estado === 'pagado' && pago && pago !== 'contraentrega') tipo = 'pagado';
  if (estado === 'confirmado' && pago === 'contraentrega') tipo = 'contraentrega';
  if (!tipo) return { motivo: 'no-en-firme', error: 'El pedido no está en firme' };
  const c = pedido.cliente || {};
  if (!texto(c.celular) || !texto(c.direccion) || !texto(c.ciudad) || !texto(c.depto)) {
    return { motivo: 'sin-direccion', error: 'El pedido no tiene los datos de entrega completos' };
  }
  return { tipo };
}

function indicaciones(notas) {
  const completas = texto(notas);
  const unaLinea = completas.replace(/\s+/g, ' ');
  const recortadas = unaLinea.length > INDICACIONES_MAX;
  return {
    indicaciones: completas,
    indicaciones_cortas: recortadas ? unaLinea.slice(0, INDICACIONES_MAX - 1) + '…' : unaLinea,
    indicaciones_recortadas: recortadas,
  };
}

const idsDe = pedido => {
  const s = pedido.skydropx || {};
  return { orden_id: s.orden_id || null, guia_id: s.guia_id || null };
};

function datosDeEnvio(pedido, tipo) {
  const c = pedido.cliente;
  const esContra = tipo === 'contraentrega';
  const codigo = dane.codigoDane(c.depto, c.ciudad);
  const ind = indicaciones(c.notas);
  const skydropx = idsDe(pedido);

  /* Cuándo la guía NO se compra sola y la revisa una persona. La
     contraentrega va siempre a mano: el propietario confirma la dirección con
     la clienta antes de pagar la guía, y el recaudo real (declarado + flete)
     solo se ve al crearla. */
  const motivos = [];
  if (esContra) motivos.push('contraentrega');
  if (!codigo) motivos.push('sin-codigo-dane');
  if (ind.indicaciones_recortadas) motivos.push('indicaciones-recortadas');
  if (skydropx.guia_id) motivos.push('ya-tiene-guia');

  return {
    referencia: pedido.referencia,
    tipo,
    destinatario: {
      nombre: [texto(c.nombre), texto(c.apellido)].filter(Boolean).join(' '),
      celular: texto(c.celular),
    },
    destino: Object.assign({
      direccion: texto(c.direccion),
      detalles: texto(c.adicional),
      barrio: texto(c.barrio),
      ciudad: texto(c.ciudad),
      departamento: texto(c.depto),
      codigo_dane: codigo,
    }, ind),
    paquete: PAQUETE,
    piezas: (pedido.lineas || []).map(l => ({ nombre: l.nombre, cantidad: l.unidades })),
    reglas: {
      transportadora: REGLAS.transportadora[tipo],
      cambiar_si_ahorra: REGLAS.cambiarSiAhorra,
      tope_guia: REGLAS.topeGuia,
      /* En contraentrega el declarado depende del flete: lo calcula n8n al
         cotizar, de modo que declarado + flete no pase de `recaudo_maximo`,
         que es el total que la clienta vio en el checkout. */
      declarado: esContra ? null : REGLAS.declaradoPagado,
      recaudo: esContra,
      recaudo_maximo: esContra ? Number((pedido.cuentas || {}).total) || null : null,
      /* Protección Plus solo en contraentrega. El panel de Skydropx está en
         «decidir en cada envío», así que cada guía la pide o no de forma
         explícita. */
      proteccion: esContra,
    },
    compra_automatica: { permitida: motivos.length === 0, motivos },
    skydropx,
  };
}

/* Valida lo que n8n quiere anotar. Devuelve null si no es exactamente una
   orden y/o una guía de Skydropx: aquí no se escribe nada más en un pedido. */
function leerAnotacion(a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
  const permitidas = ['orden_id', 'guia_id', 'transportadora'];
  if (Object.keys(a).some(k => !permitidas.includes(k))) return null;
  /* Un campo en null es «no viene» (n8n manda así la guía que aún no existe):
     no se anota y, sobre todo, no borra lo que ya estaba. */
  const viene = k => a[k] !== undefined && a[k] !== null;
  const out = {};
  for (const k of ['orden_id', 'guia_id']) {
    if (!viene(k)) continue;
    if (typeof a[k] !== 'string' || !ID_SKYDROPX.test(a[k])) return null;
    out[k] = a[k];
  }
  if (!out.orden_id && !out.guia_id) return null;
  if (viene('transportadora')) {
    if (typeof a.transportadora !== 'string' || !TRANSPORTADORA.test(a.transportadora)) return null;
    out.transportadora = a.transportadora;
  }
  return out;
}

export default async (req) => {
  if (req.method !== 'POST') return responder(405, { error: 'Solo POST' }, { Allow: 'POST' });
  if (!claveValida(req)) {
    console.warn('pedido-envio: intento con clave inválida o ausente');
    return responder(401, { error: 'Clave inválida o ausente' });
  }

  const crudo = await req.text();
  if (crudo.length > TOPE_CUERPO) return responder(413, { error: 'Cuerpo demasiado grande' });
  let cuerpo;
  try {
    cuerpo = JSON.parse(crudo || '{}');
  } catch (_) {
    return responder(400, { error: 'El cuerpo no llegó en JSON válido' });
  }
  if (!cuerpo || typeof cuerpo !== 'object') return responder(400, { error: 'El cuerpo no llegó en JSON válido' });

  const referencia = cuerpo.referencia;
  if (typeof referencia !== 'string' || !REFERENCIA.test(referencia)) {
    return responder(400, { error: 'Falta la referencia del pedido, o no tiene forma de referencia' });
  }
  const anotacion = cuerpo.anotar === undefined ? undefined : leerAnotacion(cuerpo.anotar);
  if (anotacion === null) {
    return responder(400, { error: 'anotar solo admite orden_id, guia_id y transportadora' });
  }

  const accion = anotacion ? 'anotar' : 'datos';
  const bitacora = resultado => console.log(JSON.stringify({ evento: 'pedido_envio', referencia, accion, resultado }));

  const pedido = await leer(referencia);
  if (!pedido) {
    bitacora('no-existe');
    return responder(404, { error: 'No existe un pedido con esa referencia' });
  }
  const s = situacion(pedido);
  if (!s.tipo) {
    bitacora(s.motivo);
    return responder(409, { error: s.error, motivo: s.motivo });
  }

  if (!anotacion) {
    bitacora('entregado');
    return responder(200, datosDeEnvio(pedido, s.tipo));
  }

  /* Anotar la orden y la guía. Una guía distinta de la que ya hay se rechaza:
     sería una segunda compra para el mismo pedido, y eso lo tiene que ver una
     persona. Repetir la misma no es un error (un reintento de n8n). */
  const previo = pedido.skydropx || {};
  if (anotacion.guia_id && previo.guia_id && previo.guia_id !== anotacion.guia_id) {
    bitacora('ya-tiene-guia');
    return responder(409, { error: 'El pedido ya tiene otra guía anotada', motivo: 'ya-tiene-guia' });
  }
  const ahora = new Date().toISOString();
  const nuevo = Object.assign({}, previo);
  if (anotacion.orden_id && anotacion.orden_id !== previo.orden_id) { nuevo.orden_id = anotacion.orden_id; nuevo.ordenEn = ahora; }
  if (anotacion.guia_id && anotacion.guia_id !== previo.guia_id) { nuevo.guia_id = anotacion.guia_id; nuevo.guiaEn = ahora; }
  if (anotacion.transportadora) nuevo.transportadora = anotacion.transportadora;

  const r = await marcar(referencia, { skydropx: nuevo });
  if (!r.ok) {
    bitacora('sin-guardar');
    return responder(503, { error: 'No se pudo guardar; se puede reintentar' });
  }
  bitacora('anotado');
  return responder(200, { ok: true, referencia, skydropx: { orden_id: nuevo.orden_id || null, guia_id: nuevo.guia_id || null } });
};
