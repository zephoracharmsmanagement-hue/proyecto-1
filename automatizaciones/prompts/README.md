# Prompts del asesor comercial

Vacío todavía. Aquí van los prompts de sistema del asesor de WhatsApp,
versionados como código: un prompt es lo que decide qué le promete el negocio a
una clienta, y cambiarlo sin dejar rastro es cambiar la oferta sin dejar rastro.

## Decisiones ya tomadas

**Sin base vectorial.** `assets/catalogo.json` son 10 KB —132 piezas y 18
pulseras— y cabe entero en el contexto del modelo. Montar embeddings para eso
añade un componente que puede recuperar el fragmento equivocado, a cambio de
nada. Si el catálogo creciera un orden de magnitud, se revisa.

## Lo que hay que resolver antes de escribir el primer prompt

**De dónde lee el stock.** `assets/stock.json` dice cuántas unidades existen,
pero no cuántas están apartadas: eso vive en el almacén `inventario` de Netlify
Blobs, que lleva la cuenta de lo comprometido (ver `netlify/functions/_inventario.js`).
Un asesor que lea solo el archivo va a prometer piezas que ya están reservadas
por un pago en curso — el mismo error que la reserva de inventario vino a
arreglar, solo que ahora por WhatsApp y con una persona esperando respuesta.

Lo razonable es una función que sirva catálogo y disponibilidad real en una sola
lectura, y que el prompt consuma eso y no los archivos sueltos.

**Qué NO puede prometer.** El asesor habla en nombre de la tienda, así que
cualquier cosa que diga sobre envíos, garantía o devoluciones tiene que
coincidir con `envios-y-devoluciones.html` y `terminos-y-condiciones.html`. Bajo
la Ley 1480 gana lo prometido, no lo escrito en la política. En particular: el
derecho de retracto tiene la excepción del artículo 47 y no se anuncia sin
condición — hay contexto en `ESTADO.md` § 5b.
