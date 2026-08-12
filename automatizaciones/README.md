# Automatizaciones — Zephora Charms

El motor que conecta la tienda con n8n, Gemini y Meta. Vive **dentro de este
repo y no en uno aparte**, a propósito: las tres automatizaciones leen datos que
solo existen aquí —`assets/catalogo.json`, `assets/stock.json`, el inventario
apartado en Netlify Blobs, los eventos que dispara el checkout—. Separarlas
obligaría a copiar el catálogo o a sincronizarlo, y un asesor que cotiza con
precios de la semana pasada hace más daño que no tener asesor.

## Qué va en cada carpeta

| Carpeta | Qué guarda |
|---|---|
| `contratos/` | Qué manda cada pieza y qué espera recibir. Es lo primero que hay que leer y lo primero que hay que actualizar cuando algo cambia. Hoy: [`purchase-capi.md`](contratos/purchase-capi.md), [`disponibilidad.md`](contratos/disponibilidad.md) y [`carritos-abandonados.md`](contratos/carritos-abandonados.md) |
| `n8n/` | Los workflows exportados en JSON, para que existan en git y no solo dentro del servidor de n8n |
| `prompts/` | Los prompts de sistema del asesor comercial, versionados como código |

Lo que **no** va aquí: código que corre en producción. Eso vive en
`netlify/functions/`, donde ya están las llaves de Wompi y el acceso a Blobs.
Tener dos sitios donde buscar un handler es tener un sitio donde no buscar.

## Estado de las tres automatizaciones

### 1. `Purchase` server-side a Meta (CAPI) — **hecho, falta el token**

Cuando Wompi confirma un pago, `netlify/functions/wompi-webhook.mjs` manda el
evento `Purchase` a la Conversions API. Contraentrega lo manda `crear-pago.mjs`,
que para ese pedido es el único momento en que consta que existe. El contrato completo, el porqué de cada
decisión y **cómo probarlo** están en
[`contratos/purchase-capi.md`](contratos/purchase-capi.md).

`META_CAPI_TOKEN` **ya está puesto en Netlify**, así que esto está mandando
eventos reales. Falta verificar la deduplicación contra el pixel — ver
`contratos/purchase-capi.md` § Cómo probarlo.

### 2. Asesor comercial por WhatsApp (Gemini) — **prompt y datos listos, falta conectarlo**

- ✅ **De dónde lee el stock: resuelto.** `/.netlify/functions/disponibilidad`
  devuelve catálogo, precios, reglas de cobro y disponibilidad **ya restada** —el
  conteo menos lo apartado por pagos en curso— en una lectura. Contrato en
  [`contratos/disponibilidad.md`](contratos/disponibilidad.md). Era el bloqueo
  real: prometer por WhatsApp una pieza ya reservada es el mismo error que la
  reserva de inventario vino a arreglar.
- ✅ **Prompt de sistema escrito**, en
  [`prompts/asesor-whatsapp.md`](prompts/asesor-whatsapp.md). Rescatado de una
  rama vieja y corregido: traía Addi como medio de pago (Wompi confirmó que no
  lo es), precios desactualizados y el envío gratis mal aplicado.
- ❌ **Falta decidir cómo se conecta a WhatsApp.** Es lo que bloquea el resto:
  hace falta la API Cloud de WhatsApp Business. Los puentes no oficiales
  funcionan hasta que Meta banea el número del negocio.
- ❌ Falta el flujo en n8n y guardar los borradores con sus correcciones.

Arranca en modo borrador: redacta, una persona envía. El porqué y el camino para
abrir la mano están en el prompt.

### 3. Carritos abandonados — **funcionando por correo**

`netlify/functions/recuperar-carritos.mjs` corre cada 15 minutos y le escribe a
quien salió hacia la pasarela y no volvió con un pago aprobado. Contrato en
[`contratos/carritos-abandonados.md`](contratos/carritos-abandonados.md).

Resultó mucho más barato de lo previsto: **no hizo falta rastrear el carrito**.
`crear-pago` ya conoce nombre, correo, celular y piezas de todo el que llega a
la pasarela, y el webhook sabe si pagó. Un pedido creado que no se confirma es
un carrito abandonado con contacto completo.

Un solo mensaje por pedido, 45 minutos de espera, sin promociones —para que siga
siendo transaccional— y los datos se borran a los 7 días.

Falta mandarlo también por WhatsApp cuando esté la API Cloud (ojo con la ventana
de 24 h de Meta: fuera de ella hace falta plantilla aprobada) y poder retomar el
pedido con un clic.

## Reglas de trabajo

- **Nada que gaste presupuesto real se ejecuta sin aprobación previa.** Campañas,
  conjuntos, anuncios, pujas: primero se muestra el payload exacto. Lecturas y
  diagnósticos van directo. Sigue vigente aunque el conector tenga permisos de
  escritura.
- **Los tokens no van en el repo ni en un chat.** `.env` (ya en `.gitignore`) o
  credential de n8n. Ver `.env.example`.
- **Un workflow que solo existe en el servidor de n8n no existe.** Al publicar un
  cambio, exportar el JSON a `n8n/`.
- **Lo que se le manda a Meta se prueba con `test_event_code` antes de contarlo
  como conversión real.**
