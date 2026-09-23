/* Catálogo y disponibilidad real, en una sola lectura.
 *
 * ── Para qué ──
 *
 * Para el asesor de WhatsApp, que hoy no existe pero que sin esto no puede
 * existir bien. El problema es que la disponibilidad está partida en dos
 * sitios y ninguno de los dos la sabe entera:
 *
 *   · `assets/stock.json` dice cuántas unidades se contaron. Es un archivo
 *     estático: no sabe nada de lo que pasó después.
 *   · El almacén `inventario` de Blobs lleva la cuenta de lo apartado por un
 *     pago en curso y de lo ya vendido. No sabe cuántas había.
 *
 * Un asesor que lea solo el archivo va a prometer piezas que ya tienen dueña.
 * Es el mismo error que la reserva de inventario vino a arreglar en el
 * checkout, solo que por WhatsApp, y ahí duele más: no hay una pantalla que
 * corrija, hay una persona que confió en lo que le dijeron.
 *
 * ── Por qué una función y no dejar que el prompt lea los archivos ──
 *
 * Porque la resta hay que hacerla en algún sitio, y el único que puede hacerla
 * bien es el servidor. Metiéndole los dos JSON crudos a un modelo se le está
 * pidiendo que haga aritmética de inventario, que es justo lo que los modelos
 * hacen mal y con toda seguridad. Aquí sale un número y el prompt lo lee.
 *
 * ── Qué NO es ──
 *
 * No es una promesa. `stock.json` se cuenta a mano, así que un `disponible: 2`
 * significa «según el último conteo, menos lo apartado, quedan 2». La página
 * ya lo dice así —«disponibilidad referencial»— y el asesor tiene que decirlo
 * igual.
 *
 * ── Falla hacia adelante, pero avisando ──
 *
 * Si Blobs no responde, se devuelve el catálogo con `fuente: 'solo-conteo'` y
 * SIN el campo `disponible`. Es a propósito: es preferible que el asesor diga
 * «déjame confirmarlo» a que prometa unidades que igual ya están apartadas.
 * Un número inventado por un fallo de red es peor que no tener número.
 */
/* Se leen a través de _precios.js y no con un import de JSON: ese módulo ya los
   carga con require, es la fuente que usa el checkout para cobrar, y así no
   dependemos de que el empaquetador de Netlify soporte import attributes. */
import { reglas, nombres, fotos, grupos, inventario as stock } from './_precios.js';
import { disponibles } from './_inventario.mjs';

/* ── La foto, y por qué pasa por el CDN de imágenes ──
 *
 * Las 113 fotos del sitio son `.webp`, y la Cloud API de WhatsApp **no acepta
 * webp** en un mensaje de imagen: solo JPEG y PNG (el webp le sirve únicamente
 * para stickers). Mandarle la URL cruda devuelve un error y la clienta se
 * queda sin ver nada.
 *
 * `/.netlify/images` convierte al vuelo. Así no hay una segunda copia en JPEG
 * de cada pieza que haya que acordarse de regenerar cuando se cambie una foto
 * —que es justo la clase de paso olvidable que deja al bot mandando la imagen
 * vieja—.
 *
 * 800 px es de sobra para el chat y deja el archivo en decenas de KB, no en
 * cientos.
 */
const ORIGEN_POR_DEFECTO = 'https://zephoracharms.com';

function fotoDe(id, origen) {
  const archivo = fotos && fotos[id];
  if (!archivo) return null;
  return `${origen}/.netlify/images`
    + `?url=${encodeURIComponent('/assets/' + archivo)}&fm=jpg&w=800`;
}

const CABECERAS = {
  'Content-Type': 'application/json; charset=utf-8',
  /* Un minuto. Suficiente para que una ráfaga de preguntas del asesor no
     golpee Blobs en cada una, y poco para que una pieza que se acaba de agotar
     no se siga ofreciendo el resto de la tarde. */
  'Cache-Control': 'public, max-age=60',
};

