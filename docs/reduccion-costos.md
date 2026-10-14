# Técnicas de reducción de costos

Última actualización: 2026-10-13. Dueño: Rol 5. Catálogo de las decisiones que bajan el costo del producto, con dónde viven en el código y cómo se comprueba cada una. Números y decisiones generales en `docs/costos.md`; diseño técnico del medidor en `docs/medidor-gasto.md`.

## Principio

> No llamar a un modelo si algo se resuelve con reglas o con una consulta a la base de datos (CLAUDE.md, sección 4).

En todo el producto solo **una** función cuesta dinero: el chat cuando redacta con Haiku 5.5. Las técnicas atacan cuatro frentes:

1. **Flujo:** las preguntas legítimas usan lo mínimo.
2. **Propósito cerrado:** el modelo no gasta en lo que no es su trabajo.
3. **Abuso:** nadie puede gastar el crédito a propósito o por error.
4. **Infraestructura:** niveles gratuitos.

Estados: **Hecho**, **Por hacer** o **Descartado**.

## Resumen

| ID | Técnica | Frente | Estado | Dueño |
|---|---|---|---|---|
| RC-01 | Ranking del feed sin modelo | Flujo | Hecho | Rol 4 |
| RC-02 | Recuperación del chat sin modelo | Flujo | Hecho | Rol 2 |
| RC-03 | Respuestas sin modelo | Flujo | Hecho | Rol 2 |
| RC-04 | Una sola llamada, sin herramientas ni agente | Flujo | Hecho | Rol 2 |
| RC-05 | Contexto corto | Flujo | Hecho | Rol 2 |
| RC-06 | Sin historial de conversación | Flujo | Hecho | Rol 2 |
| RC-07 | Salida acotada | Flujo | Hecho | Rol 2 |
| RC-08 | Pensamiento del modelo al mínimo | Flujo | Parcial | Rol 5 + Rol 2 |
| RC-09 | Contexto según la intención | Flujo | Por hacer | Rol 5 + Rol 2 |
| RC-10 | Consulta acotada a Firestore | Flujo | Por hacer | Rol 5 |
| RC-11 | Caché de la lista de noticias | Flujo | Por hacer | Rol 5 |
| RC-12 | Imágenes libres en vez de generadas | Flujo | Hecho | Rol 3 |
| RC-13 | Prompt de propósito cerrado | Propósito | Parcial | Rol 2 + Rol 5 |
| RC-14 | Filtro previo de pedidos fuera de tema | Propósito | Por hacer | Rol 5 |
| RC-15 | Solo usuarios con sesión | Abuso | Hecho | Rol 2 |
| RC-16 | Pregunta de máximo 300 caracteres | Abuso | Hecho | Rol 2 |
| RC-17 | Límite por usuario | Abuso | Hecho en código; falta probar en vivo | Rol 5 |
| RC-18 | Freno global por hora | Abuso | Hecho en código; falta probar en vivo | Rol 5 |
| RC-19 | Tope total con reserva para la demo | Abuso | Hecho en código; falta probar en vivo | Rol 5 |
| RC-20 | Interruptor de apagado | Abuso | Hecho en código; falta probar en vivo | Rol 5 |
| RC-21 | Infraestructura en niveles gratuitos | Infraestructura | Hecho | Todos |

## 1. Flujo: las preguntas legítimas usan lo mínimo

### RC-01 · Ranking del feed sin modelo — Hecho
- **Qué:** el orden y la prominencia del feed salen de reglas y puntajes (ubicación, alcance, recencia, afinidad por tema, piso anti-burbuja).
- **Ahorro:** cero llamadas al modelo por abrir el feed, sin importar cuántos usuarios haya.
- **Dónde:** `apps/mobile/lib/ranking.ts`, `lib/feed.ts`. Detalle en `docs/ranking.md`.
- **Verificación:** `lib/ranking.test.ts`.

### RC-02 · Recuperación del chat sin modelo — Hecho
- **Qué:** las noticias que responden a la pregunta se eligen por palabras, lugar y recencia. No se usan embeddings ni un modelo.
- **Ahorro:** evita una llamada por pregunta (o el costo de embeddings por noticia y por pregunta).
- **Dónde:** `lib/retrieval.ts`. Detalle en `docs/chat.md`, paso 1.
- **Verificación:** `lib/retrieval.test.ts`.
- **Límite:** busca palabras, no significados. Si falla una pregunta razonable, se agregan sinónimos a mano antes que usar un modelo.

