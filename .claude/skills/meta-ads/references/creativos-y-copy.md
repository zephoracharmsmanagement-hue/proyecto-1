# Creativos y copy — Zephora

## Los 10 tipos de creativo, traducidos a Zephora

| Tipo | Pieza de Zephora | Etapa |
|---|---|---|
| Demostración | Armar una pulsera en tres pasos: brazalete, charms, cierre. En la mano, no en render | Presentación |
| Producto | Primer plano de un charm con el sello S925 visible. Marvel y Disney son los más fotogénicos | Evaluación |
| Testimonio | Unboxing: caja, paño, dedicatoria escrita a mano. Solo clientes reales, o «así llega tu pedido» grabado por la marca y dicho así | Evaluación y conversión |
| Promoción | «Lleva 4, paga 3» con el precio tachado; o el brazalete con 30% menos desde 3 charms | Conversión |
| Pantalla dividida | El charm suelto a un lado, puesto en la muñeca al otro; o pulsera genérica vs. pulsera armada | Evaluación |
| Educativo | Cómo medir la talla (la muñeca más 2 cm); por qué la Plata 925 se oscurece y cómo recuperar el brillo | Solución |
| Beneficios | Un beneficio por imagen: Plata 925 con sello, empaque de regalo, envío gratis | Producto |
| Aspiracional | La pulsera puesta en una escena cotidiana, como la foto de portada del sitio | Presentación |
| Humano | Quien arma los pedidos, escribiendo una dedicatoria | Presentación |
| Prensa | No aplica: no hay menciones de prensa. No inventarlas | — |

Se pueden cruzar tipos en una misma pieza (demostración que cierra con
promoción, producto con un beneficio).

## Primera prueba propuesta

1. **Demostración** — 2 anuncios: armar una pulsera Marvel y una de iniciales.
2. **Producto** — 3 anuncios: Deadpool, Iron Man y un charm de Disney, cada uno
   con fondo y encuadre distintos (si comparten fondo, Meta los cuenta como uno).
3. **Testimonio / unboxing** — 2 anuncios: el pedido llegando con empaque y
   dedicatoria.

La promoción queda para la campaña de personalizados, donde la gente ya está en
conversión. Marvel va primero porque es la categoría que más está vendiendo y la
de más stock en los precios altos — revisar que siga siendo cierto en
`assets/stock.json` antes de producir.

Antes de producir, revisar las imágenes de `assets/ads/`: si varias comparten
fondo o encuadre, la prueba tiene menos variedad de la que parece.

**Formatos**: feed 1080×1080, stories y reels 1080×1920. Cada pieza compuesta
para cada tamaño, no recortada. Los videos no se suben al repositorio (pesan y
el historial de git los guarda para siempre).

## Niveles de conciencia

De cada 100 personas: 3 a 5 decididas, ~10 conocen el producto, 20 a 30 conocen
la solución, ~30 saben que tienen el problema, ~30 no lo saben. Zephora
prioriza solución, producto y decisión: el objetivo hoy es conseguir
compradores, no alcance.

| Nivel | Qué sabe | Estructura | Ejemplo |
|---|---|---|---|
| Inconsciente | Nada | Problema fuerte + diferencial, sin vender explícito | «Los regalos que se guardan en un cajón no cuentan nada.» |
| Problema | Tiene un problema | Pregunta → problema → solución → producto → promoción | «¿Otra vez sin saber qué regalar? Arma una pulsera con lo que esa persona ama.» |
| Solución | Sabe que existen las pulseras de charms | 1 a 3 beneficios + llamado a la acción | «Elige el brazalete, suma los charms de su historia. Charms en Plata 925 con sello. Llega lista para regalar.» |
| Producto | Está comparando tiendas | Por qué Zephora: diferenciales, pruebas, algo gratis | «Charms en Plata Esterlina 925 verificada, con sello grabado. Empaque y dedicatoria a mano incluidos.» |
| Decisión | **Ya compró** | Novedades, beneficio especial, algo para completar | «Tu pulsera tiene espacio para más. Llegaron charms nuevos de Marvel.» |

Mezcla por conjunto de presentación con 3 a 5 anuncios: 2 de solución, 2 de
producto, 1 de problema. Los de decisión van en personalizados y ascensión.

## Reglas de redacción

- **Gancho → beneficio → llamado a la acción.** El beneficio tiene que responder
  a las tres objeciones universales: tiempo (llega rápido, es fácil de armar),
  dinero (desde cuánto, cuotas, qué incluye gratis) y confianza (Plata 925 con
  sello, garantía, cambio de talla).
- Se lee como la recomendación de una amiga que sabe. Nada de lenguaje de
  infomercial: «¡la mejor calidad!», «¡gran oferta!», «¡compra ya!», signos de
  exclamación en cadena.
- **Materiales exactos**: «Plata 925» solo para charms. Los brazaletes son
  «baño de plata». Describir un charm como enchapado o un brazalete como plata
  es publicidad engañosa.
- **Precios del sitio el día del anuncio**, con la escalera real de descuento
  (1 charm 0%, 2 charms 8%, 3 charms 15%, 4 o más 25%; brazalete −30% desde 3
  charms). Un número de precio que no se pueda reproducir con `calcular()` no se
  escribe.
- **No nombrar a Pandora** ni a ninguna otra marca. Las comparaciones van contra
  «una pulsera genérica».
- **No inventar** testimonios, cantidades de clientes, calificaciones ni
  menciones de prensa.
