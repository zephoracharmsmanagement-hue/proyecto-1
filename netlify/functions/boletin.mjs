/* Correos de novedades a las suscriptoras confirmadas, por Resend.
 *
 *   POST /.netlify/functions/boletin
 *   cabecera x-zephora-automation-key = BOLETIN_KEY (o SUSCRIPTORES_KEY)
 *
 *   { campana, modo: 'vista' }                 → arma el correo y lo devuelve; no manda nada
 *   { campana, modo: 'prueba', para }          → manda las dos versiones (con y sin la línea de
 *                                                 los $15.000) solo a `para`
 *   { campana, modo: 'enviar', confirmo: 'enviar' } → manda a todas las confirmadas
 *
 * Por qué una función y no Broadcasts de Resend: la lista y las bajas viven en
 * Blobs (`suscriptores`). Una Audiencia de Resend sería una segunda lista con su
 * propio enlace de baja, y quien se diera de baja allá seguiría recibiendo
 * desde aquí (Ley 1581). Aquí cada correo lleva el enlace firmado de
 * suscribir.mjs y la cabecera List-Unsubscribe que apunta al mismo.
 *
 * Precios, unidades y fotos salen de `disponibilidad` en el momento de armar
 * (nada agotado entra; ver _boletin.mjs). Si la promo del sitio ya no es la
 * que dice el texto, no se arma.
 *
 * Una campaña se manda UNA vez: el registro en Blobs (`boletines`) guarda los
 * correos que salieron (como hash) y cada lote va con Idempotency-Key: un reintento
 * después de un fallo sigue donde quedó y no repite a nadie.
 */
import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { confirmadas, firmar, configurado, normalizar, correoValido } from './_suscriptores.mjs';
import { CAMPANAS, seleccionar, armar, verificarReglas } from './_boletin.mjs';

const H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const json = (c, d) => new Response(JSON.stringify(d), { status: c, headers: H });
const LOTE = 100;                                  // máximo de /emails/batch
const REGISTRO = process.env.CONTEXT === 'production' ? 'boletines' : 'boletines-pruebas';

let inyectado = null;
export const _interno = { usarAlmacen(a) { inyectado = a; } };
const almacen = () => inyectado || getStore({ name: REGISTRO, consistency: 'strong' });

const sitio = () => (process.env.URL_SITIO || process.env.URL || 'https://zephoracharms.com').replace(/\/$/, '');
const desde = () => process.env.CORREO_NOVEDADES || 'Zephora Charms <novedades@zephoracharms.com>';
const responderA = () => String(process.env.CORREO_TIENDA || '').trim() || 'zephoracharms@gmail.com';
const enlaceBaja = correo => `${sitio()}/suscribir?baja=${encodeURIComponent(firmar('baja', correo))}`;

function claveValida(req) {
  const recibida = Buffer.from(String(req.headers.get('x-zephora-automation-key') || ''));
  if (!recibida.length) return false;
  return ['BOLETIN_KEY', 'SUSCRIPTORES_KEY'].some(v => {
    const esperada = Buffer.from(String(process.env[v] || ''));
    return esperada.length >= 16 && esperada.length === recibida.length && crypto.timingSafeEqual(esperada, recibida);
  });
}

