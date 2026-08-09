# Exportaciones de WhatsApp

Aquí van los `.txt` exportados desde WhatsApp Business, para el análisis de tono
y preguntas frecuentes de la Fase 1.

## Cómo exportar

WhatsApp Business → abrir el chat → ⋮ → **Más** → **Exportar chat** → **Sin archivos**.

Sin archivos multimedia: las fotos no aportan al análisis de tono y hacen el
export mucho más pesado.

Ideal: 8 a 12 chats variados, mezclando ventas cerradas, consultas que no
compraron y reclamos. Los tres grupos enseñan cosas distintas — las que no
compraron son las más informativas, porque muestran dónde se cae la conversación.

## Estos archivos no se suben a git

`.gitignore` excluye todo este directorio salvo este README.

Un export de WhatsApp contiene nombres completos, números de teléfono y
direcciones de entrega de tus clientas. Eso es dato personal bajo la Ley 1581
de 2012, y un repositorio —aunque sea privado hoy— es exactamente el lugar
donde no debe quedar archivado para siempre.

Lo que sí se versiona son las conclusiones agregadas: tono, frecuencia de
preguntas, patrones de cierre. Nunca conversaciones textuales, y ningún
ejemplo que permita identificar a una clienta. Si un ejemplo textual resulta
imprescindible para ilustrar un patrón, va anonimizado.
