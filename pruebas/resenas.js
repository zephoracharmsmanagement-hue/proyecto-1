'use strict';
/* Reseñas con moderación y «N compraron este mes» (automatizaciones/tienda/ENCARGO-FICHA.md).
 *
 * Reglas de verdad que se vigilan: nada se publica sin aprobar; el promedio
 * sale de las aprobadas; «Compra verificada» solo con enlace firmado de un
 * pedido real que contiene la pieza; el conteo de compras solo cuenta pedidos
 * que de verdad salieron y no dice nada por debajo de 3.
 */
let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));
const copia = v => (v == null ? v : JSON.parse(JSON.stringify(v)));

function almacenBinario() {
  const d = {};
  return { async set(k, v) { d[k] = v.slice(0); }, async get(k) { return d[k] ? d[k].slice(0) : null; } };
}

function almacen() {
  const d = {};
  return {
    async get(k) { return d[k] ? copia(d[k]) : null; },
    async setJSON(k, v) { d[k] = copia(v); return { modified: true }; },
    async delete(k) { delete d[k]; },
    async list(o = {}) { return { blobs: Object.keys(d).filter(k => !o.prefix || k.startsWith(o.prefix)).map(key => ({ key })) }; },
  };
}

async function main() {
  Object.assign(process.env, { SUSCRIPCION_SECRETO: 'secreto-de-prueba-de-la-suscripcion', RESEND_API_KEY: 're_prueba',
    CORREO_TIENDA: 'tienda@ejemplo.com', URL_SITIO: 'https://tienda.test' });
  const correos = [];
  global.fetch = async (u, op) => { correos.push(JSON.parse(op.body)); return new Response('{}', { status: 200 }); };

  const F = '../netlify/functions/';
  const ped = await import(F + '_pedidos.mjs');
  ped._interno.usarAlmacen(almacen());
  const mod = await import(F + 'resenas.mjs');
  mod._interno.usar(almacen());
  mod._interno.usarMedios(almacenBinario());
  const vend = await import(F + 'vendidas.mjs');

  /* Una IP distinta por petición: el freno de 5 por hora dejaba la sexta en
     429 y una comprobación posterior miraba el correo anterior — verde sin
     probar nada. El freno se prueba aparte, a propósito. */
  let ipN = 0;
  const pedir = (o = {}) => mod.default({ method: o.metodo || 'POST', url: 'https://tienda.test/resenas' + (o.q || ''),
    headers: new Headers(Object.assign({ 'x-forwarded-for': o.ip || '10.0.0.' + (++ipN) }, o.h || {})),
    text: async () => (o.cuerpo ? JSON.stringify(o.cuerpo) : '') });
  const leerJ = async r => ({ s: r.status, d: JSON.parse(await r.text()) });
  const listar = async p => (await leerJ(await pedir({ metodo: 'GET', q: '?producto=' + p }))).d;
  const P = 'mickey-mouse';
  const base = { producto: P, estrellas: 5, texto: 'Hermoso, llegó rápido', nombre: 'Ana', ciudad: 'Cali' };

  console.log('\n1 · Recibir');
  {
    comprobar((await pedir({ cuerpo: Object.assign({}, base, { producto: 'no-existe' }) })).status === 400, 'pieza desconocida → 400');
    comprobar((await pedir({ cuerpo: Object.assign({}, base, { estrellas: 6 }) })).status === 400, '6 estrellas → 400');
    comprobar((await pedir({ cuerpo: Object.assign({}, base, { texto: 'corto' }) })).status === 400, 'texto de menos de 10 letras → 400');
    const n = correos.length;
    comprobar((await pedir({ cuerpo: Object.assign({}, base, { web: 'spam' }) })).status === 200 && correos.length === n,
      'campo trampa → 200 y no se guarda ni se avisa');
    const r = await pedir({ cuerpo: base });
    comprobar(r.status === 200 && correos.length === n + 1 && /moderar=/.test(correos[n].html), 'válida → pendiente, y la tienda recibe los enlaces de moderación');
    comprobar((await listar(P)).total === 0, 'una pendiente NO se ve publicada');
  }

  console.log('\n2 · Moderar');
  const enlaces = html => [...html.matchAll(/moderar=([^"]+)"/g)].map(m => decodeURIComponent(m[1].replace(/&amp;/g, '&')));
  {
    const [aprobar] = enlaces(correos[correos.length - 1].html);
    const malo = aprobar.replace(/\.[^.]+$/, '.firmafalsa');
    const h1 = await (await pedir({ metodo: 'GET', q: '?moderar=' + encodeURIComponent(malo) })).text();
    comprobar(/no válido/.test(h1) && (await listar(P)).total === 0, 'enlace de moderación alterado → no publica');
    const h2 = await (await pedir({ metodo: 'GET', q: '?moderar=' + encodeURIComponent(aprobar) })).text();
    const l = await listar(P);
    comprobar(/publicada/.test(h2) && l.total === 1 && l.promedio === 5 && l.resenas[0].verificada === false,
      'aprobar la publica, sin chulo porque no trae pedido');
    await pedir({ cuerpo: Object.assign({}, base, { estrellas: 2, texto: 'No me gustó el cierre, es flojo', nombre: 'Luz' }) });
    const [, rechazar] = enlaces(correos[correos.length - 1].html);
    await pedir({ cuerpo: Object.assign({}, base, { estrellas: 3, texto: 'Bonito pero más pequeño', nombre: 'Eva' }) });
    const [aprobar3] = enlaces(correos[correos.length - 1].html);
    await pedir({ metodo: 'GET', q: '?moderar=' + encodeURIComponent(rechazar) });
    await pedir({ metodo: 'GET', q: '?moderar=' + encodeURIComponent(aprobar3) });
    const l2 = await listar(P);
    comprobar(l2.total === 2 && l2.promedio === 4 && l2.resenas.some(r => r.estrellas === 3),
      'la de 3 estrellas se publica si se aprueba; la rechazada no; el promedio sale de las aprobadas', `${l2.promedio} · ${l2.total}`);
  }

  console.log('\n3 · Compra verificada');
  {
    await ped.guardar('ZC-260901-AAAA0001', { estado: 'pagado', lineas: [{ id: P, unidades: 1 }] });
    const url = mod.enlaceResena('ZC-260901-AAAA0001', P);
    const token = decodeURIComponent(new URL(url).searchParams.get('resena'));
    comprobar(/producto-mickey-mouse\.html\?resena=/.test(url), 'el enlace de entrega lleva a la página de la pieza');
    await pedir({ cuerpo: Object.assign({}, base, { nombre: 'Sol', resena: token }) });
    const [a] = enlaces(correos[correos.length - 1].html);
    comprobar(/compra verificada/.test(correos[correos.length - 1].subject), 'la tienda ve que es de un pedido real');
    await pedir({ metodo: 'GET', q: '?moderar=' + encodeURIComponent(a) });
    comprobar((await listar(P)).resenas.find(r => r.nombre === 'Sol').verificada === true, 'con enlace firmado de un pedido con esa pieza → chulo');
    await pedir({ cuerpo: Object.assign({}, base, { producto: 'minnie-mouse', nombre: 'Tom', resena: token }) });
    const [b] = enlaces(correos[correos.length - 1].html);
    await pedir({ metodo: 'GET', q: '?moderar=' + encodeURIComponent(b) });
    comprobar((await listar('minnie-mouse')).resenas[0].verificada === false, 'el mismo enlace para una pieza que no estaba en el pedido → sin chulo');
    const n = correos.length;
    const rui = await pedir({ cuerpo: Object.assign({}, base, { nombre: 'Rui', resena: 'ZC-260901-AAAA0001.firmafalsa' }) });
    comprobar(rui.status === 200 && correos.length === n + 1 && /Rui/.test(correos[n].html)
      && !/compra verificada/.test(correos[n].subject), 'firma falsa → sin chulo');
    const codigos = [];
    for (let i = 0; i < 6; i++) codigos.push((await pedir({ ip: '10.9.9.9', cuerpo: Object.assign({}, base, { nombre: 'Rep' + i }) })).status);
    comprobar(codigos.slice(0, 5).every(c => c === 200) && codigos[5] === 429, 'la sexta reseña seguida desde la misma IP → 429', codigos.join(','));
  }

  console.log('\n5 · Todas en cualquier ficha, con fotos y video (ENCARGO-FICHA-2 § 3)');
  {
    // Una reseña de otra pieza sale igual en la ficha de Mickey: una sola
    // lista para toda la tienda (decisión del propietario, 2026-09-26).
    await pedir({ cuerpo: Object.assign({}, base, { producto: 'hulk', nombre: 'Gil', texto: 'El Hulk quedó perfecto en mi pulsera' }) });
    const [aGil] = enlaces(correos[correos.length - 1].html);
    await pedir({ metodo: 'GET', q: '?moderar=' + encodeURIComponent(aGil) });
    const enMickey = await listar(P), sinPieza = (await leerJ(await pedir({ metodo: 'GET' }))).d;
    comprobar(enMickey.resenas.some(r => r.nombre === 'Gil') && sinPieza.total === enMickey.total,
      'la reseña del Hulk también sale en la ficha de Mickey; el conteo es el de la tienda', `${sinPieza.total}`);

    const jpg = 'data:image/jpeg;base64,' + Buffer.from('\xff\xd8\xff\xe0 foto de prueba').toString('base64');
    const mp4 = 'data:video/mp4;base64,' + Buffer.from(new Uint8Array(4000).map((_, i) => i % 256)).toString('base64');
    comprobar((await pedir({ cuerpo: Object.assign({}, base, { fotos: [jpg, jpg, jpg, jpg] }) })).status === 400, '4 fotos → 400');
    comprobar((await pedir({ cuerpo: Object.assign({}, base, { fotos: ['data:text/html;base64,PGI+'] }) })).status === 400, 'algo que no es foto → 400');
    const grande = 'data:video/mp4;base64,' + Buffer.alloc(3.6 * 1024 * 1024).toString('base64');
    comprobar((await pedir({ cuerpo: Object.assign({}, base, { video: grande }) })).status === 400, 'video de más de 3,5 MB → 400 con el tope dicho');

    const r = await pedir({ cuerpo: Object.assign({}, base, { nombre: 'Flor', texto: 'Mira cómo me quedó, me encantó', fotos: [jpg, jpg], video: mp4 }) });
    const correo = correos[correos.length - 1];
    const firmados = [...correo.html.matchAll(/href="([^"]*medio=[^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&'));
    comprobar(r.status === 200 && firmados.length === 3 && /con 3 adjuntos/.test(correo.subject),
      'con 2 fotos y 1 video: el correo trae 3 enlaces para verlos antes de publicar', correo.subject);
    const q = u => '?' + new URL(u).searchParams.toString();
    const sinFirma = u => { const x = new URL(u); x.searchParams.delete('f'); return '?' + x.searchParams.toString(); };
    comprobar((await pedir({ metodo: 'GET', q: sinFirma(firmados[0]) })).status === 404, 'pendiente: la foto NO se ve sin firma');
    const vista = await pedir({ metodo: 'GET', q: q(firmados[0]) });
    comprobar(vista.status === 200 && vista.headers.get('content-type') === 'image/jpeg' && /no-store/.test(vista.headers.get('cache-control')),
      'con el enlace firmado del correo, la tienda la ve (sin caché)');
    const falsa = await pedir({ metodo: 'GET', q: sinFirma(firmados[0]) + '&f=firmafalsa' });
    comprobar(falsa.status === 404, 'firma falsa → 404');

    const [aFlor] = enlaces(correo.html);
    await pedir({ metodo: 'GET', q: '?moderar=' + encodeURIComponent(aFlor) });
    const flor = (await listar('minnie-mouse')).resenas.find(x => x.nombre === 'Flor');
    comprobar(flor && flor.fotos.length === 2 && /^\/resenas\?medio=/.test(flor.fotos[0]) && /^\/resenas\?medio=.*v\.mp4$/.test(decodeURIComponent(flor.video)),
      'aprobada: la lista trae sus 2 fotos y el video');
    const pub = await pedir({ metodo: 'GET', q: '?' + flor.fotos[0].split('?')[1] });
    comprobar(pub.status === 200 && /public/.test(pub.headers.get('cache-control')), 'y la foto ya es pública');
    const trozo = await mod.default({ method: 'GET', url: 'https://tienda.test' + flor.video,
      headers: new Headers({ Range: 'bytes=0-99' }), text: async () => '' });
    comprobar(trozo.status === 206 && trozo.headers.get('content-range') === 'bytes 0-99/4000', 'el video responde por rangos (Safari)');

    await pedir({ cuerpo: Object.assign({}, base, { nombre: 'Noa', texto: 'Foto que no debería salir nunca', fotos: [jpg] }) });
    const cNoa = correos[correos.length - 1];
    const [, rNoa] = enlaces(cNoa.html);
    await pedir({ metodo: 'GET', q: '?moderar=' + encodeURIComponent(rNoa) });
    const fNoa = [...cNoa.html.matchAll(/href="([^"]*medio=[^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&'))[0];
    comprobar((await pedir({ metodo: 'GET', q: sinFirma(fNoa) })).status === 404, 'rechazada: su foto nunca se publica');
    comprobar((await pedir({ metodo: 'GET', q: '?medio=' + encodeURIComponent('../../ESTADO.md') })).status === 404, 'una clave rara → 404');
  }

  console.log('\n4 · «N personas compraron esta pieza este mes»');
  {
    const hoy = Date.now(), hace = d => new Date(hoy - d * 864e5).toISOString();
    ped._interno.usarAlmacen(almacen());
    const alta = (ref, estado, dias, ids, pago) => ped.guardar(ref, { estado, pago, lineas: ids.map(id => ({ id, unidades: 1 })) })
      .then(() => ped.marcar(ref, { creado: hace(dias) }));
    await alta('A1', 'pagado', 2, ['hulk', 'hulk']);          // un pedido, dos unidades: es UNA persona
    await alta('A2', 'confirmado', 5, ['hulk']);
    await alta('A3', 'venta-manual', 10, ['hulk']);
    await alta('A4', 'esperando-pago', 1, ['hulk']);            // no salió: no cuenta
    await alta('A5', 'pagado', 40, ['hulk']);                   // fuera del mes
    await alta('A6', 'pagado', 3, ['iron-man']);
    await alta('A7', 'pagado', 3, ['iron-man']);
    await alta('A8', 'venta-manual', 3, ['iron-man'], 'regalo'); // un regalo no es una compra
    const v = await vend.contar(hoy);
    comprobar(v.hulk === 3, 'cuenta pedidos que salieron en 30 días, uno por persona', JSON.stringify(v));
    comprobar(!('iron-man' in v), 'con 2 no se dice nada (ni el regalo cuenta)');
  }

  console.log(fallos ? `\n${fallos} comprobaciones en rojo.` : '\nTodo en verde.');
}
main().catch(e => console.log('  ✗ FALLA la batería reventó — ' + (e.stack || e.message)));
