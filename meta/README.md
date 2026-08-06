# Scripts de Meta

Herramientas de línea de comandos para consultar la Graph API de Meta desde **tu** máquina, sin que el token pase nunca por un chat.

Sin dependencias: solo Node 18 o superior (trae `fetch` incorporado). No hay `npm install`.

## Configuración

```bash
cp .env.example .env      # en la raíz del repo, no dentro de meta/
```

Abre `.env` y pega tu token en `META_ACCESS_TOKEN`. Ese archivo está en `.gitignore` y no se sube a git.

Si prefieres no escribirlo en disco, expórtalo solo para la terminal actual:

```bash
export META_ACCESS_TOKEN="EAA..."
```

## Uso

```bash
node meta/verificar.mjs        # ¿sirve el token? ¿a qué da acceso?
node meta/pixel.mjs            # ¿llegan los eventos del pixel?
node meta/metricas.mjs         # gasto, CPA, ROAS, CTR por campaña
```

Con argumentos:

```bash
node meta/pixel.mjs 2130673404542988
node meta/metricas.mjs last_7d
node meta/metricas.mjs today adset
```

Periodos válidos: `today`, `yesterday`, `last_7d`, `last_14d`, `last_30d`, `this_month`, `last_month`.
Niveles: `campaign`, `adset`, `ad`.

## Los tres scripts son de solo lectura

Ninguno crea, modifica ni pausa nada, y ninguno gasta presupuesto. Puedes correrlos las veces que quieras sin riesgo.

Las operaciones de escritura —cambiar presupuestos, pausar anuncios, crear campañas— se agregan aparte y mostrando el payload antes de ejecutar.

## Seguridad del token

El token va en el header `Authorization`, nunca en la URL. Eso importa porque las URLs quedan escritas en logs de servidor, historiales de shell y reportes de error; los headers no.

Buenas prácticas:

- Usa un token de **usuario del sistema** con permisos acotados, no un token personal con acceso total.
- Un token con `ads_management` **puede gastar tu dinero**. Trátalo como la clave del banco.
- Si se expone —un chat, una captura, un commit— revócalo en *Configuración del negocio → Usuarios del sistema*. No basta con borrar el mensaje.
- Verifica tipo y caducidad en el [Depurador de tokens](https://developers.facebook.com/tools/debug/accesstoken).

## Versión de la API

`META_API_VERSION` en `.env` controla la versión. El valor por defecto es `v19.0`.

Meta retira cada versión unos dos años después de publicarla, y v19.0 salió en enero de 2024. Si ves errores de versión no soportada, sube el número a la actual y vuelve a correr.

## Estos scripts no se han probado contra la API real

Se escribieron en un entorno con `graph.facebook.com` bloqueado por política de red, así que están verificados en sintaxis, carga de configuración y manejo de errores, pero **ninguna respuesta real de Meta los ha atravesado**.

Lo más probable que falle en la primera corrida son nombres de campos, que cambian entre versiones de la API. Los errores salen con el código de Meta y una pista de qué revisar. Si algo truena, pasa el mensaje completo y se ajusta.

El desglose de eventos por tipo (`/{pixel}/stats`) es el punto más frágil: no siempre está disponible según los permisos del token. Si falla, el script lo avisa y sigue con el resto en vez de abortar.
