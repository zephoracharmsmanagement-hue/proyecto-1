# Creativos de pauta y contenido — generadores

Historias de Instagram y anuncios de foto de Meta, compuestos con Pillow a partir
de fotos reales. Traspaso de la sesión web del 2026-10-16 → 2026-11-01.

## Creador de ads — por aquí se empieza (2026-11-12)

`creador_ads.py` hace un anuncio completo desde una receta JSON de `ads/`: valida existencias en vivo
(3 o más), saca los precios de `calcular()`, revisa los textos contra las reglas de abajo, compone el
estilo estudio en 1:1, 4:5 y 9:16 y deja `ficha.md` y `payload.json` para aprobar. No sube nada a Meta.
Cómo se usa, paso a paso: skill [`creador-ads`](../../.claude/skills/creador-ads/SKILL.md).

```bash
python3 herramientas/creativos/creador_ads.py --elegibles
python3 herramientas/creativos/creador_ads.py herramientas/creativos/ads/fe-regalale-su-virgen.json
```

- Los textos no llevan cifras: llevan marcadores (`{total}`, `{lista}`, `{cuota_addi}`…). Una cifra
  que no sea la de `calcular()` detiene la generación.
- La sombra y el reflejo de estudio bajo la pieza se quitan solos (`sin_piso`), sin franja a mano por
  pieza. `recortes.json` guarda las fotos vetadas, las ya revisadas y los pocos ajustes de recorte.
- Reusa `recortar()` y las tipografías de `historias_estudio.py`: si ese archivo cambia de nombre o
  esas funciones de firma, `creador_ads.py` se rompe.
- **Para los guiones de historias:** `brazalete()` con `reflejo_cierre=True` se come medio cierre en
  Pulsera Corazón Abierto (el corazón cuelga justo en la zona que borra) y deja en blanco su interior.
  Se ve en la historia «Regálale su Virgen». Aquí se resolvió con una semilla dentro del corazón.
- Pruebas: `node pruebas/creador-ads.js` (sin Pillow ni red).

## Cómo correrlos

```bash
bash herramientas/creativos/fuentes.sh            # una vez: Playfair, Lato, Cormorant (OFL, no se comitean)
python3 herramientas/creativos/lote_final.py      # 5 anuncios × 3 formatos (1:1, 4:5, 9:16)
python3 herramientas/creativos/historia_avengers_v2.py   # historia «Paga 4, lleva 2 gratis», estilo estudio
python3 herramientas/creativos/historia_talla.py         # historia «¿Qué talla es la mía?»
python3 herramientas/creativos/historias_31oct.py        # 3 historias del 31-oct (quincena, encuesta, clienta)
python3 herramientas/creativos/historias_estudio.py      # 6 historias del día en estilo estudio (revisión del 12-nov en su cabecera)
```

Necesitan, en `material-sin-publicar/creativos/` (fuera de git):

| Archivo | Qué es |
|---|---|
| `muneca-v-luciernaga-atrapasuenos.jpg` | Foto del propietario: V + Luciérnaga + Atrapasueños puestos (1080×1920, trae texto de Addi arriba, por eso se recorta de y=820 hacia abajo) |
| `caja-a-luciernaga-atrapasuenos.jpg` | Foto del propietario: A + Luciérnaga + Atrapasueños en la caja, con la tarjeta escrita a mano (1080×1350, trae texto arriba) |
| `clienta-historia2-11s.png` | `ffmpeg -ss 11 -i assets/historia-2.mp4 -frames:v 1 …` — muñeca real de clienta con Trébol, Herradura y Pulpo |

Salida en `material-sin-publicar/creativos/salida/`.

## Reglas que ya costaron un error (no saltarlas)

1. **Precio = `calcular()`** de `netlify/functions/_precios.js`, el día de publicar. Cada script lleva en la
   cabecera los totales que verificó. Promo vigente: `PROMO={tramos:[[4,1],[6,2]]}` — paga 3 lleva 1, **paga 4
   lleva 2** (el segundo tramo bajó de 7 a 6 piezas el 2026-10-29).
2. **Existencias = hoja «Inventario de movimientos» → pestaña Existencias** (Google Sheets
   `1P-iZeFJDkPGSws_imPS_k_TaUYZrQMJGSPhBNWbNE-Y`), no `assets/stock.json` (conteo del 22-sep, desactualizado).
   Solo piezas con **3 o más**. Al 31-oct: **Luciérnaga en 1** → V2, V4 y la historia de la caja ya no deben salir.
   *2026-11-12:* la función `disponibilidad` del sitio (conteo − apartado − vendido) da hoy los mismos
   números que la hoja, pieza por pieza, y se puede leer sin credenciales. Es la que usa `creador_ads.py`.
3. **Addi**: «sin interés» solo de $50.000 a $600.000. **Sistecrédito**: nunca prometer cuotas ni interés
   (`ESTADO.md`); su primera venta real sigue sin probarse.
4. **Fotos de catálogo (`assets/hd/`)**: buena calidad, pero algunas son renders de proveedor con
   **«PANDORA» grabado** (confirmado: Hulk, Esfera Telaraña). Revisar cada una antes de usarla. Las seis de
   la historia Avengers (pulsera, Capitán, Iron Man, Groot, Mjolnir, Escudo) están limpias.
5. **Nada de joya generada con IA.** Las fotos `assets/avengers-marmol.webp` y `assets/ads/kit-spiderman-*`
   son IA (Mjolnir dice «IMARIC», separador «VENOM» que no se vende). Kie (`herramientas/fotos_kie.py`, clave en
   la PC del propietario) solo para nitidez sin redibujar, gasto mínimo.
6. **`assets/empaque*.webp` muestran empaque PANDORA** y siguen públicas aunque nada las enlaza. Pendiente
   decidir borrarlas.

## Estilo «estudio» (`historia_avengers_v2.py`) — el preferido por el propietario

Recorta la joya del fondo blanco por relleno desde el borde (+ semillas dentro de la pulsera), erosiona 1 px el
alfa (sin halo blanco), borra la sombra/reflejo de estudio de la franja inferior de cada pieza (`piso`, `modo`
por pieza) y compone sobre fondo crema con sombra propia. Siguiente paso pedido: pasar a este estilo la
historia de tallas y los anuncios V1 y V3.

## Pendiente con el propietario

- 7 historias de reseñas (inicio + 5 reseñas con texto literal + cierre). Las fotos viven en Netlify Blobs
  (`resenas-pruebas`, ver `herramientas/resenas.mjs`); hay que bajarlas desde la terminal con el token de Netlify.
- Elegir anuncios del lote y subirlos (6 activos hoy, techo 8). Nada que gaste sin aprobación del payload.
- La rama `claude/mcp-meta-ads-lyvwwk` (estado de la pauta al 17-oct) sigue sin mezclar a `main`.
