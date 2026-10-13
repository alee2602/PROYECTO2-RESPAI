# Chat de noticias (Rol 2)

Última actualización: 2026-10-12. Este documento crece con cada paso del chat.

## Qué pide el enunciado

El chat es la pantalla inicial, temporal (sin historial entre sesiones) y orientado solo a las noticias publicadas. Tiene que poder:

1. resumir acontecimientos recientes;
2. identificar noticias relevantes para la región simulada del usuario;
3. explicar noticias importantes de otro país o región;
4. consultar novedades sobre temas presentes en las noticias publicadas.

Las respuestas deben dejar ver sus fuentes y distinguir lo confirmado de lo incierto o en desarrollo. Cuando no se pueda confirmar algo, hay que decirlo.

## Flujo planeado

```
pregunta ─► recuperación SIN modelo ─► ¿hay noticias?
                (lib/retrieval.ts)        │
                                          ├─ no ──► respuesta fija "no encontré / no puedo confirmarlo" ($0)
                                          └─ sí ──► modelo redacta con 3 a 5 noticias, cita fuentes y estados
```

| Paso | Estado |
|---|---|
| 1. Recuperación sin modelo | **Hecho** (`apps/mobile/lib/retrieval.ts`) |
| 2. Contrato de la respuesta (tipos) | Pendiente |
| 3. Respuestas sin modelo (sin noticias, pregunta vacía) | Pendiente |
| 4. Prompt del sistema y armado del contexto | Pendiente |
| 5. Endpoint `app/api/chat/` (modo simulado, sin gastar) | Pendiente |
| 6. Pantalla del chat | Pendiente |
| 7. Banco de preguntas de prueba | Pendiente |
| Conectar modelo real + medidor de gasto | Depende de Rol 5 (proveedor, API key, tope) |

## Paso 1 — Recuperación sin modelo

Código: `apps/mobile/lib/retrieval.ts` (`retrieveNews`). Pruebas: `apps/mobile/lib/retrieval.test.ts` (`npm test -w @respai/mobile`).

**Por qué sin modelo:** elegir qué noticias son pertinentes a una pregunta se resuelve con reglas y no cuesta nada. Al modelo solo le llegan las pocas noticias elegidas, así que el contexto es corto y cada llamada sale barata (CLAUDE.md, sección 4).

### Cómo funciona

1. **Normaliza la pregunta:** minúsculas, sin tildes ni signos. Quita palabras vacías: artículos, preguntas típicas y muletillas como "dime", "resúmeme", "noticias".
2. **Detecta la intención:**
   - **Lugares nombrados:** países y regiones del proyecto (`lib/locations.ts`) y alias como "Xela" (Quetzaltenango), "Antigua" (Sacatepéquez), "EE.UU." y "CDMX".
   - **"Mi región / mi zona / aquí"** → la región simulada. **"Mi país / nacional"** → el país simulado. Nunca usa GPS.
   - **Lo reciente:** "hoy", "último", "resumen", "novedades"…
3. **Puntúa cada noticia publicada.** Las palabras se comparan por su raíz de 5 letras: "lluvias" encuentra "Lluvia" y "presidenta" encuentra "presidente".

   | Coincidencia | Puntos |
   |---|---|
   | Palabra en el título | 3 |
   | Palabra en los temas | 3 |
   | Palabra solo en el resumen | 1 |
   | Palabra solo en el cuerpo | 0,5 |
   | Es del país nombrado / de tu país ("mi país") | 5 |
   | Es de la región nombrada / de tu región ("mi región") | 6 |
   | Recencia (solo desempata entre noticias que ya coinciden) | 0 a 1 |

4. **Elige:**
   - Si alguna noticia coincide por tema o lugar, devuelve solo esas, como máximo **5**.
   - Si la pregunta es general ("¿qué pasó hoy?"), devuelve las 5 más recientes.
   - Si pide algo concreto que no aparece en ninguna noticia, **no devuelve nada**. No rellena con noticias al azar.

Cada noticia elegida trae su **"por qué"** (por ejemplo `menciona "elecciones"`, `es de España`). Además se devuelven las **palabras que no aparecen en ninguna noticia** (`unmatchedTerms`). Con eso el chat puede decir "no encontré nada sobre el terremoto" en vez de inventarlo.

### Decisiones de Responsible AI

- **No filtra por estado de validación.** Una noticia `unverified` también se recupera: el chat tiene que decir que no está confirmada, no esconderla.
- **No decide si algo es verdad.** Solo elige qué noticias publicadas son pertinentes. Que una noticia se recupere no la confirma.
- **Solo noticias publicadas.** Quien la llame debe pasar lo que devuelve `fetchPublishedNews` (sin borradores).

### Pruebas (16)

Cubren las 4 consultas del enunciado con las 12 noticias semilla reales: lo reciente, mi región (cambia según la ubicación), otro país (España) y un tema (economía). También cubren alias de lugar, raíz de palabras, la sigla "IA", que no filtra por validación y el tope de 5. Y los casos difíciles: algo no publicado ("terremoto en Japón" → 0 noticias), algo no publicado en un país que sí existe ("terremoto en España" → trae España pero marca `terremoto` como no encontrado), pregunta vacía y base vacía.

### Limitaciones conocidas

- Busca palabras, no significados: "comicios" no encuentra "elecciones" y "carro" no encuentra "auto". Con pocas noticias es aceptable. Si en la demo falla una pregunta razonable, se agregan sinónimos a mano antes que usar un modelo.
- La raíz de 5 letras puede juntar palabras distintas que empiezan igual ("nacional" y "naciones"). Por eso las palabras genéricas de lugar y alcance están en la lista de palabras vacías.
