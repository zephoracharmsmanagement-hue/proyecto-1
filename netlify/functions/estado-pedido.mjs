'use strict';
/* En qué va un pedido, para la página de gracias.
 *
 * Con Wompi, gracias.html le pregunta a la API pública de Wompi por la
 * transacción. Addi no tiene nada parecido: la clienta vuelve con la
 * referencia y el resultado lo sabemos solo por addi-callback. Esto devuelve
 * ese resultado y nada más —ni nombre, ni dirección, ni piezas—: la referencia
 * va en la URL y no puede servir para leer datos de nadie.
 */
import { leer } from './_pedidos.mjs';

const responder = (codigo, cuerpo) => new Response(JSON.stringify(cuerpo), {
  status: codigo, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

/* El formato de referencia que genera crear-pago: ZC-AAMMDD-8 hex. */
const REF = /^ZC-\d{6}-[0-9A-F]{8}$/;

function simplificar(estado) {
  if (estado === 'pagado' || estado === 'confirmado') return 'aprobado';
  if (estado === 'esperando-pago') return 'pendiente';
  if (String(estado || '').startsWith('pago-') || String(estado || '').startsWith('no-llego')) return 'rechazado';
  return 'desconocido';
}

export default async (req) => {
  const ref = new URL(req.url).searchParams.get('ref') || '';
  if (!REF.test(ref)) return responder(400, { error: 'Referencia no válida' });
  const pedido = await leer(ref);
  if (!pedido) return responder(404, { estado: 'desconocido' });
  return responder(200, {
    referencia: ref,
    estado: simplificar(pedido.estado),
    total: (pedido.cuentas && pedido.cuentas.total) || null,
  });
};

export const _interno = { simplificar, REF };
