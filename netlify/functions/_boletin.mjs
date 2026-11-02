/* Correos de novedades a las suscriptoras: qué dice cada campaña y cómo se
 * arma. Lo manda boletin.mjs; aquí no hay red ni almacén, para poder verlo y
 * probarlo con cualquier copia de `disponibilidad`.
 *
 * Reglas que no se negocian (propietario, 2026-11-01):
 * - Precios y unidades salen de `disponibilidad` en el momento de armar el
 *   correo. Una pieza agotada no aparece; un bloque que se queda sin piezas,
 *   tampoco.
 * - Fotos: el campo `foto` (JPG del CDN): muchos clientes de correo no
 *   muestran .webp. Nunca fotos generadas ni retocadas.
 * - Cada correo lleva SU enlace de baja (Ley 1581). Sin enlace no se arma.
 * - Los $15.000 de suscriptora solo a quien todavía no los usó.
 * - Los brazaletes son baño de plata: nunca «todo es plata».
 * - Si la promo del sitio cambió, el texto de la campaña ya no es verdad: no
 *   se arma (ver `verificarReglas`).
 */

const SITIO = 'https://zephoracharms.com';
const WA = '573018990672';
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, m => ESC[m]);
export const cop = n => '$' + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const C = { tinta: '#2A1F2E', ciruela: '#5C3D63', suave: '#584a5c', gris: '#8a8290', borde: '#E4DDE0', fondo: '#F6F3F4', rosa: '#F3E6EB', verde: '#1F7A5C' };
const SANS = 'Arial,Helvetica,sans-serif', SERIF = 'Georgia,serif';

/* ── Las campañas ── */

export const CAMPANAS = {
  'novedades-2026-11-01': {
    asunto: 'Llegaron los anillos 💍',
    previa: 'Plata 925 con sello S925, tallas 5 a 8. Y 8 charms nuevas.',
    titulo: 'Hoy estrenamos anillos',
    entrada: 'Hola. Hoy estrenamos anillos en la tienda, y con ellos llegaron charms nuevas y brazaletes con cierre de corazón. Aquí te contamos todo.',
    /* Lo que el texto de abajo promete de la promo y el envío. */
    reglas: { tramos: [[4, 1], [6, 2]], envioGratisSoloAnticipado: true },
    anillos: ['anillo-corazon-elevado-blanco', 'anillo-corazon-elevado-rojo', 'anillo-doble-corazon'],
    charms: ['black-panther', 'virgen-de-fatima', 'virgen-aparecida', 'simbolo-de-la-medicina', 'maquina-de-coser',
      'graduacion-diploma-y-flores', 'brindis-cheers', 'mano-rock-y-guitarra'],
    brazaletes: ['pulsera-corazon-abierto', 'pulsera-corazon-infinito', 'pulsera-corazon-arbol-de-la-vida'],
    volvieron: ['minnie-mouse', 'walle', 'avion-globo-y-pasaporte', 'torre-eiffel-y-camara'],
    signos: ['aries', 'tauro', 'geminis', 'cancer', 'leo', 'virgo', 'libra', 'escorpio', 'sagitario', 'capricornio', 'acuario', 'piscis'],
  },
};

/* ── Datos ── */

export function verificarReglas(campana, disp) {
  const r = (disp && disp.reglas) || {};
  const tramos = JSON.stringify((r.promo && r.promo.tramos) || null);
  const problemas = [];
  if (tramos !== JSON.stringify(campana.reglas.tramos)) problemas.push(`la promo del sitio es ${tramos}, el correo dice ${JSON.stringify(campana.reglas.tramos)}`);
  if (Boolean(r.envioGratisSoloAnticipado) !== campana.reglas.envioGratisSoloAnticipado || Number(r.envioGratisDesde) !== 0)
    problemas.push('el envío gratis del sitio ya no es «gratis pagando en línea»');
  if (!(r.envio && Number(r.envio.contraentrega) > 0)) problemas.push('no se sabe cuánto cuesta la contraentrega');
  return problemas;
}

