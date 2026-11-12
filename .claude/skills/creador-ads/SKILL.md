---
name: creador-ads
description: Crea anuncios de Meta para Zephora Charms de principio a fin — elige piezas con existencias, escribe la receta, genera la imagen en 1:1, 4:5 y 9:16 con precios que salen de calcular(), escribe el texto y deja el payload listo para que el propietario lo apruebe. Úsala cuando pidan crear, armar, generar o proponer un anuncio, un creativo, un lote de ads o «algo nuevo para pautar», cuando digan «creador de ads», o cuando haya que reemplazar un anuncio que se pausó — aunque no nombren a Meta. Para diagnosticar la pauta, leer métricas o decidir presupuesto, la skill es meta-ads.
---

# Creador de ads — Zephora Charms

De una idea a un anuncio listo para aprobar, sin escribir un solo precio a mano.
La herramienta es `herramientas/creativos/creador_ads.py`; esta skill dice cómo
usarla y qué decide quien la usa.

**Qué hace la herramienta y qué no.** Valida, calcula, compone la imagen y
escribe la propuesta. **No sube nada a Meta y no gasta.** Subir es el último
paso, a mano y con el sí del propietario (regla 1 de la skill `meta-ads`, que
manda sobre todo lo de aquí: leerla si no está cargada).

## El flujo

### 1. Mirar qué hay antes de proponer

- **Anuncios activos**: `ads_get_ad_entities` (cuenta `1683479286750530`, nivel
  `ad`) y sus textos con `ads_get_creatives`. El techo es de 6 a 8 activos en el
  conjunto único; si está lleno, un anuncio nuevo entra cuando otro sale, y hay
  que decir cuál y por qué (costo por checkout, no CTR).
- **Qué ángulo falta.** Meta agrupa los anuncios que se parecen. La variedad
  tiene que estar en la razón de compra y en el producto, no en el color del
  fondo: si ya hay dos de Avengers, el tercero no es otro de Avengers.
- **Qué hay para vender**:

  ```bash
  python3 herramientas/creativos/creador_ads.py --elegibles
  ```

  Lista las piezas con 3 o más unidades, leídas en vivo de la tienda (conteo
  menos lo apartado y lo vendido), con su precio y con la marca de «foto sin
  revisar» o «foto vetada». `--grupo Marvel` filtra.

### 2. Mirar la foto de cada pieza

Abrir `assets/hd/<pieza>.webp` con Read y mirarla ampliada. Se busca **una marca
grabada**: varias fotos son renders del proveedor con «PANDORA» en el metal
(confirmado en Hulk y en la Esfera Telaraña). Si está limpia, agregar el id a
`revisadas` en `herramientas/creativos/recortes.json`; si no, a `no_usar` con el
motivo. La herramienta avisa de toda pieza que no esté en una de las dos listas.

### 3. Escribir la receta

Un JSON en `herramientas/creativos/ads/`. Las dos que hay sirven de plantilla:
`fe-regalale-su-virgen.json` (brazalete + charms con la promo) y
`pixar-sulley-o-mike.json` (producto, sin conjunto).

| Clave | Qué es |
|---|---|
| `angulo`, `nombre` | Van al nombre del anuncio: `FOTO · <angulo> · <nombre> · <fecha>`. El nombre viaja a los UTMs |
| `base`, `charms` | Ids de `assets/catalogo.json`. `base` es el brazalete y es opcional |
| `etiquetas` | Nombre corto bajo cada charm, si el del catálogo es largo |
| `imagen` | `antetitulo`, `titulo`, `subtitulo`, `puntos` (hasta 3 beneficios), `tachado`, `grande`, `pildora`, `pie`. Con `"precio": "ninguno"` no se pone el bloque de precio por defecto |
| `texto` | `principal`, `titular`, `descripcion`: lo que va en Meta |
| `destino` | Página del sitio a la que llega el clic. Tiene que mostrar lo que el anuncio promete |
| `exige_gratis` | Ids que el anuncio afirma que salen gratis; si `calcular()` regala otra cosa, no se genera |
| `por_que`, `hipotesis` | Obligatoria la hipótesis: qué se espera ver y en cuántos días. Sin ella no hay prueba, hay un anuncio más |

**Ningún precio se escribe: se usa un marcador.**

