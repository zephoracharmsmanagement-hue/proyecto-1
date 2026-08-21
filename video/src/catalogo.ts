/**
 * Los anuncios leen nombre y precio del mismo `assets/catalogo.json` que usan
 * el checkout y las funciones de Netlify. Es a propósito: un precio escrito a
 * mano aquí se queda viejo sin que nada avise, y el anuncio seguiría
 * publicando la cifra vieja mucho después de que el sitio cobre otra.
 */

import catalogo from "../../assets/catalogo.json";

export type Producto = {
  slug: string;
  nombre: string;
  precio: number;
  /** Ruta dentro del directorio público (que apunta a `assets/`). */
  imagen: string;
};

const nombres: Record<string, string> = catalogo.nombres;
const precios: Record<string, number> = catalogo.precios;

export const producto = (slug: string): Producto => {
  const nombre = nombres[slug];
  const precio = precios[slug];

  if (nombre === undefined || precio === undefined) {
    throw new Error(
      `"${slug}" no está en assets/catalogo.json. Los slugs válidos salen de ` +
        `index.html vía herramientas/extraer_catalogo.py.`,
    );
  }

  return { slug, nombre, precio, imagen: `${slug}.webp` };
};

/**
 * Formato colombiano —punto de miles, sin decimales— hecho a mano en vez de
 * con toLocaleString: el render corre dentro de Chrome headless y un mismo
 * proyecto tiene que dar el mismo fotograma en cualquier máquina.
 */
export const precioCOP = (valor: number): string =>
  "$" + String(Math.round(valor)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
