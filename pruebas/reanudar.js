'use strict';
/* Retomar un pedido que quedó sin pagar.
 *
 * Lo que hay que demostrar aquí no es que el enlace funcione, sino que **no
 * miente y no cobra dos veces**. Son las dos formas en que esta pieza puede
 * hacer daño:
 *
 *   · Prometer un pedido que ya no se puede despachar. La reserva original
 *     caduca a los 30 minutos y este enlace se abre horas después, así que
 *     «tu pedido sigue guardado» es falso por defecto salvo que se compruebe.
 *   · Armarle un cobro a quien ya pagó. Un correo reenviado, o abierto dos
 *     veces desde el celular, no puede terminar en una segunda pasarela.
 *
 * Y una tercera, más silenciosa: que el pedido siga saliendo en el correo de
 * rescate de mañana aunque la clienta ya lo esté retomando hoy.
 */
const path = require('path');

const RAIZ = path.join(__dirname, '..');

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

async function main() {
  const mod = await import('../netlify/functions/reanudar.mjs');
  const { carritoDe, recortar, comoUrl } = mod._interno;
  const { inventario: stock, detallar } = require(path.join(RAIZ, 'netlify', 'functions', '_precios.js'));
  const items = stock.items;

  /* Piezas reales, no ids a mano: la misma regla que el resto de las baterías. */
  const charm = Object.keys(items).find(k => !items[k].tallas && items[k].stock >= 2);
  const pulsera = Object.keys(items).find(k => items[k].tallas
    && Object.values(items[k].tallas).some(v => v > 0));
  const talla = Object.keys(items[pulsera].tallas).find(t => items[pulsera].tallas[t] > 0);

  console.log('\n1 · Del registro guardado al carrito, sin perder nada');
  {
    /* Se parte de lo que de verdad guarda un pedido: la salida de detallar(). */
    const pedido = { base: { id: pulsera, talla }, charms: [charm, charm], empaque: true };
    const registro = { lineas: detallar(pedido), pago: 'anticipado' };
    const c = carritoDe(registro);
    comprobar(c.base && c.base.id === pulsera && c.base.talla === talla,
      'el brazalete vuelve como base, con su talla', `${pulsera} talla ${talla}`);
    comprobar(c.charms.length === 2 && c.charms.every(x => x === charm),
      'una línea de 2 unidades vuelve a ser 2 charms', `${c.charms.length} charm(s)`);
    comprobar(c.empaque === true, 'el empaque de regalo no se pierde por el camino');
  }
  {
    /* El brazalete se reconoce por su tipo, no por ir el primero: si mañana
       alguien reordena detallar(), esto tiene que seguir funcionando. */
    const registro = { lineas: [
      { id: charm, unidades: 1, talla: null },
      { id: pulsera, unidades: 1, talla },
    ], pago: 'anticipado' };
    const c = carritoDe(registro);
    comprobar(c.base && c.base.id === pulsera && c.charms.length === 1,
      'el brazalete se reconoce por su tipo, venga en la posición que venga');
  }
  {
    const registro = { lineas: [
      { id: 'pieza-retirada-del-catalogo', unidades: 1, talla: null },
      { id: charm, unidades: 1, talla: null },
    ], pago: 'anticipado' };
    const c = carritoDe(registro);
    comprobar(c.charms.length === 1 && c.charms[0] === charm,
      'una pieza que ya no está en el catálogo se cae sin romper el resto');
  }

  console.log('\n2 · No se promete lo que ya no hay');
  {
    const carrito = { base: null, charms: [charm, charm, charm], empaque: false, pago: 'anticipado' };
    const r = recortar(carrito, { [charm]: 1 });
    comprobar(r.carrito.charms.length === 1,
      'pedir 3 de algo que tiene 1 se recorta a 1', `${r.carrito.charms.length}`);
    comprobar(r.cambio === true, 'y queda marcado que hubo cambio, para poder decirlo');
  }
  {
    const carrito = { base: null, charms: [charm], empaque: false, pago: 'anticipado' };
    const r = recortar(carrito, { [charm]: 0 });
    comprobar(r.carrito.charms.length === 0, 'lo agotado del todo desaparece');
  }
  {
    const carrito = { base: { id: pulsera, talla }, charms: [], empaque: false, pago: 'anticipado' };
    const r = recortar(carrito, { [`${pulsera}|${talla}`]: 0 });
    comprobar(r.carrito.base === null, 'la talla agotada quita el brazalete');
  }
  {
    const carrito = { base: { id: pulsera, talla: null }, charms: [], empaque: false, pago: 'anticipado' };
    const r = recortar(carrito, { [`${pulsera}|${talla}`]: 2 });
    comprobar(r.carrito.base !== null,
      'sin talla elegida basta con que quede alguna: la talla se confirma después');
  }
  {
    /* El caso que más importa de esta función. */
    const carrito = { base: null, charms: [charm, charm], empaque: false, pago: 'anticipado' };
    const r = recortar(carrito, null);
    comprobar(r.carrito.charms.length === 2 && r.cambio === false && r.fuente === 'sin-lectura',
      'sin poder leer el inventario NO se recorta a ciegas: se marca la fuente',
      r.fuente);
  }
  {
    const carrito = { base: null, charms: [charm, charm], empaque: false, pago: 'anticipado' };
    const r = recortar(carrito, { [charm]: 5 });
    comprobar(r.cambio === false, 'si alcanza para todo, no se anuncia ningún cambio');
  }

  console.log('\n3 · El enlace que sale es el que las páginas entienden');
  {
    const carrito = { base: { id: pulsera, talla }, charms: [charm, charm], empaque: true,
      pago: 'contraentrega' };
    const q = comoUrl(carrito);
    const p = q.get('p');
    comprobar(p.includes(`${pulsera}@${talla}`), 'el brazalete va con @talla', p);
    comprobar(p.includes(`${charm}*2`), 'dos unidades se agrupan como *2');
    comprobar(q.get('e') === '1', 'el empaque viaja');
    comprobar(q.get('pago') === 'contraentrega', 'y la forma de pago');

    /* La forma tiene que ser exactamente la que aceptan index.html y
       checkout.html. Se comprueba contra la expresión real de esos archivos y
       no contra una copia escrita aquí: si alguien cambia el formato en una
       página, esto se pone rojo en vez de fallar en producción. */
    const fs = require('fs');
    ['checkout.html', 'index.html'].forEach(archivo => {
      const html = fs.readFileSync(path.join(RAIZ, archivo), 'utf8');
      const m = html.match(/t\.match\(\/(\^\([a-z0-9\\[\]{}(),?:*@|+-]+\$)\/\)/);
      comprobar(!!m, `la expresión que valida el enlace sigue en ${archivo}`);
      if (!m) return;
      const re = new RegExp(m[1]);
      comprobar(p.split(',').every(t => re.test(t)),
        `y cada trozo que genera el servidor pasa la validación de ${archivo}`);
    });
  }
  {
    const carrito = { base: null, charms: [charm], empaque: false, pago: 'anticipado' };
    const q = comoUrl(carrito);
    comprobar(q.get('p') === charm, 'una sola unidad va sin *1, que sobra', q.get('p'));
    comprobar(q.get('e') === null && q.get('pago') === null,
      'y lo que está en su valor por defecto no ensucia la URL');
  }

  console.log('\n4 · La forma del módulo');
  {
    const fs = require('fs');
    const src = fs.readFileSync(path.join(RAIZ, 'netlify', 'functions', 'reanudar.mjs'), 'utf8');
    comprobar(/export default/.test(src),
      'exporta el handler v2 por defecto — con v1 no habría Blobs');
    /* Sin comentarios: este archivo EXPLICA largo y tendido por qué no toca
       Wompi, así que buscar la palabra en el texto entero encuentra justo la
       explicación de que no lo hace. Lo que se comprueba es el código. */
    const codigo = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    comprobar(!/wompi|firmar|createHash|WOMPI_/i.test(codigo),
      'NO firma ni arma cobros: el camino del dinero sigue estando en un solo sitio');
    comprobar(/'pagado'|"pagado"/.test(codigo),
      'comprueba el pedido ya pagado antes de devolver a nadie a pagar');
  }

  console.log(fallos ? `\n${fallos} en rojo` : '\nReanudar en verde ✓');
}

main().catch(e => { console.log('  ✗ FALLA la batería reventó —', e.message); process.exit(1); });
