# Ficha de producto que vende más — encargo para la sesión de la tienda

Pedido del propietario el 2026-09-26; organizado por la sesión de pauta
(`claude/charming-sagan-l4q2eq`). Lo construye **la sesión que edita la tienda**.
Va **después** de `ventas-manuales/BRIEF.md` y `suscripcion/BRIEF.md` (orden en
`automatizaciones/tienda/ORDEN.md`).

**Objetivo:** que cada visita a una pieza termine en una compra de **varias**
piezas. El freno medido está en el segundo charm: con la escalera actual es el
paso más caro para el cliente (+$75.600, 8% de descuento), mientras el tercero y
el cuarto salen casi a mitad de precio. Todo lo de abajo empuja hacia ahí.

**Referencias de diseño** (mirarlas antes de empezar; desde la sesión de pauta
no se pudieron abrir por la red):
[snatched-body.com](https://www.snatched-body.com) ·
[bnaturalstore.com](https://bnaturalstore.com) ·
[sabemosdealmohadas.com](https://sabemosdealmohadas.com).
Tomar de ellas el **orden de la ficha**, los selectores de paquete, los íconos
de beneficios y las reseñas con estrellas. No copiar textos ni imágenes.

La ficha hoy es el panel que abre `tienda.js` (§ «ficha de producto», ~línea
360), no una página aparte. Mantenerlo así salvo que haya una razón fuerte.

## Orden de la ficha, de arriba abajo

1. Galería de fotos (la que ya existe).
2. Nombre, **estrellas amarillas** con el promedio y número de reseñas (enlace
   que baja a las reseñas), precio.
3. **Disponibilidad real** (ver § Reglas de verdad).
4. **Selector de paquetes** «Compra 1 / 2 / 3 / 4» (ver abajo).
5. Botones **Agregar al carrito** y **Comprar ahora**.
6. **Addi**: «Págalo en cuotas con Addi» con el valor de la cuota (ver abajo).
7. **Recíbelo en 24 horas en Bogotá** (ver abajo).
8. Íconos de beneficios: envío gratis pagando en línea · pago contraentrega ·
   Plata 925 con sello · empaque de regalo · cambio de talla. Solo los que sean
   ciertos hoy.
9. Acordeones: **Descripción** · **Materiales** · **Envíos gratis** ·
   **Contraentrega** · **Consejos y cuidados**.
10. **Guía de tallas** (justo debajo de los acordeones; hoy vive en
    `index.html` ~l. 287, reutilizarla).
11. **Relacionados / venta cruzada** con el ahorro de llevarlos juntos.
12. **Reseñas de clientes** con formulario para dejar una.

**Barra fija abajo en el celular** con precio y «Agregar al carrito» mientras se
baja por la ficha: es el «llamado a la acción constante». Lo mismo al final de
cada bloque largo (relacionados, reseñas): un botón, no un párrafo.

## Selector de paquetes «Compra 1 / 2 / 3 / 4»

- Cuatro opciones tipo tarjeta, la de 2 preseleccionada solo si hay stock.
  Cada una dice el **total** y **«Ahorras $X»** en pesos, no en porcentaje.
- La 4 se llama **«Lleva 4, paga 3»**: con 4 charms del mismo precio, el 25%
  actual es exactamente un charm gratis.
- Al elegir 2, 3 o 4, un acordeón muestra **charms relacionados** para
  completar (misma colección primero, luego los más vendidos), solo con stock.
- Si la ficha es de un brazalete, el paquete es brazalete + N charms, y debe
  decir que desde 3 charms el brazalete baja 30%.
- **Todos los números salen de `calcular()`** (`_precios.js`), la misma función
  que cobra. Nunca una tabla escrita a mano: si el precio y el cobro se separan,
  `pruebas/precios.js` tiene que fallar.

## Descuentos llamativos

- Mostrar el precio tachado y el nuevo, y el ahorro en pesos.
- En el carrito: «Agrega 1 charm más y ahorras $X» (ya hay un aviso parecido en
  `tienda.js` ~l. 619; hacerlo más visible).
- No cambiar los porcentajes en este encargo. Si se prueba el 12% en el segundo
  charm, será un cambio aparte y medido.

## Addi

Hoy Addi **no está integrado**: se coordina por WhatsApp (`index.html` ~l. 940,
1093). Para pagar con Addi desde la tienda hace falta la cuenta de aliado de
Addi y sus credenciales. **Pendiente del propietario.**
- Mientras no estén: el bloque dice «También a cuotas con Addi» y lleva al
  WhatsApp de pagos, como hoy.
- Con credenciales: widget oficial de Addi en la ficha (valor de cuota) y Addi
  como método en `checkout.html`, con su confirmación de pago por el servidor,
  igual que Wompi. Nada de marcar pedido pagado desde el navegador.

## Recíbelo en 24 horas en Bogotá

Es una promesa de entrega: solo se muestra si se cumple siempre. **Pendiente del
propietario:** hora de corte (p. ej. pedidos antes de las 12 m, lunes a sábado),
mensajería que la hace y su costo. Con eso:
- Aviso en la ficha: «Pide antes de las 12 m y recíbelo mañana en Bogotá».
- En el checkout, cuando la ciudad es Bogotá, mostrar la fecha de entrega.
- Actualizar `envios-y-devoluciones.html` con la misma regla. Sin esos tres
  datos, no se publica.

## Reseñas

- **Estrellas amarillas** en todo el sitio (hoy son rosadas, `fill="#B4657F"`).
  Un solo color, por ejemplo `#F5B301`, como token.
- **Formulario para dejar reseña**: estrellas de 1 a 5, texto, nombre y ciudad,
  foto opcional.
- **«Compra verificada» con chulo solo si es verdad**: la reseña trae un enlace
  firmado que llega en el correo posterior a la entrega (referencia del pedido).
  Una reseña sin pedido se puede aceptar, pero sin chulo.
- **Moderación**: nada se publica solo. Queda pendiente en Blobs y el propietario
  la aprueba (aviso por correo o n8n). Se publican también las de 3 estrellas o
  menos si son reales: ocultarlas todas se nota y es engañoso.
- Promedio y conteo salen de las reseñas aprobadas, nunca de un número fijo.

## Suscripción por correo

Ya está especificada en `automatizaciones/suscripcion/BRIEF.md`, incluido el
incentivo (un charm de regalo en la primera compra de 2 charms o más). En la
ficha: una línea bajo los beneficios, «Suscríbete y llévate un charm de regalo».

## Página de inicio y diseño

- **Quitar el banner de WhatsApp de la página de inicio** (bloque del hero,
  `index.html` ~l. 195-198). El botón flotante se queda: es el canal de dudas.
- **Más vida**: la página se ve opaca. Subir contraste y saturación de la
  paleta, un acento más brillante para botones y descuentos, títulos con más
  peso. Mantener legible en celular. Proponer la paleta antes de aplicarla en
  todo el sitio.

## Reglas de verdad (no negociables)

El sitio ya trabaja así: «Solo dice últimas unidades cuando de verdad quedan 1 o
2: no se inventa urgencia donde no la hay» (`tienda.js` ~l. 200). Se mantiene.

- **Contador de «personas viendo» entre 10 y 15: NO se construye.** Un número
  inventado es publicidad engañosa ante la SIC (Ley 1480) y es de lo que más
  desconfianza genera cuando alguien lo nota (recarga y cambia). En su lugar,
  en ese mismo lugar, **datos reales**:
  - «Quedan 2 unidades» cuando sea cierto (`disponibilidad.mjs`).
  - «N personas compraron esta pieza este mes», contado de los pedidos reales,
    y solo si N ≥ 3.
- **Disponibilidad real**: `stock.json` + lo vendido/apartado en Blobs, leído
  con `disponibilidad.mjs`. Nunca solo `stock.json`.
- **Textos que ya están y hay que confirmar con el propietario**: «+2.400
  pulseras creadas» (hero) y «Compra verificada» en las reseñas fijas de
  `index.html`. Si no se pueden sostener con datos, se cambian.
- Materiales: charms Plata 925; brazaletes **baño de plata**. No nombrar a
  Pandora en textos nuevos.

## Pruebas mínimas

- El total de cada paquete en la ficha es idéntico al que cobra `crear-pago`
  (`pruebas/precios.js` en verde, con casos de 1, 2, 3 y 4 charms).
- Una pieza agotada no aparece en relacionados ni en paquetes.
- Reseña sin moderar no se ve; reseña con enlace de pedido lleva chulo, sin
  enlace no.
- Sin credenciales de Addi, el botón lleva a WhatsApp y no a un cobro roto.
- La ficha funciona en un celular de 360 px de ancho y la barra fija no tapa el
  botón flotante de WhatsApp.
