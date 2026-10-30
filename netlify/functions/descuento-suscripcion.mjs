'use strict';
/* ¿Este correo tiene el descuento de suscriptora? Lo pregunta el checkout en
 * cuanto la clienta escribe su correo, para mostrarle «Descuento de
 * suscriptora −$15.000» y el total nuevo ANTES de pagar (pedido del
 * propietario, 2026-10-29). Quien decide de verdad sigue siendo crear-pago, con
 * el mismo correo; esto solo adelanta lo que va a pasar.
 *
 * GET ?correo=… → { descuento, minimoPiezas }. `descuento` es 15000 o 0.
 *
 * ── Lo que deja ver, y por qué es aceptable ──
 *
 * Responde si un correo tiene el beneficio sin usar: eso dice, de paso, que
 * está suscrito. No dice nada más —ni desde cuándo, ni sus pedidos— y se
 * frena por IP para que no sirva para recorrer una lista de correos. Es lo
 * mismo que ya deja ver el checkout al aplicar el descuento.
 */
import { normalizar, correoValido, descuentoDisponible, configurado,
  DESCUENTO_SUSCRIPTORA, MIN_PIEZAS_DESCUENTO } from './_suscriptores.mjs';

const json = (codigo, cuerpo) => new Response(JSON.stringify(cuerpo), {
  status: codigo, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

/* 30 consultas por IP y hora: de sobra para quien corrige su correo varias
   veces, poco para recorrer una lista. En memoria de la función: se reinicia
   con ella, que es suficiente para frenar, no para contar. */
const consultas = new Map();
function frenar(ip) {
  const ahora = Date.now(), l = (consultas.get(ip) || []).filter(t => ahora - t < 3600e3);
  l.push(ahora); consultas.set(ip, l);
  if (consultas.size > 5000) consultas.clear();
  return l.length > 30;
}

export default async (req) => {
  if (req.method !== 'GET') return json(405, { error: 'Solo GET' });
  const correo = normalizar(new URL(req.url).searchParams.get('correo'));
  if (!correoValido(correo)) return json(400, { error: 'Correo no válido' });
  const ip = String(req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  if (frenar(ip || 'sin-ip')) return json(429, { error: 'Demasiadas consultas. Prueba más tarde.' });
  if (!configurado()) return json(200, { descuento: 0, minimoPiezas: MIN_PIEZAS_DESCUENTO });
  let tiene = false;
  try { tiene = await descuentoDisponible(correo); } catch (_) { tiene = false; }
  return json(200, { descuento: tiene ? DESCUENTO_SUSCRIPTORA : 0, minimoPiezas: MIN_PIEZAS_DESCUENTO });
};