/* Junta lo que se puede mostrar hoy. Lo agotado queda en `omitidas`. */
export function seleccionar(campana, disp) {
  const piezas = new Map((disp.piezas || []).map(p => [p.id, p]));
  const braz = new Map((disp.brazaletes || []).map(p => [p.id, p]));
  const omitidas = [];
  const hay = p => p && !p.agotado && Number(p.disponible) > 0;
  const pagina = id => `${SITIO}/producto-${id}.html`;

  const anillos = campana.anillos.map(modelo => {
    const tallas = [...piezas.values()].filter(p => p.id.startsWith(modelo + '-t') && hay(p))
      .map(p => ({ talla: p.id.slice(modelo.length + 2), p })).sort((a, b) => Number(a.talla) - Number(b.talla));
    if (!tallas.length) { omitidas.push(modelo); return null; }
    const nombre = tallas[0].p.nombre.replace(/\s*[·—-]\s*Talla.*$/i, '');
    return { id: modelo, nombre, precio: tallas[0].p.precio, foto: tallas[0].p.foto, material: tallas[0].p.material,
      tallas: tallas.map(t => t.talla), url: pagina(modelo) };
  }).filter(Boolean);

  const charms = campana.charms.map(id => {
    const p = piezas.get(id);
    if (!hay(p)) { omitidas.push(id); return null; }
    return { id, nombre: p.nombre, precio: p.precio, foto: p.foto, material: p.material, quedan: p.disponible, url: pagina(id) };
  }).filter(Boolean);

  const brazaletes = campana.brazaletes.map(id => {
    const p = braz.get(id);
    const tallas = p ? Object.entries(p.tallas || {}).filter(([, n]) => n > 0).map(([t]) => t) : [];
    if (!p || p.agotado || !tallas.length) { omitidas.push(id); return null; }
    return { id, nombre: p.nombre, precio: p.precio, foto: p.foto, material: p.material, tallas, url: pagina(id) };
  }).filter(Boolean);

  const volvieron = campana.volvieron.map(id => {
    const p = piezas.get(id);
    if (!hay(p)) { omitidas.push(id); return null; }
    return { id, nombre: p.nombre, quedan: p.disponible, url: pagina(id) };
  }).filter(Boolean);
  const signos = campana.signos.filter(id => { const ok = hay(piezas.get(id)); if (!ok) omitidas.push(id); return ok; })
    .map(id => ({ id, nombre: piezas.get(id).nombre, url: pagina(id) }));

  return { anillos, charms, brazaletes, volvieron, signos, omitidas,
    contraentrega: Number(disp.reglas.envio.contraentrega) };
}

/* ── HTML ── */

