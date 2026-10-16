/* Sistecrédito: la conversación con su pasarela (api.credinet.co/pay).
 *
 * ── El flujo (guías G-ALI-08, G-ALI-10 y G-ALI-12 de Sistecrédito) ──
 *
 *   1. crear-pago crea la transacción: POST /pay/create. Sistecrédito responde
 *      con un `_id` y el estado PendingForPaymentMethod, todavía SIN la URL de
 *      pago: se la pide al medio de pago por detrás y tarda unos segundos.
 *   2. El checkout pregunta por sistecredito-enlace, que consulta
 *      GET /pay/GetTransactionResponse hasta que aparece
 *      paymentMethodResponse.paymentRedirectUrl, y manda a la clienta ahí.
 *      Esa URL sirve una sola vez y la transacción vence a los ~15 minutos.
 *   3. La clienta escoge sus cuotas y confirma con el código que le llega al
 *      celular. Sistecrédito avisa cada cambio de estado a sistecredito-aviso
 *      y la devuelve a gracias.html.
 *
 * ── Por qué un aviso no se cree solo ──
 *
 * El aviso no viene firmado: la guía recomienda volver a consultar la
 * transacción con GetTransactionResponse y comparar. Aquí se hace siempre, y
 * lo que manda es la consulta —hecha por la tienda, con sus llaves—, no el
 * cuerpo del aviso. Además el aviso trae de vuelta el extraData que se mandó
 * al crear: una firma HMAC de la referencia que nadie de fuera puede calcular.
 *
 * ── Variables de entorno ──
 *   SISTECREDITO_SUBSCRIPTION_KEY   cabecera Ocp-Apim-Subscription-Key
 *   SISTECREDITO_STORE_ID           cabecera ApplicationKey
 *   SISTECREDITO_VENDOR_ID          cabecera ApplicationToken
 *   SISTECREDITO_AMBIENTE           'Staging' para pruebas; por defecto Production
 *   SISTECREDITO_SANDBOX            opcional: Approved | Rejected | Pending |
 *                                   Cancelled | PendingForPaymentMethod. Enciende
 *                                   el modo de pruebas de la pasarela, que simula
 *                                   esa respuesta sin pasar por un crédito real.
 *                                   Solo en vistas previas, nunca en producción.
 *   SISTECREDITO_MINIMO             opcional; mínimo de la tienda, $50.000
 *
 * Las llaves del correo de configuración (2026-10-15) son de producción:
 * Production las acepta y Staging no responde.
 */
import crypto from 'node:crypto';
import { cerrarPago } from './_cierre.mjs';
import { marcar } from './_pedidos.mjs';

const API = 'https://api.credinet.co/pay';

/* Id del medio de pago Sistecrédito en la pasarela: 2 en los dos ambientes. */
const MEDIO = 2;

/* Desde cuánto se ofrece. Decisión del propietario (2026-10-15): $50.000, como
   Addi. Ningún pedido de la tienda baja de ahí —la pieza más barata vale
   $75.000—, así que en la práctica no deja a nadie por fuera. Sistecrédito
   tiene además su propio mínimo (error 802), que no publica. */
const MINIMO = () => Number(process.env.SISTECREDITO_MINIMO) || 50000;

const APROBADO = 'Approved';
const NEGATIVOS = new Set(['Rejected', 'Cancelled', 'Expired', 'Abandoned', 'Failed']);
const SANDBOX = ['PendingForPaymentMethod', 'Rejected', 'Pending', 'Approved', 'Cancelled'];

const llaves = () => ({
  sub: process.env.SISTECREDITO_SUBSCRIPTION_KEY,
  store: process.env.SISTECREDITO_STORE_ID,
  vendor: process.env.SISTECREDITO_VENDOR_ID,
});
const configurado = () => { const k = llaves(); return Boolean(k.sub && k.store && k.vendor); };

/* Las cabeceras de toda llamada. El User-Agent no es adorno: el firewall que
   tiene delante la pasarela (Cloudflare) responde 403 «error code: 1010» a los
   clientes sin uno reconocible, y el fetch de las funciones manda «node». */
function cabeceras() {
  const k = llaves();
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'ZephoraCharms/1.0 (+https://zephoracharms.com)',
    SCLocation: '0,0',
    SCOrigen: process.env.SISTECREDITO_AMBIENTE === 'Staging' ? 'Staging' : 'Production',
    country: 'co',
    'Ocp-Apim-Subscription-Key': k.sub,
    ApplicationKey: k.store,
    ApplicationToken: k.vendor,
  };
}

