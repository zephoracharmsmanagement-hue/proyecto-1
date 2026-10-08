/* Addi: la conversación con su API.
 *
 * ── El flujo (manual de Addi, «Integración del método de pago») ──
 *
 *   1. crear-pago pide un token (OAuth, client credentials) — uno nuevo por
 *      cada intento: el manual advierte que reutilizarlo entre transacciones
 *      simultáneas da errores por expiraciones cruzadas.
 *   2. Con el token crea la «aplicación de crédito»: POST /v1/online-applications.
 *      Addi responde 301 SIN cuerpo y la URL a la que hay que mandar a la
 *      clienta viene en el header Location. Por eso `redirect: 'manual'`: si
 *      fetch siguiera la redirección solo, se perdería la URL.
 *   3. La clienta aprueba (o no) su cupo en la página de Addi, que tarda entre
 *      20 segundos y 10 minutos y caduca a las 2 horas.
 *   4. Addi avisa el resultado a addi-callback (Basic Auth con las credenciales
 *      de notificación del portal) y devuelve a la clienta a gracias.html.
 *
 * ── Variables de entorno ──
 *   ADDI_CLIENT_ID, ADDI_CLIENT_SECRET   credenciales de operación (portal)
 *   ADDI_NOTIF_USUARIO, ADDI_NOTIF_CLAVE credenciales de notificación (portal)
 *   ADDI_ALLY_SLUG                       opcional; por defecto el de la tienda
 *   ADDI_AMBIENTE                        'staging' para el ambiente de pruebas
 *
 * Las de producción son las que entrega el portal de aliados. Las de staging
 * se piden a soporte_aliados@addi.com y no sirven contra producción (ni al
 * revés): auth.addi-staging.com rechaza un client_id de producción.
 */
import crypto from 'node:crypto';

const SLUG = () => process.env.ADDI_ALLY_SLUG || 'zephoracharms-ecommerce';

/* Los dos ambientes. La audiencia de staging NO es el dominio de su API
   (api.addi-staging.com) sino api.staging.addi.com: así lo pide su spec. */
function ambiente() {
  return process.env.ADDI_AMBIENTE === 'staging'
    ? { auth: 'https://auth.addi-staging.com/oauth/token', audiencia: 'https://api.staging.addi.com',
        api: 'https://api.addi-staging.com' }
    : { auth: 'https://auth.addi.com/oauth/token', audiencia: 'https://api.addi.com',
        api: 'https://api.addi.com' };
}

const configurado = () => Boolean(process.env.ADDI_CLIENT_ID && process.env.ADDI_CLIENT_SECRET);

/* Montos como los quiere Addi: texto, con los centavos separados por punto. */
const monto = n => (Math.round(Number(n) * 100) / 100).toFixed(2);

/* Topes y estado del comercio. Es un endpoint público, sin credenciales.
 *
 * Falla hacia adelante: si no responde, se devuelven los topes que tenía la
 * tienda el día de la integración (2026-10-07: de $50.000 a $3.000.000) y se
 * deja intentar — Addi mismo rechaza lo que no le sirva. */
async function configuracion(total) {
  const porDefecto = { min: 50000, max: 3000000, activo: null, consultado: false };
  try {
    const r = await fetch(`https://channels-public-api.addi.com/allies/${encodeURIComponent(SLUG())}`
      + `/config?requestedamount=${Math.round(total)}`, { signal: AbortSignal.timeout(3500) });
    if (!r.ok) return porDefecto;
    const d = await r.json();
    return {
      min: Number(d.minAmount) || porDefecto.min,
      max: Number(d.maxAmount) || porDefecto.max,
      activo: typeof d.isActiveAlly === 'boolean' ? d.isActiveAlly : null,
      consultado: true,
    };
  } catch (_) {
    return porDefecto;
  }
}

async function token() {
  const amb = ambiente();
  const r = await fetch(amb.auth, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audience: amb.audiencia, grant_type: 'client_credentials',
      client_id: process.env.ADDI_CLIENT_ID, client_secret: process.env.ADDI_CLIENT_SECRET,
    }),
    signal: AbortSignal.timeout(8000),
  });
  const d = await r.json().catch(() => ({}));
  /* El mensaje de error de Addi repite el client_id: no se lleva al log. */
  if (!r.ok || !d.access_token) throw new Error(`Addi no dio token (HTTP ${r.status})`);
  return d.access_token;
}

/* Las piezas, como las lista Addi. Una línea con piezas gratis por la promo se
   parte en dos —las cobradas a su precio y las gratis a 0— para que la suma de
   los ítems cuadre con lo que se cobra. */
