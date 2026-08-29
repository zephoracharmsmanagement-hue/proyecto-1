/* Cerrar un contraentrega: despacharlo o anularlo.
 *
 * ── Por qué existe ──
 *
 * Un pedido contraentrega ya no descuenta inventario al crearse: deja las
 * unidades apartadas en una reserva larga que caduca sola (ver
 * `VIGENCIA_CONTRAENTREGA_MS` en `_inventario.mjs`). Eso arregla el error que
 * se descubrió el 2026-08-29 —pruebas y pedidos no concretados llevándose
 * unidades para siempre—, pero abre el error contrario: si el paquete sale y
 * nadie confirma la reserva, a las 72 horas las unidades vuelven al mostrador y
 * la tienda ofrece algo que ya va en camino. Sobrevender es peor que perder una
 * venta, porque hay una clienta que ya pagó.
 *
 * Así que el ciclo necesita un final explícito, y este es el único sitio donde
 * ocurre. Con la clienta confirmando por WhatsApp: `despachar`. Si el pedido se
 * cae: `anular`, y las unidades vuelven sin esperar a que caduque.
 *
 * ── Por qué un endpoint, si `_pedidos.mjs` dice que no ──
 *
 * Ese módulo evita a propósito exponer endpoints nuevos «en un sitio que
 * cobra», y para *consultar* tiene razón: la terminal sirve igual. Aquí no,
 * porque el momento de confirmar es una conversación de WhatsApp desde el
 * celular, y un paso operativo que exige abrir un portátil es un paso que no se
 * da. Un pedido sin cerrar es justo lo que rompe el inventario.
 *
 * El compromiso es que esto no amplía lo que un atacante puede hacer: exige un
 * token que no está en el repo, solo actúa sobre referencias que ya existen, y
 * no mueve dinero —Wompi no pasa por aquí—. Lo peor que consigue quien entre es
 * desordenar el inventario, que es lo mismo que consigue quien haga pedidos
 * falsos por el checkout.
 *
 * Variables de entorno:
 *   ADMIN_TOKEN   obligatorio. Sin él la función responde 503 y no hace nada:
 *                 un endpoint que muta inventario no puede quedar abierto
 *                 porque falte configurar una variable.
 */
import { confirmar, liberar } from './_inventario.mjs';
import { marcar, leer, listar } from './_pedidos.mjs';
import { anotarVenta } from './_hoja.mjs';

const CABECERAS = { 'Content-Type': 'application/json; charset=utf-8' };
const responder = (codigo, cuerpo) =>
  new Response(JSON.stringify(cuerpo), { status: codigo, headers: CABECERAS });

/* Comparación en tiempo constante. Con `===` el tiempo de respuesta filtra
   cuántos caracteres acertó quien prueba, y un token se saca a fuerza de
   medir. Son dos líneas y quita el problema entero. */
function igual(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

function autorizado(req) {
  const esperado = String(process.env.ADMIN_TOKEN || '').trim();
  if (!esperado) return null;          // sin configurar: no se autoriza a nadie
  const cabecera = req.headers.get('x-zephora-admin') || '';
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  return igual(cabecera, esperado) || igual(bearer, esperado);
}

export default async (req) => {
  const esperado = String(process.env.ADMIN_TOKEN || '').trim();
  if (!esperado) {
    console.error('pedido-cerrar: falta ADMIN_TOKEN, la función queda cerrada');
    return responder(503, { error: 'Sin configurar.' });
  }
  if (!autorizado(req)) return responder(401, { error: 'No autorizado.' });

  /* GET: qué está esperando confirmación. Es la mitad que hace usable a la
     otra — sin esto hay que acordarse de memoria de qué pedidos quedaron a
     medias, y acordarse de memoria es exactamente lo que falló. */
  if (req.method === 'GET') {
    const pedidos = await listar();
    const abiertos = pedidos
      .filter(p => p && p.estado === 'por-confirmar')
      .sort((a, b) => String(a.creado || '').localeCompare(String(b.creado || '')));
    return responder(200, {
      pendientes: abiertos.length,
      pedidos: abiertos.map(p => ({
        referencia: p.referencia,
        creado: p.creado,
        total: p.cuentas && p.cuentas.total,
        cliente: p.cliente && p.cliente.nombre,
        telefono: p.cliente && p.cliente.telefono,
        ciudad: p.cliente && `${p.cliente.ciudad}, ${p.cliente.depto}`,
        piezas: (p.lineas || []).map(l =>
          l.talla ? `${l.nombre} (talla ${l.talla})` : l.nombre),
      })),
    });
  }

  if (req.method !== 'POST') return responder(405, { error: 'Método no permitido.' });

  let cuerpo;
  try { cuerpo = await req.json(); }
  catch { return responder(400, { error: 'Cuerpo ilegible.' }); }

  const referencia = String((cuerpo && cuerpo.referencia) || '').trim();
  const accion = String((cuerpo && cuerpo.accion) || '').trim();
  if (!referencia) return responder(400, { error: 'Falta la referencia.' });
  if (accion !== 'despachar' && accion !== 'anular') {
    return responder(400, { error: 'La acción es "despachar" o "anular".' });
  }

  const pedido = await leer(referencia);
  if (!pedido) return responder(404, { error: 'No existe ese pedido.' });

  /* Idempotente: cerrar dos veces el mismo pedido no puede descontar dos veces.
     Se responde 200 y no un error porque quien reintenta —un doble toque en el
     celular, una conexión que se cortó— necesita saber en qué quedó, no que
     algo falló. */
  if (pedido.estado === 'despachado' || pedido.estado === 'anulado') {
    return responder(200, { referencia, estado: pedido.estado, repetido: true });
  }

  if (accion === 'anular') {
    const suelto = await liberar(referencia);
    await marcar(referencia, { estado: 'anulado', motivo: cuerpo.motivo || 'anulado a mano' });
    console.log(JSON.stringify({
      evento: 'pedido_anulado', referencia, inventario: suelto.modo,
    }));
    return responder(200, { referencia, estado: 'anulado', inventario: suelto.modo });
  }

  /* Despachar: la reserva pasa a vendido y deja de caducar. Este es el momento
     en que las unidades salen de verdad del inventario — no cuando se hizo el
     pedido. */
  const cierre = await confirmar(referencia);
  await marcar(referencia, { estado: 'despachado' });

  /* La hoja ya tiene este pedido como `pendiente`. Esta segunda fila lo cierra
     como `vendido`, con el mismo `referencia` + `id` + `talla`: n8n tiene que
     ACTUALIZAR la fila que ya existe, no insertar otra, o la hoja contará el
     pedido dos veces y la reposición saldrá inflada. */
  await anotarVenta({
    referencia,
    pago: pedido.pago || 'contraentrega',
    cuando: new Date().toISOString(),
    ciudad: pedido.cliente && `${pedido.cliente.ciudad}, ${pedido.cliente.depto}`,
    estado: 'vendido',
    total: pedido.cuentas && pedido.cuentas.total,
    lineas: pedido.lineas || [],
    restante: cierre.restante,
  });

  console.log(JSON.stringify({
    evento: 'pedido_despachado', referencia, inventario: cierre.modo,
  }));
  return responder(200, { referencia, estado: 'despachado', inventario: cierre.modo });
};