function sandbox() {
  const s = process.env.SISTECREDITO_SANDBOX;
  return SANDBOX.includes(s) ? { isActive: true, status: s } : { isActive: false, status: APROBADO };
}

/* Firma de la referencia que viaja en extraData y vuelve en cada aviso. La
   llave de suscripción solo la tienen Sistecrédito y la tienda. */
const firma = ref => crypto.createHmac('sha256', String(llaves().sub || '')).update(String(ref)).digest('hex');

function firmaValida(ref, recibida) {
  const a = Buffer.from(firma(ref)), b = Buffer.from(String(recibida || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function cuerpoTransaccion({ referencia, cliente, cuentas, sitio, ip }) {
  return {
    invoice: referencia,
    description: `Zephora Charms · pedido ${referencia}`,
    paymentMethod: { paymentMethodId: MEDIO, bankCode: 1, userType: 0 },
    currency: 'COP',
    value: Math.round(cuentas.total),
    tax: 0,
    taxBase: Math.round(cuentas.total),
    sandbox: sandbox(),
    urlResponse: `${sitio}/gracias.html?ref=${encodeURIComponent(referencia)}&modo=sistecredito`,
    urlConfirmation: `${sitio}/.netlify/functions/sistecredito-aviso`,
    methodConfirmation: 'POST',
    client: {
      docType: 'CC',
      document: cliente.documento,
      name: cliente.nombre,
      lastName: cliente.apellido,
      email: cliente.correo,
      indCountry: '57',
      phone: cliente.celular,
      country: 'co',
      city: cliente.ciudad,
      address: [cliente.direccion, cliente.adicional, cliente.barrio].filter(Boolean).join(', ').slice(0, 200),
      ipAddress: ip || '0.0.0.0',
    },
    extraData: { Authentication: firma(referencia) },
  };
}

/* Lo que importa de una transacción, venga de la consulta o del aviso. */
function resumen(data) {
  const d = data || {};
  const pmr = d.paymentMethodResponse || {};
  const url = String(pmr.paymentRedirectUrl || '');
  return {
    id: d._id || null,
    invoice: d.invoice || null,
    valor: Number(d.value),
    tienda: d.storeId || null,
    estado: String(d.transactionStatus || pmr.statusResponse || ''),
    url: /^https:\/\//i.test(url) ? url : null,
    codigo: String(pmr.codeResponse || ''),
    descripcion: String(pmr.description || '').slice(0, 200),
  };
}

async function llamar(url, opciones) {
  const r = await fetch(url, Object.assign({ headers: cabeceras(), signal: AbortSignal.timeout(12000) }, opciones));
  const txt = await r.text().catch(() => '');
  let d = null;
  try { d = JSON.parse(txt); } catch (_) { /* sin JSON */ }
  return { status: r.status, d, txt };
}

/* Crea la transacción. Nunca lanza: devuelve { ok:false, motivo } para que
   crear-pago libere la reserva y ofrezca otro medio de pago. */
async function crearTransaccion(datos) {
  if (!configurado()) return { ok: false, motivo: 'faltan las llaves de Sistecrédito' };
  try {
    const r = await llamar(`${API}/create`, { method: 'POST', body: JSON.stringify(cuerpoTransaccion(datos)) });
    const t = resumen(r.d && r.d.data);
    /* create responde 201 (comprobado contra la pasarela real, 2026-10-15), no 200. */
    const bien = r.status >= 200 && r.status < 300 && t.id;
    if (bien && !NEGATIVOS.has(t.estado)) return { ok: true, id: t.id, url: t.url, estado: t.estado };
    /* Rechazada al crearla (801 solicitud abierta, 802 bajo su mínimo…): no es
       una caída, y la clienta tiene que saber el motivo. */
    if (bien) return { ok: false, rechazada: true, motivo: `Sistecrédito rechazó la transacción (${t.estado} ${t.codigo})`, mensaje: mensaje(t) };
    return { ok: false, motivo: `Sistecrédito respondió ${r.status}`,
      detalle: (r.d && r.d.message) || t.descripcion || r.txt.slice(0, 200) };
  } catch (e) {
    return { ok: false, motivo: e.message };
  }
}

/* Consulta una transacción por su _id. { ok:true, t } con el resumen. */
async function consultar(id) {
  if (!configurado()) return { ok: false, motivo: 'faltan las llaves de Sistecrédito' };
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(String(id || ''))) return { ok: false, motivo: 'id inválido' };
  try {
    const r = await llamar(`${API}/GetTransactionResponse?transactionId=${encodeURIComponent(id)}`, { method: 'GET' });
    const t = resumen(r.d && r.d.data);
    if (r.status >= 200 && r.status < 300 && t.id === id) return { ok: true, t };
    return { ok: false, motivo: `Sistecrédito respondió ${r.status}`, detalle: (r.d && r.d.message) || '' };
  } catch (e) {
    return { ok: false, motivo: e.message };
  }
}

const simple = estado => (estado === APROBADO ? 'aprobado' : NEGATIVOS.has(estado) ? 'rechazado' : 'pendiente');

/* Lo que se le dice a la clienta cuando no se pudo. 802 = por debajo del
   mínimo de Sistecrédito; 801 = ya tiene una solicitud abierta. */
function mensaje(t) {
  if (t.codigo === '802') return 'El valor está por debajo del mínimo que acepta Sistecrédito. Puedes elegir otro medio de pago.';
  if (t.codigo === '801') return 'Ya tienes una solicitud abierta en Sistecrédito. Espera unos minutos o elige otro medio de pago.';
  return 'Sistecrédito no aprobó el pago. Puedes intentar de nuevo o elegir otro medio de pago.';
}

/* Aplica al pedido lo que Sistecrédito dice de su transacción. `t` tiene que
 * salir de consultar() —de Sistecrédito, con las llaves de la tienda—, nunca
 * de un cuerpo que llegó de fuera. Idempotente: el aviso y la consulta del
 * checkout pueden llegar los dos, y en cualquier orden. */
async function aplicar(referencia, pedido, t) {
  const fin = modo => ({ modo, estado: simple(t.estado), mensaje: NEGATIVOS.has(t.estado) ? mensaje(t) : null });
  if (t.invoice !== referencia || (pedido.sistecreditoId && t.id !== pedido.sistecreditoId)) {
    console.error(JSON.stringify({ evento: 'sistecredito_no_cuadra', referencia, invoice: t.invoice, id: t.id }));
    return { modo: 'no-cuadra', estado: 'pendiente' };
  }
  if (pedido.estado === 'pagado') return { modo: 'ya-cerrado', estado: 'aprobado' };
  if (String(pedido.estado || '').startsWith('pago-')) return fin('ya-cerrado');

  const total = pedido.cuentas && pedido.cuentas.total;
  const c = pedido.cliente || {};
  const datos = {
    referencia, transaccion: t.id, metodo: 'SISTECREDITO', total,
    correo: c.correo || null, telefono: c.celular || null,
    nombre: c.nombre ? `${c.nombre} ${c.apellido || ''}`.trim() : null,
    cuandoMs: Date.now(), medio: 'sistecredito',
  };

  if (t.estado === APROBADO) {
    if (!total || Math.abs(t.valor - total) > 1) {
      /* Aprobado por un valor que no es el del pedido: no se despacha sin que
         la tienda lo mire. */
      console.error(JSON.stringify({ evento: 'sistecredito_monto_distinto', referencia, pedido: total, aprobado: t.valor }));
      await marcar(referencia, { sistecreditoEstado: 'monto-distinto', sistecreditoValor: t.valor });
      return { modo: 'monto-distinto', estado: 'pendiente' };
    }
    await cerrarPago(Object.assign({ aprobado: true, estado: 'APPROVED' }, datos));
    return fin('cerrado');
  }
  if (NEGATIVOS.has(t.estado)) {
    await cerrarPago(Object.assign({ aprobado: false, estado: t.estado.toUpperCase() }, datos));
    await marcar(referencia, { sistecreditoCodigo: t.codigo || null, sistecreditoMotivo: t.descripcion || null });
    return fin('cerrado');
  }
  if (pedido.sistecreditoEstado !== t.estado) await marcar(referencia, { sistecreditoEstado: t.estado });
  return fin('pendiente');
}

export { crearTransaccion, consultar, aplicar, firmaValida, configurado, mensaje, MINIMO };
export const _interno = { cuerpoTransaccion, resumen, cabeceras, sandbox, firma };
