'use strict';
/* El correo de después de la compra (netlify/functions/posventa.mjs).
 *
 * Lo que se comprueba es a QUIÉN y CUÁNDO se le escribe, que es donde esta
 * pieza puede quedar mal: un «¿cómo te fue?» a un pedido cancelado, a uno que
 * aún no llega, dos veces al mismo pedido, o dos meses tarde el día que se
 * publica. Nada de eso da error; solo se ve mal frente a la clienta.
 *
 * Y el contenido: sin incentivo (decisión del propietario), sin vender nada
 * (se manda sin la casilla de novedades, con la política como base) y con un
 * enlace firmado por pieza, que es lo que pone «Compra verificada».
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const RAIZ = path.join(__dirname, '..');
const cargar = f => import(pathToFileURL(path.join(RAIZ, 'netlify', 'functions', f)).href);

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

process.env.SUSCRIPCION_SECRETO = 'secreto-de-prueba-con-mas-de-16';
const CAT = require(path.join(RAIZ, 'assets', 'catalogo.json'));
const [ID1, ID2] = Object.keys(CAT.nombres).filter(id => !id.startsWith('letra-') && CAT.fotos[id]);

const AHORA = Date.parse('2026-10-20T15:00:00Z');
const haceDias = d => new Date(AHORA - d * 864e5).toISOString();

const pedido = (extra = {}) => Object.assign({
  referencia: 'ZC-261008-AAAA0001',
  estado: 'pagado',
  creado: haceDias(12),
  pagadoEn: haceDias(12),
  lineas: [{ id: ID1, nombre: CAT.nombres[ID1], unidades: 1 }],
  cliente: { nombre: 'María José', apellido: 'Gómez', celular: '3012345678', correo: 'Maria@Ejemplo.com' },
}, extra);

async function main() {
  const m = await cargar('posventa.mjs');
  const { elegibles, agrupar, tarjetas, correo, DIAS_DESPUES, DIAS_MAX } = m._interno;
  const sel = (ps, fuera) => elegibles(ps, AHORA, fuera).map(p => p.referencia);

  console.log('1 · Cuándo');
  comprobar(sel([pedido()]).length === 1, `un pedido pagado hace 12 días entra`);
  comprobar(sel([pedido({ pagadoEn: haceDias(DIAS_DESPUES - 1) })]).length === 0,
    `antes de ${DIAS_DESPUES} días no: puede que aún no le haya llegado`);
  comprobar(sel([pedido({ pagadoEn: haceDias(DIAS_DESPUES) })]).length === 1,
    `a los ${DIAS_DESPUES} días justos sí`);
  comprobar(sel([pedido({ pagadoEn: haceDias(DIAS_MAX + 1), creado: haceDias(DIAS_MAX + 1) })]).length === 0,
    `después de ${DIAS_MAX} días no: el día que se publique no le escribe a los pedidos de agosto`);
  comprobar(sel([pedido({ creado: haceDias(40), pagadoEn: haceDias(12) })]).length === 1,
    'cuenta desde el pago, no desde que se creó el pedido');
  {
    const p = pedido({ estado: 'confirmado', creado: haceDias(11) });
    delete p.pagadoEn;
    comprobar(sel([p]).length === 1, 'contraentrega (sin fecha de pago) cuenta desde que se confirmó');
  }
  comprobar(sel([pedido({ pagadoEn: 'no-es-fecha', creado: undefined })]).length === 0,
    'una fecha ilegible se salta en vez de colarse');

  console.log('\n2 · A quién NO');
  for (const estado of ['esperando-pago', 'recibido', 'cancelado', 'anulada', 'pago-declined']) {
    comprobar(sel([pedido({ estado })]).length === 0, `estado «${estado}» no recibe nada`);
  }
  comprobar(sel([pedido({ estado: 'venta-manual' })]).length === 1, 'una venta manual por WhatsApp sí');
  comprobar(sel([pedido({ estado: 'venta-manual', pago: 'regalo' })]).length === 0,
    'un regalo no: «gracias por tu compra» a quien no compró queda mal');
  comprobar(sel([pedido({ posventa: haceDias(1) })]).length === 0,
    'un pedido que ya lo recibió no lo vuelve a recibir: nunca hay recordatorio');
  {
    const p = pedido(); p.cliente = Object.assign({}, p.cliente, { correo: '  ' });
    comprobar(sel([p]).length === 0, 'sin correo no hay a dónde');
  }
  comprobar(sel([pedido()], new Set(['maria@ejemplo.com'])).length === 0,
    'quien pidió que no le escribamos (POSVENTA_NO_ESCRIBIR) no recibe nada, sin importar mayúsculas');
  comprobar(sel([pedido({ lineas: [{ id: 'empaque' }, { id: 'pieza-que-ya-no-existe' }] })]).length === 0,
    'sin piezas del catálogo actual no hay por qué pedir opinión');
  comprobar(sel([null, undefined, {}]).length === 0, 'un registro corrupto no rompe la selección');

  console.log('\n3 · Un correo por persona');
  {
    const g = agrupar(elegibles([
      pedido({ referencia: 'ZC-A' }),
      pedido({ referencia: 'ZC-B', lineas: [{ id: ID2 }, { id: ID1 }],
        cliente: Object.assign({}, pedido().cliente, { correo: 'maria@ejemplo.com ' }) }),
      pedido({ referencia: 'ZC-C', cliente: Object.assign({}, pedido().cliente, { correo: 'otra@ejemplo.com' }) }),
    ], AHORA));
    comprobar(g.length === 2, 'dos pedidos de la misma clienta se juntan en un solo correo', `${g.length} correos`);
    const t = tarjetas(g.find(x => x.length === 2), 'https://zephoracharms.com');
    comprobar(t && t.length === 2, 'y cada pieza sale una sola vez aunque esté en los dos pedidos');
  }

  console.log('\n4 · Los enlaces');
  {
    const t = tarjetas([pedido()], 'https://zephoracharms.com');
    comprobar(t && /\/producto-[^/?]+\.html\?resena=ZC-261008-AAAA0001\./.test(t[0].url),
      'cada pieza lleva el enlace firmado a su página: es lo que pone «Compra verificada»', t && t[0].url);
    comprobar(t && t[0].foto === `https://zephoracharms.com/assets/${CAT.fotos[ID1]}`,
      'con la misma foto que muestra la tienda');
    const guardado = process.env.SUSCRIPCION_SECRETO;
    process.env.SUSCRIPCION_SECRETO = '';
    comprobar(tarjetas([pedido()], 'https://zephoracharms.com') === null,
      'sin el secreto no se manda: un enlace sin firma deja la reseña sin chulo y no se puede volver a pedir');
    process.env.SUSCRIPCION_SECRETO = guardado;
  }

  console.log('\n5 · Lo que dice');
  {
    const p = pedido({ cliente: Object.assign({}, pedido().cliente, { nombre: '<b>Ana</b> Lucía' }) });
    const c = correo([p], tarjetas([p], 'https://zephoracharms.com'));
    comprobar(c.para === 'Maria@Ejemplo.com', 'va al correo de la clienta');
    comprobar(/gracias otra vez/i.test(c.txt) && /cómo te fue/i.test(c.txt) && /dejar tu opinión/i.test(c.txt),
      'agradece, pregunta cómo le fue e invita a dejar la opinión');
    comprobar(c.txt.includes('ZC-261008-AAAA0001') && c.txt.includes(CAT.nombres[ID1]),
      'nombra el pedido y la pieza');
    comprobar(!c.html.includes('<b>Ana</b>') && c.html.includes('&lt;b&gt;Ana&lt;/b&gt;'),
      'el nombre que escribió la clienta va escapado');
    comprobar(!/descuento|gratis|sorteo|cup[oó]n|promo|oferta|% /i.test(c.txt),
      'sin incentivo y sin vender nada: se manda sin la casilla de novedades');
    comprobar(!/lo resolvemos/i.test(c.txt), 'sin el párrafo de «si algo no salió… lo resolvemos» (lo quitó el propietario)');
    comprobar(/responde a este correo/i.test(c.txt), 'dice cómo pedir que no le escribamos más');
  }

  console.log('\n6 · La política de privacidad lo cubre');
  {
    /* Se le escribe a quien no marcó la casilla porque la política lo dice. Si
       alguien quita esa línea, esto tiene que ponerse en rojo. */
    const pol = fs.readFileSync(path.join(RAIZ, 'politica-de-privacidad.html'), 'utf8');
    comprobar(/una sola vez[^<]*despu[eé]s de tu compra[^<]*opini[oó]n/i.test(pol),
      'la política dice que se escribe una vez después de la compra para pedir la opinión');
    const gen = fs.readFileSync(path.join(RAIZ, 'herramientas', 'gen_paginas.py'), 'utf8');
    comprobar(/una sola vez[^<]*despu[eé]s de tu compra/i.test(gen),
      'y el generador también: si no, la próxima regeneración la borra');
  }

  console.log('\n7 · Programada');
  {
    const src = fs.readFileSync(path.join(RAIZ, 'netlify', 'functions', 'posventa.mjs'), 'utf8');
    comprobar(/export const config = \{ schedule: '[0-9*,\/ -]+' \}/.test(src), 'corre sola una vez al día');
  }

  console.log(fallos ? `\nPosventa: ${fallos} en rojo` : '\nPosventa en verde ✓');
  if (fallos) process.exitCode = 1;
}

main().catch(e => { console.log('  ✗ FALLA la prueba no pudo correr — ' + e.message); process.exitCode = 1; });
