/* Feed de productos para el catálogo de Meta — /feeds/meta-catalogo.csv
 *
 * ── Para qué ──
 *
 * Los anuncios dinámicos (los que le enseñan a cada persona la pieza exacta que
 * miró) necesitan un catálogo en Meta cuyos ID coincidan con los `content_ids`
 * que manda el píxel. El sitio ya manda esos ID: son los slugs de
 * catalogo.json (ver tienda.js → verPieza / sumarCharm y
 * herramientas/gen_productos.py). Este feed publica el MISMO id por pieza, así
 * que el empate es directo, sin tabla de equivalencias que mantener.
 *
 * ── Por qué una función y no un CSV estático ──
 *
 * Por la disponibilidad. `stock.json` es el conteo manual: no sabe lo vendido
 * ni lo apartado por un pago en curso desde el último conteo. Un CSV generado
 * al desplegar se quedaría con esa foto fija hasta el siguiente despliegue
 * (~15 créditos cada uno), y Meta seguiría anunciando como «en existencia»
 * piezas que ya tienen dueña. Aquí la disponibilidad sale de
 * `_inventario.disponibles()` —conteo + sobrantes − vendido − apartado—, la
 * misma resta que usan el checkout y el asesor (disponibilidad.mjs). Meta lo
 * descarga con el horario que se le ponga; cada descarga es un dato fresco y
 * cuesta una invocación, no un despliegue.
 *
 * ── Precio ──
 *
 * Sale de `calcular()` de _precios.js con un pedido de UNA pieza: el mismo
 * camino con el que se cobra. No se lee `stock.json.precio` ni se escribe nada
 * a mano. Una pieza sola no activa la promo (empieza en 4 piezas), así que el
 * precio del feed es el de lista y no se declara `sale_price`: anunciar un
 * descuento que solo existe armando un set es prometer algo que el checkout no
 * cobra con una sola pieza.
 *
 * ── Falla hacia NO publicar, no hacia publicar mal ──
 *
 * Si Blobs no responde, se devuelve 503 y no un CSV con el conteo en bruto.
 * Meta conserva el último feed bueno cuando una descarga falla; uno malo lo
 * aplica. Mejor un catálogo con unas horas de atraso que uno que marca como
 * disponibles piezas vendidas.
 *
 * ── Trampa conocida ──
 *
 * stock.json guarda las unidades de DOS formas: charm `stock`, brazalete
 * `tallas`. Aquí nunca se lee `item.stock` de un brazalete: se suman sus tallas
 * libres (las cinco, igual que disponibilidad.mjs, porque un sobrante puede dar
 * unidades a una talla que el conteo no tenía). pruebas/catalogo-meta.js lo
 * comprueba con un brazalete real.
 */
import { calcular, nombres, fotos, grupos, inventario as stock } from './_precios.js';
import { disponibles } from './_inventario.mjs';

const ORIGEN_POR_DEFECTO = 'https://zephoracharms.com';
const TALLAS = ['17', '18', '19', '20', '21'];
const MARCA = 'Zephora Charms';

/* Anillos: en catalogo.json cada talla es su propio id (`anillo-x-t5`), y la
   página del modelo manda ViewContent con TODOS esos id (tienda.js, ANI). En
   el feed van como variantes de un mismo grupo: así Meta muestra un anillo, no
   cuatro, y cualquier talla que se haya mirado empata. */
const TALLA_ANILLO = /^(.*)-t(\d+)$/;
const modeloAnillo = id => {
  const m = id.startsWith('anillo-') && id.match(TALLA_ANILLO);
  return m ? { modelo: m[1], talla: m[2] } : null;
};

/* Títulos que no se publican tal cual en Meta. Un anuncio que nombra otra
   marca en el título se expone a rechazo por política de marcas (por eso
   assets/ads/ ya deja fuera la variante que nombra a Pandora). El id no
   cambia: es el que manda el píxel. */
const TITULO_FEED = {
  'pulsera-barril-pandora': 'Pulsera Barril',
};

/* Igual que grupoDe() en disponibilidad.mjs: brazaletes e iniciales no traen
   grupo en catalogo.json a propósito (crearía pestañas falsas en la tienda). */
function grupoDe(id, it) {
  if (it && it.tallas) return 'Brazaletes';
  if (id.startsWith('letra-')) return 'Letras';
  return (grupos && grupos[id]) || 'Charms';
}

function precioDe(id, it) {
  const pedido = it && it.tallas
    ? { base: { id, talla: null }, charms: [], pago: 'anticipado' }
    : { base: null, charms: [id], pago: 'anticipado' };
  return calcular(pedido).subtotal;
}

/* La foto en JPEG por el CDN de imágenes de Netlify: las fotos del sitio son
   webp y no todos los consumidores de Meta las aceptan. 1080 px sale de
   assets/hd (1200 px) y cumple el mínimo de 500×500 con holgura. */
