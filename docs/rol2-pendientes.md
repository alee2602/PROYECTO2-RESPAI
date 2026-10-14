# Rol 2 — Chat: checklist hasta la entrega

Entrega y presentación: **16 de octubre de 2026**. Última actualización: 2026-10-14.
Diseño del chat: `docs/chat.md`. Responsabilidades y criterios del rol: `docs/roles-equipo.md` (Rol 2).

Leyenda: 🟢 no depende de nadie · 🟡 depende de otro rol · 🔴 bloqueado hasta que exista lo anterior

## Ya hecho (código, sin modelo)

- [x] Paso 1 — Recuperación de noticias sin modelo (`lib/retrieval.ts`)
- [x] Paso 2 — Contrato de la respuesta: citas e incertidumbre las arma el código (`lib/chat.ts`)
- [x] Paso 3 — Respuestas sin modelo: sin noticias, saludo, pregunta muy larga ($0)
- [x] Paso 4 — Prompt del sistema y contexto; tokens medidos: ~720 a ~1.880 de entrada, máximo 350 de salida (`lib/prompt.ts`)
- [x] Paso 5 — Endpoint `POST /api/chat` en modo de prueba (`app/api/chat/route.ts`)
- [x] Paso 6 — Pantalla del chat (`components/ChatPanel.tsx`)

## 1. Integrar lo hecho — hoy, 13 de octubre

