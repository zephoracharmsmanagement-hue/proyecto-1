'use strict';
/* Purchase server-side hacia Meta: que salga bien, y que salga UNA vez.
 *
 * Esta batería existe por un fallo que no se ve en producción hasta que ya
 * ensució los datos: el pixel de gracias.html ya disparaba `Purchase`, así que
 * añadir el evento de servidor sin deduplicar habría contado dos compras por
 * cada venta. Meta no avisa de eso; simplemente reporta el doble, la pauta
 * optimiza hacia un ROAS inventado, y cuando alguien lo nota lleva semanas
 * decidiendo presupuesto con números falsos.
 *
 * Lo que hay que demostrar aquí:
 *   1. Las dos puntas usan el MISMO event_id — y una de ellas es un archivo
 *      HTML, así que se comprueba leyéndolo.
 *   2. La normalización de Meta se respeta al pie de la letra. Un hash mal
 *      normalizado no da error: da un emparejamiento que falla en silencio.
 *   3. El documento de identidad no sale, ni hasheado.
 *   4. Nada de esto puede tumbar la respuesta a Wompi.
 *
 * Todo corre sin red: el fetch y el almacén se inyectan. Una batería que
 * necesite hablar con Meta para pasar no se corre en cada push, y una que no se
 * corre no comprueba nada.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const RAIZ = path.join(__dirname, '..');
const FUNCIONES = path.join(RAIZ, 'netlify', 'functions');
const capi = require(path.join(FUNCIONES, '_capi.js'));
const crearPago = require(path.join(FUNCIONES, 'crear-pago.js'));
const webhook = require(path.join(FUNCIONES, 'wompi-webhook.js'));

const { armarEvento, usarAlmacen, usarFetch, normCorreo, normTelefono,
  normNombre, normLugar } = capi._interno;

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (cond, m, d) => (cond ? ok(m, d) : mal(m, d));

const sha256 = v => crypto.createHash('sha256').update(v, 'utf8').digest('hex');

/* Imita Netlify Blobs en lo único que _capi.js usa. */
function almacenFalso() {
  const datos = new Map();
  return {
    async setJSON(clave, valor) { datos.set(clave, JSON.parse(JSON.stringify(valor))); return { modified: true }; },
    async get(clave) { return datos.has(clave) ? JSON.parse(JSON.stringify(datos.get(clave))) : null; },
    async delete(clave) { datos.delete(clave); },
    _tamano: () => datos.size,
  };
}

/* Captura lo que se le manda a Meta sin mandárselo. */
function fetchFalso(respuesta) {
  const llamadas = [];
  const fn = async (url, opciones) => {
    llamadas.push({ url, opciones, cuerpo: JSON.parse(opciones.body) });
    if (respuesta instanceof Error) throw respuesta;
    return {
      ok: respuesta.ok !== false,
      status: respuesta.status || 200,
      json: async () => respuesta.json || { events_received: 1 },
    };
  };
  fn.llamadas = llamadas;
  return fn;
}

const CLIENTE = {
  nombre: 'María José', apellido: 'Muñoz Ríos',
  correo: '  Maria.Jose@Gmail.COM ', celular: '3018990672',
  documento: '1019151696', tipodoc: 'CC',
  ciudad: 'Bogotá D.C.', depto: 'Cundinamarca',
};

