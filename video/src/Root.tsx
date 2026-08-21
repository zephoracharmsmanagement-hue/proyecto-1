import React from "react";
import { Composition } from "remotion";

import {
  AnuncioProducto,
  propsPorDefecto,
  type PropsAnuncio,
} from "./AnuncioProducto";
import { Armada, propsArmada, type PropsArmada } from "./Armada";
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

      {/*
        La pulsera armada solo va en 9x16, y es la excepción a la regla de
        arriba. Su foto ya es un creativo terminado de 502×900 —titular y logo
        quemados— así que el lienzo alargado la deja intacta y cualquier
        recorte a cuadrado o a 4x5 le parte el titular a media frase. Para
        feed, el camino es una toma limpia de producto por `AnuncioProducto`.
      */}
      <Composition
        id="Armada-9x16"
        component={Armada}
        durationInFrames={DURACION}
        fps={FPS}
        width={formatos["9x16"].width}
        height={formatos["9x16"].height}
        defaultProps={propsArmada satisfies PropsArmada}
      />
    </>
  );
};
