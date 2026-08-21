import React from "react";
import { Composition } from "remotion";

import {
  AnuncioProducto,
  propsPorDefecto,
  type PropsAnuncio,
} from "./AnuncioProducto";
import { DURACION, FPS, formatos } from "./marca";

/**
 * El mismo anuncio en los tres lienzos que pide Meta. Se registran los tres a
 * propósito: subir un solo 1x1 y dejar que Meta lo recorte para Reels es lo
 * que deja los precios cortados por la mitad.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {Object.entries(formatos).map(([nombre, medidas]) => (
        <Composition
          key={nombre}
          id={`Anuncio-${nombre}`}
          component={AnuncioProducto}
          durationInFrames={DURACION}
          fps={FPS}
          width={medidas.width}
          height={medidas.height}
          defaultProps={propsPorDefecto satisfies PropsAnuncio}
        />
      ))}
    </>
  );
};
