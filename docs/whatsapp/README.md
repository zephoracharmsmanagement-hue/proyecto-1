# Sistema de respuestas de WhatsApp · Zephora Charms

**Empieza aquí.** Este documento es el estado del proyecto: qué existe, qué está
funcionando, qué falta y qué ya se decidió. Si abres una sesión nueva, lee esto
primero y no hará falta reconstruir el contexto.

Última actualización: 2026-08-09

---

## Los archivos

| Archivo | Qué es |
|---|---|
| **[macros-para-copiar.md](macros-para-copiar.md)** | Las 28 respuestas listas para usar, en sintaxis de WhatsApp. **Este es el de uso diario.** |
| [01-auditoria-macros.md](01-auditoria-macros.md) | Auditoría de las macros originales contra el inventario real. Los 3 errores de cifras que se encontraron y por qué importaban. |
| [02-macros.md](02-macros.md) | El catálogo con el razonamiento de cada macro. Referencia, no uso diario. |
| [03-system-prompt.md](03-system-prompt.md) | Cómo integrar la IA: arquitectura, código, caché, costos, opciones de integración. |
| [system-prompt.txt](system-prompt.txt) | El prompt en crudo, con `{{INVENTARIO_JSON}}` y `{{STOCK_JSON}}` por reemplazar. |
| `../../data/inventario.json` | Catálogo y reglas de precio. Generado desde `index.html`. |
| `../../data/stock.json` | Disponibilidad real. Generado desde el Excel de inventario. |
| `../../data/stock-mapeo.json` | Correcciones manuales del cruce Excel ↔ sitio. |

## Comandos

```sh
node scripts/inventario.mjs                    # regenera data/inventario.json desde index.html
node scripts/stock.mjs "ruta/al/Excel.xlsx"    # regenera data/stock.json desde el Excel
```

Corre el segundo cada vez que actualices el Excel de inventario.

---

## ⚠️ Qué está funcionando y qué no

Esta es la distinción más importante del proyecto — casi todo está **escrito**,
poco está **corriendo**.

| | Estado |
|---|---|
| Las 28 macros | ✅ **Usables hoy**, copiar y pegar, cero configuración |
| `inventario.json` / `stock.json` | ✅ Se generan con un comando |
| Tarifas fijas de envío en la web | ⚠️ **En el código, NO desplegado** |
| Selector de talla en la web | ⚠️ **En el código, NO desplegado** |
| System prompt + IA redactando | ❌ Escrito, no conectado a nada |

### El sitio en vivo está desactualizado

`index.html` tiene dos cambios commiteados que **no están publicados**:

1. **Tarifas fijas de envío** ($15.000 anticipado / $25.000 contraentrega). El
   sitio en vivo sigue diciendo *"Se cotiza por ciudad"* — que contradice lo
   que prometen las macros.
2. **Selector de talla** (17–21 cm) en los 18 brazaletes. Importa porque el
   inventario nuevo maneja stock **por talla**, no por modelo.

**Para desplegar:** no hay rama `main` ni `netlify.toml` en el repo — el README
raíz indica que se despliega arrastrando la carpeta a Netlify. Ojo con el
proyecto de destino: `zephoracharms.com` lo sirve **`fanciful-trifle-64ca74`**,
no los proyectos llamados `zephoracharms` ni `zephora-charms`. Desplegar en el
equivocado "funciona" sin cambiar nada de lo que ve el público.

---

## Decisiones ya tomadas

No hace falta volver a discutirlas. Si alguna se reabre, que sea con información
nueva, no por olvido.

| Decisión | Qué se resolvió |
|---|---|
| **Tarifas de envío** | Fijas: $15.000 anticipado / $25.000 contraentrega, gratis desde $180.000. La web se actualizó para coincidir con las macros. |
| **"Desde $206.350"** | Se conserva, aunque esa canasta son 3 cadenas de seguridad y el piso real con charms es $224.200. Riesgo documentado en `01-auditoria-macros.md`; la macro C3 responde de frente a quien haga la cuenta. |
| **Modo de operación** | La IA redacta, **una persona aprueba y envía**. Así la promesa "sin bots" del sitio sigue siendo cierta. |
| **Talla** | Selector en la web (17–21 cm). Si la clienta no elige, el pedido dice "(talla por confirmar)". |
| **Stock** | Conectado desde el Excel vía `scripts/stock.mjs`. |
| **Skill** | Se decidió **no crear una todavía** — esperar a ver si n8n la vuelve redundante. |
| **Modelo** | Arrancar con `claude-opus-5`. Comparar con Sonnet 5 después de dos semanas de borradores revisados. |

