# Transparencia y Responsible AI (Rol 5)

Última actualización: 2026-10-21. Se presenta en la **sección 7** (Rol 5, con aportes de los Roles 2, 3 y 4).

Este documento responde las cinco preguntas de transparencia del enunciado. Para cada una dice **qué decidimos**, **dónde se ve en el producto** (para demostrarlo en vivo, no solo leerlo) y **qué lo garantiza** (código, prueba o evidencia).

Regla que atraviesa todo: **la respuesta de un modelo nunca cuenta como prueba de que algo es verdad**, y **ni el código ni el modelo marcan una noticia como confirmada**. Eso lo decide una persona en el portal.

---

## 1. Importancia y relevancia: ¿cómo decide qué mostrar, en qué orden y con qué prominencia? ¿Cómo evita que una preferencia o la ubicación oculte información importante?

**Decisión:** el feed se ordena con **reglas y puntajes, sin ningún modelo**: cercanía a la ubicación simulada, estado de validación, recencia y afinidad por tema (inferida de lo que la persona lee). Después se aplica un **piso anti-burbuja**: si existen noticias locales, nacionales e internacionales, al menos una de cada una entra en las primeras 6 posiciones, sin importar los intereses. La ubicación la elige la persona; **nunca se usa el GPS**.

| Dónde se ve | Qué ver |
|---|---|
| Feed, cada tarjeta | Línea "por qué aparece": "Ocurre en tu región", "· sigues el tema X", "· parte de la mezcla de alcances de tu feed" (entró por el piso anti-burbuja) |
| Feed, tamaño y posición | Tarjetas hero / grande / normal / compacta según el puntaje |
| Selector de ubicación | Lista de países y regiones; cambiar la ubicación reordena el feed al instante |
| Lector | Sección "por qué la ves" |

**Qué lo garantiza:**
- Pesos documentados en `docs/ranking.md`.
- `apps/mobile/lib/ranking.test.ts` (16 pruebas), con dos criterios en particular:
  - una noticia de otro país nunca sube dos escalones solo por afinidad;
  - "un fan extremo de un tema sigue viendo la mezcla local/nacional/internacional".
- Las señales de comportamiento se describen en `docs/senales.md`: solo `open`, tiempo de lectura y `share`, guardadas en el perfil del propio usuario.

**Límite conocido:** el chat no aplica el piso anti-burbuja ("¿Qué pasó hoy?" trae lo más reciente). Por eso, en la demo, el resumen del chat se muestra junto al feed (`docs/chat-pruebas.md`, H4).

## 2. Fuentes: ¿qué procedencia se conserva y se muestra? ¿Cómo se distingue lo original, los resúmenes y los aportes de IA?

**Decisión:** cada noticia guarda sus fuentes con nombre, URL opcional y **tipo**: `original`, `summary` (resumen de otro medio) o `ai` (aporte generado por IA). No se puede publicar sin al menos una fuente.

| Dónde se ve | Qué ver |
|---|---|
| Portal, formulario | Fila por fuente con su tipo; aviso fijo "Ningún texto generado por IA se publica sin revisión humana"; si hay una fuente `ai`, hay que marcar "Revisé y edité el texto aportado por IA…" para publicar |
| Feed, tarjeta | Primera fuente con su distintivo de tipo |
| Lector | Lista completa de fuentes con tipo y enlace; si hay fuente `ai`: "Parte de este contenido está marcado como **generado por IA**…" |
| Chat | Cada cita muestra sus fuentes con el tipo (ORIGINAL / RESUMEN) |

**Qué lo garantiza:** esquema `News.sources` en `packages/shared/news.ts`. La prueba "no se publica sin fuentes" está en `apps/admin/lib/newsDraft.test.ts`. El feed y el chat ocultan cualquier noticia sin fuentes o sin estado válido (`apps/mobile/lib/newsParse.ts`).

