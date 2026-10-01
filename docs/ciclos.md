# Log de ciclos de ingeniería

Formato por ciclo: qué se esperaba, qué pasó, qué se cambió y por qué.

## 2026-09-30 — Arranque de Etapa 0

**Se esperaba:** definir desde cero la estructura del repo y el esquema de noticia antes de escribir código de producto.

**Qué pasó:**
- Se leyó el CLAUDE.md del repo y se comparó contra el enunciado oficial del proyecto. No se encontraron contradicciones; el CLAUDE.md es una interpretación fiel, con decisiones de diseño propias del equipo (esquema de noticia, estados de validación, cupo anti-burbuja) que el enunciado deja abiertas a cada equipo.
- Surgió una instrucción externa (recibida en clase/reunión, no del enunciado) de instalar LM Studio con modelos locales (Qwen, posible "Gemma"/otro ~27B mal transcrito) y usar Ollama/OpenCode. Se confirmó con la usuaria que es solo para pruebas/desarrollo local, no para el endpoint de chat de producción — evita el conflicto con el requisito de backend en la nube (sección 2.5 del CLAUDE.md).
- Se creó la estructura de carpetas sugerida (`/apps/app`, `/apps/admin`, `/packages/shared`, `/functions`, `/docs`) con un README por carpeta.
- Se confirmó el esquema de `Noticia` (sección 6 del CLAUDE.md) y se guardó en `/packages/shared/noticia.ts`, sin cambios respecto al borrador.

**Qué se cambió y por qué:** nada del esquema ni del enunciado se modificó; se documentó el estado de las decisiones pendientes en `/docs/decisiones-pendientes.md` para no perderlas de vista, dado que el equipo todavía no asigna roles ni cierra el stack.

**Pendiente para el próximo ciclo:** asignar roles, decidir stack, crear proyecto de Firebase y probar login de Google en un iPhone real (riesgo conocido de `signInWithPopup`/`signInWithRedirect` en PWA instalada en iOS).

## 2026-09-30 — Setup de Firebase y decisión de hosting

**Se esperaba:** crear el proyecto de Firebase (Auth + Firestore) siguiendo el checklist de Etapa 0, sin necesitar decidir el stack completo todavía.

**Qué pasó:**
- Se creó el proyecto `respai-news-app` en Firebase, plan **Spark** (gratis), sin Google Analytics ni Gemini in Firebase (no aportaban nada al proyecto).
- Se habilitó Google como proveedor de login en Authentication.
- Al configurar Firestore, surgió la pregunta de si el endpoint del chat correría en Cloud Functions de Firebase. Se identificó que Cloud Functions requiere el **plan Blaze** (pago por uso, exige tarjeta de crédito) para poder hacer llamadas salientes a APIs externas — necesario para hablar con el modelo de IA del chat.
- Se decidió separar responsabilidades: **Firebase solo para Auth + Firestore** (se queda en plan Spark, sin tarjeta), y **Vercel para el hosting del frontend y el endpoint serverless del chat** (sí permite llamadas salientes sin plan de pago).

**Qué se cambió y por qué:** se resolvió una de las decisiones pendientes del stack (dónde corre el chat) antes de lo previsto, porque bloqueaba decidir qué tipo de base de datos/plan de Firebase usar. La razón fue puramente de costo/riesgo: evitar poner una tarjeta de crédito en el proyecto cuando hay una alternativa gratuita que cumple lo mismo.

**Pendiente para el próximo ciclo:** terminar de crear Firestore (modo de prueba), registrar la app web en Firebase para obtener la config del cliente, y definir el framework de frontend (Next.js u otro) ahora que el hosting ya es Vercel.

## 2026-09-30 — Prueba de login de Google en iPhone real (riesgo de la sección 5)

**Se esperaba:** que `signInWithPopup` y/o `signInWithRedirect` fallaran dentro de una PWA instalada en iOS, por el bloqueo de almacenamiento entre dominios de Safari que menciona la sección 5 del CLAUDE.md — había que confirmarlo con evidencia antes de construir el resto de la app encima.

**Qué pasó:**
- Se armó una página de prueba desechable (`/pruebas/ios-login/`), sin framework, desplegada en Vercel (`https://ios-login.vercel.app`), con botones separados para probar popup y redirect.
- Se agregó el dominio de Vercel a Authorized domains en Firebase Authentication.
- En Safari normal (sin instalar): login con popup funcionó sin problema (caso base).
- Instalada como PWA en un iPhone real ("Agregar a pantalla de inicio"): **tanto popup como redirect funcionaron** dentro de la app instalada.
- Se cerró la app por completo (no solo minimizada) y se volvió a abrir: la sesión **persistió**, sin pedir volver a iniciar sesión.

**Qué se cambió y por qué:** se descarta el riesgo que tenía más incertidumbre del proyecto. La hipótesis del CLAUDE.md (basada en problemas reportados en otros proyectos) no se cumplió en este caso concreto — posiblemente porque Firebase Auth usa `authDomain` en `firebaseapp.com`, que iOS no trata como "third-party" de la misma forma que un dominio arbitrario. No se cambia nada de la arquitectura planeada; se puede seguir construyendo con `signInWithPopup` o `signInWithRedirect` sin plan de contingencia adicional.

**Pendiente:** repetir esta misma prueba en al menos un Android antes de dar por cerrado el checklist de Etapa 0 (debería funcionar sin complicaciones, pero no se ha probado todavía).
