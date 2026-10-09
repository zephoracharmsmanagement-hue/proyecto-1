# Traspaso de pauta a la terminal — lanzamiento de septiembre 2026

Lo dejó la sesión de pauta (`claude/charming-sagan-l4q2eq`) el 2026-09-27. Todo
lo de aquí está **aprobado por el propietario**; lo que falta es ejecutarlo.
Antes de empezar, leer la skill [`.claude/skills/meta-ads/`](../../.claude/skills/meta-ads/SKILL.md).

**Regla que no cambia:** todo se crea **en pausa**. Lo activa el propietario.

## Lo que ya existe en la cuenta `1583713932705268`

| Qué | ID | Estado |
|---|---|---|
| Campaña principal «Nueva campaña de Ventas» (CBO $30.000/día) | `120247398773240534` | Activa. **No se toca.** Copia 3 y Mármol · regalo quedaron pausados el 2026-09-25 |
| `VENTAS · PRUEBA ÁNGULOS · IC` | `120248295381620534` | En pausa, **vacía**, sin presupuesto de campaña (ABO) |
| `VENTAS · RMK · IC` | `120248295381840534` | En pausa, **vacía**, sin presupuesto de campaña (ABO) |

Públicos (los más recientes; hay duplicados de cada uno, limpiar después):
visitantes 90d `120248282121830534` · carrito 90d `120248282196400534` ·
inicio de pago 90d `120248282200390534` · **excluir** compraron 180d
`120248282206630534`.

## Paso 1 — Dos conjuntos (en pausa)

| | PRUEBA | RMK |
|---|---|---|
| Campaña | `120248295381620534` | `120248295381840534` |
| Nombre | `PRUEBA · Amplio CO · 18-65 · IC` | `RMK · Visitantes-Carrito-Pago 90d · IC` |
| Presupuesto diario (del conjunto) | **$16.500 COP** | **$10.000 COP** |
| Optimización | `OFFSITE_CONVERSIONS`, píxel `2130673404542988`, evento `INITIATED_CHECKOUT` | igual |
| Público | Colombia, 18-65, Advantage+ activado | Incluir los 3 públicos de arriba; Advantage+ **desactivado** |
| Excluir | compraron 180d | compraron 180d |
| Ubicaciones / puja | Advantage+ / mayor volumen | igual |

**Ojo con la moneda:** la herramienta pide el presupuesto «en centavos». Crear
uno y **leerlo de vuelta** antes del segundo: la campaña principal se lee como
`daily_budget: 30000` COP. Si el conjunto se lee como $1.650.000, se borra y se
rehace.

**Por qué esos montos** (no son al azar): un conjunto necesita ~50 checkouts por
semana para aprender; a $2.300 por checkout son $16.500/día. El retargeting lo
limita el tamaño del público (~2.500 personas × 3 vistas/semana). Regla de
decisión y umbrales en la Guía privada y en la skill.

## Paso 2 — Material

Lo tiene el propietario en el celular/computador (no se comitea: son videos).

| Archivo | Formato |
|---|---|
| `A1-V4-regalo-para-el.mp4` | 9:16, 9,3 s, sin audio |
| `A2-R4-V2-arma-tu-pulsera.mp4` | 9:16, 12,6 s, sin audio |
| `A5-V3-estilo-de-vida.mp4` | 9:16, 6,7 s, sin audio |
| `R3-V1-luciernaga-regalo-ella.mp4` | 9:16, 11,4 s, sin audio |
| `R5-V5-asi-llega.mp4` | 9:16, 10,5 s, sin audio |
| `A4-R1-sello-925-cuadrada.jpg` / `-vertical.jpg` | 1:1 y 9:16 |
| `A3-R2-pulsera-avengers-cuadrada.jpg` / `-vertical.jpg` | 1:1 y 9:16 |

**Fotos de muñeca de hombre (aprobadas el 2026-09-27):** la 3:4 y la vertical
sirven como versión en foto de A1. Todas las piezas son del catálogo: la «A» es
el dije que viene con la pulsera Avengers, y la pieza negra de la vertical es
**Spider-Man clásico** (confirmado por el propietario).

**Emojis:** van solo en el texto del anuncio, no quemados con `ffmpeg`
(`drawtext` no dibuja emojis a color: salen cuadros). Si se quieren dentro del
video, se ponen en CapCut. Máximo uno por frase; propuesta en la tabla del
paso 3 de la sesión de pauta.

**Pendiente antes de subir los videos:**
- **Texto dentro del video** (grande, centrado, fuera del 15% superior y el 20%
  inferior): una frase en los primeros 2 s y otra al final. Tabla abajo.
