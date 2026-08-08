# Zephora Charms

Sitio de [zephoracharms.com](https://zephoracharms.com/) — joyería con significado: charms en Plata 925 y brazaletes con baño de plata, compatibles con Pandora. Envíos a toda Colombia.

## Estructura

| Archivo | Qué es |
|---|---|
| `index.html` | La tienda: markup, estilos y scripts. Sin build ni dependencias. |
| `legal.css` | Estilos de las cinco páginas de información, que la comparten. |
| `preguntas-frecuentes.html` | FAQ desplegable, con datos estructurados `FAQPage`. |
| `envios-y-devoluciones.html` | Cobertura, costos, retracto (5 días hábiles) y garantía. |
| `politica-de-privacidad.html` | Tratamiento de datos según Ley 1581 de 2012. |
| `terminos-y-condiciones.html` | Condiciones de compra según Ley 1480 de 2011. |
| `politica-de-cookies.html` | Qué instala el sitio y cómo desactivarlo. |
| `assets/` | Las 109 imágenes del sitio (106 `.webp`, 3 `.jpg`). |
| `skills-lock.json` | Skills instaladas en el proyecto (fuente + hash). |
| `.claude/skills/` | Agent Skills disponibles al trabajar en este repo. |

Las cinco páginas de información se generan desde un shell común para que no se
desincronicen entre sí (cabecera, pie y `<head>` son idénticos en todas).

El responsable se identifica como **Zephora Charms, NIT 1.019.151.696-3, tienda
virtual con operación en Bogotá D.C.**

> **Pendiente:** por decisión del propietario no se publica domicilio. El artículo
> 50 de la Ley 1480 de 2011 pide una *dirección de notificación judicial* en
> comercio electrónico, así que ese punto queda descubierto; las políticas señalan
> WhatsApp como canal oficial de notificaciones al consumidor. Tampoco hay correo
> de contacto publicado.

Las imágenes vivían incrustadas en el HTML como data URIs en base64, lo que hacía el archivo portable pero pesado: 2.5 MB, de los cuales 2.4 MB eran imágenes. Peor todavía, `loading="lazy"` no hace nada sobre un data URI —los bytes ya viajan dentro del HTML—, así que cada visitante descargaba las 109 imágenes antes de ver nada.

Ahora son archivos externos y el HTML pesa 115 KB. El navegador pide solo la imagen del hero al cargar y el resto conforme aparecen en pantalla.

## Despliegue

**Se arrastra la carpeta del proyecto, no `index.html` suelto.** Ese archivo ya no es autocontenido: sin `assets/` al lado las 109 imágenes salen rotas, sin `legal.css` las cinco páginas de información salen sin estilos, y los enlaces del pie quedan en 404.

Netlify publica la raíz de lo que se suelte, así que la carpeta debe tener `index.html` en su primer nivel y `assets/` junto a él.

Para que despliegue solo en cada push, se conecta este repo en *Site configuration → Build & deploy*. Sin build command, y el directorio de publicación es la raíz.

> El sitio de producción `zephoracharms.com` lo sirve el proyecto **`fanciful-trifle-64ca74`**, no los que se llaman `zephoracharms` ni `zephora-charms` —esos dos solo tienen URL `.netlify.app`. Desplegar en el proyecto equivocado "funciona" sin cambiar nada de lo que ve el público.

## Medición

Meta Pixel `2130673404542988` (dataset "zephora charms pixel 1"). Eventos que dispara la página:

| Evento | Cuándo |
|---|---|
| `PageView` | Carga de la página |
| `ViewContent` | Carga del catálogo, y al abrir una categoría desde las tarjetas |
| `AddToCart` | Se agrega un charm, o se elige el brazalete base |
| `InitiateCheckout` | **Cualquier clic que lleve a WhatsApp,** etiquetado por sección en `content_name` |
| `Lead` | Se envía el pedido armado por WhatsApp (además del `InitiateCheckout`) |

`InitiateCheckout` es la conversión a optimizar en campañas: el checkout ocurre en
WhatsApp, fuera del sitio, así que el salto al chat es lo último medible. `Lead`
queda como señal de mayor intención —lleva `value` y `num_items` del pedido real—,
útil para optimizar por valor cuando el volumen lo permita.

Cada enlace a WhatsApp lleva un `data-wa` con su origen (`hero`, `asesoria-regalo`,
`pie`), que viaja en `content_name` para poder separar en Events Manager qué botón
trae las conversiones.

Abrir el detalle del pedido ya no dispara `InitiateCheckout`: ese evento pasó a
marcar el salto a WhatsApp, y mantener ambos habría inflado la cuenta.

Al tocar el pixel, verificar con **Events Manager → Probar eventos** antes de dar por bueno el cambio.

## Historial

Cada versión del sitio es un commit. Para ver qué cambió entre dos:

```
git log --oneline -- index.html
git diff <commit-anterior> <commit> -- index.html
```

Desde que las imágenes salieron a `assets/`, los diffs de `index.html` son legibles: cambiar una foto ya no ensucia el diff con miles de caracteres de base64, solo cambia el archivo binario correspondiente.
