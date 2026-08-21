/**
 * El precio de «brazalete + 3 charms» que sale en el anuncio no está escrito a
 * mano: lo calcula `netlify/functions/_precios.js`, el mismo módulo que cobra
 * en producción. Es un rodeo aparente —sería más corto multiplicar— pero las
 * reglas son cuatro y se pisan entre ellas: escala de descuento por número de
 * charms, 30% del brazalete solo a partir de 3, empaque, y envío gratis desde
 * $180.000 midiendo mercancía y solo con pago anticipado. Reimplementarlas
 * aquí sería la cuarta copia, y la primera que nadie compara con las demás
 * (`pruebas/precios.js` ya vigila que el navegador y el servidor coincidan).
 *
 * La combinación es la más barata que el inventario permita hoy, así que la
 * cifra es un «desde» de verdad y se mueve sola cuando cambia el stock.
 */

import catalogo from "../../assets/catalogo.json";
import inventario from "../../assets/stock.json";
import precios from "../../netlify/functions/_precios.js";

type Existencia = {
  tipo: string;
  precio: number;
  stock?: number;
  tallas?: Record<string, number>;
};

const items = inventario.items as Record<string, Existencia>;
const tarifa = catalogo.precios as Record<string, number>;
const brazaletes: string[] = catalogo.pulseras;

/** Un brazalete tiene existencias por talla; un charm, un contador suelto. */
const hayStock = (id: string): boolean => {
  const it = items[id];

  if (!it) return false;
  if (it.tallas) return Object.values(it.tallas).some((n) => n > 0);

  return (it.stock ?? 0) > 0;
};

const tallaLibre = (id: string): string | null => {
  const tallas = items[id]?.tallas;

  if (!tallas) return null;

  return Object.keys(tallas).find((cm) => tallas[cm] > 0) ?? null;
};

const masBaratos = (ids: string[], cuantos: number): string[] =>
  ids
    .slice()
    .sort((a, b) => tarifa[a] - tarifa[b])
    .slice(0, cuantos);

export type Oferta = {
  charms: number;
  /** Lo que paga la clienta, envío incluido. */
  total: number;
  /** Lo que se ahorra frente a comprar las mismas piezas sueltas. */
  ahorro: number;
  envioGratis: boolean;
};

export const ofertaMinima = (charms = 3): Oferta => {
  const brazalete = masBaratos(brazaletes.filter(hayStock), 1)[0];
  const elegidos = masBaratos(
    Object.keys(tarifa).filter(
      (id) => !brazaletes.includes(id) && hayStock(id),
    ),
    charms,
  );

  if (!brazalete || elegidos.length < charms) {
    throw new Error(
      `No hay inventario para armar un brazalete con ${charms} charms. ` +
        `assets/stock.json es del conteo del ${inventario.conteo_inventario}.`,
    );
  }

  const pedido = precios.leerPedido({
    base: { id: brazalete, talla: tallaLibre(brazalete) },
    charms: elegidos,
    // El envío gratis es solo del prepago, así que el «desde» se calcula
    // sobre el camino que de verdad lo consigue.
    pago: "anticipado",
  });

  const cuenta = precios.calcular(pedido);

  return {
    charms,
    total: cuenta.total,
    ahorro: cuenta.descuento,
    envioGratis: cuenta.envioGratis,
  };
};
