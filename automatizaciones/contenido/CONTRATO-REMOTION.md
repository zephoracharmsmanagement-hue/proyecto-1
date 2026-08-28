# Contrato del paquete de rodaje — lo que Remotion recibe

Este archivo existe por una razón concreta: **el motor y Remotion se están
construyendo en dos sesiones a la vez**, y este repo ya pagó una vez el precio
de no acordar la frontera antes de escribir código (`ESTADO.md` § *Ramas
abiertas*: dos rescates de carritos, cero conflictos de git, dos correos a la
misma clienta).

Así que la frontera va aquí, antes que el código:

| Lado | Es dueño de | No toca |
|---|---|---|
| **Motor** (n8n + `netlify/functions/`) | Decidir la pieza, escribir el guion, emitir el JSON de abajo | `remotion/` |
| **Remotion** (`remotion/`) | Componentes React, render de portadas, b-roll y piezas sin rodaje | `netlify/functions/`, los workflows de n8n |

**Lo único que cruza es el JSON de abajo.** Mientras los dos lados respeten esa
forma, las dos sesiones pueden ir en paralelo sin pisarse.

---

## Por qué Remotion encaja aquí, y dónde no

**Dónde no:** Remotion **no reemplaza CapCut** para el Reel principal, y eso no
cambia. La decisión 1 del [brief](BRIEF.md) no era sobre montaje, era sobre
**audio**: el audio en tendencia solo se consigue dentro de TikTok y CapCut, y
en video corto es la mitad de la viralidad. Remotion renderiza video perfecto y
**mudo**. Montar el Reel principal en Remotion entregaría justo la parte que no
sirve.

**Dónde sí, y es más de lo que parece.** Remotion es fuerte exactamente en las
piezas donde el audio no decide:

| Pieza | Por qué Remotion y no otra cosa |
|---|---|
| **Portadas de Reels** | Lo más importante de la Fase 2 y donde Remotion es imbatible: misma tipografía, misma retícula, la **foto real** compuesta. Determinista y repetible — dos portadas hechas el mismo día se ven iguales, que es el punto entero de que la cuadrícula parezca marca |
| **B-roll con movimiento** | 3 segundos de la pieza real con paneo o zoom, en MP4 mudo, que se arrastra a CapCut. El audio se sigue eligiendo allá. Sin conflicto |
| **Carruseles** | Guía de tallas, cómo armar tu pulsera, cuidado de la plata. Una diapositiva por `renderStill()`, alimentada de `disponibilidad` |
| **Creativos de video para pauta** | El encaje más directo con dinero. Los anuncios se ven **en mudo** la mayor parte del tiempo, así que aquí la objeción del audio no aplica. Hoy la cuenta tiene 4 anuncios y 2 pausados; con variantes generadas, la que manda es el costo por resultado, no la opinión |
| **Piezas que no necesitan rodaje** | La historia de las 14 letras, «novedades de la semana», tarjetas de precio. Tipografía y movimiento, cero cámara |

Esa última fila importa más de lo que parece: el brief cierra diciendo que la
única dependencia sin solución técnica es **que alguien grabe**. Remotion no la
elimina, pero **le quita la exclusiva**: hay contenido publicable los días que
no se grabó nada.

### Y una consecuencia que resuelve un problema del repo

La decisión 5 del brief dice que **los videos no se comitean** — ~15 créditos
por despliegue y el historial de git se los queda para siempre.

**Remotion le da la vuelta a eso:** el video deja de ser un binario y pasa a ser
**código fuente**. Lo que se comitea es el componente React, que pesa kilobytes,
se revisa en un diff y se vuelve a renderizar cuando cambie el precio o la foto.
El MP4 y el PNG son **salida de build**, y van a `.gitignore` como cualquier
otra salida de build.

Es el mismo motivo por el que las 10 imágenes de `assets/ads/` sí están
versionadas y un video no: lo que se versiona es lo que produce el archivo, no
el archivo.

### Las tres cosas que hay que saber antes de apoyarse en esto