## 3. Validación: ¿cómo se reduce la publicación de noticias falsas? ¿Qué pasa si una fuente no alcanza, dos se contradicen o la noticia no está confirmada?

**Decisión:** tres estados: **Confirmada**, **En desarrollo**, **No verificada**. Los elige una persona admin en el portal, con reglas que impiden lo que no se sostiene:

| Caso | Qué hace el portal |
|---|---|
| Fuente insuficiente (menos de 2 fuentes distintas que no sean IA) | Bloquea "Confirmada"; sugiere "No verificada" o "En desarrollo"; nota obligatoria; ofrece buscar en otros medios |
| Fuentes que se contradicen | La persona lo declara; la noticia queda "En desarrollo" y la nota empieza con "Fuentes contradictorias:" y explica qué dice cada una |
| Sin confirmar con fuentes suficientes | Permite confirmar, pero no lo hace solo; si no confirma, la nota explica por qué |

Una fuente de tipo `ai` nunca cuenta para confirmar. Dos artículos del mismo medio cuentan como una sola fuente.

| Dónde se ve | Qué ver |
|---|---|
| Portal | Diagnóstico en vivo de la sección Validación ("Caso: fuente insuficiente"…); "Confirmada" deshabilitada cuando no corresponde |
| Feed y lector | Distintivo con ícono y texto (no solo color); en el lector, panel de verificación con los 3 pasos y la nota de validación como cita |
| Chat | Caja **"Lo que no está confirmado"** con las noticias en desarrollo o no verificadas que se citan; si no hay noticias: "No puedo confirmarlo" |

**Qué lo garantiza:**
- Flujo completo en `docs/validacion.md`.
- Pruebas en `apps/admin/lib/newsDraft.test.ts`.
- Evidencia en `docs/evidencia/validacion-*.png`.
- En el chat, la caja de incertidumbre **la arma el código** (`uncertaintyNote` en `apps/mobile/lib/chat.ts`), no el modelo: aunque el modelo se equivoque, la persona ve qué no está confirmado.

## 4. Límites de la IA: ¿qué decisiones requieren criterio humano? ¿Cómo se evita tratar una respuesta del modelo como prueba?

**Decisiones que solo toma una persona** (desde el portal, con login de admin):

- publicar, editar o despublicar una noticia;
- elegir su estado de validación (Confirmada, En desarrollo, No verificada) y escribir la nota;
- declarar que dos fuentes se contradicen;
- aprobar un texto aportado por IA (casilla "Revisé y edité…" en cada guardado);
- elegir la imagen y su origen;
- apagar o encender el chat y fijar la reserva de gasto (`/costos`).

**Por qué una respuesta del modelo nunca es prueba:** el modelo no tiene acceso a nada fuera de las noticias publicadas (regla 1 del prompt), y no puede cambiar un estado de validación. Su texto se presenta siempre con la etiqueta "Respuesta generada por IA" y junto a las citas reales. En el portal, una fuente de tipo `ai` no cuenta para confirmar.

**Qué hace la IA:** la IA **solo redacta** la respuesta del chat, con las pocas noticias publicadas que el código ya eligió. Todo lo demás se resuelve sin modelo: ranking, recuperación, citas, incertidumbre, validación e imágenes.

| La IA hace | La IA no hace |
|---|---|
| Redactar un texto corto (≤ 120 palabras) con las noticias que recibe | Elegir qué noticias usar (lo hace `lib/retrieval.ts`, con reglas) |
| Citar con `[n]` | Inventar fuentes: las citas las arma el código; una cita a una noticia que no existe se borra del texto |
| Decir "No puedo confirmarlo con las noticias publicadas" | Confirmar noticias ni cambiar su estado |
| | Responder sobre otra cosa: poemas, código, opiniones o tareas se rechazan con reglas antes del modelo (`lib/offTopic.ts`) y, si pasan, con la regla 9 del prompt |
| | Recordar conversaciones: cada pregunta es independiente y no se guarda su texto |

