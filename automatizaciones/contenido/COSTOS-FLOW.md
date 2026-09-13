# Costos de Flow — registro real

Una línea por generación, con el número real, no un supuesto. Ver
`BRIEF-FLOW.md` § *El presupuesto de créditos*: el plan Flow Pro tiene tope de
250 créditos, +50 por día, y los créditos no usados se pierden si se llega al
tope (no se acumulan más de 5 días). Esta tabla es la que permite planear una
tanda sin quedarse a medias.

> **Corrección 2026-09-08.** Esta guía decía que el número sale de "lo que
> muestra la interfaz de Flow antes de generar". **No es así**: el panel de
> generación no muestra el costo por adelantado. Lo que sí funciona es pedirle
> el estimado al asistente dentro de Flow, o —más confiable— comparar el saldo
> de créditos (visible en la cuenta de Google, arriba a la derecha) antes y
> después de generar. La diferencia es el número real que va aquí.

Las **imágenes no gastan créditos** — no hace falta anotarlas aquí a menos que
quieras llevar el conteo de todos modos. **El video sí**, siempre se anota.

| Fecha | Generador | Duración | Resolución | Créditos | Para qué guion / pieza |
|---|---|---|---|---|---|
| 2026-09-08 | Omni 1.1 Flash | 4s | — | ~6 (estimado por el asistente de Flow) | Prueba: plano de establecimiento Amor y Amistad, sin joya |
| 2026-09-08 | Veo 3.1 Fast | 8s* | 720p | ~18 (estimado; total verificado por saldo: 250→226, -24) | Prueba: mismo plano, **con la pulsera de referencia incluida** — resultado bueno, joya sin distorsión visible |
| 2026-09-08 | Veo 3.1 Fast | 8s | 720p | **20** (verificado por saldo: 226→206, -20) | Segundo corte, cenital, **con la pulsera** — otra vez impecable |
| 2026-09-08 | Omni 1.1 Flash | — | — | no registrado (número exacto no capturado) | Prueba **con la pulsera de referencia** — **FALLÓ**: la joya se desfiguró visiblemente. Descartado, no se usa este resultado |

\* *Esta fila decía "4s" en la primera versión de esta tabla. Se corrige: al
repetir la prueba se descubrió que **Veo 3.1 Fast no permite bajar de 8
segundos** — el selector de duración lo deja fijo. Es casi seguro que la
primera prueba también fue de 8s, no de 4, aunque no se verificó el saldo en
ese momento con la misma precisión.

**Saldo verificado: 206 de 250.**

### Lo que esto dice sobre los dos modelos — ya resuelto

| Modelo | Duración | Costo por clip | ¿Sostiene la joya de referencia? |
|---|---|---|---|
| Omni 1.1 Flash | Ajustable, permite 4s | ~6 créditos (4s) | **No.** Probado con la pulsera: la desfiguró visiblemente. **No usar para nada que lleve joya** |
| Veo 3.1 Fast | **Fijo en 8s**, no ajustable | 18-20 créditos (8s) | **Sí.** Dos pruebas independientes, ambas impecables a criterio del propietario |

**Conclusión operativa, 2026-09-08:** el riesgo de generar joya en video no es
"video vs. imagen" en general — es específico del modelo. **Veo 3.1 Fast es
el único generador de video autorizado para clips que incluyan la pulsera de
referencia.** Omni 1.1 Flash sigue sirviendo para b-roll **sin** producto (más
barato, sí permite 4s), pero queda descartado para cualquier plano con joya.

Esto no reabre la regla de oro de `BRIEF-FLOW.md` —generar joya en video sigue
siendo el último recurso, no la opción por defecto—, pero si se va a hacer, se
hace con Fast.
