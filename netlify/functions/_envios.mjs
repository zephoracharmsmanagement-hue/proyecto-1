'use strict';
/* Los seis estados de envío que Skydropx puede reportar, y el texto exacto
 * que lee la clienta por cada uno — en código, no en el workflow de n8n. Así,
 * si Skydropx cambia cómo redacta sus correos, lo que hay que ajustar es el
 * reconocimiento del correo en n8n; lo que la clienta lee no se toca.
 */
const EVENTOS = ['creada', 'recogido', 'en_transito', 'en_reparto', 'entregado', 'excepcion'];

const TEXTOS = {
  creada: 'Tu pedido ya tiene guía de envío y va a ser recogido.',
  recogido: 'Tu pedido fue recogido y va en camino.',
  en_transito: 'Tu pedido está en camino.',
  en_reparto: 'Tu pedido llega hoy — está en la última etapa del envío.',
  entregado: '¡Tu pedido fue entregado! Esperamos que lo disfrutes 💛',
  excepcion: 'Hay una novedad con tu envío. Te contactamos por WhatsApp o correo en breve.',
};

export { EVENTOS, TEXTOS };