async function main() {
  console.log('\nNormalización que exige Meta');
  /* Si estas reglas no cuadran con las de Meta, el hash no coincide con el que
     ellos calculan sobre sus propios datos y la clienta no se empareja con
     nadie. No hay error; hay silencio. */
  comprobar(normCorreo('  Ana@Zephora.COM ') === 'ana@zephora.com',
    'correo en minúsculas y sin espacios');
  comprobar(normTelefono('301 899 0672') === '573018990672',
    'celular colombiano con indicativo y sin símbolos');
  comprobar(normTelefono('+57 301 899 0672') === '573018990672',
    'un celular que ya trae indicativo no lo duplica');
  comprobar(normNombre('  Muñoz!  ') === 'muñoz',
    'nombre sin puntuación y con la eñe intacta');
  comprobar(normLugar('Bogotá D.C.') === 'bogotadc',
    'ciudad sin tildes, espacios ni puntos');
  comprobar(normLugar('Medellín') === 'medellin',
    'la tilde de la ciudad no separa a Medellín de sí misma');

  console.log('\nDatos de la clienta');
  const usuario = capi.hashearCliente(CLIENTE);
  comprobar(usuario.em === sha256('maria.jose@gmail.com'),
    'el correo viaja hasheado, no en claro');
  comprobar(usuario.ph === sha256('573018990672'), 'el teléfono viaja hasheado');
  comprobar(usuario.fn === sha256('maría josé'), 'el nombre viaja hasheado');
  comprobar(usuario.country === sha256('co'), 'el país va como código de dos letras');

  /* Lo importante que NO tiene que pasar. El SHA-256 de una cédula se revierte
     por fuerza bruta en segundos —son diez dígitos— así que hashearla no la
     protege, y Meta ni siquiera la usa para emparejar. */
  const hashes = Object.values(usuario);
  comprobar(!hashes.includes(sha256('1019151696')),
    'el documento de identidad no se manda, ni hasheado');
  comprobar(!JSON.stringify(usuario).includes('1019151696'),
    'el documento tampoco aparece en claro');
  comprobar(Object.values(usuario).every(v => typeof v === 'string' && v.length === 64),
    'ningún campo queda en null (Meta rechaza el evento entero si los hay)');

  const parcial = capi.hashearCliente({ correo: 'a@b.co' });
  comprobar(!('ph' in parcial) && !('ct' in parcial),
    'los datos que no se tienen se omiten en vez de ir vacíos');

  console.log('\nForma del evento');
  const evento = armarEvento({
    referencia: 'ZC-260811-ABCD1234',
    valor: 214000, moneda: 'COP',
    cuando: 1786000000000,
    sitio: 'https://zephoracharms.com/gracias.html',
    senales: {
      usuario,
      fbc: 'fb.1.1786000000000.IwAR0abc-DEF',
      fbp: 'fb.1.1786000000000.1234567890',
      ip: '181.49.1.2', ua: 'Mozilla/5.0 (iPhone)',
      contenidos: [{ id: 'acuario', quantity: 2 }, { id: 'mickey-mouse', quantity: 1 }],
    },
  });

  comprobar(evento.event_name === 'Purchase', 'el evento se llama Purchase');
  comprobar(evento.event_id === 'ZC-260811-ABCD1234',
    'el event_id es la referencia del pedido');
  comprobar(evento.custom_data.order_id === 'ZC-260811-ABCD1234',
    'el order_id también, que es la segunda red de deduplicación de Meta');
  comprobar(evento.action_source === 'website',
    'action_source website: esta compra ocurrió en el sitio, no en un chat');
  /* En segundos. Con milisegundos el evento cae en el año 55000 y Meta lo
     descarta sin decir nada, porque solo acepta los últimos siete días. */
  comprobar(evento.event_time === 1786000000,
    'event_time en segundos, no en milisegundos');
  comprobar(evento.custom_data.value === 214000 && evento.custom_data.currency === 'COP',
    'el monto va en pesos con su moneda');
  comprobar(evento.custom_data.num_items === 3,
    'num_items suma unidades, no líneas', String(evento.custom_data.num_items));

  /* Estas cuatro NO se hashean: Meta las necesita en claro, y son justo las que
     el webhook de Wompi jamás vería por su cuenta. */
  comprobar(evento.user_data.fbc === 'fb.1.1786000000000.IwAR0abc-DEF',
    'el fbc del clic en el anuncio va sin hashear');
  comprobar(evento.user_data.fbp && evento.user_data.client_ip_address === '181.49.1.2'
    && evento.user_data.client_user_agent === 'Mozilla/5.0 (iPhone)',
    'fbp, IP y user-agent van sin hashear');

  console.log('\nLa deduplicación, en las dos puntas');
  /* Esta es la comprobación que justifica la batería entera. El otro extremo es
     HTML, así que se lee el archivo: si alguien quita el tercer argumento del
     track, Meta empieza a contar el doble y nada más se entera. */
  const gracias = fs.readFileSync(path.join(RAIZ, 'gracias.html'), 'utf8');
  comprobar(/track\('Purchase',\{[^}]*\},\s*rr\)/.test(gracias),
    'gracias.html pasa la referencia como eventID del Purchase');
  comprobar(/fbq\('track',ev,[^;]*eventID:id/.test(gracias),
    'el track de gracias.html sabe pasar el eventID al pixel');

  const checkout = fs.readFileSync(path.join(RAIZ, 'checkout.html'), 'utf8');
  comprobar(/fbq\('track',ev,[^;]*eventID:id/.test(checkout),
    'el track del checkout sabe pasar el eventID al pixel');
  comprobar(/fbp:cookie\('_fbp'\),\s*fbc:cookie\('_fbc'\)/.test(checkout),
    'el checkout manda las cookies del pixel al servidor');

  console.log('\nSeñales guardadas entre el checkout y el webhook');
  const almacen = almacenFalso();
  usarAlmacen(almacen);

  await capi.guardarSenales('ZC-1', { usuario, fbp: 'fb.1.1.1', total: 99000 });
  comprobar(almacen._tamano() === 1, 'las señales quedan guardadas por referencia');

  const recogidas = await capi.tomarSenales('ZC-1');
  comprobar(recogidas && recogidas.fbp === 'fb.1.1.1', 'se recogen íntegras');
  comprobar(almacen._tamano() === 0,
    'y se borran al recogerlas: un pedido se cobra una vez');
  comprobar(await capi.tomarSenales('ZC-1') === null,
    'recogerlas dos veces no revive nada');
  comprobar(await capi.tomarSenales('ZC-NO-EXISTE') === null,
    'una referencia desconocida no revienta');

  /* Caducadas se tratan como ausentes: nadie barre este almacén y un fbc de
     hace un mes ya no atribuye nada. */
  await almacen.setJSON('ZC-VIEJO', { usuario, vence: Date.now() - 1000 });
  comprobar(await capi.tomarSenales('ZC-VIEJO') === null,
    'unas señales caducadas no se usan');

  console.log('\nEnvío a Meta');
  delete process.env.META_CAPI_TOKEN;
  delete process.env.META_TEST_EVENT_CODE;

  let f = fetchFalso({});
  usarFetch(f);
  let r = await capi.enviarPurchase({ referencia: 'ZC-2', valor: 1000, senales: { usuario } });
  comprobar(r.modo === 'sin-token' && f.llamadas.length === 0,
    'sin token no se llama a Meta, y no es un error');

  process.env.META_CAPI_TOKEN = 'TOKEN-DE-PRUEBA';
  f = fetchFalso({});
  usarFetch(f);
  r = await capi.enviarPurchase({
    referencia: 'ZC-3', valor: 214000, cuando: 1786000000000, senales: { usuario },
  });
  comprobar(r.ok && r.modo === 'enviado', 'con token, el evento sale', r.modo);
  comprobar(f.llamadas.length === 1, 'se llama a Meta una sola vez');
  comprobar(/\/v\d+\.\d+\/\d+\/events$/.test(f.llamadas[0].url),
    'contra el endpoint de eventos del dataset', f.llamadas[0].url);
  /* El token en la URL termina en logs, trazas y mensajes de error. */
  comprobar(!f.llamadas[0].url.includes('TOKEN-DE-PRUEBA'),
    'el token NO viaja en la URL');
  comprobar(f.llamadas[0].cuerpo.access_token === 'TOKEN-DE-PRUEBA',
    'el token viaja en el cuerpo');
  comprobar(!('test_event_code' in f.llamadas[0].cuerpo),
    'sin código de prueba, el evento cuenta como conversión real');

  process.env.META_TEST_EVENT_CODE = 'TEST12345';
  f = fetchFalso({});
  usarFetch(f);
  r = await capi.enviarPurchase({ referencia: 'ZC-4', valor: 1000, senales: { usuario } });
  comprobar(f.llamadas[0].cuerpo.test_event_code === 'TEST12345' && r.modo === 'prueba',
    'con código de prueba el evento va al panel de pruebas y se dice en el modo');
  delete process.env.META_TEST_EVENT_CODE;

  console.log('\nFalla hacia adelante');
  /* Nada de aquí abajo puede lanzar: si lanzara, el webhook devolvería 500 y
     Wompi reintentaría el pago en bucle por culpa de un evento de marketing. */
  f = fetchFalso({ ok: false, status: 400, json: { error: { message: 'Invalid parameter' } } });
  usarFetch(f);
  r = await capi.enviarPurchase({ referencia: 'ZC-5', valor: 1000, senales: { usuario } });
  comprobar(r.ok === false && r.modo === 'rechazado',
    'un rechazo de Meta se registra y no se lanza', r.detalle);

  usarFetch(fetchFalso(Object.assign(new Error('agotado'), { name: 'TimeoutError' })));
  r = await capi.enviarPurchase({ referencia: 'ZC-6', valor: 1000, senales: { usuario } });
  comprobar(r.ok === false && r.modo === 'sin-respuesta',
    'si Meta no responde, se abandona el evento sin lanzar');

  f = fetchFalso({});
  usarFetch(f);
  r = await capi.enviarPurchase({ referencia: 'ZC-7', valor: 1000, senales: null });
  comprobar(r.modo === 'sin-datos' && f.llamadas.length === 0,
    'sin datos de emparejamiento no se manda nada: Meta lo rechazaría igual');

  usarAlmacen({
    async setJSON() { throw new Error('Blobs caído'); },
    async get() { throw new Error('Blobs caído'); },
    async delete() { throw new Error('Blobs caído'); },
  });
  const g = await capi.guardarSenales('ZC-8', { usuario });
  comprobar(g.ok === true && g.modo === 'sin-escritura',
    'con Blobs caído, guardar no tumba la venta');
  comprobar(await capi.tomarSenales('ZC-8') === null,
    'con Blobs caído, recoger devuelve nada sin lanzar');

  console.log('\nLo que aporta cada punta');
  const cp = crearPago._interno;
  /* Estas cookies entran por una URL pública y salen hacia Meta en claro. */
  comprobar(cp.cookiePixel('fb.1.1786000000000.IwAR0abc-DEF') !== null,
    'una cookie del pixel con formato válido se acepta');
  comprobar(cp.cookiePixel('<script>alert(1)</script>') === null,
    'una cadena arbitraria se descarta en vez de mandarse a Meta');
  comprobar(cp.cookiePixel('') === null && cp.cookiePixel(undefined) === null,
    'una cookie ausente no se inventa');
  comprobar(cp.ipCliente({ 'x-nf-client-connection-ip': '181.49.1.2' }) === '181.49.1.2',
    'la IP sale de la cabecera de Netlify');
  comprobar(cp.ipCliente({ 'x-forwarded-for': '181.49.1.2, 10.0.0.1' }) === '181.49.1.2',
    'del x-forwarded-for solo sirve la primera entrada');

  const contenidos = cp.contenidosDe({ base: { id: 'pulsera', talla: '18' },
    charms: ['acuario', 'acuario', 'mickey-mouse'] });
  comprobar(contenidos.length === 3
    && contenidos.find(c => c.id === 'acuario').quantity === 2,
    'los contenidos agrupan por producto y cuentan unidades');
  comprobar(!JSON.stringify(contenidos).includes('|'),
    'la talla no entra: Meta cuenta productos, no unidades de inventario');

  /* Wompi manda el timestamp en segundos. Tratarlo como fecha ISO no da error:
     da una fecha absurda, y Meta descarta el evento sin decir nada. */
  const cuando = webhook._interno.cuandoDelEvento({ timestamp: 1786000000 }, {});
  comprobar(cuando === 1786000000000,
    'el timestamp de Wompi se lee en segundos y se pasa a milisegundos');
  const respaldo = webhook._interno.cuandoDelEvento({}, { finalized_at: '2026-08-11T10:00:00.000Z' });
  comprobar(respaldo === Date.parse('2026-08-11T10:00:00.000Z'),
    'sin timestamp se cae a finalized_at');

  console.log(fallos ? `\n${fallos} comprobación(es) en rojo.` : '\nTodo en verde.');
}

main().catch(e => { console.log('  ✗ FALLA la batería reventó — ' + e.stack); });