### RC-03 · Respuestas sin modelo — Hecho
- **Qué:** una pregunta vacía, un saludo, una pregunta de más de 300 caracteres o una pregunta sin noticias que la respondan se contesta con un texto fijo.
- **Ahorro:** la llamada entera. Incluye las preguntas fuera de tema que no coinciden con ninguna noticia ("¿cómo está el clima en Nicaragua?").
- **Dónde:** `answerWithoutModel` en `lib/chat.ts`. Detalle en `docs/chat.md`, paso 3.
- **Verificación:** `lib/chat.test.ts`. En producción, el contador `no_model` del tablero.

### RC-04 · Una sola llamada, sin herramientas ni agente — Hecho, se fija como regla
- **Qué:** el modelo recibe las noticias ya elegidas y solo redacta. No tiene herramientas, no busca por su cuenta y no hay bucle.
- **Ahorro:** un agente con herramientas puede hacer varias llamadas por pregunta, y cada una reenvía el contexto completo. Es la decisión que más ahorra.
- **Dónde:** `answerQuestion` en `lib/chatPipeline.ts`.
- **Regla:** no se agregan herramientas ni llamadas encadenadas al chat sin pasar por Rol 5 y anotarlo aquí.

### RC-05 · Contexto corto — Hecho
- **Qué:** máximo 5 noticias por pregunta, con recortes por noticia: resumen de 300 caracteres, nota de 250 y extracto de 500.
- **Ahorro:** entrada menor de 2.500 tokens en el peor caso, frente a mandar todas las noticias.
- **Dónde:** `RETRIEVAL.maxResults` en `lib/retrieval.ts` y `PROMPT_LIMITS` en `lib/prompt.ts`.
- **Verificación:** `lib/prompt.test.ts` fija el tope de 2.500 tokens.

### RC-06 · Sin historial de conversación — Hecho
- **Qué:** cada pregunta es independiente y no se reenvían las anteriores.
- **Ahorro:** sin historial, el costo por pregunta no crece a lo largo de la conversación.
- **Límite:** "¿y en México?" no tiene el contexto de la pregunta anterior. Documentado en `docs/chat.md`.

### RC-07 · Salida acotada — Hecho
- **Qué:** `max_tokens` de 350 y una regla del prompt que pide máximo 120 palabras.
- **Ahorro:** la salida cuesta 5 veces más que la entrada en Haiku 5.5. Además, el tope hace que el peor caso por llamada sea conocido (USD 0,000425).
- **Dónde:** `PROMPT_LIMITS.maxOutputTokens` y `SYSTEM_PROMPT` en `lib/prompt.ts`.

### RC-08 · Pensamiento del modelo al mínimo — Parcial
- **Hecho:** el pensamiento va desactivado por defecto (`lib/anthropic.ts`, variable `CHAT_THINKING`: `disabled` o `low`). **Falta:** el banco de pruebas de abajo, que necesita la API key.
- **Qué:** Haiku 5.5 piensa por defecto con esfuerzo `medium`. Esos tokens se cobran como salida y salen del mismo `max_tokens`. Se usará desactivado o con esfuerzo `low`.
- **Ahorro:** tokens de salida que no se ven. Además evita que el pensamiento consuma los 350 tokens y corte la respuesta.
- **Riesgo:** razonar menos podría empeorar el manejo de contradicciones o de noticias no confirmadas. Se mitiga de dos formas:
  - las citas y la nota "Lo que no está confirmado" las arma el código, no el modelo;
  - se decide con el banco de pruebas.
- **Verificación:** banco de unas 10 preguntas:
  - las 4 consultas del enunciado;
  - fuentes contradictorias;
  - noticia no verificada;
  - algo no publicado;
  - pregunta disfrazada;
  - inyección.

  Se comparan "desactivado" y "`low`" en tokens reales, costo y casos cumplidos. Gana el más barato que pase todos, y el resultado se anota en `docs/ciclos.md`.