- [x] Commit del paso 6 en `rol2/pantalla-chat`
- [x] PRs mergeados en orden: #22 `rol2/recuperacion` → #23 `rol2/contrato` → #24 `rol2/endpoint` → #25 `rol2/pantalla-chat`
- [ ] 🟢 Actualizar la rama local con `main` (ya trae el medidor del Rol 5, PR #26) antes de seguir
- [ ] 🟢 Avisar al Rol 1:
  - las reglas de "qué noticia se puede mostrar" se movieron de `lib/news.ts` a `lib/newsParse.ts`, sin cambio de comportamiento;
  - `ChatPlaceholder.tsx` se borró y `ChatDock.tsx` ahora usa `ChatPanel`
- [ ] 🟡 Revisión en el preview de Vercel, con la lista de 9 puntos en `docs/chat.md` (paso 6). **Es la primera prueba real del endpoint contra Firestore.** Depende de que el Rol 4 cargue `FIREBASE_SERVICE_ACCOUNT` (sin ella el chat queda en modo de prueba).
- [ ] 🟢 Guardar capturas en `docs/evidencia/chat-*.png`
- [ ] 🟢 Si algo falla en el preview: corregir y anotar el ciclo en `docs/ciclos.md`

## 2. Banco de preguntas (paso 7) — 14 de octubre

- [x] `docs/chat-pruebas.md`: 20 casos, uniendo el banco del Rol 2 y el del Rol 5, con el camino esperado y los criterios de calificación
- [x] Nivel 1 (sin modelo) corrido sobre las 12 noticias semilla: los 20 casos toman el camino esperado. 4 hallazgos (H1 a H4) anotados en el banco
- [ ] 🟢 Avisar al Rol 5 que el banco ya existe, para que no armen otro
- [ ] 🟢 Anotar el ciclo del nivel 1 en `docs/ciclos.md`

## 3. Decisiones con el Rol 5 — resueltas el 13 de octubre

Detalle en `docs/costos.md` y `docs/medidor-gasto.md` (Rol 5, PR #26).

- [x] Modelo: **Claude Haiku 5.5** (`claude-haiku-5-5`), peor caso USD 0,000425 por pregunta
- [x] Cuenta y key: de **Rol 5**, con USD 20 de crédito. La key no se comparte en el repo.
- [x] Reserva para la demo: **USD 10**, editable en el tablero `/costos` del portal. Si el saldo cruzaría la reserva, el chat se apaga solo (`budget_exhausted`) y solo un admin lo vuelve a encender.
- [x] Medidor con tope **dentro del endpoint**: contadores en Firestore (`usage/totals`, por día y por hora), escritos solo por el servidor con el Admin SDK. Guarda tokens, costo y preguntas por camino, nunca el texto.
- [x] Límite por usuario: 5 preguntas por minuto y 20 por día (provisional, `USER_LIMITS` en `lib/usage.ts`)
- [ ] 🟡 Rol 4: cargar `ANTHROPIC_API_KEY` y `FIREBASE_SERVICE_ACCOUNT` en Vercel y desplegar las reglas de Firestore. Confirmar que estén también en **Preview**: sin `FIREBASE_SERVICE_ACCOUNT` el chat nunca llama al modelo.

## 4. Revisar lo que el Rol 5 cambió en mis archivos — 14 de octubre

El Rol 5 ya conectó el modelo (`lib/anthropic.ts`, `lib/meteredChat.ts`, `lib/globalLimit.ts`). Me toca revisar, no construir:

- [ ] 🟢 `app/api/chat/route.ts`: ahora verifica el token con el Admin SDK, revisa interruptor, reserva y límite por usuario **antes** de llamar al modelo
- [ ] 🟢 `lib/chat.ts`: motivos nuevos `off_topic`, `rate_limited`, `chat_disabled` con su texto en `NO_ANSWER_TEXT`. Comprobar que `ChatPanel` los muestra bien.
- [ ] 🟢 Propuesta de **regla 9** en `lib/prompt.ts` (propósito cerrado, `docs/rol5-pendientes.md` punto 1): acordar el texto final con el Rol 5
- [ ] 🟡 Filtro previo de pedidos fuera de tema (`lib/offTopic.ts`, Rol 5): todavía no existe. Revisar que no bloquee las preguntas de ejemplo ni las 4 del enunciado.
- [ ] 🟡 "Tipo de pregunta" en el prompt (`docs/rol5-pendientes.md` punto 3): decidir con el Rol 5 si va como línea en el mensaje, usando `parseQuestion`
- [ ] 🟢 (Opcional) ¿Ejemplos en el prompt? Se decide con el banco de preguntas

## 5. Probar con el modelo real — 14 y 15 de octubre (🔴)

- [ ] 🔴 Correr el banco de preguntas con el modelo (~15 preguntas, menos de 1 centavo con Haiku). Coordinar con el Rol 5, que tiene la key y propone el mismo banco (`docs/rol5-pendientes.md` punto 4): hacer **uno solo**.
- [ ] 🔴 Guardar conversaciones **buenas y malas** como evidencia (capturas y texto)
- [ ] 🔴 Si una respuesta falla: ajustar el prompt y anotar **qué se cambió y por qué** en `docs/ciclos.md`
- [ ] 🔴 Comprobar los criterios de aceptación del rol:
  - [ ] Toda respuesta que afirma un hecho tiene al menos una cita a una noticia publicada
  - [ ] Si la noticia está en desarrollo o no verificada, la respuesta lo dice
  - [ ] Si no hay noticias, lo dice y no inventa
  - [ ] Una llamada típica cuesta menos de lo definido con el Rol 5 (**anotar el costo real**)
- [ ] 🟡 Probar con el Rol 5 que el tope **bloquea** el chat con el mensaje claro, no con un error
- [ ] 🟡 Pasarle al Rol 5 el costo real por pregunta y los ahorros para `docs/costos.md`: recuperación sin modelo, respuestas a $0, contexto corto, sin historial

## 6. Presentación — 15 y 16 de octubre

- [ ] 🟢 Guion de la **sección 5 (Chat)**, que presento yo:
  1. "¿Qué pasó hoy?" (reciente)
  2. "¿Qué hay en mi región?" desde 2 celulares con ubicaciones distintas
  3. "Explícame las elecciones en España" (otro país)
  4. Una noticia en desarrollo → se ve "Lo que no está confirmado"
  5. "¿Qué pasó con el terremoto en Japón?" → "No puedo confirmarlo"
- [ ] 🟢 Aporte a la **sección 6 (Arquitectura)**: flujo del chat (pregunta → recuperación sin modelo → ¿hay noticias? → modelo solo redacta → citas e incertidumbre por código)
- [ ] 🟢 Aporte a la **sección 7 (Transparencia)**: las citas y la incertidumbre las arma el código, no el modelo; la respuesta del modelo no es prueba de nada
- [ ] 🟢 Aporte a la **sección 9 (Costos)**: tokens por pregunta, costo real y cuántas preguntas se resolvieron con $0 (logs de Vercel)
- [ ] 🟢 Una **lección aprendida** para la sección 10. Ideas: un supuesto que cambió (por ejemplo, decidir que el código arme las citas en vez de pedírselas al modelo) o una limitación que queda (las repreguntas sin contexto)
- [ ] 🟡 Participar en al menos un ensayo completo con varios celulares
- [ ] 🟡 Confirmar con el Rol 5 que queda crédito reservado después del último ensayo

## Plan B (si el 15 de octubre Vercel todavía no tiene la key ni la cuenta de servicio)

- [ ] 🟢 Presentar el chat en **modo de prueba**: la recuperación, las citas, la incertidumbre y el "no puedo confirmarlo" funcionan igual, y la pantalla dice "Modo de prueba · sin IA"
- [ ] 🟢 Explicar con honestidad qué falta (conectar el modelo) y mostrar el costo estimado con los tokens medidos
- [ ] 🟢 Anotarlo como limitación en las lecciones aprendidas
