# Catálogo de respuestas · WhatsApp Business
### Zephora Charms · v1 · para tráfico de pauta

> **Estado:** listo para usar hoy. Las cifras están verificadas contra
> `data/inventario.json`, que se genera desde el sitio. Cuando llegue el
> export de conversaciones se afina el tono con datos reales de lo que
> cerró ventas; lo que hay aquí es tu tono de las macros anteriores,
> corregido y ordenado para tráfico frío.

---

## Cómo se usa

**Flujo acordado: la IA redacta, una persona aprueba y envía.** La web promete
"sin bots" y así sigue siendo cierto. Nadie manda un precio sin que un humano
lo haya visto.

Antes de enviar cualquier respuesta con un signo de peso, verifica dos cosas:

1. **El precio** está en `data/inventario.json` — nunca de memoria
2. **La disponibilidad** está en tu Excel de stock — nunca se asume

## Reglas de oro

Estas cinco no se rompen nunca. Cada una nace de un error que ya costó, o que estuvo a punto:

1. **Charms = Plata 925. Brazaletes = baño de plata.** Jamás "todo es plata". Es lo que hace que una clienta se sienta engañada al abrir la caja.
2. **Nunca afirmar stock sin mirar el Excel.** Si no lo tienes a mano: *"déjame confirmarte disponibilidad y te escribo en un momento"*. Cuesta un mensaje; prometer un charm agotado cuesta la clienta.
3. **Ningún precio de memoria.** Todos salen del inventario.
4. **Un cierre por mensaje.** Cada respuesta termina en una pregunta que avanza la venta, no en "¿alguna otra duda?" — eso invita a colgar.
5. **No insistir dos veces.** Si dice que no a un upsell, se cierra la venta que ya tienes. Insistir de nuevo pierde las dos.

## Datos que cambian — nunca escribirlos a mano

| Variable | Valor hoy | De dónde sale |
|---|---|---|
| `{{charm.precio}}` | $72.000–$85.000 | `inventario.json → charms` |
| `{{charm_desde}}` | **$72.000** | `resumen.charm_decorativo_desde` |
| `{{accesorio_desde}}` | $65.000 | `resumen.accesorio_desde` |
| `{{brazalete_desde}}` | $58.000 | `resumen.brazalete_desde` |
| `{{combo_desde}}` | $206.350 | promo vigente |
| `{{envio_anticipado}}` | $15.000 | `reglas.envio.anticipado` |
| `{{envio_contraentrega}}` | $25.000 | `reglas.envio.contraentrega` |
| `{{envio_gratis}}` | $180.000 | `reglas.envio.gratis_desde` |
| `{{stock}}` | — | ⚠️ Excel de stock, pendiente de integrar |

> ⚠️ **Corregido respecto a las macros anteriores:** el charm más económico es
> **$72.000**, no $65.000. Las piezas de $65.000 son Cadenas de Seguridad y las
> de $68.000 son Clips — accesorios, no charms. Ver `01-auditoria-macros.md`.

---

# A · Apertura y triaje

Tráfico de pauta llega frío: no te conoce, no sabe qué cuesta, y decide en los
primeros dos mensajes. La meta de esta sección no es vender — es **calificar y
dar contexto rápido**.

### A1 · "Hola" / "info" / "precio?" *(el 70% de la pauta entra así)*

> ¡Hola! 💜 Bienvenida a **Zephora Charms** ✨
>
> Armamos pulseras personalizadas: tú eliges cada charm y cada uno cuenta algo tuyo.
>
> 💎 **Charms** en Plata Esterlina 925 — desde $72.000
> ✨ **Brazaletes** con acabado en baño de plata — desde $58.000
>
> 🔥 **Esta semana:** con **3 charms o más**, el brazalete baja **30%** y los charms **15%** — los dos descuentos se suman.
>
> Cuéntame para arrancar: ¿es **para ti** o **para regalar**? 🎁

**Por qué así:** esa pregunta final divide todo lo que sigue. "Para regalar"
abre el empaque premium y la urgencia por fecha; "para mí" abre el armado por
significado. Y responderla cuesta un toque, que es lo máximo que da una clienta
de pauta.

### A2 · Llega con el pedido del armador de la web

El sitio manda un mensaje ya formateado con las piezas y el total. Esa clienta
**ya se autocalificó** — es la más caliente que vas a recibir. No la hagas repetir nada.

