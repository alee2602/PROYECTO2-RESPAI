# Ranking del feed (Rol 4)

Código: `apps/mobile/lib/ranking.ts` (`WEIGHTS`, `scoreNews`, `rankNewsByLocation`). Pruebas: `apps/mobile/lib/ranking.test.ts` (`npm test -w @respai/mobile`).
Última actualización: 2026-10-11.

El ranking **no usa ningún modelo**: cada noticia suma puntos por reglas, se ordena de mayor a menor y después se aplica el piso anti-burbuja. Ninguna regla esconde noticias, solo las ordenan.

## Cómo se calcula

```
puntaje = cercanía + validación + recencia
```

### Tabla de pesos

| Componente | Caso | Puntos |
|---|---|---|
| **Cercanía** | Local de tu región | 40 |
| | Nacional de tu país, o internacional que ocurre en tu país | 30 |
| | Local de otra región de tu país | 20 |
| | Internacional de otro país (o sin país) | 10 |
| | Local o nacional de otro país | 0 |
| **Validación** | `confirmed` | 4 |
| | `in_progress` | 2 |
| | `unverified` | 0 |
| **Recencia** | La más nueva del pool | 1 |
| | Una vida media (48 h) más vieja que la más nueva | 0,5 |
| | En general: `1 × 48 / (48 + horas de diferencia)` | entre 0 y 1 |

La recencia se mide contra la noticia **más nueva del pool**, no contra la hora actual, para que el mismo conjunto de noticias siempre dé el mismo orden (función pura, fácil de probar).

### Por qué estos números

Los pesos actuales reproducen **exactamente** el orden que tenía el ranking antes de pasar a puntos (cercanía, luego validación, luego fecha). Cada escalón de un criterio vale más que el máximo de todos los criterios que vienen después:

- Escalón de cercanía (10) > validación máxima + recencia máxima (4 + 1).
- Escalón de validación (2) > recencia máxima (1).

Dos pruebas lo garantizan: una compara el orden por puntaje contra el comparador anterior en 300 pools aleatorios (semilla fija) y otra comprueba esa desigualdad de escalones. Si alguien cambia un peso y rompe el orden, la prueba falla.

La validación sirve **solo para desempatar**. Una noticia `unverified` nunca se oculta: solo deja de ganarle a una noticia igual de cercana que está mejor sustentada (ver `docs/ciclos.md`, 2026-10-10, el caso de California).

## Piso anti-burbuja (después del puntaje)

Si en todo el pool existen noticias `local`, `national` e `international`, al menos una de cada una queda entre las **primeras 6** posiciones (`TOP_WINDOW`). La mejor de cada alcance que falta se promueve al final de esa ventana y se marca con `protectedByDiversity: true`. La tarjeta lo explica con "parte de la mezcla de alcances de tu feed". El piso se aplica **después** del puntaje, así que ningún peso (tampoco la futura afinidad por tema) lo puede desplazar.

## Prominencia

Depende solo de la posición final (`prominenceByPosition` en `lib/feed.ts`): 1.ª → hero, 2.ª y 3.ª → grande, 4.ª a 7.ª → normal, el resto → compacta.

## Historial de cambios de pesos

| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-10-10 | Orden por cercanía y luego fecha (comparador, sin puntos). | Ranking inicial de Etapa 1. |
| 2026-10-10 | Se agrega la validación como desempate entre cercanía y fecha. | Una noticia de fuente única sin confirmar salía de hero solo por ser la única de su país (probando con datos reales). |
| 2026-10-11 | Paso a puntaje numérico con los pesos de la tabla. **Mismo orden que antes.** | Preparar el ranking para sumar la afinidad por tema (señales de comportamiento) como un componente más, con un peso explícito y justificable. |
