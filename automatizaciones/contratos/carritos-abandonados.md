# Contrato · Recuperación de carritos abandonados

`netlify/functions/recuperar-carritos.mjs`, sobre el almacén de
`netlify/functions/_pendientes.mjs`. Corre sola cada 15 minutos.

## Por qué salió barato

La forma habitual de recuperar carritos es seguirle la pista al carrito del
navegador y adivinar quién lo dejó. Aquí no hizo falta: **ya existía un momento
en el que la clienta da nombre, correo, celular y piezas**, justo antes de irse
a la pasarela. Si después no llega un pago aprobado, eso es un carrito
abandonado con contacto completo.

El proyecto ya llevaba media cuenta: la reserva de inventario aparta las
unidades 30 minutos esperando ese pago. Solo faltaba guardar de quién eran.

## El camino

```
crear-pago.mjs ──anota──► Blobs «pendientes»   (nombre, correo, celular, piezas)
                                │
                          Wompi cobra
                                │
        APPROVED ──────────► se BORRA          (compró: nada que recuperar)
        DECLINED/VOIDED ───► se MARCA          (quiso comprar y el banco dijo no)
        nunca vuelve ──────► se queda
                                │
        cada 15 min: recuperar-carritos.mjs
                                │
                     ¿pasaron 45 min y no se le ha escrito?
                                │
                          UN correo, y se marca
                                │
                     a los 7 días: se borra, pase lo que pase
```

## Las tres reglas que evitan que esto sea spam

1. **Un solo mensaje por pedido.** El campo `avisado` lo garantiza, y **se marca
   antes de mandar**: si Resend falla se pierde ese aviso, que es mucho mejor
   que mandarlo dos veces. Quien recibe dos correos por el mismo carrito no
   vuelve, se da de baja.
2. **45 minutos de espera** (`ESPERA_MS`). La reserva dura 30, pero un pago por
   PSE puede tardar más — el banco responde cuando responde. Escribirle «no
   terminaste» a alguien que está pagando en ese momento es la peor versión de
   esto.
3. **Sin promociones.** El correo habla del pedido de ella y no trae descuentos
   ni ofertas nuevas. Eso lo mantiene transaccional; en el momento en que trae
   una promoción pasa a ser marketing y necesita consentimiento aparte bajo la
   Ley 1581. `pruebas/recuperacion.js` lo comprueba buscando esas palabras.

## Los datos se borran

Este almacén guarda **datos personales en claro** —nombre, correo, celular—, a
diferencia del de atribución, que solo guarda hashes. No hay forma de
escribirle a nadie con un hash.

Por eso el borrado tiene tres caminos y ninguno es opcional:

| Situación | Qué pasa |
|---|---|
| La clienta pagó | Se borra al confirmar el pago |
| Se le escribió y no volvió | Se borra a los 7 días (`CADUCIDAD_MS`) |
| Nunca se le escribió | Se borra igual a los 7 días |

## Dos correos distintos

| Situación | Asunto | Qué dice |
|---|---|---|
| Se fue a medias | *Tu pulsera te está esperando* | Las piezas que armó y el total |
| El pago se declinó | *Tu pago no se completó* | Que el banco no aprobó, y le ofrece otro medio o contraentrega |

La distinción importa: un pago declinado no es un carrito olvidado. Ahí la
clienta **sí quiso comprar** y fue el banco el que dijo que no; tratarla como
despistada es perder la venta dos veces.

Los dos llevan la referencia, el detalle de las piezas, versión en texto plano y
el aviso de que **la disponibilidad pudo cambiar** — el correo no promete lo que
puede llevar días vendido.

## Qué dice el log

Una línea por corrida, cada 15 minutos:

```json
{"evento":"recuperacion_carritos","revisados":12,"avisados":2,"borrados":1,"fallidos":0,"esperaMin":45}
```

| Campo | Qué es |
|---|---|
| `revisados` | Pedidos pendientes en el almacén |
| `avisados` | Correos que salieron en esta corrida |
| `borrados` | Registros caducados que se limpiaron |
| `fallidos` | Se intentó y Resend no pudo. **Esos ya no se reintentan** |

`revisados` siempre en cero corrida tras corrida significa que nadie está
llegando a la pasarela, o que Blobs no responde — la línea de error sale al lado.

## Falla hacia adelante

Si Blobs o Resend no responden, se registra y la corrida termina en cero. La
siguiente lo reintenta con los que sigan sin avisar. Anotar un pendiente en
`crear-pago` **nunca lanza**: una herramienta de recuperación no puede costar la
venta que iba a recuperar.

## Pendiente

- **Mandarlo también por WhatsApp**, cuando esté la API Cloud. El celular ya
  está guardado. Ojo con la ventana de 24 horas de Meta: fuera de ella hace
  falta una plantilla aprobada, así que esto no es solo conectar el envío.
- **Retomar el pedido con un clic.** Hoy el correo lleva las piezas escritas
  pero la clienta tiene que rearmarlas: el carrito vive en `localStorage` y el
  enlace no lo restaura. Un `?retomar=<referencia>` que reconstruya el carrito
  desde el pendiente subiría bastante la conversión de este correo.
- **Medirlo.** No hay forma de saber cuántos de estos correos terminan en compra.
  Un parámetro en el enlace y un evento bastarían.