> ¡Qué belleza te armaste! 😍 Me encanta esa combinación.
>
> Ya tengo todo tu pedido aquí ✓ Solo confirmo **disponibilidad** y te digo en un minuto 💜
>
> Mientras tanto, ¿a qué **ciudad** la enviamos?

Luego, con el stock confirmado:

> ¡Todo disponible! ✓
>
> 📦 Tu pedido: **{{total}}**
> 🚚 Envío a {{ciudad}}: **gratis** ✓
>
> ¿Te va mejor **contraentrega** (pagas al recibir) o **transferencia**? 💜

**Regla:** nunca pedirle que repita lo que ya mandó. Es el error que más
rápido enfría a una clienta lista para comprar.

### A3 · Fuera de horario

> ¡Hola! 💜 Gracias por escribirnos ✨
>
> Ahora mismo no estamos en línea — atendemos de **{{horario}}**. Te respondo apenas abramos, personalmente 😊
>
> Mientras tanto puedes ver el catálogo completo y armar tu pulsera con el precio en vivo 👉 **zephoracharms.com**
>
> Si me dejas por acá **qué te gustó** o **para quién es**, te llego con la propuesta lista 💜

> ⚠️ Falta definir `{{horario}}`. Es el dato que más se nota vacío, porque aparece justo cuando ya está esperando.

---

# B · Consultas de stock y productos

### B1 · "¿Tienen [charm]?" — con stock confirmado

> ¡Sí, lo tenemos! ✓
>
> **{{charm.nombre}}** — {{charm.precio}}
> 💎 Plata Esterlina 925
>
> Te cuento algo por si te sirve: llevando **3 charms o más**, el brazalete baja 30% y los charms 15%. La pulsera completa te quedaría desde **{{combo_desde}}** — y con **envío gratis** 🎁
>
> ¿Te armo una propuesta con {{charm.nombre}} + 2 que le combinen? Sin compromiso 😊

### B2 · "¿Tienen [charm]?" — sin poder verificar aún

> ¡Me encanta esa elección! 😍
>
> Déjame confirmarte disponibilidad y te escribo en un momentico 💜
>
> Mientras tanto, cuéntame: ¿es para ti o para regalar? Así te voy armando la propuesta completa 🎁

**Por qué:** no se queda esperando en silencio. La pregunta mantiene viva la
conversación mientras revisas el Excel.

### B3 · Agotado

> Uy, justo ese se nos agotó 😔 No quiero prometerte algo que no te puedo cumplir.
>
> Pero mira, tengo dos que van con la misma idea:
> ▪️ **{{alternativa_1}}** — {{precio_1}}
> ▪️ **{{alternativa_2}}** — {{precio_2}}
>
> ¿Te muestro fotos de los dos? 💜

**Regla:** nunca decir "agotado" sin dos alternativas concretas en el mismo
mensaje. Un "no" seco es una venta perdida; un "no, pero mira esto" es una
venta desviada.

### B4 · "¿Es plata de verdad?" *(la objeción #1 en tráfico frío)*

> ¡Buena pregunta! Me encanta responderla con total claridad 😊✨
>
> 💎 **Los charms:** Plata Esterlina 925 verificada, con su sello grabado — lo puedes revisar apenas lo recibas.
> ✨ **Los brazaletes:** base metálica de alta resistencia con acabado en baño de plata de alta calidad. No son plata maciza, y por eso su precio es tan accesible.
>
> ✅ Compatibles con charms Pandora originales
> ✅ Garantía de 30 días por defectos de fábrica
> ✅ Envíos con número de guía a toda Colombia
>
> **Para que duren como el primer día:**
> ❌ Perfumes y cremas directamente sobre la joya
> ❌ Piscina, mar y productos de limpieza
> ✅ Guárdala en su cajita cuando no la uses
> ✅ Si con el tiempo pierde brillo, un paño de joyería la deja como nueva
>
> ¿Para quién estás buscando? Te ayudo a elegir 💜

> ⚠️ **Verificar antes de usar:** la versión anterior decía *"cada uno lleva su
> sello S925 grabado"* e invitaba a comprobarlo. Si hay una sola referencia sin
> sello visible, esa frase se convierte en la prueba de que la engañaste. Aquí
> quedó como "con su sello grabado". Confírmalo pieza por pieza con tu
> proveedor y, si aplica a todas, vuelve a poner **S925** — es más contundente.

### B5 · Comparación con Pandora

