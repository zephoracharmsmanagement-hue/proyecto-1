# Pruebas

Comprueban en un navegador real que el sitio sigue haciendo lo que se acordó.
Existen porque varias de estas reglas son de negocio, no de código: leyendo el
HTML no se ve que el umbral de envío gratis deba medir mercancía y no total, ni
que un charm nunca puede describirse como enchapado.

## Correrlas

```sh
./pruebas/correr.sh
```

Levanta un servidor estático sobre la raíz del repo, corre las nueve baterías y
lo apaga. La primera vez instala Playwright dentro de `pruebas/node_modules`.

Contra el sitio publicado:

```sh
URL=https://zephoracharms.com ./pruebas/correr.sh
```

Sale con código 1 si alguna comprobación queda en rojo, así que sirve tal cual
para un hook o para CI.

## Qué cubre cada una

| Batería | Comprueba |
|---|---|
| `regresion.js` | Los cuatro bugs de la auditoría inicial: titular y botón de WhatsApp sobre el pliegue a 360/390/430 px, barra de avisos sin texto cortado, filtros acotados a su contenedor y conteo que incluye los destacados. Más scroll horizontal a cinco anchos y errores de consola |
| `stock.js` | Disponibilidad y tallas: tallas sin unidades tachadas y no escondidas, agotados bloqueados con opción de encargo, las 27 iniciales, tope por unidades, filtro de solo disponibles, descuentos 30% + 15% intactos, la talla en el mensaje de WhatsApp, y que el sitio siga vendiendo si `stock.json` no carga |
| `dudas.js` | Calculadora de talla contra los casos de las reglas de negocio, ficha de producto de las cinco familias con sus dos medidas, y buscador combinado con categoría y disponibilidad |
| `precios.js` | Que el servidor cobre lo que la página prometió: 40 carritos armados al azar tocando el armador de verdad, comparados contra `netlify/functions/_precios.js`. Más los rechazos: ids inventados, brazaletes colados como charms, tallas inexistentes, 500 unidades. **Y el aviso del siguiente tramo de descuento**: que salga cuando hay tramo, que no salga cuando no lo hay, y que la cifra de ahorro que anuncia cuadre con las reglas — una cifra que no cuadre se descubre en la pantalla de pago, con la clienta ya decidida |
| `inventario.js` | **La carrera de la última unidad.** Que dos pedidos simultáneos por la misma pieza terminen con exactamente uno aprobado y el otro con `SinInventario` — y diez sobre tres unidades, con tres. Más caducidad de reservas, tallas contadas por separado, idempotencia de `confirmar` (Wompi reintenta), y las cuatro rutas de falla hacia adelante. El almacén falso imita de Blobs lo único que importa: que una escritura condicional solo pase si el etag sigue siendo el que se leyó, **con latencia**, para que las dos lecturas ocurran antes de cualquier escritura. Sin esa latencia la prueba pasaría sin haber probado nada |
| `pedidos.js` | El registro de pedidos: que guarde lo que hace falta para alistar —piezas, talla, dirección—, que el aviso de Wompi lo **complete y no lo pise** (el evento no trae ni las piezas ni la dirección), que un pago sin pedido previo se guarde igual, y que nada del medio de pago acabe ahí. Más las rutas de falla hacia adelante y que los pedidos de prueba no se mezclen con los reales |
| `rescate.js` | **A quién se le escribe** cuando un checkout queda sin pagar, que es donde esta pieza puede hacer daño: no a quien ya pagó, no a un contraentrega en firme, no a un pago rechazado, no antes de 2 horas —puede seguir en la pasarela— ni después de 7 días, y no dos veces del mismo. Más que el mensaje no invente urgencia y que los datos de la clienta se escapen antes de pintarlos en el correo |
| `meta.js` | El `Purchase` que el webhook manda a Meta por la Conversions API. Vigila las dos cosas que no se ven mirando la pantalla: que el `event_id` sea la referencia del pedido —lo que impide que Meta cuente dos veces cada compra, ahora que el evento sale también desde `gracias.html`— y que los identificadores se normalicen antes de hashear. Si la normalización no coincide con la de Meta, el hash no empareja con nadie, Meta responde 200 y el evento no sirve para nada: un fallo sin ninguna señal de que algo va mal. Más las cuatro rutas de falla hacia adelante |
| `checkout.js` | El camino completo de la compra ejecutando las funciones de Netlify reales dentro de Node: validación de datos de envío, firma de integridad que Wompi va a recalcular, formulario que llega a la pasarela, contraentrega sin firma, carrito que se vacía al confirmar, referencias únicas, y el webhook rechazando eventos con firma falsa |

`capturas.js` no comprueba nada: guarda pantallazos en `pruebas/capturas/` para
revisar a ojo. Se corre aparte con `npm run capturas`.

## Comprobaciones que no están aquí

Dos son de texto y se hacen con `grep` desde la raíz. Conviene correrlas al tocar
cualquier copia sobre materiales o envío:

```sh
# Ningún charm puede describirse como latón o baño de plata: son Plata 925.
grep -rniE 'charm[s]?[^.]{0,80}(lat[óo]n|ba[ñn]o de plata)' --include=*.html . | grep -v '^./assets'

# Ninguna página puede seguir diciendo que el envío se cotiza por ciudad.
grep -rn 'se cotiza' --include=*.html . | grep -v '^./assets'
```

Ambas deben salir vacías.

## Si una prueba falla

Antes de tocar el sitio, comprobar si el error está en la prueba. Ya pasó dos
veces: una aserción esperaba 13 charms de Disney cuando en pantalla hay 15, y
otra daba por hecho que dos charms de $85.000 suman $170.000 sin restar el
descuento por cantidad. La página tenía razón las dos veces.