### RC-09 · Contexto según la intención — Por hacer
- **Qué:** "resumir lo reciente" y "qué hay en mi región" solo necesitan título, resumen, estado y fuentes. El extracto del cuerpo se manda solo cuando hay que explicar una noticia (1 o 2 noticias).
- **Ahorro estimado:** el caso más caro ("¿qué pasó hoy?", 5 noticias) baja de ~1.900 a ~1.000 tokens de entrada.
- **Dónde:** `buildPrompt` en `lib/prompt.ts` (de Rol 2: se propone y se revisa con esa persona). La intención "reciente" ya la detecta `parseQuestion` en `lib/retrieval.ts`.
- **Verificación:** prueba que compare los tokens estimados por tipo de pregunta, y el banco de pruebas para revisar que el resumen no pierda calidad.

### RC-10 · Consulta acotada a Firestore — Por hacer
- **Qué:** hoy `fetchPublishedNewsRest` (`lib/firestoreRest.ts`) lee **todos** los documentos de `news`, incluidos los borradores (hasta 1.500), en cada pregunta, y filtra después. Se cambia por una consulta que pide solo las publicadas, de la más reciente a la más vieja y con un límite (propuesta: 50).
- **No se filtra por ubicación** en la consulta: rompería "explicar una noticia de otro país". Ese filtro lo hace la recuperación (RC-02).
- **Ahorro:** lecturas de Firestore (plan Spark: 50.000 lecturas por día) y tiempo de respuesta. No ahorra dinero mientras se esté dentro del plan gratuito, pero evita salirse de él si la colección crece.
- **Índices:** ninguno compuesto. Firestore cobra por documento devuelto, no por documento revisado, así que un índice no baja el costo; lo que lo baja es el límite.

### RC-11 · Caché de la lista de noticias — Por hacer
- **Qué:** el servidor guarda en memoria la lista de noticias publicadas unos 60 segundos.
- **Ahorro:** en la demo, diez personas preguntando en el mismo minuto equivalen a una sola lectura de la colección.
- **Seguridad:** para no saltarse la verificación del usuario, el token se verifica aparte con el Admin SDK (`docs/medidor-gasto.md`).
- **Límite:** una noticia recién publicada tarda hasta 60 segundos en aparecer en el chat (en el feed aparece al instante). Hay que tenerlo presente en la "publicación en vivo" de la demo.

### RC-12 · Imágenes libres en vez de generadas — Hecho
- **Qué:** las noticias sin imagen se completan con imágenes libres de Openverse, con atribución. No se generan con IA.
- **Ahorro:** el costo entero de generar imágenes.
- **Dónde:** `apps/admin/lib/images.ts`. Detalle en `docs/imagenes.md`.

## 2. Propósito cerrado: el modelo solo hace su trabajo

### RC-13 · Prompt de propósito cerrado — Parcial
- **Hecho:** las reglas del prompt (`SYSTEM_PROMPT` en `lib/prompt.ts`) ya obligan a responder solo con las noticias dadas (regla 1) y a tratar la pregunta como datos, no como instrucciones (regla 8).
- **Por hacer:** una regla explícita que diga que cualquier otro pedido (poemas, código, traducciones, opiniones, el clima) se rechaza en una sola frase, sin intentar responderlo. Se propone a Rol 2.
- **Ahorro:** una respuesta de rechazo cuesta unos 30 tokens de salida, frente a 350.

### RC-14 · Filtro previo de pedidos fuera de tema — Por hacer
- **Qué:** una lista corta de pedidos ajenos y de intentos de inyección ("escribe", "poema", "código", "traduce", "ignora las instrucciones"…). Si aparece en la pregunta, se responde con un texto fijo (`off_topic`) **sin llamar al modelo**.
- **Por qué hace falta si RC-03 ya filtra:** RC-03 solo frena las preguntas que no coinciden con ninguna noticia. La pregunta disfrazada ("escríbeme un poema largo sobre las elecciones en España") sí coincide con una noticia y llegaría al modelo.
- **Ahorro:** la llamada entera.
- **Riesgo:** bloquear una pregunta legítima. Por eso la lista es corta y la prueba incluye las preguntas de ejemplo y las 4 consultas del enunciado, que nunca deben bloquearse.
- **Dónde:** `lib/offTopic.ts` (nuevo).

## 3. Abuso: nadie gasta el crédito por error o a propósito

### RC-15 · Solo usuarios con sesión — Hecho
- **Qué:** sin un ID token válido de Firebase, el endpoint no responde.
- **Ahorro:** nadie de afuera de la app puede usar el chat.
- **Dónde:** `app/api/chat/route.ts`.

