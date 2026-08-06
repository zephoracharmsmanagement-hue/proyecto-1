# Zephora Charms

Sitio de [zephoracharms.com](https://zephoracharms.com/) — joyería con significado: charms en Plata 925 y brazaletes con baño de plata, compatibles con Pandora. Envíos a toda Colombia.

## Estructura

| Archivo | Qué es |
|---|---|
| `index.html` | El sitio completo. Un solo archivo autocontenido, sin build ni dependencias. |
| `skills-lock.json` | Skills instaladas en el proyecto (fuente + hash). |
| `.claude/skills/` | Agent Skills disponibles al trabajar en este repo. |

`index.html` lleva las imágenes incrustadas como data URIs en base64. Eso lo hace portable —se abre con doble clic, se despliega arrastrándolo— pero pesa 2.6 MB, de los cuales ~2.5 MB son imágenes. Sacarlas a archivos `.webp` con `loading="lazy"` es la mejora pendiente más grande para velocidad de carga.

## Despliegue

Hoy el despliegue a Netlify es manual (arrastrar `index.html` al panel).

Para que Netlify despliegue solo en cada push, se conecta este repo en *Site configuration → Build & deploy*. Sin build command, y el directorio de publicación es la raíz.

## Medición

Meta Pixel `2130673404542988` (dataset "zephora charms pixel 1"). Eventos que dispara la página:

| Evento | Cuándo |
|---|---|
| `PageView`, `ViewContent` | Carga del catálogo |
| `AddToCart` | Se agrega un charm, o se elige el brazalete base |
| `InitiateCheckout` | Se empieza a armar la pulsera |
| `Lead` | Se envía el pedido por WhatsApp |
| `Contact` | Clics a WhatsApp/Instagram, etiquetados por sección |

`Lead` es la conversión real a optimizar en campañas: el checkout ocurre en WhatsApp, fuera del sitio.

Al tocar el pixel, verificar con **Events Manager → Probar eventos** antes de dar por bueno el cambio.

## Historial

Cada versión del sitio es un commit sobre `index.html`. Para ver qué cambió entre dos versiones:

```
git log --oneline -- index.html
git diff <commit-anterior> <commit> -- index.html
```

Los diffs de este archivo incluyen las líneas de base64 cuando cambia una imagen, así que conviene filtrar el ruido:

```
git diff <a> <b> -- index.html | grep -vE '^[+-].{500,}'
```