1. **Licencia.** Remotion es gratis para personas y organizaciones de **hasta 3
   integrantes**; a partir de **4** hace falta licencia de empresa (~$25 al mes
   por asiento). Zephora Charms está holgadamente dentro del tramo gratis hoy —
   pero es un umbral por número de personas, no por facturación, así que conviene
   saber que existe antes de que el equipo crezca.
2. **El render necesita host propio.** Remotion levanta Chromium y encoda con
   FFmpeg. **Netlify no sirve para eso** — sus funciones no son el sitio para
   arrancar un navegador. Las salidas realistas son la máquina del propietario,
   GitHub Actions (ya hay flujo en `.github/`, y sus minutos son gratis en este
   volumen) o Remotion Lambda, que es AWS y cuesta. **Empezar por local**: a
   este volumen no hay nada que optimizar todavía.
3. **La regla de la imagen sigue en pie, y Remotion la hace más fácil de
   cumplir.** Remotion **compone**, no inventa: la foto que entra es la real de
   `assets/`. Eso es exactamente lo que pide la decisión 2 del brief —la pieza es
   real y solo el fondo se produce—. Un componente que dibuje una pieza que no
   existe rompe la regla igual que lo haría una imagen generada; el que ponga
   `assets/atrapasuenos-azul.webp` sobre un fondo bonito, no.

---

## El JSON

Un paquete. Es lo que el motor deja en la Data Table y lo que Remotion recibe
como props (`--props` o `inputProps`). Ejemplo real, con datos de
`assets/stock.json` (`generado: 2026-08-16`):

Ver [`ejemplo-paquete.json`](ejemplo-paquete.json) — se puede pasar tal cual a
un render para probar sin que exista el motor todavía.

### Campos, y cuáles no se pueden inventar

| Campo | Tipo | Nota |
|---|---|---|
| `id` | string | Identifica el paquete en la Data Table y en el enlace medido |
| `pieza.id` | string | Clave de `stock.json`. **Tiene que existir**: es lo que ata todo lo demás a algo vendible |
| `pieza.nombre` | string | Legible, para pantalla |
| `pieza.precio` | number | COP, sin decimales |
| `pieza.foto` | string | Ruta bajo `assets/`. **Foto real, siempre** |
| `pieza.unidades_al_decidir` | number | **Nunca menor que 3.** Es el campo que delata que la lectura de disponibilidad se cayó (§ 1.5 del brief) |
| `pieza.fuente_disponibilidad` | `"conteo-menos-apartado"` \| `"solo-conteo"` | Viene de `disponibilidad`. Si dice `solo-conteo`, **el paquete no se aprueba**: no se sabe qué hay |
| `gancho` | string | Los primeros 3 segundos |
| `guion[]` | array | `{ desde, hasta, texto, toma }` en segundos |
| `tomas[]` | array | **En orden de rodaje, no de montaje** |
| `subtitulos[]` | array | `{ desde, hasta, texto }` |
| `textos.tiktok` / `.instagram` / `.facebook` | string | Copy y hashtags, distintos por red |
| `enlace` | string | El enlace medido de este paquete |
| `estado` | `propuesto`\|`aprobado`\|`grabado`\|`publicado` | Remotion solo renderiza `aprobado` o posterior |

**`unidades_al_decidir` y `fuente_disponibilidad` no son decorativos.** Son las
dos delaciones del fallo mudo de este motor: proponer piezas que no se pueden
vender. Un renderizador que los ignore produce portadas preciosas de cosas
agotadas y nadie se entera hasta que una clienta lo pida.

### Composiciones que Remotion expone

| Nombre | Salida | Para |
|---|---|---|
| `Portada` | PNG 1080×1920 | La cuadrícula del perfil |
| `Broll` | MP4 mudo, 3 s | Cortes dentro del Reel, se arrastra a CapCut |
| `Carrusel` | PNG 1080×1350 × N | Guías que se guardan |
| `SinRodaje` | MP4 mudo, 5–15 s | Piezas que no necesitan cámara |

**Todas mudas a propósito.** El audio se elige en CapCut o dentro de la app.
Si alguna composición empieza a llevar pista de audio, la decisión 1 se está
deshaciendo sin que nadie lo haya decidido.