| Dónde se ve | Qué ver |
|---|---|
| Chat | Etiqueta **"Respuesta generada por IA"** solo cuando respondió el modelo; "sin IA" cuando respondió el código; aviso fijo "Responde solo con noticias publicadas en la app. Revisa siempre las fuentes." |
| Chat, pedido fuera de tema | "Escríbeme un poema…" → "Solo puedo responder sobre las noticias publicadas en la app." |
| Chat, algo no publicado | "No encontré noticias publicadas sobre… No puedo confirmarlo: …una respuesta mía no es prueba de que algo sea cierto." |
| Portal `/costos` | Cuánto se gastó, cuántas preguntas se resolvieron sin modelo y el interruptor para apagar el chat |

**Qué lo garantiza:**
- Reglas del prompt en `apps/mobile/lib/prompt.ts`.
- Pruebas de inyección en `prompt.test.ts`.
- Banco de 20 preguntas con resultados y capturas en `docs/chat-pruebas.md`.
- Privacidad de logs en `lib/safeLog.ts`.

**Límites conocidos:**
- El modelo puede redactar de forma torpe: por ejemplo, tomar "hoy" al pie de la letra (`docs/evidencia/chat-02-hoy.png`).
- Antes de la regla 9, el modelo "rechazaba a medias" un pedido disfrazado (`chat-09-ResponsibleAI.png`).
- Sin historial, el chat no entiende repreguntas como "¿y eso cuándo fue?".

## 5. Imágenes: ¿cómo se identifica y presenta el contenido visual generado o alterado para que no parezca documentación real del hecho?

**Decisión:** el portal **no genera imágenes**. Para una noticia sin foto ofrece:
- **imágenes libres con atribución**, de Openverse ($0, licencias CC o dominio público);
- una **URL manual** con su origen declarado.

El campo `image.origin` (`real_photo`, `free_attributed`, `ai_generated`) es obligatorio y lo elige una persona. Una imagen libre lleva la atribución "Imagen ilustrativa (no es del hecho): …". Sin imagen también es válido: la app muestra un bloque gráfico con el tema, que no parece foto.

**Imágenes alteradas:** el esquema no tiene un origen "alterada". Una foto real editada con IA (por ejemplo, rellenada o retocada) se marca como `ai_generated`, que es lo más cauto, y su atribución dice qué se alteró y con qué herramienta. Si el portal recibe un origen desconocido, también lo carga como `ai_generated` hasta que una persona lo corrija.

| Dónde se ve | Qué ver |
|---|---|
| Portal | Buscador de imágenes libres; origen y atribución obligatorios; vista previa de la tarjeta y del pie del lector |
| Feed y lector | `ai_generated` → etiqueta **"Imagen generada por IA"** encima, siempre; pie "Ilustrativa: no es una foto del hecho." |
| Lector | Atribución completa (autor, licencia, enlace) |

**Qué lo garantiza:** `docs/imagenes.md`, pruebas en `apps/admin/lib/images.test.ts` y evidencia en `docs/evidencia/imagen-*.png`.

---

## Resumen para la diapositiva

| Pregunta | Respuesta en una línea | Demo en vivo |
|---|---|---|
| Relevancia | Reglas y puntajes, sin modelo, con piso anti-burbuja | Dos celulares con ubicaciones distintas; leer "por qué aparece" |
| Fuentes | Cada noticia guarda sus fuentes con su tipo (original, resumen, IA) | Lector con lista de fuentes |
| Validación | Lo decide una persona; el portal bloquea "Confirmada" sin 2 fuentes distintas | Portal: noticia con una sola fuente |
| Límites de la IA | La IA solo redacta; citas e incertidumbre las arma el código | Chat: "terremoto en Japón" y "escríbeme un poema" |
| Imágenes | Libres con atribución, sin generación; la etiqueta de IA es obligatoria | Portal: buscar imagen libre para la noticia sin foto |