> ¡Hola! 😊
> Manejamos diseños estilo Pandora — los mismos modelos que ya conoces, y **compatibles con tus charms Pandora originales**.
>
> La diferencia real está en el precio:
> ▪️ Pandora: desde $260.000 solo el brazalete
> ▪️ Zephora: brazalete desde **$58.000** + charms en Plata 925 desde **$72.000**
>
> Te cuento con transparencia cómo lo logramos: nuestros **charms sí son Plata Esterlina 925 verificada**, igual que los de Pandora. Los **brazaletes** los trabajamos con base de alta resistencia y baño de plata — por eso cuestan una fracción, y así puedes invertir en los charms, que son las piezas que guardan el significado 💜
>
> Pandora cobra la marca. Nosotros cobramos la joya.
>
> ¿Buscas algo para ti o para regalar? 🎁

> 📅 El dato de Pandora ($260.000) es externo. Revísalo cada trimestre: si ellos bajan y tú sigues citando esa cifra, tu argumento más delicado queda atacable.

### B6 · Talla

> ¡Te ayudo con eso, es más fácil de lo que parece! 😊
>
> 📏 Mide tu muñeca con un metro de costura (o con un cordón y luego una regla) y **súmale 2 cm** — ese espacio extra es el que hace que la pulsera caiga con elegancia y quepan tus charms.
>
> Ejemplo: muñeca de 16 cm → tu talla es **18 cm** ✨
>
> Si estás entre dos: la menor si te gusta ajustada, la mayor si la prefieres con movimiento. Y si vas a llevar varios charms, siempre la mayor.
>
> ¿Cuántos cm te dio? 💜

**Por qué importa:** la talla es la objeción silenciosa. La clienta que no sabe
qué pedir simplemente deja de responder, y nunca te enteras de por qué.

### B7 · "¿Dónde veo el catálogo?"

> ¡Claro! 📲
>
> Todos los diseños con precios están en **zephoracharms.com** — puedes armar tu pulsera ahí mismo y ver el total con el descuento ya aplicado ✨
>
> 💎 Charms en Plata 925: desde $72.000
> ✨ Brazaletes con baño de plata: desde $58.000
>
> Cuando la tengas armada, un botón te trae acá con todo listo 😊
>
> ¿Buscas un regalo 🎁 o algo para ti?

---

# C · Promociones, ofertas y charms recomendados

### C1 · Explicar la promo completa

> ¡Claro! Con gusto te doy toda la información ✨
>
> 💎 **Charms:** Plata Esterlina 925, desde **$72.000**
> ✨ **Brazaletes:** baño de plata, desde **$58.000**
> ⛓️ **Clips y cadenas de seguridad:** desde $65.000
>
> 📉 **Descuento por cantidad de charms:**
> ✦ 2 charms → 8% OFF
> ✦ 3 charms → 15% OFF
> ✦ 4 o más → 20% OFF
>
> 🔥 **PROMO DE LA SEMANA:** con **3 charms o más**, el brazalete baja **30%**
>
> ✨ Y lo mejor: **los dos descuentos se suman**. Con 4 charms llevas 20% en los charms *y* 30% en el brazalete, al mismo tiempo.
>
> 🎁 Además, cualquier pulsera de 3 charms pasa de $180.000 → **envío gratis**
>
> ¿Te armo una propuesta? Dime para quién es 💜

**Lo que cambió y por qué importa:** antes decías "brazalete + 3 charms", que se
lee como *exactamente tres*. El sistema aplica la promo con **3 o más**, y los
descuentos **acumulan**. Estabas describiendo tu mejor oferta como si fuera peor.
El salto de 3 a 4 charms es tu upsell más rentable y ahora sí lo estás usando.

### C2 · Propuestas armadas por persona

Ocho combinaciones con totales **verificados contra el motor de precios del
sitio**. Todas superan $180.000, así que **todas llevan envío gratis** — dilo
siempre, resuelve la objeción de costo antes de que aparezca.

| Para quién | Combinación | Total |
|---|---|---|
| **Mamá** | Corazón Liso + Virgen María + Árbol de la Vida + Ángel Guardián | **$236.100** |
| **Niña (Disney)** | Rosa Clásica + Stitch + Elsa + Ariel | **$257.350** |
| **Fan de Marvel** | Avengers + Iron Man + Capitán América + Spider-Man | **$257.350** |
| **Por su signo** | Clásica + [su signo] + Sol y Luna + Ángel Guardián | **$231.000** |
| **Amante de mascotas** | Corazón Liso + Huella con Huesito + Gatito + Árbol de la Vida | **$229.300** |
| **Graduación** | Clásica + Osito Graduación + [su carrera] + Trébol Giratorio | **$244.600** |
| **Viajera** | Clásica + Torre Eiffel + Avión y Pasaporte + Luciérnaga | **$224.200** |
| **Aniversario** | Corazón con Diamante + Filigrana + Luciérnaga + Sol y Luna | **$229.300** |

