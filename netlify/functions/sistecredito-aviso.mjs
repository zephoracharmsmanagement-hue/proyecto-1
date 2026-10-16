'use strict';
/* Lo que Sistecrédito llama cada vez que cambia el estado de una transacción
 * (urlConfirmation, por POST). Es el equivalente de addi-callback y de
 * wompi-webhook, y decide él y no la página de gracias: la clienta puede
 * cerrar la ventana de Sistecrédito y el pago haberse aprobado igual (la guía
 * G-ALI-12 dice que entonces el aviso tarda hasta 3 minutos).
 *
 * El aviso no viene firmado por Sistecrédito, así que no se cree:
 *   · si trae el extraData que se mandó al crear, la firma tiene que cuadrar;
 *   · siempre se vuelve a consultar la transacción con GetTransactionResponse
 *     (recomendación de la guía G-ALI-08), y lo que se aplica al pedido es esa
 *     consulta, nunca el cuerpo que llegó.
 */
import { leer } from './_pedidos.mjs';
import { consultar, aplicar, firmaValida, configurado } from './_sistecredito.mjs';

const json = (codigo, cuerpo) => new Response(JSON.stringify(cuerpo), {
  status: codigo, headers: { 'Content-Type': 'application/json; charset=utf-8' },
});

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Solo POST' });
  if (!configurado()) {
    console.error('Faltan las llaves de Sistecrédito: no se puede verificar el aviso');
    return json(503, { error: 'Sistecrédito sin configurar' });
  }

  let aviso;
  try { aviso = JSON.parse((await req.text()) || '{}'); } catch (_) { return json(400, { error: 'JSON inválido' }); }
  /* Puede llegar la transacción sola o envuelta como la respuesta de la API.
     Los avisos reales (comprobado en su modo de pruebas, 2026-10-15) traen el
     _id pero no el invoice donde lo trae la consulta: por eso del aviso solo
     se toma el _id, y todo lo demás sale de la consulta. */
  const d = aviso && aviso.data && typeof aviso.data === 'object' ? aviso.data : (aviso || {});
  const campo = (...nombres) => { for (const n of nombres) if (d[n] != null && d[n] !== '') return d[n]; return ''; };
  const id = String(campo('_id', 'id', 'Id', 'transactionId', 'TransactionId')).slice(0, 64);
  const invoiceAviso = String(campo('invoice', 'Invoice')).slice(0, 60);

  /* El rastro para conciliar contra el portal de Sistecrédito, pase lo que pase.
     `campos` son solo los NOMBRES de lo que trajo el aviso, para conocer su
     forma real sin dejar valores en el log. */
  console.log(JSON.stringify({ evento: 'sistecredito_aviso', referencia: invoiceAviso, transaccion: id,
    estado: String(campo('transactionStatus', 'TransactionStatus')), campos: Object.keys(d).slice(0, 40) }));

  if (!id) return json(400, { error: 'Falta el _id de la transacción' });

  const c = await consultar(id);
  if (!c.ok) {
    console.error(JSON.stringify({ evento: 'sistecredito_aviso_sin_verificar', transaccion: id, motivo: c.motivo }));
    return json(502, { error: 'No se pudo verificar la transacción' });
  }
  const t = c.t;
  if (invoiceAviso && t.invoice !== invoiceAviso) return json(409, { error: 'La transacción no corresponde a ese pedido' });
  const extra = d.extraData || d.ExtraData || {};
  const auth = extra.Authentication != null ? extra.Authentication : extra.authentication;
  if (auth != null && !firmaValida(t.invoice, auth)) {
    console.error('Aviso de Sistecrédito con una firma que no cuadra — descartado', t.invoice);
    return json(401, { error: 'No autorizado' });
  }

  const pedido = await leer(t.invoice);
  if (!pedido) {
    console.error('Aviso de Sistecrédito para un pedido que no está registrado', t.invoice);
    return json(404, { error: 'Pedido no encontrado' });
  }
  if (pedido.pago !== 'sistecredito') {
    console.error('Aviso de Sistecrédito para un pedido que no es de Sistecrédito', t.invoice, pedido.pago);
    return json(200, { ok: true, ignorado: true });
  }

  const r = await aplicar(t.invoice, pedido, t);
  console.log(JSON.stringify({ evento: 'sistecredito_aplicado', referencia: t.invoice, estado: t.estado, modo: r.modo }));
  return json(200, { ok: true, estado: r.estado });
};