- **Música:** solo **Meta Sound Collection** (se elige en el Administrador al
  crear el anuncio) o música marcada **uso comercial** en CapCut. **Nunca** la
  música en tendencia de Instagram en un anuncio pagado: no está licenciada
  para publicidad.
- Texto sobre la foto de la pulsera Avengers (en la madera libre de arriba):
  «Desde el tercer charm, casi a mitad de precio».

Si la terminal tiene `ffmpeg`, puede quemar los textos con `drawtext`
(fuente sans en negrita, blanca con sombra, ~70 px en 1080×1920).

## Paso 3 — Los 10 anuncios (en pausa)

URL base con UTMs (en todos):
`?utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}`
Botón: **Comprar**. Destino: `coleccion-marvel.html` para los Marvel,
`index.html` para el resto.

| Anuncio | Conjunto | Material | Texto en el video (inicio → final) | Texto principal del anuncio | Titular |
|---|---|---|---|---|---|
| A1 · Regalo para él | PRUEBA | V4 | «¿Ya sabes qué regalarle?» → «Sus héroes, en Plata 925» | Spider-Man, Iron Man y Capitán América en su muñeca. Charms en Plata 925 con sello, hipoalergénicos. Llega en caja con dedicatoria escrita a mano. | Su pulsera de héroes |
| A2 · Arma tu pulsera | PRUEBA | V2 | «Arma la tuya, charm por charm» → «Desde el tercero, casi a mitad de precio» | Elige el brazalete y suma los charms de tu historia. Desde el tercer charm el brazalete baja 30%, y llevando 4 pagas 3. | Arma la tuya |
| A3 · Descuento del tercero | PRUEBA | Foto pulsera Avengers | (foto con texto) | Pulsera Avengers con 5 héroes: $410.850 en vez de $553.000. Desde el tercer charm, todo baja solo, sin códigos. Envío gratis pagando en línea. | Ahorras $142.150 |
| A4 · Plata 925 | PRUEBA | Foto sello | — | Cada charm lleva grabado el sello S925. Búscalo apenas lo recibas: está ahí para que no tengas que creernos. Hipoalergénica y libre de níquel. | Plata 925 que se comprueba |
| A5 · Estilo de vida | PRUEBA | V3 | «Tu inicial, tu mascota, tu historia» → «Charms en Plata 925 con sello» | Una pulsera que cuenta quién eres: tu inicial, tu mascota, lo que amas. Charms en Plata 925, hipoalergénicos. | Tu historia en tu muñeca |
| R1 · Plata 925 | RMK | Foto sello | — | Igual que A4. | Plata 925 con sello |
| R2 · Descuento del tercero | RMK | Foto pulsera Avengers | (foto con texto) | ¿La dejaste en el carrito? Desde el tercer charm todo baja solo: la pulsera Avengers con 5 héroes queda en $410.850. | Aún está esperándote |
| R3 · Pagas al recibir | RMK | V1 | «Pídela hoy, págala al recibir» → «Hipoalergénica y libre de níquel» | ¿Te da desconfianza comprar en línea? Pídela contraentrega y pagas cuando la tienes en la mano. | Pagas al recibir |
| R4 · Así se arma | RMK | V2 | igual que A2 | Así de fácil: brazalete, tus charms y listo. Desde el tercero, casi a mitad de precio. | Así se arma |
| R5 · Así llega | RMK | V5 | «Así llega tu regalo» → «Caja, paño y dedicatoria a mano» | Llega en su caja, con paño para la plata y una dedicatoria escrita a mano con las palabras que tú elijas. | Lista para regalar |

Reglas del copy (de la skill): «envío gratis» solo con pago en línea; en R3
(contraentrega) **no** se menciona envío gratis. Brazalete = «baño de plata»,
nunca «plata». Ningún precio que no salga de `calcular()`: los de A3/R2
(`$410.850`, `$553.000`, `$142.150`) se calcularon el 2026-09-27 para pulsera
Avengers + Wolverine, Mjolnir, Iron Man, Spider-Man y Capitán América, pago
anticipado. Si cambian precios, recalcular.

**Stock a vigilar:** Mjolnir tiene 2 unidades (sale en A3, R2 y V5). Si se
agota, pausar esos anuncios.

## Paso 4 — Verificar y entregar

1. Leer de vuelta campañas, conjuntos y anuncios: todo en `PAUSED`, presupuestos
   correctos, URLs con UTMs.
2. Mostrarle al propietario la vista previa de 2-3 anuncios.
3. **El propietario activa.** Desde ahí, 8 días sin editar.
4. Juzgar al día 8 con la regla de la skill (MER semanal, costo por checkout,
   anuncios que gastan $7.000 sin checkout se pausan).
