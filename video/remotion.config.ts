/**
 * Nota: las APIs de Node.JS no leen este archivo. Al usarlas, las opciones van
 * directas en la llamada.
 *
 * Todas las opciones: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

/**
 * El directorio público apunta a las fotos del sitio en vez de a un `public/`
 * propio. Copiarlas aquí las dejaría desactualizadas en cuanto se cambie una
 * foto de producto —ya pasó dos veces con las tomas limpias—, y son 13 MB que
 * el repo ya tiene versionados una vez.
 *
 * Con esto, `staticFile("pulsera-corazon-pave.webp")` sale de `assets/`.
 */
Config.setPublicDir("../assets");

/**
 * Por defecto Remotion se baja su propio Chrome de remotion.media. Donde esa
 * descarga esté bloqueada —redes con lista blanca, CI— se le pasa un Chrome ya
 * instalado por esta variable, por ejemplo el que trae Playwright:
 *
 *   REMOTION_BROWSER_EXECUTABLE=/ruta/a/headless_shell npm run render
 */
const navegador = process.env.REMOTION_BROWSER_EXECUTABLE;

if (navegador) {
  Config.setBrowserExecutable(navegador);
}
