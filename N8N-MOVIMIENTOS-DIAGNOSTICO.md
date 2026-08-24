# Diagnóstico: n8n Workflow — Nodo "Agregar Fila a Movimientos" Falla

**Estado:** BLOQUEADO (2026-08-24)  
**Flujo afectado:** "Zephora · Hoja de Inventario" (id `K1J4pHYfvd6QuAq8`)  
**Síntoma:** Pestaña *Movimientos* en Google Sheets no se escribe; pestaña *Existencias* sí

---

## Problema Reportado

```
Nodo: «Agregar Fila a Movimientos»
Error: Multiple matches found (paired_item_multiple_matches)
Resolución: $('Separar Movimientos').item falla tras «¿Ya está anotada?»
```

**Impacto:**
- ✓ *Existencias* se actualiza correctamente (saldo de inventario por referencia)  
- ✗ *Movimientos* está vacía (sin historial de qué se vendió pieza a pieza)  
- ✗ Replenishment tiene que basarse en "subir todo a 4", no en rotación real

---

## Causa Probable

El workflow recibe un **webhook con 1 pedido que tiene múltiples piezas:**

```json
{
  "pedido_id": "ZC-260821-A4C64EC2",
  "total": 223050,
  "piezas": [
    { "referencia": "charm-1", "cantidad": 1 },
    { "referencia": "charm-2", "cantidad": 1 },
    { "referencia": "charm-3", "cantidad": 1 }
  ]
}
```

**Lo que ocurre en el workflow:**

1. Nodo «Disparador» recibe el webhook → 1 ejecución, 1 item
2. Nodo «Separar Movimientos» itera sobre `piezas[]` → genera 3 items del workflow
3. Nodo «¿Ya está anotada?** busca si cada pieza ya está en Sheets → collapsa los 3 items en 1 hit
4. Nodo «Agregar Fila a Movimientos** intenta resolver `$('Separar Movimientos').item` pero ya no hay mapping 1:1 → **error de paired_item_multiple_matches**

---

## Solución (a implementar en n8n)

### Opción A: Usar `$index` en lugar de `item` (RECOMENDADO)

En el nodo "Agregar Fila a Movimientos", cambiar la referencia del item de:

```
$('Separar Movimientos').item   ← Falla cuando hay multiples items
```

A:

```
$('Separar Movimientos').$index   ← Usa índice, no item mapping
```

O reconstruir desde el array de entrada:

```
$json.piezas[$nodeExecutionData['Separar Movimientos'][0].$index]
```

### Opción B: Rehacer el nodo para armar filas en lote

En lugar de:
- Separar → Buscar → Añadir (1 fila por pieza)

Cambiar a:
- Recibir pedido → Filtrar piezas no anotadas → Añadir múltiples filas en un solo nodo de Google Sheets (operación batch)

Esto es más eficiente pero requiere reescribir el flujo.

---

## Verificación Post-Arreglo

Después de arreglarlo, **ejecutar manualmente** con el webhook del pedido más reciente:

```
POST a HOJA_WEBHOOK con:
{
  "pedido_id": "ZC-260821-A4C64EC2",  // El último que falló
  "total": 223050,
  "piezas": [
    { "referencia": "letra-e", "cantidad": 1 },
    { "referencia": "charm-1", "cantidad": 1 },
    { "referencia": "charm-2", "cantidad": 1 }
  ]
}
```

**Resultado esperado:**
- ✓ 3 filas en *Movimientos* (una por pieza)  
- ✓ *Existencias* actualizada  
- ✓ Sin errores en el nodo

---

## Impacto de No Arreglarlo

**Hoy (sin historial):**
- Reposición: "Subir todo a 4 unidades" (regla pareja, no informada)  
- Falta: Saber si un charm rota 1x/semana o 1x/mes  

**Escenario 2026-08-31 con esto arreglado:**
- Tendremos 10 días de datos de *Movimientos*  
- Podemos calcular: "Capitán América rota 1/día, Deadpool no rota nada en 10 días"  
- Reposición informada: reabastecer lo que se vende, no todo parejo

---

## Responsable

Esta es tarea **de la siguiente sesión que toque n8n**. No requiere cambios en el código de Netlify ni cambios de pauta.

**Criterio de aceptación:**
- [ ] Pestaña *Movimientos* se escribe sin errores
- [ ] 3+ pedidos procesados correctamente
- [ ] Cada fila es una pieza, no un pedido colapsado