function itemsDe(lineas, sitio, fotos) {
  const items = [];
  const foto = id => (sitio && fotos && fotos[id] ? `${sitio}/assets/${encodeURIComponent(fotos[id])}` : undefined);
  lineas.forEach(l => {
    const n = Number(l.unidades) || 1;
    const unit = Math.round(l.precio / n);
    const gratis = Math.min(Number(l.gratis) || 0, n);
    const base = {
      sku: l.id,
      name: (l.nombre + (l.talla ? ` · talla ${l.talla}` : '')).slice(0, 120),
      tax: '0.00',
      pictureUrl: foto(l.id),
      category: l.id.startsWith('pulsera') ? 'brazaletes' : 'charms',
      brand: 'Zephora Charms',
    };
    if (n - gratis > 0) items.push(Object.assign({}, base, { quantity: String(n - gratis), unitPrice: monto(unit) }));
    if (gratis > 0) items.push(Object.assign({}, base, { name: (base.name + ' (GRATIS promo)').slice(0, 120),
      quantity: String(gratis), unitPrice: monto(0) }));
  });
  /* La foto es opcional para Addi: si la pieza no tiene, el campo se quita. */
  items.forEach(i => { if (!i.pictureUrl) delete i.pictureUrl; });
  return items;
}

/* El cuerpo de la solicitud. orderId es la referencia del pedido: única por
   intento, como exige Addi (si la clienta reintenta, crear-pago genera otra). */
function cuerpoSolicitud({ referencia, cliente, lineas, cuentas, sitio, fotos }) {
  const direccion = { lineOne: [cliente.direccion, cliente.adicional, cliente.barrio].filter(Boolean).join(', ').slice(0, 200),
    city: cliente.ciudad, country: 'CO' };
  return {
    orderId: referencia,
    totalAmount: monto(cuentas.total),
    shippingAmount: monto(cuentas.envio || 0),
    totalTaxesAmount: monto(0),
    currency: 'COP',
    items: itemsDe(lineas, sitio, fotos),
    client: {
      idType: 'CC',
      idNumber: cliente.documento,
      firstName: cliente.nombre,
      lastName: cliente.apellido,
      email: cliente.correo,
      cellphone: cliente.celular,
      cellphoneCountryCode: '+57',
      address: direccion,
    },
    shippingAddress: direccion,
    billingAddress: direccion,
    allyUrlRedirection: {
      logoUrl: `${sitio}/assets/logo-zephora.png`,
      callbackUrl: `${sitio}/.netlify/functions/addi-callback`,
      redirectionUrl: `${sitio}/gracias.html?ref=${encodeURIComponent(referencia)}&modo=addi`,
    },
  };
}

/* Crea la solicitud y devuelve la URL de Addi. Nunca lanza: devuelve
   { ok:false, motivo } para que crear-pago libere la reserva y ofrezca
   WhatsApp. */
async function crearSolicitud(datos) {
  if (!configurado()) return { ok: false, motivo: 'faltan las credenciales de Addi' };
  try {
    const jwt = await token();
    const r = await fetch(`${ambiente().api}/v1/online-applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify(cuerpoSolicitud(datos)),
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    let url = r.headers.get('location');
    let detalle = '';
    if (!url) {
      const txt = await r.text().catch(() => '');
      detalle = txt.slice(0, 300);
      try {
        const d = JSON.parse(txt);
        url = d.redirectionUrl || d.applicationUrl || (d._links && d._links.webRedirect && d._links.webRedirect.href) || null;
      } catch (_) { /* sin cuerpo JSON */ }
    }
    if (r.status >= 200 && r.status < 400 && url && /^https:\/\//.test(url)) {
      return { ok: true, url, status: r.status };
    }
    return { ok: false, motivo: `Addi respondió ${r.status}`, detalle };
  } catch (e) {
    return { ok: false, motivo: e.message };
  }
}

/* Basic Auth del aviso de Addi, comparado en tiempo constante. Sin
   credenciales configuradas no se acepta ningún aviso. */
function autorizado(cabecera) {
  const u = process.env.ADDI_NOTIF_USUARIO, c = process.env.ADDI_NOTIF_CLAVE;
  if (!u || !c) return false;
  const m = /^Basic\s+(.+)$/i.exec(String(cabecera || '').trim());
  if (!m) return false;
  const esperado = Buffer.from(`${u}:${c}`, 'utf8');
  let recibido;
  try { recibido = Buffer.from(Buffer.from(m[1], 'base64').toString('utf8'), 'utf8'); } catch (_) { return false; }
  return recibido.length === esperado.length && crypto.timingSafeEqual(recibido, esperado);
}

export { configuracion, crearSolicitud, autorizado, configurado };
export const _interno = { cuerpoSolicitud, itemsDe, monto, ambiente, token, SLUG };