### RC-16 · Pregunta de máximo 300 caracteres — Hecho
- **Qué:** las preguntas más largas se rechazan sin modelo (`too_long`).
- **Ahorro:** el tamaño de la entrada queda acotado aunque alguien pegue un texto largo.
- **Dónde:** `CHAT_LIMITS` en `lib/chat.ts`, con el mismo límite en la caja de texto.

### RC-17 · Límite por usuario — Hecho en código; falta probar en vivo
- **Dónde:** `decideRateLimit` en `lib/usage.ts`; transacción en `lib/usageStoreFirestore.ts`. Valores provisionales: 5 por minuto y 20 por día.
- **Qué:** preguntas por minuto (ráfaga) y por día para cada cuenta, contadas en Firestore (`rate_limits/{uid}`) dentro de una transacción.
- **Ahorro:** un script o un bucle con una sola cuenta no puede vaciar el crédito.
- **Valores:** pregunta abierta (`docs/costos.md`).

### RC-18 · Freno global por hora — Hecho en código; falta probar en vivo
- **Dónde:** `decideBudget` en `lib/usage.ts`, aplicado en `lib/meteredChat.ts`. Valor provisional: USD 1 por hora.
- **Qué:** si el gasto de la hora actual pasa un monto, no se llama al modelo hasta la hora siguiente.
- **Ahorro:** cubre lo que RC-17 no cubre: alguien que use muchas cuentas de Google.
- **Valor:** pregunta abierta.

### RC-19 · Tope total con reserva para la demo — Hecho en código; falta probar en vivo
- **Qué:** si el gasto acumulado más el peor caso de una llamada supera USD 20 − USD 10 de reserva, no se llama al modelo y se responde `budget_exhausted` (un mensaje claro, no un error).
- **Ahorro:** garantiza que queden USD 10 para la presentación.
- **Dónde:** `decideBudget` en `lib/usage.ts` (compara contra el peor caso de `lib/pricing.ts`), con `BUDGET_USD` y `RESERVE_USD`. Diseño en `docs/medidor-gasto.md`.

### RC-20 · Interruptor de apagado — Hecho en código; falta probar en vivo
- **Dónde:** `config/chat.enabled`, leído en `lib/meteredChat.ts` (caché de 30 s en `lib/usageStoreFirestore.ts`). Falta el botón en el tablero del portal: hasta entonces se cambia a mano en Firebase Console.
- **Qué:** un admin apaga el chat desde el tablero del portal (`config/chat.enabled`). El efecto tarda como máximo unos 30 segundos.
- **Ahorro:** respuesta inmediata ante cualquier gasto raro, sin esperar un despliegue.

## 4. Infraestructura

### RC-21 · Niveles gratuitos — Hecho
- **Firebase plan Spark** (Auth y Firestore): sin tarjeta. Se evitó Cloud Functions, que exige el plan Blaze, poniendo el endpoint en Vercel (`docs/ciclos.md`, 2026-09-30).
- **Vercel nivel gratuito:** hosting de la app y del portal, y el endpoint del chat.
- **Openverse:** imágenes libres, sin costo (RC-12).
- **Sin servicios extra:** el medidor usa el mismo Firestore, no Redis ni otra base de datos.
- **Sin procesos programados:** los totales se suman en cada llamada, sin cron.

## Descartado y por qué

| Técnica | Por qué no |
|---|---|
| Prompt caching de Anthropic | Solo abarata la parte repetida de la entrada (la respuesta se cobra igual), y el prompt del sistema (~390 tokens) es más corto que el mínimo que la API cachea. No ahorraría nada. |
| Caché de respuestas "parecidas" | Decidir que dos preguntas son iguales agrega complejidad (o un modelo) y no asegura ahorro. |
| Embeddings o modelo para recuperar noticias | Costo por noticia y por pregunta. Con pocas noticias, la búsqueda por palabras alcanza (RC-02). |
| Índices para abaratar Firestore | Firestore cobra por documento devuelto, no por documento revisado. Lo que baja el costo es el límite (RC-10) y el caché (RC-11). |
| API de uso de Anthropic para el tablero | Exige una Admin API key, a la que no tenemos acceso. Ver `docs/costos.md`. |
| Proceso programado para sumar el gasto | Necesita Cloud Functions programadas (plan Blaze, con tarjeta). |
| Modelo más grande "por las dudas" | Haiku 5.5 alcanza para redactar 120 palabras sobre noticias ya elegidas. Las garantías éticas (citas, incertidumbre) las da el código, no el tamaño del modelo. |
