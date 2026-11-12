'use strict';
/* Correos de novedades (netlify/functions/boletin.mjs + _boletin.mjs).
 *
 * Con almacenes falsos y Resend/disponibilidad simulados: nadie recibe nada.
 * Lo que no puede fallar: sin clave no hay nada; «vista» y «prueba» nunca
 * tocan la lista; cada correo lleva SU enlace de baja y la cabecera de baja con
 * un clic; los $15.000 solo a quien no los usó; lo agotado no sale; si la promo
 * del sitio cambió no se arma; una campaña no se manda dos veces; y la baja
 * con un clic (POST) borra a la persona.
 */
let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));
const copia = v => (v == null ? v : JSON.parse(JSON.stringify(v)));

function almacen() {
  const d = {};
  return {
    d,
    async get(k) { return d[k] ? copia(d[k]) : null; },
    async setJSON(k, v) { d[k] = copia(v); return { modified: true }; },
    async delete(k) { delete d[k]; },
    async list() { return { blobs: Object.keys(d).map(key => ({ key })) }; },
  };
}

const foto = id => `https://zephoracharms.com/.netlify/images?url=%2Fassets%2Fhd%2F${id}.webp&fm=jpg&w=800`;
const pieza = (id, nombre, precio, disponible) => ({ id, nombre, precio, foto: foto(id), tipo: 'charm', material: 'Plata Esterlina 925', disponible, agotado: disponible <= 0 });
function disponibilidad() {
  const piezas = [];
  for (const m of [['anillo-corazon-elevado-blanco', 'Anillo Corazón Elevado Blanco'], ['anillo-corazon-elevado-rojo', 'Anillo Corazón Elevado Rojo'], ['anillo-doble-corazon', 'Anillo Doble Corazón']])
    for (const t of [5, 6, 7, 8]) piezas.push(pieza(`${m[0]}-t${t}`, `${m[1]} · Talla ${t}`, 115000, t === 8 && m[0] === 'anillo-doble-corazon' ? 0 : 2));
  piezas.push(pieza('black-panther', 'Black Panther', 95000, 3));
  for (const [id, n] of [['virgen-de-fatima', 'Virgen de Fátima'], ['virgen-aparecida', 'Virgen Aparecida'], ['simbolo-de-la-medicina', 'Símbolo de la Medicina'],
    ['maquina-de-coser', 'Máquina de Coser'], ['graduacion-diploma-y-flores', 'Graduación con Diploma y Flores'], ['brindis-cheers', 'Brindis Cheers']])
    piezas.push(pieza(id, n, 94000, 2));
  piezas.push(pieza('mano-rock-y-guitarra', 'Mano Rock y Guitarra', 94000, 0));        // agotada: no sale
  for (const [id, n, u] of [['minnie-mouse', 'Minnie Mouse', 1], ['walle', 'WALL·E', 2], ['avion-globo-y-pasaporte', 'Avión, Globo y Pasaporte', 2], ['torre-eiffel-y-camara', 'Torre Eiffel y Cámara', 3]])
    piezas.push(pieza(id, n, 82000, u));
  for (const s of ['aries', 'tauro', 'geminis', 'cancer', 'leo', 'virgo', 'libra', 'escorpio', 'sagitario', 'capricornio', 'acuario', 'piscis'])
    piezas.push(pieza(s, s[0].toUpperCase() + s.slice(1), 86000, 3));
  const braz = (id, nombre, tallas) => ({ id, nombre, precio: 82000, foto: foto(id), tipo: 'brazalete', material: 'baño de plata sobre base de alta resistencia', tallas, agotado: !Object.values(tallas).some(n => n > 0) });
  return {
    generado: new Date().toISOString(),
    reglas: { promo: { tramos: [[4, 1], [6, 2]] }, envioGratisDesde: 0, envioGratisSoloAnticipado: true, envio: { anticipado: 15000, contraentrega: 20000 } },
    piezas,
    brazaletes: [braz('pulsera-corazon-abierto', 'Pulsera Corazón Abierto', { 19: 1 }), braz('pulsera-corazon-infinito', 'Pulsera Corazón Infinito', { 19: 0 }),
      braz('pulsera-corazon-arbol-de-la-vida', 'Pulsera Corazón Árbol de la Vida', { 18: 1, 20: 1 })],
  };
}

