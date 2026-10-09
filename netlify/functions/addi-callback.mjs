'use strict';
/* Lo que Addi llama cuando decide una solicitud de crédito.
 *
 * Es el equivalente de wompi-webhook para Addi, y por la misma razón decide
 * él y no la página de gracias: la clienta puede no volver al sitio y la
 * compra haberse aprobado igual.
 *
 * Reglas de Addi (manual «Integración del método de pago» y su spec):
 *   · Llega con Basic Auth: las «credenciales de notificación» del portal de
 *     aliados. Sin ellas, la URL es pública y cualquiera podría decir
 *     «aprobado» — así que sin credenciales correctas no se cree nada.
 *   · Cuerpo: { orderId, applicationId, approvedAmount, currency, status,
 *     statusTimestamp }. status: APPROVED · PENDING · REJECTED · DECLINED ·
 *     ABANDONED · INTERNAL_ERROR. Addi no aprueba parcial: approvedAmount es 0
 *     salvo en APPROVED, donde es el total pedido.
 *   · Para darlo por entregado, Addi espera un 200 con EXACTAMENTE el mismo
 *     cuerpo que mandó. Si no, reintenta cada 30 minutos durante 24 horas.
 *
 * La URL no se configura en ningún panel: viaja en cada solicitud
 * (allyUrlRedirection.callbackUrl), ver _addi.mjs.
 */
import { autorizado } from './_addi.mjs';
import { cerrarPago } from './_cierre.mjs';
import { leer, marcar } from './_pedidos.mjs';

const texto = (codigo, mensaje) => new Response(mensaje, { status: codigo });

/* El 200 que Addi espera: su mismo cuerpo, byte por byte. */
const eco = crudo => new Response(crudo, {
  status: 200, headers: { 'Content-Type': 'application/json' },
});

const NEGATIVOS = new Set(['REJECTED', 'DECLINED', 'ABANDONED', 'INTERNAL_ERROR']);

export default async (req) => {
  if (req.method !== 'POST') return texto(405, 'Solo POST');

  if (!process.env.ADDI_NOTIF_USUARIO || !process.env.ADDI_NOTIF_CLAVE) {
    console.error('Faltan ADDI_NOTIF_USUARIO / ADDI_NOTIF_CLAVE: no se puede verificar el aviso de Addi');
    /* 503 y no 200: Addi reintenta durante 24 horas, y en cuanto alguien
       configure las variables el aviso entra solo. */
    return texto(503, 'Notificaciones de Addi sin configurar');
  }
  if (!autorizado(req.headers.get('authorization'))) {
    console.error('Aviso de Addi con credenciales que no cuadran — descartado');
    return texto(401, 'No autorizado');
  }

  const crudo = await req.text();
  let aviso;
  try {
    aviso = JSON.parse(crudo || '{}');
  } catch (_) {
    return texto(400, 'JSON inválido');
  }

  const referencia = String(aviso.orderId || '').slice(0, 60);
  const estado = String(aviso.status || '').toUpperCase();
  const aprobado = Number(String(aviso.approvedAmount || '0').replace(/[^\d.]/g, '')) || 0;
  const cuandoMs = /^\d{9,13}$/.test(String(aviso.statusTimestamp || ''))
    ? (String(aviso.statusTimestamp).length > 10 ? Number(aviso.statusTimestamp) : Number(aviso.statusTimestamp) * 1000)
    : Date.now();

  /* El rastro para conciliar contra el portal de Addi, pase lo que pase. */
  console.log(JSON.stringify({
    evento: 'addi_' + (estado.toLowerCase() || 'desconocido'),
    referencia, solicitud: aviso.applicationId || null, estado, aprobado,
  }));

  if (!referencia) return texto(400, 'Falta orderId');

  const pedido = await leer(referencia);
  if (!pedido) {
    /* Sin registro no se toca nada: puede ser que el almacén falló un momento.
       404 hace que Addi reintente en 30 minutos en vez de darlo por cerrado. */
    console.error('Aviso de Addi para un pedido que no está registrado', referencia);
    return texto(404, 'Pedido no encontrado');
  }
  if (pedido.pago !== 'addi') {
    console.error('Aviso de Addi para un pedido que no es de Addi', referencia, pedido.pago);
    return eco(crudo);
  }

  /* Reintentos de Addi sobre un pedido ya cerrado: se contestan igual, sin
     volver a mandar correos ni Purchase. */
  if (pedido.estado === 'pagado' || (String(pedido.estado || '').startsWith('pago-') && estado !== 'APPROVED')) {
    return eco(crudo);
  }

  if (estado === 'PENDING' || !estado) {
    /* Sigue decidiéndose: la reserva se queda como está. */
    await marcar(referencia, { addiEstado: estado || 'desconocido', addiSolicitud: aviso.applicationId || null });
    return eco(crudo);
  }

  const total = pedido.cuentas && pedido.cuentas.total;
  if (estado === 'APPROVED' && total && Math.abs(aprobado - total) > 1) {
    /* No debería pasar —Addi no aprueba parcial—, pero si pasa la tienda
       tiene que verlo antes de despachar. La venta sigue: Addi respondió por
       el monto que aprobó. */
    console.error(JSON.stringify({ evento: 'addi_monto_distinto', referencia, pedido: total, aprobado }));
  }

  if (estado === 'APPROVED' || NEGATIVOS.has(estado)) {
    const c = pedido.cliente || {};
    await cerrarPago({
      referencia,
      aprobado: estado === 'APPROVED',
      estado,
      transaccion: aviso.applicationId || null,
      metodo: 'ADDI',
      total: estado === 'APPROVED' ? (aprobado || total) : total,
      correo: c.correo || null,
      telefono: c.celular || null,
      nombre: c.nombre ? `${c.nombre} ${c.apellido || ''}`.trim() : null,
      cuandoMs,
      medio: 'addi',
    });
  } else {
    console.error('Estado de Addi desconocido, no se toca el pedido', referencia, estado);
  }

  return eco(crudo);
};
