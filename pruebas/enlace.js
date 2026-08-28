'use strict';
/* El carrito que llega en un enlace.
 *
 * Existe porque este enlace es la pieza que comparten las dos automatizaciones
 * de conversión: el correo que recupera un checkout abandonado y el asesor de
 * WhatsApp que manda la selección ya armada. Si el enlace pinta algo distinto
 * de lo que dice, la clienta paga otra cosa —o cree que va a pagar otra cosa,
 * que para el caso es igual de malo.
 *
 * Lo que de verdad se comprueba aquí no es que funcione el caso bueno, sino
 * los tres que duelen:
 *
 *   · Que un id inventado no rompa la página. Un enlace de hace un mes puede
 *     nombrar una pieza retirada del catálogo, y eso no puede dejar a nadie
 *     sin checkout.
 *   · Que el enlace gane sobre lo guardado. Si perdiera, la clienta que llega
 *     por el correo de recuperación vería el carrito de otra visita y no el
 *     suyo.
 *   · Que los parámetros se limpien de la URL. Si se quedan, recargar
 *     reimpone el enlace encima de lo que acabe de cambiar, y la tienda
 *     parece deshacerle los cambios sola.
 *
 * Y una regla de forma, del mismo tipo que las de `inventario.js` § 6: las dos
 * páginas tienen que entender el MISMO formato. Son dos copias del parser en
 * dos archivos que no comparten código, así que la única forma de que no se
 * separen sin avisar es probar las dos con los mismos casos.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const URL_BASE = process.env.URL || 'http://localhost:8899';

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

/* Piezas reales del catálogo, no ids escritos a mano: si mañana se retira una
   pieza, esta batería no puede ponerse roja por eso —es la lección que ya está
   escrita en la tabla de decisiones de ESTADO.md—. */
function piezasReales() {
  const cat = JSON.parse(fs.readFileSync(path.join(RAIZ, 'assets', 'catalogo.json'), 'utf8'));
  const stock = JSON.parse(fs.readFileSync(path.join(RAIZ, 'assets', 'stock.json'), 'utf8')).items;
  const pulseras = cat.pulseras || [];
  const hay = id => {
    const it = stock[id];
    if (!it) return 0;
    if (it.tallas) return Object.values(it.tallas).reduce((n, v) => n + v, 0);
    return it.stock || 0;
  };
  /* Un charm con 3 o más unidades: hace falta margen para probar que `*2` no
     se recorta por inventario y que `*99` sí. */
  const charm = Object.keys(cat.precios).find(id =>
    pulseras.indexOf(id) === -1 && hay(id) >= 3);
  const pulsera = pulseras.find(id => {
    const it = stock[id];
    return it && it.tallas && Object.keys(it.tallas).some(t => it.tallas[t] > 0);
  });
  const talla = Object.keys(stock[pulsera].tallas).find(t => stock[pulsera].tallas[t] > 0);
  return { charm, pulsera, talla, nombres: cat.nombres };
}

