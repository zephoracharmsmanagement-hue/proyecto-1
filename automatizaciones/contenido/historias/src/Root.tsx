import React from 'react';
import {Still, continueRender, delayRender} from 'remotion';
import {Historia, HistoriaProps} from './Historia';
import {cargarFuentes} from './estilo';

const espera = delayRender('Fuentes de la marca');
cargarFuentes().then(() => continueRender(espera));

const ejemplo: HistoriaProps = {
  id: 'ejemplo',
  plantilla: 'anuncio',
  titulo: 'Zephora',
};

export const Root: React.FC = () => (
  <Still id="Historia" component={Historia} width={1080} height={1920} defaultProps={ejemplo} />
);
