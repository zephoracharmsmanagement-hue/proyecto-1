'use strict';
/* Catálogo y disponibilidad real para el asesor de WhatsApp.
 *
 * Lo que hay que demostrar aquí es una resta, y suena tonto hasta que se piensa
 * en qué pasa si sale mal: el asesor le promete a una clienta por WhatsApp una
 * pieza que ya está apartada por un pago en curso. En el checkout ese error lo
 * corrige una pantalla; por WhatsApp lo corrige una persona pidiendo disculpas.
 *
 * Y hay un segundo caso, menos obvio y más importante: **qué pasa cuando no se
 * puede saber**. Si Blobs no responde, la tentación es devolver el conteo del
 * archivo, que «casi siempre» acierta. Eso es exactamente lo que no debe pasar:
 * un número que parece bueno y no lo es. Sin dato real, no hay número.
 */
const path = require('path');
const RAIZ = path.join(__dirname, '..');

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

/* Imita Netlify Blobs en lo poco que la lectura usa. */
function almacenFalso(estado) {
  return {
    async get() { return estado ? JSON.parse(JSON.stringify(estado)) : null; },
    async getWithMetadata() { return estado ? { data: estado, etag: 'e1' } : null; },
    async setJSON() { return { modified: true }; },
    async delete() {},
  };
}

async function pedir() {
  const mod = await import('../netlify/functions/disponibilidad.mjs');
  const r = await mod.default();
  return { r, d: JSON.parse(await r.text()) };
}