Plantilla para enviarlas:

> Te armé algo pensando en ella 💜
>
> ✨ **{{brazalete}}** — {{precio}}
> 💎 **{{charm_1}}** — {{precio_1}}
> 💎 **{{charm_2}}** — {{precio_2}}
> 💎 **{{charm_3}}** — {{precio_3}}
>
> Con la promo de esta semana:
> ~~{{subtotal}}~~ → **{{total}}** 🔥
> 🚚 Envío **gratis** ✓
>
> Cada charm ahí tiene su razón: {{una línea sobre el significado}}
>
> ¿Te gusta así o cambiamos alguno? 😊

**La frase que más vende:** "cada charm ahí tiene su razón". No estás vendiendo
tres piezas de metal, estás vendiendo que alguien pensó en ella. Ese es
literalmente el argumento de tu página ("No vendemos joyas. Guardamos momentos").

### C3 · "¿Cómo llego a los $206.350?"

Alguien va a hacer la cuenta y no le va a dar. Respuesta honesta, sin rodeos:

> ¡Buena pregunta! Ese precio sale con el brazalete más económico + 3 **cadenas de seguridad** ✨
>
> Pero te soy sincera: eso es más un mínimo técnico que una pulsera bonita 😅
>
> Con **charms de verdad**, la pulsera completa arranca en **$224.200** — brazalete + 3 charms, todo con descuento y **envío gratis** 🎁
>
> ¿Te armo una con los que te gusten y te digo el total exacto? 💜

**Por qué importa:** la clienta que hace la cuenta y no le da siente que el
precio anunciado no existe. Reconocerlo de frente convierte una trampa en un
punto de confianza — y $224.200 con envío gratis sigue siendo un cierre fuerte.

### C4 · Upsell al Empaque Premium

**Solo después de que confirme la compra. Nunca antes.**

> ¿Es para regalo? 🎁
>
> Todos los pedidos van en empaque cuidado, listo para entregar ✓
>
> Y si quieres que sea *ese* regalo, tenemos el **Empaque Premium** (+$40.000): caja rígida con interior de terciopelo y lazo — se entrega tal cual, sin envolver nada 💜
>
> ¿Se lo agrego?

**El número:** $40.000 sobre un pedido de $257.000 es **15% más de ticket** por
una sola pregunta.

### C5 · Upsell a la cadena de seguridad *(nuevo — ya estaba pagado en el código)*

> Un consejo de quien las arma todos los días 💜
>
> Cuando la pulsera lleva varios charms, pesa — y ahí es cuando se cae. La **cadena de seguridad** ({{accesorio_desde}}) evita justo eso.
>
> Y hay algo bueno: **cuenta como pieza para la promo** ✨ Así que si vas en 2 charms, agregarla te activa el 15% *y* el 30% del brazalete.
>
> ¿Te la sumo?

**Por qué funciona:** clips y cadenas viven en el mismo grupo que los charms, así
que suman para el mínimo de 3. Es un upsell que ya existía en el sistema y que
nunca estabas ofreciendo. Y llega como consejo de experta, no como venta.

### C6 · Empujón de 2 → 3 charms

Cuando lleva dos, está a un charm del salto más rentable:

> ¡Quedó divina así! 😍
>
> Solo te cuento una cosa: con **un charm más** se te activa la promo completa — el brazalete baja **30%** y los charms suben a **15%**.
>
> Con 2 charms: **{{total_2}}**
> Con 3 charms: **{{total_3}}** ✨ *(y ahí el envío te sale gratis)*
>
> O sea que el tercer charm te sale casi por la diferencia del descuento 💜
>
> ¿Te muestro tres que combinen con los que ya elegiste?

**Haz la cuenta delante de ella.** Ver los dos totales lado a lado hace el
trabajo que ningún adjetivo hace.

---

# D · Estado de pedidos y envíos

### D1 · Envíos y tiempos

