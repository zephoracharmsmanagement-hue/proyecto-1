# Prompts del asesor comercial

Los prompts se versionan como código: un prompt es lo que decide qué le promete
el negocio a una clienta, y cambiarlo sin dejar rastro es cambiar la oferta sin
dejar rastro.

| Archivo | Qué es |
|---|---|
| [`asesor-whatsapp.md`](asesor-whatsapp.md) | El prompt de sistema del asesor comercial, con su modo de operación y el registro de qué se corrigió al rescatarlo |

## Decisiones ya tomadas

**Sin base vectorial.** `assets/catalogo.json` son 10 KB —132 piezas y 18
pulseras— y cabe entero en el contexto del modelo. Montar embeddings para eso
añade un componente que puede recuperar el fragmento equivocado, a cambio de
nada. Si el catálogo creciera un orden de magnitud, se revisa.

**El stock sale de una función, no de un archivo.** `stock.json` dice cuántas
unidades se contaron; no sabe cuántas están apartadas por un pago en curso. Eso
vive en Blobs. `/.netlify/functions/disponibilidad` hace la resta y devuelve un
número — ver [`../contratos/disponibilidad.md`](../contratos/disponibilidad.md).
La aritmética de inventario no se le delega a un modelo.

**Borrador antes que envío automático.** El asesor redacta y una persona envía.
El razonamiento y el camino para abrir la mano están en `asesor-whatsapp.md`.