async function main() {
  const inv = await import('../netlify/functions/_inventario.mjs');
  const { reglas, inventario: stock } = require(path.join(RAIZ, 'netlify', 'functions', '_precios.js'));
  const items = stock.items;

  /* Una pieza y un brazalete reales sobre los que montar los casos. */
  const idCharm = Object.keys(items).find(k => !items[k].tallas && items[k].stock >= 2);
  /* Con dos tallas o más a propósito: el caso que importa es que apartar una
     talla no toque las otras, y con un brazalete de talla única esa
     comprobación se saltaría sin decir nada. */
  const idPulsera = Object.keys(items).find(k => items[k].tallas
    && Object.keys(items[k].tallas).length > 1);
  const tallas = Object.keys(items[idPulsera].tallas);
  const talla = tallas.find(t => items[idPulsera].tallas[t] > 0) || tallas[0];

  console.log('\n1 · Sin almacén no se inventa un número');
  inv._interno.usarAlmacen(null);
  {
    const { r, d } = await pedir();
    comprobar(d.fuente === 'solo-conteo', 'se marca la fuente como solo el conteo', d.fuente);
    const p = d.piezas.find(x => x.id === idCharm);
    comprobar(p.disponible === null && p.agotado === null,
      'la disponibilidad va en null, no con las existencias en bruto');
    comprobar(/[Cc]onfirmar/.test(d.aviso),
      'y el aviso le dice al asesor que confirme antes de prometer');
    comprobar(r.headers.get('Cache-Control').includes('max-age=60'),
      'se cachea un minuto: ni golpear Blobs en cada pregunta ni ofrecer lo agotado toda la tarde');
  }

  console.log('\n2 · Con almacén, la resta');
  inv._interno.usarAlmacen(almacenFalso({ v: 1, vendido: {}, reservas: {} }));
  {
    const { d } = await pedir();
    comprobar(d.fuente === 'conteo-menos-apartado', 'se marca que el dato es real', d.fuente);
    const p = d.piezas.find(x => x.id === idCharm);
    comprobar(p.disponible === items[idCharm].stock,
      'sin nada apartado, disponible es el conteo entero',
      `${p.disponible} de ${items[idCharm].stock}`);
  }

  {
    /* Una clienta con un pago en curso: la unidad está apartada, no vendida,
       y aun así el asesor no puede prometerla. */
    inv._interno.usarAlmacen(almacenFalso({
      v: 1, vendido: {},
      reservas: { 'ZC-1': { items: { [idCharm]: 1 }, vence: Date.now() + 60000 } },
    }));
    const { d } = await pedir();
    const p = d.piezas.find(x => x.id === idCharm);
    comprobar(p.disponible === items[idCharm].stock - 1,
      'lo apartado por un pago en curso NO se ofrece',
      `${p.disponible} de ${items[idCharm].stock}`);
  }

  {
    inv._interno.usarAlmacen(almacenFalso({
      v: 1, vendido: { [idCharm]: 1 }, reservas: {},
    }));
    const { d } = await pedir();
    const p = d.piezas.find(x => x.id === idCharm);
    comprobar(p.disponible === items[idCharm].stock - 1, 'lo vendido tampoco');
  }

  {
    /* Una reserva caducada ya no bloquea: la clienta abandonó el checkout y la
       unidad volvió al mostrador aunque nadie haya escrito en el blob. */
    inv._interno.usarAlmacen(almacenFalso({
      v: 1, vendido: {},
      reservas: { 'ZC-VIEJA': { items: { [idCharm]: 1 }, vence: Date.now() - 60000 } },
    }));
    const { d } = await pedir();
    const p = d.piezas.find(x => x.id === idCharm);
    comprobar(p.disponible === items[idCharm].stock,
      'una reserva caducada no bloquea la venta');
  }

  {
    /* Nunca negativo: si el conteo se corrigió a la baja después de vender,
       la resta se pasa de cero y «quedan -1» no significa nada para nadie. */
    inv._interno.usarAlmacen(almacenFalso({
      v: 1, vendido: { [idCharm]: 999 }, reservas: {},
    }));
    const { d } = await pedir();
    const p = d.piezas.find(x => x.id === idCharm);
    comprobar(p.disponible === 0 && p.agotado === true,
      'la disponibilidad nunca baja de cero, y se marca agotado');
  }

  console.log('\n3 · Brazaletes: la talla es lo que se vende');
  {
    inv._interno.usarAlmacen(almacenFalso({
      v: 1, vendido: {},
      reservas: { 'ZC-2': { items: { [`${idPulsera}|${talla}`]: 1 }, vence: Date.now() + 60000 } },
    }));
    const { d } = await pedir();
    const b = d.brazaletes.find(x => x.id === idPulsera);
    comprobar(b.tallas[talla] === items[idPulsera].tallas[talla] - 1,
      'la talla apartada baja solo ella',
      `talla ${talla}: ${b.tallas[talla]}`);
    const otra = tallas.find(t => t !== talla);
    comprobar(b.tallas[otra] === items[idPulsera].tallas[otra],
      'y las demás tallas del mismo brazalete no se tocan',
      `talla ${otra}: ${b.tallas[otra]}`);
  }

  console.log('\n4 · Lo que el asesor necesita para no mentir');
  {
    inv._interno.usarAlmacen(almacenFalso({ v: 1, vendido: {}, reservas: {} }));
    const { d } = await pedir();

    comprobar(d.piezas.length + d.brazaletes.length === Object.keys(items).length,
      'sale el catálogo entero', `${d.piezas.length} piezas + ${d.brazaletes.length} brazaletes`);

    /* Las reglas viajan con el catálogo para que el asesor no tenga una copia
       propia que se desincronice del checkout que cobra. */
    comprobar(JSON.stringify(d.reglas) === JSON.stringify(reglas),
      'las reglas de precio son las mismas con las que cobra el checkout');

    /* El error de marca que más caro sale: decir que todo es plata. */
    const p = d.piezas[0];
    const b = d.brazaletes[0];
    comprobar(/Plata Esterlina 925/.test(p.material),
      'los charms dicen Plata Esterlina 925');
    /* Invertida dos veces. El 2026-09-18 se dio por bueno que los brazaletes
       también eran 925; el 2026-09-22 se revirtió, porque el dato del
       proveedor era erróneo. Que esta guarda haya cambiado de sentido dos
       veces es justo la razón de que exista: el material que el bot le dice a
       la clienta no puede quedar a la deriva. */
    comprobar(/baño de plata/i.test(b.material) && !/925/.test(b.material),
      'los brazaletes dicen baño de plata, NO 925');

    comprobar(d.piezas.every(x => x.nombre && x.nombre !== x.id),
      'todas las piezas traen nombre legible, no el id');
    comprobar(d.piezas.every(x => typeof x.precio === 'number' && x.precio > 0),
      'y todas traen precio');
    comprobar(d.piezas.some(x => x.familia),
      'traen familia: es lo que distingue un pasador de un clip o una cadena');
  }

  /* ── La foto que el bot de WhatsApp le manda a la clienta ──
   *
   * Dos formas de fallar, y ninguna da error hasta que la clienta pide ver la
   * pieza:
   *
   *   · Una pieza sin foto deja al bot describiendo con palabras algo que la
   *     clienta pidió ver. Se cuela solo con añadir una pieza nueva al catálogo
   *     y olvidar la tarjeta en index.html.
   *   · Una URL que termine en .webp la rechaza la Cloud API de WhatsApp, que
   *     solo acepta JPEG y PNG. Basta con que alguien «simplifique» la URL
   *     quitándole el paso por /.netlify/images.
   */
  {
    const { d } = await pedir();
    const todas = d.piezas.concat(d.brazaletes);

    comprobar(todas.every(x => typeof x.foto === 'string' && x.foto),
      `las ${todas.length} piezas traen foto`,
      todas.filter(x => !x.foto).map(x => x.id).join(', ') || undefined);

    comprobar(todas.every(x => !x.foto || /[?&]fm=jpg(&|$)/.test(x.foto)),
      'la foto se pide en JPEG: WhatsApp rechaza webp en un mensaje de imagen');

    comprobar(todas.every(x => !x.foto || !/\.webp(\?|$)/.test(x.foto)),
      'y ninguna URL termina en .webp, que es lo que serviría el asset crudo');

    comprobar(todas.every(x => !x.foto || /^https:\/\//.test(x.foto)),
      'son URL absolutas y públicas: Meta las descarga desde sus servidores');
  }

  /* El grupo: con él el asesor ofrece algo parecido cuando lo pedido está
     agotado, y el prompt se lo pide pieza por pieza. Estuvo una semana sin
     llegar a producción —el cambio se quedó en una rama— y nada lo notó,
     porque esta batería no lo miraba. */
  {
    const { d } = await pedir();
    const todas = d.piezas.concat(d.brazaletes);
    const sin = todas.filter(x => !x.grupo).map(x => x.id);
    comprobar(sin.length === 0, `las ${todas.length} piezas traen grupo`,
      sin.slice(0, 8).join(', ') || undefined);
    comprobar(d.brazaletes.every(x => x.grupo === 'Brazaletes'),
      'un brazalete se agrupa con los brazaletes');
    comprobar(d.piezas.filter(x => x.id.startsWith('letra-')).every(x => x.grupo === 'Letras'),
      'una inicial se agrupa con las iniciales');
    comprobar(d.piezas.some(x => x.grupo === 'Marvel') && d.piezas.some(x => x.grupo === 'Disney'),
      'los charms traen el grupo de la tienda (Marvel, Disney…)');
  }

  /* ── Filtros para el asesor (2026-11-19) ──
     Medido en el flujo de n8n: el catálogo entero (~50 KB, ~26.000 tokens)
     se arrastraba en cada vuelta del agente dentro del mismo mensaje y
     multiplicaba el costo de cada respuesta. Con filtro, el asesor pide solo
     lo que la clienta nombró. La regla que no se rompe: sin parámetros, la
     respuesta es la de siempre, porque el nodo de n8n no manda nada hasta que
     se cambie después de desplegar esto. */
  inv._interno.usarAlmacen(almacenFalso({ v: 1, vendido: {}, reservas: {} }));
  const pedirCon = async (qs) => {
    const mod = await import('../netlify/functions/disponibilidad.mjs');
    const r = await mod.default(new Request('https://zephoracharms.com/.netlify/functions/disponibilidad' + qs));
    const texto = await r.text();
    return { r, d: JSON.parse(texto), largo: texto.length };
  };
  const sinFecha = d => JSON.stringify(Object.assign({}, d, { generado: null }));
  const TOTAL = Object.keys(items).length;
  const tam = {};

  console.log('\n8 · Filtros: sin parámetros, la respuesta de siempre');
  {
    const { d, largo } = await pedirCon('');
    tam['sin parámetros'] = largo;
    comprobar(JSON.stringify(Object.keys(d)) === JSON.stringify(['generado', 'fuente', 'reglas', 'aviso', 'piezas', 'brazaletes']),
      'las mismas claves y en el mismo orden, sin total/devueltas/filtro', Object.keys(d).join(','));
    comprobar(d.piezas.length + d.brazaletes.length === TOTAL, `el catálogo entero (${TOTAL})`);
    const { d: sinReq } = await pedir();
    comprobar(sinFecha(d) === sinFecha(sinReq), 'idéntica a la que sale sin petición (el camino de siempre)');
    const { d: vacios } = await pedirCon('?grupo=&ids=&q=&tipo=&utm_source=x');
    comprobar(sinFecha(vacios) === sinFecha(d),
      'parámetros vacíos o ajenos (una utm) no cuentan como filtro');
  }

  console.log('\n9 · ?grupo=Marvel');
  {
    const { d, largo } = await pedirCon('?grupo=Marvel');
    tam['grupo=Marvel'] = largo;
    const todas = d.piezas.concat(d.brazaletes);
    const marvel = Object.keys(items).filter(id => d && require(path.join(RAIZ, 'netlify', 'functions', '_precios.js')).grupos[id] === 'Marvel').length;
    comprobar(todas.length === marvel && todas.every(x => x.grupo === 'Marvel'),
      `${marvel} piezas, todas de Marvel`, `${todas.length}`);
    comprobar(d.reglas && d.fuente && d.aviso, 'reglas, fuente y aviso siguen yendo');
    comprobar(d.total === TOTAL && d.devueltas === todas.length && d.recortado === false,
      'total del catálogo, devueltas y recortado: false', `${d.total}/${d.devueltas}/${d.recortado}`);
    comprobar(d.filtro && d.filtro.grupo === 'Marvel' && d.filtro.ids === null && d.filtro.q === null && d.filtro.tipo === null,
      'filtro dice qué se aplicó', JSON.stringify(d.filtro));
    const { d: min } = await pedirCon('?grupo=marvel');
    comprobar(min.devueltas === d.devueltas, 'el grupo no distingue mayúsculas');
    const { d: sim } = await pedirCon('?grupo=simbolos');
    comprobar(sim.devueltas > 0 && sim.piezas.every(x => x.grupo === 'Símbolos'), 'ni tildes (simbolos → Símbolos)', `${sim.devueltas}`);
  }

  console.log('\n10 · ?ids=letra-m');
  {
    const { d, largo } = await pedirCon('?ids=letra-m');
    tam['ids=letra-m'] = largo;
    comprobar(d.piezas.length === 1 && d.piezas[0].id === 'letra-m' && d.brazaletes.length === 0,
      'una sola pieza, la pedida');
    comprobar(d.devueltas === 1 && d.total === TOTAL, 'devueltas 1, total el catálogo entero', `${d.devueltas}/${d.total}`);
    const { d: varios } = await pedirCon(`?ids=letra-m,${idPulsera},no-existe`);
    comprobar(varios.devueltas === 2 && varios.brazaletes.some(x => x.id === idPulsera),
      'varios ids separados por coma, y un id que no existe simplemente no sale', `${varios.devueltas}`);
  }

  console.log('\n11 · ?q= sin tildes ni mayúsculas');
  {
    const { d: a, largo } = await pedirCon('?q=LIBELULA');
    tam['q=LIBELULA'] = largo;
    const { d: b } = await pedirCon('?q=' + encodeURIComponent('libélula'));
    const ids = x => x.piezas.concat(x.brazaletes).map(p => p.id).join(',');
    comprobar(a.devueltas > 0 && ids(a) === ids(b), 'LIBELULA y libélula dan lo mismo', ids(a));
    const { d: g } = await pedirCon('?q=disney');
    comprobar(g.devueltas > 0 && g.piezas.every(x => x.grupo === 'Disney' || /disney/i.test(x.nombre)),
      'q también busca en el grupo', `${g.devueltas}`);
  }

  console.log('\n12 · ?grupo=NoExiste');
  {
    const { r, d, largo } = await pedirCon('?grupo=NoExiste');
    tam['grupo=NoExiste'] = largo;
    comprobar(r.status === 200, '200, no un error: el asesor tiene que poder decir «no encontré eso»', `${r.status}`);
    comprobar(Array.isArray(d.piezas) && d.piezas.length === 0 && Array.isArray(d.brazaletes) && d.brazaletes.length === 0
      && d.devueltas === 0 && d.total === TOTAL, 'listas vacías, devueltas 0 y total completo');
    comprobar(d.reglas && d.aviso, 'y aun así van reglas y aviso');
  }

  console.log('\n13 · Más de 40 → se recorta');
  {
    const { d, largo } = await pedirCon('?tipo=charm');
    tam['tipo=charm (recortado)'] = largo;
    comprobar(d.piezas.length + d.brazaletes.length === 40 && d.devueltas === 40 && d.recortado === true,
      'un filtro abierto devuelve 40 y recortado: true', `${d.devueltas}/${d.recortado}`);
    const { d: br, largo: lb } = await pedirCon('?tipo=brazalete');
    tam['tipo=brazalete'] = lb;
    comprobar(br.piezas.length === 0 && br.brazaletes.length > 0 && br.brazaletes.length <= 40,
      'tipo=brazalete: solo brazaletes', `${br.brazaletes.length}`);
    const { d: mx } = await pedirCon('?grupo=Marvel&tipo=brazalete');
    comprobar(mx.devueltas === 0, 'tipo restringe lo demás: Marvel y brazalete no se cruzan', `${mx.devueltas}`);
    const { d: uni } = await pedirCon('?grupo=Pixar&ids=letra-m');
    const pixar = Object.keys(items).filter(id => require(path.join(RAIZ, 'netlify', 'functions', '_precios.js')).grupos[id] === 'Pixar').length;
    comprobar(uni.devueltas === pixar + 1, 'grupo, ids y q se suman (O): Pixar más la letra M', `${uni.devueltas}`);
    const { d: largoQ } = await pedirCon('?q=' + 'a'.repeat(500));
    comprobar(largoQ.filtro.q.length <= 60, 'un q kilométrico se recorta antes de devolverse', `${largoQ.filtro.q.length}`);
  }

  console.log('\n14 · Blobs caído y con filtro');
  inv._interno.usarAlmacen(null);
  {
    const { d, largo } = await pedirCon('?grupo=Marvel');
    tam['grupo=Marvel sin Blobs'] = largo;
    comprobar(d.fuente === 'solo-conteo' && /[Cc]onfirmar/.test(d.aviso), 'fuente solo-conteo y el aviso de confirmar');
    comprobar(d.piezas.length > 0 && d.piezas.every(x => x.disponible === null && x.agotado === null),
      'sin número de disponibilidad, igual que sin filtro');
  }

  console.log('\nTamaño de la respuesta por caso (caracteres):');
  Object.entries(tam).forEach(([k, v]) => console.log(`    ${k.padEnd(26)} ${v}`));

  inv._interno.usarAlmacen(null);
  console.log(fallos ? `\nDisponibilidad: ${fallos} en rojo` : '\nDisponibilidad en verde ✓');
}

main().catch(e => { console.log('  ✗ FALLA la batería reventó — ' + e.stack); });
