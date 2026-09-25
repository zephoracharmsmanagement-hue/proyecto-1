# Registrar ventas hechas fuera del checkout — encargo para la sesión de la tienda

Aprobado por el propietario el 2026-09-25. Lo escribió la sesión de pauta
(`claude/charming-sagan-l4q2eq`); lo construye **la sesión que está editando la
tienda**, porque solo una sesión toca `netlify/functions/`. Sale en el mismo
despliegue de esa edición: no suma créditos.

## El problema

Las ventas del checkout web (Wompi y contraentrega) ya se descuentan solas en
el contador de Blobs (`_inventario.mjs`, `confirmar()`). Las que se cierran por
WhatsApp y se pagan por fuera (transferencia, Nequi, efectivo) no pasan por
ahí: el sitio sigue ofreciendo unidades que ya se vendieron. Hoy el único
arreglo es bajar `stock.json` y desplegar (~15 créditos por venta), o que el
propietario haga el pedido como contraentrega a nombre del cliente, que:

- suma $20.000 de envío que nadie cobró y marca un medio de pago falso;
- manda el `Purchase` a Meta **con las cookies y la IP del celular del
  propietario**: lo mete en el público de compradores y le enseña a Meta a
  buscar gente parecida a él.

## Qué construir

Una función `netlify/functions/registrar-venta.mjs`, `POST`, sin página. La
llama un formulario de n8n (lo arma la sesión de pauta cuando la función
exista). Antes de escribirla, `ls netlify/functions/` por si algo parecido ya
entró.

**Autenticación.** Mismo patrón que `envio-estado.mjs`: cabecera
`x-zephora-automation-key` comparada en tiempo constante contra una variable
nueva `VENTA_MANUAL_KEY`. Sin clave o clave distinta → 401 y nada más.

**Entrada (JSON):**

```json
{
  "charms": ["spider-man", "iron-man"],
  "base": { "id": "pulsera-avengers", "talla": "19" },
  "pago": "transferencia",          // transferencia | nequi | efectivo | otro
  "total": 252800,                  // lo que de verdad se cobró, en COP
  "telefono": "3001234567",         // opcional, para Meta
  "correo": "",                     // opcional
  "nombre": "",                     // opcional
  "nota": ""                        // opcional, texto libre
}
```

**Qué hace, en orden:**

1. Valida con `leerPedido()` de `_precios.js` (ids y tallas que existen). Pieza
   desconocida → 400 con el id que falló.
2. Referencia propia con prefijo distinguible, p. ej. `MAN-<fecha>-<azar>`.
3. `reservar(ref, pedido)` y enseguida `confirmar(ref)` de `_inventario.mjs`:
   el mismo CAS del checkout, así que no puede pisarse con una venta web.
   **Aquí sí se bloquea sin stock** (a diferencia del checkout, que falla hacia
   adelante): si `SinInventario`, 409 con el mensaje, para que el propietario
   sepa que el conteo está mal antes de despachar.
4. `anotarVenta()` de `_hoja.mjs` con `pago` real, `total` real y el
   `restante` que devuelve `confirmar()`.
5. `purchase()` de `_meta.js` con teléfono/correo/nombre del cliente y **sin
   señales de navegador** (nada de fbp, fbc, IP ni user agent: serían las del
   propietario). Hoy `purchase()` fija `action_source: 'website'`; hay que
   permitir pasarle `'chat'` para esta ruta. `event_id` = la referencia.
   Si Meta falla, la venta igual queda registrada (falla hacia adelante).
6. Responde 200 con `{ referencia, restante }`.

**No hace:** cobrar, crear guía de envío, mandar correo al cliente ni tocar
`stock.json`.

**Deshacer:** si hace falta anular una venta mal registrada, ya existe
`anular()` en `_inventario.mjs`; basta con aceptarla por la misma función con
`{ "anular": "MAN-..." }`, o dejarlo para después.

## Pruebas mínimas

- Clave ausente o errada → 401, contador intacto.
- Venta válida → `vendido` sube en Blobs y `disponibilidad` baja lo mismo.
- Pieza sin unidades → 409, contador intacto.
- La misma referencia dos veces no descuenta dos veces (`confirmar` ya es
  idempotente; comprobarlo).
- `purchase()` sin señales no manda `client_ip_address` ni `fbp`.

## Después del despliegue

1. Crear `VENTA_MANUAL_KEY` en Netlify (valor largo aleatorio), y avisar a la
   sesión de pauta para que la guarde como credencial Header Auth en n8n. La
   clave no se pega en ningún chat ni archivo.
2. La sesión de pauta arma el formulario de n8n y lo prueba con una pieza.
3. Anotar en `ESTADO.md` que existe, y que las ventas por WhatsApp se registran
   ahí y **nunca** como pedido contraentrega a nombre del cliente.