const boton = (texto, url) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px auto 4px"><tr>
    <td style="background:${C.ciruela};border-radius:3px">
      <a href="${esc(url)}" style="display:inline-block;padding:13px 28px;font:700 15px/1 ${SANS};color:#fff;text-decoration:none;letter-spacing:.02em">${esc(texto)}</a>
    </td></tr></table>`;

const seccion = (titulo, subtitulo, cuerpo) => `
  <tr><td style="padding:30px 22px 6px;border-top:1px solid ${C.borde}">
    <h2 style="margin:0 0 6px;font:400 23px/1.25 ${SERIF};color:${C.tinta};text-align:center">${esc(titulo)}</h2>
    ${subtitulo ? `<p style="margin:0 0 16px;font:400 14px/1.55 ${SANS};color:${C.suave};text-align:center">${subtitulo}</p>` : ''}
    ${cuerpo}
  </td></tr>`;

const tarjeta = (x, lineas) => `
  <td width="50%" valign="top" style="padding:6px">
    <a href="${esc(x.url)}" style="text-decoration:none;color:${C.tinta}">
      <img src="${esc(x.foto)}" width="248" alt="${esc(x.nombre)}" style="display:block;width:100%;max-width:248px;height:auto;border:0;border-radius:3px;background:${C.fondo}">
      <p style="margin:8px 0 2px;font:400 15px/1.3 ${SERIF};color:${C.tinta}">${esc(x.nombre)}</p>
    </a>
    ${lineas.map(l => `<p style="margin:0;font:400 13px/1.45 ${SANS};color:${C.suave}">${l}</p>`).join('')}
  </td>`;

/* Rejilla de 2 columnas; en el celular cada tarjeta mide la mitad del ancho
   (unos 160 px), suficiente para la foto y el nombre. */
const rejilla = celdas => {
  const filas = [];
  for (let i = 0; i < celdas.length; i += 2) {
    const par = celdas.slice(i, i + 2);
    if (par.length === 1) par.push('<td width="50%" style="padding:6px"></td>');
    filas.push(`<tr>${par.join('')}</tr>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas.join('')}</table>`;
};

const lista = nombres => nombres.length <= 1 ? nombres.join('')
  : nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1];
const quedan = n => (Number(n) === 1 ? '<b style="color:#A23B5A">Última unidad</b>' : Number(n) === 2 ? '<b style="color:#A23B5A">Quedan 2</b>' : '');

export function armar(campana, sel, { baja, descuento = false }) {
  if (!baja || !/^https:\/\//.test(baja)) throw new Error('Sin enlace de baja no se arma el correo (Ley 1581)');
  const bloques = [];

  if (sel.anillos.length) {
    const tallas = [...new Set(sel.anillos.flatMap(a => a.tallas))].sort((a, b) => a - b);
    bloques.push(seccion('Anillos, por primera vez',
      `En Plata Esterlina 925, con el sello S925 grabado por dentro del aro. Tallas ${esc(lista(tallas))}.`,
      rejilla(sel.anillos.map(a => tarjeta(a, [esc(cop(a.precio)), `Tallas ${esc(lista(a.tallas))}`])))
      + `<p style="margin:14px 6px 0;font:400 13px/1.55 ${SANS};color:${C.suave};text-align:center">Son de talla fija, no ajustables. Si no te queda, tienes 5 días hábiles para cambiar la talla. En cada página hay una guía para medirte el dedo con un hilo.</p>`
      + boton('Ver los anillos', `${SITIO}/index.html#anillos`)));
  }

  if (sel.charms.length) {
    bloques.push(seccion(sel.charms.length === 8 ? '8 charms nuevas' : 'Charms nuevas', 'En Plata Esterlina 925.',
      rejilla(sel.charms.map(c => tarjeta(c, [esc(cop(c.precio)), quedan(c.quedan)].filter(Boolean))))
      + boton('Ver las novedades', `${SITIO}/index.html#charms`)));
  }

  if (sel.brazaletes.length) {
    bloques.push(seccion('Brazaletes con cierre de corazón', 'Con baño de plata.',
      rejilla(sel.brazaletes.map(b => tarjeta(b, [esc(cop(b.precio)), `Tallas ${esc(lista(b.tallas))} cm`])))
      + boton('Ver los brazaletes', `${SITIO}/index.html#brazaletes`)));
  }

  const vuelta = [...sel.volvieron.map(v => `<a href="${esc(v.url)}" style="color:${C.ciruela}">${esc(v.nombre)}</a>`)];
  if (sel.signos.length === 12) vuelta.push('Los 12 signos del zodiaco');
  else vuelta.push(...sel.signos.map(s => `<a href="${esc(s.url)}" style="color:${C.ciruela}">${esc(s.nombre)}</a>`));
  if (vuelta.length) {
    const ultimas = sel.volvieron.filter(v => Number(v.quedan) === 1).map(v => esc(v.nombre));
    bloques.push(seccion('Volvieron', '',
      `<p style="margin:0 6px;font:400 15px/1.6 ${SANS};color:${C.suave};text-align:center">Ya hay unidades otra vez de:</p>
      <p style="margin:8px 6px 0;font:400 15px/1.7 ${SERIF};color:${C.tinta};text-align:center">${vuelta.join(' · ')}</p>${ultimas.length ? `
      <p style="margin:8px 6px 0;font:400 13px/1.55 ${SANS};color:#A23B5A;text-align:center">De ${lista(ultimas)} queda una sola.</p>` : ''}`));
  }

  const beneficios = [
    '<b>Arma tu set: paga 3 y llévate 1 gratis · paga 4 y llévate 2.</b> Con 4 piezas sale gratis la de menor valor; con 6, las 2 de menor valor. Charms, anillos y brazaletes cuentan igual.',
    `Envío gratis a toda Colombia pagando en línea. Contraentrega cuesta ${esc(cop(sel.contraentrega))}.`,
    'Hasta 3 cuotas sin interés con Addi.',
    'Cada pedido va con caja, paño para limpiar la plata y dedicatoria escrita a mano.',
  ];
  if (descuento) beneficios.push('<b style="color:' + C.verde + '">Y por ser suscriptora: $15.000 de descuento en tu primera compra de 2 piezas o más, usando este mismo correo.</b> Se aplica solo al pagar.');
  bloques.push(`
  <tr><td style="padding:26px 22px;border-top:1px solid ${C.borde};background:${C.rosa}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${beneficios.map(b => `<tr><td style="padding:5px 0;font:400 14px/1.55 ${SANS};color:${C.suave}">${b}</td></tr>`).join('')}
    </table>
  </td></tr>`);

  const html = `<!DOCTYPE html>
<html lang="es-CO"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(campana.asunto)}</title></head>
<body style="margin:0;padding:0;background:${C.fondo}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(campana.previa)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.fondo};padding:20px 10px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid ${C.borde};border-radius:4px">
  <tr><td style="padding:22px 22px;border-bottom:1px solid ${C.borde};text-align:center">
    <a href="${SITIO}" style="text-decoration:none"><span style="font:400 19px/1 ${SERIF};letter-spacing:.13em;text-transform:uppercase;color:${C.tinta}">Zephora <i style="color:${C.ciruela}">Charms</i></span></a>
  </td></tr>
  <tr><td style="padding:28px 22px 22px;text-align:center">
    <h1 style="margin:0 0 10px;font:400 28px/1.2 ${SERIF};color:${C.tinta}">${esc(campana.titulo)}</h1>
    <p style="margin:0;font:400 15px/1.6 ${SANS};color:${C.suave}">${esc(campana.entrada)}</p>
  </td></tr>
  ${bloques.join('')}
  <tr><td style="padding:22px;border-top:1px solid ${C.borde};text-align:center">
    <p style="margin:0 0 8px;font:400 13px/1.55 ${SANS};color:${C.suave}">¿Dudas con una talla o un regalo? Escríbenos por <a href="https://wa.me/${WA}" style="color:${C.ciruela}">WhatsApp +57 301 899 0672</a>.</p>
    <p style="margin:0 0 8px;font:400 12px/1.55 ${SANS};color:${C.gris}">Zephora Charms · NIT 1.019.151.696-3 · Bogotá D.C., Colombia</p>
    <p style="margin:0;font:400 12px/1.55 ${SANS};color:${C.gris}">Te llega este correo porque te suscribiste en zephoracharms.com. <a href="${esc(baja)}" style="color:${C.gris}">Darme de baja</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const t = [];
  t.push(campana.titulo, '', campana.entrada, '');
  if (sel.anillos.length) {
    t.push('ANILLOS, POR PRIMERA VEZ', 'Plata Esterlina 925 con el sello S925 grabado por dentro del aro. Talla fija, no ajustable; 5 días hábiles para cambiar la talla. Cada página trae una guía para medirte el dedo con un hilo.');
    sel.anillos.forEach(a => t.push(`- ${a.nombre}: ${cop(a.precio)}, tallas ${lista(a.tallas)} — ${a.url}`));
    t.push(`Ver los anillos: ${SITIO}/index.html#anillos`, '');
  }
  if (sel.charms.length) {
    t.push('CHARMS NUEVAS (Plata Esterlina 925)');
    sel.charms.forEach(c => t.push(`- ${c.nombre}: ${cop(c.precio)} — ${c.url}`));
    t.push(`Ver las novedades: ${SITIO}/index.html#charms`, '');
  }
  if (sel.brazaletes.length) {
    t.push('BRAZALETES CON CIERRE DE CORAZÓN (baño de plata)');
    sel.brazaletes.forEach(b => t.push(`- ${b.nombre}: ${cop(b.precio)}, tallas ${lista(b.tallas)} cm — ${b.url}`));
    t.push(`Ver los brazaletes: ${SITIO}/index.html#brazaletes`, '');
  }
  if (vuelta.length) t.push('VOLVIERON: ' + ([...sel.volvieron.map(v => v.nombre), ...(sel.signos.length === 12 ? ['Los 12 signos del zodiaco'] : sel.signos.map(s => s.nombre))]).join(' · '), '');
  beneficios.forEach(b => t.push('· ' + b.replace(/<[^>]+>/g, '')));
  t.push('', 'WhatsApp +57 301 899 0672 — https://wa.me/' + WA,
    'Zephora Charms · NIT 1.019.151.696-3 · Bogotá D.C., Colombia',
    'Te llega este correo porque te suscribiste en zephoracharms.com. Darme de baja: ' + baja);

  return { asunto: campana.asunto, html, txt: t.join('\n') };
}