---

## Qué falta

Ordenado por quién lo desbloquea.

### Depende de ti (datos que solo tú tienes)

1. **`{{horario}}`** de atención — aparece en las macros A3 y E7 y en el prompt.
   Es de un minuto y es lo que más se nota vacío.
2. **Fecha real de fin de promo** (`{{fin_promo}}`) — la macro E5 la necesita, y
   solo funciona si la fecha es real.
3. **Confirmar el sello S925** con el proveedor. La macro B4 invita a la clienta
   a comprobarlo al recibir; si una sola referencia no lo trae, esa frase se
   vuelve la prueba de que la engañaste.
4. **Las 38 referencias sin emparejar** — ver abajo.

### Depende de una decisión

5. **Desplegar el sitio** — falta confirmar el proyecto de Netlify.
6. **Montar n8n** — falta API key de Anthropic y definir a dónde llegan los
   borradores para aprobación (¿Telegram? ¿WhatsApp interno?).

### Lo de mayor valor

7. **El export de conversaciones de WhatsApp.** Es lo único que no se puede
   sustituir con criterio: las macros dicen qué ofreces, el historial dice qué
   cerró ventas de verdad. Va en `insumos/whatsapp/` (está en `.gitignore` —
   trae datos personales de clientas).

---

## El cruce de stock: 38 referencias sin resolver

`scripts/stock.mjs` emparejó **52 de 86 charms** y **14 de 18 brazaletes**. Las
38 restantes están listadas en `data/stock.json` → `diagnostico`.

**No es un bug del script.** El cruce nunca adivina: solo empareja cuando el
nombre coincide exacto o son las mismas palabras en otro orden. Lo que queda
son piezas que, con los nombres del Excel, no se pueden identificar con certeza.
Cada una es uno de dos casos:

- **La misma joya con otro nombre** → agrégala a `data/stock-mapeo.json` como
  `"id-del-sitio": "SKU-DEL-EXCEL"`. Queda resuelto para siempre.
- **Ya no se fabrica** → hay que retirarla del sitio.

El caso que lo hizo evidente: una clienta pidió el charm *Luciérnaga "You Are My
Light"* y no existe en ninguna de las 124 referencias del inventario nuevo.
Mientras una pieza siga sin emparejar, las macros la tratan como antes — piden
un momento y marcan `[VERIFICAR STOCK]` — así que no hay riesgo de prometer mal,
pero cada referencia sin resolver es un caso así esperando a repetirse.

> **Nota:** dos de las ocho propuestas de la macro C2 usaban la Luciérnaga. Ya
> están corregidas en `macros-para-copiar.md` con reemplazos de stock verificado.

---

## Costos

Con el prompt completo (inventario + stock + reglas) en **14.725 tokens**,
cacheado, a 4.000 COP/USD:

| Modelo | COP por borrador | COP/mes a 500/día |
|---|---|---|
| **Opus 5** | 70 | $1.056.750 |
| Sonnet 5 *(precio intro hasta 31-ago-2026)* | 28 | $422.700 |
| Haiku 4.5 | 14 | $211.350 |

**El caché de prompt baja el costo un 79%** y son tres líneas de código. La
trampa que lo rompe: interpolar la fecha o la promo dentro del prompt cacheado
— eso cambia el prefijo en cada request y nunca vuelves a leer del caché.
Lo variable va como mensaje de sistema al final. Detalles en
[03-system-prompt.md](03-system-prompt.md).

---

## Lo que nunca se probó

El system prompt **no se ha ejecutado contra el modelo** — no había credenciales
de API en la sesión donde se escribió. Solo se verificó que ensambla
correctamente (14.725 tokens, sin marcadores sin resolver). Antes de ponerlo
frente a clientas, pruébalo con 10 conversaciones reales.
