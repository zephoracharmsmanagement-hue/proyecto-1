# Zephora Charms

Sitio de [zephoracharms.com](https://zephoracharms.com/) — joyería con significado: charms en Plata 925 y brazaletes con baño de plata, compatibles con Pandora. Envíos a toda Colombia.

## Estructura

| Archivo | Qué es |
|---|---|
| `index.html` | El sitio completo: markup, estilos y scripts. Sin build ni dependencias. |
| `assets/` | Las 109 imágenes del sitio (106 `.webp`, 3 `.jpg`). |
| `skills-lock.json` | Skills instaladas en el proyecto (fuente + hash). |
| `.claude/skills/` | Agent Skills disponibles al trabajar en este repo. |

Las imágenes vivían incrustadas en el HTML como data URIs en base64, lo que hacía el archivo portable pero pesado: 2.5 MB, de los cuales 2.4 MB eran imágenes. Peor todavía, `loading="lazy"` no hace nada sobre un data URI —los bytes ya viajan dentro del HTML—, así que cada visitante descargaba las 109 imágenes antes de ver nada.

Ahora son archivos externos y el HTML pesa 115 KB. El navegador pide solo la imagen del hero al cargar y el resto conforme aparecen en pantalla.

## Despliegue

**Se arrastra la carpeta del proyecto, no `index.html` suelto.** Ese archivo ya no es autocontenido: sin `assets/` al lado, las 109 imágenes salen rotas.

Netlify publica la raíz de lo que se suelte, así que la carpeta debe tener `index.html` en su primer nivel y `assets/` junto a él.

Para que despliegue solo en cada push, se conecta este repo en *Site configuration → Build & deploy*. Sin build command, y el directorio de publicación es la raíz.

> El sitio de producción `zephoracharms.com` lo sirve el proyecto **`fanciful-trifle-64ca74`**, no los que se llaman `zephoracharms` ni `zephora-charms` —esos dos solo tienen URL `.netlify.app`. Desplegar en el proyecto equivocado "funciona" sin cambiar nada de lo que ve el público.

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

Cada versión del sitio es un commit. Para ver qué cambió entre dos:

```
git log --oneline -- index.html
git diff <commit-anterior> <commit> -- index.html
```

Desde que las imágenes salieron a `assets/`, los diffs de `index.html` son legibles: cambiar una foto ya no ensucia el diff con miles de caracteres de base64, solo cambia el archivo binario correspondiente.