function fotoDe(id, origen) {
  const archivo = fotos && fotos[id];
  if (!archivo) return null;
  return `${origen}/.netlify/images`
    + `?url=${encodeURIComponent('/assets/hd/' + archivo)}&fm=jpg&w=1080`;
}

const paginaDe = (id, origen) => `${origen}/${encodeURIComponent(`producto-${id}.html`)}`;

function categoriaGoogle(tipo) {
  if (tipo === 'brazalete') return 'Apparel & Accessories > Jewelry > Bracelets';
  if (tipo === 'anillo') return 'Apparel & Accessories > Jewelry > Rings';
  return 'Apparel & Accessories > Jewelry > Charms & Pendants';
}

function describir(tipo, nombre, grupo, talla) {
  if (tipo === 'brazalete') {
    return `${nombre}: brazalete para charms con baño de plata sobre base de alta resistencia. `
      + 'Elige tu talla y arma tu set con charms en Plata 925. Envíos a toda Colombia.';
  }
  if (tipo === 'anillo') {
    return `${nombre}, talla ${talla}: anillo en Plata 925. Envíos a toda Colombia.`;
  }
  return `${nombre}: charm en Plata Esterlina 925 con sello grabado`
    + (grupo && grupo !== 'Charms' ? ` · ${grupo}` : '')
    + '. Para tu brazalete de charms. Envíos a toda Colombia.';
}

/* Lo que se publica, como filas. Separado del handler para poder probarlo. */
export function filas(libres, origen = ORIGEN_POR_DEFECTO) {
  const items = (stock && stock.items) || {};
  const salida = [];

  Object.entries(items).forEach(([id, it]) => {
    const anillo = modeloAnillo(id);
    const tipo = it.tallas ? 'brazalete' : anillo ? 'anillo' : 'charm';

    let hay;
    if (it.tallas) {
      hay = TALLAS.reduce((n, t) => n + (libres[`${id}|${t}`] || 0), 0);
    } else {
      hay = libres[id] || 0;
    }

    const grupo = grupoDe(id, it);
    const nombreBase = TITULO_FEED[id] || nombres[id] || id;
    const imagen = fotoDe(id, origen);
    if (!imagen) return;   // Meta rechaza un artículo sin imagen; mejor no mandarlo

    salida.push({
      id,
      item_group_id: anillo ? anillo.modelo : '',
      title: nombreBase,
      description: describir(tipo, nombreBase.replace(/ · Talla .*$/, ''), grupo, anillo && anillo.talla),
      availability: hay > 0 ? 'in stock' : 'out of stock',
      condition: 'new',
      price: `${precioDe(id, it)} COP`,
      link: paginaDe(anillo ? anillo.modelo : id, origen),
      image_link: imagen,
      brand: MARCA,
      google_product_category: categoriaGoogle(tipo),
      product_type: `Joyería > ${grupo}`,
      size: anillo ? anillo.talla : '',
      custom_label_0: tipo,
      custom_label_1: grupo,
    });
  });

  return salida;
}

const COLUMNAS = ['id', 'item_group_id', 'title', 'description', 'availability', 'condition',
  'price', 'link', 'image_link', 'brand', 'google_product_category', 'product_type', 'size',
  'custom_label_0', 'custom_label_1'];

const celda = v => {
  const s = String(v == null ? '' : v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function aCSV(lista) {
  return [COLUMNAS.join(','), ...lista.map(f => COLUMNAS.map(c => celda(f[c])).join(','))].join('\n') + '\n';
}

/* Los sku que hay que preguntarle al almacén: `id` para un charm, `id|talla`
   para cada una de las cinco tallas de un brazalete. */
export function skusDe(items) {
  const skus = [];
  Object.entries(items).forEach(([id, it]) => {
    if (it.tallas) new Set([...Object.keys(it.tallas), ...TALLAS]).forEach(t => skus.push(`${id}|${t}`));
    else skus.push(id);
  });
  return skus;
}

export default async (req) => {
  let origen = ORIGEN_POR_DEFECTO;
  try { origen = new URL(req.url).origin; } catch { /* el de siempre */ }

  const items = (stock && stock.items) || {};
  const libres = await disponibles(skusDe(items));
  if (!libres) {
    return new Response('Inventario no disponible; reintentar más tarde.\n', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '900', 'Cache-Control': 'no-store' },
    });
  }

  return new Response(aCSV(filas(libres, origen)), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      /* Quince minutos: Meta descarga como mucho cada hora, y así una ráfaga de
         reintentos suyos no golpea Blobs en cada uno. */
      'Cache-Control': 'public, max-age=900',
    },
  });
};

export const config = { path: '/feeds/meta-catalogo.csv' };
