# Arranque de una sesión nueva de la tienda — leer entero antes de tocar nada

Escrito el 2026-09-29 por la sesión de pauta (`claude/charming-sagan-l4q2eq`)
para la sesión de terminal que toma el trabajo de la tienda. Todo lo que dice
«aprobado» lo aprobó el propietario en esa conversación.

## 0. Antes de escribir una línea

1. `git fetch --all` y trabajar desde `main` (es lo que publica Netlify).
2. **Averiguar qué dejó la sesión anterior de terminal.** Estaba haciendo una
   «edición grande» de la página que no se sabe si terminó:
   - `git log --oneline -15 origin/main` y `git branch -r --sort=-committerdate | head`
   - `git status` (cambios sin commit en esta máquina)
   - Si hay trabajo a medias en otra rama o sin subir: **preguntarle al
     propietario antes de seguir.** La regla del repo es **una sola sesión
     toca la tienda**; dos sesiones sobre `netlify/functions/` ya duplicaron
     trabajo una vez (`CLAUDE.md` § «Cómo se reparte el trabajo»).
3. Leer en este orden: `CLAUDE.md` → `ESTADO.md` →
   `automatizaciones/tienda/ORDEN.md` → los cuatro encargos que lista.
   (Si aún no están en `main`, vienen de la rama
   `claude/charming-sagan-l4q2eq`; es solo documentación y la skill de pauta:
   se puede mezclar a `main`, mirando antes `git merge-base`.)
4. `ls netlify/functions/`: comprobar qué ya existe antes de construir.

## 1. Cómo funciona el inventario (lo que más se malentiende)

- `assets/stock.json` = lo que había **el día del último conteo**.
- El contador de **Netlify Blobs** (`_inventario.mjs`) lleva lo **vendido y
  apartado desde ese conteo**. Lo que el sitio muestra = `stock.json` − Blobs.
- Las ventas del **checkout web** (Wompi y contraentrega) se descuentan
  **solas** en Blobs. No se tocan a mano: bajarlas también en `stock.json` las
  resta dos veces (ya pasó y se revirtió).
- El campo `generado` de `stock.json` **es un interruptor, no una fecha**:
  cambiarlo pone el contador de Blobs en cero. Solo se cambia al cargar un
  conteo físico nuevo.
- Las ventas **fuera del checkout** (WhatsApp, Addi, Nequi, efectivo) hoy no
  las ve nadie. **No se arreglan editando `stock.json`**: eso obliga a
  desplegar por cada venta (~15 créditos). Se arreglan con `registrar-venta`
  (abajo), que escribe en el mismo contador de Blobs sin desplegar.

## 2. Prioridad 1 — `registrar-venta` en el próximo despliegue

Especificación completa: `automatizaciones/ventas-manuales/BRIEF.md`.
Resumen: `POST` protegido con cabecera `x-zephora-automation-key` =
`VENTA_MANUAL_KEY`; valida con `leerPedido()`; `reservar()` + `confirmar()` en
el mismo CAS del checkout; `anotarVenta()` con pago y total reales;
`purchase()` sin señales de navegador y `action_source: 'chat'`; **409 si no
hay stock**; pago `regalo` con total 0 **no** manda `Purchase` a Meta.

### Ventas ya hechas que hay que registrar en cuanto esté en línea

No se descontaron del sitio. **No editar `stock.json` por ellas**: registrarlas
con la función.

| Cliente | Pago | Total cobrado | Piezas |
|---|---|---|---|
| Tatán | Addi | $78.000 | `pulsera-corazon-liso` talla 19 |
| Mari | Addi | $82.000 | `luciernaga-you-are-my-light` |
| Stefanny | Addi | $243.000 | `pulsera-corazon-luminoso` talla 20, `cadena-seguridad-luna-y-sol`, `conejita-con-corazon-rosa` |
| Stefanny (regalo por suscripción) | regalo | $0 | `letra-s` |

La del cliente de `pulsera-mono-rosa-con-cadena` (contraentrega) **entró por
la página**: ya está descontada. No se registra.

Ojo: `pulsera-corazon-luminoso` talla 20 tenía **1 unidad**. Hasta que se
registre, el sitio la muestra disponible y ya no existe.

Stefanny pagó precio de lista ($243.000); por la web ese pedido cuesta
$230.120 (`calcular()`: 8% con 2 charms). No se corrige la venta; solo
registrar lo que de verdad se cobró.

Meta acepta eventos de hasta 7 días: registrar antes del **2026-10-04**.

## 3. Después, en este orden

Todo en `automatizaciones/tienda/ORDEN.md`:

1. **Arreglo de fotos del carrito** (`ENCARGO-FICHA-2.md` § 2): `imgDe()`
   busca la foto en el DOM y falla en páginas donde la tarjeta no está. Es un
   error visible hoy.
2. Suscripción con regalo (`automatizaciones/suscripcion/BRIEF.md`).
   **Actualización:** el propietario ya regala **la inicial** (letra) a quien
   se suscribe; esa es la pieza de regalo.
3. Ficha de producto (`ENCARGO-FICHA.md`) y su segunda parte
   (`ENCARGO-FICHA-2.md`).

## 4. Reglas que no se negocian

- **Despliegues:** ~15 créditos cada uno. Juntar todo en **un** despliegue.
  Un push que solo cambia `.md` no despliega (regla `ignore` de
  `netlify.toml`). Mostrarle el diff al propietario antes de desplegar.
- **Precios:** todo número de precio sale de `calcular()` (`_precios.js`).
  Nunca una cifra escrita a mano.
- **Materiales:** charms en **Plata 925** con sello; brazaletes en **baño de
  plata** (nunca «plata»). Charms y brazaletes son **hipoalergénicos y libres
  de níquel** (certificado del proveedor, confirmado). Empaque = caja, paño y
  dedicatoria escrita a mano.
- **Nada inventado:** ni contador de «personas viendo», ni reseñas o
  «compra verificada» sin pedido real, ni urgencia falsa. «Quedan N» solo si
  es verdad.
- **No nombrar a Pandora** en textos nuevos. Nombres de Marvel/Disney sí
  (el propietario tiene permiso).
- **Secretos:** `VENTA_MANUAL_KEY`, `SUSCRIPCION_SECRETO`,
  `SUSCRIPTORES_KEY` y tokens de Meta van en Netlify o en `.env`. Nunca en
  un archivo versionado ni pegados en el chat.
- **Esta sesión no toca la pauta de Meta.** Eso tiene su propio traspaso
  (`automatizaciones/pauta/TRASPASO-2026-09.md`) y va en otra ventana.

## 5. Pendientes del propietario (no frenar por ellos)

- Credenciales de **Addi** (hasta entonces, el botón de Addi lleva a WhatsApp).
- **24 h en Bogotá:** hora de corte y mensajería. No se publica sin eso.
- Aprobar la paleta de colores nueva antes de aplicarla a todo el sitio.

## 6. Al terminar

1. Desplegar (un solo despliegue) y verificar el sitio en vivo.
2. Crear en Netlify `VENTA_MANUAL_KEY` (y las de suscripción si salieron).
3. Registrar las 4 ventas de la sección 2 y comprobar que el sitio las
   descuenta (la Corazón Luminoso talla 20 debe salir agotada).
4. Anotar en `ESTADO.md` qué quedó hecho y qué no.
