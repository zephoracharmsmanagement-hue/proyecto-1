/**
 * Las mismas dos familias del sitio —Cormorant Garamond para los titulares y
 * Jost para todo lo demás—, pero servidas desde `src/fuentes/` en vez de desde
 * Google Fonts.
 *
 * El sitio sí las pide a fonts.googleapis.com; aquí no, y la diferencia
 * importa: un render que depende de la red produce fotogramas distintos según
 * si la descarga alcanzó a llegar, y falla entero detrás de un proxy. Los dos
 * archivos son el subconjunto latino (48 KB entre los dos) y están bajo la
 * SIL Open Font License, que permite redistribuirlos.
 *
 * Jost es una fuente variable: un solo archivo cubre de 100 a 900.
 */

import { continueRender, delayRender, cancelRender } from "remotion";
import { useEffect, useState } from "react";

import cormorant from "./fuentes/cormorant-garamond-300-latin.woff2";
import jost from "./fuentes/jost-variable-latin.woff2";

export const titular = "Cormorant Garamond, Georgia, serif";
export const texto = "Jost, system-ui, sans-serif";

const registrar = async () => {
  const caras = [
    new FontFace("Cormorant Garamond", `url(${cormorant}) format("woff2")`, {
      weight: "300",
      style: "normal",
    }),
    new FontFace("Jost", `url(${jost}) format("woff2")`, {
      weight: "100 900",
      style: "normal",
    }),
  ];

  await Promise.all(
    caras.map(async (cara) => {
      await cara.load();
      document.fonts.add(cara);
    }),
  );
};

const listas = registrar();

/**
 * Frena el render hasta que las dos familias estén registradas. Sin esto, los
 * primeros fotogramas salen con la fuente de reemplazo y el texto salta.
 */
export const useTipografias = () => {
  const [espera] = useState(() => delayRender("Cargando tipografías"));

  useEffect(() => {
    listas.then(
      () => continueRender(espera),
      (error: Error) => cancelRender(error),
    );
  }, [espera]);
};