> ¡Con gusto te cuento! 😊🚚
>
> Enviamos a **toda Colombia**:
> 📍 Bogotá: 1 a 2 días hábiles
> 📍 Otras ciudades: 2 a 4 días hábiles
> 📍 Zonas rurales: 4 a 6 días hábiles
>
> **Costo del envío:**
> ▪️ Pago anticipado (transferencia): **$15.000**
> ▪️ Pago contraentrega: **$25.000**
> ▪️ 🎁 **¡GRATIS desde $180.000!**
>
> 💳 Recibimos: Nequi, Bancolombia, tarjetas, **Addi** (a cuotas) y **contraentrega**
>
> Te mandamos el número de guía para que la rastrees 📦
>
> ¿A qué ciudad la enviaríamos? 📍

✅ Estas tarifas ya coinciden con lo que muestra la web. El conflicto de
"se cotiza por ciudad" quedó resuelto.

### D2 · Confirmación de pedido

> ¡Listo! Tu pedido quedó confirmado 🎉
>
> 📦 **{{piezas}}**
> 💰 Total: **{{total}}**
> 🚚 Envío: **{{envio}}**
> 📍 Para: {{nombre}} · {{direccion}} · {{ciudad}}
> 📱 Contacto: {{telefono}}
>
> ¿Está todo bien? Confírmame y lo despacho hoy mismo ✨

**Regla:** repetir la dirección completa antes de despachar. Un dígito mal en
la dirección cuesta el doble del envío y una clienta molesta.

### D3 · Pedido despachado

> ¡Tu pulsera ya va en camino! 🚚✨
>
> 📦 Guía: **{{guia}}**
> 🔍 Rastréala en: {{link_transportadora}}
> 📅 Llega aproximadamente el **{{fecha}}**
>
> Cuando la recibas me cuentas cómo te quedó 💜

### D4 · "¿Dónde está mi pedido?"

> ¡Ya te reviso! 😊
>
> Tu pedido va con guía **{{guia}}** y según la transportadora está **{{estado}}**.
> 📅 Fecha estimada: **{{fecha}}**
>
> Cualquier cosa yo te sigo el rastro y te aviso 💜

Si viene retrasado:

> Te cuento con honestidad: la transportadora reporta una demora 😔
>
> Tu pedido está **{{estado}}** y debería llegarte el **{{fecha_nueva}}**.
>
> Ya estoy encima del caso y te aviso apenas se mueva. Perdón por la espera — sé que la estabas esperando 💜

**Nunca esperar a que pregunte dos veces.** Adelantarte a un retraso convierte
un reclamo en una demostración de que estás pendiente.

### D5 · Postventa *(a las 48h de entregado)*

> ¡Hola {{nombre}}! 💜 ¿Ya te llegó tu pulsera? 😊
>
> Cuéntame cómo te quedó — y si te animas, etiquétanos en **@zephora_charms** para salir en nuestra página ✨
>
> Y recuerda: siempre puedes sumarle charms después. La pulsera crece contigo 🌸

**Este mensaje hace tres cosas a la vez:** confirma la entrega, te consigue
contenido de clienta real (que es lo que alimenta tu prueba social) y planta la
recompra. Cuesta un mensaje y es lo más rentable del catálogo.

---

# E · Objeciones y pagos

### E1 · "Está muy caro"

No defiendas el precio. Cambia la unidad de medida:

> Te entiendo perfectamente 💜 Y me alegra que preguntes, porque te puedo mostrar por qué cuesta lo que cuesta.
>
> Los charms son **Plata Esterlina 925 verificada** — no baño, no fantasía. Esa pulsera la vas a tener en 10 años y va a seguir siendo tuya.
>
> Y no tienes que llevarla completa de una: mucha clienta empieza con el brazalete y **1 o 2 charms**, y le va sumando en cumpleaños y fechas especiales 🎁
>
> Empezar te sale en **{{brazalete_desde}} + {{charm_desde}}**.
>
> ¿Te armo una opción así, para arrancar? 😊

**Por qué funciona:** "muy caro" casi nunca significa "no tengo el dinero" —
significa "no veo por qué vale eso". Bajar el punto de entrada convierte una
objeción de precio en una primera compra, y la pulsera de charms está diseñada
para crecer.

### E2 · "¿Puedo pagar contraentrega?"

> ¡Claro que sí! 😊 Es nuestra opción más pedida justamente por eso.
>
> 📦 **Pagas cuando la tengas en tus manos** — la revisas y ahí decides
> 🚚 Envío contraentrega: $25.000 *(o gratis desde $180.000)*
>
> Así no arriesgas nada 💜
>
> ¿A qué ciudad la enviamos?

