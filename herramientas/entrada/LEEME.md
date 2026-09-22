# Punto de entrega de fotos nuevas

Aquí se dejan las fotos **en bruto**, tal como salieron de la cámara o del
chat. Nada de esto es el sitio: `netlify.toml` ya manda `/herramientas/*` a un
404, así que aunque se desplegara por accidente no queda servido en el dominio.

> **Corregido el 2026-09-20 — el repositorio es PÚBLICO, y esto invierte la
> regla de abajo.** Decía «privado desde el 2026-09-11», y era cierto ese día;
> volvió a público después (verificado por API, no de memoria) y quedó así.
> **Nunca subir aquí pantallazos con costos de compra, márgenes o utilidad por
> pieza** — eso viaja en el chat, no en un commit. `git` conserva un archivo
> aunque se borre después; limpiarlo de verdad exige reescribir historia. Antes
> de traer cualquier dato de dinero, comprobar el estado actual del repo, no
> confiar en lo que diga este documento.

## Dos carpetas, y no da igual cuál — ni para lo mismo que antes

- **`fotos/`** — fotos de producto **para el catálogo del sitio**.
  `entrar_fotos.py` recorre la carpeta entera y trata cada imagen como una
  pieza del catálogo, las lleva a 440×440 / ~13 KB y las escribe en
  `assets/<id>.webp`. **No sirve para creativo de pauta**: Meta rechaza WebP y
  440×440 queda corto para carrusel (mínimo 500×500, recomendado 1080×1080).
  Si lo que llega es para anuncios, no para la ficha del sitio, decirlo en el
  chat antes de que nadie la reduzca por error.
- **`pantallazos/`** — capturas de **unidades y facturas**, nunca de costos ni
  precios de compra (ver el aviso de arriba). Datos, no producto. Nunca entran
  a `assets/`.

## Cómo entregar

1. Dejar los archivos en la carpeta que toque, con el nombre que traigan. No
   hace falta renombrarlos ni recortarlos.
2. Commit y push a la rama de trabajo de esta sesión.
3. En el chat: cuántas unidades llegaron de cada referencia — y si es una
   foto para pauta en vez de para el sitio, decirlo ahí también.
4. **Los precios de compra y cualquier margen se pasan en el chat, nunca en un
   archivo del repo.**

## Qué pasa después

Para el catálogo del sitio: `herramientas/entrar_fotos.py` las empareja, las
lleva a 440×440 / ~13 KB y las escribe en `assets/<id>.webp`. Primero sin
`--aplicar` —enseña la comparación y para—, y solo después de revisarla se
escribe.

Para pauta, el destino es distinto: la foto en su resolución original entra a
`assets/ads/` (o se sube directo a la biblioteca de Meta), sin pasar por
`entrar_fotos.py` — ese script existe para achicar, y aquí hace falta lo
contrario.

Cuando las fotos ya estén donde correspondan, **las dos carpetas de aquí se
vacían en el mismo commit**: el material en bruto no vive en el repo.

## Nombres

Los archivos de aquí pueden llamarse como sea. El que importa es el `id` del
catálogo, y ese lo acordamos en el chat antes de escribir nada: minúsculas,
sin tildes (la `ñ` sí se conserva, ver `letra-ñ`), palabras separadas por
guiones, y describiendo la pieza, no la colección —`osito-pave-con-corazon`,
no `charm-osito-2`—.
