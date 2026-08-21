# Video de anuncios — Zephora Charms

Proyecto de [Remotion](https://remotion.dev): los anuncios se escriben como
componentes de React y se renderizan a MP4. Existe porque los creativos de
`assets/ads/` son fotos fijas y Meta entrega video —Reels, Stories— a costo por
mil impresiones más barato que imagen.

No forma parte del sitio. Netlify publica la raíz del repositorio tal cual, así
que `netlify.toml` manda `/video/*` a 404: aquí no hay nada que le sirva a una
clienta.

## Empezar

```sh
cd video
npm install
npm run dev        # abre Remotion Studio en el navegador
```

En el Studio se cambian los props en vivo —otra joya, otro gancho, otro botón—
y se ve el resultado sin renderizar nada.

## Renderizar

```sh
npm run render         # solo Anuncio-9x16, a out/anuncio-9x16.mp4
npm run render:armada  # la pulsera armada
npm run render:todos   # las cuatro piezas
```

Los archivos salen en `out/`, que está en `.gitignore`: son binarios que se
regeneran en un minuto y no tienen por qué pesar en el historial.

La primera vez, Remotion se baja su propio Chrome (~150 MB) desde
`remotion.media`. Detrás de una red con lista blanca esa descarga da 403; en ese
caso se le pasa un Chrome ya instalado:

```sh
REMOTION_BROWSER_EXECUTABLE=/ruta/a/headless_shell npm run render
```

Sirve el que trae Playwright, que las pruebas del repo ya instalan.

## Los tres formatos, y por qué son tres

| Composición    | Lienzo    | Dónde va                       |
| -------------- | --------- | ------------------------------ |
| `Anuncio-9x16` | 1080×1920 | Reels, Stories                 |
| `Anuncio-4x5`  | 1080×1350 | Feed de Instagram y de Facebook|
| `Anuncio-1x1`  | 1080×1080 | Feed cuadrado, Marketplace     |
| `Armada-9x16`  | 1080×1920 | Reels, Stories — ver más abajo |

Se renderizan los tres a propósito. Subir solo el cuadrado y dejar que Meta lo
recorte para Reels es lo que corta el precio por la mitad —el recorte no sabe
qué parte del cuadro importa—. `src/AnuncioProducto.tsx` no consulta el id de la
composición: mide la proporción del lienzo y decide si apila la foto sobre el
texto o los pone lado a lado, así que agregar un formato nuevo es una línea en
`src/marca.ts`.

## `Armada-9x16` — la pulsera armada, y por qué es la excepción

`src/Armada.tsx` anuncia la pulsera armada con charms sobre
`assets/pulsera-zephora-armada-con-charms-en-plata-925.webp`, la foto del hero
de `index.html`.

Esa foto **ya es un creativo terminado**: trae su propio titular quemado —«La
pulsera que todas quieren / Personalízala con tus charms favoritos»— y el logo
abajo a la derecha. De ahí salen sus dos diferencias con el resto:

- **No pone titular ni firma.** Sería un segundo titular encima del primero. Lo
  que aporta es lo que a la foto le falta para ser un anuncio: movimiento, el
  precio y un botón, sobre un velo que aparece a los 1,3 s para que la foto se
  lea primero.
- **Solo se registra en 9x16.** La foto es 502×900, o sea prácticamente 9:16
  ya: el lienzo alargado la deja intacta y el acercamiento llega hasta 1,06,
  que es donde el recorte empieza a comerse la primera línea del titular.
  Cualquier recorte a 1x1 o a 4x5 le parte el titular a media frase. Para feed
  hace falta una **toma limpia** de la pulsera armada, sin texto encima; con
  ella sirve `AnuncioProducto` y salen los tres formatos.

**El precio no está escrito a mano ni es aproximado.** `src/oferta.ts` importa
`netlify/functions/_precios.js` —el módulo que cobra en producción— y le pide
el total de la combinación más barata que el inventario permita hoy: el
brazalete más barato con talla disponible más los 3 charms más baratos con
stock. Sale un «desde» de verdad, con el ahorro y el envío gratis calculados
por las mismas cuatro reglas que aplica el checkout (escala por número de
charms, 30% del brazalete a partir de 3, empaque, umbral de envío). Reimplantar
esas reglas aquí sería la cuarta copia, y la primera que nadie compara con las
demás.

Consecuencia: **la cifra se mueve sola con el inventario.** Si se agota el
brazalete más barato, el siguiente render dice otro número —el verdadero—. Vale
la pena mirarlo antes de subir el video a Meta.

## De dónde salen los datos

- **Nombre y precio**: de `assets/catalogo.json`, el mismo archivo que leen el
  checkout y `netlify/functions/_precios.js`. Escribir el precio a mano aquí
  sería garantizar que algún día el anuncio publique una cifra que el sitio ya
  no cobra.
- **Foto**: de `assets/<slug>.webp`. `remotion.config.ts` apunta el directorio
  público del proyecto a `../assets` en vez de tener un `public/` propio, así
  que no hay copias que se queden viejas cuando se cambia una toma.
- **Colores**: `src/marca.ts`, copiados del bloque `:root` de `index.html`.
- **Tipografías**: `src/fuentes/`, no Google Fonts. El sitio sí las pide a la
  red; un render no puede, porque el fotograma cambiaría según si la descarga
  alcanzó a llegar. Son los subconjuntos latinos (48 KB entre los dos) bajo la
  SIL Open Font License.

Un slug que no esté en el catálogo revienta el render con un mensaje que lo
dice, en vez de dibujar un anuncio con el nombre en blanco.

## Cambiar de joya

En el Studio, o en `src/AnuncioProducto.tsx` → `propsPorDefecto`:

```ts
export const propsPorDefecto: PropsAnuncio = {
  slug: "pulsera-corazon-pave",
  gancho: "Plata 925 · Envío a toda Colombia",
  cta: "Arma la tuya",
};
```

Los slugs válidos son las claves de `nombres` en `assets/catalogo.json`. Ojo:
99 de las 129 referencias tienen foto; las 30 restantes —las letras y tres
personajes— todavía no, y sin foto no hay anuncio.

## Antes de subir un render a Meta

- El costo por resultado manda sobre el CTR. Está documentado en `CLAUDE.md`
  por qué: el creativo con mejor CTR de la cuenta (15,43%) era de los peores
  en conversión, y juzgarlo por CTR habría escalado justo el que peor rendía.
- El video pesa ~1 MB por pieza; Meta admite hasta 4 GB, no hay que comprimir.
- La cuenta que pauta optimiza por `InitiateCheckout`, no por `Purchase`
  (`ESTADO.md` § 4a). Eso no cambia con el creativo, pero sí cambia cómo se
  lee el resultado.

## Comprobaciones

```sh
npm run lint   # eslint + tsc
```

No corre en el flujo de GitHub Actions del repo: ese instala Playwright y las
seis baterías del sitio, y sumarle este proyecto alargaría cada push por algo
que no puede tumbar la tienda.

## Licencia de Remotion

Remotion es gratis para equipos de hasta 3 personas y para uso individual;
por encima de eso pide licencia de empresa (remotion.pro/license). Zephora
Charms está holgadamente por debajo del límite.