async function main() {
  const { charm, pulsera, talla, nombres } = piezasReales();
  const navegador = await chromium.launch();

  /* El carrito tal como lo dejó cada página, leído del propio localStorage:
     es el estado que viaja al checkout, así que es lo que hay que mirar. */
  async function abrir(pagina, query, sembrar) {
    const ctx = await navegador.newContext();
    /* Sin fotos: la tienda trae 117 imágenes y cargarlas sube cada caso de
       medio segundo a trece. Aquí no se está probando cómo se ve nada, sino
       qué carrito queda guardado. */
    await ctx.route('**/*.{png,jpg,jpeg,webp,gif,svg,avif}', r => r.abort());
    const p = await ctx.newPage();
    if (sembrar) {
      await p.goto(`${URL_BASE}/${pagina}`, { waitUntil: 'domcontentloaded' });
      await p.evaluate(c => localStorage.setItem('zephora.carrito.v1', JSON.stringify(c)), sembrar);
    }
    await p.goto(`${URL_BASE}/${pagina}${query}`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(700);
    const guardado = await p.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('zephora.carrito.v1') || 'null'); }
      catch (_) { return null; }
    });
    const url = p.url();
    await ctx.close();
    return { guardado, url };
  }

  for (const pagina of ['index.html', 'checkout.html']) {
    console.log(`\n── ${pagina} ──`);

    console.log('\n1 · El enlace arma el carrito');
    {
      const { guardado } = await abrir(pagina, `?p=${charm}*2,${pulsera}@${talla}`);
      comprobar(guardado && guardado.charms.filter(x => x === charm).length === 2,
        'dos unidades de un charm llegan como dos',
        guardado ? `${guardado.charms.length} charm(s)` : 'sin carrito');
      comprobar(guardado && guardado.base && guardado.base.id === pulsera,
        'el brazalete entra como base, no como charm');
      comprobar(guardado && guardado.base && guardado.base.talla === talla,
        'y con su talla', talla);
    }

    console.log('\n2 · Un enlace mal armado no rompe nada');
    {
      const { guardado } = await abrir(pagina, `?p=pieza-que-no-existe,${charm}`);
      comprobar(guardado && guardado.charms.length === 1 && guardado.charms[0] === charm,
        'la pieza inventada se ignora y la buena entra igual',
        nombres[charm] || charm);
    }
    {
      const { guardado } = await abrir(pagina, `?p=${charm}@19`);
      comprobar(!guardado || !(guardado.charms || []).length,
        'una talla en un charm no se adivina: se descarta');
    }
    {
      /* Sin `p` no hay nada que aplicar y el camino normal sigue intacto. */
      const previo = { v: 1, base: null, charms: [charm], empaque: false,
        pago: 'anticipado', cuando: Date.now() };
      const { guardado } = await abrir(pagina, '', previo);
      comprobar(guardado && guardado.charms.length === 1,
        'sin parámetros, lo guardado sigue mandando como siempre');
    }

    console.log('\n3 · El enlace gana sobre lo guardado');
    {
      const previo = { v: 1, base: null, charms: [charm, charm, charm],
        empaque: true, pago: 'contraentrega', cuando: Date.now() };
      const { guardado } = await abrir(pagina, `?p=${charm}`, previo);
      comprobar(guardado && guardado.charms.length === 1,
        'quien llega por un enlace ve el enlace, no lo de su última visita',
        guardado ? `${guardado.charms.length} en vez de 3` : 'sin carrito');
    }

    console.log('\n4 · Los parámetros se limpian de la URL');
    {
      const { url } = await abrir(pagina, `?p=${charm}&e=1`);
      comprobar(!/[?&]p=/.test(url) && !/[?&]e=/.test(url),
        'recargar no reimpone el enlace sobre lo que se acabe de cambiar',
        url.replace(URL_BASE, ''));
    }
    {
      const { url } = await abrir(pagina, `?utm_source=correo&p=${charm}`);
      comprobar(/utm_source=correo/.test(url),
        'y lo que no es nuestro —una utm— se queda donde estaba');
    }

    console.log('\n5 · Empaque y forma de pago');
    {
      const { guardado } = await abrir(pagina, `?p=${charm}&e=1&pago=contraentrega`);
      comprobar(guardado && guardado.empaque === true, 'el empaque de regalo viaja en el enlace');
      comprobar(guardado && guardado.pago === 'contraentrega', 'y la forma de pago también');
    }
  }

  console.log('\n6 · No se promete más de lo que hay');
  {
    /* Solo en la tienda: es la única que conoce el inventario pieza por pieza.
       El checkout deja que el servidor rechace, que es su diseño. */
    const { guardado } = await abrir('index.html', `?p=${charm}*99`);
    const stock = JSON.parse(fs.readFileSync(path.join(RAIZ, 'assets', 'stock.json'), 'utf8'));
    const hay = stock.items[charm].stock;
    const puestos = guardado ? guardado.charms.filter(x => x === charm).length : 0;
    comprobar(puestos > 0 && puestos <= hay,
      'un enlace que pide 99 se recorta a lo que de verdad queda',
      `${puestos} de ${hay}`);
  }

  await navegador.close();

  console.log(fallos ? `\n${fallos} en rojo` : '\nEl carrito por enlace, en verde ✓');
}

main().catch(e => { console.log('  ✗ FALLA la batería reventó —', e.message); process.exit(1); });
