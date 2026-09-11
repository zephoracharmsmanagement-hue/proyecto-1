# Punto de entrega de fotos nuevas

Aquí se dejan las fotos **en bruto**, tal como salieron de la cámara o del
chat. Nada de esto es el sitio: `netlify.toml` ya manda `/herramientas/*` a un
404, así que aunque se desplegara por accidente no queda servido en el dominio.

## Cómo entregar

1. Dejar los archivos aquí dentro (`herramientas/entrada/`), con el nombre que
   traigan. No hace falta renombrarlos ni recortarlos.
2. Commit y push a la rama de trabajo de esta sesión.
3. En el chat: cuántas unidades llegaron de cada referencia y a qué precio.

## Qué pasa después

`herramientas/entrar_fotos.py` las empareja contra el catálogo, las lleva a
440x440 / ~13 KB y las escribe en `assets/<id>.webp`. Primero sin `--aplicar`
—enseña la comparación y para—, y solo después de revisarla se escribe.

Cuando las fotos ya estén en `assets/`, **esta carpeta se vacía en el mismo
commit**: el material en bruto no vive en el repo.

## Nombres

Los archivos de aquí pueden llamarse como sea. El que importa es el `id` del
catálogo, y ese lo acordamos en el chat antes de escribir nada: minúsculas,
sin tildes (la `ñ` sí se conserva, ver `letra-ñ`), palabras separadas por
guiones, y describiendo la pieza, no la colección —`osito-pave-con-corazon`,
no `charm-osito-2`—.
