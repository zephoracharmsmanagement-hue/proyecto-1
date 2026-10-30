# Historias de Instagram con Remotion

Imágenes de historia (1080×1920, JPG) para el plan de noviembre 2026. El texto,
los precios y las piezas viven en `historias.mjs`; el diseño, en
`src/Historia.tsx` (seis plantillas: producto, pregunta, anuncio, reseña, info
y set).

```bash
npm install
npm run render                 # todas, a out/
npm run render -- 2026-11-15   # solo un día
npm run studio                 # para diseñar con vista previa
```

`render.mjs` no renderiza nada si una pieza no está en el catálogo, tiene
menos de 3 unidades en `assets/stock.json` (salvo `pocas: true`) o falta su
foto. Los totales de los sets salen de `calcular()` en
`netlify/functions/_precios.js`, la misma función que cobra el checkout.

Las fotos se copian de `assets/` a `public/img/` al renderizar, y las
imágenes salen en `out/`: ninguna de las dos carpetas se versiona. La joya
nunca se redibuja: las fotos de producto se ponen sobre una tarjeta blanca
tal cual, y las de ambiente (720 px) van enmarcadas a su tamaño real sobre su
versión desenfocada.

Fuentes: Cormorant Garamond y Jost (SIL Open Font License), las mismas del
sitio. Chromium: usa el de Playwright si existe; si no, `REMOTION_CHROME`.
