/**
 * Tokens de marca de Zephora Charms.
 *
 * Copiados del bloque `:root` de index.html. Si allá cambia un color, aquí hay
 * que cambiarlo también: no hay forma de importar CSS desde el sitio sin
 * arrastrarse la hoja entera, y son cinco valores.
 */

export const colores = {
  hueso: "#F6F3F4",
  tinta: "#2A1F2E",
  ciruela: "#5C3D63",
  rosa: "#B4657F",
  rosaSuave: "#F3E6EB",
  plata: "#A9A6AE",
  linea: "#E4DDE0",
  blanco: "#FFFFFF",
} as const;

/**
 * Los tres lienzos que acepta Meta para anuncios de imagen y video. El mismo
 * componente se registra en los tres; el layout se decide por proporción, no
 * por un id de formato, para que agregar uno nuevo no toque el componente.
 */
export const formatos = {
  "9x16": { width: 1080, height: 1920 },
  "4x5": { width: 1080, height: 1350 },
  "1x1": { width: 1080, height: 1080 },
} as const;

export const FPS = 30;

/** 6 segundos: lo que aguanta un Reel antes de que la gente pase de largo. */
export const DURACION = 6 * FPS;
