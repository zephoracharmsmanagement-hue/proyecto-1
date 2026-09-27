/* «N personas compraron esta pieza este mes», contado de pedidos reales.
 *
 * Existe en lugar del contador de «personas viendo» que NO se construye
 * (automatizaciones/tienda/ENCARGO-FICHA.md § Reglas de verdad): un número
 * inventado es publicidad engañosa ante la SIC. Aquí se cuentan pedidos —una
 * persona es un pedido, no una unidad— de los últimos 30 días que de verdad
 * salieron: contraentrega confirmado, pago en línea aprobado o venta manual.
 * Y solo se devuelven las piezas con 3 o más: por debajo no se dice nada.
 *
 * Público y sin datos personales: solo id → número. Se cachea 10 minutos en
 * la instancia y en el navegador para no leer todos los pedidos en cada
 * visita.
 */
import { listar } from './_pedidos.mjs';

const VALIDOS = new Set(['confirmado', 'pagado', 'venta-manual']);
const MINIMO = 3;
const DIAS = 30;
let cache = null;

export async function contar(ahora = Date.now()) {
  const pedidos = await listar();
  const desde = ahora - DIAS * 864e5;
  const cuenta = {};
  for (const p of pedidos) {
    if (!p || !VALIDOS.has(p.estado) || p.pago === 'regalo') continue;
    if (!(Date.parse(p.creado) >= desde)) continue;
    new Set((p.lineas || []).map(l => l.id)).forEach(id => { cuenta[id] = (cuenta[id] || 0) + 1; });
  }
  const ventas = {};
  Object.entries(cuenta).forEach(([id, n]) => { if (n >= MINIMO) ventas[id] = n; });
  return ventas;
}

export default async () => {
  if (!cache || Date.now() - cache.en > 10 * 60 * 1000) cache = { en: Date.now(), ventas: await contar() };
  return new Response(JSON.stringify({ dias: DIAS, minimo: MINIMO, ventas: cache.ventas }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=600' },
  });
};

export const _interno = { limpiar() { cache = null; } };
