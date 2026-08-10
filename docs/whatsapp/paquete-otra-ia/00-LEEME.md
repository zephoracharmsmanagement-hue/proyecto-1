# Cómo usar este paquete con otra IA
### ChatGPT, Gemini, Claude.ai, o cualquier chat que acepte archivos adjuntos

Este paquete convierte cualquier chat de IA en una asistente para redactar
respuestas de WhatsApp de Zephora Charms — con tu catálogo real, tu stock
real y tu tono de marca.

**Funciona igual en cualquier plataforma:** abres un chat nuevo, subes los
archivos, pegas un mensaje de arranque, y desde ahí le pegas lo que escriban
tus clientas.

---

## Paso 1 · Abre un chat nuevo

Uno dedicado solo a esto — no lo mezcles con otras conversaciones, porque las
instrucciones y los archivos se quedan fijos en el contexto de ese chat
mientras dure.

## Paso 2 · Sube estos 3 archivos

| Archivo | Qué es |
|---|---|
| `02-inventario.json` | Catálogo completo: cada pieza, su precio, y las reglas de descuento y envío |
| `03-stock.json` | Disponibilidad real, sacada del inventario físico |
| `04-macros-de-referencia.md` | 28 respuestas ya probadas, para que la IA calibre el tono |

**No subas el archivo `01-instrucciones-para-la-ia.md`** — ese lo pegas como
texto, no como adjunto (ver paso 3). Casi todas las plataformas leen mejor
las instrucciones cuando van en el cuerpo del mensaje en vez de en un archivo.

## Paso 3 · Pega esto como tu primer mensaje

Abre `01-instrucciones-para-la-ia.md`, copia **todo** el contenido, y pégalo
como el primer mensaje del chat — justo después de subir los 3 archivos del
paso 2. Ese texto es el que le enseña las reglas: qué nunca debe inventar,
cómo calcular un total, cómo suena la marca.

## Paso 4 · Empieza a pegar mensajes de clientas

Desde ahí, cada vez que una clienta te escriba, pega su mensaje en el chat.
La IA te va a devolver un borrador listo para copiar a WhatsApp.

**Revisa siempre antes de enviar — esto sigue siendo obligatorio, no
opcional.** Ninguna IA (esta o cualquier otra) envía el mensaje por ti; tú
lees el borrador, lo ajustas si hace falta, y lo mandas. Si el borrador trae
una nota como `[VERIFICAR STOCK: ...]` o `[VERIFICAR TOTAL]`, confírmalo antes
de responder — significa que la IA no tenía el dato para afirmarlo con
certeza.

---

## Cuando actualices precios o stock

Los archivos `02-inventario.json` y `03-stock.json` son una foto del momento
en que se generaron. Si cambias un precio en la web o llega mercancía nueva,
esos archivos quedan desactualizados y hay que repetir el proceso:

1. Genera los archivos nuevos (quien te ayudó a montar esto sabe cómo).
2. Empieza un chat nuevo — no reemplaces los archivos en el chat viejo, la
   mayoría de plataformas no permiten actualizar un adjunto ya subido.
3. Repite los pasos 1 a 3 con los archivos frescos.

## Qué NO incluye este paquete

- **El Excel bruto de inventario.** Trae costos y márgenes internos —
  información financiera que no debe salir de tu equipo. Lo que sí incluye
  (`03-stock.json`) es solo disponibilidad: nunca precios de costo.
- **Conversaciones reales de WhatsApp.** Traen nombres, teléfonos y
  direcciones de clientas — datos personales que no se comparten con
  servicios externos.
- **Envío ni aprobación automática de mensajes.** Este paquete redacta
  borradores. Enviarlos sigue siendo una decisión humana, siempre.

## Limitaciones a tener presentes

- Este texto de instrucciones **no se probó contra el modelo específico**
  que vayas a usar (ChatGPT, Gemini, etc.) — se escribió pensando en el
  comportamiento general de un asistente de IA, pero cada plataforma tiene
  sus propios matices. Prueba con 5-10 mensajes reales antes de confiar en
  él para tráfico en vivo.
- **38 referencias del catálogo no tienen stock verificado todavía**
  (quedaron documentadas aparte, fuera de este paquete). La IA las tratará
  como "sin dato" y pedirá verificación — eso es correcto, no un error.