export default async (req) => {
  /* El origen sale de la petición y no de una constante para que esto siga
     funcionando en un deploy de vista previa, donde el dominio es otro. */
  let origen = ORIGEN_POR_DEFECTO;
  try { origen = new URL(req.url).origin; } catch { /* se queda el de siempre */ }

  const items = (stock && stock.items) || {};

  /* Un brazalete se cuenta por talla y un charm por pieza: la clave que lleva
     el inventario apartado es `id|talla` para los primeros. */
  const skus = [];
  Object.entries(items).forEach(([id, it]) => {
    if (it.tallas) Object.keys(it.tallas).forEach(t => skus.push(`${id}|${t}`));
    else skus.push(id);
  });

  const libres = await disponibles(skus);
  const fuente = libres ? 'conteo-menos-apartado' : 'solo-conteo';

  const piezas = [];
  const brazaletes = [];

  Object.entries(items).forEach(([id, it]) => {
    const base = {
      id,
      nombre: nombres[id] || id,
      precio: it.precio,
      /* URL pública en JPEG, lista para mandarse por WhatsApp sin convertir
         nada. Las 27 letras comparten la foto del grupo: no tienen una propia.
         Ver `fotos` en catalogo.json. */
      foto: fotoDe(id, origen),
      /* La categoría de la tienda —Disney, Marvel, Zodiaco, Símbolos…— y es
         lo que permite ofrecer algo parecido cuando lo que pidieron está
         agotado.

         `extraer_catalogo.py` la extrae desde 2026-08 con ese propósito escrito
         en su comentario, y hasta el 2026-09-19 nunca llegó hasta aquí: el bot
         tenía los nombres y las existencias, pero no sabía qué se parece a qué.
         Preguntaron por la Libélula Morada, estaba agotada, y contestó
         «mariposas, flores o algo morado» en vez de nombrar las dos piezas de
         Símbolos que sí había. Una venta que se cae por un campo que ya
         existía. */
      grupo: (grupos && grupos[id]) || null,
    };

    if (it.tallas) {
      const tallas = {};
      Object.keys(it.tallas).forEach(t => {
        /* Sin Blobs no se inventa un número: se omite el campo y el prompt
           tiene instrucciones de pedir confirmación cuando falta. */
        if (libres) tallas[t] = libres[`${id}|${t}`];
      });
      const hay = libres
        ? Object.values(tallas).reduce((n, v) => n + v, 0)
        : null;
      brazaletes.push(Object.assign(base, {
        tipo: 'brazalete',
        material: 'baño de plata sobre base de alta resistencia',
        tallas: libres ? tallas : null,
        agotado: libres ? hay === 0 : null,
      }));
      return;
    }

    const hay = libres ? libres[id] : null;
    piezas.push(Object.assign(base, {
      tipo: 'charm',
      /* La familia es lo que distingue un pasador de un clip o una cadena de
         seguridad, y también cuánto ocupa de cadena. El asesor lo necesita
         para responder «cuántos caben». */
      familia: it.familia || null,
      material: 'Plata Esterlina 925',
      disponible: hay,
      agotado: libres ? hay === 0 : null,
    }));
  });

  return new Response(JSON.stringify({
    generado: new Date().toISOString(),
    fuente,
    /* Las mismas reglas con las que cobra el checkout. Van aquí para que el
       asesor no tenga una copia propia que se desincronice: si cambia el
       descuento, cambia en un sitio. */
    reglas,
    aviso: fuente === 'solo-conteo'
      ? 'No se pudo leer lo apartado: no hay disponibilidad, solo catálogo. Confirmar antes de prometer.'
      : 'Disponibilidad referencial: conteo manual menos lo apartado por pagos en curso.',
    piezas,
    brazaletes,
  }), { status: 200, headers: CABECERAS });
};
