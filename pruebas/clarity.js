'use strict';
/* Microsoft Clarity (grabaciones y mapas de calor), pedido del propietario el
 * 2026-11-19: «me gustaria que usaramos el clarity».
 *
 * Lo que esta batería cuida son las dos maneras de hacerlo mal sin que nada
 * dé error:
 *
 *   · Una página sin la etiqueta: no se graba y nadie se entera. Pasa sobre
 *     todo con las generadas (productos, colecciones, kits): si el generador
 *     no la trae, la próxima regeneración la borra de 160 páginas a la vez.
 *   · Un formulario sin máscara: la grabación muestra el nombre, el celular,
 *     la dirección o el correo de una clienta. Clarity oculta por defecto lo
 *     que se TECLEA en los campos, pero no el texto que la página pinta —la
 *     ficha de «gracias» dice nombre, dirección y celular en texto plano—.
 *     Por eso se enmascara el bloque entero, no solo los campos.
 *
 * Y que Clarity vaya aparte: un archivo propio, cargado diferido, sin tocar el
 * píxel de Meta, la CAPI ni el cobro.
 */
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const leer = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

const ID = 'zg8e6n5pyk';
const ETIQUETA = '<script src="/assets/clarity.js" defer></script>';
const MASCARA = /data-clarity-mask="true"/i;

console.log('\n1 · El cargador, aparte y diferido');
const js = fs.existsSync(path.join(RAIZ, 'assets', 'clarity.js')) ? leer('assets/clarity.js') : '';
comprobar(js.length > 0, 'existe assets/clarity.js');
comprobar(js.includes(ID), 'con el proyecto de Zephora', ID);
comprobar(/https:\/\/www\.clarity\.ms\/tag\//.test(js), 'carga la etiqueta oficial de clarity.ms');
comprobar(/addEventListener\(\s*'load'/.test(js) && /requestIdleCallback/.test(js),
  'espera a que la página termine de cargar: no compite con fotos ni con el carrito');
comprobar(!/fbq|facebook|_meta|crear-pago|wompi/i.test(js), 'no toca el píxel de Meta, la CAPI ni el cobro');

console.log('\n2 · En todas las páginas');
const paginas = fs.readdirSync(RAIZ).filter(f => f.endsWith('.html')).sort();
const sin = [], dobles = [], fueraDelHead = [];
paginas.forEach(f => {
  const h = leer(f);
  const n = h.split(ETIQUETA).length - 1;
  if (n === 0) sin.push(f);
  if (n > 1) dobles.push(f);
  if (n && h.indexOf(ETIQUETA) > h.indexOf('</head>')) fueraDelHead.push(f);
});
comprobar(sin.length === 0, `las ${paginas.length} páginas cargan Clarity`, sin.slice(0, 6).join(', ') || undefined);
comprobar(dobles.length === 0, 'una sola vez cada una (dos etiquetas contarían dos visitas)', dobles.join(', ') || undefined);
comprobar(fueraDelHead.length === 0, 'en el <head>', fueraDelHead.join(', ') || undefined);
['index.html', 'checkout.html', 'gracias.html', 'coleccion-marvel.html', 'kits.html', 'producto-stitch.html']
  .forEach(f => comprobar(leer(f).includes(ETIQUETA), `incluida ${f}`));
/* Las páginas generadas salen de estos dos: si no traen la etiqueta, la próxima
   regeneración la borra de todas. */
['herramientas/gen_productos.py', 'herramientas/gen_colecciones.py'].forEach(g =>
  comprobar(leer(g).includes(ETIQUETA), `y el generador ${path.basename(g)} la trae`));

console.log('\n3 · Ningún dato personal en las grabaciones');
const checkout = leer('checkout.html');
comprobar(/<section[^>]*id="panel-datos"[^>]*data-clarity-mask="true"/i.test(checkout),
  'checkout: el bloque de datos de envío (nombre, cédula, celular, correo, dirección)');
const gracias = leer('gracias.html');
comprobar(/<main[^>]*data-clarity-mask="true"/i.test(gracias),
  'gracias: toda la página (la ficha pinta nombre, dirección, celular y correo en texto)');
const productos = paginas.filter(f => /^producto-/.test(f));
const conResena = productos.filter(f => /id="rp-form"/.test(leer(f)));
const resenaSin = conResena.filter(f => !/<form[^>]*id="rp-form"[^>]*data-clarity-mask="true"/i.test(leer(f)));
comprobar(conResena.length > 0 && resenaSin.length === 0,
  `reseñas: el formulario de las ${conResena.length} páginas de producto`, resenaSin.slice(0, 4).join(', ') || undefined);
comprobar(/class="rp-form"[^>]*data-clarity-mask="true"|data-clarity-mask="true"[^>]*class="rp-form"/i.test(leer('herramientas/gen_productos.py')),
  'y en el generador de productos');
const tjs = leer('tienda.js');
comprobar(/<form class="susc-f"[^>]*data-clarity-mask="true"/i.test(tjs),
  'suscripción: el formulario del correo (lo pinta tienda.js)');
/* Cualquier otro formulario nuevo con datos personales tiene que entrar aquí. */
const formsSinMascara = [];
paginas.forEach(f => {
  const h = leer(f);
  [...h.matchAll(/<form\b[^>]*>/g)].forEach(m => {
    const dentroDeMascara = f === 'checkout.html' || f === 'gracias.html';
    if (!MASCARA.test(m[0]) && !dentroDeMascara) formsSinMascara.push(f);
  });
});
comprobar(formsSinMascara.length === 0, 'ningún otro <form> sin máscara', [...new Set(formsSinMascara)].slice(0, 5).join(', ') || undefined);

console.log('\n4 · Se avisa en la política de privacidad');
const pol = leer('politica-de-privacidad.html');
comprobar(/Microsoft Clarity/.test(pol) && /no se graban/i.test(pol),
  'la política dice que se usa Clarity y que los datos de los formularios no se graban');

console.log(fallos ? `\nClarity: ${fallos} en rojo` : '\nClarity en verde ✓');
if (fallos) process.exitCode = 1;