async function leerDisponibilidad() {
  const r = await fetch(`${sitio()}/.netlify/functions/disponibilidad`, {
    headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('disponibilidad respondió ' + r.status);
  return r.json();
}

/* El mismo enlace (firmado una sola vez) va en el cuerpo y en la cabecera. */
function mensaje(correo, armado, baja) {
  return {
    from: desde(), to: [correo], reply_to: responderA(),
    subject: armado.asunto, html: armado.html, text: armado.txt,
    headers: { 'List-Unsubscribe': `<${baja}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  };
}

async function resend(ruta, cuerpo, idem) {
  const cab = { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' };
  if (idem) cab['Idempotency-Key'] = idem;
  const r = await fetch('https://api.resend.com' + ruta, {
    method: 'POST', headers: cab, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(15000) });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Resend ${r.status}: ${texto.slice(0, 300)}`);
  return texto;
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Solo POST' });
  if (!claveValida(req)) {
    console.warn('boletin: clave inválida o ausente');
    return json(401, { error: 'Clave inválida o ausente' });
  }
  let d;
  try { d = JSON.parse((await req.text()) || '{}'); } catch (_) { return json(400, { error: 'JSON inválido' }); }
  const campana = CAMPANAS[d.campana];
  if (!campana) return json(400, { error: 'Campaña desconocida', campanas: Object.keys(CAMPANAS) });
  if (!['vista', 'prueba', 'enviar'].includes(d.modo)) return json(400, { error: 'modo: vista, prueba o enviar' });
  if (!configurado()) return json(503, { error: 'Falta SUSCRIPCION_SECRETO: sin él no hay enlaces de baja' });
  if (d.modo !== 'vista' && !process.env.RESEND_API_KEY) return json(503, { error: 'Falta RESEND_API_KEY' });

  let disp;
  try { disp = await leerDisponibilidad(); } catch (e) { return json(502, { error: 'No se pudo leer la disponibilidad: ' + e.message }); }
  const problemas = verificarReglas(campana, disp);
  if (problemas.length) return json(409, { error: 'El texto ya no coincide con el sitio', problemas });
  const sel = seleccionar(campana, disp);
  const resumenPiezas = {
    anillos: sel.anillos.map(a => `${a.nombre} (${a.tallas.join(', ')})`), charms: sel.charms.map(c => c.nombre),
    brazaletes: sel.brazaletes.map(b => b.nombre), volvieron: sel.volvieron.map(v => v.nombre), signos: sel.signos.length,
    omitidasPorAgotadas: sel.omitidas, disponibilidadGenerada: disp.generado,
  };

  if (d.modo === 'vista') {
    const lista = await confirmadas({ conBeneficio: true });
    const muestra = 'https://zephoracharms.com/suscribir?baja=EJEMPLO';
    return json(200, {
      asunto: campana.asunto, remitente: desde(), responderA: responderA(),
      destinatarias: lista ? lista.length : null, conDescuento: lista ? lista.filter(s => s.descuentoDisponible).length : null,
      piezas: resumenPiezas,
      conDescuento_html: armar(campana, sel, { baja: muestra, descuento: true }).html,
      sinDescuento_txt: armar(campana, sel, { baja: muestra, descuento: false }).txt,
    });
  }

  if (d.modo === 'prueba') {
    const para = normalizar(d.para);
    if (!correoValido(para)) return json(400, { error: 'Falta `para` o no es un correo válido' });
    const salida = [];
    for (const descuento of [true, false]) {
      const baja = enlaceBaja(para);
      const a = armar(campana, sel, { baja, descuento });
      a.asunto = `[Prueba${descuento ? ' · con $15.000' : ' · sin $15.000'}] ${a.asunto}`;
      try { await resend('/emails', mensaje(para, a, baja)); salida.push({ descuento, enviado: true }); }
      catch (e) { salida.push({ descuento, enviado: false, error: e.message }); }
    }
    console.log(JSON.stringify({ evento: 'boletin_prueba', campana: d.campana, salida }));
    return json(salida.every(s => s.enviado) ? 200 : 502, { prueba: salida, piezas: resumenPiezas });
  }

  /* ── enviar ── */
  if (d.confirmo !== 'enviar') return json(400, { error: 'Para mandar a todas hay que pasar confirmo: "enviar"' });
  const reg = almacen();
  const previo = await reg.get(d.campana, { type: 'json' });
  if (previo && previo.estado === 'enviado') return json(409, { error: 'Esta campaña ya se mandó', registro: previo });
  if (previo && previo.estado === 'enviando' && Date.now() - Date.parse(previo.actualizado) < 10 * 60 * 1000)
    return json(409, { error: 'Hay un envío de esta campaña en curso', registro: previo });

  const lista = await confirmadas({ conBeneficio: true });
  if (!lista) return json(503, { error: 'El almacén de suscriptoras no respondió' });
  lista.sort((a, b) => a.correo.localeCompare(b.correo));

  /* Quién ya lo recibió va como hash (no se guardan correos en el registro);
     un reintento salta a esas y la llave de idempotencia sale de quiénes van en
     el lote, así que aunque alguien se dé de baja entre intentos nadie se repite. */
  const huella = c => crypto.createHash('sha256').update(normalizar(c)).digest('hex').slice(0, 24);
  const registro = Object.assign({ campana: d.campana, recibieron: [] }, previo || {},
    { estado: 'enviando', total: lista.length, actualizado: new Date().toISOString() });
  const ya = new Set(registro.recibieron);
  const pendientes = lista.filter(s => !ya.has(huella(s.correo)));
  await reg.setJSON(d.campana, registro);

  const errores = [];
  for (let i = 0; i < pendientes.length; i += LOTE) {
    const grupo = pendientes.slice(i, i + LOTE);
    const lote = grupo.map(s => {
      const baja = enlaceBaja(s.correo);
      return mensaje(s.correo, armar(campana, sel, { baja, descuento: s.descuentoDisponible }), baja);
    });
    const idem = d.campana + '/' + crypto.createHash('sha256').update(grupo.map(s => huella(s.correo)).join(',')).digest('hex').slice(0, 32);
    try {
      await resend('/emails/batch', lote, idem);
      registro.recibieron.push(...grupo.map(s => huella(s.correo)));
    } catch (e) { errores.push({ desde: i, cuantas: grupo.length, error: e.message }); }
    registro.enviados = registro.recibieron.length;
    registro.actualizado = new Date().toISOString();
    await reg.setJSON(d.campana, registro);
  }
  registro.estado = errores.length ? 'incompleto' : 'enviado';
  if (!errores.length) registro.fecha = registro.actualizado;
  await reg.setJSON(d.campana, registro);
  console.log(JSON.stringify({ evento: 'boletin_enviado', campana: d.campana, estado: registro.estado,
    enviados: registro.enviados, total: registro.total, errores: errores.length }));
  return json(errores.length ? 502 : 200, {
    estado: registro.estado, enviados: registro.enviados, total: registro.total,
    conDescuento: lista.filter(s => s.descuentoDisponible).length, errores, piezas: resumenPiezas });
};
