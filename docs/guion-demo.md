# Guion de la presentación (Rol 5)

Última actualización: 2026-10-21. Orden obligatorio del enunciado (`CLAUDE.md`, sección 10). Quién presenta qué: `docs/roles-equipo.md`.

Los tiempos son una propuesta para unos 30 minutos; se ajustan en el primer ensayo.

## Antes de empezar (checklist del día)

- [ ] **Datos limpios:** borrar las noticias de prueba (PRUEBA, PRUEBA3, **PRUEBA4**…); las 12 semilla reales siguen publicadas.
- [ ] **Noticias para publicar en vivo**, ya redactadas, con sus fuentes reales verificadas:
  - una local con **una sola fuente** al principio;
  - una nacional o internacional;
  - una **sin imagen**.
- [ ] **Portal desplegado** y con el dominio autorizado en Firebase Authentication.
- [ ] **Celulares:** al menos 3, con la PWA instalada y la sesión iniciada. Al menos un iPhone y un Android. Ubicaciones distintas ya elegidas: Guatemala · Quetzaltenango, Guatemala · Sacatepéquez y España · Madrid.
- [ ] **Costos:** captura de `/costos` al empezar (gasto, saldo, reserva USD 10); el chat está encendido.
- [ ] **Pantalla compartida:** una laptop con el portal y otra (o un celular espejado) con la app.

## 1. Producto y alcance — Rol 5 (2 min)

- **Qué es:** una app de noticias personalizada por ubicación simulada, con un chat que responde solo con las noticias publicadas y un portal donde una persona publica y valida.
- **Qué no es:** no usa GPS, no está en tiendas (PWA por link o QR) y la IA no decide qué es verdad.
- **Alcance:** PWA (chat, feed, lector, ubicación), portal (publicar, validar, imágenes, costos), endpoint del chat con medidor de gasto.

## 2. App móvil — Rol 1 (4 min)

Ver `docs/roles-equipo.md` (Rol 1). Mostrar:
1. login con Google en iPhone y en Android;
2. el chat como pantalla inicial;
3. el feed con jerarquía;
4. el lector con fuentes y estado;
5. el cambio de ubicación que reordena el feed.

## 3. Publicación en vivo — Rol 3 (3 min)

Guion detallado en `docs/rol3-portal.md` ("Guion para la demo"):
1. noticia con una sola fuente → "Confirmada" bloqueada → buscar en otros medios → publicar;
2. noticia sin imagen → imagen libre con atribución "ilustrativa";
3. noticia con fuentes contradictorias.

## 4. Validación con compañeros — Rol 1, con apoyo del Rol 4 (3 min)

Las personas con celular muestran la noticia recién publicada:
- quien está en la región la ve arriba;
- quien está en otra región la ve más abajo, pero la ve;
- en todos los feeds aparece la mezcla local, nacional e internacional ("parte de la mezcla de alcances de tu feed").

## 5. Chat — Rol 2 (4 min)

Preguntas en este orden. Cada una muestra una cosa distinta.

| # | Ubicación | Pregunta | Qué mostrar | Qué decir |
|---|---|---|---|---|
| 1 | Xela | "¿Qué pasó hoy?" | Resumen con `[n]` y la lista de fuentes con su estado | "Cada dato tiene su cita. Las citas no las escribe el modelo: las arma el código con las noticias que recuperó." |
| 2 | Xela y Sacatepéquez (2 celulares) | "¿Qué noticias hay en mi región?" | Cada uno empieza por su noticia local (Expoferia / CAIMI) | "La ubicación es simulada, nunca GPS. Y el CAIMI sale como **no verificada**: tiene una sola fuente." |
| 3 | Xela | "Explícame la noticia de las elecciones en España" | Explicación citada de otro país, con "Confirmada" | "Explica con lo publicado, nada más." |
| 4 | Xela | "¿Cómo va el crecimiento de Argentina?" | La caja **"Lo que no está confirmado"** | "Está en desarrollo, y eso lo marca el código aunque el modelo se olvide de decirlo." |
| 5 | Xela | "¿Qué pasó con el terremoto en Japón?" | "No encontré noticias… No puedo confirmarlo", sin etiqueta de IA | "Aquí no se llamó al modelo: cero costo. Si no hay noticias publicadas, no inventa." |
| 6 | Xela | "Escríbeme un poema sobre las elecciones en España" | "Solo puedo responder sobre las noticias publicadas en la app." | "Antes, el modelo rechazaba a medias (mostrar `chat-09`). Ahora un filtro con reglas lo frena antes, gratis, y el prompt es la segunda barrera." |

**Plan B:** si el chat falla o se apagó por el tope, mostrar el mensaje claro y explicar que es el tope funcionando; seguir con las capturas de `docs/evidencia/chat-*.png`.

## 6. Arquitectura y decisiones — Rol 4, con apoyo del Rol 2 (3 min)

