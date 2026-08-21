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
import { precioCOP, producto } from "./catalogo";
import { texto, titular, useTipografias } from "./tipografia";

export type PropsAnuncio = {
  /** Slug del catálogo: define foto, nombre y precio. */
  slug: string;
  /** Línea corta de arriba. En mayúsculas queda mejor con el espaciado. */
  gancho: string;
  cta: string;
};

export const propsPorDefecto: PropsAnuncio = {
  slug: "pulsera-corazon-pave",
  gancho: "Plata 925 · Envío a toda Colombia",
  cta: "Arma la tuya",
};

export const AnuncioProducto: React.FC<PropsAnuncio> = ({
  slug,
  gancho,
  cta,
}) => {
  useTipografias();

  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const pieza = producto(slug);

  /**
   * Todo se mide contra el lado corto del lienzo, así que el mismo componente
   * sirve para 9x16, 4x5 y 1x1 sin una sola medida en píxeles.
   */
  const u = Math.min(width, height) / 100;

  /** En 1x1 no cabe la foto encima del texto: van lado a lado. */
  const apilado = height / width > 1.1;

  /**
   * Lado a lado, el texto se queda con media pantalla: al mismo tamaño el
   * gancho parte "ENVÍO A TODA / COLOMBIA" en dos renglones y el nombre come
   * tres. Toda la tipografía baja un escalón en ese layout.
   */
  const k = apilado ? 1 : 0.8;

  /**
   * Apilada, la foto no puede ocupar todo el ancho: en 4x5 empuja el botón
   * fuera del lienzo y lo tapa el dominio del pie. Se mide contra el alto, que
   * es el lado escaso, y el ancho sale de ahí.
   */
  const ladoFoto = Math.min(width - u * 14, height * 0.44);

  const entra = (inicio: number, duracion = 18) =>
    interpolate(frame, [inicio, inicio + duracion], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });

  const sube = (progreso: number) => `translateY(${(1 - progreso) * u * 2.4}px)`;

  /** Acercamiento lento y continuo: la joya nunca se queda quieta del todo. */
  const acercamiento = interpolate(frame, [0, durationInFrames], [1, 1.07]);

  const rebote = spring({
    frame: frame - 84,
    fps,
    config: { damping: 14, mass: 0.6 },
  });

  const fotograma = entra(6, 24);
  const encabezado = entra(24);
  const nombre = entra(34);
  const valor = entra(48);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colores.hueso,
        color: colores.tinta,
        fontFamily: texto,
      }}
    >
      <AbsoluteFill
        style={{
          // Arriba y abajo se deja aire de más: ahí viven la firma y el
          // dominio, que están posicionados contra el borde del lienzo.
          padding: `${u * 11}px ${u * 7}px ${u * 10}px`,
          display: "flex",
          flexDirection: apilado ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: u * 6,
        }}
      >
        <div
          style={{
            flex: apilado ? "0 0 auto" : "0 0 44%",
            width: apilado ? ladoFoto : undefined,
            height: apilado ? ladoFoto : undefined,
            aspectRatio: "1 / 1",
            borderRadius: u * 3,
            overflow: "hidden",
            backgroundColor: colores.blanco,
            boxShadow: `0 ${u * 1.6}px ${u * 5}px rgba(42,31,46,.10)`,
            opacity: fotograma,
            transform: `scale(${interpolate(fotograma, [0, 1], [1.04, 1])})`,
          }}
        >
          <Img
            src={staticFile(pieza.imagen)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${acercamiento})`,
            }}
          />
        </div>

        <div
          style={{
            // Apilada no puede crecer: en 9x16 se comería el espacio libre
            // entera y dejaría el bloque pegado al borde de arriba.
            flex: apilado ? "0 0 auto" : "1 1 auto",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: apilado ? "center" : "flex-start",
            textAlign: apilado ? "center" : "left",
            gap: u * 2,
          }}
        >
          <span
            style={{
              fontSize: u * 2.4 * k,
              fontWeight: 400,
              letterSpacing: u * 0.32 * k,
              textTransform: "uppercase",
              color: colores.rosa,
              opacity: encabezado,
              transform: sube(encabezado),
            }}
          >
            {gancho}
          </span>

          <h1
            style={{
              margin: 0,
              fontFamily: titular,
              fontWeight: 300,
              fontSize: u * 8.5 * k,
              lineHeight: 1.05,
              opacity: nombre,
              transform: sube(nombre),
            }}
          >
            {pieza.nombre}
          </h1>

          <div
            style={{
              width: u * 12,
              height: 2,
              backgroundColor: colores.linea,
              opacity: nombre,
            }}
          />

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: u * 1.2,
              opacity: valor,
              transform: sube(valor),
            }}
          >
            <span style={{ fontSize: u * 6 * k, fontWeight: 300 }}>
              {precioCOP(pieza.precio)}
            </span>
            <span
              style={{
                fontSize: u * 2.2 * k,
                letterSpacing: u * 0.2,
                color: colores.plata,
              }}
            >
              COP
            </span>
          </div>

          <div
            style={{
              marginTop: u * 1.5,
              padding: `${u * 2 * k}px ${u * 4.5 * k}px`,
              borderRadius: u * 10,
              backgroundColor: colores.rosa,
              color: colores.hueso,
              fontSize: u * 3 * k,
              fontWeight: 500,
              letterSpacing: u * 0.1,
              opacity: Math.min(1, rebote * 1.4),
              transform: `scale(${interpolate(rebote, [0, 1], [0.9, 1])})`,
            }}
          >
            {cta}
          </div>
        </div>
      </AbsoluteFill>

      <span
        style={{
          position: "absolute",
          top: u * 5,
          width: "100%",
          textAlign: "center",
          fontSize: u * 2,
          fontWeight: 300,
          letterSpacing: u * 0.7,
          textTransform: "uppercase",
          color: colores.ciruela,
          opacity: entra(0, 20) * 0.85,
        }}
      >
        Zephora Charms
      </span>

      <span
        style={{
          position: "absolute",
          bottom: u * 4,
          width: "100%",
          textAlign: "center",
          fontSize: u * 2,
          letterSpacing: u * 0.2,
          color: colores.plata,
          opacity: entra(96, 20),
        }}
      >
        zephoracharms.com
      </span>
    </AbsoluteFill>
  );
};
