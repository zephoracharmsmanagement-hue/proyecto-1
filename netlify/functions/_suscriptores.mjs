/* Suscriptoras por correo, con $15.000 de descuento en la primera compra de 2
 * piezas o más (decisión del propietario, 2026-10-29: reemplaza el charm de la
 * inicial de regalo, que casi nadie usó —2 de 30— por las condiciones que
 * tenía y porque gastaba letras escasas). Encargo original:
 * automatizaciones/suscripcion/BRIEF.md.
 *
 * ── Qué guarda y dónde ──
 *
 * Blobs, almacén propio (`suscriptores`), clave = sha256 del correo en
 * minúsculas. Valor: { correo, confirmado, fecha, regaloUsado }. `regaloUsado`
 * guarda la referencia del pedido que usó el beneficio de primera compra —antes
 * el charm, ahora el descuento—: se conserva el nombre para que quien ya usó el
 * charm no reciba además el descuento. El correo va
 * en el valor porque la lista de envíos (suscriptores-export) lo necesita; la
 * clave hasheada es para que listar el almacén no sea listar correos.
 *
 * Nada se guarda hasta que la persona confirma desde su correo (doble
 * confirmación): el enlace lleva un token firmado con SUSCRIPCION_SECRETO, así
 * que no hace falta un registro de «pendientes».
 *
 * ── El descuento sí toca el precio ──
 *
 * crear-pago lo resta del total DESPUÉS de la promo, así que es lo que cobran
 * Wompi, Addi o el mensajero. El pedido se marca (`regalo: 'suscriptor'` y
 * `cuentas.descuentoSuscripcion`) y el beneficio se da por usado cuando el
 * pedido se CONFIRMA: contraentrega al crearse, pago en línea al aprobarse. Un
 * pago rechazado no lo gasta.
 */
import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';

const TIENDA = process.env.CONTEXT === 'production' ? 'suscriptores' : 'suscriptores-pruebas';
const VIGENCIA_CONFIRMAR_MS = 7 * 24 * 3600 * 1000;
/* $15.000 desde 2 piezas, charms y brazaletes por igual, como cuenta la promo
   (decisión del propietario, 2026-10-29). */
export const DESCUENTO_SUSCRIPTORA = 15000;
export const MIN_PIEZAS_DESCUENTO = 2;
const piezasDe = pedido => (pedido && Array.isArray(pedido.charms) ? pedido.charms.length : 0) + (pedido && pedido.base ? 1 : 0);

let inyectado = null;
function almacen() {
  if (inyectado) return inyectado;
  try {
    return getStore({ name: TIENDA, consistency: 'strong' });
  } catch (e) {
    console.error('suscriptores: sin almacén —', e.message);
    return null;
  }
}

export const normalizar = c => String(c || '').trim().toLowerCase();
export const correoValido = c => /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(c) && c.length <= 120;
const clave = correo => crypto.createHash('sha256').update(normalizar(correo)).digest('hex');
const b64 = s => Buffer.from(s).toString('base64url');

/* ── Tokens firmados ── */

function secreto() { return String(process.env.SUSCRIPCION_SECRETO || ''); }
export const configurado = () => secreto().length >= 16;

export function firmar(tipo, correo, ahora = Date.now()) {
  const carga = b64(JSON.stringify({ t: tipo, c: normalizar(correo), f: ahora }));
  const firma = crypto.createHmac('sha256', secreto()).update(carga).digest('base64url');
  return `${carga}.${firma}`;
}

/* Devuelve el correo si el token es de ese tipo, está bien firmado y —para
   confirmar— no tiene más de 7 días. Si no, null. */
