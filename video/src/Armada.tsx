import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { colores } from "./marca";
import { precioCOP } from "./catalogo";
import { ofertaMinima } from "./oferta";
import { texto, useTipografias } from "./tipografia";

export type PropsArmada = {
  /** Nombre del archivo dentro de `assets/`. */
  foto: string;
  gancho: string;
  cta: string;
  /** Cuántos charms lleva la oferta. A partir de 3 entra el 30% del brazalete. */
  charms: number;
};

export const propsArmada: PropsArmada = {
  foto: "pulsera-zephora-armada-con-charms-en-plata-925.webp",
  gancho: "Brazalete + 3 charms en plata 925",
  cta: "Arma la tuya",
  charms: 3,
};

/**
 * Anuncio de la pulsera armada.
 *
 * La foto **ya trae su propio titular y su logo quemados** —«La pulsera que
 * todas quieren»—, así que esta composición no pone ninguno de los dos: sería
 * un segundo titular encima del primero. Lo que aporta es lo que a la foto le
 * falta para ser un anuncio: movimiento, el precio real y un botón.
 *
 * Y por eso solo se registra en 9x16 (ver `Root.tsx`): la foto es 502×900, o
 * sea prácticamente 9:16 ya. Recortarla a cuadrado le corta el titular a
 * media frase.
 */
export const Armada: React.FC<PropsArmada> = ({ foto, gancho, cta, charms }) => {
  useTipografias();

  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const oferta = ofertaMinima(charms);

  const u = Math.min(width, height) / 100;

  const entra = (inicio: number, duracion = 18) =>
    interpolate(frame, [inicio, inicio + duracion], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });

  const sube = (progreso: number) => `translateY(${(1 - progreso) * u * 2.4}px)`;

  /**
   * Acercamiento lento. Tope 1,06: el titular de la foto empieza al 11% de la
   * altura y un recorte centrado se come la mitad de eso, así que por encima
   * de ahí se empieza a cortar la primera línea.
   */
  const acercamiento = interpolate(frame, [0, durationInFrames], [1, 1.06]);

  /** El bloque de oferta entra a los 1,3 s: antes, para que la foto se lea. */
  const salida = 40;
  const velo = entra(salida - 6, 24);
  const encabezado = entra(salida);
  const valor = entra(salida + 12);

  const rebote = spring({
    frame: frame - (salida + 30),
    fps,
    config: { damping: 14, mass: 0.6 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: colores.hueso, fontFamily: texto }}>
      <Img
        src={staticFile(foto)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${acercamiento})`,
        }}
      />

      {/*
        Sin este velo el texto cae sobre el cojín rosa y la mano, que no tienen
        contraste suficiente para leerlo. Arranca transparente a media altura
        para no ensuciar la foto.
      */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(to bottom,
            rgba(246,243,244,0) 46%,
            rgba(246,243,244,.82) 62%,
            ${colores.hueso} 74%)`,
          opacity: velo,
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          textAlign: "center",
          padding: `0 ${u * 8}px ${u * 8}px`,
          gap: u * 1.8,
          color: colores.tinta,
        }}
      >
        <span
          style={{
            fontSize: u * 2.6,
            letterSpacing: u * 0.3,
            textTransform: "uppercase",
            color: colores.rosa,
            opacity: encabezado,
            transform: sube(encabezado),
          }}
        >
          {gancho}
        </span>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: u * 1.4,
            opacity: valor,
            transform: sube(valor),
          }}
        >
          <span style={{ fontSize: u * 2.8, color: colores.plata }}>desde</span>
          <span style={{ fontSize: u * 7.5, fontWeight: 300 }}>
            {precioCOP(oferta.total)}
          </span>
        </div>

        <span
          style={{
            fontSize: u * 2.6,
            color: colores.ciruela,
            opacity: valor,
            transform: sube(valor),
          }}
        >
          Ahorras {precioCOP(oferta.ahorro)}
          {oferta.envioGratis ? " · Envío gratis" : ""}
        </span>

        <div
          style={{
            marginTop: u * 1.5,
            padding: `${u * 2}px ${u * 5}px`,
            borderRadius: u * 10,
            backgroundColor: colores.rosa,
            color: colores.hueso,
            fontSize: u * 3.2,
            fontWeight: 500,
            letterSpacing: u * 0.1,
            opacity: Math.min(1, rebote * 1.4),
            transform: `scale(${interpolate(rebote, [0, 1], [0.9, 1])})`,
          }}
        >
          {cta}
        </div>

        <span
          style={{
            marginTop: u * 1.2,
            fontSize: u * 2,
            letterSpacing: u * 0.2,
            color: colores.plata,
            opacity: entra(salida + 50, 20),
          }}
        >
          zephoracharms.com
        </span>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
