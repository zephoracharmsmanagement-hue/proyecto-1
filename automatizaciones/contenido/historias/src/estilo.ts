import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

/* Los mismos tokens de tienda.css: la historia tiene que verse como el sitio
   al que lleva el enlace. */
export const C = {
  bone: '#F6F3F4',
  ink: '#2A1F2E',
  plum: '#5C3D63',
  rose: '#B4657F',
  roseSoft: '#F3E6EB',
  silver: '#A9A6AE',
  gris: '#5E5463',
  line: '#E4DDE0',
  white: '#FFFFFF',
  estrella: '#F5B301',
};

export const SERIF = '"Cormorant Garamond", serif';
export const SANS = 'Jost, sans-serif';

const fuentes: [string, string, string, string][] = [
  ['Cormorant Garamond', 'CormorantGaramond-500.ttf', '500', 'normal'],
  ['Cormorant Garamond', 'CormorantGaramond-600.ttf', '600', 'normal'],
  ['Cormorant Garamond', 'CormorantGaramond-500i.ttf', '500', 'italic'],
  ['Jost', 'Jost-400.ttf', '400', 'normal'],
  ['Jost', 'Jost-500.ttf', '500', 'normal'],
  ['Jost', 'Jost-600.ttf', '600', 'normal'],
];

/* loadFont espera a que la fuente cargue antes de capturar el cuadro. */
export const cargarFuentes = () =>
  Promise.all(
    fuentes.map(([family, archivo, weight, style]) =>
      loadFont({family, url: staticFile(`fonts/${archivo}`), weight, style}),
    ),
  );

/* Zonas seguras de una historia de 1080×1920: arriba Instagram pone el
   nombre de la cuenta y la barra de progreso; abajo, el campo de respuesta.
   Nada importante fuera de 250–1650. */
export const SEGURO = {arriba: 250, abajo: 1650};

export const cop = (n: number) => '$' + n.toLocaleString('es-CO').replace(/,/g, '.');