export function verificar(tipo, token, ahora = Date.now()) {
  if (!configurado() || typeof token !== 'string' || token.length > 600) return null;
  const [carga, firma] = token.split('.');
  if (!carga || !firma) return null;
  const esperada = crypto.createHmac('sha256', secreto()).update(carga).digest('base64url');
  const a = Buffer.from(firma), b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let d;
  try { d = JSON.parse(Buffer.from(carga, 'base64url').toString()); } catch (_) { return null; }
  if (d.t !== tipo || !correoValido(d.c)) return null;
  if (tipo === 'confirmar' && !(ahora - d.f <= VIGENCIA_CONFIRMAR_MS && d.f <= ahora + 60000)) return null;
  return d.c;
}

/* ── Registro ── */

export async function leer(correo) {
  const s = almacen();
  if (!s) return null;
  try { return await s.get(clave(correo), { type: 'json' }); } catch (e) {
    console.error('suscriptores/leer —', e.message); return null;
  }
}

export async function confirmarSuscripcion(correo) {
  const s = almacen();
  if (!s) return { ok: false, motivo: 'sin almacén' };
  const previo = await leer(correo);
  /* Confirmar dos veces no borra un regalo ya usado. */
  if (previo && previo.confirmado) return { ok: true, modo: 'ya-confirmada' };
  await s.setJSON(clave(correo), {
    correo: normalizar(correo), confirmado: true, fecha: new Date().toISOString(), regaloUsado: null,
  });
  return { ok: true, modo: 'confirmada' };
}

export async function darDeBaja(correo) {
  const s = almacen();
  if (!s) return { ok: false, motivo: 'sin almacén' };
  await s.delete(clave(correo));
  return { ok: true };
}

/* ¿Tiene el beneficio sin usar? Para el aviso del checkout antes de pagar. */
export async function descuentoDisponible(correo) {
  const r = await leer(correo);
  return Boolean(r && r.confirmado && !r.regaloUsado);
}

/* Cuánto se descuenta a este pedido: $15.000 si es suscrita confirmada, no ha
   usado el beneficio y lleva 2 piezas o más; si no, 0. Nunca lanza: una lectura
   fallida es «sin descuento», no un pedido caído. */
export async function descuentoPara(correo, pedido) {
  if (piezasDe(pedido) < MIN_PIEZAS_DESCUENTO) return 0;
  return (await descuentoDisponible(correo)) ? DESCUENTO_SUSCRIPTORA : 0;
}

/* Gasta el beneficio a nombre de una referencia. Con CAS: si dos pedidos de la
   misma clienta se confirman a la vez, solo uno lo cuenta. Idempotente por
   referencia (Wompi reintenta sus avisos). */
export async function usarDescuento(correo, referencia) {
  const s = almacen();
  if (!s) return { ok: false, motivo: 'sin almacén' };
  const k = clave(correo);
  for (let i = 0; i < 4; i++) {
    let actual;
    try { actual = await s.getWithMetadata(k, { type: 'json' }); } catch (e) {
      return { ok: false, motivo: e.message };
    }
    const r = actual && actual.data;
    if (!r || !r.confirmado) return { ok: false, motivo: 'no suscrita' };
    if (r.regaloUsado === referencia) return { ok: true, modo: 'ya-usado-aqui' };
    if (r.regaloUsado) return { ok: false, motivo: 'beneficio ya usado en ' + r.regaloUsado };
    const escrito = await s.setJSON(k, Object.assign({}, r, { regaloUsado: referencia }),
      { onlyIfMatch: actual.etag });
    if (escrito && escrito.modified) return { ok: true, modo: 'usado' };
  }
  return { ok: false, motivo: 'CAS sin converger' };
}

export async function confirmadas() {
  const s = almacen();
  if (!s) return null;
  const { blobs } = await s.list();
  const salida = [];
  for (const b of blobs || []) {
    const r = await s.get(b.key, { type: 'json' });
    if (r && r.confirmado && r.correo) salida.push({ correo: r.correo, fecha: r.fecha });
  }
  return salida;
}

export const _interno = { usar(falso) { inyectado = falso; }, clave, TIENDA };