async function main() {
  Object.assign(process.env, {
    SUSCRIPCION_SECRETO: 'secreto-de-prueba-de-la-suscripcion', BOLETIN_KEY: 'clave-del-boletin-de-prueba-32c',
    RESEND_API_KEY: 're_prueba', CORREO_TIENDA: 'tienda@ejemplo.com', URL_SITIO: 'https://tienda.test',
  });
  delete process.env.SUSCRIPTORES_KEY;

  let disp = disponibilidad();
  let resendFalla = false;
  const llamadas = [];
  global.fetch = async (url, op = {}) => {
    url = String(url);
    if (url.endsWith('/.netlify/functions/disponibilidad')) return new Response(JSON.stringify(disp), { status: 200 });
    if (url.startsWith('https://api.resend.com')) {
      llamadas.push({ ruta: url.slice(22), cuerpo: JSON.parse(op.body), idem: op.headers['Idempotency-Key'] });
      if (resendFalla) return new Response('{"message":"caído"}', { status: 500 });
      return new Response('{"data":[]}', { status: 200 });
    }
    throw new Error('fetch inesperado ' + url);
  };

  const F = '../netlify/functions/';
  const sus = await import(F + '_suscriptores.mjs');
  const subs = almacen(), reg = almacen();
  sus._interno.usar(subs);
  const boletin = await import(F + 'boletin.mjs');
  boletin._interno.usarAlmacen(reg);
  const suscribir = await import(F + 'suscribir.mjs');

  await sus.confirmarSuscripcion('ana@ejemplo.com');
  await sus.confirmarSuscripcion('bea@ejemplo.com');
  await sus.confirmarSuscripcion('caro@ejemplo.com');
  const kBea = Object.keys(subs.d).find(k => subs.d[k].correo === 'bea@ejemplo.com');
  subs.d[kBea].regaloUsado = 'ZC-PRUEBA-1';                          // Bea ya usó los $15.000

  const pedir = (cuerpo, clave = process.env.BOLETIN_KEY) => boletin.default({
    method: 'POST', url: 'https://tienda.test/.netlify/functions/boletin',
    headers: new Headers(clave ? { 'x-zephora-automation-key': clave } : {}), text: async () => JSON.stringify(cuerpo) });
  const leer = async r => ({ s: r.status, d: JSON.parse(await r.text()) });
  const C = 'novedades-2026-11-01';

  console.log('\n1 · Clave');
  comprobar((await pedir({ campana: C, modo: 'vista' }, null)).status === 401, 'sin clave → 401');
  comprobar((await pedir({ campana: C, modo: 'vista' }, 'x'.repeat(31))).status === 401, 'clave equivocada → 401');

  console.log('\n2 · Vista');
  {
    const r = await leer(await pedir({ campana: C, modo: 'vista' }));
    comprobar(r.s === 200 && llamadas.length === 0, 'vista no manda nada');
    comprobar(r.d.destinatarias === 3 && r.d.conDescuento === 2, 'cuenta 3 destinatarias, 2 con descuento', `${r.d.destinatarias}/${r.d.conDescuento}`);
    comprobar(!JSON.stringify(r.d).includes('ana@ejemplo.com'), 'la vista no expone correos');
    const h = r.d.conDescuento_html;
    comprobar(!h.includes('Mano Rock'), 'la charm agotada no aparece');
    comprobar(!h.includes('Corazón Infinito'), 'el brazalete sin tallas no aparece');
    comprobar(r.d.piezas.anillos.includes('Anillo Doble Corazón (5, 6, 7)'), 'la talla agotada de un anillo no se ofrece', r.d.piezas.anillos.join(' | '));
    comprobar(h.includes('$115.000') && h.includes('$95.000') && h.includes('$20.000'), 'precios y contraentrega salen de disponibilidad');
    comprobar(h.includes('&amp;fm=jpg') && !/\.webp"/.test(h), 'fotos en JPG del CDN');
    comprobar(!/todo es plata/i.test(h) && h.includes('Con baño de plata.'), 'brazaletes: baño de plata, nunca «todo es plata»');
    comprobar(h.includes('NIT 1.019.151.696-3') && h.includes('573018990672'), 'pie con NIT y WhatsApp');
    comprobar(h.includes('Última unidad') || h.includes('Quedan 2'), 'unidades bajas a la vista');
  }

  console.log('\n3 · Prueba');
  {
    llamadas.length = 0;
    const r = await leer(await pedir({ campana: C, modo: 'prueba', para: 'dueña@ejemplo.com' }));
    comprobar(r.s === 200 && llamadas.length === 2, 'prueba manda 2 correos (con y sin $15.000)', String(llamadas.length));
    comprobar(llamadas.every(l => l.cuerpo.to.length === 1 && l.cuerpo.to[0] === 'dueña@ejemplo.com'), 'solo a la dirección de prueba');
    comprobar(llamadas.every(l => l.cuerpo.subject.startsWith('[Prueba')), 'asunto marcado como prueba');
    comprobar(llamadas[0].cuerpo.from === 'Zephora Charms <novedades@zephoracharms.com>', 'remitente novedades@');
    comprobar(!reg.d[C], 'la prueba no marca la campaña como enviada');
    comprobar((await pedir({ campana: C, modo: 'prueba' })).status === 400, 'prueba sin `para` → 400');
  }

  console.log('\n4 · La promo cambió → no se arma');
  {
    disp = disponibilidad(); disp.reglas.promo.tramos = [[3, 1]];
    const r = await leer(await pedir({ campana: C, modo: 'vista' }));
    comprobar(r.s === 409 && r.d.problemas.length, 'promo distinta → 409', JSON.stringify(r.d.problemas));
    disp = disponibilidad();
  }

  console.log('\n5 · Enviar');
  {
    llamadas.length = 0;
    comprobar((await pedir({ campana: C, modo: 'enviar' })).status === 400 && !llamadas.length, 'sin confirmo:"enviar" → 400 y nada sale');
    const r = await leer(await pedir({ campana: C, modo: 'enviar', confirmo: 'enviar' }));
    comprobar(r.s === 200 && r.d.enviados === 3 && r.d.estado === 'enviado', 'manda a las 3 confirmadas', JSON.stringify(r.d).slice(0, 120));
    const lote = llamadas.find(l => l.ruta === '/emails/batch');
    comprobar(lote && lote.idem && lote.idem.startsWith(C + '/'), 'lote con Idempotency-Key');
    const por = Object.fromEntries(lote.cuerpo.map(m => [m.to[0], m]));
    const bajas = new Set();
    for (const [correo, m] of Object.entries(por)) {
      const lu = m.headers['List-Unsubscribe'].slice(1, -1);
      const token = new URL(lu).searchParams.get('baja');
      comprobar(sus.verificar('baja', token) === correo && m.html.includes(lu.replace(/&/g, '&amp;')) && m.text.includes(lu),
        `${correo}: su propio enlace de baja (HTML, texto y List-Unsubscribe)`);
      comprobar(m.headers['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click', `${correo}: baja con un clic`);
      bajas.add(lu);
    }
    comprobar(bajas.size === 3, 'tres enlaces de baja distintos');
    comprobar(por['ana@ejemplo.com'].html.includes('$15.000 de descuento') && !por['bea@ejemplo.com'].html.includes('$15.000 de descuento'),
      '$15.000 solo a quien no lo usó');
    comprobar(lote.cuerpo.every(m => m.reply_to === 'tienda@ejemplo.com'), 'las respuestas llegan a la tienda');
    llamadas.length = 0;
    const otra = await leer(await pedir({ campana: C, modo: 'enviar', confirmo: 'enviar' }));
    comprobar(otra.s === 409 && !llamadas.length, 'segunda vez → 409 y nadie recibe dos veces');
  }

  console.log('\n6 · Falla a mitad y reintento');
  {
    delete reg.d[C];
    resendFalla = true;
    const r1 = await leer(await pedir({ campana: C, modo: 'enviar', confirmo: 'enviar' }));
    comprobar(r1.s === 502 && r1.d.estado === 'incompleto', 'Resend caído → incompleto, 502');
    resendFalla = false;
    reg.d[C].actualizado = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    const r2 = await leer(await pedir({ campana: C, modo: 'enviar', confirmo: 'enviar' }));
    comprobar(r2.s === 200 && r2.d.enviados === 3, 'el reintento termina el envío');
  }

  console.log('\n7 · Baja con un clic (POST)');
  {
    const token = sus.firmar('baja', 'caro@ejemplo.com');
    const r = await suscribir.default({ method: 'POST', url: `https://tienda.test/suscribir?baja=${encodeURIComponent(token)}`,
      headers: new Headers({ 'content-type': 'application/x-www-form-urlencoded' }), text: async () => 'List-Unsubscribe=One-Click' });
    comprobar(r.status === 200 && !(await sus.leer('caro@ejemplo.com')), 'POST con el enlace de baja la borra');
    const malo = await suscribir.default({ method: 'POST', url: 'https://tienda.test/suscribir?baja=alterado.x',
      headers: new Headers({}), text: async () => '' });
    comprobar(malo.status === 400, 'token alterado → 400');
    const r3 = await leer(await pedir({ campana: C, modo: 'vista' }));
    comprobar(r3.d.destinatarias === 2, 'quien se dio de baja ya no está en la lista');
  }

  console.log(fallos ? `\n${fallos} falla(s)` : '\nTodo en verde');
  process.exit(fallos ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
