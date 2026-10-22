# Requerimientos, criterios de aceptación y definición de Done (Rol 5)

Última actualización: 2026-10-21. Fuente: el enunciado del proyecto, `CLAUDE.md` y `docs/roles-equipo.md`.

Leyenda de estado:
- ✅ **cumplido, con evidencia**;
- 🟡 **hecho en código, falta la prueba en vivo o en dispositivo**;
- ⏳ **pendiente**.

Un criterio solo se marca ✅ cuando su evidencia existe en el repo (prueba automática, captura o entrada en `docs/ciclos.md`).

## 1. Requerimientos funcionales

| ID | Requerimiento | Rol | Criterio de aceptación | Estado | Evidencia |
|---|---|---|---|---|---|
| RF-01 | App móvil instalable como PWA en iPhone y Android, sin tiendas | 1 | Se instala con "Añadir a pantalla de inicio" y abre a pantalla completa en un iPhone y un Android reales | 🟡 iPhone ✅, Android ⏳ | `docs/ciclos.md` 2026-09-30 |
| RF-02 | Login con Google (Firebase Auth) en app y portal | 1, 3 | Una persona nueva entra con Google en menos de 2 minutos; la sesión sobrevive a cerrar la app | 🟡 iPhone ✅, Android ⏳ | `docs/ciclos.md` 2026-09-30; `acceso-admin.png` |
| RF-03 | Ubicación simulada elegida por la persona, nunca GPS | 1 | El selector guarda país y región en `users/{uid}`; ningún código pide geolocalización | ✅ | `apps/mobile/lib/profile.tsx`, `app/ubicacion/` |
| RF-04 | Feed personalizado con jerarquía visual | 1, 4 | Dos ubicaciones distintas ven un orden y prominencia distintos para las mismas noticias | ✅ | `ranking.test.ts`; `formulario-en-app.jpeg` |
| RF-05 | Protección contra burbujas | 4 | En el top 6 hay local, nacional e internacional si existen, también para un fan extremo de un tema | ✅ | `ranking.test.ts` ("criterio de aceptación: un fan extremo…") |
| RF-06 | Lector de noticia con fuentes, estado e imagen | 1 | Ninguna noticia se muestra sin estado y fuentes; la imagen de IA lleva etiqueta también en el lector | ✅ | `newsParse.test.ts`; `imagen-en-app.png` |
| RF-07 | Portal: crear, editar, publicar y despublicar noticias | 3 | No se publica sin fuente ni estado; `publishedAt` y `updatedAt` se registran | ✅ | `newsDraft.test.ts`; `lista-*.png` |
| RF-08 | Flujo de validación para fuente insuficiente, contradicción y sin confirmar | 3 | "Confirmada" bloqueada con menos de 2 fuentes distintas no IA; contradicción → En desarrollo con nota | ✅ | `docs/validacion.md`; `validacion-*.png` |
| RF-09 | Flujo de imagen para noticias sin foto | 3 | Origen obligatorio; imagen libre con atribución "ilustrativa"; etiqueta visible si es IA | ✅ | `docs/imagenes.md`; `imagen-*.png` |
| RF-10 | Chat como pantalla inicial, temporal | 2, 1 | Al abrir la app aparece el chat; al recargar se borra la conversación | ✅ | `docs/chat.md` paso 6; `chat-01-inicio.png` |
| RF-11 | Chat: resumir lo reciente | 2 | Respuesta corta con cada noticia citada | ✅ | `chat-02-hoy.png` |
| RF-12 | Chat: noticias de la región simulada | 2 | Con dos ubicaciones distintas la respuesta cambia y empieza por lo local | 🟡 | `chat-07a-region.png`; falta la comparación con dos celulares en un ensayo |
| RF-13 | Chat: explicar una noticia de otro país | 2 | Explicación citada que respeta el estado | ✅ | `chat-03-otroPais.png` |
| RF-14 | Chat: decir "no puedo confirmarlo" | 2 | Sin noticias sobre lo preguntado → lo dice y no inventa | ✅ | `chat-05-noconfirmado.png`; `chat.test.ts` |
| RF-15 | Chat: distinguir confirmado de en desarrollo o no verificado | 2 | Si cita una noticia no confirmada aparece "Lo que no está confirmado" | ✅ | `chat-04-incierto.png`, `chat-08-ResponsibleAI.png` |
| RF-16 | Chat: solo responde sobre noticias publicadas | 2, 5 | Pedidos ajenos e inyecciones se rechazan con una frase; las preguntas legítimas nunca se bloquean | 🟡 | `offTopic.test.ts`; falta el nivel 2 desplegado (`docs/chat-pruebas.md`) |
| RF-17 | Varios usuarios con ubicaciones distintas a la vez | Todos | Al menos 3 celulares en ubicaciones distintas usan la app al mismo tiempo en un ensayo | ⏳ | Ensayo (`docs/plan-pruebas.md`, P-04) |

