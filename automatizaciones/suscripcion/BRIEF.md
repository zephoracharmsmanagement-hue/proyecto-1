# Suscripción por correo con regalo — encargo para la sesión de la tienda

Aprobado por el propietario el 2026-09-26. Lo escribió la sesión de pauta
(`claude/charming-sagan-l4q2eq`); lo construye **la sesión que edita la tienda**.
Puede salir en el mismo despliegue que `registrar-venta.mjs`
(`automatizaciones/ventas-manuales/BRIEF.md`).

Antes de escribir código: `ls netlify/functions/` y `grep -ri "suscrip\|newsletter"`
por si algo parecido ya entró.

## La oferta, y por qué es esta

> «Suscríbete y llévate un charm de regalo en tu primera compra de 2 charms o
> más. Y entérate primero cuando lleguen piezas nuevas.»

- **Regalo y no porcentaje.** Un 10% cuesta ~$24.000 en un pedido de 2 charms y
  se suma a la escalera de `reglas.escalaCharms`. El regalo cuesta solo el costo
  de la pieza y **no toca el precio**: `calcular()` y el cobro de Wompi no
  cambian.
- **Condición de 2 charms o más.** El freno de venta está en el segundo charm
  (pasa de +$75.600 al cliente, el paso más caro de la escalera). El regalo es el
  empujón para ese paso.
- **Pieza de regalo:** la decide el propietario. Primera opción: **la inicial del
  cliente** (letras con 3-4 unidades). Nunca una pieza con menos de 3 unidades.

## Qué construir

### 1. Formulario de suscripción en el sitio

- Aparece **a los 15 segundos o después de ver 2 productos**, lo primero que
  pase. Nunca en `checkout.html`. Si la persona lo cierra, no vuelve en 30 días
  (`localStorage`, envuelto en try/catch).
- Campos: correo, y una casilla **desmarcada** de autorización (Ley 1581):
  «Acepto recibir correos de Zephora Charms con novedades y ofertas. Puedo darme
  de baja cuando quiera.» Enlace a la política de datos.
- Campo trampa oculto contra bots; si viene lleno, responder 200 y no hacer nada.
- Evento del píxel: `Lead` con `content_name: 'suscripcion'` (ya existe `Lead`
  en el sitio; no inventar un evento nuevo).

### 2. `netlify/functions/suscribir.mjs`

- `POST {correo, acepta}`. Valida formato, `acepta === true`, límite de intentos
  por IP.
- **Doble confirmación:** manda por Resend (`_correo.js`, reusar `enviar()`) un
  correo con enlace a `suscribir?confirmar=<token>`. El token es
  `correo + fecha` firmado con HMAC y una variable nueva `SUSCRIPCION_SECRETO`;
  así no se guarda nada hasta que confirma.
- Al confirmar: guarda en Blobs, almacén nuevo `suscriptores`, clave =
  sha256 del correo en minúsculas, valor
  `{ confirmado, fecha, regaloUsado: null }`. Muestra una página corta:
  «Listo. Tu regalo se aplica solo en tu primera compra de 2 charms o más,
  usando este mismo correo.»
- **Darse de baja:** `suscribir?baja=<token firmado>`, enlace en cada correo.
  Borra el registro.
- Responde siempre lo mismo exista o no el correo (no revelar quién está
  suscrito).

### 3. Marcar el pedido como «regalo de suscriptor»

En `crear-pago.mjs`, después de `calcular()` y **sin tocar el total**:

- Si el correo del pedido está en `suscriptores`, confirmado, `regaloUsado` vacío
  y el pedido trae **2 charms o más** → `pedido.regalo = 'suscriptor'`.
- Se marca `regaloUsado = <referencia>` **solo cuando el pedido se confirma**:
  en `wompi-webhook.mjs` al aprobarse el pago, y en la rama contraentrega de
  `crear-pago.mjs`. Un pago rechazado no gasta el regalo.
- En `avisoTienda()` / `pagoTienda()` de `_correo.js`: una línea destacada
  **«INCLUIR REGALO DE SUSCRIPTOR»** en la hoja de despacho.
- En el correo de la clienta (`pedidoRecibido()`): «Tu pedido incluye tu charm
  de regalo por estar suscrita.»
- En `checkout.html`, si aplica: un aviso bajo el total, «Incluye tu charm de
  regalo de suscriptor». Si es suscriptora pero lleva 1 charm: «Agrega 1 charm
  más y te llevas uno de regalo». Ese aviso es el que empuja el segundo charm.

**Inventario del regalo:** fase 1, el propietario escoge la pieza al empacar y la
descuenta con el formulario de ventas manuales (`registrar-venta`, total 0,
pago `regalo`; ese caso **no** debe mandar `Purchase` a Meta). Si se quiere que
el cliente elija su inicial en el checkout, es una fase 2: requiere reservar la
pieza sin precio dentro del mismo CAS de `reservar()`.

### 4. Lista para enviar correos

`GET suscriptores-export` protegida con `x-zephora-automation-key` (misma idea
que `envio-estado.mjs`, variable `SUSCRIPTORES_KEY`), que devuelve solo los
confirmados: correo y fecha. La consume n8n para los envíos. Los envíos masivos
no son parte de este encargo.

## Pruebas mínimas

- Sin casilla aceptada → 400. Con trampa llena → 200 y nada guardado.
- Token alterado o vencido (7 días) → no confirma.
- Suscriptora con 2 charms → pedido marcado; con 1 charm → no marcado, aviso de
  «agrega 1 más».
- Pago rechazado → `regaloUsado` sigue vacío. Segundo pedido aprobado → ya no
  lleva regalo.
- El total cobrado es idéntico con y sin suscripción (`pruebas/precios.js`
  sigue en verde).
- `suscriptores-export` sin clave → 401.

## Después del despliegue

1. Crear `SUSCRIPCION_SECRETO` y `SUSCRIPTORES_KEY` en Netlify. No pegarlas en
   ningún chat.
2. Probar con un correo propio de punta a punta: suscribir, confirmar, pedido de
   2 charms contraentrega, ver «INCLUIR REGALO» en la hoja de despacho, cancelar.
3. Anotar en `ESTADO.md` que existe y cómo se entrega el regalo.
4. Medir a las 4 semanas: suscritos ÷ visitantes (referencia 2-5%) y
   % de suscriptoras que compran con 2+ charms.
