# Estrategia de Reposición — Basada en Demanda Validada

**Fecha:** 2026-08-24  
**Sesión:** claude/ecommerce-landing-pandora-ewxrv1  
**Decisión:** Enfoque en Marvel + piezas del creative exitoso

---

## 1. Señal de Demanda Validada

### La pauta que ganó
**Creative:** "Pulsera Avengers con Charms de Avengers"  
**Formato:** Foto mostrando bracelet + charms Marvel  
**Copy:** "Arma tu pulsera" (genérico, no menciona Avengers explícitamente)  
**Resultado:** Es la **pauta con mejor rendimiento** (confirmado 2026-08-24)

### Compras confirmadas de ese creative
1. **Jairo** → Capitán América (charm) + Gato Cheshire (charm)  
2. **Mike** → Pulsera Avengers (pulsera)  

**Implicación:** El creative funciona, la gente quiere armar pulseras con charms. Los charms específicos que pidieron (Capitán América) están agotados (stock: 1). El Gato Cheshire, aunque Disney, fue parte de una compra que salió del Avengers creative.

---

## 2. Inventario Crítico (Items Ausentes o Muy Bajo)

| Referencia | Nombre | Precio | Stock Actual | Familia |
|---|---|---|---|---|
| `capitan-america` | Capitán América | $85.000 | 1 | Charm Marvel |
| `deadpool` | Deadpool | $85.000 | 1 | Charm Marvel |
| `pulsera-avengers` | Pulsera Avengers | $58.000 | 0 | Pulsera Marvel |
| `gato-cheshire` | Gato Cheshire | $85.000 | 3 | Charm Disney |
| `spider-man` | Spider-Man | $85.000 | 2 | Charm Marvel |

**Interpretación:** Hay **9 charms Marvel en total**, pero todos están en stock ≤ 3. El cuello de botella no es una referencia específica — es que la demanda Marvel ya agotó las piezas puntuales (Capitán América) y está drenando el resto.

---

## 3. Reposición Recomendada — Fase 1 (Validación)

### Prioridad Inmediata (Reabastecer esta semana)

Para validar que la señal Marvel es consistente y sostenible:

**Charms Marvel más populares (recomendación conservadora):**
- Capitán América: +5 unidades  
- Guantelete del Infinito: +5 unidades  
- Escudo Capitán América: +5 unidades  
- Iron Man: +5 unidades  
- Thor (Mjolnir): +5 unidades  

**Pulseras:**
- Pulsera Avengers: +10 unidades  

**Contexto:** Estos son los que vimos ir y los que más equilibrio tenían el 2026-08-16. 
- **Total charms: 25 unidades** (~$2.125.000 de costo si mantienen el costo unitario de $85k)  
- **Total pulseras: 10 unidades** (~$580.000 de costo)  
- **Costo total fase 1: ~$2.705.000**  
- **Potencial: ~$5.815.000 de utilidad bruta** (si se venden todas)

### Paralelo — Items Disney (soporte comunitario, no principal)

El Gato Cheshire salió en la compra de Capitán América, pero es Disney. No meter presupuesto Marvel en Disney ahora — esta fase es de validación Marvel puro.

---

## 4. Validación Antes de Escalar

**Esperar a tener:**
1. ✓ Historial de *Movimientos* en Google Sheets (n8n — pendiente arreglar nodo)  
2. ✓ Al menos 3-5 compras más de la pauta Avengers (confirmar consistencia)  
3. ✓ Datos de rotación real (no promedio, no "subir todo a 4")  

**Entonces:** Escalar a 50 unidades por referencia Marvel + 25 de Pulsera Avengers.

---

## 5. Lo Que NO Hacer Hasta Confirmar

- ❌ Ordenar todo el catálogo Marvel (gasto disperso, riesgo de quedarse con stock que no rota)  
- ❌ Desdoblarse en otras familias Disney/Pixar ahora (la señal es Marvel)  
- ❌ Aumentar presupuesto de pauta antes de tener 1.3% → 2-3% conversión  

---

## 6. Próximos Pasos

1. **Esta semana:** Validar que el nodo de *Movimientos* en n8n se escriba correctamente
2. **Después de reposición:** Esperar a ver rotación en las 2 próximas semanas
3. **Decisión a 3 semanas:** ¿Escalar Marvel o pivotar?

---

## Apéndice: Todos los Marvel Charms (estado actual)

| Charm | Stock | Precio | Notas |
|---|---|---|---|
| Capitán América | 1 | $85.000 | **CRÍTICO** — vendió 1, queda 1 |
| Deadpool | 1 | $85.000 | **CRÍTICO** |
| Spider-Man | 2 | $85.000 | Bajo |
| Guantelete del Infinito | 3 | $85.000 | Normal |
| Escudo Capitán América | 3 | $85.000 | Normal |
| Wolverine | 3 | $85.000 | Normal |
| Hulk | 3 | $85.000 | Normal |
| Iron Man | 3 | $85.000 | Normal |
| Mjolnir – Martillo de Thor | 3 | $85.000 | Normal |

---

## Datos de Referencia (del análisis anterior)

**Economía unitaria (agosto 2026):**
- Charms: 87,9% de margen ($9.305 costo → $77.449 venta = **~$77k utilidad neta por venta de 2 charms**)  
- Pulseras: 70,7% de margen  

**CAC máximo soportable:** ~$110.386 por compra  
**Conversión actual:** 1.3% checkout→pago (hay que mejorar esto antes de escalar pauta)  
**Costo por checkout:** ~$1.950  
**Negocio:** Aguanta hasta 2% conversión antes de perder plata a presupuesto actual.