## 2. Requerimientos no funcionales

| ID | Requerimiento | Criterio de aceptación | Estado | Evidencia |
|---|---|---|---|---|
| RNF-01 | Presupuesto de USD 20 en IA | Gasto acumulado y saldo visibles en `/costos`; queda reserva para la presentación | 🟡 | `docs/costos.md`; falta la revisión del saldo después del último ensayo |
| RNF-02 | Tope de gasto que apaga el chat antes de agotar el saldo | Subir la reserva por encima del saldo apaga el chat con mensaje claro, no con error | 🟡 | `globalLimit.test.ts`, `meteredChat.test.ts`; falta la prueba en vivo (`docs/plan-pruebas.md`, P-09) |
| RNF-03 | Ninguna clave en el cliente ni en el repo | La key solo vive en variables de Vercel; el endpoint del chat es el único que llama al modelo | ✅ | `app/api/chat/route.ts`; `.env.example` sin valores |
| RNF-04 | No llamar a un modelo si se resuelve con reglas | Ranking, recuperación, citas, incertidumbre, validación e imágenes sin modelo | ✅ | `docs/reduccion-costos.md` (RC-01 a RC-14) |
| RNF-05 | Costo por pregunta acotado | Peor caso ≤ USD 0,000425; contexto < 2.500 tokens; salida ≤ 350 | ✅ | `prompt.test.ts`, `pricing.test.ts` |
| RNF-06 | Protección contra abuso | Solo con sesión; ≤ 300 caracteres; 5 preguntas por minuto y 20 por día por usuario | 🟡 | `usage.test.ts`; falta la prueba en vivo |
| RNF-07 | Privacidad | No se guarda el texto de las preguntas; los logs no filtran contenido | ✅ | `safeLog.test.ts`; `docs/medidor-gasto.md` |
| RNF-08 | Backend en la nube | App y endpoint en Vercel; datos en Firestore | 🟡 App ✅ (capturas desde Vercel), portal ⏳ | `docs/rol3-portal.md` ("Antes de la demo") |
| RNF-09 | Accesibilidad básica | Los estados se distinguen por ícono y texto, no solo por color; las zonas seguras se respetan en iOS | 🟡 | `globals.css`; falta la revisión en iPhone con notch |

## 3. Definición de Done

Una tarea está **Done** cuando cumple todo esto:

1. **Criterio de aceptación escrito** antes de empezar, en el PR o en este documento.
2. **Funciona de punta a punta en la nube**, no solo en localhost, si la tarea tiene parte visible.
3. **Pruebas:** la lógica nueva tiene prueba automática (`npm test -w @respai/mobile` o `-w @respai/admin`) y **todas** las pruebas pasan. `tsc` pasa.
4. **Evidencia guardada:** una captura en `docs/evidencia/`, la salida de una prueba o una nota en el documento del área.
5. **Ciclo anotado** en `docs/ciclos.md` si algo falló o cambió una decisión: qué se esperaba, qué pasó, qué se cambió y por qué.
6. **Reglas del proyecto respetadas:**
   - sin claves en el cliente ni en el repo;
   - sin llamadas a modelos que se puedan evitar, y si hay una nueva, su costo anotado en `docs/costos.md`;
   - el esquema de `packages/shared` no se cambia sin avisar al Rol 4;
   - nada marca una noticia como confirmada salvo una persona.
7. **Revisión:** un PR por tarea, revisado por otra persona antes de entrar a `main` (estrategia de ramas en `docs/roles-equipo.md`, regla 1).
8. **Documentación al día:** `docs/estado-tecnico.md` si cambió qué existe, y el checklist del rol.

## 4. Tareas abiertas que bloquean un ✅

| Tarea | Desbloquea | Quién |
|---|---|---|
| Prueba de login e instalación en un Android real | RF-01, RF-02 | Rol 1 |
| Desplegar el portal en Vercel | RNF-08 | Rol 3 |
| Nivel 2 del banco de preguntas, desde la app desplegada | RF-16 | Rol 2 + Rol 5 |
| Prueba en vivo del tope y del límite por usuario | RNF-02, RNF-06 | Rol 5 |
| Ensayo con 3 o más celulares en ubicaciones distintas | RF-12, RF-17 | Todos |
| Revisión del saldo después del último ensayo | RNF-01 | Rol 5 |
| Confirmación por escrito del profesor sobre la PWA | (riesgo de alcance) | Rol 5 |
