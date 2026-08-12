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
    comprobar(/baño de plata/.test(b.material) && !/925/.test(b.material),
      'los brazaletes dicen baño de plata, no 925: confundirlos es publicidad engañosa');

    comprobar(d.piezas.every(x => x.nombre && x.nombre !== x.id),
      'todas las piezas traen nombre legible, no el id');
    comprobar(d.piezas.every(x => typeof x.precio === 'number' && x.precio > 0),
      'y todas traen precio');
    comprobar(d.piezas.some(x => x.familia),
      'traen familia: es lo que distingue un pasador de un clip o una cadena');
  }

  inv._interno.usarAlmacen(null);
  console.log(fallos ? `\nDisponibilidad: ${fallos} en rojo` : '\nDisponibilidad en verde ✓');
}

main().catch(e => { console.log('  ✗ FALLA la batería reventó — ' + e.stack); });
