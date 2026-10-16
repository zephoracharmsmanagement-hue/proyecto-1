'use strict';
/* Lo que el checkout pregunta mientras Sistecrédito prepara el pago.
 *
 * Sistecrédito no entrega la URL de pago al crear la transacción: la pide al
 * medio de pago por detrás y aparece unos segundos después en
 * GetTransactionResponse (guía G-ALI-08, «Esperar respuesta»). El checkout
 * llama aquí cada poco con la referencia hasta que hay URL, y entonces manda a
 * la clienta. La consulta la hace la tienda con sus llaves, así que lo que
 * responde Sistecrédito es de fiar: si ya dice rechazado o aprobado —el modo
 * de pruebas pasa directo a un estado final, sin URL—, se aplica al pedido
 * aquí mismo, igual que lo haría el aviso.
 *
 * Respuestas: { url } · { esperando: true } · { terminado, estado, mensaje }.
 * Nunca devuelve datos de la clienta: la referencia es lo único que se sabe.
 */
import { leer } from './_pedidos.mjs';
import { consultar, aplicar, mensaje } from './_sistecredito.mjs';

const REF = /^ZC-\d{6}-[0-9A-F]{8}$/;

const json = (codigo, cuerpo) => new Response(JSON.stringify(cuerpo), {
  status: codigo, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

export default async (req) => {
  if (req.method !== 'GET') return json(405, { error: 'Solo GET' });
  const ref = new URL(req.url).searchParams.get('ref') || '';
  if (!REF.test(ref)) return json(400, { error: 'Referencia inválida' });

  const pedido = await leer(ref);
  if (!pedido || pedido.pago !== 'sistecredito' || !pedido.sistecreditoId) return json(404, { error: 'Pedido no encontrado' });

  if (pedido.estado === 'pagado') return json(200, { terminado: true, estado: 'aprobado' });
  if (String(pedido.estado || '').startsWith('pago-') || String(pedido.estado || '').startsWith('no-llego')) {
    return json(200, { terminado: true, estado: 'rechazado', mensaje: mensaje({ codigo: pedido.sistecreditoCodigo || '' }) });
  }

  const c = await consultar(pedido.sistecreditoId);
  /* Un fallo de red no es un rechazo: el checkout vuelve a preguntar. */
  if (!c.ok) return json(200, { esperando: true });
  const t = c.t;

  if (t.estado === 'Approved' || ['Rejected', 'Cancelled', 'Expired', 'Abandoned', 'Failed'].includes(t.estado)) {
    const a = await aplicar(ref, pedido, t);
    console.log(JSON.stringify({ evento: 'sistecredito_enlace', referencia: ref, estado: t.estado, modo: a.modo }));
    if (a.estado !== 'pendiente') return json(200, { terminado: true, estado: a.estado, mensaje: a.mensaje });
    return json(200, { esperando: true });
  }
  if (t.url) return json(200, { url: t.url });
  return json(200, { esperando: true });
};