**Esta es tu mejor respuesta para tráfico frío.** La objeción real de una
clienta que no te conoce no es el precio: es *"¿y si les pago y no me llega?"*.
Contraentrega la elimina de raíz. Ofrécela antes de que la pida.

### E3 · "¿Tienen cuotas?"

> ¡Sí! Trabajamos con **Addi** 💳
>
> Divides tu compra en cuotas, la aprobación es en minutos y solo necesitas tu cédula ✓
>
> Por ejemplo, una pulsera de {{total}} te queda en cuotas cómodas — te paso el link cuando la tengas armada.
>
> ¿Te la armo primero y vemos el total? 😊

### E4 · "¿Cómo sé que no es estafa?" *(pregunta clásica de pauta)*

No te ofendas — es la pregunta más sana que te pueden hacer, y responderla bien convierte.

> ¡Me encanta que preguntes! Es lo que yo haría 😊 Te muestro:
>
> ✅ **Paga contraentrega** — recibes primero, pagas después. No arriesgas nada.
> ✅ **@zephora_charms** en Instagram, cuenta verificada, con fotos reales de clientas
> ✅ **Más de 2.400 pulseras** entregadas en Colombia
> ✅ **Garantía de 30 días** por defectos de fábrica
> ✅ Envíos con **número de guía** rastreable
>
> Y si prefieres, empieza con algo pequeño para conocernos 💜
>
> ¿Te muestro fotos de pedidos que despachamos esta semana?

**Lo que cierra es la contraentrega**, mencionada de primera. Todo lo demás es
respaldo.

### E5 · "Lo voy a pensar"

Es un no suave. No la persigas — dale una razón concreta para volver:

> ¡Claro que sí, tómate tu tiempo! 💜
>
> Solo para que lo tengas presente: la promo del **30% en el brazalete** va hasta el **{{fin_promo}}** ⏳
>
> Te dejo tu propuesta guardada por si te decides:
> ✨ {{resumen}} — **{{total}}** con envío gratis
>
> Aquí estoy cuando quieras 😊

**Regla:** un solo recordatorio, a las 24-48h. Nunca dos. La urgencia solo
funciona si la fecha es real — si la promo no termina de verdad, no la
inventes: la clienta que vuelve a la semana y ve la misma promo aprende que
tus plazos no significan nada.

### E6 · Reclamo o pieza defectuosa

> Lo siento muchísimo 😔 Eso no debió pasar y lo vamos a resolver.
>
> ¿Me mandas una **foto** de la pieza? Con eso lo tramito de una.
>
> Tienes **garantía de 30 días** por defectos de fábrica: te la reponemos sin costo 💜

**Primero la disculpa, después la solución, nunca la excusa.** Una clienta con
un problema bien resuelto compra más que una que nunca tuvo problemas.

### E7 · Derivar a humano

> ¡Entendido! 🙋‍♀️ Ya le paso tu caso a nuestro equipo.
>
> Mientras te conecto, déjame por acá la **foto de la joya** que te gustó o tu duda exacta 👇
> Así te respondo mucho más rápido apenas te lea 💜
>
> *(Atendemos de {{horario}}. Si escribes fuera de ese rango, te respondemos apenas abrimos.)*

---

## Seguimiento: los tres momentos que recuperan ventas

Sin el historial de conversaciones esto es criterio de oficio, no dato tuyo.
Cuando llegue el export se ajusta con lo que de verdad funcionó.

| Cuándo | A quién | Mensaje |
|---|---|---|
| **24-48h** | Preguntó y no respondió | C2 con una propuesta armada — no "¿sigues interesada?" |
| **48h post-entrega** | Ya recibió | D5 — reseña + foto + semilla de recompra |
| **~30 días antes de fecha especial** | Compró para regalo | "Se acerca el cumpleaños de {{nombre}} 🎁" |

El tercero es el más valioso y el que nadie hace: una pulsera de charms está
**diseñada para crecer**. Cada clienta que compró es una recompra en cada fecha
importante — pero solo si te acuerdas tú, porque ella no va a acordarse sola.

---

## Lo que falta

1. **`{{horario}}`** — aparece en A3 y E7
2. **`{{fin_promo}}`** — E5 necesita una fecha real
3. **El Excel de stock** — para que B1 pueda afirmar disponibilidad sin verificación manual
4. **Confirmar el sello S925** con el proveedor (ver B4)
5. **El export de WhatsApp** — para afinar el tono con lo que de verdad cerró ventas
