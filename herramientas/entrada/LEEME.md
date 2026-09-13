# Punto de entrega de fotos nuevas

Aquí se dejan las fotos **en bruto**, tal como salieron de la cámara o del
chat. Nada de esto es el sitio: `netlify.toml` ya manda `/herramientas/*` a un
404, así que aunque se desplegara por accidente no queda servido en el dominio.

## Dos carpetas, y no da igual cuál

- **`fotos/`** — las fotos de producto. `entrar_fotos.py` recorre la carpeta
  entera y trata cada imagen como una pieza del catálogo: un pantallazo suelto
  ahí dentro lo intentaría emparejar con un charm.
- **`pantallazos/`** — capturas de precios, unidades, facturas. Datos, no
  producto. Nunca entran a `assets/`.

## Cómo entregar

1. Dejar los archivos en la carpeta que toque, con el nombre que traigan. No
   hace falta renombrarlos ni recortarlos.
2. Commit y push a la rama de trabajo de esta sesión.
3. En el chat: cuántas unidades llegaron de cada referencia y a qué precio.

## Qué pasa después

`herramientas/entrar_fotos.py` las empareja contra el catálogo, las lleva a
440x440 / ~13 KB y las escribe en `assets/<id>.webp`. Primero sin `--aplicar`
—enseña la comparación y para—, y solo después de revisarla se escribe.

Cuando las fotos ya estén en `assets/`, **las dos carpetas se vacían en el
mismo commit**: el material en bruto no vive en el repo.

El repositorio es **privado** desde el 2026-09-11 —antes era público, con los
márgenes por pieza y la utilidad por venta a la vista de cualquiera—. Los
pantallazos pueden entrar aquí precisamente por eso. **Si alguna vez vuelve a
ser público, esto deja de valer**: git se queda con los archivos aunque se
borren después, y limpiarlos exige reescribir historia.

## Nombres

Los archivos de aquí pueden llamarse como sea. El que importa es el `id` del
catálogo, y ese lo acordamos en el chat antes de escribir nada: minúsculas,
sin tildes (la `ñ` sí se conserva, ver `letra-ñ`), palabras separadas por
guiones, y describiendo la pieza, no la colección —`osito-pave-con-corazon`,
no `charm-osito-2`—.
