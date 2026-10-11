# Ranking del feed (Rol 4)

Código: `apps/mobile/lib/ranking.ts` (`WEIGHTS`, `scoreNews`, `rankNewsByLocation`), `apps/mobile/lib/affinity.ts` (señales → interés por tema), `apps/mobile/lib/userAffinity.ts` (lectura de Firestore). Pruebas: `apps/mobile/lib/ranking.test.ts` y `affinity.test.ts` (`npm test -w @respai/mobile`).
Última actualización: 2026-10-11.

El ranking **no usa ningún modelo**: cada noticia suma puntos por reglas, se ordena de mayor a menor y después se aplica el piso anti-burbuja. Ninguna regla esconde noticias, solo las ordenan.

## Cómo se calcula

```
puntaje = cercanía + validación + recencia + afinidad
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
| **Afinidad** | `15 × interés` en el tema más afín de la noticia | entre 0 y 15 (nunca llega a 15) |

La recencia se mide contra la noticia **más nueva del pool**, no contra la hora actual, para que el mismo conjunto de noticias siempre dé el mismo orden (función pura, fácil de probar).

### Afinidad: de señales a interés por tema

Sale de las últimas 100 señales del usuario (`users/{uid}/signals`, ver `docs/senales.md`).

| Señal (por noticia) | Aporte |
|---|---|
| `read_time` (sumados por noticia) | `minutos leídos`, con tope de 1 (1 min de lectura visible = lectura completa) |
| Solo `open`, sin lectura | 0,2 (probablemente un toque y salir) |
| `share` | +1 |

Por tema se suma el aporte de cada noticia distinta con ese tema y se satura: `interés = suma / (suma + 2)`.

| Comportamiento | Interés | Puntos de afinidad |
|---|---|---|
| Abrió 1 noticia del tema sin leerla | 0,09 | 1,4 |
| Leyó completa 1 noticia del tema | 0,33 | 5 |
| Leyó completas 2 | 0,5 | 7,5 |
| Leyó y compartió 2 | 0,67 | 10 |
| Leyó 10 | 0,83 | 12,5 |

Los temas se comparan sin tildes ni mayúsculas. Una noticia con varios temas usa el **más afín** (máximo, no suma), para que no gane solo por tener más etiquetas. La tarjeta dice "sigues el tema X" cuando la afinidad aporta **3 puntos o más**: una lectura suelta no se anuncia.

### Por qué estos números

**Sin afinidad** (usuario sin señales), el orden es exactamente el de antes de pasar a puntos (cercanía, luego validación, luego fecha). Cada escalón de un criterio vale más que el máximo de todos los criterios que vienen después:

- Escalón de cercanía (10) > validación máxima + recencia máxima (4 + 1).
- Escalón de validación (2) > recencia máxima (1).

Dos pruebas lo garantizan: una compara el orden por puntaje contra el comparador anterior en 300 pools aleatorios (semilla fija) y otra comprueba esa desigualdad de escalones. Si alguien cambia un peso y rompe el orden, la prueba falla.

**La afinidad rompe ese orden a propósito, pero acotada.** Su máximo (< 15) es mayor que un escalón de cercanía (10) y menor que dos (20, contando también validación y recencia: 15 + 4 + 1 ≤ 20). En la práctica:

- Una noticia internacional de un tema que lees mucho puede pasar a una local de otra región de tu país (sube un escalón).
- Una noticia de otro país **nunca** pasa a una de tu país solo por afinidad (tendría que subir dos).
- El piso anti-burbuja se aplica después, así que ni un fan extremo de un tema pierde la mezcla local/nacional/internacional del top.

Las pruebas `afinidad: nunca sube dos escalones` y `pesos: la afinidad máxima alcanza para un escalón...` lo comprueban; la de `criterio de aceptación: un fan extremo...` cubre el criterio del rol.

La validación sirve **solo para desempatar**. Una noticia `unverified` nunca se oculta: solo deja de ganarle a una noticia igual de cercana que está mejor sustentada (ver `docs/ciclos.md`, 2026-10-10, el caso de California).

### Costo

Cero llamadas a modelos. En Firestore, cada carga del feed lee como mucho 100 señales (100 lecturas), con caché en memoria de 5 minutos para no repetir lecturas al volver al feed. Plan Spark: 50.000 lecturas/día. Si la lectura de señales falla, el feed se ordena sin afinidad (no se rompe).

## Piso anti-burbuja (después del puntaje)

Si en todo el pool existen noticias `local`, `national` e `international`, al menos una de cada una queda entre las **primeras 6** posiciones (`TOP_WINDOW`). La mejor de cada alcance que falta se promueve al final de esa ventana y se marca con `protectedByDiversity: true`. La tarjeta lo explica con "parte de la mezcla de alcances de tu feed". El piso se aplica **después** del puntaje, así que ningún peso (tampoco la afinidad por tema) lo puede desplazar.

## Prominencia

Depende solo de la posición final (`prominenceByPosition` en `lib/feed.ts`): 1.ª → hero, 2.ª y 3.ª → grande, 4.ª a 7.ª → normal, el resto → compacta.

## Historial de cambios de pesos

| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-10-10 | Orden por cercanía y luego fecha (comparador, sin puntos). | Ranking inicial de Etapa 1. |
| 2026-10-10 | Se agrega la validación como desempate entre cercanía y fecha. | Una noticia de fuente única sin confirmar salía de hero solo por ser la única de su país (probando con datos reales). |
| 2026-10-11 | Paso a puntaje numérico con los pesos de la tabla. **Mismo orden que antes.** | Preparar el ranking para sumar la afinidad por tema (señales de comportamiento) como un componente más, con un peso explícito y justificable. |
| 2026-10-11 | Se agrega la afinidad por tema, máximo < 15. | Mayor que un escalón de cercanía (10) para que se note en el feed; menor que dos (20) para que los intereses no le ganen a la cercanía de país. El piso anti-burbuja sigue después. |
