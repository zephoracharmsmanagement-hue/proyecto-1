# Plantilla de recuperación de carritos — para pegar en Meta

Para el paso 4 de la fundación compartida (`BRIEF.md`). Redactada el 2026-08-28,
con la app de WhatsApp Business ya conectada (número **+57 301 899 0672**,
estado *Conectado*, calidad *Alta*).

**Por qué hace falta:** el rescate se dispara horas o días después de que la
clienta abandonó el checkout. Nunca escribió por WhatsApp, así que no hay ventana
de 24 horas abierta, y **fuera de esa ventana Meta exige plantilla
pre-aprobada**. Sin esto no hay rescate por WhatsApp, por bueno que sea el bot.

---

## Lo que se pega en «Administrar plantillas → Crear plantilla»

| Campo | Valor |
|---|---|
| **Nombre** | `recuperacion_carrito` |
| **Categoría** | **Marketing** |
| **Idioma** | **Español** (`es`) |

### Cuerpo

```
Hola {{1}}, te escribo de Zephora Charms.

Tu pedido {{2}} quedó a medio camino: llegaste hasta el pago y algo lo
interrumpió. Habías elegido {{3}}.

Si todavía lo quieres, con el botón de abajo lo retomas. Al abrirlo
comprobamos qué sigue disponible: si alguna pieza se agotó mientras tanto,
te lo decimos ahí mismo antes de pagar.
```

### Ejemplos de las variables (obligatorios — sin ellos la rechazan)

| Variable | Ejemplo a pegar |
|---|---|
| `{{1}}` | `Valentina` |
| `{{2}}` | `ZC-260828-4A7F21C3` |
| `{{3}}` | `Brazalete Copo de Nieve talla 18, Letra A ×2 y Letra B` |

### Pie de página

```
Recibes esto porque autorizaste novedades al comprar.
```

52 de los 60 caracteres permitidos. El pie **no admite variables**, por eso el
número de pedido va en el cuerpo.

### Botones

**1 · Botón de acción → Visitar sitio web → URL dinámica**

| Campo | Valor |
|---|---|
| Texto | `Retomar mi pedido` |
| URL | `https://zephoracharms.com/reanudar?ref={{1}}` |
| Ejemplo | `https://zephoracharms.com/reanudar?ref=ZC-260828-4A7F21C3` |

La variable **tiene que ir al final de la URL** — Meta solo acepta prefijo fijo
más sufijo variable. `/reanudar?ref={{1}}` cumple.

**2 · Botón de respuesta rápida**

| Campo | Valor |
|---|---|
| Texto | `No enviarme más` |

---

## Por qué está redactada así

**Categoría Marketing, y no es negociable.** Un carrito abandonado no es una
actualización de una compra: la compra no ocurrió. Etiquetarlo como *utility*
para pagar menos hace que Meta lo recategorice, y un patrón de plantillas mal
etiquetadas **baja la calificación de calidad de la cuenta** —hoy en «Alta»—, lo
que a su vez limita cuántos mensajes se pueden enviar. Salir barato en una
plantilla puede costar el canal entero.

**No promete que el carrito sigue armado.** Es la misma regla que ya respeta el
correo (`_correo.js`, `recuperarCarrito`): la reserva de inventario caduca a los
30 minutos y esto se manda al día siguiente, así que «te lo guardamos» sería
falso. Se dice que al abrir se comprueba, que es exactamente lo que hace
`reanudar.mjs`.

**El pie es la autorización, no un adorno.** Meta exige opt-in previo para
plantillas de marketing, y la Ley 1581 exige poder demostrar la finalidad. La
casilla del checkout (`cliente.optin`) es esa autorización, y esta línea se lo
recuerda a quien lo recibe.

**El cuerpo no empieza ni termina en variable.** Meta rechaza las que lo hacen.
`Hola {{1}}` lleva texto delante, y el último párrafo cierra con texto.

**Tres variables, no una.** Con la selección dentro del mensaje, la clienta
reconoce su pedido sin abrir nada — y quien no vaya a comprar no gasta un clic.

---

## Antes de enviarla a revisión

- [ ] Los tres ejemplos de variables, pegados. Es la causa de rechazo más común
- [ ] Categoría en **Marketing** (no dejar que la interfaz la ponga en Utility)
- [ ] Idioma **Español (`es`)** — `es_CO` no existe en la lista de WhatsApp
- [ ] La URL de ejemplo del botón, completa y con una referencia real
- [ ] Sin mayúsculas sostenidas ni emojis de más: leen como promoción no
      solicitada y penalizan

---

## Lo que esta plantilla todavía no resuelve

**El botón «No enviarme más» no tiene dónde aterrizar.** Cuando alguien lo toque,
llega un mensaje entrante por webhook — y hoy no hay nada que lo escuche ni
ningún campo donde apuntar que esa persona no quiere más mensajes. `rescate.mjs`
mira `cliente.optin` del pedido, que es por pedido y no por persona.

Ofrecer una salida que no funciona es peor que no ofrecerla, así que **antes de
mandar el primer mensaje con esta plantilla** hace falta una de dos:

1. Que el webhook esté conectado y registre la baja en algún sitio que
   `rescate.mjs` consulte, o
2. Mientras tanto, atenderlo a mano: con el número en modo coexistencia el
   mensaje también llega a la app, así que se ve y se puede anotar.

**Coexistencia, comprobar al conectar el webhook.** Hoy el número entrega los
mensajes en la app de WhatsApp Business con normalidad —comprobado el
2026-08-28—. El día que se apunte un webhook para el bot, hay que confirmar que
**siguen llegando a la app además de al bot**. Si dejaran de llegar, el canal
manual —que es como esta tienda cierra las ventas— se apagaría sin dar ningún
error.

---

## Coste

Las plantillas de marketing rondan **USD 0,04–0,09 por conversación** (la tarifa
exacta es por país; la de Colombia hay que mirarla en el panel). Con los ~55
checkouts abandonados al mes que produce la campaña principal, son del orden de
**USD 2–5 al mes** — irrelevante frente a los ~$110.000 COP de utilidad neta que
deja una venta de dos charms.

Lo que no es irrelevante es la calificación de calidad: mandar plantillas de
marketing a quien no las quiere la baja, y con ella el límite de mensajes. Por
eso el filtro de `optin` no es burocracia, es lo que protege el canal.