- **Diagrama:**
  - PWA y portal (Next.js en Vercel);
  - Firebase Auth y Firestore (plan gratuito);
  - `POST /api/chat` en Vercel → medidor → Haiku 5.5.
- **Flujo del chat (Rol 2):**

  ```
  pregunta → ¿fuera de tema? (reglas, $0)
           → recuperación sin modelo
           → ¿hay noticias? (si no: "no puedo confirmarlo", $0)
           → el modelo solo redacta
           → citas e incertidumbre las arma el código
  ```
- **Decisiones con su porqué:**
  - Vercel en vez de Cloud Functions: evita el plan Blaze, que exige tarjeta;
  - ranking por puntajes documentados (`docs/ranking.md`);
  - esquema en inglés con tabla de equivalencias.

## 7. Transparencia y Responsible AI — Rol 5, con los Roles 2, 3 y 4 (4 min)

Usar la tabla "Resumen para la diapositiva" de `docs/transparencia.md`. Cada pregunta se responde **señalando la pantalla** donde se ve, no solo leyendo:

| Pregunta | Quién | Dónde se ve |
|---|---|---|
| Relevancia | Rol 4 | "Por qué aparece" en el feed |
| Fuentes | Rol 3 | Lector y formulario |
| Validación | Rol 3 | Diagnóstico en el portal |
| Límites de la IA | Rol 2 | Chat, casos 4 a 6 de la sección 5 |
| Imágenes | Rol 3 | Etiqueta y atribución |

Frase de cierre: "La respuesta de un modelo nunca cuenta como prueba, y nada se marca como confirmado si no lo decide una persona."

## 8. Engineering loops y gestión — Rol 5 (3 min)

Un ciclo por rol, de `docs/ciclos.md`, contado como **qué esperábamos → qué pasó → qué cambiamos**:

| Rol | Ciclo |
|---|---|
| Equipo (Etapa 0) | Login en iPhone: se esperaba que fallara (riesgo conocido de Safari); se probó primero con una página desechable y funcionó. Se construyó encima con confianza (2026-09-30) |
| 1 | **Falta:** el Rol 1 todavía no tiene un ciclo propio en `docs/ciclos.md` (regla 6 de `docs/roles-equipo.md`). Candidato: la prueba en Android o "el feed no se actualizaba solo al cambiar de ubicación" (2026-10-10, sin rol anotado) |
| 2 | Pedido disfrazado: el banco predijo que "escríbeme un poema" llegaría al modelo; la captura lo confirmó; se agregó el filtro con reglas y la regla 9 (2026-10-14 → 2026-10-21) |
| 3 | Validación: dos artículos del mismo medio contaban como 2 fuentes y dejaban confirmar (captura `validacion-antes-mismo-medio-contaba-2.png`); ahora hacen falta 2 fuentes **distintas** (2026-10-10) |
| 4 | Noticias de ficticias a reales por decisión del profesor; la verificación profunda encontró 2 errores en el primer set (2026-10-10). Además, la lista de admins pasó del código a Firestore por privacidad (2026-10-12) |
| 5 | Logs: una prueba demostró que los errores filtraban la pregunta del usuario; se creó `safeLog` (2026-10-13). Y una API key mal generada que ninguna prueba detectaba llevó a las pruebas en vivo (2026-10-14) |

**Gestión:**
- una tarea, una rama, un PR revisado;
- criterios y Done en `docs/requerimientos.md`;
- plan de pruebas en `docs/plan-pruebas.md`;
- 170 + 48 pruebas automáticas.

## 9. Costos — Rol 5, con apoyo del Rol 2 (3 min)

Mostrar `/costos` en vivo:
- **Gasto, saldo y reserva:** gasto acumulado ___, saldo ___, reserva USD 10. Llenar el día de la demo y comparar con la captura del inicio.
- **Costo por función:** solo el chat con modelo cuesta dinero, ≤ USD 0,000425 por pregunta (Haiku 5.5). Todo lo demás cuesta USD 0 (`docs/costos.md`).
- **Ahorros:**
  - preguntas resueltas sin modelo (sin noticias, saludo, fuera de tema);
  - contexto corto (máximo 5 noticias, < 2.500 tokens);
  - sin historial;
  - salida ≤ 350 tokens;
  - imágenes libres en vez de generadas.
- **Protección:** límite por usuario, interruptor y reserva que apaga el chat sola (se puede mostrar en vivo subiendo la reserva, prueba P-09).

## 10. Lecciones aprendidas — Todos (2 min, una cada uno)

Propuestas (cada quien elige la suya):
- **Rol 2:** "Decidimos que el código arme las citas y la incertidumbre, no el modelo. Así, aunque el modelo se equivoque, la persona ve las fuentes reales." Limitación que queda: sin historial, el chat no entiende repreguntas.
- **Rol 5:** "Pensábamos que el riesgo era quedarnos sin crédito; con Haiku la demo cuesta centavos. El riesgo real era el abuso y la privacidad, y ahí pusimos las protecciones."
- **Roles 1, 3 y 4:** a completar por cada persona.