| Marcador | Sale |
|---|---|
| `{total}` `{lista}` `{ahorro}` | El conjunto pagando en línea, su precio de lista y la diferencia |
| `{cuota_addi}` | Un tercio del total; solo existe si el total está entre $50.000 y $600.000 |
| `{gratis}` | «El brazalete te sale gratis», escrito desde lo que `calcular()` regaló |
| `{precio:ID}` `{precio_charm}` | El precio de una pieza; el segundo, si todos los charms valen igual |
| `{desde_brazalete}` | El brazalete más barato que tenga unidades |
| `{envio_contraentrega}` | Lo que cuesta el envío en contraentrega |
| `{estrellas}` `{resenas}` | Promedio y número de reseñas, leídos del sitio |
| `{piezas}` `{charms}` | Cuántas piezas lleva el conjunto |

El bloque de precio se arma solo cuando hay regalo: tachado con el precio de
lista, «Pagas {total}» y la píldora con `{gratis}`.

**El texto**, según `.claude/skills/meta-ads/references/creativos-y-copy.md`:
gancho → beneficio que responda a tiempo, dinero y confianza → llamado a la
acción. Se lee como la recomendación de una amiga que sabe. Charms en Plata 925
con sello; brazalete en baño de plata; hipoalergénicos y libres de níquel; caja,
paño y dedicatoria a mano. Un solo cambio respecto a lo que ya corre: si cambian
a la vez ángulo, formato y oferta, no se aprende nada.

### 4. Generar

```bash
bash herramientas/creativos/fuentes.sh
```

```bash
python3 herramientas/creativos/creador_ads.py herramientas/creativos/ads/<receta>.json
```

Las tipografías se bajan una sola vez. Si la receta rompe una regla, no pinta
nada y dice cuál; se corrige la receta, no la regla. `--solo-validar` revisa sin
pintar.

Sale en `material-sin-publicar/creativos/salida/ads/<fecha>-<slug>/` (fuera de
git): las tres imágenes, `ficha.md` y `payload.json`.

### 5. Mirar las tres imágenes

Con Read, una por una. La herramienta no ve: comprobar que la joya quedó entera
(sin trozos comidos por el recorte ni reflejos de estudio debajo), que nada se
pisa, que las etiquetas son de la pieza que tienen encima, y que el 1:1 se lee
en chico. Si un recorte sale mal, se arregla en `recortes.json`:
`semillas` para un hueco cerrado que quedó blanco, `"sin_piso": false` si el
quitado de sombra se llevó parte de la pieza. Hay fotos que no dan para recorte
(la de Pulsera Corazón Liso es demasiado clara y la cadena sale mordida): se usa
otra pieza.

### 6. Mostrar al propietario

Las imágenes (SendUserFile) y el contenido de `ficha.md`: piezas con sus
existencias, los números, los textos ya rellenos y el bloque «Propuesta para
aprobar», completando cuántos anuncios activos hay hoy. Nada se sube hasta aquí.

### 7. Subir, solo con el sí

Con el payload aprobado, y en modo «Aceptar ediciones»:

1. Volver a correr la herramienta **el día que se sube**. Existencias y precio
   son de ese día, no del día en que se escribió la receta.
2. Subir la imagen y crear el creativo y el anuncio con las herramientas `ads_*`
   del conector (cargar sus esquemas con ToolSearch y seguir su descripción):
   texto, titular, descripción, botón y enlace de `payload.json`, con
   `parametros_url` tal cual.
3. Crear el anuncio **pausado**, releerlo de la cuenta y comparar contra el
   payload. Solo entonces activar.
4. Anotar en `CLAUDE.md` § Meta Ads qué entró, qué salió y la fecha de la
   primera lectura (7 días).

## Qué revisa la herramienta por su cuenta

Cada una es una regla de `meta-ads` hecha comprobación; `pruebas/creador-ads.js`
verifica que siga rechazando.

- Piezas con menos de 3 unidades, fotos vetadas, ids que no existen.
- Una cifra de dinero que no sea exactamente la de `calcular()`.
- «Pandora», un porcentaje de descuento, «brazalete de plata».
- «Envío gratis» sin «pagando en línea»; «sin interés» sin Addi o fuera de su
  rango; cuotas o interés con Sistecrédito.
- Lenguaje de infomercial, signos de exclamación en cadena.
- Un número de reseñas o de estrellas distinto al del sitio.
- Un destino que no existe, o que todavía dice «envío gratis desde $180.000».
- Un emoji en la imagen (las tipografías no lo tienen; en el texto sí va).

## Lo que la herramienta no hace

- **No inventa joya.** Solo fotos reales de `assets/hd/`. Nada generado con IA
  puede parecer producto a la venta.
- **No hace video ni usa las fotos del propietario** (muñeca, caja, clienta).
  Para eso están `lote_final.py` y los demás guiones de la carpeta; ver
  `herramientas/creativos/LEEME.md`.
- **No decide si el anuncio conviene.** Eso sale del costo por checkout, a los 7
  días, comparado con los demás anuncios del mismo conjunto.
