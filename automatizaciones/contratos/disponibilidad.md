# Contrato · `/.netlify/functions/disponibilidad`

Catálogo, precios, reglas de cobro y **disponibilidad real** en una sola lectura.
Implementado en `netlify/functions/disponibilidad.mjs`.

`GET`, sin parámetros, sin autenticación. Cachea un minuto.

## Por qué existe

La disponibilidad está partida en dos sitios y ninguno la sabe entera:

- `assets/stock.json` dice **cuántas unidades se contaron**. Es estático: no sabe
  nada de lo que pasó después.
- El almacén `inventario` de Blobs lleva **lo apartado** por pagos en curso y **lo
  vendido**. No sabe cuántas había.

Un asesor que lea solo el archivo promete piezas que ya tienen dueña. En el
checkout ese error lo corrige una pantalla; por WhatsApp lo corrige una persona
pidiendo disculpas.

**La resta se hace aquí y no en el prompt.** Pasarle los dos JSON crudos a un
modelo es pedirle aritmética de inventario, que es justo lo que hace mal y con
toda seguridad.

## Respuesta

```json
{
  "generado": "2026-08-12T14:03:00.000Z",
  "fuente": "conteo-menos-apartado",
  "aviso": "Disponibilidad referencial: conteo manual menos lo apartado…",
  "reglas": { "escalaCharms": [0,0,0.08,0.15,0.2], "descuentoBrazalete": 0.3,
              "minCharmsParaDescuento": 3, "empaque": 40000,
              "envioGratisDesde": 180000, "envioGratisSoloAnticipado": true,
              "envio": { "anticipado": 15000, "contraentrega": 25000 } },
  "piezas": [
    { "id": "acuario", "nombre": "Acuario", "precio": 85000, "tipo": "charm",
      "familia": "pasador", "material": "Plata Esterlina 925",
      "disponible": 2, "agotado": false }
  ],
  "brazaletes": [
    { "id": "pulsera-copo-de-nieve", "nombre": "Pulsera Copo de Nieve",
      "precio": 58000, "tipo": "brazalete",
      "material": "baño de plata sobre base de alta resistencia",
      "tallas": { "18": 2 }, "agotado": false }
  ]
}
```

**`reglas` es la misma copia con la que cobra el checkout** (`_precios.js`). Va
aquí para que el asesor no tenga una propia que se desincronice: si cambia un
descuento, cambia en un sitio.

## `fuente` — el campo que hay que mirar primero

| Valor | Qué significa |
|---|---|
| `conteo-menos-apartado` | Los números son reales. `disponible` y `tallas` traen unidades |
| `solo-conteo` | **No se pudo leer lo apartado.** `disponible`, `tallas` y `agotado` van en `null` |

Cuando Blobs no responde, la tentación es devolver el conteo del archivo, que
«casi siempre» acierta. Eso es exactamente lo que no se hace: **un número que
parece bueno y no lo es es peor que ningún número**. Sin dato real, no hay dato,
y el prompt tiene instrucciones de pedir confirmación en vez de prometer.

## Detalles que importan

- **Los brazaletes se cuentan por talla.** El inventario apartado usa la clave
  `id|talla`. Apartar la talla 19 no toca la 20.
- **`disponible` nunca es negativo.** Si el conteo se corrigió a la baja después
  de vender, la resta se pasa de cero; «quedan −1» no significa nada.
- **Las reservas caducadas no bloquean.** Se limpian en memoria al leer, sin
  escribir: una consulta no modifica nada.
- **`material` viene servido, no deducido.** Charms en Plata Esterlina 925,
  brazaletes con baño de plata. Confundirlos es publicidad engañosa sobre el
  producto que más margen deja.
- **`familia`** (`pasador`, `colgante`, `murano`, `clip`, `cadena`) es lo que
  distingue una cadena de seguridad de un charm decorativo, y lo que determina
  cuánto ocupa de cadena — es decir, cuántas piezas caben.

## No es una promesa

`stock.json` se cuenta a mano. `disponible: 2` significa «según el último
conteo, menos lo apartado, quedan 2». La página ya lo dice así —«disponibilidad
referencial»— y quien consuma este endpoint tiene que decirlo igual.

## Comprobado en

`pruebas/disponibilidad.js` — 19 comprobaciones: la resta de reservas y
vendidos, las tallas por separado, el suelo en cero, las reservas caducadas, y
sobre todo que **sin almacén no se invente un número**.
